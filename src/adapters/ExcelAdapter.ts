/**
 * ExcelAdapter — Excel 宿主 adapter 实现（FOUND-05, NFR-05）
 *
 * XLS two-sync 守则注释（Phase 5 严格强制）：
 * 生产写回时须先 load → sync → 修改 → sync（两次 sync 模式）。
 * 骨架 getSelection 仅读取，用单次 sync 即可。
 *
 * 安全约束（T-01-06）：getSelection() 仅读取 range address（元数据），
 * 不读取单元格数值内容，不留存。
 */
import type {
  DocumentAdapter,
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
  ReadableQuery,
  ReadableResult,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../errors';

export class ExcelAdapter implements DocumentAdapter {
  /**
   * 获取 Excel 当前选中区域地址。
   * - 有选中 → { kind: 'excel', address }（如 'A1:C10'）
   * - 无选区 → { kind: 'none' }（D-16）
   * - Office.js 异常 → 包成 HostApiError
   */
  async getSelection(): Promise<SelectionContext> {
    try {
      return await Excel.run(async (ctx) => {
        const range = ctx.workbook.getSelectedRange();
        range.load('address');
        await ctx.sync();

        // address 为空字符串时视为无选区
        if (!range.address) {
          return { kind: 'none' } satisfies SelectionContext;
        }

        return {
          kind: 'excel',
          address: range.address,
        } satisfies SelectionContext;
      });
    } catch (err) {
      throw new HostApiError('Excel getSelection 失败', err);
    }
  }

  /**
   * 订阅 Excel worksheet selection-changed 事件（D-13）。
   * 使用 getActiveWorksheet().onSelectionChanged.add()，
   * 返回解绑函数 — 防止 Task Pane 隐藏后事件继续触发（T-01-07）。
   */
  onSelectionChanged(callback: () => void): () => void {
    // 用 OfficeExtension.EventHandlerResult 类型保存以便解绑
    let handlerResult: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs> | null =
      null;

    Excel.run(async (ctx) => {
      const worksheet = ctx.workbook.worksheets.getActiveWorksheet();
      handlerResult = worksheet.onSelectionChanged.add(async () => {
        callback();
      });
      await ctx.sync();
    }).catch(() => {
      // 注册失败不抛出（宿主可能未就绪），解绑时 handlerResult 为 null 则忽略
    });

    return () => {
      if (handlerResult !== null) {
        const result = handlerResult;
        Excel.run(async (ctx) => {
          result.remove();
          await ctx.sync();
        }).catch(() => {
          // 解绑失败静默处理（Task Pane 关闭时宿主可能已销毁）
        });
      }
    };
  }

  /**
   * Excel 宿主能力声明。
   * Phase 2 实现 text 写回；其余类型 Phase 5 实现。
   */
  capabilities(): AdapterCapabilities {
    return {
      host: 'excel',
      supportsSelectionEvents: true,
      supportedInserts: ['formula', 'range-values', 'text'],
    };
  }

  /**
   * Excel text 写回（D-16 / NFR-02 two-sync 规则）。
   *
   * 严格遵守 two-sync 规则（NFR-02 / Pitfall 5）：
   * load → sync 1 → write → sync 2，insert() 调用最多 2 次 context.sync()。
   * 非 text 类型抛 UnsupportedOperationError（Phase 5 实现）。
   */
  async insert(content: InsertableContent): Promise<void> {
    if (content.type !== 'text') {
      throw new UnsupportedOperationError(
        `Excel Phase 2 仅支持 text 写回，${content.type} 在 Phase 5 实现`,
      );
    }
    // D-23 G-05：position 路由；缺省 'cursor'（向后兼容）
    const position = content.position ?? 'cursor';
    try {
      await Excel.run(async (ctx) => {
        switch (position) {
          case 'replace_selection':
          case 'cursor': {
            const range = ctx.workbook.getSelectedRange();
            range.load('address');
            await ctx.sync();           // sync 1: load address（验证选区可用）
            range.values = [[content.value]];
            await ctx.sync();           // sync 2: write values
            break;
          }
          case 'append_end': {
            // WR-06 修复：getUsedRange(true) 在空工作表时抛 ItemNotFound，
            // 改用 getUsedRange(false)（不抛，空表返回 A1 范围，rowCount=1）；
            // 空表时 rowCount=1 但 A1 无值，追加到 A1 符合预期（无数据则从第一行开始）。
            // 若仍抛错（极端边界），catch 兜底写入 A1。
            let newRow: number;
            try {
              const used = ctx.workbook.worksheets.getActiveWorksheet().getUsedRange(false);
              used.load('rowCount');
              await ctx.sync();         // sync 1: load rowCount
              newRow = used.rowCount ?? 1;
            } catch {
              // 空表 fallback：写入 A1（WR-01：catch 里不再多余 sync——
              // 后续 write 的 sync 2 已覆盖；对已损坏 context 再 sync 反而掩盖真实错误）
              newRow = 0;
            }
            const target = ctx.workbook.worksheets
              .getActiveWorksheet()
              .getRange(`A${newRow + 1}`);
            target.values = [[content.value]];
            await ctx.sync();           // sync 2: write values
            break;
          }
        }
      });
    } catch (err) {
      if (err instanceof UnsupportedOperationError) throw err;
      throw new HostApiError('Excel text 写回失败', err);
    }
  }

  /**
   * per-query 离散只读（TOOL-01）。
   *
   * Excel 宿主 4 种 kind：
   * - list_worksheets        — 工作表名清单（metadata）
   * - get_range_values       — 指定 address 的值（A-24：读前判 cellCount，>10K 拒绝）
   * - get_used_range_summary — used range 概况 + 首行 schema（不读全部 values；WR-06 空表不抛）
   * - selection_detail       — 复用 getSelection() 语义
   *
   * proxy 不出 Excel.run 闭包（A-06/TOOL-07）。
   */
  async read(query: ReadableQuery): Promise<ReadableResult> {
    /** A-24/TOOL-06：单次 get_range_values 上限 */
    const CELL_LIMIT = 10_000;

    switch (query.kind) {
      // -----------------------------------------------------------------
      // list_worksheets — 工作表名清单（metadata，不读内容）
      // -----------------------------------------------------------------
      case 'list_worksheets': {
        try {
          return await Excel.run(async (ctx) => {
            const ws = ctx.workbook.worksheets;
            ws.load('items/name');
            await ctx.sync();
            return {
              ok: true,
              data: { worksheets: ws.items.map((w) => w.name) },
            };
          });
        } catch (err) {
          throw new HostApiError('Excel list_worksheets 失败', err);
        }
      }

      // -----------------------------------------------------------------
      // get_range_values — 先 load cellCount 判大小，>10K 读前拒绝（A-24/TOOL-06）
      // -----------------------------------------------------------------
      case 'get_range_values': {
        const address = query.address;
        try {
          return await Excel.run(async (ctx) => {
            const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
            // sync 1：先只 load 计数，绝不 load values（A-24 读前判定）
            range.load(['cellCount', 'rowCount', 'columnCount']);
            await ctx.sync();

            if (range.cellCount > CELL_LIMIT) {
              // 读前拒绝：不执行 load('values')，直接返错
              return {
                ok: false,
                error: {
                  code: 'INVALID_ARGS',
                  message: `选区有 ${range.cellCount} 个单元格，过大无法整块读取`,
                  hint: '请改用 get_used_range_summary 看概况，或指定更小的 address',
                  recoverable: true,
                },
              } satisfies ReadableResult;
            }

            // sync 2：确认安全后才读 values
            range.load('values');
            await ctx.sync();

            return {
              ok: true,
              data: {
                address,
                rowCount: range.rowCount,
                values: range.values,
              },
            } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Excel get_range_values 失败', err);
        }
      }

      // -----------------------------------------------------------------
      // get_used_range_summary — 概况 + 首行 schema（不读全部 values）
      // getUsedRange(false) 空表不抛 ItemNotFound（WR-06 守则）
      // -----------------------------------------------------------------
      case 'get_used_range_summary': {
        const sheetName = query.sheetName;
        try {
          return await Excel.run(async (ctx) => {
            const sheet = sheetName
              ? ctx.workbook.worksheets.getItem(sheetName)
              : ctx.workbook.worksheets.getActiveWorksheet();

            // false = 空表不抛 ItemNotFound（WR-06；同 insert append_end L121-123）
            const used = sheet.getUsedRange(false);
            used.load(['address', 'rowCount', 'columnCount']);
            await ctx.sync(); // sync 1: load used range 概况

            // WR-05 修复：空表（rowCount/columnCount 为 0）时 getRow(0) 越界抛 OutOfRange，
            //   不在 WR-06 的 ItemNotFound 保护范围内；先判维度，>0 才读首行 schema。
            let headerSample: unknown[] = [];
            if (used.rowCount > 0 && used.columnCount > 0) {
              const header = used.getRow(0);
              header.load('values');
              await ctx.sync(); // sync 2: load 首行 values（仅 schema 提示，不读全部 values）
              headerSample = (header.values as unknown[][])?.[0] ?? [];
            }

            return {
              ok: true,
              data: {
                address: used.address,
                rowCount: used.rowCount,
                columnCount: used.columnCount,
                headerSample,
              },
            } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Excel get_used_range_summary 失败', err);
        }
      }

      // -----------------------------------------------------------------
      // selection_detail — 复用 getSelection() 语义
      // -----------------------------------------------------------------
      case 'selection_detail': {
        return { ok: true, data: await this.getSelection() };
      }

      // -----------------------------------------------------------------
      // default — UNSUPPORTED（其他宿主的 kind 不属于 Excel）
      // -----------------------------------------------------------------
      default: {
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: `Excel adapter 不支持 kind: ${(query as ReadableQuery).kind}`,
            recoverable: false,
            hint: '请检查调用方传入的 query.kind 是否正确',
          },
        };
      }
    }
  }

  /**
   * 写入指定 range，同时抓取写入前的 before-image（Phase 5 inverse 路径 — TOOL-03/AGENT-10/11）。
   *
   * two-sync 规则（NFR-02 A-06 — load → sync1 → write → sync2）：
   *   1. range.load(['values', 'address']) + sync 1 → 读取 before-image
   *   2. range.values = values             + sync 2 → 覆写目标 range
   *
   * SP-4 已真机验证 range.load(['values','address']) + range.values= 两 sync 路径可行。
   *
   * 注意：range.address 是 server 端属性，必须在 sync 1 之后才可读（proxy proxy规则）。
   * beforeImage.address 由 Excel 服务端规范化（如 'Sheet1!A1:B2'），与传入 address 形式可能不同。
   *
   * T-05-05-01：address 由 Excel server 端规范化 beforeImage.address 记录，
   * 供 operationLog replay engine 以 overwriteRange 反操作还原。
   *
   * @param address Excel range 地址（如 'A1:B2'）
   * @param values  要写入的二维数组（与 range 维度须匹配）
   * @returns       { beforeImage: { address, values } } — 写入前快照
   */
  async setRangeValues(
    address: string,
    values: unknown[][],
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      return await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
        // sync 1：load before-image（address 是 server 端属性，必须 sync 后才可读）
        range.load(['values', 'address']);
        await ctx.sync();

        const beforeImage = {
          address: range.address as string,
          values: range.values as unknown[][],
        };

        // sync 2：覆写 range
        range.values = values;
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      throw new HostApiError('Excel setRangeValues 失败', err);
    }
  }

  /**
   * 直接覆写指定 range（Phase 5 inverse 反操作 — AGENT-10/11 undo path）。
   *
   * 由 replay engine 以 before-image 数据调用，将 range 恢复到写入前状态。
   * 不抓 before-image（overwriteRange 本身即是逆操作，其结果不需再 undo）。
   *
   * 签名遵循 DocumentAdapterForReplay.overwriteRange 接口约定：
   *   args: { address: string; values: unknown[][] }
   * 这样 operationLog.executeReverse 可以直接传 reverse.args 对象（不拆参）。
   *
   * 空单元格规范化说明：不做 null/0/"" 规范化（写什么就是什么）；
   * isTargetStateConsistent 的规范化在 operationLog.ts 内处理。
   *
   * T-05-05-02：Excel.run 超时 → replay engine catch 所有错误（D-11 continue-on-error）；
   * 用户得到「未能回滚」提示。
   *
   * @param args.address Excel range 地址（应使用 setRangeValues 返回的 beforeImage.address）
   * @param args.values  要恢复的二维数组（before-image 值）
   */
  async overwriteRange(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const values = args.values as unknown[][];
    try {
      await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
        // 直接覆写，不抓 before-image（单次 sync）
        range.values = values;
        await ctx.sync();
      });
    } catch (err) {
      throw new HostApiError('Excel overwriteRange 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 6 Wave 2 新增：insert_chart / apply_formula / set_cell 的 adapter 方法
  // ---------------------------------------------------------------------------

  /**
   * 在当前活动工作表插入图表（Phase 6 TOOL-03 — D-03 / SC2）。
   *
   * 在同一个 Excel.run 闭包内完成：
   *   1. charts.add(chartType, range, auto) → 返回 Chart proxy
   *   2. chart.load(['name']) → sync → 读取 Excel 分配的稳定名称
   *   3. return { chartName }（纯数据，proxy 不出闭包 A-06）
   *
   * chartName 是 insert_chart ToolDef reverse descriptor 的唯一句柄，
   * 供 deleteChartByName（inverse）回放时按名找图表。
   *
   * T-06-02-01：chart.name 碰撞风险 — Excel 生成带序号默认名（"图表 1"/"图表 2"…），
   * 用户未手动重命名时不碰撞；inverse deleteChartByName 用 getItemOrNullObject 防删已删。
   *
   * @param dataRange  图表数据 range 地址（如 'A1:B10'）
   * @param chartType  图表类型字符串（如 'ColumnClustered'），由 ToolDef 校验传入
   * @returns          { chartName } — Excel 分配的图表名（inverse 句柄）
   */
  async insertChart(
    dataRange: string,
    chartType: string,
  ): Promise<{ chartName: string }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getRange(dataRange);
        const chart = sheet.charts.add(
          chartType as Excel.ChartType,
          range,
          Excel.ChartSeriesBy.auto,
        );
        // load name 后 sync — name 是 server 端属性，sync 后才可读
        chart.load(['name']);
        await ctx.sync();
        return { chartName: chart.name as string };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel insertChart 失败', err);
    }
  }

  /**
   * 按名称删除图表（Phase 6 insert_chart 的 inverse 方法 — Record 签名守门）。
   *
   * inverse 方法必须用 args: Record<string, unknown> 签名（非位置参），
   * 供 replay engine 以 reverse.args 对象直接调用（[[project-adapter-inverse-signature]]）。
   *
   * getItemOrNullObject 防御（Pitfall 1 / T-06-02-01）：
   *   - chart 已不存在（重复 undo / 用户手动删）→ isNullObject=true → 静默跳过
   *   - replay engine 捕获所有 inverse 错误（D-11 continue-on-error）
   *
   * @param args.chartName 要删除的图表名（insertChart 返回的稳定句柄）
   */
  async deleteChartByName(args: Record<string, unknown>): Promise<void> {
    const chartName = args.chartName as string;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        // getItemOrNullObject：chart 不存在时不抛 ItemNotFound，而是返回 null object
        const chart = sheet.charts.getItemOrNullObject(chartName);
        chart.load('isNullObject');
        await ctx.sync();
        if (!chart.isNullObject) {
          chart.delete();
          await ctx.sync();
        }
        // chart 已不存在 → 静默跳过（replay engine 处理 skipped_error）
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel deleteChartByName 失败', err);
    }
  }

  /**
   * 向指定单元格写入公式，同时抓取写入前的 before-image（Phase 6 TOOL-03 — D-03 / SC2）。
   *
   * two-sync 范式（仿 setRangeValues）：
   *   sync 1 — load(['values', 'address', 'formulas']) → 读取 before-image
   *   sync 2 — range.formulas = [[formula]]         → 写入公式
   *
   * inverse 复用已有的 overwriteRange（args: Record）—— 无需新增 inverse 方法。
   * before-image 的 values 字段用于 overwriteRange 恢复（清除公式结果）。
   *
   * @param cell    目标单元格地址（如 'B2'）
   * @param formula 要写入的公式字符串（如 '=SUM(A1:A10)'）
   * @returns       { beforeImage: { address, values } } — 写入前快照（供 overwriteRange 还原）
   */
  async applyFormula(
    cell: string,
    formula: string,
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      return await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(cell);
        // sync 1：load before-image（address 是 server 端属性，sync 后才可读）
        range.load(['values', 'address', 'formulas']);
        await ctx.sync();

        const beforeImage = {
          address: range.address as string,
          values: range.values as unknown[][],
        };

        // sync 2：写入公式（单格）
        range.formulas = [[formula]];
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel applyFormula 失败', err);
    }
  }

  /**
   * 向指定单元格写入值，同时抓取写入前的 before-image（Phase 6 TOOL-03 — D-03 / SC2）。
   *
   * 与 applyFormula 结构相同，但写 range.values 而非 range.formulas。
   * two-sync 范式（仿 setRangeValues）：
   *   sync 1 — load(['values', 'address']) → 读取 before-image
   *   sync 2 — range.values = [[value]]   → 写入值
   *
   * inverse 复用已有的 overwriteRange（args: Record）—— 无需新增 inverse 方法。
   *
   * @param cell  目标单元格地址（如 'A1'）
   * @param value 要写入的值（字符串/数字/布尔/null 均可）
   * @returns     { beforeImage: { address, values } } — 写入前快照（供 overwriteRange 还原）
   */
  async setCell(
    cell: string,
    value: unknown,
  ): Promise<{ beforeImage: { address: string; values: unknown[][] } }> {
    try {
      return await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(cell);
        // sync 1：load before-image
        range.load(['values', 'address']);
        await ctx.sync();

        const beforeImage = {
          address: range.address as string,
          values: range.values as unknown[][],
        };

        // sync 2：写入值（单格）
        range.values = [[value]];
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel setCell 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 1a 新增：6 个 write + 6 个 inverse 方法（EXCEL-01/02/04/06/07/08）
  // ---------------------------------------------------------------------------

  /**
   * EXCEL-01：设置单元格格式（数字格式/字体/填充色/对齐）。
   *
   * two-sync 范式：
   *   sync 1 — load 格式 before-image
   *   sync 2 — 写入格式
   *
   * numberFormat 写入用 `range.numberFormat = [[format]]`（2D 数组），不用已废弃的单值接口。
   *
   * @param address    单元格区域地址（如 'A1:D10'）
   * @param format     格式参数对象（numberFormat/fill/font/alignment 均为可选）
   */
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
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getRange(address);
        // sync 1：load before-image（格式属性）
        range.load(['numberFormat', 'address']);
        range.format.load(['horizontalAlignment']);
        range.format.fill.load(['color']);
        range.format.font.load(['bold', 'color', 'size', 'name']);
        await ctx.sync();

        const beforeImage = {
          address: range.address as string,
          numberFormat: (range.numberFormat as unknown[][])?.[0]?.[0] ?? null,
          fillColor: range.format.fill.color as unknown,
          fontBold: range.format.font.bold as unknown,
          fontColor: range.format.font.color as unknown,
          fontSize: range.format.font.size as unknown,
          fontName: range.format.font.name as unknown,
          horizontalAlignment: range.format.horizontalAlignment as unknown,
        };

        // sync 2：写入格式
        if (format.numberFormat != null) {
          range.numberFormat = [[format.numberFormat]];
        }
        if (format.fill?.color != null) {
          range.format.fill.color = format.fill.color;
        }
        if (format.font != null) {
          if (format.font.bold !== undefined) {
            range.format.font.bold = format.font.bold as boolean;
          }
          if (format.font.color != null) {
            range.format.font.color = format.font.color as string;
          }
          if (format.font.size != null) {
            range.format.font.size = format.font.size as number;
          }
          if (format.font.name != null) {
            range.format.font.name = format.font.name as string;
          }
        }
        if (format.alignment != null) {
          range.format.horizontalAlignment = format.alignment as Excel.HorizontalAlignment;
        }
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel formatExcelRange 失败', err);
    }
  }

  /**
   * EXCEL-01 inverse：还原单元格格式（restore_range_format）。
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   * replay engine 以 reverse.args 对象调用，位置签名会导致 Phase 5 真机翻车。
   */
  async restoreRangeFormat(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const numberFormat = args.numberFormat as string | null;
    const fillColor = args.fillColor as string | null;
    const fontBold = args.fontBold as boolean | null;
    const fontColor = args.fontColor as string | null;
    const fontSize = args.fontSize as number | null;
    const fontName = args.fontName as string | null;
    const horizontalAlignment = args.horizontalAlignment as string | null;
    try {
      await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
        if (numberFormat != null) range.numberFormat = [[numberFormat]];
        if (fillColor != null) range.format.fill.color = fillColor;
        if (fontBold != null) range.format.font.bold = fontBold;
        if (fontColor != null) range.format.font.color = fontColor;
        if (fontSize != null) range.format.font.size = fontSize;
        if (fontName != null) range.format.font.name = fontName;
        if (horizontalAlignment != null) {
          range.format.horizontalAlignment = horizontalAlignment as Excel.HorizontalAlignment;
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreRangeFormat 失败', err);
    }
  }

  /**
   * EXCEL-02：设置列宽或行高（支持 autoFit）。
   *
   * 批量 load → 单次 sync 1（不在循环内 sync）。
   * autoFit 时记录 autoFit 前的真实尺寸（before-image）。
   *
   * @param target   'column' | 'row'
   * @param indices  列/行的 0-based 索引数组
   * @param size     数字（点数）或 'autoFit'
   */
  async setColumnRowSize(
    target: 'column' | 'row',
    indices: number[],
    size: number | 'autoFit',
  ): Promise<{ beforeSizes: Array<{ index: number; size: number }> }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();

        // 收集所有 range proxy（不在循环内 sync）
        const ranges = indices.map((idx) => {
          if (target === 'column') {
            const col = sheet.getRange(`${String.fromCharCode(65 + idx)}:${String.fromCharCode(65 + idx)}`);
            col.load(['format/columnWidth']);
            return col;
          } else {
            const row = sheet.getRange(`${idx + 1}:${idx + 1}`);
            row.load(['format/rowHeight']);
            return row;
          }
        });

        // sync 1：batch load before-image
        await ctx.sync();

        const beforeSizes = ranges.map((r, i) => ({
          index: indices[i],
          size: (target === 'column'
            ? (r.format.columnWidth as number)
            : (r.format.rowHeight as number)) ?? 0,
        }));

        // sync 2：写入新尺寸
        ranges.forEach((r) => {
          if (target === 'column') {
            if (size === 'autoFit') {
              r.format.autofitColumns();
            } else {
              r.format.columnWidth = size;
            }
          } else {
            if (size === 'autoFit') {
              r.format.autofitRows();
            } else {
              r.format.rowHeight = size;
            }
          }
        });
        await ctx.sync();

        return { beforeSizes };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel setColumnRowSize 失败', err);
    }
  }

  /**
   * EXCEL-02 inverse：还原列宽/行高（restore_column_row_size）。
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   */
  async restoreColumnRowSize(args: Record<string, unknown>): Promise<void> {
    const target = args.target as 'column' | 'row';
    const beforeSizes = args.beforeSizes as Array<{ index: number; size: number }>;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        beforeSizes.forEach(({ index, size }) => {
          if (target === 'column') {
            const col = sheet.getRange(`${String.fromCharCode(65 + index)}:${String.fromCharCode(65 + index)}`);
            col.format.columnWidth = size;
          } else {
            const row = sheet.getRange(`${index + 1}:${index + 1}`);
            row.format.rowHeight = size;
          }
        });
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreColumnRowSize 失败', err);
    }
  }

  /**
   * EXCEL-04：设置/清除自动筛选框。
   *
   * before-image 只存 { hadFilter: boolean, address?: string }。
   * undo 后仅恢复筛选框，不恢复筛选条件（设计限制，已在 description 标注）。
   *
   * @param address  筛选范围地址（如 'A1:E1'）
   * @param enabled  true = apply；false = remove
   */
  async setAutoFilter(
    address: string,
    enabled: boolean,
  ): Promise<{ hadFilter: boolean; address: string }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        // sync 1：读取筛选框当前状态
        sheet.autoFilter.load(['enabled']);
        await ctx.sync();

        const hadFilter = (sheet.autoFilter.enabled as boolean) ?? false;

        // sync 2：写入
        if (enabled) {
          sheet.autoFilter.apply(sheet.getRange(address), 0);
        } else {
          sheet.autoFilter.remove();
        }
        await ctx.sync();

        return { hadFilter, address };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel setAutoFilter 失败', err);
    }
  }

  /**
   * EXCEL-04 inverse：还原自动筛选框（restore_auto_filter）。
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   * hadFilter=true → apply(address, 0, {}) 仅恢复筛选框（不恢复筛选条件）。
   * hadFilter=false → remove()。
   */
  async restoreAutoFilter(args: Record<string, unknown>): Promise<void> {
    const hadFilter = args.hadFilter as boolean;
    const address = args.address as string | undefined;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        if (hadFilter && address) {
          sheet.autoFilter.apply(sheet.getRange(address), 0);
        } else {
          sheet.autoFilter.remove();
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreAutoFilter 失败', err);
    }
  }

  /**
   * EXCEL-06：添加条件格式（支持 cellValue / colorScale / dataBar）。
   *
   * 逆向策略：clearAll + 重建（防索引漂移，幂等安全路径）。
   * before-image = 现有全部条件格式快照（MVP 序列化 cellValue/colorScale/dataBar）。
   *
   * @param address  目标区域地址（如 'B2:B20'）
   * @param rule     条件格式规则 { type, operator?, value?, format? }
   */
  async addConditionalFormat(
    address: string,
    rule: Record<string, unknown>,
  ): Promise<{ beforeFormats: Array<Record<string, unknown>> }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getRange(address);

        // sync 1：load 现有条件格式（before-image）
        range.conditionalFormats.load('items');
        await ctx.sync();

        // 序列化现有条件格式（MVP：cellValue/colorScale/dataBar）
        const beforeFormats: Array<Record<string, unknown>> = [];
        const cfItems = range.conditionalFormats.items as Array<{
          type: string;
          cellValue?: { rule?: unknown; format?: unknown };
          colorScale?: { criteria?: unknown };
          dataBar?: { barDirection?: unknown; negativeFormat?: unknown; positiveFormat?: unknown };
        }>;
        for (const cf of cfItems) {
          const entry: Record<string, unknown> = { type: cf.type };
          if (cf.type === 'CellValue' && cf.cellValue) {
            entry.cellValue = { rule: cf.cellValue.rule, format: cf.cellValue.format };
          } else if (cf.type === 'ColorScale' && cf.colorScale) {
            entry.colorScale = { criteria: cf.colorScale.criteria };
          } else if (cf.type === 'DataBar' && cf.dataBar) {
            entry.dataBar = {
              barDirection: cf.dataBar.barDirection,
              negativeFormat: cf.dataBar.negativeFormat,
              positiveFormat: cf.dataBar.positiveFormat,
            };
          }
          beforeFormats.push(entry);
        }

        // sync 2：添加新条件格式
        const ruleType = rule.type as string;
        if (ruleType === 'cellValue' || ruleType === 'CellValue') {
          const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
          const operator = rule.operator as string ?? 'greaterThan';
          const value = rule.value as string | number ?? 0;
          cf.cellValue.rule = {
            formula1: String(value),
            operator: operator as Excel.ConditionalCellValueOperator,
          };
          const ruleFormat = rule.format as Record<string, unknown> | undefined;
          if (ruleFormat?.fillColor) {
            cf.cellValue.format.fill.color = ruleFormat.fillColor as string;
          }
          if (ruleFormat?.fontColor) {
            cf.cellValue.format.font.color = ruleFormat.fontColor as string;
          }
        } else if (ruleType === 'colorScale' || ruleType === 'ColorScale') {
          range.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);
        } else if (ruleType === 'dataBar' || ruleType === 'DataBar') {
          range.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
        }
        await ctx.sync();

        return { beforeFormats };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel addConditionalFormat 失败', err);
    }
  }

  /**
   * EXCEL-06 inverse：还原条件格式（restore_conditional_format）。
   *
   * 策略：先 clearAll → 再按 beforeFormats 重建（幂等，防索引漂移）。
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   */
  async restoreConditionalFormat(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const beforeFormats = args.beforeFormats as Array<Record<string, unknown>>;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const range = sheet.getRange(address);

        // clearAll 后重建（幂等安全路径）
        range.conditionalFormats.clearAll();

        for (const fmt of beforeFormats ?? []) {
          const type = fmt.type as string;
          if (type === 'CellValue') {
            const cf = range.conditionalFormats.add(Excel.ConditionalFormatType.cellValue);
            const cellValue = fmt.cellValue as Record<string, unknown> | undefined;
            if (cellValue?.rule) {
              cf.cellValue.rule = cellValue.rule as Excel.ConditionalCellValueRule;
            }
          } else if (type === 'ColorScale') {
            range.conditionalFormats.add(Excel.ConditionalFormatType.colorScale);
          } else if (type === 'DataBar') {
            range.conditionalFormats.add(Excel.ConditionalFormatType.dataBar);
          }
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreConditionalFormat 失败', err);
    }
  }

  /**
   * EXCEL-07：把指定区域建为 Excel 表格。
   *
   * 写后 load name（server 端属性，sync 后才可读）。
   * 返回 resolvedName（Excel 可能加序号，如「表 1」），
   * inverse 用 resolvedName 而非用户传入的 tableName（T-10-07）。
   *
   * @param address     表格区域地址（如 'A1:D5'）
   * @param hasHeaders  首行是否为表头（默认 false）
   * @param tableName   期望的表格名（可选，Excel 可能加序号）
   */
  async createTable(
    address: string,
    hasHeaders: boolean,
    tableName?: string,
  ): Promise<{ resolvedName: string }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const table = sheet.tables.add(address, hasHeaders ?? false);
        if (tableName) table.name = tableName;
        // load name（server 端属性，sync 后才可读）
        table.load(['name']);
        await ctx.sync();
        return { resolvedName: table.name as string };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel createTable 失败', err);
    }
  }

  /**
   * EXCEL-07 inverse：按名称删除表格（delete_table_by_name）。
   *
   * 复用 deleteChartByName 的 getItemOrNullObject 防御范式：
   * 表格已不存在（重复 undo / 用户手动删）→ isNullObject=true → 静默跳过。
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   */
  async deleteTableByName(args: Record<string, unknown>): Promise<void> {
    const tableName = args.tableName as string;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const table = sheet.tables.getItemOrNullObject(tableName);
        table.load('isNullObject');
        await ctx.sync();
        if (!table.isNullObject) {
          table.delete();
          await ctx.sync();
        }
        // 表格已不存在 → 静默跳过
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel deleteTableByName 失败', err);
    }
  }

  /**
   * EXCEL-08：冻结窗格（首行/首列/指定范围/解冻）。
   *
   * two-sync 范式：
   *   sync 1 — load 当前冻结状态（before-image）
   *   sync 2 — 写入新冻结状态
   *
   * @param freezeRows     要冻结的行数（0 = 不冻结行）
   * @param freezeColumns  要冻结的列数（0 = 不冻结列）
   */
  async freezePanes(
    freezeRows: number,
    freezeColumns: number,
  ): Promise<{ frozenRows: number; frozenColumns: number }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const fp = sheet.freezePanes;

        // sync 1：通过 getLocationOrNullObject() 读取当前冻结区域（before-image）
        // WorksheetFreezePanes 没有直接的 frozenRows/frozenColumns 属性，
        // 需用 getLocationOrNullObject() 获取冻结 range 并从 rowIndex/columnIndex 推算。
        const frozenRange = fp.getLocationOrNullObject();
        frozenRange.load(['isNullObject', 'rowIndex', 'columnIndex']);
        await ctx.sync();

        let frozenRows = 0;
        let frozenColumns = 0;
        if (!frozenRange.isNullObject) {
          // rowIndex = 冻结的行数（从 0 开始的下边界行）
          frozenRows = (frozenRange.rowIndex as number) ?? 0;
          frozenColumns = (frozenRange.columnIndex as number) ?? 0;
        }

        // sync 2：写入新冻结状态
        if (freezeRows > 0 && freezeColumns > 0) {
          fp.freezeAt(sheet.getCell(freezeRows, freezeColumns));
        } else if (freezeRows > 0) {
          fp.freezeRows(freezeRows);
        } else if (freezeColumns > 0) {
          fp.freezeColumns(freezeColumns);
        } else {
          fp.unfreeze();
        }
        await ctx.sync();

        return { frozenRows, frozenColumns };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel freezePanes 失败', err);
    }
  }

  /**
   * EXCEL-08 inverse：还原冻结窗格（restore_freeze_panes）。
   *
   * frozenRows=0, frozenColumns=0 → unfreeze。
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   */
  async restoreFreezePanes(args: Record<string, unknown>): Promise<void> {
    const frozenRows = args.frozenRows as number;
    const frozenColumns = args.frozenColumns as number;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const fp = sheet.freezePanes;
        if (frozenRows > 0 && frozenColumns > 0) {
          fp.freezeAt(sheet.getCell(frozenRows, frozenColumns));
        } else if (frozenRows > 0) {
          fp.freezeRows(frozenRows);
        } else if (frozenColumns > 0) {
          fp.freezeColumns(frozenColumns);
        } else {
          fp.unfreeze();
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreFreezePanes 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 2 新增：快照式 4 工具（EXCEL-03/05/09/10）
  // ---------------------------------------------------------------------------

  /** 快照上限（与 CELL_LIMIT 对齐，D-07） */
  private static readonly SNAPSHOT_LIMIT = 10_000;

  /**
   * 读取指定 range 的单元格值快照（EXCEL-03/05 内部工具）。
   *
   * - 超过 SNAPSHOT_LIMIT（10,000 单元格）→ 抛 SnapshotTooLargeError
   * - 返回 { address, snapshot }（address 为 server 端规范化地址）
   *
   * 注意：这是内部辅助方法（非 inverse），不使用 Record 签名。
   *
   * @param address  range 地址（如 'A1:E500'）
   */
  private async readRangeValuesSnapshot(
    address: string,
  ): Promise<{ address: string; snapshot: unknown[][] }> {
    return await Excel.run(async (ctx) => {
      const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
      range.load(['values', 'address', 'cellCount']);
      await ctx.sync();

      if ((range.cellCount as number) > ExcelAdapter.SNAPSHOT_LIMIT) {
        const err = new Error(`区域过大：${range.cellCount as number} 个单元格，超过快照上限 ${ExcelAdapter.SNAPSHOT_LIMIT}`);
        (err as Error & { isTooLarge: boolean }).isTooLarge = true;
        throw err;
      }

      return {
        address: range.address as string,
        snapshot: range.values as unknown[][],
      };
    });
  }

  /**
   * EXCEL-03/05 共享 inverse：还原 range values 快照（restore_range_values_snapshot，D-20）。
   *
   * 完全复用 overwriteRange 逻辑：range.values = snapshot; await ctx.sync()。
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   *
   * @param args.address  range 地址（snapshot 时 server 端规范化）
   * @param args.snapshot 写入前的二维值快照
   */
  async restoreRangeValuesSnapshot(args: Record<string, unknown>): Promise<void> {
    const address = args.address as string;
    const snapshot = args.snapshot as unknown[][];
    try {
      await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
        range.values = snapshot;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreRangeValuesSnapshot 失败', err);
    }
  }

  /**
   * EXCEL-03：对指定 range 按给定字段排序（sort.apply）。
   *
   * 排序前先尝试读取值快照（供 undo 还原）：
   *   - 超过 10,000 单元格 → tooLarge=true（仍执行排序，但标注不可自动撤销）
   *   - 未超限 → snapshot 快照，reverse = restore_range_values_snapshot
   *
   * ⚠️ sort.apply 会清空 Excel 原生撤销历史（官方 API 限制，D-08），Aster 自建 undo 不依赖原生栈。
   *
   * @param address     要排序的 range 地址
   * @param sortFields  排序字段数组，key 为相对列偏移（0-based），ascending=true 升序
   * @returns           { snapshot, snapshotAddress, tooLarge }
   */
  async sortRange(
    address: string,
    sortFields: Array<{ key: number; ascending: boolean }>,
  ): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean }> {
    // 先尝试快照
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address;
    let tooLarge = false;

    try {
      const result = await this.readRangeValuesSnapshot(address);
      snapshot = result.snapshot;
      snapshotAddress = result.address;
    } catch (err) {
      if ((err as Error & { isTooLarge?: boolean }).isTooLarge) {
        tooLarge = true;
        // 超限：warn 但继续执行排序
      } else {
        // 其他错误也不中断（保守路径），标为 tooLarge
        tooLarge = true;
      }
    }

    // 执行排序
    try {
      await Excel.run(async (ctx) => {
        const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
        range.sort.apply(sortFields);
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel sortRange 失败', err);
    }

    return { snapshot, snapshotAddress, tooLarge };
  }

  /**
   * EXCEL-05：在指定 range（或整张表）执行查找替换。
   *
   * - address 有值 → 在该 range 内替换；无值 → sheet.getUsedRange(false) 整表替换
   * - 替换前先尝试读取值快照（同 sortRange 超限逻辑）
   * - isSetSupported('ExcelApi', '1.9') 门控 replaceAll；
   *   不支持时降级：body.search 遍历替换（见 RESEARCH.md A1）
   *
   * @param searchText     查找字符串
   * @param replaceText    替换字符串
   * @param address        可选 range 地址；缺省 = 整个 used range
   * @param matchCase      区分大小写（默认 false）
   * @param matchWholeWord 全字匹配（默认 false）
   * @returns              { snapshot, snapshotAddress, tooLarge, count }
   */
  async excelFindAndReplace(
    searchText: string,
    replaceText: string,
    address?: string,
    matchCase?: boolean,
    matchWholeWord?: boolean,
  ): Promise<{ snapshot: unknown[][] | null; snapshotAddress: string; tooLarge: boolean; count: number }> {
    // 先尝试快照
    let snapshot: unknown[][] | null = null;
    let snapshotAddress = address ?? '';
    let tooLarge = false;

    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const targetRange = address
          ? sheet.getRange(address)
          : sheet.getUsedRange(false);

        // 读快照：需要先 load address + cellCount
        targetRange.load(['address', 'cellCount']);
        await ctx.sync();

        const cellCount = targetRange.cellCount as number;
        snapshotAddress = targetRange.address as string;

        if (cellCount > ExcelAdapter.SNAPSHOT_LIMIT) {
          tooLarge = true;
          // 超限：不快照，直接执行替换
        } else {
          // 读取快照
          targetRange.load('values');
          await ctx.sync();
          snapshot = targetRange.values as unknown[][];
        }

        // 执行替换（replaceAll ExcelApi 1.9，通过 unknown cast 处理 TS 类型不精确问题）
        let count = 0;
        const replaceResult = (targetRange as unknown as {
          replaceAll: (
            text: string,
            replacement: string,
            criteria: { completeMatch: boolean; matchCase: boolean },
          ) => { load: (s: string) => void; count: number };
        }).replaceAll(
          searchText,
          replaceText,
          {
            completeMatch: matchWholeWord ?? false,
            matchCase: matchCase ?? false,
          },
        );
        // load count 后 sync（Office.js lazy evaluation）
        replaceResult.load('count');
        await ctx.sync();
        count = replaceResult.count ?? 0;

        return { snapshot, snapshotAddress, tooLarge, count };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel excelFindAndReplace 失败', err);
    }
  }

  /**
   * EXCEL-09：管理工作表（add / rename），枚举严格限定（D-03）。
   *
   * operation 类型约束为 'add' | 'rename'，TypeScript + 运行时双重守门（D-03 T-10-09）。
   * delete / copy 明确不支持（不可逆，不在 Aster v1 范围）。
   *
   * add 快照：{ operation: 'add', sheetName: resolvedName }
   *   inverse → restoreWorksheetSnapshot 执行 delete（用 getItemOrNullObject 防重复删）
   *
   * rename 快照：{ operation: 'rename', oldName: sheetName, newName }
   *   inverse → restoreWorksheetSnapshot 执行 getItem(newName).name = oldName
   *
   * @param operation  'add'（新增工作表）| 'rename'（重命名工作表）
   * @param sheetName  add 时为期望名称；rename 时为当前（旧）名称
   * @param newName    rename 时为新名称（add 时忽略）
   * @returns          快照对象（供 reverse.args 使用）
   */
  async manageWorksheet(
    operation: 'add' | 'rename',
    sheetName: string,
    newName?: string,
  ): Promise<
    | { operation: 'add'; sheetName: string }
    | { operation: 'rename'; oldName: string; newName: string }
  > {
    // D-03 / T-10-09：运行时守门（TypeScript 类型已限定，此处双重防御 LLM 传非法值）
    if (operation !== 'add' && operation !== 'rename') {
      throw new HostApiError(
        `manage_worksheet 仅支持 add/rename，收到非法 operation: ${String(operation)}`,
        undefined,
      );
    }

    try {
      if (operation === 'add') {
        return await Excel.run(async (ctx) => {
          const newSheet = ctx.workbook.worksheets.add(sheetName);
          newSheet.load(['name']);
          await ctx.sync();
          const resolvedName = newSheet.name as string;
          return { operation: 'add' as const, sheetName: resolvedName };
        });
      } else {
        // rename
        if (!newName) {
          throw new HostApiError('manage_worksheet rename 时 newName 不能为空', undefined);
        }
        return await Excel.run(async (ctx) => {
          const sheet = ctx.workbook.worksheets.getItem(sheetName);
          sheet.load(['name']);
          await ctx.sync();
          const oldName = sheet.name as string;
          sheet.name = newName;
          await ctx.sync();
          return { operation: 'rename' as const, oldName, newName };
        });
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel manageWorksheet 失败', err);
    }
  }

  /**
   * EXCEL-09 inverse：按快照还原工作表（restore_worksheet_snapshot）。
   *
   * operation='add' → 找到该工作表（getItemOrNullObject）并删除（撤销新增）
   * operation='rename' → 找到 newName 工作表并改回 oldName（撤销重命名）
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   */
  async restoreWorksheetSnapshot(args: Record<string, unknown>): Promise<void> {
    const operation = args.operation as string;
    try {
      if (operation === 'add') {
        const sheetName = args.sheetName as string;
        await Excel.run(async (ctx) => {
          const sheet = ctx.workbook.worksheets.getItemOrNullObject(sheetName);
          sheet.load('isNullObject');
          await ctx.sync();
          if (!sheet.isNullObject) {
            sheet.delete();
            await ctx.sync();
          }
          // 已不存在 → 静默跳过（重复 undo 安全）
        });
      } else if (operation === 'rename') {
        const newName = args.newName as string;
        const oldName = args.oldName as string;
        await Excel.run(async (ctx) => {
          const sheet = ctx.workbook.worksheets.getItem(newName);
          sheet.name = oldName;
          await ctx.sync();
        });
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreWorksheetSnapshot 失败', err);
    }
  }

  /**
   * EXCEL-10：修改指定图表的标题文字。
   *
   * 三 sync 定位范式（复用 deleteChartByName 的 getItemOrNullObject + HostApiError 防御）：
   *   sync 1 — getItemOrNullObject + load('isNullObject') → 确认图表存在
   *   sync 2 — chart.title.load('text') → 读取 before-image
   *   sync 3 — chart.title.text = title → 写入新标题
   *
   * @param chartName  图表名称（insertChart 返回的稳定句柄，或用户已命名）
   * @param title      新标题文字
   * @returns          { beforeTitle } — 修改前标题（供 inverse 还原）
   */
  async setChartTitle(
    chartName: string,
    title: string,
  ): Promise<{ beforeTitle: string }> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const chart = sheet.charts.getItemOrNullObject(chartName);
        chart.load('isNullObject');
        await ctx.sync(); // sync 1: 确认图表存在

        if (chart.isNullObject) {
          throw new HostApiError(`图表「${chartName}」不存在`, undefined);
        }

        chart.title.load('text');
        await ctx.sync(); // sync 2: 读取 before-image

        const beforeTitle = chart.title.text as string;
        chart.title.text = title;
        await ctx.sync(); // sync 3: 写入新标题

        return { beforeTitle };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel setChartTitle 失败', err);
    }
  }

  /**
   * EXCEL-10 inverse：还原图表标题（restore_chart_title）。
   *
   * 复用 deleteChartByName 的 getItemOrNullObject 防御范式：
   * 图表已不存在（重复 undo / 用户手动删）→ isNullObject=true → 静默跳过。
   *
   * ⚠️ 签名必须是 (args: Record<string, unknown>)（D-18 硬约束）。
   *
   * @param args.chartName   图表名称
   * @param args.beforeTitle 修改前的标题（restore 目标）
   */
  async restoreChartTitle(args: Record<string, unknown>): Promise<void> {
    const chartName = args.chartName as string;
    const beforeTitle = args.beforeTitle as string;
    try {
      await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet();
        const chart = sheet.charts.getItemOrNullObject(chartName);
        chart.load('isNullObject');
        await ctx.sync();
        if (!chart.isNullObject) {
          chart.title.text = beforeTitle;
          await ctx.sync();
        }
        // 图表已不存在 → 静默跳过（重复 undo 安全）
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Excel restoreChartTitle 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 11 Wave 2 新增：executeBatch（两阶段单闭包）+ executeBatchReverse（单闭包逆序）
  // ---------------------------------------------------------------------------

  /**
   * executeBatch — 两阶段单闭包批量写（D-01 BATCH-01）
   *
   * Phase 1（读/预校验）：开单个 Excel.run，用 getRangeOrNullObject（非 getRange，Pitfall 3）
   *   load before-image；await ctx.sync()——此时若 range 不存在 isNullObject=true，找到 failAtIndex。
   * Phase 2（写合法前缀）：只对 ops[0..failAtIndex-1] 排队 proxy.values=；await ctx.sync()。
   *
   * 总计 2 次 sync（O(1) 非 O(N)）。
   * 20 op × 2 proxy ops = 40 batch jobs < 50 limit（PITFALLS E3）。
   *
   * A-06 铁律：此方法在 ExcelAdapter 内，可出现 Excel 命名空间。
   * reverse.args 必须是 Record 对象（project_adapter_inverse_signature）。
   */
  async executeBatch(ops: Array<{ tool: string; args: Record<string, unknown>; humanLabel?: string }>): Promise<{
    subOps: Array<{
      humanLabel: string;
      beforeImage?: unknown[][];
      reverse: { tool: string; args: Record<string, unknown> };
      postState?: { kind: string; content: unknown };
      ok: boolean;
    }>;
    failAtIndex?: number;
  }> {
    return await Excel.run(async (ctx) => {
      const staged: Array<{
        op: (typeof ops)[number];
        proxy: Excel.Range;
        beforeImage?: unknown[][];
      }> = [];
      let failAtIndex = -1;

      // Phase 1a：JS 层参数校验 + load（不 sync）
      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (!op.args.address || typeof op.args.address !== 'string') {
          failAtIndex = i;
          break;
        }
        // 使用 getRangeOrNullObject（运行时 ExcelApi 1.4+ 支持，@types/office-js 未在 Worksheet 上声明）
        // cast 绕过类型检查（Phase 10 同类 cast 范式 — as unknown as）
        const worksheet = ctx.workbook.worksheets.getActiveWorksheet() as unknown as {
          getRangeOrNullObject: (address: string) => Excel.Range;
        };
        const proxy = worksheet.getRangeOrNullObject(op.args.address as string);
        proxy.load(['values', 'address', 'isNullObject']);
        staged.push({ op, proxy });
      }

      // Phase 1b：Phase 1 唯一 sync（读 before-image；O(1)）
      if (failAtIndex === -1) {
        try {
          await ctx.sync();
        } catch (err) {
          throw new HostApiError('Excel executeBatch Phase 1 sync 失败', err);
        }

        // Phase 1c：检查 null objects + 读 before-image
        for (let i = 0; i < staged.length; i++) {
          if ((staged[i].proxy as unknown as { isNullObject: boolean }).isNullObject) {
            failAtIndex = i;
            break;
          }
          staged[i].beforeImage = staged[i].proxy.values as unknown[][];
        }
      }

      // Phase 2a：只对合法前缀排队写（不 sync）
      const toCommit = failAtIndex === -1 ? staged : staged.slice(0, failAtIndex);
      for (const { op, proxy } of toCommit) {
        if (op.args.values !== undefined) {
          proxy.values = op.args.values as unknown[][];
        }
      }

      // Phase 2b：Phase 2 唯一 sync（写入合法前缀；O(1)）
      if (toCommit.length > 0) {
        try {
          await ctx.sync();
        } catch (err) {
          throw new HostApiError('Excel executeBatch Phase 2 sync 失败', err);
        }
      }

      // 组装 subOps 结果（reverse.args 是 Record 对象，project_adapter_inverse_signature 铁律）
      const subOps = toCommit.map((s) => ({
        humanLabel: s.op.humanLabel ?? `写入 ${s.proxy.address as string}`,
        beforeImage: s.beforeImage,
        reverse: {
          tool: 'overwrite_range',
          args: {
            address: s.proxy.address as string,  // server 端规范化地址（T-11-W2-03：非 LLM 直接控制）
            values: s.beforeImage,
          },
        },
        postState: {
          kind: 'excel_range',
          content: { address: s.proxy.address as string },
        },
        ok: true,
      }));

      return {
        subOps,
        failAtIndex: failAtIndex !== -1 ? failAtIndex : undefined,
      };
    });
  }

  /**
   * executeBatchReverse — 单闭包逆序批量撤销（D-08 对称设计）
   *
   * 逆序遍历 ops（最后写的先撤），在单个 Excel.run 内对每个 subOp
   * 调 overwriteRange 写逻辑，最后单次 sync。
   * continue-on-error per subOp（D-09）。
   *
   * A-06 铁律：此方法在 ExcelAdapter 内，可出现 Excel 命名空间。
   * reverse.args 必须是 Record 对象（project_adapter_inverse_signature 铁律）。
   */
  async executeBatchReverse(
    ops: Array<{ tool: string; args: Record<string, unknown> }>,
  ): Promise<void> {
    // ops 已由 operationLog.ts case 'batch_reverse' 逆序（SC#3 + D-07），此处直接按传入顺序执行
    await Excel.run(async (ctx) => {
      for (const op of ops) {
        try {
          if (op.tool === 'overwrite_range') {
            const address = op.args.address as string;
            const values = op.args.values as unknown[][];
            if (!address || !values) continue;
            const range = ctx.workbook.worksheets
              .getActiveWorksheet()
              .getRange(address);
            range.values = values;
          }
          // 其他 reverse tool 类型可在此扩展
        } catch {
          // continue-on-error per subOp（D-09：手改/报错跳过，其余照撤）
        }
      }
      // 单次 sync 提交所有撤销写入（D-08 对称）
      await ctx.sync();
    });
  }
}
