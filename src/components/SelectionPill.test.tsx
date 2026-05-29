/**
 * src/components/SelectionPill.test.tsx — CARRY-01 首帧守卫
 *
 * 目标：mount 时第一次 render 就显示「来自 useSelectionStore.initial 的真实选区」，
 *      而不是 v1 占位「未选中内容」（FU-01 / CARRY-01 acceptance criteria）。
 *
 * Mock 策略：
 * - formatSelection 直接桩固定文案 — 因为它是 .ts 文件，lingui `msg` 宏在 vitest
 *   下不被转换（详见 src/components/formatSelection.test.ts 第 4-8 行注释）；
 *   测试只关心「kind=X 的 ctx 是否被组件首帧消费」，不关心 i18n catalog 解析路径。
 * - useLingui mock 提供桩 t / i18n._，沿用 ChatStream.test.tsx 范式。
 *
 * 三宿主单测：D-22 / 03-VALIDATION.md「CARRY-01 重测三宿主真机」前的最后一道
 * 自动化网；Plan 08 真机 UAT 仍走脚本（详见 03-08-SUMMARY 的真机回归脚本）。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import SelectionPill from './SelectionPill';
import { useSelectionStore } from '../store/selection';
import { useProviderStore } from '../store/providers';
import type {
  DocumentAdapter,
  SelectionContext,
} from '../adapters/DocumentAdapter';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro：t / i18n._ 直通（无 catalog 解析）
// ---------------------------------------------------------------------------
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings.join(''),
    i18n: { _: (id: string) => id },
  }),
}));

// ---------------------------------------------------------------------------
// Mock formatSelection：直接根据 kind 返回固定文案（绕过 lingui msg 宏在 .ts 下不转换的问题）
// ---------------------------------------------------------------------------
vi.mock('./formatSelection', () => ({
  formatSelection: (sel: SelectionContext): string => {
    switch (sel.kind) {
      case 'ppt':
        return `第 ${sel.slideIndex} 张 slide`;
      case 'excel':
        return `选中区域 ${sel.address}`;
      case 'word':
        return `选中 ${sel.charCount} 字`;
      case 'none':
        return '未选中内容';
    }
  },
}));

// ---------------------------------------------------------------------------
// Mock adapter 工厂
// ---------------------------------------------------------------------------
function makeMockAdapter(
  host: 'ppt' | 'excel' | 'word',
  initial: SelectionContext,
): DocumentAdapter {
  return {
    capabilities: () => ({
      host,
      supportsSelectionEvents: true,
      supportedInserts: ['text'],
    }),
    getSelection: vi.fn().mockResolvedValue(initial),
    onSelectionChanged: vi.fn(() => () => {}),
    insert: vi.fn().mockResolvedValue(undefined),
    read: vi.fn().mockResolvedValue({ ok: true, data: null }),
  };
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------
describe('CARRY-01: SelectionPill first-mount ctx', () => {
  beforeEach(() => {
    // 每个测试前重置两个 store 到默认值
    useSelectionStore.setState({ initial: { kind: 'none' } });
    useProviderStore.setState({ attachEnabled: true });
  });

  it('PPT host: 已选中 slide 3 → 首帧显示「第 3 张 slide」（不是「未选中内容」）', () => {
    const initial: SelectionContext = {
      kind: 'ppt',
      slideIndex: 3,
      slideCount: 10,
    };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('ppt', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <SelectionPill />
      </AdapterContext.Provider>,
    );

    const text = container.textContent ?? '';
    expect(text).toMatch(/第 3 张 slide/);
    expect(text).not.toMatch(/未选中内容/);
  });

  it('Excel host: 已选中 A1:C10 → 首帧显示「选中区域 A1:C10」', () => {
    const initial: SelectionContext = {
      kind: 'excel',
      address: 'A1:C10',
    };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('excel', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <SelectionPill />
      </AdapterContext.Provider>,
    );

    const text = container.textContent ?? '';
    expect(text).toMatch(/选中区域 A1:C10/);
    expect(text).not.toMatch(/未选中内容/);
  });

  it('Word host: 已选中 150 字 → 首帧显示「选中 150 字」', () => {
    const initial: SelectionContext = {
      kind: 'word',
      charCount: 150,
    };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('word', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <SelectionPill />
      </AdapterContext.Provider>,
    );

    const text = container.textContent ?? '';
    expect(text).toMatch(/选中 150 字/);
    expect(text).not.toMatch(/未选中内容/);
  });

  it('kind=none → 首帧显示「未选中内容」占位（向后兼容 v1 文案）', () => {
    const initial: SelectionContext = { kind: 'none' };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('word', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <SelectionPill />
      </AdapterContext.Provider>,
    );

    expect(container.textContent ?? '').toMatch(/未选中内容/);
  });

  it('mount 后不调 adapter.getSelection（v1 首取路径已删，仅保留 onSelectionChanged 订阅）', () => {
    const initial: SelectionContext = { kind: 'word', charCount: 42 };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('word', initial);

    render(
      <AdapterContext.Provider value={adapter}>
        <SelectionPill />
      </AdapterContext.Provider>,
    );

    // SelectionPill 不应在 mount 时调 getSelection（首值来自 store.initial）
    expect(adapter.getSelection).not.toHaveBeenCalled();
    // 但要订阅 onSelectionChanged（用户切换选区路径）
    expect(adapter.onSelectionChanged).toHaveBeenCalledTimes(1);
  });
});
