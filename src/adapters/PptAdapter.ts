/**
 * PptAdapter — PowerPoint 宿主 adapter 实现（FOUND-05, NFR-05）
 *
 * API 混用守则（spike #5022）：
 * 禁止在同一路径中混用 setSelectedDataAsync 与 PowerPoint.run。
 * 本 adapter 统一使用 PowerPoint.run 读取选区，不使用 setSelectedDataAsync。
 *
 * PPT-05 守则：getSelectedSlides() 结果按 .index 排序后再用（绕 Web 反序 bug #3618）。
 *
 * 安全约束（T-01-06）：getSelection() 仅读取 slide 序号（元数据），
 * 不读取 slide 正文内容，不留存文本。
 */
import type {
  DocumentAdapter,
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../errors';

export class PptAdapter implements DocumentAdapter {
  /**
   * 获取 PPT 当前选中 slide 的上下文。
   * - 有选中 → { kind: 'ppt', slideIndex, slideCount }
   *   slideIndex：第一个选中 slide 的 1-based 序号（PPT-05 守则：按 .index 排序后取第一个）
   * - 无选中 → { kind: 'none' }（D-16）
   * - Office.js 异常 → 包成 HostApiError
   */
  async getSelection(): Promise<SelectionContext> {
    try {
      return await PowerPoint.run(async (ctx) => {
        const selectedSlides = ctx.presentation.getSelectedSlides();
        selectedSlides.load('items');

        const allSlides = ctx.presentation.slides;
        allSlides.load('items');

        await ctx.sync();

        const selectedItems = selectedSlides.items;
        const totalCount = allSlides.items.length;

        if (selectedItems.length === 0) {
          return { kind: 'none' } satisfies SelectionContext;
        }

        // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618）
        const sorted = [...selectedItems].sort((a, b) => a.index - b.index);
        const firstSelected = sorted[0];

        // slideIndex 为 1-based（「第 N 张」对应 index 为 0-based）
        return {
          kind: 'ppt',
          slideIndex: firstSelected.index + 1,
          slideCount: totalCount,
        } satisfies SelectionContext;
      });
    } catch (err) {
      // Office.js 异常包成 HostApiError（T-01-06 不暴露原始 err 给用户，仅 hostError 字段调试）
      throw new HostApiError('PowerPoint getSelection 失败', err);
    }
  }

  /**
   * 订阅 PPT DocumentSelectionChanged 事件（D-13）。
   * 返回解绑函数 — 调用后移除宿主事件 handler，
   * 防止 Task Pane 隐藏后事件继续触发（T-01-07）。
   */
  onSelectionChanged(callback: () => void): () => void {
    const handler = () => callback();

    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handler,
    );

    return () => {
      Office.context.document.removeHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        { handler },
      );
    };
  }

  /**
   * PPT 宿主能力声明（Phase 1 桩）。
   */
  capabilities(): AdapterCapabilities {
    return {
      host: 'ppt',
      supportsSelectionEvents: true,
      supportedInserts: ['text', 'bullets', 'slides', 'image'],
    };
  }

  /**
   * PPT 写回桩（Phase 4 实现）。
   * Phase 1 抛 UnsupportedOperationError（T-01-08 accept）。
   */
  async insert(_content: InsertableContent): Promise<void> {
    throw new UnsupportedOperationError('PPT 写回在 Phase 4 实现');
  }
}
