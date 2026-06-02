/**
 * src/store/chat.ts — 聊天 Zustand Store（Plan 03 D-01 / D-08 thin-delegate 改造）
 *
 * 职责（Phase 3 改造后）：
 * - 纯 message store：管理 messages 数组（user / assistant / tool / error 四 role）
 * - sendMessage：thin delegate — push user message 后调 useAgentStore.runAgent
 * - stopStreaming：thin delegate — useAgentStore.abort('user')
 * - retryMessage：移除失败气泡 → 用原 prompt 重发（thin delegate 到 runAgent）
 * - clearHistory：清空消息历史 + abort 任何在飞 agent run
 *
 * Message v2 schema（D-08）：
 * - role 加 'tool'（agent loop tool result 气泡）
 * - 新增 toolCallId / toolName / toolResult / agentRunId / agentStep（'tool' role 用）
 * - 删 tokenCount / costCny（Plan 03-01 cost 全砍）
 * - 删 acceptToolCall / rejectToolCall（D-19 G-05 v1 confirm/auto 砍）
 *
 * 安全约束（T-02-17）：messages 仅存于内存，Task Pane 关闭即清空。
 */

import { create } from 'zustand';
import type { SelectionContext, DocumentAdapter } from '../adapters/DocumentAdapter';
import { useAgentStore } from '../agent/agentStore';
import type { ToolResult } from '../agent/tools';
import { storage } from '../lib/storage';
import { StorageQuotaError } from '../errors/index';
import { useAttachmentStore } from './attachments';
import { AihubmixVisionClient } from '../providers/aihubmix-vision';
import type { VisionConfig } from '../providers/aihubmix-vision';
import { ProviderRegistry } from '../providers/registry';

// ---------------------------------------------------------------------------
// ToolCall 类型（保留 v1 schema，agent loop 用同一份结构记录每步 tool call —— D-08）
// ---------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
  /** Plan 03 / agent loop 用 'pending' / 'accepted'；v1 confirm/auto 'rejected' 砍后保留兼容字段 */
  status?: 'pending' | 'accepted' | 'rejected';
}

// ---------------------------------------------------------------------------
// Message v2 schema（D-08）
// ---------------------------------------------------------------------------

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  isStreaming?: boolean;
  /** 消息创建时间戳（Unix ms），用于 ChatBubble 时间戳渲染 */
  ts?: number;
  errorCode?: string;
  /** D-11：重试时用此 prompt 重发 */
  retryPrompt?: string;

  // assistant role：累积 tool_calls
  toolCalls?: ToolCall[];

  // 'tool' role 专用（D-08 — agent loop push tool result 气泡时填）
  toolCallId?: string;
  toolName?: string;
  toolResult?: ToolResult;
  agentRunId?: string;
  agentStep?: number;
  /** UI-05：tool 消息的 read/write 分类（来自 ToolDef.kind，loop-helpers push 时写入） */
  kind?: 'read' | 'write';
}

// ---------------------------------------------------------------------------
// ChatState 接口
// ---------------------------------------------------------------------------

interface ChatState {
  messages: Message[];

  /** Phase 6 D-16：chip 填充的 seed；InputBar 监听变化后填入 text + 清除 draft */
  draftPrompt: string;
  setDraftPrompt: (prompt: string) => void;
  clearDraftPrompt: () => void;

  /** push 一条新 message —— id 缺省时自动生成 */
  pushMessage(m: Partial<Message> & { role: Message['role']; content?: string }): void;
  /** 把 delta 追加到指定 message.content（agent loop 流式 token 用） */
  appendDeltaToMessage(id: string, delta: string): void;
  /** 用 patch 部分更新指定 message（agent loop finalize streaming 用） */
  finalizeMessage(id: string, patch: Partial<Message>): void;

  /** D-01 thin delegate：先 push user message，再调 useAgentStore.runAgent */
  sendMessage(
    prompt: string,
    selectionCtx: SelectionContext | undefined,
    adapter: DocumentAdapter,
  ): Promise<void>;

  /** D-01 thin delegate：useAgentStore.abort('user') */
  stopStreaming(): void;

  /** D-11：移除失败气泡 → 用原 prompt 重新 sendMessage */
  retryMessage(messageId: string, adapter: DocumentAdapter): Promise<void>;

  /** 清空消息历史 + abort 任何在飞 agent run，有 docKey 时同步删 storage */
  clearHistory(docKey?: string): void;
  /** Phase 8 F: 从 localStorage 加载聊天历史（hydrate，main.tsx Office.onReady 内调用）*/
  loadHistory(docKey: string): void;
  /** Phase 8 F: 保存聊天历史到 localStorage（每轮 agent run 完成后调用，D-14）*/
  saveHistory(docKey: string): void;
}

// ---------------------------------------------------------------------------
// 持久化序列化（Phase 8 F）
// ---------------------------------------------------------------------------

interface StorableMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  ts?: number;
}

/** 序列化白名单：只存 user/assistant 文字，丢弃 tool/error/streaming 中间态（PITFALLS §F4）*/
function serializeForStorage(messages: Message[]): StorableMessage[] {
  return messages
    .filter(
      (m): m is Message & { role: 'user' | 'assistant' } =>
        (m.role === 'user' || m.role === 'assistant') && !m.isStreaming,
    )
    .map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content.slice(0, 2000), // 每条 ≤2000 字符防 quota（D-14）
      ts: m.ts,
    }));
}

// ---------------------------------------------------------------------------
// useChatStore
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],

  // Phase 6 D-16：chip seed 填充机制
  draftPrompt: '',
  setDraftPrompt: (prompt) => set({ draftPrompt: prompt }),
  clearDraftPrompt: () => set({ draftPrompt: '' }),

  pushMessage(m) {
    const msg: Message = {
      id: m.id ?? crypto.randomUUID(),
      content: m.content ?? '',
      // 默认时间戳：所有 role 在 push 时即获得 ts，供 ChatBubble 渲染 msg-time。
      // user message 已显式传 ts；assistant/tool/error 走此默认（loop.ts push 时不传 ts）。
      ts: Date.now(),
      ...m,
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },

  appendDeltaToMessage(id, delta) {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + delta } : m,
      ),
    }));
  },

  finalizeMessage(id, patch) {
    set((s) => ({
      messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  },

  async sendMessage(prompt, selectionCtx, adapter) {
    // Phase 17 演进：通过 getImages() 读取图片子集（store 已演进为判别联合）
    const images = useAttachmentStore.getState().getImages();

    // 即时反馈（Phase 15 UX 修复）：先 push user message，点发送的瞬间聊天区就有反应，
    // 不被随后的 vision 分析（可能数秒）阻塞。content 只含原始 prompt——evidence/base64
    // 只进 finalPrompt → runAgent，绝不进 pushMessage（NFR-09 / T-15-08 仍满足）。
    get().pushMessage({ role: 'user', content: prompt, ts: Date.now() });

    let finalPrompt = prompt;
    if (images.length > 0) {
      // vision 分析窗口（runAgent 启动前的空窗期）：置 visionPreparing → ChatStream 显示「看图中…」指示气泡
      useAgentStore.getState().setVisionPreparing(true);
      try {
        // ProviderRegistry.resolve('vision') — 未配 aihubmix key → throw KeyInvalidError
        // KeyInvalidError 被下方 catch 捕获 → finalPrompt 降级，不阻断发送（Pitfall 6）
        const cfg = ProviderRegistry.resolve('vision', () => {
          // vision case 不调 getDefaultLLM（只需 aihubmix key），占位函数永不被执行
          throw new Error('getDefaultLLM not used for vision');
        }) as VisionConfig;
        const visionImages = images.map(({ base64, mimeType }) => ({ base64, mimeType }));
        const userText = `请分析以下图片内容，然后回答用户的问题：${prompt}`;
        const { content } = await new AihubmixVisionClient().analyzeImages(
          userText,
          visionImages,
          cfg,
        );
        // RESEARCH §问题 5 范式：evidence 注入 prompt 头部，原 prompt 保留
        finalPrompt = `[图片分析 evidence]\n${content}\n---\n${prompt}`;
      } catch {
        // vision 失败（网络/key 未配）：诚实降级，不阻断发送（Pitfall 6 守则）
        // catch {} 不读 err（T-15-13：不拼接 err.message 防 apiKey 泄露）
        finalPrompt = `[注：图片分析失败，将在无图情况下回答]\n${prompt}`;
      } finally {
        // 无论成败：关「看图中」指示 + 清空附件图（决策 B：发送后清，仍 memory-only；
        // 图已消费进 finalPrompt，成功/失败两路都清。代价：多轮追问同一张图需重新上传）
        useAgentStore.getState().setVisionPreparing(false);
        useAttachmentStore.getState().clearImages();
      }
    }

    // Thin delegate to agent loop — 传 finalPrompt（可能含 vision evidence）
    await useAgentStore.getState().runAgent(finalPrompt, selectionCtx, adapter);
  },

  stopStreaming() {
    // D-10 / AGENT-13 单一 abort 入口
    useAgentStore.getState().abort('user');
  },

  async retryMessage(messageId, adapter) {
    const msg = get().messages.find((m) => m.id === messageId);
    if (!msg?.retryPrompt) return;
    // 移除失败气泡，用原 prompt 重发（thin delegate）
    set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
    await get().sendMessage(msg.retryPrompt, undefined, adapter);
  },

  clearHistory(docKey?: string) {
    useAgentStore.getState().abort('user');
    set({ messages: [] });
    if (docKey) {
      storage.remove(docKey); // 只清当前文档，D-12
    }
  },

  loadHistory(docKey: string) {
    try {
      const stored = storage.get<{ version: number; messages: StorableMessage[] }>(docKey);
      if (!stored || stored.version !== 1 || !Array.isArray(stored.messages)) return;
      const hydrated: Message[] = stored.messages.map((m) => ({
        id: m.id ?? crypto.randomUUID(),
        role: m.role,
        content: m.content,
        ts: m.ts,
      }));
      set({ messages: hydrated });
    } catch {
      // 反序列化失败静默忽略（JSON 损坏 / 格式不兼容）
    }
  },

  saveHistory(docKey: string) {
    const { messages } = get();
    const serialized = serializeForStorage(messages);
    const payload = { version: 1, messages: serialized, lastSaved: Date.now() };
    try {
      storage.set(docKey, payload);
    } catch (err) {
      if (err instanceof StorageQuotaError) {
        // 丢最旧 20%，重试一次
        const trimmed = serialized.slice(Math.floor(serialized.length * 0.2));
        try {
          storage.set(docKey, { ...payload, messages: trimmed });
        } catch {
          // 二次失败静默，不影响 UI
        }
      }
    }
  },
}));

// ---------------------------------------------------------------------------
// Named selector hooks（性能优化：避免全 store re-render）
// ---------------------------------------------------------------------------

/** useMessages — 仅订阅 messages 数组变化 */
export const useMessages = () => useChatStore((s) => s.messages);

/**
 * useIsStreaming — Plan 03 D-01 后改 delegate 到 agentStore.agentStatus !== 'idle'。
 * 保留此 hook 以兼容 v1 调用方（ChatStream / ChatBubble），返回 boolean。
 */
export const useIsStreaming = () => {
  const status = useAgentStore((s) => s.agentStatus);
  return status !== 'idle';
};
