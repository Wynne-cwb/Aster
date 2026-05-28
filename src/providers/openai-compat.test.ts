import { describe, it, expect, vi, beforeEach } from 'vitest';

// 拦截 streamSSE：捕获 body 后立即返回空 generator（让我们检查 caller-supplied tools 是否进 body）
const capturedBodies: unknown[] = [];
vi.mock('../lib/sse', async () => {
  const actual = await vi.importActual<typeof import('../lib/sse')>('../lib/sse');
  return {
    ...actual,
    streamSSE: vi.fn(async function* mockStreamSSE(_url: string, body: unknown) {
      capturedBodies.push(body);
      // empty stream — 测试只关心 body 构造，不关心 yield
    }),
  };
});

// singleFlight 直接 passthrough；withRetry 直接 passthrough（不影响 body）
vi.mock('./queue', async () => {
  const actual = await vi.importActual<typeof import('./queue')>('./queue');
  return {
    ...actual,
    singleFlight: vi.fn(async (_id: string, fn: () => unknown) => await fn()),
  };
});
vi.mock('./retry', async () => {
  const actual = await vi.importActual<typeof import('./retry')>('./retry');
  return {
    ...actual,
    withRetry: vi.fn(async (fn: () => unknown) => await fn()),
  };
});

import { OpenAICompatibleLLM } from './openai-compat';
import { useProviderStore } from '../store/providers';

const baseConfig = {
  providerId: 'deepseek',
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-test',
  model: 'deepseek-v4-flash',
};

beforeEach(() => {
  capturedBodies.length = 0;
  // 重置 providerStore: 确保 deepseek provider 存在 + supportsToolCall 未关
  useProviderStore.setState({
    providers: [
      {
        id: 'deepseek',
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash',
        isBuiltIn: true,
      },
    ],
    defaultLLMProviderId: 'deepseek',
  } as never);
});

async function consumeStream(gen: AsyncGenerator<unknown>) {
  for await (const _ of gen) {
    /* drain */
  }
}

describe('OpenAICompatibleLLM.streamChat — Plan 03-03 tools 入参扩展', () => {
  it('caller 传 tools → body.tools 等于传入数组 + body.tool_choice = "auto"', async () => {
    const llm = new OpenAICompatibleLLM();
    const callerTools = [
      {
        type: 'function' as const,
        function: {
          name: 'append_paragraph',
          description: '追加一段文字',
          parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
        },
      },
    ];
    const ctrl = new AbortController();
    await consumeStream(
      llm.streamChat(
        [{ role: 'user', content: 'hi' }],
        baseConfig as never,
        ctrl.signal,
        callerTools,
      ),
    );
    expect(capturedBodies.length).toBe(1);
    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body.tools).toEqual(callerTools);
    expect(body.tool_choice).toBe('auto');
  });

  it('Plan 04: caller 不传 tools → body 不含 tools 字段（INSERT_TO_DOCUMENT_TOOL 已删）', async () => {
    const llm = new OpenAICompatibleLLM();
    const ctrl = new AbortController();
    await consumeStream(
      llm.streamChat([{ role: 'user', content: 'hi' }], baseConfig as never, ctrl.signal),
    );
    expect(capturedBodies.length).toBe(1);
    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('Plan 04: caller 传空数组 tools → body 不含 tools 字段', async () => {
    const llm = new OpenAICompatibleLLM();
    const ctrl = new AbortController();
    await consumeStream(
      llm.streamChat([{ role: 'user', content: 'hi' }], baseConfig as never, ctrl.signal, []),
    );
    expect(capturedBodies.length).toBe(1);
    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body.tools).toBeUndefined();
    expect(body.tool_choice).toBeUndefined();
  });

  it('Provider supportsToolCall === false → 不挂载任何 tools（caller 传也不挂）', async () => {
    useProviderStore.setState({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          isBuiltIn: true,
          supportsToolCall: false,
        },
      ],
      defaultLLMProviderId: 'deepseek',
    } as never);
    const llm = new OpenAICompatibleLLM();
    const ctrl = new AbortController();
    await consumeStream(
      llm.streamChat(
        [{ role: 'user', content: 'hi' }],
        baseConfig as never,
        ctrl.signal,
        [
          {
            type: 'function',
            function: { name: 'x', description: '', parameters: {} },
          },
        ],
      ),
    );
    expect(capturedBodies.length).toBe(1);
    const body = capturedBodies[0] as Record<string, unknown>;
    expect(body.tools).toBeUndefined();
  });
});
