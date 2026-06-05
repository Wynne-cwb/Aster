/**
 * src/agent/loop-helpers.test.ts — streamAssistantTurn reasoning_content 往返守门
 *
 * 结构性守门（堵 reasoning-content-roundtrip 复发盲区的 loop 半边）：
 * 单测此前 mock SSE，从未跑真实 thinking-mode 往返。本测试断言 streamAssistantTurn
 * 把流式 reasoning_delta 累积后，附到下一轮 wire assistant 消息的 reasoning_content 字段
 * （DeepSeek thinking 模式第二轮请求必需，缺则 400）；不返回 reasoning 的 Provider 不带此字段。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { streamAssistantTurn, applyHistoryBackstop, runOneToolCall, type WireMessage } from './loop-helpers';
import { RECENT_TURNS_FLOOR, estimateTokens } from './compaction';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { useChatStore } from '../store/chat';
import * as breaker from './circuit-breaker';
import { __resetOperationLogForTest } from './operationLog';

/** 构造一个 streamChat 行为被替换的假 LLM（绕开真实 fetch/SSE）。 */
function makeFakeLLM(events: unknown[]): OpenAICompatibleLLM {
  return {
    // eslint-disable-next-line require-yield
    async *streamChat() {
      for (const e of events) yield e as never;
    },
  } as unknown as OpenAICompatibleLLM;
}

beforeEach(() => {
  useChatStore.setState({ messages: [], isStreaming: false, abortController: null } as never);
});

describe('streamAssistantTurn — reasoning_content 往返', () => {
  it('收到 reasoning_delta + tool_call_end → 下一轮 wire assistant 消息带 reasoning_content + tool_calls', async () => {
    const llm = makeFakeLLM([
      { type: 'reasoning_delta', content: '先' },
      { type: 'reasoning_delta', content: '思考' },
      { type: 'delta', content: '好的' },
      { type: 'tool_call_end', id: 'call_1', name: 'list_slides', arguments: '{}' },
    ]);
    const messages: WireMessage[] = [{ role: 'user', content: '帮我看 PPT' }];

    const calls = await streamAssistantTurn(
      llm,
      messages,
      {},
      new AbortController().signal,
      undefined,
      'run-1',
      1,
    );

    // 推进了一条 tool call
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('list_slides');

    // 下一轮 wire 消息的 assistant 必须带累积后的 reasoning_content（否则 DeepSeek 第二轮 400）
    const assistant = messages.find((m) => m.role === 'assistant') as Extract<WireMessage, { role: 'assistant' }>;
    expect(assistant).toBeDefined();
    expect(assistant.reasoning_content).toBe('先思考');
    expect(assistant.content).toBe('好的');
    expect(assistant.tool_calls?.[0]?.function.name).toBe('list_slides');
  });

  it('Provider 不返回 reasoning_content（仅 content）→ wire assistant 不带 reasoning_content（非空守卫）', async () => {
    const llm = makeFakeLLM([
      { type: 'delta', content: '直接答复' },
    ]);
    const messages: WireMessage[] = [{ role: 'user', content: 'hi' }];

    await streamAssistantTurn(
      llm,
      messages,
      {},
      new AbortController().signal,
      undefined,
      'run-2',
      1,
    );

    const assistant = messages.find((m) => m.role === 'assistant') as Extract<WireMessage, { role: 'assistant' }>;
    expect(assistant).toBeDefined();
    expect(assistant.content).toBe('直接答复');
    // 非空守卫：未收到 reasoning_delta → 字段保持 undefined（不影响 AiHubMix gpt-5.1/gemini）
    expect(assistant.reasoning_content).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(assistant, 'reasoning_content')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UAT-11 — streamAssistantTurn 把本轮 tool_calls 落到 chat STORE 的 assistant 消息上
// ---------------------------------------------------------------------------
// 结构性守门（堵 SlidePreviewPanel 永不挂载的根因）：ChatStream 从 store 的
// m.toolCalls 里按 c.id===message.toolCallId && c.name==='apply_slide_layout' 反查触发卡的
// toolCall → 读 tc.arguments.layout 推 layoutArgs → 据此挂载 <SlidePreviewPanel>（挂载即
// registerPreviewElement，visual_check_slide 才有 DOM 可截图）。旧代码 finalize 只写
// { isStreaming:false }，store 消息 toolCalls 恒空 → layoutArgs 恒 null → 面板从不挂载
// → visual_check_slide 永远「预览面板未打开」跳过。下面断言会在旧代码下 FAIL。
describe('streamAssistantTurn — toolCalls 落 chat store（UAT-11 预览面板挂载根因）', () => {
  it('本轮有 apply_slide_layout tool_call_end → 已 finalize 的 store assistant 消息带 toolCalls（arguments 为对象，.layout 可读）', async () => {
    const llm = makeFakeLLM([
      { type: 'delta', content: '这就帮你排版' },
      {
        type: 'tool_call_end',
        id: 'call_layout_1',
        name: 'apply_slide_layout',
        arguments: JSON.stringify({ layout: 'kpi', content: { title: '季度业绩' }, accent_color: '#009887' }),
      },
    ]);
    const messages: WireMessage[] = [{ role: 'user', content: '做一页 KPI 幻灯片' }];

    await streamAssistantTurn(
      llm,
      messages,
      {},
      new AbortController().signal,
      undefined,
      'run-layout',
      1,
    );

    // 已 finalize（isStreaming 落 false）的 store assistant 消息
    const stored = useChatStore.getState().messages.find((m) => m.role === 'assistant');
    expect(stored).toBeDefined();
    expect(stored?.isStreaming).toBe(false);

    // 关键守门：toolCalls 已落 store，含匹配的 {id, name, arguments}
    expect(stored?.toolCalls).toBeDefined();
    expect(stored?.toolCalls).toHaveLength(1);
    const tc = stored!.toolCalls![0];
    expect(tc.id).toBe('call_layout_1');
    expect(tc.name).toBe('apply_slide_layout');
    // arguments 必须是已解析的对象（非 JSON 字符串），且 .layout 可直接读
    expect(typeof tc.arguments).toBe('object');
    expect((tc.arguments as { layout?: string }).layout).toBe('kpi');
    // ChatStream 反查靠 toolCallId === toolCall.id，二者必须能对上
    expect(tc.id).toBe(messages.find((m) => m.role === 'assistant')
      ? (messages.find((m) => m.role === 'assistant') as Extract<WireMessage, { role: 'assistant' }>).tool_calls?.[0]?.id
      : undefined);
  });

  it('本轮无 tool call → store assistant 消息不设 toolCalls（与旧行为一致，避免空数组噪音）', async () => {
    const llm = makeFakeLLM([{ type: 'delta', content: '纯文字答复' }]);
    const messages: WireMessage[] = [{ role: 'user', content: '你好' }];

    await streamAssistantTurn(
      llm,
      messages,
      {},
      new AbortController().signal,
      undefined,
      'run-notool',
      1,
    );

    const stored = useChatStore.getState().messages.find((m) => m.role === 'assistant');
    expect(stored).toBeDefined();
    expect(stored?.isStreaming).toBe(false);
    // 无 tool call 轮：不写 toolCalls（未定义）——不引入空数组
    expect(stored?.toolCalls).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Phase 21 CTX-05 — applyHistoryBackstop（token 上界、整轮丢、地板保护；取代 truncateTo20Turns）
// ---------------------------------------------------------------------------

describe('applyHistoryBackstop — CTX-05 token 上界兜底', () => {
  // token 精确：content 'x'.repeat(tokens*1.6) → estimateTokens = tokens（tokens 取 5 的倍数）
  function makeMsg(id: string, role: 'user' | 'assistant' | 'tool', tokens: number) {
    return { id, role, content: 'x'.repeat(tokens * 1.6), ts: 1 } as const;
  }
  const sumTokens = (msgs: Array<{ content: string }>) =>
    msgs.reduce((s, m) => s + estimateTokens(m.content), 0);

  it('估算 <= maxTokens → 原样返回（正常路径 no-op）', () => {
    const msgs = Array.from({ length: 5 }, (_, i) => [
      makeMsg(`u${i}`, 'user', 10),
      makeMsg(`a${i}`, 'assistant', 10),
    ]).flat();
    const result = applyHistoryBackstop(msgs, 100_000);
    expect(result).toHaveLength(10);
    expect(result).toBe(msgs); // 引用不变（no-op）
  });

  it('超 maxTokens → 从最老整轮丢到 <= maxTokens（最老 user 删、最近 user 留）', () => {
    // 8 对 × 10 token/条 = 160 token；maxTokens=100 → 丢到 <=100
    const msgs = Array.from({ length: 8 }, (_, i) => [
      makeMsg(`u${i}`, 'user', 10),
      makeMsg(`a${i}`, 'assistant', 10),
    ]).flat();
    const result = applyHistoryBackstop(msgs, 100);
    expect(sumTokens(result)).toBeLessThanOrEqual(100);
    expect(result.find((m) => m.id === 'u0')).toBeUndefined(); // 最老整轮被丢
    expect(result.find((m) => m.id === 'u7')).toBeDefined();   // 最近 user 保留
  });

  it('丢轮时其后 assistant/tool 随整轮删（无孤立 tool）', () => {
    // 6 轮 × (user+assistant+tool) 各 10 token；maxTokens=80
    const msgs = Array.from({ length: 6 }, (_, i) => [
      makeMsg(`u${i}`, 'user', 10),
      makeMsg(`a${i}`, 'assistant', 10),
      makeMsg(`t${i}`, 'tool', 10),
    ]).flat();
    const result = applyHistoryBackstop(msgs, 80);
    // 被丢的最老轮，其 tool 也不在结果（整组删，防孤立 tool 致 400）
    expect(result.find((m) => m.id === 'u0')).toBeUndefined();
    expect(result.find((m) => m.id === 't0')).toBeUndefined();
    expect(result.find((m) => m.id === 'a0')).toBeUndefined();
  });

  it('永不少于 RECENT_TURNS_FLOOR 个 user 轮（极小 maxTokens 也保地板）', () => {
    const msgs = Array.from({ length: 8 }, (_, i) => [
      makeMsg(`u${i}`, 'user', 10),
      makeMsg(`a${i}`, 'assistant', 10),
    ]).flat();
    const result = applyHistoryBackstop(msgs, 1); // 极小 → 落到地板
    expect(result.filter((m) => m.role === 'user')).toHaveLength(RECENT_TURNS_FLOOR);
  });
});

// =========================================================
// W1：部分失败 batch 通知熔断器（黑盒断言真实 circuit-breaker 状态）
// 部分成功 batch 返回 ok:true（保留 undo + 让 LLM 从失败步继续），但置 partialFailure:true。
// loop-helpers 须据此走 breaker.recordFailure（而非 recordSuccess），否则反复部分失败
// 的 batch_write 永不开路。连续 3 次（THRESHOLD）→ isOpen 应为 true，证明走了 recordFailure。
// =========================================================
describe('runOneToolCall — W1 部分失败 batch 通知熔断器', () => {
  const adapter = {} as never;

  /** 构造只含一个 batch_write 假工具的 tools 数组；execute 返回 {ok:true, ...extra} */
  function fakeTools(extra: Record<string, unknown>) {
    return [
      {
        name: 'batch_write',
        kind: 'write' as const,
        description: '',
        parameters: {},
        humanLabel: () => '批量改动',
        execute: async () => ({
          ok: true,
          reverse: { tool: 'batch_reverse', args: { ops: [] } },
          ...extra,
        }),
      },
    ] as unknown as Parameters<typeof runOneToolCall>[1];
  }

  beforeEach(() => {
    breaker.__reset();
    __resetOperationLogForTest();
    useChatStore.setState({ messages: [], isStreaming: false, abortController: null } as never);
  });

  it('部分失败（ok:true + partialFailure:true）连续 3 次 → 熔断器开路（走 recordFailure）', async () => {
    const tools = fakeTools({ partialFailure: true });
    const tc = { id: 'c1', name: 'batch_write', arguments: {} };
    for (let i = 0; i < 3; i++) {
      await runOneToolCall(tc, tools, adapter, [], new AbortController().signal, 'run-pf', i);
    }
    // 3 次 PARTIAL_BATCH_FAILURE → isOpen true（recordSuccess 永不会让它开路）
    expect(breaker.isOpen('batch_write')).toBe(true);
  });

  it('部分成功无 partialFailure（ok:true）连续 3 次 → 熔断器不开路（走 recordSuccess）', async () => {
    const tools = fakeTools({});
    const tc = { id: 'c2', name: 'batch_write', arguments: {} };
    for (let i = 0; i < 3; i++) {
      await runOneToolCall(tc, tools, adapter, [], new AbortController().signal, 'run-ok', i);
    }
    expect(breaker.isOpen('batch_write')).toBe(false);
  });
});

// =========================================================
// UI-05：loop-helpers push tool 消息时 kind 字段写入
// =========================================================
describe('loop-helpers — UI-05: kind 字段写入 Message', () => {
  it('UI-05 kind: kind 字段描述——Wave 1（12-02）实现后验证 pushMessage 收到 kind', () => {
    // 此测试为占位符——Wave 1 在 loop-helpers.ts 加入 kind: def?.kind 后
    // 需要 spy pushMessage 验证 kind 传入。
    // 详细实现属 Claude's Discretion（CONTEXT.md），具体方式在 12-02-PLAN 实现时确定。
    expect(true).toBe(true); // 占位，Wave 1 后替换为 spy 断言
  });
});
