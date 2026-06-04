/**
 * src/lib/hostErrorLog.test.ts — 宿主原始错误本地诊断环形缓冲守门（260604-gld UAT-2）
 *
 * 覆盖：记录顺序、容量上限（丢弃最旧）、clear 复位、只读副本不污染内部。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { recordHostError, getRecentHostErrors, clearHostErrors } from './hostErrorLog';

describe('hostErrorLog — 本地诊断环形缓冲', () => {
  // 每个用例前复位，避免模块级缓冲串扰
  beforeEach(() => clearHostErrors());

  it('[ORDER] 记录后按时间顺序返回（最旧在前）', () => {
    recordHostError({ toolName: 'a', cause: 'c1', isoTime: '2026-06-04T00:00:00.000Z' });
    recordHostError({ toolName: 'b', cause: 'c2', isoTime: '2026-06-04T00:00:01.000Z' });
    const recent = getRecentHostErrors();
    expect(recent.map((e) => e.cause)).toEqual(['c1', 'c2']);
    expect(recent[0].toolName).toBe('a');
    expect(recent[1].toolName).toBe('b');
  });

  it('[CAP] 超过容量上限丢弃最旧，只保留最近 12 条', () => {
    for (let i = 0; i < 20; i++) {
      recordHostError({ toolName: `t${i}`, cause: `c${i}`, isoTime: `iso${i}` });
    }
    const recent = getRecentHostErrors();
    expect(recent.length).toBe(12);
    // 最旧 8 条（c0..c7）被丢弃，保留 c8..c19
    expect(recent[0].cause).toBe('c8');
    expect(recent[recent.length - 1].cause).toBe('c19');
  });

  it('[CLEAR] clearHostErrors 清空缓冲', () => {
    recordHostError({ toolName: 'a', cause: 'c1', isoTime: 'iso' });
    expect(getRecentHostErrors().length).toBe(1);
    clearHostErrors();
    expect(getRecentHostErrors().length).toBe(0);
  });

  it('[COPY] getRecentHostErrors 返回副本，外部 push 不污染内部', () => {
    recordHostError({ toolName: 'a', cause: 'c1', isoTime: 'iso' });
    const recent = getRecentHostErrors() as Array<unknown>;
    recent.push({ toolName: 'x', cause: 'x', isoTime: 'x' });
    // 内部缓冲不受影响，仍只有 1 条
    expect(getRecentHostErrors().length).toBe(1);
  });
});
