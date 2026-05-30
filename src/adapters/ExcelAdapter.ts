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
}
