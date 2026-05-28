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
import type { SelectionContext, DocumentAdapter } from '../adapters/DocumentAdapter';
import type { LLMConfig } from '../providers/types';
import { ProviderRegistry } from '../providers/registry';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { setupVisibilityAbort } from '../providers/queue';
import { useProviderStore } from './providers';
import { AsterError } from '../errors';

// ---------------------------------------------------------------------------
// ToolCall 类型（G-05 D-20）
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: 'insert_to_document';
  arguments: {
    text: string;
    position: 'cursor' | 'replace_selection' | 'append_end';
  };
  /** confirm 模式：用户决策前 = 'pending'；接受后 = 'accepted'；拒绝后 = 'rejected'
   *  auto 模式：直接 'accepted'（用户没机会拒绝） */
  status: 'pending' | 'accepted' | 'rejected';
}

// ---------------------------------------------------------------------------
// Message 类型
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isStreaming?: boolean;
  errorCode?: string;
  /** D-11：重试时用此 prompt 重发 */
  retryPrompt?: string;
  /** G-05 D-20：assistant 调 insert_to_document 时累积 tool_calls；其它 role 不用此字段 */
  toolCalls?: ToolCall[];
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
  /** G-05 D-20：接受 tool_call，调 adapter.insert 写入文档（adapter 由组件层注入） */
  acceptToolCall(messageId: string, toolCallId: string, adapter: DocumentAdapter): Promise<void>;
  /** G-05 D-20：拒绝 tool_call（不写文档），更新 status='rejected' */
  rejectToolCall(messageId: string, toolCallId: string): void;
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
        } else if (event.type === 'tool_call_end') {
          // G-05 D-20：解析 arguments JSON，按 autoInsertMode 走 confirm/auto 路径
          let parsedArgs: ToolCall['arguments'];
          try {
            parsedArgs = JSON.parse(event.arguments) as ToolCall['arguments'];
          } catch {
            continue; // 畸形 arguments 静默忽略
          }
          // schema 校验（T-02.1-05-02 / CR-04）：
          // ① position 必须是合法枚举值
          if (
            parsedArgs.position !== 'cursor' &&
            parsedArgs.position !== 'replace_selection' &&
            parsedArgs.position !== 'append_end'
          ) {
            continue;
          }
          // ② text 必须是字符串，防止非字符串值传给 adapter（undefined/null/number 会导致 Office.js UB）
          if (typeof parsedArgs.text !== 'string') continue;
          // ③ text 长度上限：防止超大写入占满用户文档（100K 字符约 200KB，Office.js 建议 ≤ 1MB）
          if (parsedArgs.text.length > 100_000) continue;

          // 初始 status 一律 'pending'：
          //   - confirm 模式：用户在 ChatBubble 点「✓ 插入」推进
          //   - auto 模式：ChatBubble 的 AutoInsertEffect 监听 pending+auto → 调 acceptToolCall
          // 不在此处预设 'accepted'——会与 acceptToolCall 入口的幂等 guard
          // (`if (tc.status === 'accepted') return`) 冲突，导致 adapter.insert 从未被调用、
          // 但 UI 仍显示「已写入」假回执（02.1 UAT-4 ③ 真机暴露）。
          const toolCall: ToolCall = {
            id: event.id,
            name: 'insert_to_document',
            arguments: parsedArgs,
            status: 'pending',
          };

          // 把 toolCall 挂到 assistant message
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
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
      // 安全处理（T-02-21 / CR-02）：只信任 AsterError 子类的 message（受控构建，不含 Key）；
      // 其余异常（Office.js、网络层、第三方）统一用固定友好提示，防止 Key 泄露到 UI。
      const safeMsg = e instanceof AsterError
        ? e.message
        : '请求遇到未知错误，请重试';
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                role: 'error',
                content: safeMsg,
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

  async acceptToolCall(messageId, toolCallId, adapter) {
    const msg = get().messages.find((m) => m.id === messageId);
    const tc = msg?.toolCalls?.find((t) => t.id === toolCallId);
    if (!tc) return;
    if (tc.status === 'accepted') return; // 幂等：已写入则跳过

    try {
      await adapter.insert({
        type: 'text',
        value: tc.arguments.text,
        position: tc.arguments.position,
      });
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                toolCalls: m.toolCalls?.map((t) =>
                  t.id === toolCallId ? { ...t, status: 'accepted' as const } : t,
                ),
              }
            : m,
        ),
      }));
    } catch (err) {
      // adapter.insert 失败（HostApiError）→ 保持 'pending' 状态，让用户看到「未写入」提示
      console.warn('[Aster] insert_to_document 失败', err);
    }
  },

  rejectToolCall(messageId, toolCallId) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              toolCalls: m.toolCalls?.map((t) =>
                t.id === toolCallId ? { ...t, status: 'rejected' as const } : t,
              ),
            }
          : m,
      ),
    }));
  },
}));

// ---------------------------------------------------------------------------
// Named selector hooks（性能优化：避免全 store re-render）
// ---------------------------------------------------------------------------

/** useMessages — 仅订阅 messages 数组变化 */
export const useMessages = () => useChatStore((s) => s.messages);

/** useIsStreaming — 仅订阅 isStreaming 布尔值变化 */
export const useIsStreaming = () => useChatStore((s) => s.isStreaming);
