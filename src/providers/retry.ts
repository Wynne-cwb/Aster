/**
 * src/providers/retry.ts — 指数退避重试（PROV-09）
 *
 * 只对 RateLimitError（429）和 NetworkError（503/网络失败）重试。
 * billing 类错误（KeyInvalidError/QuotaExceededError/ImageQuotaError）绝对不重试。
 * 尊重 RateLimitError.retryAfterSeconds（来自 Retry-After header）。
 */

import { RateLimitError, NetworkError, KeyInvalidError, QuotaExceededError, ImageQuotaError } from '../errors';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 30_000;

/** 不可重试的 billing 类错误 */
function isBillingError(e: unknown): boolean {
  return e instanceof KeyInvalidError
    || e instanceof QuotaExceededError
    || e instanceof ImageQuotaError;
}

/** 可重试的错误 */
function isRetryable(e: unknown): boolean {
  return e instanceof RateLimitError || e instanceof NetworkError;
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      // billing 类：立即抛出，不重试
      if (isBillingError(e)) throw e;
      // 不可重试的其他错误：立即抛出
      if (!isRetryable(e)) throw e;
      // 已达最大重试次数：抛出
      if (attempt === MAX_RETRIES) throw e;

      // 计算退避时间：优先尊重 Retry-After header
      const retryAfterMs = e instanceof RateLimitError && e.retryAfterSeconds != null
        ? e.retryAfterSeconds * 1_000
        : Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS) * (0.9 + Math.random() * 0.2);

      await new Promise<void>((resolve) => setTimeout(resolve, retryAfterMs));
    }
  }
  // TypeScript exhaustiveness
  throw new Error('withRetry: unreachable');
}
