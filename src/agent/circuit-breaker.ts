/**
 * src/agent/circuit-breaker.ts — Phase 3 骨架（ERR-03 占位）
 *
 * Phase 4 ERR-03 实现 sliding window 最近 5 次调用 ≥3 次同 code 失败 → isOpen=true。
 * Phase 3 仅占位 — isOpen 永返 false，loop.ts 的判定路径不阻断；
 * recordSuccess / recordFailure 不做事，等 Phase 4 填实。
 */

// Phase 4 ERR-03 实现 sliding window 时填充
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _failureCounts = new Map<string, Array<{ ts: number; code: string }>>();

export function recordSuccess(_toolName: string): void {
  // Phase 4 ERR-03 实现
}

export function recordFailure(_toolName: string, _code: string): void {
  // Phase 4 ERR-03 实现
}

/**
 * 判断该 tool 是否处于熔断状态。
 * Phase 3 永返 false（骨架不阻断 dispatch）；
 * Phase 4 ERR-03 完整 sliding window 判定后启用。
 */
export function isOpen(_toolName: string): boolean {
  return false;
}
