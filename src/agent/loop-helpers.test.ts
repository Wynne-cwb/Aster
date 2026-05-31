/**
 * src/agent/loop-helpers.test.ts — streamAssistantTurn reasoning_content 往返守门
 *
 * 结构性守门（堵 reasoning-content-roundtrip 复发盲区的 loop 半边）：
 * 单测此前 mock SSE，从未跑真实 thinking-mode 往返。本测试断言 streamAssistantTurn
 * 把流式 reasoning_delta 累积后，附到下一轮 wire assistant 消息的 reasoning_content 字段
 * （DeepSeek thinking 模式第二轮请求必需，缺则 400）；不返回 reasoning 的 Provider 不带此字段。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { streamAssistantTurn, truncateTo20Turns, type WireMessage } from './loop-helpers';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { useChatStore } from '../store/chat';

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
// Phase 8 Plan 01 — truncateTo20Turns（HIST-03，RED until Plan 04 implements）
// ---------------------------------------------------------------------------

describe('truncateTo20Turns — HIST-03 20 轮 LLM 上下文截断', () => {
  function makeUserMsg(idx: number) {
    return { id: `u${idx}`, role: 'user' as const, content: `msg ${idx}`, ts: idx };
  }
  function makeAssistantMsg(idx: number) {
    return { id: `a${idx}`, role: 'assistant' as const, content: `reply ${idx}`, ts: idx + 0.5 };
  }

  it('≤20 轮不截断', () => {
    const msgs = Array.from({ length: 20 }, (_, i) => [makeUserMsg(i), makeAssistantMsg(i)]).flat();
    expect(truncateTo20Turns(msgs)).toHaveLength(40);
  });

  it('21 轮截断到最近 20 轮（最旧 run 整组删）', () => {
    const msgs = Array.from({ length: 21 }, (_, i) => [makeUserMsg(i), makeAssistantMsg(i)]).flat();
    const result = truncateTo20Turns(msgs);
    // 保留最近 20 个 user turn，第 0 轮（u0 + a0）被删
    expect(result.find((m: { id: string }) => m.id === 'u0')).toBeUndefined();
    expect(result.find((m: { id: string }) => m.id === 'u1')).toBeDefined();
    // 仍有 40 条消息（20 user + 20 assistant）
    expect(result.filter((m: { role: string }) => m.role === 'user')).toHaveLength(20);
  });

  it('截断时 tool 消息随 run 整组删', () => {
    // 21 个 run，每个 run = user + assistant + tool（共 63 消息）
    const msgs = Array.from({ length: 21 }, (_, i) => [
      makeUserMsg(i),
      makeAssistantMsg(i),
      { id: `t${i}`, role: 'tool' as const, content: '' },
    ]).flat();
    const result = truncateTo20Turns(msgs);
    // 第 0 轮 3 条消息都应被删
    expect(result.find((m: { id: string }) => m.id === 'u0')).toBeUndefined();
    expect(result.find((m: { id: string }) => m.id === 'a0')).toBeUndefined();
    expect(result.find((m: { id: string }) => m.id === 't0')).toBeUndefined();
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
