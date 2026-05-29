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
  ReadableQuery,
  ReadableResult,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../errors';

/**
 * 真机无后台，host 报错只能从浏览器 console 看：仅记 Office.js 错误码，不带 stack
 * （T-04-11：不挂到 AsterError，避免 stack 泄漏到 sanitize/展示路径）。
 */
function warnHostErr(kind: string, err: unknown): void {
  console.warn(`[Aster] PPT ${kind} 宿主报错:`, (err as { code?: string })?.code ?? '(no code)');
}

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
   * PPT 宿主能力声明。
   * Phase 2 实现 text 写回；其余类型 Phase 4 实现。
   */
  capabilities(): AdapterCapabilities {
    return {
      host: 'ppt',
      supportsSelectionEvents: true,
      supportedInserts: ['text', 'bullets', 'slides', 'image'],
    };
  }

  /**
   * PPT text 写回（D-16）。
   * 覆盖写入当前选中 slide 的第一个文本框。
   * 非 text 类型抛 UnsupportedOperationError（Phase 4 实现）。
   *
   * 注意（spike #5022 守则）：统一使用 PowerPoint.run，不混用 setSelectedDataAsync。
   */
  async insert(content: InsertableContent): Promise<void> {
    if (content.type !== 'text') {
      throw new UnsupportedOperationError(
        `PPT Phase 2 仅支持 text 写回，${content.type} 在 Phase 4 实现`,
      );
    }
    // D-23 G-05：position 路由；缺省 'cursor'（向后兼容）
    const position = content.position ?? 'cursor';
    try {
      await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.getSelectedSlides();
        const slide = slides.getItemAt(0);
        const shapes = slide.shapes;
        shapes.load('items');

        if (position === 'append_end') {
          // WR-01 修复：在第一批 load 中同时 load shapes.items 与 tr.text，
          // 两次 sync 完成（符合 NFR-02 two-sync 规则）：
          //   sync 1 → load shapes.items + tr.text；sync 2 → write
          const tr = shapes.getItemAt(0).textFrame.textRange;
          tr.load('text');
          await ctx.sync(); // sync 1: load shapes.items + tr.text
          if (shapes.items.length > 0) {
            tr.text = ((tr.text as string) ?? '') + content.value;
          }
          await ctx.sync(); // sync 2: write
          return;
        }

        await ctx.sync(); // sync 1: load shapes.items
        if (shapes.items.length > 0) {
          const tr = shapes.items[0].textFrame.textRange;
          switch (position) {
            case 'replace_selection':
              tr.text = content.value;
              break;
            case 'cursor':
            default:
              // PPT 无明确光标，等同覆盖（D-23）
              tr.text = content.value;
              break;
          }
        }
        await ctx.sync(); // sync 2: write
      });
    } catch (err) {
      if (err instanceof UnsupportedOperationError) throw err;
      throw new HostApiError('PPT text 写回失败', err);
    }
  }

  /**
   * per-query 离散只读（TOOL-01/02）。
   *
   * switch 覆盖 5 个 PPT kind：
   * - list_slides          — 一次性返全部 slide {index, title}（batch，D-13）；按 .index 升序（PPT-05）
   * - get_slide            — 指定 slideIndex 的形状清单 + 文本（1-based；越界 NOT_FOUND）
   * - list_shapes_on_slide — 指定 slide 的 shapes {id,type,left,top,width,height}（metadata；无文本）
   * - get_shape            — 单 shape 详情（shapeId 找不到返 NOT_FOUND）
   * - selection_detail     — 复用 getSelection() 语义
   *
   * A-06：proxy 不出 PowerPoint.run 闭包；每 case 各自 try/catch → HostApiError。
   * T-04-11：catch → HostApiError，不存 hostError（防 stack 泄漏到 sanitize 路径）。
   * T-04-12：slideIndex / shapeId 越界 bounds check 返 NOT_FOUND，不越界访问。
   * T-04-13：PPT-05 守则 .sort((a,b)=>a.index-b.index)（绕 Web 反序 bug #3618）。
   */
  async read(query: ReadableQuery): Promise<ReadableResult> {
    switch (query.kind) {
      case 'list_slides': {
        try {
          return await PowerPoint.run(async (ctx) => {
            const slides = ctx.presentation.slides;
            slides.load('items');
            await ctx.sync(); // sync 1: load slides.items

            // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618）
            const sorted = [...slides.items].sort((a, b) => a.index - b.index);

            // 批量 load 每张 slide 的 shapes.items（多对象一次 load 减少 sync，SP-A 范式）
            for (const slide of sorted) {
              slide.shapes.load('items');
            }
            await ctx.sync(); // sync 2: load 所有 slide 的 shapes.items

            // 先 load 每个 shape 的 textFrame.hasText：图片/Logo/线条等无文本框，
            // 盲读其 textRange.text 在真机会抛错令整个 list_slides 失败（真机 UAT 实证）。
            for (const slide of sorted) {
              for (const shape of slide.shapes.items) {
                shape.textFrame.load('hasText');
              }
            }
            await ctx.sync(); // sync 3: load 每个 shape 的 textFrame.hasText

            // 仅对「有文本」的 shape load textRange.text
            for (const slide of sorted) {
              for (const shape of slide.shapes.items) {
                if (shape.textFrame.hasText) {
                  shape.textFrame.textRange.load('text');
                }
              }
            }
            await ctx.sync(); // sync 4: load 有文本 shape 的 textRange.text

            const slideList = sorted.map((slide) => {
              // 标题 = 第一个「有文本」shape 的首行（跳过 Logo/图片等无文本形状）
              let title = '';
              for (const shape of slide.shapes.items) {
                if (shape.textFrame.hasText) {
                  const firstLine = (shape.textFrame.textRange.text ?? '').split('\n')[0].trim();
                  if (firstLine) {
                    title = firstLine;
                    break;
                  }
                }
              }
              return {
                index: slide.index + 1, // 0-based → 1-based
                title,
              };
            });

            return {
              ok: true,
              data: { count: slides.items.length, slides: slideList },
            } satisfies ReadableResult;
          });
        } catch (err) {
          warnHostErr('list_slides', err);
          throw new HostApiError('PowerPoint list_slides 失败', err);
        }
      }

      case 'get_slide': {
        try {
          return await PowerPoint.run(async (ctx) => {
            const slides = ctx.presentation.slides;
            slides.load('items');
            await ctx.sync(); // sync 1: load slides.items

            const { slideIndex } = query; // 1-based
            const idx = slideIndex - 1;   // 转 0-based
            if (idx < 0 || idx >= slides.items.length) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
                  recoverable: false,
                  hint: '请先用 list_slides 确认 slide 总数，再指定 1-based slideIndex',
                },
              } satisfies ReadableResult;
            }

            const slide = slides.items[idx];
            slide.shapes.load('items/id,items/type');
            await ctx.sync(); // sync 2: load shapes.items（id,type）

            // 先 load hasText：无文本框的 shape 盲读 textRange.text 在真机会抛错（真机 UAT 实证）
            for (const shape of slide.shapes.items) {
              shape.textFrame.load('hasText');
            }
            await ctx.sync(); // sync 3: load 每个 shape 的 textFrame.hasText

            // 仅对「有文本」的 shape load textRange.text
            for (const shape of slide.shapes.items) {
              if (shape.textFrame.hasText) {
                shape.textFrame.textRange.load('text');
              }
            }
            await ctx.sync(); // sync 4: load 有文本 shape 的 textRange.text

            const shapes = slide.shapes.items.map((sh: {
              id: string;
              type: string;
              textFrame: { hasText: boolean; textRange: { text: string } };
            }) => ({
              id: sh.id,
              type: sh.type,
              text: sh.textFrame.hasText ? (sh.textFrame.textRange.text ?? '') : '',
            }));

            return {
              ok: true,
              data: { index: slideIndex, shapes },
            } satisfies ReadableResult;
          });
        } catch (err) {
          warnHostErr('get_slide', err);
          throw new HostApiError('PowerPoint get_slide 失败', err);
        }
      }

      case 'list_shapes_on_slide': {
        try {
          return await PowerPoint.run(async (ctx) => {
            const slides = ctx.presentation.slides;
            slides.load('items');
            await ctx.sync(); // sync 1: load slides.items

            const { slideIndex } = query; // 1-based
            const idx = slideIndex - 1;   // 转 0-based
            if (idx < 0 || idx >= slides.items.length) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
                  recoverable: false,
                  hint: '请先用 list_slides 确认 slide 总数，再指定 1-based slideIndex',
                },
              } satisfies ReadableResult;
            }

            const slide = slides.items[idx];
            // 只 load 位置信息（metadata），不 load 文本（T-04-10 守则）；显式列字段更稳
            slide.shapes.load('items/id,items/type,items/left,items/top,items/width,items/height');
            await ctx.sync(); // sync 2: load shapes.items（含 id,type,left,top,width,height）

            const shapes = slide.shapes.items.map((sh: {
              id: string;
              type: string;
              left: number;
              top: number;
              width: number;
              height: number;
            }) => ({
              id: sh.id,
              type: sh.type,
              left: sh.left,
              top: sh.top,
              width: sh.width,
              height: sh.height,
            }));

            return {
              ok: true,
              data: { slideIndex, shapes },
            } satisfies ReadableResult;
          });
        } catch (err) {
          warnHostErr('list_shapes_on_slide', err);
          throw new HostApiError('PowerPoint list_shapes_on_slide 失败', err);
        }
      }

      case 'get_shape': {
        try {
          return await PowerPoint.run(async (ctx) => {
            const slides = ctx.presentation.slides;
            slides.load('items');
            await ctx.sync(); // sync 1: load slides.items

            const { slideIndex, shapeId } = query; // 1-based
            const idx = slideIndex - 1; // 转 0-based
            if (idx < 0 || idx >= slides.items.length) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
                  recoverable: false,
                  hint: '请先用 list_slides 确认 slide 总数，再指定 1-based slideIndex',
                },
              } satisfies ReadableResult;
            }

            const slide = slides.items[idx];
            slide.shapes.load('items/id,items/type,items/left,items/top,items/width,items/height');
            await ctx.sync(); // sync 2: load shapes.items（id,type,几何）

            // T-04-12：bounds check — find 找不到返 NOT_FOUND
            const shape = slide.shapes.items.find((sh: { id: string }) => sh.id === shapeId);
            if (!shape) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `形状 ${shapeId} 不存在`,
                  recoverable: false,
                  hint: '请先用 list_shapes_on_slide 获取形状列表，确认 shapeId 后再调用',
                },
              } satisfies ReadableResult;
            }

            // 先 load hasText：无文本框的 shape 盲读 textRange.text 在真机会抛错（真机 UAT 实证）
            shape.textFrame.load('hasText');
            await ctx.sync(); // sync 3: load textFrame.hasText

            if (shape.textFrame.hasText) {
              shape.textFrame.textRange.load('text');
              await ctx.sync(); // sync 4: load 有文本 shape 的 textRange.text
            }

            return {
              ok: true,
              data: {
                id: shape.id,
                type: shape.type,
                text: shape.textFrame.hasText ? (shape.textFrame.textRange.text ?? '') : '',
                left: shape.left,
                top: shape.top,
                width: shape.width,
                height: shape.height,
              },
            } satisfies ReadableResult;
          });
        } catch (err) {
          warnHostErr('get_shape', err);
          throw new HostApiError('PowerPoint get_shape 失败', err);
        }
      }

      case 'selection_detail': {
        // 复用现有 getSelection()，返 { ok:true, data: SelectionContext }
        return { ok: true, data: await this.getSelection() };
      }

      default: {
        // 防御：PPT adapter 只处理 PPT kind + selection_detail
        // buildToolsForHost 已按 host 隔离，default 是防御层
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: `PPT 不支持 read kind: ${(query as { kind: string }).kind}`,
            recoverable: false,
            hint: '该 kind 属其它宿主，buildToolsForHost 已按 host 隔离',
          },
        };
      }
    }
  }
}
