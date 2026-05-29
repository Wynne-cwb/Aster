/**
 * src/adapters/ExcelAdapter.test.ts — Phase 5 Plan 01 Wave 0 inverse mock stubs
 *
 * 测试 setRangeValues + overwriteRange 方法（Wave 2 实现后变绿）。
 * Wave 0 阶段：方法未实现 → 用 it.todo 占位，编译通过，不报错。
 *
 * 设计：
 * - setRangeValues(address) → 读取当前值作 before-image 返 { address, values }
 * - overwriteRange(address, values) → 覆写回 before-image（undo 逆操作）
 *
 * Office.js 依赖全部 mock（不调真实 Excel API）。
 * 范式参照 WordAdapter.test.ts 的 Word.run mock 模式。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExcelAdapter } from './ExcelAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// Excel.run mock 辅助
// ---------------------------------------------------------------------------

function makeExcelRunMock(
  onRun: (ctx: unknown) => Promise<unknown>,
) {
  return vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => cb(await Promise.resolve({} as unknown)));
}

// ---------------------------------------------------------------------------
// setRangeValues + overwriteRange — Wave 2 inverse stubs
// ---------------------------------------------------------------------------

describe('ExcelAdapter setRangeValues + overwriteRange（Wave 2 inverse stubs）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Excel;
    vi.restoreAllMocks();
  });

  it.todo('setRangeValues 返回 before-image address + values（Wave 2 实现后展开）');
  // const mockValues = [['A1'], ['A2']];
  // (global as unknown as Record<string, unknown>).Excel = {
  //   run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
  //     cb({
  //       workbook: {
  //         worksheets: {
  //           getActiveWorksheet: () => ({
  //             getRange: (addr: string) => ({
  //               load: vi.fn(),
  //               values: mockValues,
  //               address: addr,
  //             }),
  //           }),
  //         },
  //       },
  //       sync: vi.fn().mockResolvedValue(undefined),
  //     }),
  //   ),
  // };
  // const adapter = new ExcelAdapter();
  // const beforeImage = await adapter.setRangeValues('A1:A2');
  // expect(beforeImage.address).toBe('A1:A2');
  // expect(beforeImage.values).toEqual(mockValues);

  it.todo('overwriteRange 覆写成功（Wave 2 实现后展开）');
  // const beforeImage = { address: 'A1:A2', values: [['oldA1'], ['oldA2']] };
  // (global as unknown as Record<string, unknown>).Excel = {
  //   run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
  //     const rangeObj = { load: vi.fn(), values: [] as unknown[][], address: 'A1:A2' };
  //     await cb({
  //       workbook: { worksheets: { getActiveWorksheet: () => ({ getRange: () => rangeObj }) } },
  //       sync: vi.fn().mockResolvedValue(undefined),
  //     });
  //     return rangeObj;
  //   }),
  // };
  // const adapter = new ExcelAdapter();
  // await expect(adapter.overwriteRange(beforeImage)).resolves.not.toThrow();

  it.todo('Excel.run 报错 → HostApiError（Wave 2 实现后展开）');
  // (global as unknown as Record<string, unknown>).Excel = {
  //   run: vi.fn(async () => { throw new Error('excel api error'); }),
  // };
  // const adapter = new ExcelAdapter();
  // await expect(adapter.setRangeValues('A1')).rejects.toBeInstanceOf(HostApiError);
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
