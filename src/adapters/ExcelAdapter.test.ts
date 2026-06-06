/**
 * src/adapters/ExcelAdapter.test.ts — Phase 5 Plan 05 inverse mock tests
 *
 * 测试 setRangeValues + overwriteRange 方法（Wave 2 实现）。
 *
 * 设计：
 * - setRangeValues(address, values) → 先读取 before-image，再覆写，返回 { beforeImage }
 * - overwriteRange(address, values) → 直接覆写（inverse 操作，不抓 before-image）
 *
 * Office.js 依赖全部 mock（不调真实 Excel API）。
 * 范式参照 WordAdapter.test.ts 的 Word.run mock 模式。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExcelAdapter } from './ExcelAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// 辅助：构造 mock Excel.run + mock context
// ---------------------------------------------------------------------------

/** 构造一个 mock range 对象（含 load / values / address） */
function makeMockRange(initialValues: unknown[][], address: string) {
  const range = {
    load: vi.fn(),
    values: initialValues,
    address,
  };
  return range;
}

/** 构造标准 mock Excel context */
function makeMockCtx(range: ReturnType<typeof makeMockRange>) {
  return {
    workbook: {
      worksheets: {
        getActiveWorksheet: () => ({
          getRange: vi.fn().mockReturnValue(range),
        }),
      },
    },
    sync: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// setRangeValues + overwriteRange — Wave 2 tests
// ---------------------------------------------------------------------------

describe('ExcelAdapter setRangeValues + overwriteRange（Wave 2 inverse）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // setRangeValues
  // -----------------------------------------------------------------------

  it('setRangeValues 返回 before-image address + values', async () => {
    const mockValues = [[1, 2], [3, 4]];
    const mockRange = makeMockRange(mockValues, 'Sheet1!A1:B2');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    const result = await adapter.setRangeValues('A1:B2', [[10, 20], [30, 40]]);

    expect(result.beforeImage.address).toBe('Sheet1!A1:B2');
    expect(result.beforeImage.values).toEqual([[1, 2], [3, 4]]);
  });

  it('setRangeValues 覆写成功（range.values 被赋值为传入 values）', async () => {
    const mockRange = makeMockRange([[0, 0], [0, 0]], 'Sheet1!A1:B2');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    const newValues = [[10, 20], [30, 40]];
    await adapter.setRangeValues('A1:B2', newValues);

    // 确认 range.values 已被赋值为传入 values（sync 2 写入）
    expect(mockRange.values).toEqual(newValues);
  });

  it('setRangeValues 两次调用 ctx.sync（load → sync1 抓 before-image，write → sync2）', async () => {
    const mockRange = makeMockRange([[1]], 'Sheet1!A1');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    await adapter.setRangeValues('A1', [[99]]);

    // two-sync 规则（NFR-02 A-06）：sync 1 = load before-image，sync 2 = write values
    expect(mockCtx.sync).toHaveBeenCalledTimes(2);
  });

  it('setRangeValues Excel.run 报错 → HostApiError', async () => {
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async () => {
        throw new Error('excel api error');
      }),
    };

    const adapter = new ExcelAdapter();
    await expect(adapter.setRangeValues('A1', [[1]])).rejects.toBeInstanceOf(HostApiError);
  });

  // -----------------------------------------------------------------------
  // overwriteRange
  // -----------------------------------------------------------------------

  // -----------------------------------------------------------------------
  // overwriteRange — 接受 args: Record<string, unknown>（DocumentAdapterForReplay 接口约定）
  // operationLog.executeReverse 直接传 reverse.args 对象，不拆参
  // -----------------------------------------------------------------------

  it('overwriteRange 执行覆写（range.values 被赋值为 args.values）', async () => {
    const mockRange = makeMockRange([[1, 2], [3, 4]], 'Sheet1!A1:B2');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    const beforeImageValues = [[99, 88], [77, 66]];
    await adapter.overwriteRange({ address: 'A1:B2', values: beforeImageValues });

    expect(mockRange.values).toEqual(beforeImageValues);
  });

  it('overwriteRange 返回 void（不返回 before-image）', async () => {
    const mockRange = makeMockRange([[0]], 'Sheet1!A1');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    const result = await adapter.overwriteRange({ address: 'A1', values: [[42]] });

    // overwriteRange 是 Promise<void>，返回值为 undefined
    expect(result).toBeUndefined();
  });

  it('overwriteRange 只调用一次 ctx.sync（直接写，不抓 before-image）', async () => {
    const mockRange = makeMockRange([[0]], 'Sheet1!A1');
    const mockCtx = makeMockCtx(mockRange);

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: typeof mockCtx) => Promise<unknown>) => cb(mockCtx)),
    };

    const adapter = new ExcelAdapter();
    await adapter.overwriteRange({ address: 'A1', values: [[42]] });

    // overwriteRange 只需单次 sync（set values → sync）
    expect(mockCtx.sync).toHaveBeenCalledTimes(1);
  });

  it('overwriteRange Excel.run 报错 → HostApiError', async () => {
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async () => {
        throw new Error('excel api error');
      }),
    };

    const adapter = new ExcelAdapter();
    await expect(
      adapter.overwriteRange({ address: 'A1', values: [[1]] }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// CR-01：setColumnRowSize / restoreColumnRowSize 列索引 >Z 合法地址守门
// 旧代码用 String.fromCharCode(65 + idx)，idx≥26 会产出 '[' 等非法字符 →
// 非法 A1 地址。columnIndexToLetter 修复后须生成合法多字母列字母。
// ---------------------------------------------------------------------------

describe('ExcelAdapter setColumnRowSize/restoreColumnRowSize — CR-01 列索引 >Z 合法地址', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
    vi.restoreAllMocks();
  });

  /** 构造 mock Excel，记录所有 getRange 传入的地址字符串 */
  function mockExcelCaptureAddresses(): { addresses: string[] } {
    const addresses: string[] = [];
    const makeRange = () => ({
      load: vi.fn(),
      format: {
        columnWidth: 64,
        rowHeight: 15,
        autofitColumns: vi.fn(),
        autofitRows: vi.fn(),
      },
    });
    const activeWorksheet = {
      getRange: vi.fn((addr: string) => {
        addresses.push(addr);
        return makeRange();
      }),
    };
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet: () => activeWorksheet } },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    return { addresses };
  }

  it('setColumnRowSize idx=26 → 列地址 AA:AA（不含非法字符 "["）', async () => {
    const { addresses } = mockExcelCaptureAddresses();
    const adapter = new ExcelAdapter();
    await adapter.setColumnRowSize('column', [26], 80);
    expect(addresses).toContain('AA:AA');
    expect(addresses.some((a) => a.includes('['))).toBe(false);
  });

  it('setColumnRowSize idx=27 → AB:AB；idx=701 → ZZ:ZZ（多字母进位正确）', async () => {
    const { addresses } = mockExcelCaptureAddresses();
    const adapter = new ExcelAdapter();
    await adapter.setColumnRowSize('column', [27, 701], 80);
    expect(addresses).toContain('AB:AB');
    expect(addresses).toContain('ZZ:ZZ');
    expect(addresses.some((a) => a.includes('['))).toBe(false);
  });

  it('setColumnRowSize idx=0/25 → A:A / Z:Z（单字母边界不回归）', async () => {
    const { addresses } = mockExcelCaptureAddresses();
    const adapter = new ExcelAdapter();
    await adapter.setColumnRowSize('column', [0, 25], 80);
    expect(addresses).toContain('A:A');
    expect(addresses).toContain('Z:Z');
  });

  it('restoreColumnRowSize index≥26 → 生成合法多字母地址（AA:AA / ZZ:ZZ）', async () => {
    const { addresses } = mockExcelCaptureAddresses();
    const adapter = new ExcelAdapter();
    await adapter.restoreColumnRowSize({
      target: 'column',
      beforeSizes: [
        { index: 26, size: 64 },
        { index: 701, size: 100 },
      ],
    });
    expect(addresses).toContain('AA:AA');
    expect(addresses).toContain('ZZ:ZZ');
    expect(addresses.some((a) => a.includes('['))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Structural smoke test — ensures ExcelAdapter class loads without error
// ---------------------------------------------------------------------------

describe('ExcelAdapter structural smoke test', () => {
  it('ExcelAdapter 类可实例化（构造器无副作用）', () => {
    expect(() => new ExcelAdapter()).not.toThrow();
  });

  it('capabilities() 返回 excel host + supportedInserts 包含 range-values', () => {
    const adapter = new ExcelAdapter();
    const caps = adapter.capabilities();
    expect(caps.host).toBe('excel');
    expect(caps.supportedInserts).toContain('range-values');
  });
});

// ---------------------------------------------------------------------------
// HR-01 守门：remove_duplicates 缺省 columns → 传显式全列索引（绝不传 []）
// 数据安全硬门：空数组语义未经官方证实，最坏按「零列」判重 → 除首行外全删（大面积误删）。
// 缺省时必须读 columnCount 展开为 [0..n-1]，断言传给 Office.js removeDuplicates 的是显式数组而非 []。
// ---------------------------------------------------------------------------

describe('ExcelAdapter.removeDuplicatesRange — HR-01 缺省全列展开守门', () => {
  function mockExcelForDedup(columnCount: number) {
    const removeDuplicatesSpy = vi.fn((_columns: number[], _includesHeader: boolean) => ({
      load: vi.fn(),
      removed: 2,
      uniqueRemaining: 8,
    }));
    const range = {
      load: vi.fn(),
      address: 'Sheet1!A1:D100',
      cellCount: columnCount * 100, // ≤ 10000 → 快照不超限
      columnCount,
      values: [Array.from({ length: columnCount }, (_, i) => `c${i}`)],
      removeDuplicates: removeDuplicatesSpy,
    };
    (global as unknown as Record<string, unknown>).Office = {
      context: { requirements: { isSetSupported: () => true } },
    };
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet: () => ({ getRange: () => range }) } },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    return removeDuplicatesSpy;
  }

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
    delete (global as unknown as Record<string, unknown>).Office;
    vi.restoreAllMocks();
  });

  it('缺省 columns → 传显式全列索引 [0..n-1]（非空数组 []）', async () => {
    const spy = mockExcelForDedup(4);
    const adapter = new ExcelAdapter();
    await adapter.removeDuplicatesRange('A1:D100');
    expect(spy).toHaveBeenCalledTimes(1);
    const passedColumns = spy.mock.calls[0][0];
    // 硬门：必须是显式全列索引，绝不是 []
    expect(passedColumns).toEqual([0, 1, 2, 3]);
    expect(passedColumns).not.toEqual([]);
  });

  it('显式 columns=[0,2] → 原样透传（不被全列覆盖）', async () => {
    const spy = mockExcelForDedup(4);
    const adapter = new ExcelAdapter();
    await adapter.removeDuplicatesRange('A1:D100', [0, 2]);
    expect(spy.mock.calls[0][0]).toEqual([0, 2]);
  });

  it('显式空数组 columns=[] 也被视为缺省 → 展开为显式全列索引（不把 [] 传给 Office.js）', async () => {
    const spy = mockExcelForDedup(3);
    const adapter = new ExcelAdapter();
    await adapter.removeDuplicatesRange('A1:C100', []);
    expect(spy.mock.calls[0][0]).toEqual([0, 1, 2]);
  });
});
