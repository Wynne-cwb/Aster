/**
 * src/store/chat.test.ts — chatStore thin delegate（Plan 03-05 D-01 / D-08）
 *
 * 覆盖目标：
 * - sendMessage 是 thin delegate（调 useAgentStore.runAgent，不再直接调 LLM）
 * - sendMessage 先 push user message（loop 内不再 push user — 见 Plan 03 loop.ts L62）
 * - Message v2 schema 支持 role='tool' + agent metadata
 * - acceptToolCall / rejectToolCall 已删除（D-19 G-05 v1 confirm/auto 砍）
 * - stopStreaming 改 delegate 到 useAgentStore.abort('user')
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChatStore } from './chat';
import { useAgentStore } from '../agent/agentStore';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

const mockAdapter = {
  capabilities: () => ({
    host: 'word' as const,
    supportsSelectionEvents: true,
    supportedInserts: ['text' as const],
  }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
} as unknown as DocumentAdapter;

describe('chatStore.sendMessage thin delegate (D-01)', () => {
  let origRunAgent: ReturnType<typeof useAgentStore.getState>['runAgent'];
  let origAbort: ReturnType<typeof useAgentStore.getState>['abort'];

  beforeEach(() => {
    useChatStore.setState({ messages: [] } as never);
    origRunAgent = useAgentStore.getState().runAgent;
    origAbort = useAgentStore.getState().abort;
  });

  afterEach(() => {
    // 还原 agentStore 方法，避免 leak
    useAgentStore.setState({ runAgent: origRunAgent, abort: origAbort } as never);
    vi.restoreAllMocks();
  });

  it('Test 1: sendMessage(prompt, selectionCtx, adapter) 调 useAgentStore.runAgent 一次，参数透传', async () => {
    const runAgentSpy = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ runAgent: runAgentSpy } as never);

    const ctx = { kind: 'word' as const, charCount: 0 };
    await useChatStore.getState().sendMessage('hello', ctx, mockAdapter);

    expect(runAgentSpy).toHaveBeenCalledTimes(1);
    expect(runAgentSpy).toHaveBeenCalledWith('hello', ctx, mockAdapter);
  });

  it('Test 2: sendMessage 先 push role="user" message 再 delegate（loop 内不再 push user）', async () => {
    const callOrder: string[] = [];
    const runAgentSpy = vi.fn().mockImplementation(async () => {
      callOrder.push('runAgent');
      // 验证调 runAgent 时 user message 已在 messages 数组
      const msgs = useChatStore.getState().messages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].role).toBe('user');
      expect(msgs[0].content).toBe('hi');
    });
    useAgentStore.setState({ runAgent: runAgentSpy } as never);

    await useChatStore.getState().sendMessage('hi', undefined, mockAdapter);

    expect(callOrder).toEqual(['runAgent']);
  });

  it('Test 3: pushMessage({role:"tool", ...}) 字段全保留（toolCallId / toolName / toolResult / agentRunId / agentStep）', () => {
    useChatStore.getState().pushMessage({
      role: 'tool',
      content: '{"ok":true}',
      toolCallId: 'c1',
      toolName: 'append_paragraph',
      toolResult: { ok: true, data: { written: 5 } },
      agentRunId: 'r1',
      agentStep: 2,
    });
    const msgs = useChatStore.getState().messages;
    expect(msgs).toHaveLength(1);
    expect(msgs[0].role).toBe('tool');
    expect(msgs[0].toolCallId).toBe('c1');
    expect(msgs[0].toolName).toBe('append_paragraph');
    expect(msgs[0].toolResult).toEqual({ ok: true, data: { written: 5 } });
    expect(msgs[0].agentRunId).toBe('r1');
    expect(msgs[0].agentStep).toBe(2);
  });

  it('Test 4: chatStore 已无 acceptToolCall / rejectToolCall 方法（D-19 G-05 v1 confirm/auto 砍）', () => {
    const state = useChatStore.getState();
    expect((state as never as { acceptToolCall?: unknown }).acceptToolCall).toBeUndefined();
    expect((state as never as { rejectToolCall?: unknown }).rejectToolCall).toBeUndefined();
  });

  it('Test 5: stopStreaming 改 delegate 到 useAgentStore.abort("user")', () => {
    const abortSpy = vi.fn();
    useAgentStore.setState({ abort: abortSpy } as never);

    useChatStore.getState().stopStreaming();

    expect(abortSpy).toHaveBeenCalledWith('user');
  });

  it('Test 6: appendDeltaToMessage 把 delta 追加到指定 message.content', () => {
    useChatStore.getState().pushMessage({ role: 'assistant', content: 'Hello', id: 'm1' } as never);
    useChatStore.getState().appendDeltaToMessage('m1', ' world');
    const msg = useChatStore.getState().messages.find((m) => m.id === 'm1');
    expect(msg?.content).toBe('Hello world');
  });

  it('Test 7: finalizeMessage 用 patch 部分更新指定 message', () => {
    useChatStore.getState().pushMessage({
      role: 'assistant',
      content: '',
      id: 'm2',
      isStreaming: true,
    } as never);
    useChatStore.getState().finalizeMessage('m2', { content: 'done', isStreaming: false });
    const msg = useChatStore.getState().messages.find((m) => m.id === 'm2');
    expect(msg?.content).toBe('done');
    expect(msg?.isStreaming).toBe(false);
  });

  it('Test 8: retryMessage 走 thin delegate（移除原 error 气泡 → 调 sendMessage）', async () => {
    const runAgentSpy = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ runAgent: runAgentSpy } as never);

    useChatStore.getState().pushMessage({
      id: 'err1',
      role: 'error',
      content: '请求失败',
      retryPrompt: '原始 prompt',
    } as never);

    await useChatStore.getState().retryMessage('err1', mockAdapter);

    // error 气泡被移除
    expect(useChatStore.getState().messages.find((m) => m.id === 'err1')).toBeUndefined();
    // 用原 prompt 调 runAgent
    expect(runAgentSpy).toHaveBeenCalledWith('原始 prompt', undefined, mockAdapter);
  });

  it('Test 9: clearHistory 调 useAgentStore.abort + 清空 messages', () => {
    const abortSpy = vi.fn();
    useAgentStore.setState({ abort: abortSpy } as never);

    useChatStore.getState().pushMessage({ role: 'user', content: 'a' });
    useChatStore.getState().pushMessage({ role: 'assistant', content: 'b' });
    expect(useChatStore.getState().messages).toHaveLength(2);

    useChatStore.getState().clearHistory();

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(abortSpy).toHaveBeenCalledWith('user');
  });
});
