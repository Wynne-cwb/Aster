/**
 * src/agent/tools/write/excel.test.ts — Phase 6 Wave 0 测试桩
 *
 * 覆盖 3 个 Excel write tool 的 inverse descriptor 形状：
 *   - insert_chart：reverse.tool === 'delete_chart_by_name'，reverse.args 含 chartName（Record 对象）
 *   - apply_formula：reverse.tool === 'overwrite_range'，reverse.args 含 address+values（Record 对象）
 *   - set_cell：同 apply_formula 范式（Record 对象）
 *
 * Wave 0 说明：
 *   - Wave 2 实现就位前，以 describe.skip 包裹，保证 npm test 不因模块缺失而 ERROR
 *   - Wave 2 实现后取消 skip，跑真正 RED→GREEN 节奏
 *
 * Analog 来源：
 *   - src/agent/operationLog.integration.test.ts（Excel mock 范式 lines 47-68）
 *   - src/agent/tools/write/excel.ts（setRangeValues 完整范式，模板）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock 工厂（仿 operationLog.integration.test.ts lines 47-68）
// ---------------------------------------------------------------------------

function mockExcelWithChart(chartName: string): void {
  const chart = {
    load: vi.fn(),
    name: chartName,
  };
  const sheet = {
    getRange: () => ({
      load: vi.fn(),
      address: 'Sheet1!A1:B2',
      get values(): unknown[][] { return [['旧值', '旧值2']]; },
      set values(_v: unknown[][]) {},
      get formulas(): unknown[][] { return [['旧公式']]; },
      set formulas(_v: unknown[][]) {},
    }),
    charts: {
      add: vi.fn(() => chart),
      getItemOrNullObject: vi.fn(() => ({ load: vi.fn(), isNullObject: false, delete: vi.fn() })),
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

function mockExcelForFormula(): void {
  const range = {
    load: vi.fn(),
    address: 'Sheet1!A1',
    get values(): unknown[][] { return [['旧值']]; },
    set values(_v: unknown[][]) {},
    get formulas(): unknown[][] { return [['旧公式']]; },
    set formulas(_v: unknown[][]) {},
  };
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
// Wave 2 解锁后取消 describe.skip
// ---------------------------------------------------------------------------

// insert_chart：Wave 2 实现后解锁
describe.skip('insert_chart — Wave 2 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelWithChart('图表 1');
  });

  it('execute 返回 reverse.tool === "delete_chart_by_name"', async () => {
    // 注：Wave 2 实现后从 './excel' 导入 insertChart
    // import { insertChart } from './excel';
    //
    // const mockAdapter = {
    //   insertChart: vi.fn().mockResolvedValue({ chartName: '图表 1' }),
    //   capabilities: () => ({ host: 'excel' as const }),
    // };
    // const ctx = { adapter: mockAdapter };
    // const result = await insertChart.execute({ data_range: 'A1:B5', chart_type: 'ColumnClustered' }, ctx as never);
    //
    // expect(result.ok).toBe(true);
    // expect(result.reverse?.tool).toBe('delete_chart_by_name');
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('reverse.args 是 Record 对象，含 chartName 字段', async () => {
    // 关键：Record 对象守门（非位置参）
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({ chartName: '图表 1' });
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('mutated 含 chartName', async () => {
    // expect(result.data).toMatchObject({ chartName: '图表 1' });
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// apply_formula：Wave 2 实现后解锁
describe.skip('apply_formula — Wave 2 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelForFormula();
  });

  it('execute 返回 reverse.tool === "overwrite_range"', async () => {
    // import { applyFormula } from './excel';
    //
    // const mockAdapter = {
    //   applyFormula: vi.fn().mockResolvedValue({
    //     beforeImage: { address: 'Sheet1!A1', values: [['旧值']] },
    //   }),
    //   capabilities: () => ({ host: 'excel' as const }),
    // };
    // const ctx = { adapter: mockAdapter };
    // const result = await applyFormula.execute({ cell: 'A1', formula: '=SUM(B1:B5)' }, ctx as never);
    //
    // expect(result.reverse?.tool).toBe('overwrite_range');
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('reverse.args 是 Record 对象，含 address+values（before-image）', async () => {
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   address: expect.any(String),
    //   values: expect.any(Array),
    // });
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// set_cell：Wave 2 实现后解锁
describe.skip('set_cell — Wave 2 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExcelForFormula();
  });

  it('execute 返回 reverse.tool === "overwrite_range"', async () => {
    // import { setCell } from './excel';
    //
    // const mockAdapter = {
    //   setCell: vi.fn().mockResolvedValue({
    //     beforeImage: { address: 'Sheet1!A1', values: [['旧值']] },
    //   }),
    //   capabilities: () => ({ host: 'excel' as const }),
    // };
    // const ctx = { adapter: mockAdapter };
    // const result = await setCell.execute({ cell: 'A1', value: '新值' }, ctx as never);
    //
    // expect(result.reverse?.tool).toBe('overwrite_range');
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('reverse.args 是 Record 对象，含 address+values（before-image）', async () => {
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   address: expect.any(String),
    //   values: expect.any(Array),
    // });
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// delete_chart_by_name（inverse 方法守门）：Wave 2 实现后解锁
describe.skip('delete_chart_by_name — inverse Record 签名守门（Wave 2）', () => {
  it('以 Record 对象调用 → 不抛（非位置参）', async () => {
    // import { ExcelAdapter } from '../../../adapters/ExcelAdapter';
    // mockExcelWithChart('图表 1');
    // const adapter = new ExcelAdapter();
    // await expect(adapter.deleteChartByName({ chartName: '图表 1' })).resolves.not.toThrow();
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});
