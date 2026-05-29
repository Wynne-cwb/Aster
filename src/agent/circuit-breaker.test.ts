/**
 * src/agent/circuit-breaker.test.ts — vitest acceptance (ERR-03 / A-10)
 *
 * 关键约束 A-10：成功不重置 counter，成功占 slot 挤出旧记录。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { recordSuccess, recordFailure, isOpen, __reset } from './circuit-breaker';

beforeEach(() => {
  __reset();
});

describe('circuit-breaker — isOpen 基本判定', () => {
  it('未曾调用的 tool 返 false', () => {
    expect(isOpen('never_called')).toBe(false);
  });

  it('只失败 2 次（<THRESHOLD=3）返 false', () => {
    recordFailure('tool_x', 'HOST_API_FAILED');
    recordFailure('tool_x', 'HOST_API_FAILED');
    expect(isOpen('tool_x')).toBe(false);
  });

  it('连续 3 次同 code 失败 → isOpen 返 true', () => {
    recordFailure('tool_x', 'HOST_API_FAILED');
    recordFailure('tool_x', 'HOST_API_FAILED');
    recordFailure('tool_x', 'HOST_API_FAILED');
    expect(isOpen('tool_x')).toBe(true);
  });

  it('不同 code，任一 code 累计 ≥3 → isOpen 返 true', () => {
    // A 出现 3 次，B 出现 2 次，共 5 次，A 满足 THRESHOLD
    recordFailure('tool_x', 'A');
    recordFailure('tool_x', 'B');
    recordFailure('tool_x', 'A');
    recordFailure('tool_x', 'B');
    recordFailure('tool_x', 'A');
    expect(isOpen('tool_x')).toBe(true);
  });
});

describe('circuit-breaker — A-10 中间成功不重置', () => {
  it('fail, success, fail, success, fail（同 code）→ 第 3 fail 后 isOpen 返 true', () => {
    // 序列：fail(C), success, fail(C), success, fail(C)
    // 窗口内有 5 条记录，C 出现 3 次 → isOpen=true
    recordFailure('tool_a10', 'HOST_API_FAILED');
    recordSuccess('tool_a10');
    recordFailure('tool_a10', 'HOST_API_FAILED');
    recordSuccess('tool_a10');
    recordFailure('tool_a10', 'HOST_API_FAILED');
    expect(isOpen('tool_a10')).toBe(true);
  });
});

describe('circuit-breaker — 窗口边界行为', () => {
  it('旧失败被后续记录挤出窗口后，不再计入 → isOpen 返 false', () => {
    // fail(C) 进窗口，然后 5 次 success 把它挤出（窗口 WINDOW=5）
    recordFailure('tool_win', 'HOST_API_FAILED');
    recordSuccess('tool_win');
    recordSuccess('tool_win');
    recordSuccess('tool_win');
    recordSuccess('tool_win');
    recordSuccess('tool_win');
    // 窗口里现在是 5 个 _ok，fail(C) 已被挤出
    expect(isOpen('tool_win')).toBe(false);
  });

  it('不同 tool 互相隔离', () => {
    recordFailure('tool_x', 'HOST_API_FAILED');
    recordFailure('tool_x', 'HOST_API_FAILED');
    recordFailure('tool_x', 'HOST_API_FAILED');
    expect(isOpen('tool_y')).toBe(false);
    expect(isOpen('tool_x')).toBe(true);
  });
});

describe('circuit-breaker — __reset 清空', () => {
  it('__reset 后所有 tool 返 false', () => {
    recordFailure('tool_r', 'HOST_API_FAILED');
    recordFailure('tool_r', 'HOST_API_FAILED');
    recordFailure('tool_r', 'HOST_API_FAILED');
    expect(isOpen('tool_r')).toBe(true);
    __reset();
    expect(isOpen('tool_r')).toBe(false);
  });
});
