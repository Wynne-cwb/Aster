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
