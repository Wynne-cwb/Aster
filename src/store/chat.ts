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
}

// ---------------------------------------------------------------------------
// ChatState 接口
// ---------------------------------------------------------------------------

interface ChatState {
  messages: Message[];

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

  /** 清空消息历史 + abort 任何在飞 agent run */
  clearHistory(): void;
}

// ---------------------------------------------------------------------------
// useChatStore
// ---------------------------------------------------------------------------

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],

  pushMessage(m) {
    const msg: Message = {
      id: m.id ?? crypto.randomUUID(),
      content: m.content ?? '',
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
    // D-01：先 push user message —— Plan 03 loop.ts 不再 push user（loop L62 直接用 prompt 拼 wire messages）
    get().pushMessage({ role: 'user', content: prompt });
    // Thin delegate to agent loop —— Phase 3 唯一主路径（D-01）
    await useAgentStore.getState().runAgent(prompt, selectionCtx, adapter);
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

  clearHistory() {
    useAgentStore.getState().abort('user');
    set({ messages: [] });
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
