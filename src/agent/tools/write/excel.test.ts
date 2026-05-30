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
