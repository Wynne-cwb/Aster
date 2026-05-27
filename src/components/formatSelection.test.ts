/**
 * formatSelection 显示层测试 —— ROADMAP SC3 端到端验收点。
 *
 * 重点回归 CR-01（PPT slide 序号 off-by-one）：slideIndex 是 1-based，
 * 显示层禁止再 +1。选中第 1 张 slide（slideIndex===1）必须显示「第 1 张」，
 * 而非曾经的「第 2 张」。
 */
import { describe, it, expect } from 'vitest';
import { formatSelection } from './formatSelection';
import type { SelectionContext } from '../adapters';

// identity tagged-template：把 t`第 ${n} 张` 还原为普通插值字符串，不依赖 lingui runtime
const t = ((strings: TemplateStringsArray, ...args: unknown[]): string =>
  strings.reduce(
    (acc, s, i) => acc + s + (i < args.length ? String(args[i]) : ''),
    '',
  )) as (s: TemplateStringsArray, ...args: unknown[]) => string;

describe('formatSelection — PPT 1-based 序号（CR-01 回归）', () => {
  it('slideIndex===1 显示「第 1 张 slide」（不再 off-by-one 成「第 2 张」）', () => {
    const sel: SelectionContext = { kind: 'ppt', slideIndex: 1, slideCount: 10 };
    expect(formatSelection(sel, t)).toBe('第 1 张 slide');
  });

  it('slideIndex===5 显示「第 5 张 slide」', () => {
    const sel: SelectionContext = { kind: 'ppt', slideIndex: 5, slideCount: 10 };
    expect(formatSelection(sel, t)).toBe('第 5 张 slide');
  });
});

describe('formatSelection — 其余三宿主 kind', () => {
  it('excel 显示「选中区域 {address}」', () => {
    const sel: SelectionContext = { kind: 'excel', address: 'A1:C10' };
    expect(formatSelection(sel, t)).toBe('选中区域 A1:C10');
  });

  it('word 显示「选中 {n} 字」', () => {
    const sel: SelectionContext = { kind: 'word', charCount: 12 };
    expect(formatSelection(sel, t)).toBe('选中 12 字');
  });

  it('none 显示「未选中内容」占位', () => {
    const sel: SelectionContext = { kind: 'none' };
    expect(formatSelection(sel, t)).toBe('未选中内容');
  });
});
