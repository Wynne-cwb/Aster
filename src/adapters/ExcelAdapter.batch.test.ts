/**
 * src/adapters/ExcelAdapter.batch.test.ts — Phase 11 Wave 0 Nyquist 测试骨架（BATCH-01 集成 RED）
 *
 * 测试 ExcelAdapter.executeBatch 的单闭包 sync 计数和 fail-fast 行为。
 * executeBatch 在 Wave 2 才实现；此处为 RED 骨架（方法不存在时 vitest 报 FAIL）。
 * Wave 2 实现 executeBatch 后，这些测试从 RED 变绿。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ExcelAdapter } from './ExcelAdapter';

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).Excel;
  vi.restoreAllMocks();
});

/** 构造 mock Excel 环境，返回 syncCalls 数组（记录每次 sync 时间戳）和 setValuesMock */
function mockExcelForBatch(syncCalls: number[]): { setValues: ReturnType<typeof vi.fn> } {
  const setValues = vi.fn();
  const makeRange = (isNull = false) => ({
    load: vi.fn(),
    isNullObject: isNull,
    address: 'Sheet1!A1',
    get values(): unknown[][] { return [[0]]; },
    set values(v: unknown[][]) { setValues(v); },
  });
  const activeWorksheet = {
    getRangeOrNullObject: vi.fn((addr: string) =>
      addr === 'INVALID_ADDR' ? makeRange(true) : makeRange(false)
    ),
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => activeWorksheet } },
        sync: vi.fn(async () => { syncCalls.push(Date.now()); }),
      })
    ),
  };
  return { setValues };
}

describe('ExcelAdapter.executeBatch — 单闭包 sync 计数（D-01）', () => {
  it('3 个有效 op → ctx.sync 只调用 2 次（Phase1 + Phase2），非 6 次', async () => {
    const syncCalls: number[] = [];
    mockExcelForBatch(syncCalls);
    const adapter = new ExcelAdapter();

    // executeBatch 在 Wave 2 才实现；此处 RED（方法不存在）
    await (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
      { tool: 'set_range_values', args: { address: 'A1', values: [[1]] }, humanLabel: '写入 A1' },
      { tool: 'set_range_values', args: { address: 'A2', values: [[2]] }, humanLabel: '写入 A2' },
      { tool: 'set_range_values', args: { address: 'A3', values: [[3]] }, humanLabel: '写入 A3' },
    ]);

    expect(syncCalls.length).toBe(2); // Phase 1（读）+ Phase 2（写）
  });
});

describe('ExcelAdapter.executeBatch — fail-fast 部分完成（D-03）', () => {
  it('第 2 个 op range 不存在 → failAtIndex=1，subOps 只含第 0 个', async () => {
    const syncCalls: number[] = [];
    mockExcelForBatch(syncCalls);
    const adapter = new ExcelAdapter();

    const result = await (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
      { tool: 'set_range_values', args: { address: 'A1', values: [[1]] }, humanLabel: '写入 A1' },
      { tool: 'set_range_values', args: { address: 'INVALID_ADDR', values: [[2]] }, humanLabel: '写入无效地址' },
      { tool: 'set_range_values', args: { address: 'A3', values: [[3]] }, humanLabel: '写入 A3' },
    ]) as { subOps: unknown[]; failAtIndex?: number };

    expect(result.failAtIndex).toBe(1);    // 第 2 个 op（index=1）失败
    expect(result.subOps.length).toBe(1); // 只有第 0 个成功
  });
});

// ---------------------------------------------------------------------------
// BUG 1 守门：apply_formula / set_cell / 不支持工具 fail-fast
// ---------------------------------------------------------------------------

/** 构造支持 formulas setter 的 mock Excel 环境 */
function mockExcelForBatchWithFormulas(syncCalls: number[]): {
  setValues: ReturnType<typeof vi.fn>;
  setFormulas: ReturnType<typeof vi.fn>;
} {
  const setValues = vi.fn();
  const setFormulas = vi.fn();
  const makeRange = (isNull = false) => ({
    load: vi.fn(),
    isNullObject: isNull,
    address: 'Sheet1!A1',
    get values(): unknown[][] { return [[0]]; },
    set values(v: unknown[][]) { setValues(v); },
    get formulas(): unknown[][] { return [[0]]; },
    set formulas(v: unknown[][]) { setFormulas(v); },
  });
  const activeWorksheet = {
    getRangeOrNullObject: vi.fn((_addr: string) => makeRange(false)),
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => activeWorksheet } },
        sync: vi.fn(async () => { syncCalls.push(Date.now()); }),
      })
    ),
  };
  return { setValues, setFormulas };
}

describe('ExcelAdapter.executeBatch — apply_formula 分派（BUG 1）', () => {
  it('apply_formula op → completed 1，formulas 被写入，reverse.args 是 Record', async () => {
    const syncCalls: number[] = [];
    const { setFormulas } = mockExcelForBatchWithFormulas(syncCalls);
    const adapter = new ExcelAdapter();

    const result = await (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
      { tool: 'apply_formula', args: { cell: 'C2', formula: '=SUM(A1:A10)' }, humanLabel: '写公式' },
    ]) as {
      subOps: Array<{ humanLabel: string; reverse: { tool: string; args: Record<string, unknown> }; ok: boolean }>;
      failAtIndex?: number;
    };

    expect(result.subOps.length).toBe(1);
    expect(result.failAtIndex).toBeUndefined();
    expect(result.subOps[0].ok).toBe(true);
    // reverse.args 必须是 Record（project_adapter_inverse_signature 铁律）
    expect(result.subOps[0].reverse.args).toBeTruthy();
    expect(typeof result.subOps[0].reverse.args).toBe('object');
    expect('address' in result.subOps[0].reverse.args).toBe(true);
    expect('values' in result.subOps[0].reverse.args).toBe(true);
    // formulas setter 被调用
    expect(setFormulas).toHaveBeenCalledTimes(1);
    expect(setFormulas).toHaveBeenCalledWith([['=SUM(A1:A10)']]);
  });
});

describe('ExcelAdapter.executeBatch — set_cell 分派（BUG 1）', () => {
  it('set_cell op → completed 1，values 写为 [[value]]', async () => {
    const syncCalls: number[] = [];
    const { setValues } = mockExcelForBatchWithFormulas(syncCalls);
    const adapter = new ExcelAdapter();

    const result = await (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
      { tool: 'set_cell', args: { cell: 'A1', value: 42 }, humanLabel: '写单格' },
    ]) as { subOps: Array<{ ok: boolean }>; failAtIndex?: number };

    expect(result.subOps.length).toBe(1);
    expect(result.failAtIndex).toBeUndefined();
    expect(result.subOps[0].ok).toBe(true);
    expect(setValues).toHaveBeenCalledTimes(1);
    expect(setValues).toHaveBeenCalledWith([[42]]);
  });
});

describe('ExcelAdapter.executeBatch — 不支持工具 fail-fast（BUG 1）', () => {
  it('set_range_values ok + unknown_tool → failAtIndex=1，subOps 只含 index 0', async () => {
    const syncCalls: number[] = [];
    mockExcelForBatch(syncCalls);
    const adapter = new ExcelAdapter();

    const result = await (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
      { tool: 'set_range_values', args: { address: 'A1', values: [[1]] }, humanLabel: '写入 A1' },
      { tool: 'unknown_tool', args: {}, humanLabel: '不支持的工具' },
    ]) as { subOps: unknown[]; failAtIndex?: number };

    expect(result.failAtIndex).toBe(1);
    expect(result.subOps.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// BUG 2 守门：resolveRange sheet-qualified 地址解析（通过 setRangeValues 间接测试）
// ---------------------------------------------------------------------------

function makeRangeMock() {
  const setValues = vi.fn();
  return {
    load: vi.fn(),
    address: 'Sheet1!A1',
    get values(): unknown[][] { return [[0]]; },
    set values(v: unknown[][]) { setValues(v); },
    _setValues: setValues,
  };
}

describe('resolveRange — sheet-qualified 地址解析（BUG 2）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
    vi.restoreAllMocks();
  });

  it('裸地址 A1 → getActiveWorksheet().getRange("A1") 被调用', async () => {
    const getRange = vi.fn().mockReturnValue(makeRangeMock());
    const getActiveWorksheet = vi.fn().mockReturnValue({ getRange });
    const getItem = vi.fn();
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet, getItem } },
          sync: vi.fn(async () => {}),
        })
      ),
    };
    const adapter = new ExcelAdapter();
    await adapter.setRangeValues('A1', [[1]]);
    expect(getActiveWorksheet).toHaveBeenCalled();
    expect(getItem).not.toHaveBeenCalled();
    expect(getRange).toHaveBeenCalledWith('A1');
  });

  it('Sheet1!A1 → worksheets.getItem("Sheet1").getRange("A1") 被调用', async () => {
    const getRange = vi.fn().mockReturnValue(makeRangeMock());
    const getActiveWorksheet = vi.fn();
    const getItem = vi.fn().mockReturnValue({ getRange });
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet, getItem } },
          sync: vi.fn(async () => {}),
        })
      ),
    };
    const adapter = new ExcelAdapter();
    await adapter.setRangeValues('Sheet1!A1', [[1]]);
    expect(getActiveWorksheet).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledWith('Sheet1');
    expect(getRange).toHaveBeenCalledWith('A1');
  });

  it("'带 空格'!A1 → worksheets.getItem('带 空格').getRange('A1') 被调用（外层单引号剥除）", async () => {
    const getRange = vi.fn().mockReturnValue(makeRangeMock());
    const getActiveWorksheet = vi.fn();
    const getItem = vi.fn().mockReturnValue({ getRange });
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet, getItem } },
          sync: vi.fn(async () => {}),
        })
      ),
    };
    const adapter = new ExcelAdapter();
    await adapter.setRangeValues("'带 空格'!A1", [[1]]);
    expect(getActiveWorksheet).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledWith('带 空格');
    expect(getRange).toHaveBeenCalledWith('A1');
  });

  it("'O''Brien'!C3 → worksheets.getItem(\"O'Brien\").getRange('C3') 被调用（''→' 转义）", async () => {
    const getRange = vi.fn().mockReturnValue(makeRangeMock());
    const getActiveWorksheet = vi.fn();
    const getItem = vi.fn().mockReturnValue({ getRange });
    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          workbook: { worksheets: { getActiveWorksheet, getItem } },
          sync: vi.fn(async () => {}),
        })
      ),
    };
    const adapter = new ExcelAdapter();
    await adapter.setRangeValues("'O''Brien'!C3", [[1]]);
    expect(getActiveWorksheet).not.toHaveBeenCalled();
    expect(getItem).toHaveBeenCalledWith("O'Brien");
    expect(getRange).toHaveBeenCalledWith('C3');
  });
});
