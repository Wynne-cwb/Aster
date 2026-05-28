/**
 * src/store/selection.test.ts — useSelectionStore 行为守卫（CARRY-01 RED→GREEN）
 *
 * 覆盖：
 * - 初始 initial = { kind: 'none' }（main.tsx 预取失败时的兜底）
 * - setState({ initial }) 后字段更新（main.tsx 预取成功时的注入路径）
 *
 * 范式参考：src/store/providers.ts（Zustand create + setState 守卫）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useSelectionStore } from './selection';
import type { SelectionContext } from '../adapters/DocumentAdapter';

describe('useSelectionStore (CARRY-01)', () => {
  beforeEach(() => {
    useSelectionStore.setState({ initial: { kind: 'none' } });
  });

  it('初始 initial = { kind: "none" }', () => {
    expect(useSelectionStore.getState().initial).toEqual({ kind: 'none' });
  });

  it('setState({ initial }) 后字段更新 — word 上下文', () => {
    const next: SelectionContext = { kind: 'word', charCount: 150 };
    useSelectionStore.setState({ initial: next });
    expect(useSelectionStore.getState().initial).toEqual(next);
    expect(useSelectionStore.getState().initial.kind).toBe('word');
  });

  it('setState({ initial }) 后字段更新 — ppt 上下文', () => {
    const next: SelectionContext = { kind: 'ppt', slideIndex: 3, slideCount: 10 };
    useSelectionStore.setState({ initial: next });
    const got = useSelectionStore.getState().initial;
    expect(got.kind).toBe('ppt');
    if (got.kind === 'ppt') {
      expect(got.slideIndex).toBe(3);
      expect(got.slideCount).toBe(10);
    }
  });

  it('setState({ initial }) 后字段更新 — excel 上下文', () => {
    const next: SelectionContext = { kind: 'excel', address: 'A1:C10' };
    useSelectionStore.setState({ initial: next });
    const got = useSelectionStore.getState().initial;
    expect(got.kind).toBe('excel');
    if (got.kind === 'excel') {
      expect(got.address).toBe('A1:C10');
    }
  });
});
