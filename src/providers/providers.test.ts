/**
 * src/providers/providers.test.ts
 *
 * 用 vi.fn() mock global fetch，验证三个 Provider 客户端的请求体结构
 * 和响应解析行为，无需真实网络请求。
 *
 * 测试策略：
 * - AihubmixVisionClient / AihubmixImageClient：stub global fetch，验证请求体结构
 * - OpenAICompatibleLLM：spy on singleFlight，验证调用路径
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AihubmixVisionClient } from './aihubmix-vision';
import { AihubmixImageClient } from './aihubmix-image';
import { OpenAICompatibleLLM } from './openai-compat';
import * as queueModule from './queue';

const CONFIG = {
  vision: { baseURL: 'https://api.aihubmix.com/v1', apiKey: 'test-key' },
  image: { baseURL: 'https://api.aihubmix.com/v1', apiKey: 'test-key' },
};

describe('AihubmixVisionClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('发出 POST /chat/completions，model=gpt-4o，携带 image_url content block', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'hello vision' } }] }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new AihubmixVisionClient();
    const result = await client.analyze('describe this', 'abc123', 'image/jpeg', CONFIG.vision);

    expect(result.content).toBe('hello vision');
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/chat/completions');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-4o');
    expect(body.stream).toBe(false);

    // 请求体必须携带 image_url content block
    const content = body.messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    const imgBlock = content.find((c: { type: string }) => c.type === 'image_url');
    expect(imgBlock).toBeDefined();
    expect(imgBlock.image_url.url).toContain('data:image/jpeg;base64,abc123');

    // apiKey 不进 request body
    expect(JSON.stringify(body)).not.toContain('test-key');
    // Authorization header 含 Bearer
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('请求失败时抛出 NetworkError（fetch reject）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));

    const { NetworkError } = await import('../errors');
    const client = new AihubmixVisionClient();
    await expect(client.analyze('q', 'b64', 'image/png', CONFIG.vision)).rejects.toThrow(NetworkError);
  });

  it('HTTP 401 时抛出 error.code=KEY_INVALID（mapHttpError 映射）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }));

    const client = new AihubmixVisionClient();
    let caughtError: unknown;
    try {
      await client.analyze('q', 'b64', 'image/png', CONFIG.vision);
    } catch (e) {
      caughtError = e;
    }
    // 验证 code 字段（AsterError 子类的特征）
    expect(caughtError).toBeDefined();
    expect((caughtError as { code?: string }).code).toBe('KEY_INVALID');
  });
});

describe('AihubmixImageClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('发出 POST /images/generations，model=gpt-image-1，解析 input_tokens/output_tokens', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'imgdata' }],
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const client = new AihubmixImageClient();
    const result = await client.generate('a cat', '1024x1024', 'medium', CONFIG.image);

    expect(result.b64_json).toBe('imgdata');
    expect(result.usage?.input_tokens).toBe(10);
    expect(result.usage?.output_tokens).toBe(20);
    expect(result.usage?.total_tokens).toBe(30);

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/images/generations');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('gpt-image-1');

    // apiKey 不进 request body
    expect(JSON.stringify(body)).not.toContain('test-key');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
  });

  it('usage 字段缺失时 usage 返回 null', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ b64_json: 'imgdata' }],
        // 无 usage 字段
      }),
    }));

    const client = new AihubmixImageClient();
    const result = await client.generate('a cat', '1024x1024', 'medium', CONFIG.image);
    expect(result.b64_json).toBe('imgdata');
    expect(result.usage).toBeNull();
  });

  it('请求失败时抛出 NetworkError（fetch reject）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network fail')));

    const { NetworkError } = await import('../errors');
    const client = new AihubmixImageClient();
    await expect(client.generate('p', '1024x1024', 'medium', CONFIG.image)).rejects.toThrow(NetworkError);
  });
});

describe('OpenAICompatibleLLM', () => {
  beforeEach(() => {
    // stub fetch，让 streamSSE 的 fetch 不真正发出网络请求
    // 返回一个有效的流式响应（空内容）
    const mockReadable = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      body: mockReadable,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('streamChat 调用路径经过 singleFlight（以 providerId 调用）', async () => {
    const singleFlightSpy = vi.spyOn(queueModule, 'singleFlight');

    const llm = new OpenAICompatibleLLM();
    const config = {
      providerId: 'test-provider',
      baseURL: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    };
    const controller = new AbortController();

    // 消费完 generator
    for await (const _ of llm.streamChat([], config, controller.signal)) { /* empty */ }

    expect(singleFlightSpy).toHaveBeenCalledWith('test-provider', expect.any(Function));
  });

  it('AbortError 被静默处理（不 rethrow）', async () => {
    // 让 fetch 抛出 AbortError（模拟被 abort）
    const abortErr = new Error('The operation was aborted.');
    abortErr.name = 'AbortError';
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortErr));

    const llm = new OpenAICompatibleLLM();
    const config = {
      providerId: 'abort-provider',
      baseURL: 'https://api.deepseek.com',
      apiKey: 'sk-test',
      model: 'deepseek-v4-flash',
    };
    const controller = new AbortController();
    controller.abort();

    // 不应抛出，静默处理
    const items: unknown[] = [];
    for await (const item of llm.streamChat([], config, controller.signal)) {
      items.push(item);
    }
    expect(items).toHaveLength(0);
  });
});
