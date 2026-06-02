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
import { useAttachmentStore } from './attachments';
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
    useAttachmentStore.getState().clearImages();
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

  it('Test 10: sendMessage 发送后清空附件图（真机 UAT 决策 B / 反转 D-10「发送后保留」）', async () => {
    const runAgentSpy = vi.fn().mockResolvedValue(undefined);
    useAgentStore.setState({ runAgent: runAgentSpy } as never);

    useAttachmentStore.getState().addImages([
      { id: 'a1', base64: 'QUFB', mimeType: 'image/png', fileName: 'a.png', sizeBytes: 3 },
    ]);
    expect(useAttachmentStore.getState().images).toHaveLength(1);

    // 测试环境无 vision key → ProviderRegistry.resolve('vision') 抛 → 外层 catch 降级；
    // clearImages 在 try/catch 之后执行，成功/失败两路都清（不触真实网络）
    await useChatStore.getState().sendMessage('看这张图', undefined, mockAdapter);

    expect(runAgentSpy).toHaveBeenCalledTimes(1);
    // 发送后附件图被清空（仍 memory-only，只是清得更早：发送即清，而非等 × / 刷新）
    expect(useAttachmentStore.getState().images).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Phase 8 HIST-01/02 chat 持久化守门（由 08-04 Task 2 实现后 GREEN）
// ---------------------------------------------------------------------------
import * as storageModule from '../lib/storage';

// storage mock（防止真实 localStorage 依赖）
vi.mock('../lib/storage', () => ({
  storage: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    remove: vi.fn(),
  },
  STORAGE_KEYS: { CHAT_HISTORY_PREFIX: 'aster:chat:' },
}));

describe('chat.ts — HIST-01/02 持久化往返与清空', () => {
  // 顶层获取 mocked storage，各 it 共用同一实例（WARNING #2 修复）
  const mockedStorage = vi.mocked(storageModule.storage);

  beforeEach(() => {
    useChatStore.setState({ messages: [] } as never);
    vi.clearAllMocks();
  });

  it('saveHistory 调用 storage.set，key 含 aster:chat: 前缀', () => {
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: 'hello', ts: 1 },
        { id: 'a1', role: 'assistant', content: 'world', ts: 2 },
      ],
    } as never);
    useChatStore.getState().saveHistory('aster:chat:testDoc');
    expect(mockedStorage.set).toHaveBeenCalledWith(
      'aster:chat:testDoc',
      expect.objectContaining({ version: 1, messages: expect.any(Array) })
    );
  });

  it('clearHistory 传 docKey 时调用 storage.remove（HIST-02 清空当前文档）', () => {
    useChatStore.getState().clearHistory('aster:chat:testDoc');
    expect(mockedStorage.remove).toHaveBeenCalledWith('aster:chat:testDoc');
    expect(useChatStore.getState().messages).toHaveLength(0);
  });

  it('serializeForStorage 白名单：只存 user|assistant 文字，每条 ≤2000 字符', () => {
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: 'a'.repeat(3000), ts: 1 },
        { id: 'a1', role: 'assistant', content: 'ok', ts: 2 },
        { id: 't1', role: 'tool', content: 'tool_result', ts: 3 },
        { id: 'e1', role: 'error', content: 'err', ts: 4 },
      ],
    } as never);
    useChatStore.getState().saveHistory('aster:chat:testDoc');
    // 统一用 mockedStorage 取 mock.calls（WARNING #2 修复：不用 require）
    const call = mockedStorage.set.mock.calls[0];
    const payload = call[1] as { messages: Array<{ role: string; content: string }> };
    // 只含 user + assistant，不含 tool/error
    const roles = payload.messages.map((m) => m.role);
    expect(roles).not.toContain('tool');
    expect(roles).not.toContain('error');
    // user 消息内容被截断到 2000 字符
    const userMsg = payload.messages.find((m) => m.role === 'user');
    expect(userMsg?.content.length).toBeLessThanOrEqual(2000);
  });

  // NFR-09 路径 A：vision tool result 路径（文档选中图，tool role 含 base64_raw）
  it('NFR-09 serialize-test：tool role 含 vision base64 → 序列化后 base64 不出现', () => {
    // 模拟文档选中图路径：tool role 含 vision_result + base64_raw 字段
    const fakeBase64 = 'data:image/png;base64,' + 'A'.repeat(500);
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '分析这张图', ts: 1 },
        {
          id: 'tool1',
          role: 'tool',
          content: '正在看这张图…',
          toolResult: {
            ok: true,
            data: { vision_result: '图中是一张饼图，显示 Q1 销售占 35%', base64_raw: fakeBase64 },
          },
          ts: 2,
        },
        { id: 'a1', role: 'assistant', content: '根据图片，Q1 销售占 35%', ts: 3 },
      ],
    } as never);

    useChatStore.getState().saveHistory('aster:chat:vis-test');
    const call = mockedStorage.set.mock.calls[0];
    const payload = call[1] as { messages: Array<{ role: string; content: string }> };

    // tool role 必须完全不在序列化结果中
    expect(payload.messages.every((m) => m.role !== 'tool')).toBe(true);

    // 所有 content 不含 base64 相关字符串
    const allContent = payload.messages.map((m) => m.content).join('');
    expect(allContent).not.toContain('base64');
    expect(allContent).not.toContain('data:image');
    expect(allContent).not.toContain('A'.repeat(100)); // 模拟 base64 payload 不出现
  });

  // NFR-09 路径 B：上传图路径（FILE-06），user message.content 不含 base64
  it('NFR-09 serialize-test：上传图路径 user message.content 不含 base64', () => {
    // 上传图路径：sendMessage 中 finalPrompt 含 vision evidence 文本（不含 base64），
    // user message.content = 原始 prompt（不含 evidence / base64）
    // vision evidence 只在 runAgent 内部使用，不写进 chatStore 消息
    useChatStore.setState({
      messages: [
        {
          id: 'u1',
          role: 'user',
          // 原始 prompt，不含 base64（sendMessage 中 pushMessage 传 content: prompt）
          content: '基于这张图写一份销售报告',
          ts: 1,
        },
        {
          id: 'a1',
          role: 'assistant',
          content: '好的，根据图片中的饼图数据，Q1 销售报告如下…',
          ts: 2,
        },
      ],
    } as never);

    useChatStore.getState().saveHistory('aster:chat:upload-test');
    const call = mockedStorage.set.mock.calls[0];
    const payload = call[1] as { messages: Array<{ role: string; content: string }> };

    const allContent = payload.messages.map((m) => m.content).join('');
    expect(allContent).not.toContain('base64');
    expect(allContent).not.toContain('data:image');

    // 用户消息内容为原始 prompt（不含 evidence 注入文本）
    const userMsg = payload.messages.find((m) => m.role === 'user');
    expect(userMsg?.content).toBe('基于这张图写一份销售报告');
  });
});
