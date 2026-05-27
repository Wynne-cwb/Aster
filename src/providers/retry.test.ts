/**
 * src/providers/retry.test.ts — 指数退避重试测试（PROV-09）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from './retry';
import {
  RateLimitError,
  NetworkError,
  KeyInvalidError,
  QuotaExceededError,
  ImageQuotaError,
} from '../errors';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fn 成功时直接返回结果，无重试', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await withRetry(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('fn 抛 RateLimitError：重试最多 3 次，第 4 次抛出', async () => {
    const fn = vi.fn().mockRejectedValue(new RateLimitError('rate limited'));

    const promise = withRetry(fn);
    // 推进所有计时器（包括指数退避延时）
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(RateLimitError);
    // 初始 1 次 + 3 次重试 = 4 次
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('fn 抛 RateLimitError(msg, 30)：尊重 retryAfterSeconds=30 等待后重试', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    // 第一次失败（带 retryAfterSeconds=30），第二次成功
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('rate limited', 30))
      .mockResolvedValue('ok');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);

    // 检查至少有一次 setTimeout 以 30000ms 调用
    const timeoutCalls = setTimeoutSpy.mock.calls;
    const hasRespectDelay = timeoutCalls.some(([, ms]) => ms === 30_000);
    expect(hasRespectDelay).toBe(true);
  });

  it('fn 抛 NetworkError：重试最多 3 次', async () => {
    const fn = vi.fn().mockRejectedValue(new NetworkError('network error'));

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow(NetworkError);
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('fn 抛 KeyInvalidError：立即抛出，不重试（billing class）', async () => {
    const fn = vi.fn().mockRejectedValue(new KeyInvalidError('invalid key'));

    await expect(withRetry(fn)).rejects.toThrow(KeyInvalidError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('fn 抛 QuotaExceededError：立即抛出，不重试（billing class）', async () => {
    const fn = vi.fn().mockRejectedValue(new QuotaExceededError('quota exceeded'));

    await expect(withRetry(fn)).rejects.toThrow(QuotaExceededError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('fn 抛 ImageQuotaError：立即抛出，不重试（billing class）', async () => {
    const fn = vi.fn().mockRejectedValue(new ImageQuotaError('image quota exceeded'));

    await expect(withRetry(fn)).rejects.toThrow(ImageQuotaError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('fn 抛其他未知错误：立即抛出，不重试', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('some unknown error'));

    await expect(withRetry(fn)).rejects.toThrow('some unknown error');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('fn 在第 2 次重试后成功', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError('rate limited'))
      .mockRejectedValueOnce(new RateLimitError('rate limited'))
      .mockResolvedValue('final success');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    await expect(promise).resolves.toBe('final success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
