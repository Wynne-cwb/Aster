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

/** BGR helper（镜像 adapter）：#RRGGBB → BGR long，供 mock 断言。 */
function hexToBgr(hex: string): number {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  return (b << 16) | (g << 8) | r;
}

interface CellState {
  numberFormat?: unknown;
  interiorColor?: number;
  fontBold?: boolean;
  fontColor?: number;
  fontSize?: number;
  fontName?: string;
  hAlign?: number;
}

interface MockStore {
  cells: Record<string, unknown[][]>;
  /** 记录所有 Value2 写入（断言写发生）。 */
  writes: Array<{ key: string; values: unknown }>;
  /** 每区域格式状态（format_excel_range 守门）。 */
  fmt: Record<string, CellState>;
  /** 列宽/行高。 */
  colWidth: Record<number, number>;
  rowHeight: Record<number, number>;
  /** 工作表名集合（manage_worksheet 守门）。 */
  sheetNames: string[];
  /** 表格集合（create_table 守门）。 */
  tables: string[];
  /** 图表：name → title（insert_chart/set_chart_title 守门）。 */
  charts: Record<string, string>;
  /** 合并区域集合。 */
  merged: Set<string>;
  /** 透视表集合。 */
  pivots: string[];
  autoFilterMode: boolean;
}

function mockWpsExcel(initial: Record<string, unknown[][]>): MockStore {
  const store: MockStore = {
    cells: { ...initial },
    writes: [],
    fmt: {},
    colWidth: {},
    rowHeight: {},
    sheetNames: ['Sheet1'],
    tables: [],
    charts: {},
    merged: new Set(),
    pivots: [],
    autoFilterMode: false,
  };
  let chartSeq = 0;

  const colLetterToIdx = (addr: string): number | null => {
    const m = /^([A-Za-z]+):/.exec(addr);
    if (!m) return null;
    let n = 0;
    for (const ch of m[1].toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const rowToIdx = (addr: string): number | null => {
    const m = /^(\d+):/.exec(addr);
    return m ? parseInt(m[1], 10) - 1 : null;
  };

  const makeRange = (address: string): WpsRange => {
    const key = normKey(address);
    const fmtState = (store.fmt[key] ??= {});
    const values = store.cells[key] ?? [[null]];
    const cols = Array.isArray(values?.[0]) ? values[0].length : 1;
    const range = {
      get Value2(): unknown {
        const v = store.cells[key] ?? [[null]];
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
      Address: toAbsolute(address),
      get Count(): number {
        const v = store.cells[key] ?? [[null]];
        return v.length * (v[0]?.length ?? 1);
      },
      Rows: {
        get Count(): number { return (store.cells[key] ?? [[null]]).length; },
      },
      Columns: {
        get Count(): number { return (store.cells[key] ?? [[null]])[0]?.length ?? cols; },
        Item: (_i: number) => makeRange(address),
      },
      Cells: (_r?: number, _c?: number) => makeRange(address),
      // 自动筛选（VBA Range.AutoFilter 切换）
      AutoFilter() { store.autoFilterMode = true; },
      get CurrentRegion(): WpsRange {
        return makeRange(address);
      },
      Resize(_r: number, _c: number): WpsRange {
        return makeRange(address);
      },
      // ── 格式 ──
      get NumberFormat(): unknown { return fmtState.numberFormat ?? null; },
      set NumberFormat(v: unknown) { fmtState.numberFormat = v; },
      Interior: {
        get Color(): number { return fmtState.interiorColor ?? 0; },
        set Color(v: number) { fmtState.interiorColor = v; },
      },
      Font: {
        get Bold(): boolean { return fmtState.fontBold ?? false; },
        set Bold(v: boolean) { fmtState.fontBold = v; },
        get Color(): number { return fmtState.fontColor ?? 0; },
        set Color(v: number) { fmtState.fontColor = v; },
        get Size(): number { return fmtState.fontSize ?? 11; },
        set Size(v: number) { fmtState.fontSize = v; },
        get Name(): string { return fmtState.fontName ?? 'Calibri'; },
        set Name(v: string) { fmtState.fontName = v; },
      },
      get HorizontalAlignment(): number { return fmtState.hAlign ?? 1; },
      set HorizontalAlignment(v: number) { fmtState.hAlign = v; },
      // ── 列宽/行高 + AutoFit ──
      get ColumnWidth(): number {
        const idx = colLetterToIdx(address);
        return idx != null ? (store.colWidth[idx] ?? 8) : 8;
      },
      set ColumnWidth(v: number) {
        const idx = colLetterToIdx(address);
        if (idx != null) store.colWidth[idx] = v;
      },
      get RowHeight(): number {
        const idx = rowToIdx(address);
        return idx != null ? (store.rowHeight[idx] ?? 15) : 15;
      },
      set RowHeight(v: number) {
        const idx = rowToIdx(address);
        if (idx != null) store.rowHeight[idx] = v;
      },
      get EntireColumn(): WpsRange {
        return {
          AutoFit: () => {
            const idx = colLetterToIdx(address);
            if (idx != null) store.colWidth[idx] = 99; // autoFit 模拟值
          },
        } as unknown as WpsRange;
      },
      get EntireRow(): WpsRange {
        return {
          AutoFit: () => {
            const idx = rowToIdx(address);
            if (idx != null) store.rowHeight[idx] = 99;
          },
        } as unknown as WpsRange;
      },
      AutoFit() { /* no-op */ },
      // ── 合并 ──
      get MergeCells(): boolean { return store.merged.has(key); },
      set MergeCells(v: boolean) { if (v) store.merged.add(key); else store.merged.delete(key); },
      Merge(_across?: boolean) {
        store.merged.add(key);
        // VBA merge：清空非左上单元格（仅保留 [0][0]）
        const v = store.cells[key];
        if (v && v.length) {
          const topLeft = v[0]?.[0] ?? null;
          store.cells[key] = v.map((r, ri) => r.map((_c, ci) => (ri === 0 && ci === 0 ? topLeft : null)));
        }
      },
      UnMerge() { store.merged.delete(key); },
      // ── 排序 ──
      Sort() { store.writes.push({ key, values: 'SORTED' }); },
      // ── 查找替换 ──
      Replace(what: string, repl: string) {
        const v = store.cells[key];
        if (v) {
          store.cells[key] = v.map((row) => row.map((c) => (String(c) === what ? repl : c)));
        }
        return true;
      },
      // ── 删重 ──
      RemoveDuplicates(_cols: number[], _header: number) {
        const v = store.cells[key];
        if (v && v.length > 1) {
          // 简单去重（保留首次出现的行 JSON）
          const seen = new Set<string>();
          const kept = v.filter((row, i) => {
            if (i === 0) return true; // header
            const sig = JSON.stringify(row);
            if (seen.has(sig)) return false;
            seen.add(sig);
            return true;
          });
          store.cells[key] = kept;
        }
      },
      // ── 条件格式 ──
      FormatConditions: makeFormatConditions(key),
    };
    return range as unknown as WpsRange;
  };

  // 条件格式集合（每区域一份）
  const cfStore: Record<string, Array<Record<string, unknown>>> = {};
  function makeFormatConditions(key: string) {
    cfStore[key] ??= [];
    return {
      get Count(): number { return cfStore[key].length; },
      Item(i: number) {
        const e = cfStore[key][i - 1];
        return {
          Type: e.type, Operator: e.operator, Formula1: e.formula1, Formula2: e.formula2,
          Interior: { get Color() { return (e.fillColor as number) ?? 0; }, set Color(v: number) { e.fillColor = v; } },
          Font: { get Color() { return (e.fontColor as number) ?? 0; }, set Color(v: number) { e.fontColor = v; } },
        };
      },
      Add(type: number, operator?: number, formula1?: string, formula2?: string) {
        const e: Record<string, unknown> = { type, operator, formula1, formula2 };
        cfStore[key].push(e);
        return {
          Interior: { get Color() { return (e.fillColor as number) ?? 0; }, set Color(v: number) { e.fillColor = v; } },
          Font: { get Color() { return (e.fontColor as number) ?? 0; }, set Color(v: number) { e.fontColor = v; } },
        };
      },
      Delete() { cfStore[key] = []; },
    };
  }

  const listObjects = {
    get Count() { return store.tables.length; },
    Item(idx: number | string) {
      const name = typeof idx === 'string' ? idx : store.tables[idx - 1];
      if (!store.tables.includes(name)) throw new Error('ItemNotFound');
      return {
        get Name() { return name; },
        set Name(_v: string) { /* rename 后简化忽略 */ },
        Delete() { store.tables = store.tables.filter((t) => t !== name); },
      };
    },
    Add(_st: number, _src: unknown, _link: unknown, _hdr: number) {
      const name = `表${store.tables.length + 1}`;
      store.tables.push(name);
      let nm = name;
      return {
        get Name() { return nm; },
        set Name(v: string) {
          store.tables = store.tables.map((t) => (t === nm ? v : t));
          nm = v;
        },
        Delete() { store.tables = store.tables.filter((t) => t !== nm); },
      };
    },
  };

  const chartObjects = {
    get Count() { return Object.keys(store.charts).length; },
    Item(idx: number | string) {
      const name = typeof idx === 'string' ? idx : Object.keys(store.charts)[idx - 1];
      if (!(name in store.charts)) throw new Error('ItemNotFound');
      return makeChartObject(name);
    },
    Add(_l: number, _t: number, _w: number, _h: number) {
      const name = `图表 ${++chartSeq}`;
      store.charts[name] = '';
      return makeChartObject(name);
    },
  };
  function makeChartObject(name: string) {
    return {
      get Name() { return name; },
      set Name(_v: string) { /* simplified */ },
      Delete() { delete store.charts[name]; },
      Chart: {
        SetSourceData() { /* no-op */ },
        ChartType: 51,
        get HasTitle() { return store.charts[name] !== ''; },
        set HasTitle(v: boolean) { if (!v) store.charts[name] = ''; },
        ChartTitle: {
          get Text() { return store.charts[name]; },
          set Text(v: string) { store.charts[name] = v; },
        },
      },
    };
  }

  const activeSheet = {
    Name: 'Sheet1',
    Range: (addr: string) => makeRange(addr),
    UsedRange: makeRange('A1:B2'),
    Cells: makeRange('A1:B2'),
    get AutoFilterMode() { return store.autoFilterMode; },
    set AutoFilterMode(v: boolean) { store.autoFilterMode = v; },
    ListObjects: listObjects,
    ChartObjects: chartObjects,
    PivotTables(name?: string) {
      if (name && !store.pivots.includes(name)) throw new Error('ItemNotFound');
      return {
        get Name() { return name ?? ''; },
        set Name(_v: string) { /* simplified */ },
        TableRange2: {
          Clear() { store.pivots = store.pivots.filter((p) => p !== name); },
        } as unknown as WpsRange,
        PivotFields(_f: string) { return { Orientation: 0, Function: 0 }; },
      };
    },
    Delete() { /* sheet delete handled at worksheets level */ },
  } as unknown as WpsWorksheet;

  const worksheets = {
    get Count() { return store.sheetNames.length; },
    Item(i: number | string) {
      if (typeof i === 'string') {
        if (!store.sheetNames.includes(i)) throw new Error('ItemNotFound');
        return makeNamedSheet(i);
      }
      return makeNamedSheet(store.sheetNames[i - 1]);
    },
    Add() {
      const name = `Sheet${store.sheetNames.length + 1}`;
      store.sheetNames.push(name);
      return makeNamedSheet(name);
    },
    [Symbol.iterator]: function* () {
      for (const n of store.sheetNames) yield makeNamedSheet(n);
    },
  } as unknown as WpsWorksheets;

  function makeNamedSheet(name: string): WpsWorksheet {
    let nm = name;
    return {
      get Name() { return nm; },
      set Name(v: string) {
        store.sheetNames = store.sheetNames.map((s) => (s === nm ? v : s));
        nm = v;
      },
      Range: (addr: string) => makeRange(addr),
      UsedRange: makeRange('A1:B2'),
      Cells: makeRange('A1:B2'),
      get AutoFilterMode() { return store.autoFilterMode; },
      set AutoFilterMode(v: boolean) { store.autoFilterMode = v; },
      ListObjects: listObjects,
      ChartObjects: chartObjects,
      Delete() { store.sheetNames = store.sheetNames.filter((s) => s !== nm); },
    } as unknown as WpsWorksheet;
  }

  const workbook = {
    ActiveSheet: activeSheet,
    Worksheets: worksheets,
    PivotCaches() {
      return {
        Create(_st: number, _src: WpsRange) {
          return {
            CreatePivotTable(_dest: WpsRange, tableName?: string) {
              const name = tableName ?? 'Aster透视表';
              store.pivots.push(name);
              return {
                get Name() { return name; },
                set Name(_v: string) { /* simplified */ },
                PivotFields(_f: string) { return { Orientation: 0, Function: 0 }; },
                TableRange2: {
                  Clear() { store.pivots = store.pivots.filter((p) => p !== name); },
                } as unknown as WpsRange,
              };
            },
          };
        },
      };
    },
  };

  (globalThis as { Application?: WpsApplication }).Application = {
    ComponentType: 2,
    ActiveSheet: activeSheet,
    ActiveWorkbook: workbook,
    Worksheets: worksheets,
    Selection: makeRange('A1:B2'),
  } as unknown as WpsApplication;

  return store;
}

// 颜色 helper 暴露给测试断言
void hexToBgr;

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

// ---------------------------------------------------------------------------
// Phase 32 全 adapter parity：新增 13 写工具 × inverse 往返守门
// reverse.args 键名/tool 字符串 VERBATIM 对齐 src/agent/tools/write/excel.ts。
// ---------------------------------------------------------------------------

/** 小工具：构造 entry 并跑 replayUndoSingle，断言 rolled_back。 */
async function roundTrip(
  adapter: WpsExcelAdapter,
  toolName: string,
  reverse: { tool: string; args: Record<string, unknown> },
): Promise<string> {
  const detail = await replayUndoSingle(
    {
      runId: 'run-wps',
      stepIndex: 0,
      toolName,
      args: {},
      humanLabel: toolName,
      reverse,
      postState: { kind: 'excel_range', content: {} },
      timestamp: 0,
    },
    adapter as unknown as DocumentAdapterForReplay,
  );
  return detail.status;
}

describe('Phase 32 parity：新增工具 inverse 往返（投机预写·真机 pending）', () => {
  it('format_excel_range → restore_range_format：BGR 颜色双向转换 + 往返', async () => {
    const store = mockWpsExcel({ 'A1:B2': [['x', 'y'], ['z', 'w']] });
    const adapter = new WpsExcelAdapter();

    const { beforeImage } = await adapter.formatExcelRange('A1:B2', {
      fill: { color: '#FF0000' },
      font: { bold: true, color: '#0000FF' },
    });
    // before-image 颜色应是 #RRGGBB（默认 0 → #000000）
    expect(beforeImage.fillColor).toBe('#000000');
    expect(beforeImage.fontBold).toBe(false);
    // 写已生效：BGR(#FF0000) = 0x0000FF
    expect(store.fmt['A1:B2'].interiorColor).toBe(0x0000ff);
    expect(store.fmt['A1:B2'].fontColor).toBe(0xff0000); // BGR(#0000FF)

    const status = await roundTrip(adapter, 'format_excel_range', {
      tool: 'restore_range_format',
      args: { ...beforeImage },
    });
    expect(status).toBe('rolled_back');
    // 还原回默认（0）
    expect(store.fmt['A1:B2'].interiorColor).toBe(0);
    expect(store.fmt['A1:B2'].fontBold).toBe(false);
  });

  it('set_column_row_size → restore_column_row_size：列宽往返', async () => {
    const store = mockWpsExcel({});
    const adapter = new WpsExcelAdapter();
    store.colWidth[0] = 8;

    const { beforeSizes } = await adapter.setColumnRowSize('column', [0], 20);
    expect(beforeSizes).toEqual([{ index: 0, size: 8 }]);
    expect(store.colWidth[0]).toBe(20);

    const status = await roundTrip(adapter, 'set_column_row_size', {
      tool: 'restore_column_row_size',
      args: { target: 'column', beforeSizes },
    });
    expect(status).toBe('rolled_back');
    expect(store.colWidth[0]).toBe(8);
  });

  it('set_column_row_size autoFit：EntireColumn.AutoFit 路径', async () => {
    const store = mockWpsExcel({});
    const adapter = new WpsExcelAdapter();
    store.colWidth[0] = 8;
    const { beforeSizes } = await adapter.setColumnRowSize('column', [0], 'autoFit');
    expect(beforeSizes).toEqual([{ index: 0, size: 8 }]);
    expect(store.colWidth[0]).toBe(99); // autoFit 模拟值
  });

  it('set_auto_filter → restore_auto_filter：开/关往返', async () => {
    const store = mockWpsExcel({ 'A1:E1': [['a', 'b', 'c', 'd', 'e']] });
    const adapter = new WpsExcelAdapter();

    const { hadFilter, address } = await adapter.setAutoFilter('A1:E1', true);
    expect(hadFilter).toBe(false);
    expect(address).toBe('A1:E1');

    // hadFilter=false → restore 关闭
    const status = await roundTrip(adapter, 'set_auto_filter', {
      tool: 'restore_auto_filter',
      args: { hadFilter, address },
    });
    expect(status).toBe('rolled_back');
    expect(store.autoFilterMode).toBe(false);
  });

  it('add_conditional_format → restore_conditional_format：快照重建往返', async () => {
    const adapter = new WpsExcelAdapter();
    mockWpsExcel({ 'B2:B20': [[1]] });

    const { beforeFormats } = await adapter.addConditionalFormat('B2:B20', {
      type: 'cellValue',
      operator: 'greaterThan',
      value: 100,
      format: { fillColor: '#FFFF00' },
    });
    expect(beforeFormats).toEqual([]); // 原本无 CF

    const status = await roundTrip(adapter, 'add_conditional_format', {
      tool: 'restore_conditional_format',
      args: { address: 'B2:B20', beforeFormats },
    });
    expect(status).toBe('rolled_back');
  });

  it('create_table → delete_table_by_name：resolvedName 往返', async () => {
    const store = mockWpsExcel({ 'A1:D5': [[1]] });
    const adapter = new WpsExcelAdapter();

    const { resolvedName } = await adapter.createTable('A1:D5', true, '销售表');
    expect(resolvedName).toBe('销售表');
    expect(store.tables).toContain('销售表');

    const status = await roundTrip(adapter, 'create_table', {
      tool: 'delete_table_by_name',
      args: { tableName: resolvedName },
    });
    expect(status).toBe('rolled_back');
    expect(store.tables).not.toContain('销售表');
  });

  it('sort_range → restore_range_values_snapshot：快照往返', async () => {
    const store = mockWpsExcel({ 'A1:B3': [[3, 'c'], [1, 'a'], [2, 'b']] });
    const adapter = new WpsExcelAdapter();

    const { snapshot, snapshotAddress, tooLarge } = await adapter.sortRange('A1:B3', [
      { key: 0, ascending: true },
    ]);
    expect(tooLarge).toBe(false);
    expect(snapshot).toEqual([[3, 'c'], [1, 'a'], [2, 'b']]);

    const status = await roundTrip(adapter, 'sort_range', {
      tool: 'restore_range_values_snapshot',
      args: { address: snapshotAddress, snapshot },
    });
    expect(status).toBe('rolled_back');
    expect(store.cells['A1:B3']).toEqual([[3, 'c'], [1, 'a'], [2, 'b']]);
  });

  it('excel_find_and_replace → restore_range_values_snapshot：替换+快照往返+count', async () => {
    const store = mockWpsExcel({ 'A1:B2': [['foo', 'bar'], ['foo', 'baz']] });
    const adapter = new WpsExcelAdapter();

    const { snapshot, snapshotAddress, tooLarge, count } = await adapter.excelFindAndReplace(
      'foo', 'qux', 'A1:B2', false, false,
    );
    expect(tooLarge).toBe(false);
    expect(count).toBe(2); // best-effort 匹配计数
    expect(store.cells['A1:B2']).toEqual([['qux', 'bar'], ['qux', 'baz']]);

    const status = await roundTrip(adapter, 'excel_find_and_replace', {
      tool: 'restore_range_values_snapshot',
      args: { address: snapshotAddress, snapshot },
    });
    expect(status).toBe('rolled_back');
    expect(store.cells['A1:B2']).toEqual([['foo', 'bar'], ['foo', 'baz']]);
  });

  it('merge_cells → restore_merge_state：merge 清非左上值 + undo 还原', async () => {
    const store = mockWpsExcel({ 'A1:C1': [['标题', '保留?', '保留?']] });
    const adapter = new WpsExcelAdapter();

    const { snapshot, snapshotAddress, tooLarge } = await adapter.mergeCells('A1:C1', 'merge', false);
    expect(tooLarge).toBe(false);
    expect(snapshot).toEqual([['标题', '保留?', '保留?']]);
    expect(store.merged.has('A1:C1')).toBe(true);
    // merge 清了非左上值
    expect(store.cells['A1:C1']).toEqual([['标题', null, null]]);

    const status = await roundTrip(adapter, 'merge_cells', {
      tool: 'restore_merge_state',
      args: { address: snapshotAddress, operation: 'merge', across: false, snapshot },
    });
    expect(status).toBe('rolled_back');
    expect(store.merged.has('A1:C1')).toBe(false);
    expect(store.cells['A1:C1']).toEqual([['标题', '保留?', '保留?']]); // 值还原
  });

  it('remove_duplicates → restore_range_values_snapshot：HR-01 空 columns 展开 + 往返', async () => {
    const store = mockWpsExcel({
      'A1:B4': [['h1', 'h2'], ['a', 'b'], ['a', 'b'], ['c', 'd']],
    });
    const adapter = new WpsExcelAdapter();

    // columns 缺省 → 应展开为全列，不抛
    const { snapshot, snapshotAddress, tooLarge, removed, uniqueRemaining } =
      await adapter.removeDuplicatesRange('A1:B4', undefined, true);
    expect(tooLarge).toBe(false);
    expect(removed).toBe(1); // 一行重复被删
    expect(uniqueRemaining).toBe(3);

    const status = await roundTrip(adapter, 'remove_duplicates', {
      tool: 'restore_range_values_snapshot',
      args: { address: snapshotAddress, snapshot },
    });
    expect(status).toBe('rolled_back');
    expect(store.cells['A1:B4']).toEqual([['h1', 'h2'], ['a', 'b'], ['a', 'b'], ['c', 'd']]);
  });

  it('manage_worksheet add → restore_worksheet_snapshot 删表', async () => {
    const store = mockWpsExcel({});
    const adapter = new WpsExcelAdapter();

    const snap = await adapter.manageWorksheet('add', '新表');
    expect(snap.operation).toBe('add');
    const addedName = (snap as { sheetName: string }).sheetName;
    expect(store.sheetNames).toContain(addedName);

    const status = await roundTrip(adapter, 'manage_worksheet', {
      tool: 'restore_worksheet_snapshot',
      args: { ...snap },
    });
    expect(status).toBe('rolled_back');
    expect(store.sheetNames).not.toContain(addedName);
  });

  it('manage_worksheet rename → restore_worksheet_snapshot 改回 oldName', async () => {
    const store = mockWpsExcel({});
    const adapter = new WpsExcelAdapter();

    const snap = await adapter.manageWorksheet('rename', 'Sheet1', '汇总');
    expect(snap).toEqual({ operation: 'rename', oldName: 'Sheet1', newName: '汇总' });
    expect(store.sheetNames).toContain('汇总');

    const status = await roundTrip(adapter, 'manage_worksheet', {
      tool: 'restore_worksheet_snapshot',
      args: { ...snap },
    });
    expect(status).toBe('rolled_back');
    expect(store.sheetNames).toContain('Sheet1');
    expect(store.sheetNames).not.toContain('汇总');
  });

  it('insert_chart → delete_chart_by_name：往返', async () => {
    const store = mockWpsExcel({ 'A1:B10': [[1, 2]] });
    const adapter = new WpsExcelAdapter();

    const { chartName } = await adapter.insertChart('A1:B10', 'Pie');
    expect(chartName).toBe('图表 1');
    expect(store.charts[chartName]).toBe('');

    const status = await roundTrip(adapter, 'insert_chart', {
      tool: 'delete_chart_by_name',
      args: { chartName },
    });
    expect(status).toBe('rolled_back');
    expect(chartName in store.charts).toBe(false);
  });

  it('set_chart_title → restore_chart_title：往返', async () => {
    const store = mockWpsExcel({ 'A1:B10': [[1, 2]] });
    const adapter = new WpsExcelAdapter();
    // 先建一个图表
    const { chartName } = await adapter.insertChart('A1:B10', 'ColumnClustered');

    const { beforeTitle } = await adapter.setChartTitle(chartName, '季度销售');
    expect(beforeTitle).toBe('');
    expect(store.charts[chartName]).toBe('季度销售');

    const status = await roundTrip(adapter, 'set_chart_title', {
      tool: 'restore_chart_title',
      args: { chartName, beforeTitle },
    });
    expect(status).toBe('rolled_back');
    expect(store.charts[chartName]).toBe(''); // 标题清回
  });

  it('create_pivot_table → delete_pivot_table_by_name：往返', async () => {
    const store = mockWpsExcel({ 'A1:D50': [['地区', '部门', '季度', '销售额']] });
    const adapter = new WpsExcelAdapter();

    const { pivotTableName } = await adapter.createPivotTable({
      sourceRange: 'A1:D50',
      destination: 'F1',
      name: '透视1',
      rowFields: ['地区'],
      dataFields: ['销售额'],
    });
    expect(pivotTableName).toBe('透视1');
    expect(store.pivots).toContain('透视1');

    const status = await roundTrip(adapter, 'create_pivot_table', {
      tool: 'delete_pivot_table_by_name',
      args: { pivotTableName },
    });
    expect(status).toBe('rolled_back');
    expect(store.pivots).not.toContain('透视1');
  });

  it('sort_range tooLarge → noop_inverse 选择（>CELL_LIMIT）', async () => {
    const adapter = new WpsExcelAdapter();
    // 构造一个 Count > 10000 的区域
    const store = mockWpsExcel({});
    // 注入超大区域：mock 的 Count = rows*cols；写一个 200×60 的值
    const big = Array.from({ length: 200 }, () => Array.from({ length: 60 }, () => 0));
    store.cells['A1:BH200'] = big;

    const { tooLarge } = await adapter.sortRange('A1:BH200', [{ key: 0, ascending: true }]);
    expect(tooLarge).toBe(true);
    // 工具层据 tooLarge 选 noop_inverse；此处验 noop_inverse 走 executeReverse → skipped_error
    const status = await roundTrip(adapter, 'sort_range', {
      tool: 'noop_inverse',
      args: { reason: '区域过大' },
    });
    expect(status).toBe('skipped_error');
  });
});
