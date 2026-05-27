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
   * Excel 宿主能力声明（Phase 1 桩）。
   */
  capabilities(): AdapterCapabilities {
    return {
      host: 'excel',
      supportsSelectionEvents: true,
      supportedInserts: ['formula', 'range-values', 'text'],
    };
  }

  /**
   * Excel 写回桩（Phase 5 实现）。
   * Phase 1 抛 UnsupportedOperationError（T-01-08 accept）。
   */
  async insert(_content: InsertableContent): Promise<void> {
    throw new UnsupportedOperationError('Excel 写回在 Phase 5 实现');
  }
}
