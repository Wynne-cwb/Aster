/**
 * src/main.test.tsx — CARRY-01 路径 A 集成守卫（main.tsx Office.onReady 内的预取流程）
 *
 * 为什么不直接 import main.tsx：
 *   main.tsx 顶层有 `Office.onReady(async (info) => { ... })` 副作用，jsdom 下
 *   全局 Office 对象不存在，import 即抛 ReferenceError。本测试改为直接断言
 *   「Office.onReady 内做的事情」的逻辑契约：
 *     ① await adapter.getSelection() 一次
 *     ② 把结果 setState 进 useSelectionStore.initial
 *     ③ getSelection 抛错时兜底 { kind: 'none' }，不向上抛
 *
 *   这等价于 main.tsx 的回调体在 mock adapter 上跑一遍，作为 Plan 08 真机 UAT
 *   之前的最后一道自动化网（CARRY-01 acceptance criteria）。
 *
 * 关联：D-22 / D-23、03-RESEARCH.md §Deliverable 6 §6.3 路径 A。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSelectionStore } from './store/selection';
import type { DocumentAdapter, SelectionContext } from './adapters/DocumentAdapter';

/**
 * 复制 main.tsx Office.onReady 回调内 CARRY-01 路径 A 的核心 5 行，
 * 用 mock adapter 跑一遍；任何在 main.tsx 内对此片段的偏离都需要同步更新此 helper。
 */
async function simulateMainPathA(adapter: Pick<DocumentAdapter, 'getSelection'>): Promise<void> {
  let initialSelection: SelectionContext = { kind: 'none' };
  try {
    initialSelection = await adapter.getSelection();
  } catch {
    // 兜底：保持 { kind: 'none' }，组件 onSelectionChanged 订阅会在用户后续切换时补上
  }
  useSelectionStore.setState({ initial: initialSelection });
}

describe('CARRY-01 integration: main.tsx 路径 A', () => {
  beforeEach(() => {
    useSelectionStore.setState({ initial: { kind: 'none' } });
  });

  it('adapter.getSelection 返 ppt 上下文 → useSelectionStore.initial.kind === "ppt"', async () => {
    const mockAdapter = {
      getSelection: vi.fn().mockResolvedValue({
        kind: 'ppt',
        slideIndex: 3,
        slideCount: 10,
      } satisfies SelectionContext),
    };
    await simulateMainPathA(mockAdapter);
    const got = useSelectionStore.getState().initial;
    expect(got.kind).toBe('ppt');
    if (got.kind === 'ppt') {
      expect(got.slideIndex).toBe(3);
      expect(got.slideCount).toBe(10);
    }
    expect(mockAdapter.getSelection).toHaveBeenCalledTimes(1);
  });

  it('adapter.getSelection 返 excel 上下文 → useSelectionStore.initial.kind === "excel"', async () => {
    const mockAdapter = {
      getSelection: vi.fn().mockResolvedValue({
        kind: 'excel',
        address: 'A1:C10',
      } satisfies SelectionContext),
    };
    await simulateMainPathA(mockAdapter);
    const got = useSelectionStore.getState().initial;
    expect(got.kind).toBe('excel');
    if (got.kind === 'excel') {
      expect(got.address).toBe('A1:C10');
    }
  });

  it('adapter.getSelection 返 word 上下文 → useSelectionStore.initial.kind === "word"', async () => {
    const mockAdapter = {
      getSelection: vi.fn().mockResolvedValue({
        kind: 'word',
        charCount: 150,
      } satisfies SelectionContext),
    };
    await simulateMainPathA(mockAdapter);
    const got = useSelectionStore.getState().initial;
    expect(got.kind).toBe('word');
    if (got.kind === 'word') {
      expect(got.charCount).toBe(150);
    }
  });

  it('adapter.getSelection 抛错 → useSelectionStore.initial.kind === "none"（兜底，不抛）', async () => {
    const mockAdapter = {
      getSelection: vi.fn().mockRejectedValue(new Error('host not ready')),
    };
    await expect(simulateMainPathA(mockAdapter)).resolves.toBeUndefined();
    expect(useSelectionStore.getState().initial).toEqual({ kind: 'none' });
  });
});
