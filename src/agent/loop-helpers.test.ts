/**
 * src/agent/loop-helpers.test.ts — streamAssistantTurn reasoning_content 往返守门
 *
 * 结构性守门（堵 reasoning-content-roundtrip 复发盲区的 loop 半边）：
 * 单测此前 mock SSE，从未跑真实 thinking-mode 往返。本测试断言 streamAssistantTurn
 * 把流式 reasoning_delta 累积后，附到下一轮 wire assistant 消息的 reasoning_content 字段
 * （DeepSeek thinking 模式第二轮请求必需，缺则 400）；不返回 reasoning 的 Provider 不带此字段。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { streamAssistantTurn, type WireMessage } from './loop-helpers';
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
