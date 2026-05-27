/**
 * src/lib/sse.test.ts — SSE 解析器单元测试（PROV-06 / PROV-08 / NFR-03）
 *
 * 测试策略：
 * - mock fetch 返回 ReadableStream（构造 SSE 格式文本）
 * - 验证 streamSSE 正确 yield SSEDelta / SSEUsage 事件
 * - 验证 mapHttpError 将 HTTP 状态映射到正确错误类
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamSSE, mapHttpError, type SSEDelta, type SSEUsage } from './sse';
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
// mapHttpError 测试
// ---------------------------------------------------------------------------

describe('mapHttpError', () => {
  it('401 → KeyInvalidError', () => {
    const err = mapHttpError(401, {});
    expect(err).toBeInstanceOf(KeyInvalidError);
    expect(err).toBeInstanceOf(AsterError);
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
