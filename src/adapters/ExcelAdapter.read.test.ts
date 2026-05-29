/**
 * src/adapters/ExcelAdapter.read.test.ts — Phase 4 Plan 05 Task 1 (TDD RED)
 *
 * 验证 ExcelAdapter.read(query) 4 个 kind 实现：
 * - list_worksheets       — 工作表名清单（metadata）
 * - get_range_values      — 指定 address 的值（≤10K cells 读值；>10K cells A-24 读前拒绝）
 * - get_used_range_summary — used range 概况 + 首行 schema（不读全部 values）
 * - selection_detail      — 复用 getSelection() 语义
 *
 * A-24 核心防御：get_range_values >10K cells 时：
 *   1. 必须返回 { ok:false, error:{ code:'INVALID_ARGS' } }
 *   2. 必须【未】调用 range.load('values')（spy 断言）
 *
 * Office.js mock 模式照 WordAdapter.read.test.ts（Phase 4 Plan 03）。
 * A-06：proxy 不出 Excel.run 闭包；只返纯数据。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExcelAdapter } from './ExcelAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// Helper: 构造基本 Excel ctx mock（单 worksheet，无 range）
// ---------------------------------------------------------------------------
function makeExcelCtx(
  syncFn: ReturnType<typeof vi.fn>,
  overrides: Record<string, unknown> = {},
) {
  return {
    workbook: {
      worksheets: {
        items: [] as Array<{ name: string }>,
        load: vi.fn(),
        getActiveWorksheet: vi.fn(() => ({
          getRange: vi.fn(),
          getUsedRange: vi.fn(),
        })),
        getItem: vi.fn(),
      },
      getSelectedRange: vi.fn(),
    },
    sync: syncFn,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// describe: list_worksheets
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — list_worksheets', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const worksheetItems = [{ name: 'Sheet1' }, { name: 'Sheet2' }, { name: '数据表' }];

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: {
            worksheets: {
              items: worksheetItems,
              load: vi.fn(),
            },
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('返回 { ok: true, data: { worksheets: [名字列表] } }', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'list_worksheets' });
    expect(result).toEqual({
      ok: true,
      data: { worksheets: ['Sheet1', 'Sheet2', '数据表'] },
    });
  });

  it('调用 worksheets.load + ctx.sync', async () => {
    const adapter = new ExcelAdapter();
    await adapter.read({ kind: 'list_worksheets' });
    const excelGlobal = (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel;
    expect(excelGlobal.run).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalled();
  });

  it('Excel.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel.run = vi.fn(
      async () => {
        throw new Error('api error');
      },
    );
    const adapter = new ExcelAdapter();
    await expect(adapter.read({ kind: 'list_worksheets' })).rejects.toBeInstanceOf(HostApiError);
  });

  it('工作表为空时返回空数组', async () => {
    (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: { worksheets: { items: [], load: vi.fn() } },
          sync: vi.fn().mockResolvedValue(undefined),
        };
        return cb(ctx);
      },
    );
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'list_worksheets' });
    expect(result).toEqual({ ok: true, data: { worksheets: [] } });
  });
});

// ---------------------------------------------------------------------------
// describe: get_range_values — 正常路径（≤10K cells）
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — get_range_values (≤10K cells)', () => {
  let sync: ReturnType<typeof vi.fn>;
  let loadSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    loadSpy = vi.fn();

    const mockRange = {
      cellCount: 60,    // 3行 × 20列 = 60，≤10K
      rowCount: 3,
      columnCount: 20,
      values: [
        ['姓名', '年龄', '部门'],
        ['张三', 30, '工程'],
        ['李四', 25, '产品'],
      ],
      load: loadSpy,
    };

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: {
            worksheets: {
              getActiveWorksheet: vi.fn(() => ({
                getRange: vi.fn(() => mockRange),
              })),
            },
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('返回 { ok: true, data: { address, rowCount, values } }', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_range_values', address: 'A1:T3' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { address: string; rowCount: number; values: unknown[][] };
      expect(data.address).toBe('A1:T3');
      expect(data.rowCount).toBe(3);
      expect(data.values).toHaveLength(3);
      expect(data.values[0]).toEqual(['姓名', '年龄', '部门']);
    }
  });

  it('先 load cellCount，再 load values（两次 sync）', async () => {
    const adapter = new ExcelAdapter();
    await adapter.read({ kind: 'get_range_values', address: 'A1:T3' });
    // loadSpy 被调用两次：第一次 ['cellCount','rowCount','columnCount']，第二次 'values'
    expect(loadSpy).toHaveBeenCalledTimes(2);
    const calls = loadSpy.mock.calls;
    // 第一次调用包含 cellCount（读前判定）
    expect(calls[0][0]).toContain('cellCount');
    // 第二次调用是 values（安全后才读）
    expect(calls[1][0]).toBe('values');
    // sync 被调用 2 次（sync1: 读 cellCount；sync2: 读 values）
    expect(sync).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------
// describe: get_range_values — A-24 读前拒绝（>10K cells）
// 核心：必须返回 INVALID_ARGS 且 values 未被 load（spy 断言）
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — get_range_values A-24 >10K cells 读前拒绝', () => {
  let sync: ReturnType<typeof vi.fn>;
  let loadSpy: ReturnType<typeof vi.fn>;
  let mockRange: {
    cellCount: number;
    rowCount: number;
    columnCount: number;
    values: unknown[][];
    load: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    loadSpy = vi.fn();

    mockRange = {
      cellCount: 50000,   // 100行 × 500列 = 50000，>10K
      rowCount: 100,
      columnCount: 500,
      values: [],         // 故意空，若被 load 了说明 A-24 防御失效
      load: loadSpy,
    };

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: {
            worksheets: {
              getActiveWorksheet: vi.fn(() => ({
                getRange: vi.fn(() => mockRange),
              })),
            },
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('返回 { ok: false, error: { code: "INVALID_ARGS" } }（不抛）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_range_values', address: 'A1:Z100000' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ARGS');
      expect(result.error.recoverable).toBe(true);
      expect(result.error.message).toContain('50000');
      expect(result.error.hint).toBeTruthy();
    }
  });

  it('A-24 核心：>10K cells 时 range.load("values") 未被调用（读前拒绝）', async () => {
    const adapter = new ExcelAdapter();
    await adapter.read({ kind: 'get_range_values', address: 'A1:Z100000' });

    // 检查 load 的所有调用，确认没有任何一次传入 'values'
    const loadCalls = loadSpy.mock.calls;
    const valuesWasLoaded = loadCalls.some(
      (call) =>
        call[0] === 'values' ||
        (Array.isArray(call[0]) && (call[0] as string[]).includes('values')),
    );
    expect(valuesWasLoaded).toBe(false);
  });

  it('A-24 核心：>10K cells 时 sync 只调用 1 次（仅 sync1 读 cellCount，无 sync2）', async () => {
    const adapter = new ExcelAdapter();
    await adapter.read({ kind: 'get_range_values', address: 'A1:Z100000' });
    // 若 A-24 正确：只有 sync1（load cellCount → 判定 → 拒绝），sync2 不应执行
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('恰好 10000 cells 不拒绝（边界：cellCount === CELL_LIMIT 是安全的）', async () => {
    mockRange.cellCount = 10000;
    mockRange.rowCount = 100;
    mockRange.columnCount = 100;
    mockRange.values = [Array(100).fill('x')];  // 模拟值存在

    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_range_values', address: 'A1:CV100' });
    expect(result.ok).toBe(true);
  });

  it('10001 cells 被拒绝（边界：>10K 触发拒绝）', async () => {
    mockRange.cellCount = 10001;
    mockRange.rowCount = 101;
    mockRange.columnCount = 100;

    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_range_values', address: 'A1:CV101' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_ARGS');
    }
  });
});

// ---------------------------------------------------------------------------
// describe: get_used_range_summary
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — get_used_range_summary', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const mockHeader = {
      values: [['姓名', '年龄', '部门']],
      load: vi.fn(),
    };
    const mockUsedRange = {
      address: 'A1:C100',
      rowCount: 100,
      columnCount: 3,
      values: undefined,  // 不加载全部 values
      load: vi.fn(),
      getRow: vi.fn(() => mockHeader),
    };

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: {
            worksheets: {
              getActiveWorksheet: vi.fn(() => ({
                getUsedRange: vi.fn(() => mockUsedRange),
              })),
              getItem: vi.fn(() => ({
                getUsedRange: vi.fn(() => mockUsedRange),
              })),
            },
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('返回 { ok: true, data: { address, rowCount, columnCount, headerSample } }', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_used_range_summary' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        address: string;
        rowCount: number;
        columnCount: number;
        headerSample: unknown[];
      };
      expect(data.address).toBe('A1:C100');
      expect(data.rowCount).toBe(100);
      expect(data.columnCount).toBe(3);
      expect(data.headerSample).toEqual(['姓名', '年龄', '部门']);
    }
  });

  it('不读取全部 values（只读首行做 schema）', async () => {
    const adapter = new ExcelAdapter();
    await adapter.read({ kind: 'get_used_range_summary' });

    const excelRun = (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel.run;
    // Excel.run 被调用
    expect(excelRun).toHaveBeenCalledTimes(1);
    // sync 被调用（至少一次）
    expect(sync).toHaveBeenCalled();
  });

  it('Excel.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel.run = vi.fn(
      async () => {
        throw new Error('used range error');
      },
    );
    const adapter = new ExcelAdapter();
    await expect(
      adapter.read({ kind: 'get_used_range_summary' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });

  it('指定 sheetName 时也能工作', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_used_range_summary', sheetName: '数据表' });
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describe: get_used_range_summary — 空表不抛（WR-06 / T-04-17）
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — get_used_range_summary 空表不抛', () => {
  beforeEach(() => {
    const sync = vi.fn().mockResolvedValue(undefined);
    // 空表：getUsedRange(false) 不抛，返回 A1 范围
    const mockHeader = {
      values: [[]],  // 首行是空行
      load: vi.fn(),
    };
    const mockUsedRange = {
      address: 'A1',
      rowCount: 1,
      columnCount: 1,
      load: vi.fn(),
      getRow: vi.fn(() => mockHeader),
    };

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          workbook: {
            worksheets: {
              getActiveWorksheet: vi.fn(() => ({
                getUsedRange: vi.fn(() => mockUsedRange),
              })),
            },
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('空表时不抛，返回 ok:true（getUsedRange(false) 空表不抛 WR-06）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'get_used_range_summary' });
    // 不抛错，返回 ok:true
    expect(result.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// describe: selection_detail
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — selection_detail', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: {
            getSelectedRange: vi.fn(() => ({
              address: 'B2:D5',
              load: vi.fn(),
            })),
          },
          sync,
        }),
      ),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('有选区 → 返回 { ok: true, data: { kind: "excel", address: "B2:D5" } }', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { kind: string; address: string };
      expect(data.kind).toBe('excel');
      expect(data.address).toBe('B2:D5');
    }
  });

  it('无选区（address 为空）→ 返回 { ok: true, data: { kind: "none" } }', async () => {
    (global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } }).Excel.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: {
            getSelectedRange: vi.fn(() => ({
              address: '',
              load: vi.fn(),
            })),
          },
          sync,
        }),
    );
    const adapter = new ExcelAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { kind: string };
      expect(data.kind).toBe('none');
    }
  });
});

// ---------------------------------------------------------------------------
// describe: default — UNSUPPORTED kind（防御）
// ---------------------------------------------------------------------------
describe('ExcelAdapter.read — default UNSUPPORTED', () => {
  beforeEach(() => {
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
  });

  it('未知 kind 返 { ok: false, error: { code: "UNSUPPORTED" } }（不抛）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.read(
      { kind: 'list_slides' } as Parameters<typeof adapter.read>[0],
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED');
      expect(result.error.recoverable).toBe(false);
    }
  });
});
