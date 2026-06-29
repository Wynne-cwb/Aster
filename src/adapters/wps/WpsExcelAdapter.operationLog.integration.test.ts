/**
 * WpsExcelAdapter.operationLog.integration.test.ts — WPS Excel adapter × replay engine 集成守门
 *
 * 对位 src/agent/operationLog.integration.test.ts 的 Excel 段，但用 **真 WpsExcelAdapter 实例**
 * （mock window.Application 同步 VBA 风格），跑 replayUndoSingle / replayUndoAll，断言：
 *   1. setRangeValues → overwriteRange(Record) 往返还原（rolled_back，非 skipped_error）
 *   2. overwriteRange 能消费绝对 `$A$1` 格式地址（VBA Address gotcha 守门）
 *   3. 批量多写 → undo-all 逆序全部 rolled_back
 *
 * 守门意义（[[adapter-inverse-signature]] Phase 5 教训沿用）：inverse 必须收 Record 对象。
 * 若 WpsExcelAdapter.overwriteRange 改成位置参，本测试会立刻变红。
 *
 * ⚠️ 投机性预写：mock 行为是对 WPS VBA 语义的**推断**，真机以真机为准（[真机待验]）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WpsExcelAdapter } from './WpsExcelAdapter';
import {
  replayUndoSingle,
  replayUndoAll,
  appendOperation,
  __resetOperationLogForTest,
  type OperationLogEntry,
  type DocumentAdapterForReplay,
} from '../../agent/operationLog';

// ---------------------------------------------------------------------------
// mock window.Application（同步 VBA 风格 ET 对象模型）
// ---------------------------------------------------------------------------

/** 归一化地址作 store key（去 `$` 绝对符 → 'A1:B2'），模拟 WPS 中 $A$1 与 A1 指同一区域。 */
function normKey(address: string): string {
  return address.replace(/\$/g, '');
}

/** 转绝对格式（模拟 WPS Range.Address 返回 "$A$1:$B$2"）。 */
function toAbsolute(address: string): string {
  return address.replace(/([A-Za-z]+)(\d+)/g, '$$$1$$$2');
}

interface MockStore {
  cells: Record<string, unknown[][]>;
  /** 记录所有 Value2 写入（断言写发生）。 */
  writes: Array<{ key: string; values: unknown }>;
}

function mockWpsExcel(initial: Record<string, unknown[][]>): MockStore {
  const store: MockStore = { cells: { ...initial }, writes: [] };

  const makeRange = (address: string): WpsRange => {
    const key = normKey(address);
    const values = store.cells[key] ?? [[null]];
    const rows = Array.isArray(values) ? values.length : 1;
    const cols = Array.isArray(values?.[0]) ? values[0].length : 1;
    const range = {
      get Value2(): unknown {
        const v = store.cells[key] ?? [[null]];
        // VBA gotcha 模拟：单格返标量，多格返 2D 数组
        if (v.length === 1 && v[0].length === 1) return v[0][0];
        return v;
      },
      set Value2(v: unknown) {
        store.writes.push({ key, values: v });
        store.cells[key] = Array.isArray(v)
          ? (Array.isArray((v as unknown[])[0]) ? (v as unknown[][]) : [v as unknown[]])
          : [[v]];
      },
      get Formula(): unknown {
        return store.cells[key];
      },
      set Formula(v: unknown) {
        store.writes.push({ key, values: v });
        store.cells[key] = [[v]];
      },
      Address: toAbsolute(address), // ← 故意返回 $ 绝对格式，验 overwriteRange 能吃
      Count: rows * cols,
      Rows: { Count: rows },
      Columns: { Count: cols },
      get CurrentRegion(): WpsRange {
        return makeRange(address);
      },
      Resize(_r: number, _c: number): WpsRange {
        return makeRange(address);
      },
    };
    return range as unknown as WpsRange;
  };

  const activeSheet = {
    Name: 'Sheet1',
    Range: (addr: string) => makeRange(addr),
    UsedRange: makeRange('A1:B2'),
    Cells: makeRange('A1:B2'),
  } as unknown as WpsWorksheet;

  const worksheets = {
    Count: 1,
    Item: (_i: number | string) => activeSheet,
    [Symbol.iterator]: function* () {
      yield activeSheet;
    },
  } as unknown as WpsWorksheets;

  (globalThis as { Application?: WpsApplication }).Application = {
    ComponentType: 2,
    ActiveSheet: activeSheet,
    ActiveWorkbook: { ActiveSheet: activeSheet, Worksheets: worksheets },
    Worksheets: worksheets,
    Selection: makeRange('A1:B2'),
  } as unknown as WpsApplication;

  return store;
}

afterEach(() => {
  __resetOperationLogForTest();
  delete (globalThis as { Application?: WpsApplication }).Application;
});

describe('集成：replay engine × 真 WpsExcelAdapter（投机预写·真机 pending）', () => {
  it('setRangeValues → overwriteRange(Record) 往返还原 → rolled_back（含 $ 绝对地址消费）', async () => {
    const store = mockWpsExcel({ 'A1:B2': [['旧', '值'], ['x', 'y']] });
    const adapter = new WpsExcelAdapter();

    // 写：捕获 before-image（Address 为 $ 绝对格式）
    const { beforeImage } = await adapter.setRangeValues('A1:B2', [[1, 2], [3, 4]]);
    expect(beforeImage.address).toBe('$A$1:$B$2'); // 坐实 VBA Address gotcha
    expect(store.cells['A1:B2']).toEqual([[1, 2], [3, 4]]); // 写已生效

    // 撤销：reverse.args = before-image（Record 对象 + $ 地址）
    const entry: OperationLogEntry = {
      runId: 'run-wps',
      stepIndex: 0,
      toolName: 'set_range_values',
      args: { address: 'A1:B2', values: [[1, 2], [3, 4]] },
      humanLabel: '写入 A1:B2',
      reverse: { tool: 'overwrite_range', args: { address: beforeImage.address, values: beforeImage.values } },
      postState: { kind: 'excel_range', content: { address: 'A1:B2', values: [[1, 2], [3, 4]] } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    // Record 签名被正确消费 → rolled_back（位置参会抛 → skipped_error）
    expect(detail.status).toBe('rolled_back');
    // $ 绝对地址经 resolveWpsRange 归一化后命中同一区域 → 还原成功
    expect(store.cells['A1:B2']).toEqual([['旧', '值'], ['x', 'y']]);
  });

  it('setCell → overwriteRange 往返：单格标量读 → 规范化 2D before-image → 还原', async () => {
    const store = mockWpsExcel({ A1: [['原值']] });
    const adapter = new WpsExcelAdapter();

    const { beforeImage } = await adapter.setCell('A1', '新值');
    expect(beforeImage.values).toEqual([['原值']]); // 单格标量被规范化成 2D
    expect(store.cells['A1']).toEqual([['新值']]);

    const detail = await replayUndoSingle(
      {
        runId: 'run-wps',
        stepIndex: 0,
        toolName: 'set_cell',
        args: { cell: 'A1', value: '新值' },
        humanLabel: '写 A1',
        reverse: { tool: 'overwrite_range', args: { address: beforeImage.address, values: beforeImage.values } },
        postState: { kind: 'excel_range', content: { address: 'A1', values: [['新值']] } },
        timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );

    expect(detail.status).toBe('rolled_back');
    expect(store.cells['A1']).toEqual([['原值']]);
  });

  it('undo-all：批量 3 写 → 逆序全部 rolled_back', async () => {
    const store = mockWpsExcel({ A1: [['a']], A2: [['b']], A3: [['c']] });
    const adapter = new WpsExcelAdapter();

    const cells: Array<[string, string]> = [['A1', 'x'], ['A2', 'y'], ['A3', 'z']];
    for (let i = 0; i < cells.length; i++) {
      const [cell, val] = cells[i];
      const { beforeImage } = await adapter.setCell(cell, val);
      appendOperation({
        runId: 'run-wps',
        stepIndex: i,
        toolName: 'set_cell',
        args: { cell, value: val },
        humanLabel: `写 ${cell}`,
        reverse: { tool: 'overwrite_range', args: { address: beforeImage.address, values: beforeImage.values } },
        postState: { kind: 'excel_range', content: { address: cell, values: [[val]] } },
        timestamp: i,
      });
    }

    const result = await replayUndoAll('run-wps', adapter as unknown as DocumentAdapterForReplay);

    expect(result.total).toBe(3);
    expect(result.rolledBack).toBe(3);
    expect(result.skippedHostError).toBe(0);
    // 全部还原
    expect(store.cells['A1']).toEqual([['a']]);
    expect(store.cells['A2']).toEqual([['b']]);
    expect(store.cells['A3']).toEqual([['c']]);
  });
});
