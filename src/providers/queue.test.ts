/**
 * src/providers/queue.test.ts — 单飞队列 + visibilitychange abort 测试（PROV-07）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { singleFlight, setupVisibilityAbort } from './queue';

describe('singleFlight', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('同一 providerId 的第二个调用在第一个完成前不会并发', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    // 创建一个会持续一段时间的 fn
    const slowFn = async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      concurrentCount--;
      return 'done';
    };

    // 并发触发两个同 providerId 的请求
    const p1 = singleFlight('provider-a', slowFn);
    const p2 = singleFlight('provider-a', slowFn);

    // 推进时间让两个请求都完成
    await vi.runAllTimersAsync();

    await Promise.all([p1, p2]);

    // 最大并发数应为 1（排队执行，不并发）
    expect(maxConcurrent).toBe(1);
  });

  it('不同 providerId 的调用可以并发', async () => {
    let concurrentCount = 0;
    let maxConcurrent = 0;

    const slowFn = async () => {
      concurrentCount++;
      maxConcurrent = Math.max(maxConcurrent, concurrentCount);
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      concurrentCount--;
      return 'done';
    };

    // 并发触发两个不同 providerId 的请求
    const p1 = singleFlight('provider-a', slowFn);
    const p2 = singleFlight('provider-b', slowFn);

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);

    // 最大并发数应为 2（不同 provider，可以并发）
    expect(maxConcurrent).toBe(2);
  });

  it('第一个请求 throw 后，第二个请求仍能继续执行（不被 reject 污染）', async () => {
    let callCount = 0;

    const failingFn = async () => {
      callCount++;
      if (callCount === 1) throw new Error('first request failed');
      return 'second succeeded';
    };

    const p1 = singleFlight('provider-a', failingFn);
    const p2 = singleFlight('provider-a', failingFn);

    await vi.runAllTimersAsync();

    // 第一个 reject
    await expect(p1).rejects.toThrow('first request failed');
    // 第二个仍能执行成功
    const result = await p2;
    expect(result).toBe('second succeeded');
  });

  it('singleFlight 返回 fn 的返回值', async () => {
    const fn = vi.fn().mockResolvedValue(42);
    const result = await singleFlight('provider-x', fn);
    expect(result).toBe(42);
  });
});

describe('setupVisibilityAbort', () => {
  let originalVisibilityState: PropertyDescriptor | undefined;

  beforeEach(() => {
    // 保存原始 visibilityState 描述符
    originalVisibilityState = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  });

  afterEach(() => {
    // 恢复原始 visibilityState
    if (originalVisibilityState) {
      Object.defineProperty(document, 'visibilityState', originalVisibilityState);
    }
    vi.restoreAllMocks();
  });

  it('调用后在 document 上注册 visibilitychange 监听器', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const controller = new AbortController();

    setupVisibilityAbort(controller);

    expect(addSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });

  it('document.visibilityState = hidden 时触发 controller.abort()', () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');

    // 设置 visibilityState 为 hidden
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    setupVisibilityAbort(controller);

    // 触发 visibilitychange 事件
    document.dispatchEvent(new Event('visibilitychange'));

    expect(abortSpy).toHaveBeenCalledOnce();
  });

  it('document.visibilityState = visible 时不触发 abort', () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });

    setupVisibilityAbort(controller);
    document.dispatchEvent(new Event('visibilitychange'));

    expect(abortSpy).not.toHaveBeenCalled();
  });

  it('调用返回的 cleanup 函数后，监听器被移除，再触发 hidden 不再 abort', () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, 'abort');

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });

    const cleanup = setupVisibilityAbort(controller);

    // 先触发一次（应该 abort）
    document.dispatchEvent(new Event('visibilitychange'));
    expect(abortSpy).toHaveBeenCalledOnce();

    // 调用 cleanup 移除监听器
    cleanup();

    // 再次触发（已移除，不应该再 abort）
    document.dispatchEvent(new Event('visibilitychange'));
    expect(abortSpy).toHaveBeenCalledOnce(); // 还是只有一次
  });

  it('cleanup 后 removeEventListener 被调用', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const controller = new AbortController();

    const cleanup = setupVisibilityAbort(controller);
    cleanup();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
