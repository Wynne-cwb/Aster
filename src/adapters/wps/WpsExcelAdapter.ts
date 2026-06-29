/**
 * src/adapters/wps/WpsExcelAdapter.ts — WPS 表格（金山表格/ET）adapter
 *
 * Phase 32 滩头堡首宿主（用户 2026-06-29 拍板）。核心 read/write/inverse。
 *
 * 接缝复用（loop.ts:54）：capabilities().host='excel' → buildToolsForHost('excel')
 * 复用全套 Office.js Excel 工具，它们调本类同名方法（setRangeValues/setCell/applyFormula/
 * overwriteRange/read/getSelection）。工具/dispatch/operationLog/undo 零改动。
 *
 * WPS JSAPI = 同步 VBA 风格（ARCHITECTURE Anti-Pattern 2）：
 * - 方法体同步调 window.Application.*，async 仅为满足 DocumentAdapter 接口签名 → Promise.resolve。
 * - **不**模仿 Office.js 的 *.run()/load/sync；**不**调 Office.isSetSupported（WPS 无 requirement set）。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29）：未经 Windows WPS 真机验证。
 *    [真机待验] 标注处 VBA 行为（Value2 标量/2D、Address $ 格式、错误语义）需真机坐实。
 */
import type {
  AdapterCapabilities,
  DocumentAdapter,
  InsertableContent,
  ReadableQuery,
  ReadableResult,
  SelectionContext,
} from '../DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../../errors';

// ---------------------------------------------------------------------------
// WPS ET（表格）VBA 对象模型增量声明（declaration merging）
//
// ⚠️ 不改共享 wps-jsapi.d.ts（用户中心合并）。本 adapter 用到的高级 VBA 成员
//    在此 `declare global` 块按需增补到已有全局接口（WpsRange/WpsWorksheet/
//    WpsWorkbook/WpsWorksheets）。全部 [真机待验]：据 Excel/ET VBA 对象模型
//    推断，桌面 wpsjs = 同步 VBA 风格，未经 Windows WPS 真机核对。
// ---------------------------------------------------------------------------
declare global {
  interface WpsRange {
    // ── 格式（format_excel_range）──────────────────────────────────────────
    /** [真机待验] VBA Range.NumberFormatLocal/NumberFormat：读多格可能返标量或 2D；写为标量字符串。 */
    NumberFormat: unknown;
    /** [真机待验] VBA Range.Interior（填充）。Color 为 BGR long 整数（非 #RRGGBB）。 */
    readonly Interior: WpsInterior;
    /** [真机待验] VBA Range.Font。Color 为 BGR long 整数。 */
    readonly Font: WpsFont;
    /** [真机待验] VBA Range.HorizontalAlignment（xlHAlign* 整数：-4131 左/-4108 中/-4152 右/1 常规）。 */
    HorizontalAlignment: number;
    /** [真机待验] VBA Range.ColumnWidth（字符单位）。 */
    ColumnWidth: number;
    /** [真机待验] VBA Range.RowHeight（点）。 */
    RowHeight: number;
    /** [真机待验] VBA Range.EntireColumn（整列），供 AutoFit。 */
    readonly EntireColumn: WpsRange;
    /** [真机待验] VBA Range.EntireRow（整行），供 AutoFit。 */
    readonly EntireRow: WpsRange;
    /** [真机待验] VBA Range.AutoFit（自适应列宽/行高）。 */
    AutoFit(): void;
    // ── 合并（merge_cells）─────────────────────────────────────────────────
    /** [真机待验] VBA Range.MergeCells：读 = 是否已合并；写 true 合并 / false 取消。 */
    MergeCells: boolean;
    /** [真机待验] VBA Range.Merge(Across)：Across=true 逐行合并。 */
    Merge(across?: boolean): void;
    /** [真机待验] VBA Range.UnMerge。 */
    UnMerge(): void;
    // ── 排序（sort_range）──────────────────────────────────────────────────
    /** [真机待验] VBA Range.Sort（位置参，xlAscending=1/xlDescending=2，Header xlYes=1/xlNo=2）。 */
    Sort(
      key1?: WpsRange,
      order1?: number,
      key2?: WpsRange,
      type?: unknown,
      order2?: number,
      key3?: WpsRange,
      order3?: number,
      header?: number,
    ): void;
    /** [真机待验] 取相对列 Range（Range.Columns.Item(i)），供 Sort key 定位。 */
    readonly Columns: { readonly Count: number; Item(index: number): WpsRange };
    readonly Rows: { readonly Count: number };
    /** [真机待验] VBA Range.Cells(row,col)（1-based），供按列偏移取 sort key 列。 */
    Cells(row?: number, col?: number): WpsRange;
    /** [真机待验] VBA Range.Replace（位置参，LookAt xlWhole=1/xlPart=2，MatchCase 布尔）。 */
    Replace(
      what: string,
      replacement: string,
      lookAt?: number,
      searchOrder?: number,
      matchCase?: boolean,
    ): boolean;
    /** [真机待验] VBA Range.RemoveDuplicates(Columns(1-based 数组), Header xlYes=1/xlNo=2)。 */
    RemoveDuplicates(columns: number[], header: number): void;
  }

  /** [真机待验] VBA Interior（填充）。 */
  interface WpsInterior {
    /** BGR long 整数（非 #RRGGBB）。 */
    Color: number;
  }

  /** [真机待验] VBA Font。 */
  interface WpsFont {
    Bold: boolean;
    /** BGR long 整数。 */
    Color: number;
    Size: number;
    Name: string;
  }

  interface WpsWorksheet {
    // ── 自动筛选（set_auto_filter）─────────────────────────────────────────
    /** [真机待验] VBA Worksheet.AutoFilterMode：读 = 是否已开筛选；写 false 关闭。 */
    AutoFilterMode: boolean;
    /** [真机待验] VBA Worksheet.AutoFilter（当前筛选对象，未开为 null/undefined）。 */
    readonly AutoFilter?: unknown;
    // ── 条件格式（add_conditional_format）由 Range.FormatConditions 提供，见下 ──
    // ── 表格（create_table）────────────────────────────────────────────────
    /** [真机待验] VBA Worksheet.ListObjects（Excel 表格集合）。 */
    readonly ListObjects: WpsListObjects;
    // ── 图表（insert_chart / set_chart_title）──────────────────────────────
    /** [真机待验] VBA Worksheet.ChartObjects（嵌入图表集合）。 */
    readonly ChartObjects: WpsChartObjects;
    /** [真机待验] VBA Worksheet.PivotTables（透视表集合）。无 getItemOrNull，用 Item + try/catch。 */
    PivotTables(name?: string): WpsPivotTable;
    /** [真机待验] VBA Worksheet.Delete。 */
    Delete(): void;
    // 注意：Worksheet.Name 在共享 d.ts 已声明 readonly；重命名写入用 cast（见 manageWorksheet）。
  }

  interface WpsRange {
    /** [真机待验] VBA Range.FormatConditions（条件格式集合）。 */
    readonly FormatConditions: WpsFormatConditions;
  }

  /** [真机待验] VBA FormatConditions 集合。 */
  interface WpsFormatConditions {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsFormatCondition;
    /**
     * VBA Add(Type, Operator?, Formula1?, Formula2?)。
     * Type: xlCellValue=1/xlColorScale=3/xlDatabar=4。
     * Operator: xlGreater=5/xlLess=6/xlBetween=1 等。
     */
    Add(type: number, operator?: number, formula1?: string, formula2?: string): WpsFormatCondition;
    /** 清空全部条件格式。 */
    Delete(): void;
  }

  /** [真机待验] 单条条件格式。MVP 仅序列化 Type/Operator/Formula1/Formula2 + Interior/Font 颜色。 */
  interface WpsFormatCondition {
    readonly Type: number;
    readonly Operator?: number;
    readonly Formula1?: string;
    readonly Formula2?: string;
    readonly Interior?: WpsInterior;
    readonly Font?: WpsFont;
  }

  /** [真机待验] VBA ListObjects 集合（Excel 表格）。 */
  interface WpsListObjects {
    readonly Count: number;
    /** 1-based 序号或名字。 */
    Item(index: number | string): WpsListObject;
    /**
     * VBA Add(SourceType, Source, LinkSource?, XlListObjectHasHeaders, Destination?)。
     * SourceType xlSrcRange=1；HasHeaders xlYes=1/xlNo=2/xlGuess=0。
     */
    Add(sourceType: number, source: WpsRange, linkSource: unknown, hasHeaders: number): WpsListObject;
  }

  interface WpsListObject {
    /** 表格名（可读可写；Add 后读回 server 端规范化名）。 */
    Name: string;
    Delete(): void;
  }

  /** [真机待验] VBA ChartObjects 集合。 */
  interface WpsChartObjects {
    readonly Count: number;
    /** 1-based 序号或名字。 */
    Item(index: number | string): WpsChartObject;
    /** VBA Add(Left, Top, Width, Height)。返回 ChartObject 包装器。 */
    Add(left: number, top: number, width: number, height: number): WpsChartObject;
  }

  /** [真机待验] VBA ChartObject（图表容器）。 */
  interface WpsChartObject {
    Name: string;
    readonly Chart: WpsChart;
    Delete(): void;
  }

  /** [真机待验] VBA Chart。 */
  interface WpsChart {
    /** VBA Chart.SetSourceData(Source, PlotBy?)。 */
    SetSourceData(source: WpsRange, plotBy?: number): void;
    /** VBA Chart.ChartType（xlColumnClustered=51/xlBarClustered=57/xlLine=4/xlPie=5）。 */
    ChartType: number;
    /** VBA Chart.HasTitle。 */
    HasTitle: boolean;
    /** VBA Chart.ChartTitle.Text。 */
    readonly ChartTitle: { Text: string };
  }

  /** [真机待验] VBA PivotCaches 集合（Workbook 级）。 */
  interface WpsPivotCaches {
    /** VBA Create(SourceType xlDatabase=1, SourceData)。 */
    Create(sourceType: number, sourceData: WpsRange): WpsPivotCache;
  }

  /** [真机待验] VBA PivotCache。 */
  interface WpsPivotCache {
    /** VBA CreatePivotTable(TableDestination, TableName?)。 */
    CreatePivotTable(tableDestination: WpsRange, tableName?: string): WpsPivotTable;
  }

  /** [真机待验] VBA PivotTable。 */
  interface WpsPivotTable {
    Name: string;
    /** VBA PivotFields(name) → PivotField（按列头名定位，大小写敏感）。 */
    PivotFields(name: string): WpsPivotField;
    /** VBA TableRange2（整张透视表区域），删除用。 */
    readonly TableRange2?: WpsRange;
  }

  /** [真机待验] VBA PivotField。Orientation：xlRowField=1/xlColumnField=2/xlDataField=4。 */
  interface WpsPivotField {
    Orientation: number;
    /** Function 聚合方式（xlSum=-4157），data field 用。 */
    Function?: number;
  }

  interface WpsWorkbook {
    /** [真机待验] VBA Workbook.PivotCaches()。 */
    PivotCaches(): WpsPivotCaches;
    /** [真机待验] VBA Workbook.Worksheets.Add（新增工作表）。 */
    readonly Worksheets: WpsWorksheets;
  }

  interface WpsWorksheets {
    /** [真机待验] VBA Worksheets.Add（无参=在最前插入；返回新表）。 */
    Add(): WpsWorksheet;
  }
}

/** A-24/TOOL-06：单次 get_range_values 上限（对齐 Office.js ExcelAdapter CELL_LIMIT）。 */
const CELL_LIMIT = 10_000;

// ---------------------------------------------------------------------------
// 颜色转换 helpers（[真机待验]）
// VBA Interior.Color / Font.Color 为 BGR long 整数；Office.js / 工具入参为 #RRGGBB。
// 必须双向转换：写入前 hexToBgr，读 before-image 后 bgrToHex（回放时再转回 BGR）。
// ---------------------------------------------------------------------------

/** #RRGGBB（或 RRGGBB）→ VBA BGR long 整数。无效输入返回 0（黑）。[真机待验] */
function hexToBgr(hex: string | null | undefined): number {
  if (hex == null) return 0;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(String(hex).trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // BGR：低字节 = R，高字节 = B
  return (b << 16) | (g << 8) | r;
}

/** VBA BGR long 整数 → #RRGGBB。非数字返回 null。[真机待验] */
function bgrToHex(bgr: number | null | undefined): string | null {
  if (typeof bgr !== 'number' || !Number.isFinite(bgr)) return null;
  const v = bgr & 0xffffff;
  const b = (v >> 16) & 0xff;
  const g = (v >> 8) & 0xff;
  const r = v & 0xff;
  const toHex = (x: number) => x.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * 0-based 列索引 → A1 列字母（bijective base-26，多字母）。对齐 Office.js columnIndexToLetter。
 * 0→'A'、25→'Z'、26→'AA'、701→'ZZ'。
 */
function columnIndexToLetter(idx: number): string {
  let n = idx + 1;
  let letter = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * 水平对齐字符串（Office.js 语义：Left/Center/Right/General）→ VBA xlHAlign 整数。[真机待验]
 * xlLeft=-4131 / xlCenter=-4108 / xlRight=-4152 / xlGeneral=1。
 */
function alignmentToXl(alignment: string | null | undefined): number | null {
  switch (alignment) {
    case 'Left': return -4131;
    case 'Center': return -4108;
    case 'Right': return -4152;
    case 'General': return 1;
    default: return null;
  }
}

/** 取 WPS 注入的全局 Application；非 WPS 环境（或注入失败）抛 HostApiError。 */
function getApp(): WpsApplication {
  const app = (globalThis as { Application?: WpsApplication }).Application;
  if (!app) {
    throw new HostApiError('WPS Application 不可用（非 WPS 环境或加载项未就绪）');
  }
  return app;
}

/**
 * VBA Value2 规范化：单格返标量、多格返 2D 数组 → 统一成 2D 数组。
 * [真机待验] WPS 是否完全遵循此 VBA 语义。
 */
function normalize2D(value: unknown): unknown[][] {
  if (Array.isArray(value)) {
    // 已是数组：可能是 2D（[[..],[..]]）或 1D（极少）；统一成 2D
    if (value.length > 0 && Array.isArray(value[0])) {
      return value as unknown[][];
    }
    return [value as unknown[]];
  }
  // 标量（单格）→ [[v]]
  return [[value]];
}

/**
 * 解析 Excel range 地址 → WpsRange。
 * 对位 Office.js resolveRange：支持裸地址 / `Sheet!A1` / `'表 名'!A1` 前缀。
 * WPS 同步 OM：Application.Worksheets.Item(name).Range(local) 或 ActiveSheet.Range(addr)。
 */
function resolveWpsRange(app: WpsApplication, address: string): WpsRange {
  const bangIdx = address.indexOf('!');
  if (bangIdx === -1) {
    const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
    if (!sheet) throw new HostApiError('WPS 无活动工作表');
    return sheet.Range(address);
  }
  const sheetRaw = address.slice(0, bangIdx);
  const localAddr = address.slice(bangIdx + 1);
  const sheetName =
    sheetRaw.startsWith("'") && sheetRaw.endsWith("'")
      ? sheetRaw.slice(1, -1).replace(/''/g, "'")
      : sheetRaw;
  const worksheets = app.Worksheets ?? app.ActiveWorkbook?.Worksheets;
  if (!worksheets) throw new HostApiError('WPS 无工作表集合');
  return worksheets.Item(sheetName).Range(localAddr);
}

/**
 * 解析 range 地址 → 所属 WpsWorksheet（sheet-level 操作用：AutoFilter / ListObjects / ChartObjects）。
 * 裸地址 → ActiveSheet；带 `Sheet!` 前缀 → Worksheets.Item(name)。
 */
function resolveWpsSheet(app: WpsApplication, address: string): WpsWorksheet {
  const bangIdx = address.indexOf('!');
  if (bangIdx === -1) {
    const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
    if (!sheet) throw new HostApiError('WPS 无活动工作表');
    return sheet;
  }
  const sheetRaw = address.slice(0, bangIdx);
  const sheetName =
    sheetRaw.startsWith("'") && sheetRaw.endsWith("'")
      ? sheetRaw.slice(1, -1).replace(/''/g, "'")
      : sheetRaw;
  const worksheets = app.Worksheets ?? app.ActiveWorkbook?.Worksheets;
  if (!worksheets) throw new HostApiError('WPS 无工作表集合');
  return worksheets.Item(sheetName);
}

/** 取局部地址（去 `Sheet!` 前缀），供 worksheet 级 Range() 调用。 */
function localAddress(address: string): string {
  const bangIdx = address.indexOf('!');
  return bangIdx === -1 ? address : address.slice(bangIdx + 1);
}

export class WpsExcelAdapter implements DocumentAdapter {
  // ---- 选区 ----------------------------------------------------------------

  async getSelection(): Promise<SelectionContext> {
    try {
      const app = getApp();
      const sel = app.Selection;
      const address = sel?.Address;
      if (!address) return { kind: 'none' };
      return { kind: 'excel', address };
    } catch (err) {
      throw new HostApiError('WPS Excel getSelection 失败', err);
    }
  }

  /**
   * [真机待验] WPS 选区事件 API 未在文档确认（Office.js 是 worksheet.onSelectionChanged）。
   * Phase 32 暂返 no-op 解绑（capabilities.supportsSelectionEvents=false）；
   * WPS-D1 或真机调研后接 Application 事件（如 ApiEvent / WorkbookSelectionChange）。
   */
  onSelectionChanged(_callback: () => void): () => void {
    return () => {
      /* no-op — WPS 选区事件未接（[真机待验]） */
    };
  }

  capabilities(): AdapterCapabilities {
    return {
      host: 'excel',
      supportsSelectionEvents: false,
      supportedInserts: ['text', 'formula', 'range-values'],
    };
  }

  // ---- 写入（PANE insert）--------------------------------------------------

  async insert(content: InsertableContent): Promise<void> {
    try {
      const app = getApp();
      switch (content.type) {
        case 'text': {
          const sel = app.Selection;
          if (!sel) throw new HostApiError('WPS 无选区可写入');
          sel.Value2 = content.value;
          return;
        }
        case 'formula': {
          const sel = app.Selection;
          if (!sel) throw new HostApiError('WPS 无选区可写入');
          sel.Formula = content.formula;
          return;
        }
        case 'range-values': {
          const sel = app.Selection;
          if (!sel) throw new HostApiError('WPS 无选区可写入');
          // Resize 到数组尺寸后写（VBA 范式，避免维度不匹配）
          const rows = content.values.length;
          const cols = content.values[0]?.length ?? 0;
          const target = rows > 0 && cols > 0 ? sel.Resize(rows, cols) : sel;
          target.Value2 = content.values;
          return;
        }
        default:
          throw new UnsupportedOperationError(
            `WPS Excel insert 暂不支持 ${(content as InsertableContent).type}（WPS-D1）`,
          );
      }
    } catch (err) {
      if (err instanceof UnsupportedOperationError) throw err;
      throw new HostApiError('WPS Excel insert 失败', err);
    }
  }

  // ---- 只读 ----------------------------------------------------------------

  async read(query: ReadableQuery): Promise<ReadableResult> {
    switch (query.kind) {
      case 'list_worksheets': {
        try {
          const app = getApp();
          const ws = app.Worksheets ?? app.ActiveWorkbook?.Worksheets;
          if (!ws) throw new HostApiError('WPS 无工作表集合');
          const names: string[] = [];
          for (let i = 1; i <= ws.Count; i++) {
            names.push(ws.Item(i).Name);
          }
          return { ok: true, data: { worksheets: names } };
        } catch (err) {
          throw new HostApiError('WPS Excel list_worksheets 失败', err);
        }
      }

      case 'get_range_values': {
        try {
          const app = getApp();
          const range = resolveWpsRange(app, query.address);
          // 读前判大小（对齐 Office.js A-24：>10K 拒绝）
          const cellCount = range.Count;
          if (typeof cellCount === 'number' && cellCount > CELL_LIMIT) {
            return {
              ok: false,
              error: {
                code: 'INVALID_ARGS',
                message: `选区有 ${cellCount} 个单元格，过大无法整块读取`,
                hint: '请改用 get_used_range_summary 看概况，或指定更小的 address',
                recoverable: true,
              },
            };
          }
          const values = normalize2D(range.Value2);
          return {
            ok: true,
            data: {
              address: query.address,
              rowCount: values.length,
              values,
            },
          };
        } catch (err) {
          throw new HostApiError('WPS Excel get_range_values 失败', err);
        }
      }

      case 'get_used_range_summary': {
        try {
          const app = getApp();
          const sheet = query.sheetName
            ? (app.Worksheets ?? app.ActiveWorkbook?.Worksheets)?.Item(query.sheetName)
            : (app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet);
          if (!sheet) throw new HostApiError('WPS 无目标工作表');
          // [真机待验] 空表 UsedRange 行为（Office.js 用 getUsedRange(false) 防 ItemNotFound）
          const used = sheet.UsedRange;
          const rowCount = used.Rows?.Count ?? 0;
          const columnCount = used.Columns?.Count ?? 0;
          let headerSample: unknown[] = [];
          if (rowCount > 0 && columnCount > 0) {
            const all = normalize2D(used.Value2);
            headerSample = all[0] ?? [];
          }
          return {
            ok: true,
            data: {
              address: used.Address,
              rowCount,
              columnCount,
              headerSample,
            },
          };
        } catch (err) {
          throw new HostApiError('WPS Excel get_used_range_summary 失败', err);
        }
      }

      case 'selection_detail': {
        return { ok: true, data: await this.getSelection() };
      }

      default: {
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: `WPS Excel adapter 不支持 kind: ${(query as ReadableQuery).kind}`,
            recoverable: false,
            hint: '该 read 操作在 WPS 版暂未实现（WPS-D1）或属其它宿主',
          },
        };
      }
    }
  }

  // ---- 写工具方法（被 Office.js Excel 工具复用调用）-------------------------

  /**
   * set_range_values 工具调用。写前抓 before-image（同步读 → 规范化 2D）。
   * inverse = overwriteRange（args:Record）。
   */
  async setRangeValues(
    address: string,
    values: unknown[][],
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      // before-image：先读（Address 为绝对 $ 格式，供 overwriteRange 回写）
      const beforeImage = {
        address: range.Address,
        values: normalize2D(range.Value2),
      };
      range.Value2 = values;
      return { beforeImage };
    } catch (err) {
      throw new HostApiError('WPS Excel setRangeValues 失败', err);
    }
  }

  /** set_cell 工具调用。inverse = overwriteRange。 */
  async setCell(
    cell: string,
    value: unknown,
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      const app = getApp();
      const range = resolveWpsRange(app, cell);
      const beforeImage = {
        address: range.Address,
        values: normalize2D(range.Value2),
      };
      range.Value2 = value;
      return { beforeImage };
    } catch (err) {
      throw new HostApiError('WPS Excel setCell 失败', err);
    }
  }

  /** apply_formula 工具调用。inverse = overwriteRange（before-image values 还原即清公式结果）。 */
  async applyFormula(
    cell: string,
    formula: string,
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      const app = getApp();
      const range = resolveWpsRange(app, cell);
      const beforeImage = {
        address: range.Address,
        values: normalize2D(range.Value2),
      };
      range.Formula = formula;
      return { beforeImage };
    } catch (err) {
      throw new HostApiError('WPS Excel applyFormula 失败', err);
    }
  }

  /**
   * overwrite_range inverse（被 setRangeValues/setCell/applyFormula 的 reverse 回放调用）。
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（[[adapter-inverse-signature]] Phase 5 教训）：
   * operationLog.executeReverse 以 reverse.args 对象直接调用，位置参会真机翻车。
   */
  async overwriteRange(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const values = args.values as unknown[][];
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      range.Value2 = values;
    } catch (err) {
      throw new HostApiError('WPS Excel overwriteRange 失败', err);
    }
  }

  // ===========================================================================
  // 快照辅助（sortRange / excelFindAndReplace / mergeCells / removeDuplicatesRange 共用）
  // 对齐 Office.js readRangeValuesSnapshot：>CELL_LIMIT 抛带 isTooLarge 标记的 Error。
  // ===========================================================================

  /** 内部：读 range 值快照（同步 VBA）。超 CELL_LIMIT → 抛 isTooLarge=true 的 Error。 */
  private readRangeValuesSnapshotSync(address: string): { address: string; snapshot: unknown[][] } {
    const app = getApp();
    const range = resolveWpsRange(app, address);
    const count = range.Count;
    if (typeof count === 'number' && count > CELL_LIMIT) {
      const err = new Error(`区域过大：${count} 个单元格，超过快照上限 ${CELL_LIMIT}`);
      (err as Error & { isTooLarge: boolean }).isTooLarge = true;
      throw err;
    }
    return { address: range.Address, snapshot: normalize2D(range.Value2) };
  }

  // ===========================================================================
  // EXCEL-01 format_excel_range → restore_range_format
  // 返回 beforeImage 键名 VERBATIM 对齐 Office.js（address/numberFormat/fillColor/
  // fontBold/fontColor/fontSize/fontName/horizontalAlignment）。颜色读出转 #RRGGBB。
  // ===========================================================================

  async formatExcelRange(
    address: string,
    format: {
      numberFormat?: string;
      fill?: { color?: string };
      font?: Record<string, unknown>;
      alignment?: string;
    },
  ): Promise<{
    beforeImage: {
      address: string;
      numberFormat: unknown;
      fillColor: unknown;
      fontBold: unknown;
      fontColor: unknown;
      fontSize: unknown;
      fontName: unknown;
      horizontalAlignment: unknown;
    };
  }> {
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);

      // before-image（[真机待验] NumberFormat 多格可能返标量；颜色 BGR→#RRGGBB）
      const beforeImage = {
        address: range.Address,
        numberFormat: range.NumberFormat ?? null,
        fillColor: bgrToHex(range.Interior?.Color),
        fontBold: range.Font?.Bold ?? null,
        fontColor: bgrToHex(range.Font?.Color),
        fontSize: range.Font?.Size ?? null,
        fontName: range.Font?.Name ?? null,
        horizontalAlignment: range.HorizontalAlignment ?? null,
      };

      if (format.numberFormat != null) {
        range.NumberFormat = format.numberFormat;
      }
      if (format.fill?.color != null) {
        range.Interior.Color = hexToBgr(format.fill.color);
      }
      if (format.font != null) {
        if (format.font.bold !== undefined) {
          range.Font.Bold = format.font.bold as boolean;
        }
        if (format.font.color != null) {
          range.Font.Color = hexToBgr(format.font.color as string);
        }
        if (format.font.size != null) {
          range.Font.Size = format.font.size as number;
        }
        if (format.font.name != null) {
          range.Font.Name = format.font.name as string;
        }
      }
      if (format.alignment != null) {
        const xl = alignmentToXl(format.alignment);
        if (xl != null) range.HorizontalAlignment = xl;
      }

      return { beforeImage };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel formatExcelRange 失败', err);
    }
  }

  /** EXCEL-01 inverse（restore_range_format）。args 键名 VERBATIM 对齐 reverse descriptor。 */
  async restoreRangeFormat(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const numberFormat = args.numberFormat as string | null;
    const fillColor = args.fillColor as string | null;
    const fontBold = args.fontBold as boolean | null;
    const fontColor = args.fontColor as string | null;
    const fontSize = args.fontSize as number | null;
    const fontName = args.fontName as string | null;
    const horizontalAlignment = args.horizontalAlignment as number | string | null;
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      if (numberFormat != null) range.NumberFormat = numberFormat;
      if (fillColor != null) range.Interior.Color = hexToBgr(fillColor);
      if (fontBold != null) range.Font.Bold = fontBold;
      if (fontColor != null) range.Font.Color = hexToBgr(fontColor);
      if (fontSize != null) range.Font.Size = fontSize;
      if (fontName != null) range.Font.Name = fontName;
      if (horizontalAlignment != null) {
        // before-image 存的是 xl 整数（直接写回）；若误传字符串则转换
        range.HorizontalAlignment =
          typeof horizontalAlignment === 'number'
            ? horizontalAlignment
            : alignmentToXl(horizontalAlignment) ?? range.HorizontalAlignment;
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreRangeFormat 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-02 set_column_row_size → restore_column_row_size
  // 返回 { beforeSizes: Array<{index,size}> }（VERBATIM）。'autoFit' 走 AutoFit。
  // ===========================================================================

  async setColumnRowSize(
    target: 'column' | 'row',
    indices: number[],
    size: number | 'autoFit',
  ): Promise<{ beforeSizes: Array<{ index: number; size: number }> }> {
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) throw new HostApiError('WPS 无活动工作表');

      const beforeSizes: Array<{ index: number; size: number }> = [];
      for (const idx of indices) {
        if (target === 'column') {
          const colLetter = columnIndexToLetter(idx);
          const col = sheet.Range(`${colLetter}:${colLetter}`);
          beforeSizes.push({ index: idx, size: col.ColumnWidth ?? 0 });
        } else {
          const row = sheet.Range(`${idx + 1}:${idx + 1}`);
          beforeSizes.push({ index: idx, size: row.RowHeight ?? 0 });
        }
      }

      for (const idx of indices) {
        if (target === 'column') {
          const colLetter = columnIndexToLetter(idx);
          const col = sheet.Range(`${colLetter}:${colLetter}`);
          if (size === 'autoFit') {
            col.EntireColumn.AutoFit();
          } else {
            col.ColumnWidth = size;
          }
        } else {
          const row = sheet.Range(`${idx + 1}:${idx + 1}`);
          if (size === 'autoFit') {
            row.EntireRow.AutoFit();
          } else {
            row.RowHeight = size;
          }
        }
      }

      return { beforeSizes };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel setColumnRowSize 失败', err);
    }
  }

  /** EXCEL-02 inverse（restore_column_row_size）。 */
  async restoreColumnRowSize(args: Record<string, unknown>): Promise<void> {
    const target = args.target as 'column' | 'row';
    const beforeSizes = args.beforeSizes as Array<{ index: number; size: number }>;
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) throw new HostApiError('WPS 无活动工作表');
      for (const { index, size } of beforeSizes ?? []) {
        if (target === 'column') {
          const colLetter = columnIndexToLetter(index);
          sheet.Range(`${colLetter}:${colLetter}`).ColumnWidth = size;
        } else {
          sheet.Range(`${index + 1}:${index + 1}`).RowHeight = size;
        }
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreColumnRowSize 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-04 set_auto_filter → restore_auto_filter
  // 返回 { hadFilter, address }（VERBATIM）。[真机待验] WPS AutoFilter OM。
  // ===========================================================================

  async setAutoFilter(
    address: string,
    enabled: boolean,
  ): Promise<{ hadFilter: boolean; address: string }> {
    try {
      const app = getApp();
      const sheet = resolveWpsSheet(app, address);
      const hadFilter = (sheet.AutoFilterMode as boolean) ?? false;

      if (enabled) {
        // VBA：Range.AutoFilter() 在该区域上切换筛选框（无参 = 切换）。
        // 为确保「开启」语义，若当前已开则不动，未开则在 range 上调用 AutoFilter。
        const range = resolveWpsRange(app, address);
        if (!hadFilter) {
          (range as unknown as { AutoFilter(): void }).AutoFilter();
        }
      } else {
        // 关闭筛选框
        sheet.AutoFilterMode = false;
      }

      return { hadFilter, address };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel setAutoFilter 失败', err);
    }
  }

  /** EXCEL-04 inverse（restore_auto_filter）。hadFilter=true→保留/重开；false→关闭。 */
  async restoreAutoFilter(args: Record<string, unknown>): Promise<void> {
    const hadFilter = args.hadFilter as boolean;
    const address = args.address as string | undefined;
    try {
      const app = getApp();
      if (hadFilter && address) {
        const sheet = resolveWpsSheet(app, address);
        if (!(sheet.AutoFilterMode as boolean)) {
          const range = resolveWpsRange(app, address);
          (range as unknown as { AutoFilter(): void }).AutoFilter();
        }
      } else if (address) {
        const sheet = resolveWpsSheet(app, address);
        sheet.AutoFilterMode = false;
      } else {
        const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
        if (sheet) sheet.AutoFilterMode = false;
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreAutoFilter 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-06 add_conditional_format → restore_conditional_format
  // 返回 { beforeFormats }（VERBATIM）。策略：快照现有 CF → undo 时 Delete 全部 → 重建。
  // [真机待验] WPS FormatConditions OM。
  // ===========================================================================

  async addConditionalFormat(
    address: string,
    rule: Record<string, unknown>,
  ): Promise<{ beforeFormats: Array<Record<string, unknown>> }> {
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);

      // 序列化现有条件格式（MVP：Type/Operator/Formula1/Formula2 + 颜色）
      const beforeFormats: Array<Record<string, unknown>> = [];
      const fcs = range.FormatConditions;
      const count = fcs?.Count ?? 0;
      for (let i = 1; i <= count; i++) {
        const fc = fcs.Item(i);
        beforeFormats.push({
          type: fc.Type,
          operator: fc.Operator ?? null,
          formula1: fc.Formula1 ?? null,
          formula2: fc.Formula2 ?? null,
          fillColor: bgrToHex(fc.Interior?.Color),
          fontColor: bgrToHex(fc.Font?.Color),
        });
      }

      // 添加新条件格式（仅 cellValue MVP；colorScale/dataBar best-effort）
      const ruleType = rule.type as string;
      if (ruleType === 'cellValue' || ruleType === 'CellValue') {
        const operator = (rule.operator as string) ?? 'greaterThan';
        const value = (rule.value as string | number) ?? 0;
        const xlOp = this.cfOperatorToXl(operator);
        const fc = fcs.Add(1 /* xlCellValue */, xlOp, String(value));
        const ruleFormat = rule.format as Record<string, unknown> | undefined;
        if (ruleFormat?.fillColor && fc.Interior) {
          fc.Interior.Color = hexToBgr(ruleFormat.fillColor as string);
        }
        if (ruleFormat?.fontColor && fc.Font) {
          fc.Font.Color = hexToBgr(ruleFormat.fontColor as string);
        }
      } else if (ruleType === 'colorScale' || ruleType === 'ColorScale') {
        fcs.Add(3 /* xlColorScale */);
      } else if (ruleType === 'dataBar' || ruleType === 'DataBar') {
        fcs.Add(4 /* xlDatabar */);
      }

      return { beforeFormats };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel addConditionalFormat 失败', err);
    }
  }

  /** cellValue operator 字符串 → VBA xlFormatConditionOperator 整数。[真机待验] */
  private cfOperatorToXl(operator: string): number {
    switch (operator) {
      case 'between': return 1; // xlBetween
      case 'notBetween': return 2; // xlNotBetween
      case 'equalTo': return 3; // xlEqual
      case 'notEqualTo': return 4; // xlNotEqual
      case 'greaterThan': return 5; // xlGreater
      case 'lessThan': return 6; // xlLess
      case 'greaterThanOrEqual': return 7; // xlGreaterEqual
      case 'lessThanOrEqual': return 8; // xlLessEqual
      default: return 5; // 默认 greaterThan
    }
  }

  /** EXCEL-06 inverse（restore_conditional_format）。Delete 全部 → 按 beforeFormats 重建。 */
  async restoreConditionalFormat(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const beforeFormats = args.beforeFormats as Array<Record<string, unknown>>;
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      const fcs = range.FormatConditions;

      // 清空全部（幂等安全路径，防索引漂移）
      fcs.Delete();

      for (const fmt of beforeFormats ?? []) {
        const type = fmt.type as number;
        if (type === 1 /* xlCellValue */) {
          const op = (fmt.operator as number) ?? 5;
          const f1 = (fmt.formula1 as string) ?? undefined;
          const f2 = (fmt.formula2 as string) ?? undefined;
          const fc = fcs.Add(1, op, f1, f2);
          if (fmt.fillColor && fc.Interior) fc.Interior.Color = hexToBgr(fmt.fillColor as string);
          if (fmt.fontColor && fc.Font) fc.Font.Color = hexToBgr(fmt.fontColor as string);
        } else if (type === 3) {
          fcs.Add(3);
        } else if (type === 4) {
          fcs.Add(4);
        }
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreConditionalFormat 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-07 create_table → delete_table_by_name
  // 返回 { resolvedName }（VERBATIM）。ListObjects.Add → 读回规范化 Name。
  // [真机待验] WPS ListObjects OM。
  // ===========================================================================

  async createTable(
    address: string,
    hasHeaders: boolean,
    tableName?: string,
  ): Promise<{ resolvedName: string }> {
    try {
      const app = getApp();
      const sheet = resolveWpsSheet(app, address);
      const range = resolveWpsRange(app, address);
      // VBA ListObjects.Add(xlSrcRange=1, range, null, xlYes=1/xlNo=2)
      const lo = sheet.ListObjects.Add(1, range, null, hasHeaders ? 1 : 2);
      if (tableName) lo.Name = tableName;
      return { resolvedName: lo.Name };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel createTable 失败', err);
    }
  }

  /** EXCEL-07 inverse（delete_table_by_name）。已不存在 → 静默跳过（幂等）。 */
  async deleteTableByName(args: Record<string, unknown>): Promise<void> {
    const tableName = args.tableName as string;
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) return;
      try {
        const lo = sheet.ListObjects.Item(tableName);
        lo.Delete();
      } catch {
        // 表格已不存在 → 静默跳过（重复 undo 安全）
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel deleteTableByName 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-03 sort_range → restore_range_values_snapshot | noop_inverse
  // 返回 { snapshot, snapshotAddress, tooLarge }（VERBATIM）。[真机待验] WPS Range.Sort。
  // ===========================================================================

  async sortRange(
    address: string,
    sortFields: Array<{ key: number; ascending: boolean }>,
  ): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean }> {
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address;
    let tooLarge = false;

    try {
      const result = this.readRangeValuesSnapshotSync(address);
      snapshot = result.snapshot;
      snapshotAddress = result.address;
    } catch (err) {
      // 超限或读失败 → 标 tooLarge，但仍执行排序
      tooLarge = true;
      void err;
    }

    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      // VBA Range.Sort(Key1, Order1, ...)：用相对列偏移（Range.Columns.Item(key+1)）定位 sort key。
      // xlAscending=1 / xlDescending=2；Header xlGuess=0（让 ET 自判，与 Office.js 行为最接近）。
      const f1 = sortFields[0];
      const f2 = sortFields[1];
      const f3 = sortFields[2];
      const keyCol = (f?: { key: number }) =>
        f ? range.Columns.Item(f.key + 1) : undefined;
      range.Sort(
        keyCol(f1),
        f1 ? (f1.ascending ? 1 : 2) : undefined,
        keyCol(f2),
        undefined,
        f2 ? (f2.ascending ? 1 : 2) : undefined,
        keyCol(f3),
        f3 ? (f3.ascending ? 1 : 2) : undefined,
        0 /* xlGuess */,
      );
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel sortRange 失败', err);
    }

    return { snapshot, snapshotAddress, tooLarge };
  }

  // ===========================================================================
  // EXCEL-03/05 共享 inverse：restore_range_values_snapshot
  // 等价 overwriteRange（args: { address, snapshot }）。
  // ===========================================================================

  async restoreRangeValuesSnapshot(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const snapshot = args.snapshot as unknown[][];
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      range.Value2 = snapshot;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreRangeValuesSnapshot 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-05 excel_find_and_replace → restore_range_values_snapshot | noop_inverse
  // 返回 { snapshot, snapshotAddress, tooLarge, count }（VERBATIM）。
  // [真机待验] WPS Range.Replace（无 replaced-count 返回值 → count best-effort）。
  // ===========================================================================

  async excelFindAndReplace(
    searchText: string,
    replaceText: string,
    address?: string,
    matchCase?: boolean,
    matchWholeWord?: boolean,
  ): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean; count: number }> {
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address ?? '';
    let tooLarge = false;
    let count = 0;

    try {
      const app = getApp();
      // 目标区域：有 address → 该区域；无 → 活动表 UsedRange
      let targetRange: WpsRange;
      if (address) {
        targetRange = resolveWpsRange(app, address);
      } else {
        const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
        if (!sheet) throw new HostApiError('WPS 无活动工作表');
        targetRange = sheet.UsedRange;
      }

      snapshotAddress = targetRange.Address;
      const cellCount = targetRange.Count;
      if (typeof cellCount === 'number' && cellCount > CELL_LIMIT) {
        tooLarge = true;
      } else {
        const before = normalize2D(targetRange.Value2);
        snapshot = before;
        // best-effort count：替换前统计匹配单元格数（精确替换数 WPS 不直接返回）
        count = this.countMatches(before, searchText, matchCase ?? false, matchWholeWord ?? false);
      }

      // VBA Range.Replace(What, Replacement, LookAt=xlWhole(1)/xlPart(2), SearchOrder, MatchCase)
      const lookAt = matchWholeWord ? 1 : 2;
      targetRange.Replace(searchText, replaceText, lookAt, undefined, matchCase ?? false);

      return { snapshot, snapshotAddress, tooLarge, count };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel excelFindAndReplace 失败', err);
    }
  }

  /** best-effort 统计匹配单元格数（WPS Range.Replace 不返回替换计数）。 */
  private countMatches(
    values: unknown[][],
    search: string,
    matchCase: boolean,
    matchWhole: boolean,
  ): number {
    let n = 0;
    const needle = matchCase ? search : search.toLowerCase();
    for (const row of values) {
      for (const cell of row) {
        if (cell == null) continue;
        const s = matchCase ? String(cell) : String(cell).toLowerCase();
        if (matchWhole ? s === needle : s.includes(needle)) n++;
      }
    }
    return n;
  }

  // ===========================================================================
  // EXCEL-11 merge_cells → restore_merge_state | noop_inverse
  // 返回 { snapshot, snapshotAddress, tooLarge }（VERBATIM）。merge 前必快照。
  // [真机待验] WPS Range.Merge/UnMerge。
  // ===========================================================================

  async mergeCells(
    address: string,
    operation: 'merge' | 'unmerge',
    across?: boolean,
  ): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean }> {
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address;
    let tooLarge = false;

    try {
      const result = this.readRangeValuesSnapshotSync(address);
      snapshot = result.snapshot;
      snapshotAddress = result.address;
    } catch (err) {
      tooLarge = true;
      void err;
    }

    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      if (operation === 'merge') {
        range.Merge(across ?? false);
      } else {
        range.UnMerge();
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel mergeCells 失败', err);
    }

    return { snapshot, snapshotAddress, tooLarge };
  }

  /** EXCEL-11 inverse（restore_merge_state）。merge undo=UnMerge+写回值；unmerge undo=重新 Merge。 */
  async restoreMergeState(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const operation = args.operation as 'merge' | 'unmerge';
    const across = (args.across ?? false) as boolean;
    const snapshot = args.snapshot as unknown[][] | null | undefined;
    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);
      if (operation === 'merge') {
        range.UnMerge();
        if (snapshot) range.Value2 = snapshot;
      } else {
        range.Merge(across);
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreMergeState 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-12 remove_duplicates → restore_range_values_snapshot | noop_inverse
  // 返回 { snapshot, snapshotAddress, tooLarge, removed, uniqueRemaining }（VERBATIM）。
  // HR-01：columns 缺省/空 → 展开 [0..colCount-1]，绝不传空数组。
  // [真机待验] WPS Range.RemoveDuplicates（无 removed/unique 返回 → 由快照行数推算）。
  // ===========================================================================

  async removeDuplicatesRange(
    address: string,
    columns?: number[],
    includesHeader?: boolean,
  ): Promise<{
    snapshot: unknown[][] | null;
    snapshotAddress: string;
    tooLarge: boolean;
    removed: number;
    uniqueRemaining: number;
  }> {
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address;
    let tooLarge = false;

    try {
      const result = this.readRangeValuesSnapshotSync(address);
      snapshot = result.snapshot;
      snapshotAddress = result.address;
    } catch (err) {
      tooLarge = true;
      void err;
    }

    let removed = 0;
    let uniqueRemaining = 0;

    try {
      const app = getApp();
      const range = resolveWpsRange(app, address);

      // HR-01：columns 缺省/空数组 → 读 colCount 展开为显式全列 1-based 索引，绝不传空数组
      let dedupeColumns = columns;
      if (!dedupeColumns || dedupeColumns.length === 0) {
        const colCount = range.Columns?.Count ?? 1;
        dedupeColumns = Array.from({ length: colCount }, (_, i) => i);
      }
      // Office.js columns 是 0-based；VBA RemoveDuplicates 期望 1-based 列号
      const vbaColumns = dedupeColumns.map((c) => c + 1);
      const header = (includesHeader ?? true) ? 1 /* xlYes */ : 2 /* xlNo */;
      range.RemoveDuplicates(vbaColumns, header);

      // [真机待验] WPS 不返回 removed/uniqueRemaining → 用删后 CurrentRegion/快照推算
      if (snapshot) {
        const afterCount = range.Rows?.Count ?? snapshot.length;
        uniqueRemaining = afterCount;
        removed = Math.max(0, snapshot.length - afterCount);
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel removeDuplicatesRange 失败', err);
    }

    return { snapshot, snapshotAddress, tooLarge, removed, uniqueRemaining };
  }

  // ===========================================================================
  // EXCEL-09 manage_worksheet → restore_worksheet_snapshot
  // add → { operation:'add', sheetName:resolvedName }；rename → { operation:'rename', oldName, newName }。
  // [真机待验] WPS Worksheets.Add / Worksheet.Name / Delete。
  // ===========================================================================

  async manageWorksheet(
    operation: 'add' | 'rename',
    sheetName: string,
    newName?: string,
  ): Promise<
    | { operation: 'add'; sheetName: string }
    | { operation: 'rename'; oldName: string; newName: string }
  > {
    if (operation !== 'add' && operation !== 'rename') {
      throw new HostApiError(
        `manage_worksheet 仅支持 add/rename，收到非法 operation: ${String(operation)}`,
      );
    }
    try {
      const app = getApp();
      const worksheets = app.Worksheets ?? app.ActiveWorkbook?.Worksheets;
      if (!worksheets) throw new HostApiError('WPS 无工作表集合');

      if (operation === 'add') {
        const newSheet = worksheets.Add();
        if (sheetName) {
          try {
            (newSheet as unknown as { Name: string }).Name = sheetName;
          } catch {
            // 命名冲突等 → 保留 ET 自动分配名（resolvedName 读回）
          }
        }
        return { operation: 'add' as const, sheetName: newSheet.Name };
      } else {
        if (!newName) {
          throw new HostApiError('manage_worksheet rename 时 newName 不能为空');
        }
        const sheet = worksheets.Item(sheetName);
        const oldName = sheet.Name;
        (sheet as unknown as { Name: string }).Name = newName;
        return { operation: 'rename' as const, oldName, newName };
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel manageWorksheet 失败', err);
    }
  }

  /** EXCEL-09 inverse（restore_worksheet_snapshot）。add→删；rename→改回 oldName。 */
  async restoreWorksheetSnapshot(args: Record<string, unknown>): Promise<void> {
    const operation = args.operation as string;
    try {
      const app = getApp();
      const worksheets = app.Worksheets ?? app.ActiveWorkbook?.Worksheets;
      if (!worksheets) throw new HostApiError('WPS 无工作表集合');
      if (operation === 'add') {
        const sheetName = args.sheetName as string;
        try {
          worksheets.Item(sheetName).Delete();
        } catch {
          // 已不存在 → 静默跳过（重复 undo 安全）
        }
      } else if (operation === 'rename') {
        const newName = args.newName as string;
        const oldName = args.oldName as string;
        try {
          (worksheets.Item(newName) as unknown as { Name: string }).Name = oldName;
        } catch {
          // 目标表已不存在/已改名 → 静默跳过
        }
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreWorksheetSnapshot 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-10 set_chart_title → restore_chart_title
  // 返回 { beforeTitle }（VERBATIM）。ChartObjects(name).Chart.ChartTitle。
  // [真机待验] WPS ChartObjects/Chart OM。
  // ===========================================================================

  async setChartTitle(
    chartName: string,
    title: string,
  ): Promise<{ beforeTitle: string }> {
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) throw new HostApiError('WPS 无活动工作表');
      let chartObj: WpsChartObject;
      try {
        chartObj = sheet.ChartObjects.Item(chartName);
      } catch {
        throw new HostApiError(`图表「${chartName}」不存在`);
      }
      const chart = chartObj.Chart;
      const beforeTitle = chart.HasTitle ? chart.ChartTitle.Text : '';
      if (!chart.HasTitle) chart.HasTitle = true;
      chart.ChartTitle.Text = title;
      return { beforeTitle };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel setChartTitle 失败', err);
    }
  }

  /** EXCEL-10 inverse（restore_chart_title）。图表已删 → 静默跳过。 */
  async restoreChartTitle(args: Record<string, unknown>): Promise<void> {
    const chartName = args.chartName as string;
    const beforeTitle = args.beforeTitle as string;
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) return;
      try {
        const chart = sheet.ChartObjects.Item(chartName).Chart;
        if (beforeTitle) {
          if (!chart.HasTitle) chart.HasTitle = true;
          chart.ChartTitle.Text = beforeTitle;
        } else {
          chart.HasTitle = false;
        }
      } catch {
        // 图表已不存在 → 静默跳过（重复 undo 安全）
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel restoreChartTitle 失败', err);
    }
  }

  // ===========================================================================
  // insert_chart → delete_chart_by_name
  // 返回 { chartName }（VERBATIM）。ChartObjects.Add + Chart.SetSourceData + ChartType。
  // [真机待验] WPS ChartObjects.Add（位置参 Left/Top/Width/Height）。
  // ===========================================================================

  async insertChart(
    dataRange: string,
    chartType: string,
  ): Promise<{ chartName: string }> {
    try {
      const app = getApp();
      const sheet = resolveWpsSheet(app, dataRange);
      const range = resolveWpsRange(app, dataRange);
      // VBA ChartObjects.Add(Left, Top, Width, Height)（默认放在数据右侧的固定锚点）
      const chartObj = sheet.ChartObjects.Add(100, 50, 400, 300);
      const chart = chartObj.Chart;
      chart.SetSourceData(range);
      chart.ChartType = this.chartTypeToXl(chartType);
      return { chartName: chartObj.Name };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel insertChart 失败', err);
    }
  }

  /** Office.js chart type 字符串 → VBA xlChartType 整数。[真机待验] */
  private chartTypeToXl(chartType: string): number {
    switch (chartType) {
      case 'Bar': return 57; // xlBarClustered
      case 'Line': return 4; // xlLine
      case 'Pie': return 5; // xlPie
      case 'ColumnClustered':
      default: return 51; // xlColumnClustered
    }
  }

  /** insert_chart inverse（delete_chart_by_name）。已删 → 静默跳过。 */
  async deleteChartByName(args: Record<string, unknown>): Promise<void> {
    const chartName = args.chartName as string;
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) return;
      try {
        sheet.ChartObjects.Item(chartName).Delete();
      } catch {
        // 图表已不存在 → 静默跳过（重复 undo 安全）
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel deleteChartByName 失败', err);
    }
  }

  // ===========================================================================
  // EXCEL-13 create_pivot_table → delete_pivot_table_by_name
  // 返回 { pivotTableName }（VERBATIM）。HIGH RISK — PivotCaches.Create + CreatePivotTable
  // + PivotFields.Orientation。API 不可用 → 抛 HostApiError（工具层降级 ok:false）。
  // [真机待验] WPS PivotCaches/PivotTables OM 整套。
  // ===========================================================================

  async createPivotTable(opts: {
    sourceRange: string;
    destination: string;
    name?: string;
    rowFields?: string[];
    dataFields?: string[];
    columnFields?: string[];
  }): Promise<{ pivotTableName: string }> {
    try {
      const app = getApp();
      const workbook = app.ActiveWorkbook;
      if (!workbook || typeof workbook.PivotCaches !== 'function') {
        throw new HostApiError('当前 WPS 版本不支持创建数据透视表（PivotCaches API 不可用）');
      }
      const sourceRange = resolveWpsRange(app, opts.sourceRange);
      const destRange = resolveWpsRange(app, opts.destination);

      // PivotCaches.Create(xlDatabase=1, source) → CreatePivotTable(dest, name)
      const cache = workbook.PivotCaches().Create(1, sourceRange);
      const pivotTable = cache.CreatePivotTable(destRange, opts.name ?? 'Aster透视表');
      const pivotTableName = pivotTable.Name;

      // 字段配置（best-effort；失败删孤儿表后抛错，保持 HR-02 干净回滚语义）
      try {
        if (opts.rowFields?.length) {
          for (const f of opts.rowFields) {
            pivotTable.PivotFields(f).Orientation = 1; // xlRowField
          }
        }
        if (opts.columnFields?.length) {
          for (const f of opts.columnFields) {
            pivotTable.PivotFields(f).Orientation = 2; // xlColumnField
          }
        }
        if (opts.dataFields?.length) {
          for (const f of opts.dataFields) {
            const pf = pivotTable.PivotFields(f);
            pf.Orientation = 4; // xlDataField
            try {
              pf.Function = -4157; // xlSum
            } catch {
              // Function 不可写 → 保留默认聚合
            }
          }
        }
      } catch (fieldErr) {
        try {
          await this.deletePivotTableByName({ pivotTableName });
        } catch {
          // 孤儿表清理失败 → 吞掉，不掩盖字段配置错误
        }
        throw fieldErr;
      }

      return { pivotTableName };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel createPivotTable 失败', err);
    }
  }

  /** EXCEL-13 inverse（delete_pivot_table_by_name）。已删 → 静默跳过（幂等）。 */
  async deletePivotTableByName(args: Record<string, unknown>): Promise<void> {
    const pivotTableName = args.pivotTableName as string;
    try {
      const app = getApp();
      const sheet = app.ActiveSheet ?? app.ActiveWorkbook?.ActiveSheet;
      if (!sheet) return;
      try {
        const pt = sheet.PivotTables(pivotTableName);
        // 删整张透视表区域（VBA：PivotTable.TableRange2.Clear / Delete）
        if (pt.TableRange2) {
          (pt.TableRange2 as unknown as { Clear(): void }).Clear();
        }
      } catch {
        // 透视表已不存在 → 静默跳过（幂等 undo）
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Excel deletePivotTableByName 失败', err);
    }
  }
}
