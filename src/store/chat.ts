/**
 * src/store/chat.ts — 聊天 Zustand Store（PANE-02 / PANE-03 / D-10 / D-11）
 *
 * 职责：
 * - 管理聊天消息列表（messages）和流式状态（isStreaming）
 * - sendMessage：构建消息历史 → 调用 ProviderRegistry.resolve → 流式生成
 * - stopStreaming：调用 abortController.abort()，AbortError 静默处理（已生成内容不丢失）
 * - retryMessage：移除失败气泡，用原始 prompt 重发（D-11）
 * - clearHistory：清空消息历史（关闭 Task Pane 时调用）
 *
 * 安全约束（T-02-17）：
 * - messages 仅存于内存，Task Pane 关闭即清空（PANE-03）
 * - 不序列化到任何存储（不持久化聊天记录）
 *
 * 可见性 abort（PANE-03 / Pitfall 3）：
 * - sendMessage 创建 AbortController 后立即调用 setupVisibilityAbort
 * - cleanup() 在 finally 块内调用，防止事件监听器泄漏
 */

import { create } from 'zustand';
import type { SelectionContext } from '../adapters/DocumentAdapter';
import type { LLMConfig } from '../providers/types';
import { ProviderRegistry } from '../providers/registry';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { setupVisibilityAbort } from '../providers/queue';
import { calcCostCny } from '../providers/pricing';
import { useProviderStore } from './providers';

// ---------------------------------------------------------------------------
// Message 类型
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isStreaming?: boolean;
  tokenCount?: number;
  /** null = 自定义 Provider，不显示价格（D-17 / COST-02） */
  costCny?: number | null;
  errorCode?: string;
  /** D-11：重试时用此 prompt 重发 */
  retryPrompt?: string;
}

// ---------------------------------------------------------------------------
// ChatState 接口
// ---------------------------------------------------------------------------

interface ChatState {
  messages: Message[];
  isStreaming: boolean;
  abortController: AbortController | null;

  sendMessage(prompt: string, selectionCtx?: SelectionContext): Promise<void>;
  stopStreaming(): void;
  retryMessage(messageId: string): Promise<void>;
  clearHistory(): void;
}

// ---------------------------------------------------------------------------
// useChatStore
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isStreaming: false,
  abortController: null,

  async sendMessage(prompt, selectionCtx) {
    if (get().isStreaming) return; // 防止并发发送

    // 1. 构建用户消息（附带选区上下文 D-15）
    const userContent =
      selectionCtx && selectionCtx.kind !== 'none'
        ? `[上下文: ${JSON.stringify(selectionCtx)}]\n\n${prompt}`
        : prompt;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      isStreaming: true,
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isStreaming: true,
    }));

    // 2. 创建 AbortController，注册 visibilitychange abort（Pitfall 3）
    const controller = new AbortController();
    const cleanup = setupVisibilityAbort(controller);
    set({ abortController: controller });

    try {
      // 3. 从 providerStore 获取当前默认 LLM 配置
      const providerState = useProviderStore.getState();
      const config = ProviderRegistry.resolve('chat', () => {
        const p = providerState.providers.find(
          (p) => p.id === providerState.defaultLLMProviderId,
        );
        if (!p) throw new Error('默认 Provider 未配置');
        return p;
      }) as LLMConfig;

      // 4. 构建消息历史（系统 prompt + 已有历史 + 当前用户消息）
      const historyMessages = get()
        .messages.filter((m) => m.role !== 'error' && !m.isStreaming)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      const messages = [
        {
          role: 'system' as const,
          content: 'You are Aster, an AI assistant for Microsoft Office.',
        },
        ...historyMessages,
        { role: 'user' as const, content: userContent },
      ];

      // 5. 流式生成（SSE 逐字追加）
      const llm = new OpenAICompatibleLLM();
      for await (const event of llm.streamChat(messages, config, controller.signal)) {
        if (event.type === 'delta') {
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + event.content }
                : m,
            ),
          }));
        } else if (event.type === 'usage') {
          const costCny = calcCostCny(
            {
              promptTokens: event.promptTokens,
              completionTokens: event.completionTokens,
            },
            config.providerId,
            config.model,
          );
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, tokenCount: event.totalTokens, costCny }
                : m,
            ),
          }));
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // 用户停止或 Task Pane 隐藏——保留已生成内容，不报错（PANE-03）
        set((s) => ({
          messages: s.messages.map((m) =>
            m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
          ),
        }));
        return;
      }
      // 错误——替换 assistant 气泡为 error 气泡（D-10 / D-11 重试）
      const errCode = (e as Record<string, string>)?.code ?? 'NETWORK';
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                role: 'error',
                content: (e as Error).message,
                errorCode: errCode,
                retryPrompt: prompt,
                isStreaming: false,
              }
            : m,
        ),
      }));
    } finally {
      cleanup();
      set({ isStreaming: false, abortController: null });
      // 确保最后一条消息标记为非流式状态
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id ? { ...m, isStreaming: false } : m,
        ),
      }));
    }
  },

  stopStreaming() {
    get().abortController?.abort();
  },

  async retryMessage(messageId) {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg?.retryPrompt) return;
    // 移除失败气泡，用原始 prompt 重新发送（D-11）
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
    await get().sendMessage(msg.retryPrompt);
  },

  clearHistory() {
    get().abortController?.abort();
    set({ messages: [], isStreaming: false, abortController: null });
  },
}));

// ---------------------------------------------------------------------------
// Named selector hooks（性能优化：避免全 store re-render）
// ---------------------------------------------------------------------------

/** useMessages — 仅订阅 messages 数组变化 */
export const useMessages = () => useChatStore((s) => s.messages);

/** useIsStreaming — 仅订阅 isStreaming 布尔值变化 */
export const useIsStreaming = () => useChatStore((s) => s.isStreaming);
