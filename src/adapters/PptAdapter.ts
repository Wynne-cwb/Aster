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
  const e = err as { code?: string; debugInfo?: { errorLocation?: string } };
  console.warn(`[Aster] PPT ${kind} 宿主报错:`, e?.code ?? '(no code)', '| loc:', e?.debugInfo?.errorLocation ?? '');
}

/**
 * 支持 TextFrame 的形状类型白名单（PowerPoint.ShapeType 值）。
 * 其余类型（Image/Group/Table/Chart/SmartArt/Media/Line…）访问 .textFrame 本身就会抛
 * InvalidArgument（真机 UAT 实证；office-js #4380 表格 / #3609 组合）。
 * fail-closed：只读已知含文本框的形状文本，未知类型一律当无文本，绝不盲碰 textFrame。
 */
const TEXT_SHAPE_TYPES = new Set<string>(['GeometricShape', 'TextBox', 'Placeholder', 'Callout']);

/**
 * 文本规范化（用于 title 指纹比对）。
 * trim + \r\n 归一，与 operationLog.isTargetStateConsistent ppt_slide 规则一致。
 */
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
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

            // 批量 load 每张 slide 的 shapes 及其 type（用 type 过滤，不能盲碰 textFrame）
            for (const slide of sorted) {
              slide.shapes.load('items/type');
            }
            await ctx.sync(); // sync 2: load 所有 slide 的 shapes.items + type

            // 仅对「支持文本框」的形状 load textRange.text；图片/组合/表格/图表等访问
            // .textFrame 会抛 InvalidArgument（真机 UAT 实证），故先按 type 过滤再碰。
            for (const slide of sorted) {
              for (const shape of slide.shapes.items) {
                if (TEXT_SHAPE_TYPES.has(shape.type)) {
                  shape.textFrame.textRange.load('text');
                }
              }
            }
            await ctx.sync(); // sync 3: load 文本形状的 textRange.text

            const slideList = sorted.map((slide) => {
              // 标题 = 第一个「文本形状」的首行（跳过 Logo/图片/表格等无文本框形状）
              let title = '';
              for (const shape of slide.shapes.items) {
                if (TEXT_SHAPE_TYPES.has(shape.type)) {
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

            // 仅对「支持文本框」的形状 load textRange.text；其余类型访问 .textFrame 会抛
            // InvalidArgument（真机 UAT 实证），按 type 过滤再碰。
            for (const shape of slide.shapes.items) {
              if (TEXT_SHAPE_TYPES.has(shape.type)) {
                shape.textFrame.textRange.load('text');
              }
            }
            await ctx.sync(); // sync 3: load 文本形状的 textRange.text

            const shapes = slide.shapes.items.map((sh: {
              id: string;
              type: string;
              textFrame: { textRange: { text: string } };
            }) => ({
              id: sh.id,
              type: sh.type,
              text: TEXT_SHAPE_TYPES.has(sh.type) ? (sh.textFrame.textRange.text ?? '') : '',
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

            // 仅对「支持文本框」的形状读文本；其余类型访问 .textFrame 会抛 InvalidArgument（真机 UAT 实证）
            const canHaveText = TEXT_SHAPE_TYPES.has(shape.type);
            if (canHaveText) {
              shape.textFrame.textRange.load('text');
              await ctx.sync(); // sync 3: load 文本形状的 textRange.text
            }

            return {
              ok: true,
              data: {
                id: shape.id,
                type: shape.type,
                text: canHaveText ? (shape.textFrame.textRange.text ?? '') : '',
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

  /**
   * 在 PPT 末尾插入新 slide，并把 title 写入新 slide，返回 { insertedIndex, title 指纹 }。
   *
   * PoC 实现说明（D-06 / AGENT-10 / TOOL-03）：
   * - Office.js slides.add() 无精确 after 参数，新 slide 始终追加到末尾。
   * - afterIndex 参数保留签名，Phase 6 升级为精确插入后可复用。
   * - **title 写入**（05-10 修复）：旧 PoC 不写 title（_title 被忽略），导致新 slide 无标题、
   *   deleteSlideByTitle 指纹对不上、撤销失败。现用 shapes.addTextBox(title) 把标题写进新 slide：
   *   既满足「插入带标题的幻灯片」，又让 title 指纹（= 我们写入的文本）可被 deleteSlideByTitle 定位。
   *   选 addTextBox 而非 title placeholder：新建空白 slide 的 placeholder 在 Web 端不保证可写，
   *   textbox 是可靠路径。⚠ 真机 UAT（SC1b）需复测 addTextBox 在 Web 端确实生效。
   * - 返回 title = 写入的 titleText（trim 后），供 OperationLog postState + reverse.args 记录。
   *
   * sync 范式（PPT-05 + A-06 + NFR-02）：
   *   sync 1: slides.load('items')（记录 insert 前总数）
   *   slides.add() — 客户端 mutation
   *   sync 2: slides.load('items') 重新 load 获取新 slide
   *   sync 3: newSlide.shapes.addTextBox(title) 后 sync（仅当 title 非空）
   *
   * A-06：proxy 不出 PowerPoint.run 闭包。
   * T-04-11：catch → HostApiError，不存 hostError。
   *
   * @param _afterIndex 插入位置（1-based；PoC 阶段忽略，始终 add 到末尾）
   * @param title 新幻灯片标题（写入 slide + 作为撤销定位指纹）
   * @returns { insertedIndex: number; title: string }
   */
  async insertSlideAfter(
    _afterIndex: number,
    title?: string,
  ): Promise<{ insertedIndex: number; title: string }> {
    const titleText = (title ?? '').trim();
    try {
      return await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync(); // sync 1: 记录 insert 前 slide 数量

        // slides.add() 把新 slide 追加到末尾（Office.js add() 无精确 after 参数）
        slides.add();

        // sync 2: 重新 load slides.items（含新增 slide）
        slides.load('items');
        await ctx.sync();

        // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618）
        const sorted = [...(slides.items as Array<{
          index: number;
          shapes: {
            addTextBox: (text: string, options?: { left?: number; top?: number; width?: number; height?: number }) => unknown;
          };
        }>)].sort((a, b) => a.index - b.index);

        // 取最后一张 = 新插入的 slide（add 到末尾）
        const newSlide = sorted[sorted.length - 1];
        const insertedIndex = newSlide.index + 1; // 0-based → 1-based

        // 写入标题（PoC 可靠路径：textbox 承载，保证可见 + 撤销指纹可定位）
        if (titleText) {
          newSlide.shapes.addTextBox(titleText, { left: 40, top: 30, width: 600, height: 60 });
          await ctx.sync(); // sync 3: 写入 title textbox
        }

        // 指纹 = 我们写入的标题（deleteSlideByTitle 据此定位删除）
        return { insertedIndex, title: titleText };
      });
    } catch (err) {
      throw new HostApiError('PPT insertSlideAfter 失败', err);
    }
  }

  /**
   * 按 title 指纹找到对应 slide 并删除（Phase 5 inverse 路径 — AGENT-10/11 undo path）。
   *
   * 设计（D-06 title 指纹定位，绕 index 漂移问题 Pitfall 4）：
   * - 从后到前遍历 sorted（`i = sorted.length - 1; i >= 0; i--`）
   * - title 匹配：slide 第一个文本形状首行 trim 后 === titleFingerprint.trim()
   * - 找到第一个匹配 → slide.delete() + sync，return（只删一张）
   * - 未找到 → throw new HostApiError（上层 replay engine catch 标 skipped_error）
   *
   * 三 sync 范式（复用 list_slides 模式，PPT-05 守则）：
   *   sync 1: slides.load('items')
   *   sync 2: shapes.load('items/type')（批量 load 所有 slide shapes type）
   *   sync 3: 文本形状 textRange.load('text')
   *
   * 签名遵循 DocumentAdapterForReplay.deleteSlideByTitle 接口约定：
   *   args: Record<string, unknown>  → args.titleFingerprint as string
   * 这样 operationLog.executeReverse 可直接传 reverse.args 对象（不拆参）。
   *
   * A-06：proxy 不出 PowerPoint.run 闭包。
   * T-04-11：catch → HostApiError，不存 hostError。
   * T-05-06-01：同名 slide 时从后往前遍历，删最靠后一张（PoC 场景）。
   *
   * @param args.titleFingerprint 要删除的 slide title（insertSlideAfter 写入时记录的真实 title）
   */
  async deleteSlideByTitle(args: Record<string, unknown>): Promise<void> {
    const titleFingerprint = args.titleFingerprint as string;
    try {
      await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync(); // sync 1: load slides.items

        // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618）
        const sorted = [...(slides.items as Array<{
          index: number;
          delete: () => void;
          shapes: {
            load: (path: string) => void;
            items: Array<{
              type: string;
              textFrame: { textRange: { load: (path: string) => void; text: string } };
            }>;
          };
        }>)].sort((a, b) => a.index - b.index);

        // 批量 load 所有 slide 的 shapes.items/type（用 type 过滤，不盲碰 textFrame）
        for (const slide of sorted) {
          slide.shapes.load('items/type');
        }
        await ctx.sync(); // sync 2: shapes type loaded

        // 仅对「支持文本框」的形状 load textRange.text
        for (const slide of sorted) {
          for (const shape of slide.shapes.items) {
            if (TEXT_SHAPE_TYPES.has(shape.type)) {
              shape.textFrame.textRange.load('text');
            }
          }
        }
        await ctx.sync(); // sync 3: 文本形状 text loaded

        // 空指纹无法定位（防御：绝不按空标题误删 slide）
        const target = normalizeText(titleFingerprint);
        if (!target) {
          throw new HostApiError('PPT deleteSlideByTitle: 空 title 指纹无法定位 slide', undefined);
        }

        // 从后往前遍历（T-05-06-01：同名 slide 删最靠后的，PoC 安全侧）
        for (let i = sorted.length - 1; i >= 0; i--) {
          const slide = sorted[i];
          // slide title = 第一个【非空】文本形状的首行（与 insertSlideAfter/list_slides 的 title
          // 提取规则一致）。不能在空 placeholder 上 break——新建 slide 常带空 placeholder，
          // 若 break 在空形状上会让带 addTextBox 标题的新 slide 永远匹配不到（05-10 撤销失败根因之一）。
          let slideTitle = '';
          for (const shape of slide.shapes.items) {
            if (TEXT_SHAPE_TYPES.has(shape.type)) {
              const firstLine = normalizeText(
                (shape.textFrame.textRange.text ?? '').split('\n')[0],
              );
              if (firstLine) {
                slideTitle = firstLine;
                break;
              }
            }
          }
          if (slideTitle === target) {
            slide.delete();
            await ctx.sync(); // 删除后 sync
            return;
          }
        }

        // 未找到目标 slide → 抛 HostApiError（replay engine catch 标 skipped_error）
        throw new HostApiError('PPT deleteSlideByTitle: 目标 slide 已不存在', undefined);
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT deleteSlideByTitle 失败', err);
    }
  }
}
