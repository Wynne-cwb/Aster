/**
 * src/agent/tools/write/excel.test.ts — Phase 6 Wave 2 激活
 *
 * 覆盖 ExcelAdapter 4 个新方法的核心行为：
 *   - insertChart：返回 chartName（Excel 分配的稳定句柄）
 *   - deleteChartByName：Record 签名守门；chart 不存在时静默跳过（getItemOrNullObject）
 *   - applyFormula：before-image before-image 两 sync 范式；返回 beforeImage.address+values
 *   - setCell：同 applyFormula 范式，写 values 而非 formulas
 *
 * Analog 来源：
 *   - src/agent/operationLog.integration.test.ts（Excel mock 范式 lines 47-68）
 *   - src/adapters/ExcelAdapter.ts（setRangeValues/overwriteRange 完整范式）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExcelAdapter } from '../../../adapters/ExcelAdapter';
import { createPivotTableTool } from './excel';
import type { ToolExecContext } from '../index';

// ---------------------------------------------------------------------------
// Mock 工厂（仿 operationLog.integration.test.ts lines 47-68）
// ---------------------------------------------------------------------------

function makeRange(opts: {
  address?: string;
  values?: unknown[][];
  formulas?: unknown[][];
}) {
  return {
    load: vi.fn(),
    address: opts.address ?? 'Sheet1!A1',
    get values(): unknown[][] { return opts.values ?? [['旧值']]; },
    set values(_v: unknown[][]) {},
    get formulas(): unknown[][] { return opts.formulas ?? [['旧公式']]; },
    set formulas(_v: unknown[][]) {},
  };
}

function mockExcelWithChart(chartName: string): void {
  const chart = {
    load: vi.fn(),
    name: chartName,
    isNullObject: false,
    delete: vi.fn(),
  };
  const range = makeRange({ address: 'Sheet1!A1:B5', values: [['v1', 'v2']] });
  const sheet = {
    getRange: vi.fn(() => range),
    charts: {
      add: vi.fn(() => chart),
      getItemOrNullObject: vi.fn(() => chart),
    },
  };
  (global as unknown as Record<string, unknown>).Excel = {
    ChartType: { ColumnClustered: 'ColumnClustered' },
    ChartSeriesBy: { auto: 'auto' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => sheet } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

function mockExcelChartNullObject(): void {
  // chart 已不存在（undo 重放场景）
  const chart = {
    load: vi.fn(),
    isNullObject: true,
    delete: vi.fn(),
  };
  const sheet = {
    getRange: vi.fn(),
    charts: {
      getItemOrNullObject: vi.fn(() => chart),
    },
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => sheet } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

function mockExcelForFormula(opts?: { address?: string; values?: unknown[][] }): void {
  const range = makeRange({
    address: opts?.address ?? 'Sheet1!A1',
    values: opts?.values ?? [['旧值']],
  });
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => ({ getRange: () => range }) } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

// ---------------------------------------------------------------------------
// insertChart
// ---------------------------------------------------------------------------

describe('ExcelAdapter.insertChart — Wave 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelWithChart('图表 1');
  });

  it('返回 { chartName } — Excel 分配的稳定句柄', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.insertChart('A1:B5', 'ColumnClustered');
    expect(result).toEqual({ chartName: '图表 1' });
  });

  it('charts.add 被调用（proxy 在闭包内消费）', async () => {
    const adapter = new ExcelAdapter();
    await adapter.insertChart('A1:B5', 'ColumnClustered');
    const excelMock = (global as unknown as Record<string, { run: ReturnType<typeof vi.fn> }>).Excel;
    expect(excelMock.run).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// deleteChartByName — inverse Record 签名守门
// ---------------------------------------------------------------------------

describe('ExcelAdapter.deleteChartByName — inverse Record 签名守门（Wave 2）', () => {
  it('以 Record 对象调用 → 不抛（chart 存在时删除）', async () => {
    vi.clearAllMocks();
    mockExcelWithChart('图表 1');
    const adapter = new ExcelAdapter();
    await expect(adapter.deleteChartByName({ chartName: '图表 1' })).resolves.not.toThrow();
  });

  it('chart 不存在（isNullObject=true）→ 静默跳过，不抛', async () => {
    vi.clearAllMocks();
    mockExcelChartNullObject();
    const adapter = new ExcelAdapter();
    // 静默跳过：不调 delete，不抛
    await expect(adapter.deleteChartByName({ chartName: '不存在的图表' })).resolves.toBeUndefined();
  });

  it('chart 不存在时 delete 不被调用（getItemOrNullObject guard）', async () => {
    vi.clearAllMocks();
    mockExcelChartNullObject();
    const adapter = new ExcelAdapter();
    await adapter.deleteChartByName({ chartName: '不存在的图表' });
    const excelGlobal = global as unknown as { Excel: { run: ReturnType<typeof vi.fn> } };
    // Excel.run 调用一次（进入 try/catch），但 delete 不调用（isNullObject=true）
    expect(excelGlobal.Excel.run).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// applyFormula — before-image 两 sync 范式
// ---------------------------------------------------------------------------

describe('ExcelAdapter.applyFormula — Wave 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelForFormula({ address: 'Sheet1!B2', values: [['旧值']] });
  });

  it('返回 beforeImage.address（Excel server 端规范化地址）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.applyFormula('B2', '=SUM(A1:A10)');
    expect(result.beforeImage.address).toBe('Sheet1!B2');
  });

  it('返回 beforeImage.values（写入前的单元格值）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.applyFormula('B2', '=SUM(A1:A10)');
    expect(result.beforeImage.values).toEqual([['旧值']]);
  });

  it('返回形状符合 overwriteRange 所需 Record 对象结构', async () => {
    const adapter = new ExcelAdapter();
    const { beforeImage } = await adapter.applyFormula('B2', '=SUM(A1:A10)');
    // overwriteRange args 守门：含 address + values
    expect(typeof beforeImage.address).toBe('string');
    expect(Array.isArray(beforeImage.values)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// setCell — 与 applyFormula 相同结构，写 values 而非 formulas
// ---------------------------------------------------------------------------

describe('ExcelAdapter.setCell — Wave 2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelForFormula({ address: 'Sheet1!A1', values: [['旧值']] });
  });

  it('返回 beforeImage.address', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.setCell('A1', '新值');
    expect(result.beforeImage.address).toBe('Sheet1!A1');
  });

  it('返回 beforeImage.values（写入前的单元格值）', async () => {
    const adapter = new ExcelAdapter();
    const result = await adapter.setCell('A1', 42);
    expect(result.beforeImage.values).toEqual([['旧值']]);
  });

  it('返回形状符合 overwriteRange 所需 Record 对象结构', async () => {
    const adapter = new ExcelAdapter();
    const { beforeImage } = await adapter.setCell('A1', true);
    expect(typeof beforeImage.address).toBe('string');
    expect(Array.isArray(beforeImage.values)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MR-01 守门：create_pivot_table 失败路径不返回 reverse/postState（无幻影 DiffLog 条目）
// loop-helpers.appendOperation 门控是 `if (result.reverse && def)`（不判 result.ok）——
// 失败若仍带 reverse 会在 operationLog 留「无法自动撤销」的幻影条目，但实际什么都没建成。
// 故失败的 pivot 必须返回 ok:false 且 reverse/postState 均 undefined（与 remove_duplicates 约定一致）。
// ---------------------------------------------------------------------------

describe('createPivotTableTool — MR-01 失败路径无幻影撤销条目守门', () => {
  function makeFailingCtx(): ToolExecContext {
    return {
      adapter: {
        createPivotTable: vi.fn(async () => {
          throw new Error('当前 Excel 版本不支持创建数据透视表（需要 ExcelApi 1.8）');
        }),
      } as unknown as ToolExecContext['adapter'],
      runId: 'run-mr01',
      stepIndex: 0,
      signal: new AbortController().signal,
    };
  }

  it('createPivotTable 抛错 → ok:false 且不带 reverse/postState（appendOperation 据此跳过 → 无幻影条目）', async () => {
    const result = await createPivotTableTool.execute(
      { source_range: 'A1:D50', destination: 'F1' },
      makeFailingCtx(),
    );
    expect(result.ok).toBe(false);
    // 硬门：失败路径绝不带 reverse（否则进 operationLog 留幻影「无法自动撤销」条目）
    expect(result.reverse).toBeUndefined();
    // 硬门：失败路径不带 postState（同时消除 LR-04 的 tooLarge:true 语义错配）
    expect(result.postState).toBeUndefined();
    // 仍诚实透出错误信息供 LLM/用户感知
    expect((result.data as { error: string }).error).toContain('ExcelApi 1.8');
  });

  it('成功路径仍返回 delete_pivot_table_by_name reverse（对照：仅失败路径去 reverse）', async () => {
    const ctx: ToolExecContext = {
      adapter: {
        createPivotTable: vi.fn(async () => ({ pivotTableName: 'Aster透视表' })),
      } as unknown as ToolExecContext['adapter'],
      runId: 'run-mr01-ok',
      stepIndex: 0,
      signal: new AbortController().signal,
    };
    const result = await createPivotTableTool.execute(
      { source_range: 'A1:D50', destination: 'F1' },
      ctx,
    );
    expect(result.ok).toBe(true);
    expect(result.reverse?.tool).toBe('delete_pivot_table_by_name');
    expect(result.reverse?.args).toEqual({ pivotTableName: 'Aster透视表' });
  });
});
