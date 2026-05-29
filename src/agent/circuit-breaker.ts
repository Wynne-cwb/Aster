/**
 * src/agent/circuit-breaker.ts — ERR-03 sliding window 判定（Phase 4 填实）
 *
 * 维度：tool name × error code
 * 规则：最近 WINDOW=5 次调用内，任一 error code 出现 ≥THRESHOLD=3 次 → isOpen=true
 *
 * A-10 灵魂：成功也 push 进窗口占 slot（code='_ok'），绝不 delete/reset counter。
 * 成功挤出的是最旧的记录（定长数组 shift()），而非重置错误计数。
 *
 * loop-helpers.ts:112/124-125 调用点由 Phase 3 已埋，本模块填实现即生效。
 */

const WINDOW = 5;
const THRESHOLD = 3;

// key = toolName；value = 该 tool 最近 WINDOW 次调用记录（成功记 code='_ok'）
const history = new Map<string, Array<{ ts: number; code: string }>>();

/**
 * 内部：把一条记录推入 tool 的定长窗口。
 * 成功也占 slot（A-10 核心）。
 */
function pushRecord(tool: string, code: string): void {
  const arr = history.get(tool) ?? [];
  arr.push({ ts: Date.now(), code });
  if (arr.length > WINDOW) arr.shift(); // 定长窗口：挤出旧记录，不 reset
  history.set(tool, arr);
}

/**
 * 记录一次成功调用（以哨兵 code '_ok' 占 slot）。
 */
export function recordSuccess(toolName: string): void {
  pushRecord(toolName, '_ok');
}

/**
 * 记录一次失败调用。
 * @param toolName - tool 名称
 * @param code - ToolErrorCode 字符串
 */
export function recordFailure(toolName: string, code: string): void {
  pushRecord(toolName, code);
}

/**
 * 判断该 tool 是否处于熔断状态。
 * 最近 WINDOW 次内，任一 error code 出现 ≥THRESHOLD 次 → true。
 */
export function isOpen(toolName: string): boolean {
  const arr = history.get(toolName);
  if (!arr) return false;

  const counts = new Map<string, number>();
  for (const r of arr) {
    if (r.code !== '_ok') {
      counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
    }
  }
  for (const c of counts.values()) {
    if (c >= THRESHOLD) return true; // 任一 code ≥3 → open
  }
  return false;
}

/**
 * 清空所有 tool 历史（仅供 vitest beforeEach 使用，生产代码不调用）。
 */
export function __reset(): void {
  history.clear();
}
