/**
 * Adapter 骨架 smoke test（02-05 更新：insert text 真实写回）
 *
 * 验证目标（不依赖真实 Office runtime）：
 * 1. createAdapter 工厂三宿主分流返回正确 adapter 实例
 * 2. 不支持的宿主抛 UnsupportedOperationError（code === 'UNSUPPORTED'）
 * 3. capabilities().host 三值正确，supportsSelectionEvents 为 true
 * 4. insert({type:'text'}) 使用 Office.js mock 成功 resolve（02-05 D-16）
 * 5. insert(非 text 类型) 仍抛 UnsupportedOperationError（code === 'UNSUPPORTED'）
 *
 * getSelection()/onSelectionChanged() 依赖真实 Office runtime，
 * 单测中不调用——真机验证由 sideload（ROADMAP SC3）完成。
 */
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
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
  it('Office.HostType.PowerPoint 返回 PptAdapter 实例', async () => {
    const adapter = await createAdapter(Office.HostType.PowerPoint);
    expect(adapter).toBeInstanceOf(PptAdapter);
  });

  it('Office.HostType.Excel 返回 ExcelAdapter 实例', async () => {
    const adapter = await createAdapter(Office.HostType.Excel);
    expect(adapter).toBeInstanceOf(ExcelAdapter);
  });

  it('Office.HostType.Word 返回 WordAdapter 实例', async () => {
    const adapter = await createAdapter(Office.HostType.Word);
    expect(adapter).toBeInstanceOf(WordAdapter);
  });

  it('不支持的宿主（Outlook）reject UnsupportedOperationError，code === "UNSUPPORTED"', async () => {
    // 使用双重 as 绕过严格类型转换（测试目的：验证 default 分支）
    // createAdapter 现为 async，default 分支 throw 表现为 rejected promise
    await expect(
      createAdapter('Outlook' as unknown as Office.HostType),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
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
// insert({type:'text'}) 真实写回测试（02-05 D-16）
// Office.js mock：让三宿主 run() 函数以 mock ctx 成功执行
// ---------------------------------------------------------------------------
describe('insert({type:"text"}) 真实写回（D-16）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    delete (global as unknown as Record<string, unknown>).Excel;
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('PptAdapter.insert({type:"text"}) resolves（写入第一个文本框）', async () => {
    const mockTextRange = { text: '' };
    const mockTextFrame = { textRange: mockTextRange };
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (fn: (ctx: unknown) => unknown) =>
        fn({
          presentation: {
            getSelectedSlides: () => ({
              getItemAt: () => ({
                shapes: {
                  load: vi.fn(),
                  items: [{ textFrame: mockTextFrame }],
                },
              }),
            }),
          },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    const adapter = new PptAdapter();
    await expect(adapter.insert({ type: 'text', value: 'hello PPT' })).resolves.toBeUndefined();
  });

  it('PptAdapter.insert 非 text 类型抛 UnsupportedOperationError', async () => {
    const adapter = new PptAdapter();
    await expect(
      adapter.insert({ type: 'slides', base64: 'abc==' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('ExcelAdapter.insert({type:"text"}) resolves（two-sync 规则）', async () => {
    const mockRange = { load: vi.fn(), values: [] as unknown[][], address: 'A1' };
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (fn: (ctx: unknown) => unknown) =>
        fn({
          workbook: { getSelectedRange: () => mockRange },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    const adapter = new ExcelAdapter();
    await expect(adapter.insert({ type: 'text', value: 'hello Excel' })).resolves.toBeUndefined();
  });

  it('ExcelAdapter.insert 非 text 类型抛 UnsupportedOperationError', async () => {
    const adapter = new ExcelAdapter();
    await expect(
      adapter.insert({ type: 'formula', formula: '=SUM(A1:A10)' }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });

  it('WordAdapter.insert({type:"text"}) resolves（insertText replace）', async () => {
    const mockSel = { insertText: vi.fn() };
    (global as unknown as Record<string, unknown>).Word = {
      run: vi.fn(async (fn: (ctx: unknown) => unknown) =>
        fn({
          document: { getSelection: () => mockSel },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
      InsertLocation: { replace: 'Replace' },
    };
    const adapter = new WordAdapter();
    await expect(adapter.insert({ type: 'text', value: 'hello Word' })).resolves.toBeUndefined();
  });

  it('WordAdapter.insert 非 text 类型抛 UnsupportedOperationError', async () => {
    const adapter = new WordAdapter();
    await expect(
      adapter.insert({ type: 'paragraphs', values: ['p1'] }),
    ).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });
});
