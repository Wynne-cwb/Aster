/**
 * src/components/ContextCard.test.tsx — CARRY-01 首帧守卫（顶部上下文卡）
 *
 * 与 SelectionPill.test.tsx 同一套断言模式：mount 时第一次 render 就消费
 * useSelectionStore.initial（main.tsx Office.onReady 内预取），不再走 v1 的
 * 「mount 时 adapter.getSelection().then(setCtx)」延迟路径。
 *
 * 关联：D-22 / D-23、03-RESEARCH.md §Deliverable 6 §6.3。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ContextCard from './ContextCard';
import { useSelectionStore } from '../store/selection';
import type {
  DocumentAdapter,
  SelectionContext,
} from '../adapters/DocumentAdapter';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro
// ---------------------------------------------------------------------------
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings.join(''),
    i18n: { _: (id: string) => id },
  }),
}));

// ---------------------------------------------------------------------------
// Mock formatSelection（同 SelectionPill.test.tsx — 绕过 lingui msg 宏在 .ts 不转换的问题）
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
  };
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------
describe('CARRY-01: ContextCard first-mount ctx', () => {
  beforeEach(() => {
    useSelectionStore.setState({ initial: { kind: 'none' } });
  });

  it('PPT host: 已选中 slide 3 → 首帧显示「第 3 张 slide」', () => {
    const initial: SelectionContext = {
      kind: 'ppt',
      slideIndex: 3,
      slideCount: 10,
    };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('ppt', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <ContextCard />
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
        <ContextCard />
      </AdapterContext.Provider>,
    );

    expect(container.textContent ?? '').toMatch(/选中区域 A1:C10/);
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
        <ContextCard />
      </AdapterContext.Provider>,
    );

    expect(container.textContent ?? '').toMatch(/选中 150 字/);
  });

  it('kind=none → 首帧显示「未选中内容」占位（向后兼容 v1 文案）', () => {
    const initial: SelectionContext = { kind: 'none' };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('word', initial);

    const { container } = render(
      <AdapterContext.Provider value={adapter}>
        <ContextCard />
      </AdapterContext.Provider>,
    );

    expect(container.textContent ?? '').toMatch(/未选中内容/);
  });

  it('mount 后不调 adapter.getSelection（v1 首取路径已删，仅保留 onSelectionChanged 订阅）', () => {
    const initial: SelectionContext = { kind: 'ppt', slideIndex: 5, slideCount: 10 };
    useSelectionStore.setState({ initial });
    const adapter = makeMockAdapter('ppt', initial);

    render(
      <AdapterContext.Provider value={adapter}>
        <ContextCard />
      </AdapterContext.Provider>,
    );

    expect(adapter.getSelection).not.toHaveBeenCalled();
    expect(adapter.onSelectionChanged).toHaveBeenCalledTimes(1);
  });
});
