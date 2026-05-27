/**
 * TDD RED: adapter 骨架 smoke test
 *
 * 验证目标（不依赖真实 Office runtime）：
 * 1. createAdapter 工厂三宿主分流返回正确 adapter 实例
 * 2. 不支持的宿主抛 UnsupportedOperationError（code === 'UNSUPPORTED'）
 * 3. capabilities().host 三值正确，supportsSelectionEvents 为 true
 * 4. insert() 桩抛 UnsupportedOperationError（code === 'UNSUPPORTED'）
 *
 * getSelection()/onSelectionChanged() 依赖真实 Office runtime，
 * 单测中不调用——真机验证由 sideload（ROADMAP SC3）完成。
 */
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { PptAdapter } from './PptAdapter';
import { ExcelAdapter } from './ExcelAdapter';
import { WordAdapter } from './WordAdapter';
import { createAdapter } from './index';

// ---------------------------------------------------------------------------
// 测试前 mock Office 全局（仅工厂所需的 HostType enum）
// ---------------------------------------------------------------------------
beforeAll(() => {
  (global as unknown as Record<string, unknown>).Office = {
    HostType: {
      PowerPoint: 'PowerPoint',
      Excel: 'Excel',
      Word: 'Word',
    },
  } as unknown as typeof Office;
});

// ---------------------------------------------------------------------------
// createAdapter 工厂分流
// ---------------------------------------------------------------------------
describe('createAdapter 工厂', () => {
  it('Office.HostType.PowerPoint 返回 PptAdapter 实例', () => {
    const adapter = createAdapter(Office.HostType.PowerPoint);
    expect(adapter).toBeInstanceOf(PptAdapter);
  });

  it('Office.HostType.Excel 返回 ExcelAdapter 实例', () => {
    const adapter = createAdapter(Office.HostType.Excel);
    expect(adapter).toBeInstanceOf(ExcelAdapter);
  });

  it('Office.HostType.Word 返回 WordAdapter 实例', () => {
    const adapter = createAdapter(Office.HostType.Word);
    expect(adapter).toBeInstanceOf(WordAdapter);
  });

  it('不支持的宿主（Outlook）抛 UnsupportedOperationError，code === "UNSUPPORTED"', () => {
    // 使用双重 as 绕过严格类型转换（测试目的：验证 default 分支）
    expect(() => createAdapter('Outlook' as unknown as Office.HostType)).toThrow();
    try {
      createAdapter('Outlook' as unknown as Office.HostType);
    } catch (e: unknown) {
      expect((e as { code?: string }).code).toBe('UNSUPPORTED');
    }
  });
});

// ---------------------------------------------------------------------------
// capabilities() 桩验证
// ---------------------------------------------------------------------------
describe('capabilities() 桩', () => {
  it('PptAdapter.capabilities().host === "ppt"，supportsSelectionEvents true', () => {
    const adapter = new PptAdapter();
    const caps = adapter.capabilities();
    expect(caps.host).toBe('ppt');
    expect(caps.supportsSelectionEvents).toBe(true);
  });

  it('ExcelAdapter.capabilities().host === "excel"，supportsSelectionEvents true', () => {
    const adapter = new ExcelAdapter();
    const caps = adapter.capabilities();
    expect(caps.host).toBe('excel');
    expect(caps.supportsSelectionEvents).toBe(true);
  });

  it('WordAdapter.capabilities().host === "word"，supportsSelectionEvents true', () => {
    const adapter = new WordAdapter();
    const caps = adapter.capabilities();
    expect(caps.host).toBe('word');
    expect(caps.supportsSelectionEvents).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PptAdapter.getSelection() — office 0-based index → slideIndex 1-based（CR-01 回归）
// ---------------------------------------------------------------------------
describe('PptAdapter.getSelection() 序号转换', () => {
  function mockPowerPoint(selectedIndices: number[], totalCount: number): void {
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            getSelectedSlides: () => ({
              load: () => {},
              items: selectedIndices.map((index) => ({ index })),
            }),
            slides: {
              load: () => {},
              items: Array.from({ length: totalCount }, () => ({})),
            },
          },
          sync: async () => {},
        }),
    };
  }

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('选中 office index 0（第一张）→ slideIndex === 1（1-based，不偏大）', async () => {
    mockPowerPoint([0], 10);
    const sel = await new PptAdapter().getSelection();
    expect(sel).toEqual({ kind: 'ppt', slideIndex: 1, slideCount: 10 });
  });

  it('选中 office index 4 → slideIndex === 5', async () => {
    mockPowerPoint([4], 10);
    const sel = await new PptAdapter().getSelection();
    expect(sel).toMatchObject({ kind: 'ppt', slideIndex: 5 });
  });

  it('无选中 → kind "none"', async () => {
    mockPowerPoint([], 10);
    const sel = await new PptAdapter().getSelection();
    expect(sel).toEqual({ kind: 'none' });
  });
});

// ---------------------------------------------------------------------------
// insert() 桩抛 UnsupportedOperationError
// ---------------------------------------------------------------------------
describe('insert() 桩', () => {
  it('PptAdapter.insert() 抛 UnsupportedOperationError，code === "UNSUPPORTED"', async () => {
    const adapter = new PptAdapter();
    await expect(adapter.insert({ type: 'text', value: 'x' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('ExcelAdapter.insert() 抛 UnsupportedOperationError，code === "UNSUPPORTED"', async () => {
    const adapter = new ExcelAdapter();
    await expect(adapter.insert({ type: 'text', value: 'x' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });

  it('WordAdapter.insert() 抛 UnsupportedOperationError，code === "UNSUPPORTED"', async () => {
    const adapter = new WordAdapter();
    await expect(adapter.insert({ type: 'text', value: 'x' })).rejects.toMatchObject({
      code: 'UNSUPPORTED',
    });
  });
});
