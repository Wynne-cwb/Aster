/**
 * src/lib/sse.test.ts — SSE 解析器单元测试（PROV-06 / PROV-08 / NFR-03）
 *
 * 测试策略：
 * - mock fetch 返回 ReadableStream（构造 SSE 格式文本）
 * - 验证 streamSSE 正确 yield SSEDelta / SSEUsage 事件
 * - 验证 mapHttpError 将 HTTP 状态映射到正确错误类
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamSSE, mapHttpError, type SSEDelta, type SSEUsage, type ToolCallEnd, type ReasoningDelta } from './sse';
import {
  KeyInvalidError,
  QuotaExceededError,
  RateLimitError,
  ModelNotFoundError,
  ContextTooLongError,
  ContentFilterError,
  NetworkError,
  AsterError,
} from '../errors';

// ---------------------------------------------------------------------------
// 辅助函数：构建 mock ReadableStream
// ---------------------------------------------------------------------------

function makeStream(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

function makeMockResponse(body: ReadableStream<Uint8Array>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    body,
    json: async () => ({}),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// streamSSE 测试
// ---------------------------------------------------------------------------

describe('streamSSE', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('应 yield 两个 SSEDelta 和一个 SSEUsage（正常流）', async () => {
    const sseText = [
      'data: {"id":"1","choices":[{"delta":{"content":"Hello"},"finish_reason":null}],"usage":null}',
      '',
      'data: {"id":"2","choices":[{"delta":{"content":" world"},"finish_reason":null}],"usage":null}',
      '',
      'data: {"id":"3","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events = [];
    for await (const event of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'test-key', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      events.push(event);
    }

    expect(events).toHaveLength(3);
    expect(events[0]).toEqual({ type: 'delta', content: 'Hello' });
    expect(events[1]).toEqual({ type: 'delta', content: ' world' });
    expect(events[2]).toEqual({ type: 'usage', promptTokens: 10, completionTokens: 2, totalTokens: 12 });
  });

  it('应跳过 ": keep-alive" 行，不 yield 任何事件', async () => {
    const sseText = [
      ': keep-alive',
      '',
      ': keep-alive',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events = [];
    for await (const event of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'test-key', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      events.push(event);
    }

    expect(events).toHaveLength(0);
  });

  it('应忽略空 data 行', async () => {
    const sseText = [
      'data: ',
      '',
      'data: {"id":"1","choices":[{"delta":{"content":"Hi"},"finish_reason":null}],"usage":null}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events = [];
    for await (const event of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'test-key', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      events.push(event);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ type: 'delta', content: 'Hi' });
  });

  it('AbortSignal 已中止时应 throw（AbortError）', async () => {
    const controller = new AbortController();
    controller.abort();

    // AbortController 已 abort 时，fetch 本身会 throw AbortError
    vi.mocked(fetch).mockRejectedValue(new DOMException('The operation was aborted.', 'AbortError'));

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'test-key', model: 'deepseek-v4-flash', messages: [] }, controller.signal)) {
        // nothing
      }
    }).rejects.toThrow(DOMException);
  });

  it('非 2xx 响应应抛出对应 AsterError', async () => {
    const errorStream = makeStream('');
    const errorResp = {
      ok: false,
      status: 401,
      body: errorStream,
      json: async () => ({ error: { message: 'Invalid API Key' } }),
    } as unknown as Response;

    vi.mocked(fetch).mockResolvedValue(errorResp);

    await expect(async () => {
      for await (const _ of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'bad-key', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
        // nothing
      }
    }).rejects.toBeInstanceOf(KeyInvalidError);
  });

  it('请求体不应包含 apiKey 字段（T-02-04）', async () => {
    const sseText = 'data: [DONE]\n\n';
    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    for await (const _ of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'secret-key-12345', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      // nothing
    }

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestBody = JSON.parse(callArgs[1]?.body as string);
    expect(requestBody).not.toHaveProperty('apiKey');
    expect(JSON.stringify(requestBody)).not.toContain('secret-key-12345');
  });

  it('应自动注入 stream: true 和 stream_options.include_usage: true', async () => {
    const sseText = 'data: [DONE]\n\n';
    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    for await (const _ of streamSSE('https://api.test.com/v1/chat/completions', { apiKey: 'test-key', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      // nothing
    }

    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestBody = JSON.parse(callArgs[1]?.body as string);
    expect(requestBody.stream).toBe(true);
    expect(requestBody.stream_options).toEqual({ include_usage: true });
  });
});

// ---------------------------------------------------------------------------
// streamSSE — DeepSeek thinking 模式 reasoning_content 解析
// （结构性守门：堵住「mock SSE 漏掉真实 thinking-mode 往返」复发盲区的解析半边）
// ---------------------------------------------------------------------------

describe('streamSSE — reasoning_content 解析（DeepSeek thinking 模式）', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('delta.reasoning_content → yield reasoning_delta 事件（与 content delta 并存）', async () => {
    const sseText = [
      'data: {"choices":[{"delta":{"reasoning_content":"先想想"},"finish_reason":null}]}',
      '',
      'data: {"choices":[{"delta":{"reasoning_content":"再想想"},"finish_reason":null}]}',
      '',
      'data: {"choices":[{"delta":{"content":"答复"},"finish_reason":null}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events: Array<SSEDelta | ReasoningDelta> = [];
    for await (const ev of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'deepseek-v4-flash', messages: [] }, new AbortController().signal)) {
      events.push(ev as SSEDelta | ReasoningDelta);
    }

    const reasoningEvents = events.filter((e): e is ReasoningDelta => e.type === 'reasoning_delta');
    expect(reasoningEvents).toHaveLength(2);
    expect(reasoningEvents.map((e) => e.content).join('')).toBe('先想想再想想');
    // content delta 仍照常 yield
    expect(events.some((e) => e.type === 'delta' && e.content === '答复')).toBe(true);
  });

  it('Provider 不返回 reasoning_content（仅 content）→ 无 reasoning_delta 事件（零影响回归）', async () => {
    const sseText = [
      'data: {"choices":[{"delta":{"content":"hi"},"finish_reason":null}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');

    vi.mocked(fetch).mockResolvedValue(makeMockResponse(makeStream(sseText)));

    const events = [];
    for await (const ev of streamSSE('https://api.aihubmix.com/v1/chat/completions', { apiKey: 'x', model: 'gpt-5.1', messages: [] }, new AbortController().signal)) {
      events.push(ev);
    }

    expect(events.some((e) => e.type === 'reasoning_delta')).toBe(false);
    expect(events.some((e) => e.type === 'delta')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapHttpError 测试
// ---------------------------------------------------------------------------

describe('mapHttpError', () => {
  it('401 → KeyInvalidError', () => {
    const err = mapHttpError(401, {});
    expect(err).toBeInstanceOf(KeyInvalidError);
    expect(err).toBeInstanceOf(AsterError);
  });

  it('403 → KeyInvalidError（权限不足/Key 吊销）', () => {
    const err = mapHttpError(403, {});
    expect(err).toBeInstanceOf(KeyInvalidError);
    expect(err.code).toBe('KEY_INVALID');
    expect(err.message).toContain('权限不足');
  });

  it('402 → QuotaExceededError', () => {
    const err = mapHttpError(402, {});
    expect(err).toBeInstanceOf(QuotaExceededError);
  });

  it('429 → RateLimitError', () => {
    const err = mapHttpError(429, {});
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('429 带 Retry-After header → RateLimitError.retryAfterSeconds === 30', () => {
    const err = mapHttpError(429, {}, 30);
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfterSeconds).toBe(30);
  });

  it('404 → ModelNotFoundError', () => {
    const err = mapHttpError(404, {});
    expect(err).toBeInstanceOf(ModelNotFoundError);
  });

  it('422 （非 content_policy）→ ContextTooLongError', () => {
    const err = mapHttpError(422, { error: { message: 'context length exceeded' } });
    expect(err).toBeInstanceOf(ContextTooLongError);
  });

  it('400 含 content_policy → ContentFilterError', () => {
    const err = mapHttpError(400, { error: { message: 'content_policy violation detected' } });
    expect(err).toBeInstanceOf(ContentFilterError);
  });

  it('422 含 filter → ContentFilterError', () => {
    const err = mapHttpError(422, { error: { message: 'content filter triggered' } });
    expect(err).toBeInstanceOf(ContentFilterError);
  });

  it('503 → NetworkError', () => {
    const err = mapHttpError(503, {});
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('999（未知状态）→ NetworkError（兜底）', () => {
    const err = mapHttpError(999, {});
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('所有 mapHttpError 返回值的 message 不含 API Key 字符串（T-01-04）', () => {
    const statuses = [401, 402, 404, 422, 429, 503, 999];
    for (const status of statuses) {
      const err = mapHttpError(status, {});
      // message 不应包含常见 Key 格式
      expect(err.message).not.toMatch(/sk-[a-zA-Z0-9]+/);
      expect(err.message).not.toContain('apiKey');
      expect(err.message.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// streamSSE — tool_calls 解析（G-05）
// ---------------------------------------------------------------------------

describe('streamSSE — tool_calls 解析（G-05）', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Test 1: 正常 tool_calls SSE → yield ToolCallEnd', async () => {
    const sseLines = [
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_x","type":"function","function":{"name":"insert_to_document","arguments":""}}]}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"text\\":\\"hi\\","}}]}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"position\\":\\"cursor\\"}"}}]}}]}`,
      `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
      `data: [DONE]`,
      '',
    ].join('\n');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockResponse(makeStream(sseLines), 200));
    const events: ReturnType<typeof Object.create>[] = [];
    for await (const ev of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'm', messages: [] }, new AbortController().signal)) {
      events.push(ev);
    }
    const endEvent = events.find((e) => e.type === 'tool_call_end') as ToolCallEnd;
    expect(endEvent).toBeDefined();
    expect(endEvent.name).toBe('insert_to_document');
    expect(JSON.parse(endEvent.arguments)).toEqual({ text: 'hi', position: 'cursor' });
  });

  it('Test 2: normal content delta — 不 yield ToolCallEnd', async () => {
    const sseLines = [
      `data: {"choices":[{"delta":{"content":"hello"},"finish_reason":null}]}`,
      `data: [DONE]`,
      '',
    ].join('\n');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockResponse(makeStream(sseLines), 200));
    const events: ReturnType<typeof Object.create>[] = [];
    for await (const ev of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'm', messages: [] }, new AbortController().signal)) {
      events.push(ev);
    }
    expect(events.some((e) => e.type === 'tool_call_end')).toBe(false);
    expect(events.some((e) => e.type === 'delta')).toBe(true);
  });

  it('Test 3: errBody sanitize — sk- 值被 [REDACTED]，apiKey/authorization 字段名被 [REDACTED]', async () => {
    const errResp = {
      ok: false,
      status: 401,
      json: async () => ({
        apiKey: 'sk-test-key',
        detail: 'invalid',
        authorization: 'Bearer sk-x',
        nested: { api_key: 'sk-y', detail: 'ok' },
      }),
      headers: { get: () => null },
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(errResp);
    let caughtErr: unknown = null;
    try {
      for await (const _ of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'sk-test-key', model: 'm', messages: [] }, new AbortController().signal)) {
        void _;
      }
    } catch (e) {
      caughtErr = e;
    }
    expect(caughtErr).not.toBeNull();
    const errBody = (caughtErr as Record<string, unknown>).errBody as Record<string, unknown>;
    expect(errBody).toBeDefined();
    expect(errBody['apiKey']).toBe('[REDACTED]');
    expect(errBody['authorization']).toBe('[REDACTED]');
    expect(errBody['detail']).toBe('invalid');
    const nested = errBody['nested'] as Record<string, unknown>;
    expect(nested['api_key']).toBe('[REDACTED]');
    expect(nested['detail']).toBe('ok');
    // T-01-04：sk-test-key 不应出现在错误 message 中
    expect((caughtErr as Error).message).not.toContain('sk-test-key');
  });

  it('Test 4: supportsToolCall === false → 请求体不含 tools 字段', async () => {
    // mock useProviderStore 返回 supportsToolCall=false
    vi.doMock('../store/providers', () => ({
      useProviderStore: {
        getState: () => ({
          providers: [{ id: 'test-provider', supportsToolCall: false }],
          defaultLLMProviderId: 'test-provider',
        }),
      },
    }));
    const sseLines = ['data: [DONE]', ''].join('\n');
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(makeMockResponse(makeStream(sseLines), 200));
    // 直接验证：streamSSE 的请求体不自己附带 tools（openai-compat 负责决定是否加 tools）
    // 本 test 验证：传入 body 不含 tools 字段时，streamSSE 直接发出不含 tools 的请求体
    for await (const _ of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'm', messages: [] }, new AbortController().signal)) {
      void _;
    }
    const callArgs = vi.mocked(fetch).mock.calls[0];
    const requestBody = JSON.parse(callArgs[1]?.body as string);
    expect(requestBody).not.toHaveProperty('tools');
    vi.doUnmock('../store/providers');
  });

  it('Test 7（I-10 并发回归）: 两个并发 streamSSE 实例的 accum Map 不跨 generator 共享', async () => {
    // 第一条流：tool_call_id='call_A'，arguments='{"text":"AA"}'
    const sseA = [
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_A","type":"function","function":{"name":"insert_to_document","arguments":""}}]}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"text\\":\\"AA\\"}"}}]}}]}`,
      `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
      `data: [DONE]`,
      '',
    ].join('\n');
    // 第二条流：tool_call_id='call_B'，arguments='{"text":"BB"}'
    const sseB = [
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_B","type":"function","function":{"name":"insert_to_document","arguments":""}}]}}]}`,
      `data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"text\\":\\"BB\\"}"}}]}}]}`,
      `data: {"choices":[{"delta":{},"finish_reason":"tool_calls"}]}`,
      `data: [DONE]`,
      '',
    ].join('\n');
    // 两个独立 mock（sequential calls）
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(makeMockResponse(makeStream(sseA), 200))
      .mockResolvedValueOnce(makeMockResponse(makeStream(sseB), 200));

    const eventsA: ReturnType<typeof Object.create>[] = [];
    const eventsB: ReturnType<typeof Object.create>[] = [];

    // 并发跑两个 generator（Promise.all）
    await Promise.all([
      (async () => {
        for await (const ev of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'm', messages: [] }, new AbortController().signal)) {
          eventsA.push(ev);
        }
      })(),
      (async () => {
        for await (const ev of streamSSE('https://api.deepseek.com/chat/completions', { apiKey: 'x', model: 'm', messages: [] }, new AbortController().signal)) {
          eventsB.push(ev);
        }
      })(),
    ]);

    const endA = eventsA.find((e) => e.type === 'tool_call_end') as ToolCallEnd;
    const endB = eventsB.find((e) => e.type === 'tool_call_end') as ToolCallEnd;

    // tool_call_id A 的 arguments 不应包含 'BB'，B 的不应包含 'AA'——证明 accum Map 不跨 generator 共享
    expect(endA).toBeDefined();
    expect(endB).toBeDefined();
    expect(endA.arguments).not.toContain('BB');
    expect(endB.arguments).not.toContain('AA');
    expect(endA.id).toBe('call_A');
    expect(endB.id).toBe('call_B');
  });
});

// ---------------------------------------------------------------------------
// streamSSE — fetch throw 路径分类（G-07）
// ---------------------------------------------------------------------------

describe('streamSSE — fetch throw 路径分类（G-07）', () => {
  const ORIGINAL_ONLINE = Object.getOwnPropertyDescriptor(navigator, 'onLine');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (ORIGINAL_ONLINE) Object.defineProperty(navigator, 'onLine', ORIGINAL_ONLINE);
  });

  function setOnline(value: boolean) {
    Object.defineProperty(navigator, 'onLine', { value, configurable: true });
  }

  async function consumeAndCatch(url: string, body: object) {
    try {
      for await (const _ of streamSSE(url, body, new AbortController().signal)) {
        void _;
      }
      return null;
    } catch (e) {
      return e;
    }
  }

  it('Test 1: fetch throw TypeError + online=true + https baseURL → KeyInvalidError', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(KeyInvalidError);
    expect((err as KeyInvalidError).code).toBe('KEY_INVALID');
  });

  it('Test 2: fetch throw TypeError + offline → NetworkError（真网络断兜底）', async () => {
    setOnline(false);
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(NetworkError);
    expect((err as NetworkError).code).toBe('NETWORK');
  });

  it('Test 3: fetch throw 非 TypeError → NetworkError', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('something else'));
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('Test 4: fetch throw TypeError + baseURL 非 https → NetworkError', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError('Failed to fetch'));
    const err = await consumeAndCatch('http://insecure.example.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('Test 5b（回归 CR-03）: fetch 返回 Response(403) → KeyInvalidError', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'Forbidden' } }),
      headers: { get: () => null },
    });
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(KeyInvalidError);
    expect((err as KeyInvalidError).code).toBe('KEY_INVALID');
  });

  it('Test 5（回归）: fetch 返回 Response(401) → KeyInvalidError（不破坏 mapHttpError 路径）', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'invalid key' } }),
      headers: { get: () => null },
    });
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(KeyInvalidError);
  });

  it('Test 6（回归）: fetch 返回 Response(429) → RateLimitError', async () => {
    setOnline(true);
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
      headers: { get: (h: string) => (h === 'Retry-After' ? '5' : null) },
    });
    const err = await consumeAndCatch('https://api.deepseek.com/chat/completions', {
      apiKey: 'sk-x',
      model: 'm',
      messages: [],
    });
    expect(err).toBeInstanceOf(RateLimitError);
  });
});
