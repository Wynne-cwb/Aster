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

/** A-24/TOOL-06：单次 get_range_values 上限（对齐 Office.js ExcelAdapter CELL_LIMIT）。 */
const CELL_LIMIT = 10_000;

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
}
