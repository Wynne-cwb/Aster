/**
 * src/providers/probeToolCall.test.ts — A-21 probeToolCallSupport 三态单测
 *
 * 三个 case：
 *   1. true  — mock streamSSE yield tool_call_delta first
 *   2. false — mock streamSSE yield delta first (text answer, no tool call)
 *   3. null  — mock streamSSE 永不 yield，等待 abort signal（10s 超时），decided=false → null
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock strategy: per-test streamSSE behavior via module-level variable
// ---------------------------------------------------------------------------

// eslint-disable-next-line prefer-const
let mockStreamSSEImpl: (url: string, body: unknown, signal: AbortSignal) => AsyncGenerator<unknown>;

vi.mock('../lib/sse', async () => {
  const actual = await vi.importActual<typeof import('../lib/sse')>('../lib/sse');
  return {
    ...actual,
    streamSSE: vi.fn(function (url: string, body: unknown, signal: AbortSignal) {
      return mockStreamSSEImpl(url, body, signal);
    }),
  };
});

// singleFlight passthrough（避免序列化影响测试）
vi.mock('./queue', async () => {
  const actual = await vi.importActual<typeof import('./queue')>('./queue');
  return {
    ...actual,
    singleFlight: vi.fn(async (_id: string, fn: () => unknown) => await fn()),
  };
});

// withRetry passthrough
vi.mock('./retry', async () => {
  const actual = await vi.importActual<typeof import('./retry')>('./retry');
  return {
    ...actual,
    withRetry: vi.fn(async (fn: () => unknown) => await fn()),
  };
});

// ---------------------------------------------------------------------------
// 模块导入（在 mock 之后）
// ---------------------------------------------------------------------------
import { probeToolCallSupport } from './probeToolCall';
import { useProviderStore } from '../store/providers';

const baseConfig = {
  providerId: 'test-provider',
  baseURL: 'https://api.example.com/v1',
  apiKey: 'sk-test-key',
  model: 'test-model-1',
};

afterEach(() => {
  vi.useRealTimers();
  // 重置 providerStore 避免状态泄漏
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

// ---------------------------------------------------------------------------
// 三态测试
// ---------------------------------------------------------------------------
describe('probeToolCallSupport — 三态（true / false / null）', () => {
  it('returns true — stream yields tool_call_delta first (Provider 支持 tool calling)', async () => {
    mockStreamSSEImpl = async function* () {
      yield { type: 'tool_call_delta', index: 0, argumentsChunk: '' };
      // 后续 chunks 不 yield（probe 已 abort + 返回）
    };

    const result = await probeToolCallSupport(baseConfig as never);
    expect(result).toBe(true);
  });

  it('returns false — stream yields delta first (Provider 直接文字回答，无 tool call)', async () => {
    mockStreamSSEImpl = async function* () {
      yield { type: 'delta', content: 'I cannot use tools. Here is my answer...' };
    };

    const result = await probeToolCallSupport(baseConfig as never);
    expect(result).toBe(false);
  });

  it('returns null — 10s 超时前无任何决策事件（生成器挂起，abort 后 decided=false → null）', async () => {
    vi.useFakeTimers();

    // Generator 挂起：等 signal abort 后 resolve（不 yield 任何事件）
    mockStreamSSEImpl = async function* (_url, _body, signal) {
      await new Promise<void>((resolve) => {
        if (signal.aborted) {
          resolve();
          return;
        }
        signal.addEventListener('abort', () => resolve(), { once: true });
      });
      // 不 yield 任何 SSEEvent → for await 退出，decided 仍 false
    };

    const promise = probeToolCallSupport(baseConfig as never);
    // 推进 10001ms → 触发 setTimeout 回调 → controller.abort() → signal abort event fires
    await vi.advanceTimersByTimeAsync(10_001);
    const result = await promise;

    expect(result).toBeNull();
  });

  it('returns true — stream yields tool_call_end (finish_reason=tool_calls)', async () => {
    mockStreamSSEImpl = async function* () {
      yield { type: 'tool_call_end', index: 0, id: 'call_123', name: 'aster_ping', arguments: '{}' };
    };

    const result = await probeToolCallSupport(baseConfig as never);
    expect(result).toBe(true);
  });

  it('returns false — stream ends without any decisive event (empty stream)', async () => {
    mockStreamSSEImpl = async function* () {
      // 空 stream，正常结束
    };

    const result = await probeToolCallSupport(baseConfig as never);
    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CR-01 修订：key 回退（providers 层 getKey，UI 不碰 key，守 T-02-18）
// ---------------------------------------------------------------------------
describe('probeToolCallSupport — CR-01 key 回退', () => {
  it('表单 apiKey 为空 + 无存储 key → 返回 null，且不发起请求（避免空 Bearer 401 → 误标 false）', async () => {
    let called = false;
    mockStreamSSEImpl = async function* () {
      called = true;
    };
    const result = await probeToolCallSupport({ ...baseConfig, apiKey: '' } as never);
    expect(result).toBeNull();
    expect(called).toBe(false);
  });

  it('表单 apiKey 为空 + 有存储 key → 回退用存储 key 发起探针（编辑模式 Key 字段恒为空的核心场景）', async () => {
    let called = false;
    mockStreamSSEImpl = async function* () {
      called = true;
      yield { type: 'tool_call_delta', index: 0, argumentsChunk: '' };
    };
    useProviderStore.getState().setKey('test-provider', 'sk-stored-key');
    try {
      const result = await probeToolCallSupport({ ...baseConfig, apiKey: '' } as never);
      expect(called).toBe(true);
      expect(result).toBe(true);
    } finally {
      useProviderStore.getState().setKey('test-provider', '');
    }
  });
});
