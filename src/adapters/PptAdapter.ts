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
          // CR-01 修复：先 sync 加载 shapes.items 再判空——绝不在 sync 前访问 getItemAt(0)。
          //   空 slide 时 getItemAt(0).textFrame.textRange + tr.load 会随 sync 1 发到服务端抛
          //   ItemNotFound，令整个 insert 以 HostApiError 失败；改为先 load items、空则优雅 no-op
          //   （不写、不崩），>0 才取已加载的 items[0] 写入（与下方 cursor 路径对称）。
          await ctx.sync(); // sync 1: load shapes.items
          if (shapes.items.length === 0) {
            return; // 空 slide：优雅 no-op
          }
          const tr = shapes.items[0].textFrame.textRange;
          tr.load('text');
          await ctx.sync(); // sync 2: load tr.text
          tr.text = ((tr.text as string) ?? '') + content.value;
          await ctx.sync(); // sync 3: write
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

        // WR-02 修复：空演示文稿（极端竞态：add() 后 items 未刷新）时 sorted 为空，
        //   sorted[sorted.length-1] 为 undefined，.index 会抛 TypeError；先判空抛清晰错误。
        if (sorted.length === 0) {
          throw new HostApiError('PPT insertSlideAfter: 插入后 slide 列表为空，无法定位新 slide', undefined);
        }
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
      if (err instanceof HostApiError) throw err; // WR-02：保留内层清晰错误，不二次包裹
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

  /**
   * 读取指定 shape 的 fill/line/geometry before-image 并写入新属性（D-01 护城河）。
   *
   * 四 sync 范式（PowerPointApi 1.4 + RESEARCH.md PPT Shape API）：
   *   sync 1: slides.load('items')
   *   sync 2: slide.shapes.load（id,type,left,top,width,height）
   *   sync 3: shape.fill.load + shape.lineFormat.load（before-image）
   *   sync 4: 写入生效
   *
   * D-11：可选 expectedState 并发防御 — mismatch → throw HostApiError
   * Pitfall 2：lineFormat.color/weight 可能为 null（无边框形状），原样存入 beforeImage，
   *   inverse 时根据 fill_type/line_visible 决定还原方式
   *
   * A-06：proxy 不出 PowerPoint.run 闭包
   * T-06-03-01/02：bounds check — 越界 / 找不到 shape → HostApiError NOT_FOUND
   *
   * @returns { beforeImage } 写前的完整 fill+line+geometry 快照，供 restoreShapeProperty inverse 使用
   */
  async setShapeProperty(
    slideIndex: number,
    shapeId: string,
    props: {
      fillColor?: string;
      lineColor?: string;
      lineWeight?: number;
      width?: number;
      height?: number;
    },
    expectedState?: { fillColor?: string; lineColor?: string },
  ): Promise<{
    beforeImage: {
      fillType: string;
      fillColor: string | null;
      lineColor: string | null;
      lineWeight: number | null;
      lineVisible: boolean;
      width: number;
      height: number;
    };
  }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        // T-06-03-01：bounds check
        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT setShapeProperty: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含几何信息）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/type,items/left,items/top,items/width,items/height');
        await ctx.sync();

        // T-06-03-02：找到 shape
        const shape = (slide.shapes.items as Array<{
          id: string;
          type: string;
          left: number;
          top: number;
          width: number;
          height: number;
          fill: {
            load: (path: string | string[]) => void;
            type: string;
            foregroundColor: string | null;
            setSolidColor: (color: string) => void;
            clear: () => void;
          };
          lineFormat: {
            load: (path: string | string[]) => void;
            color: string | null;
            weight: number | null;
            visible: boolean;
          };
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT setShapeProperty: 形状 ${shapeId} 不存在`, undefined);
        }

        // sync 3: load before-image（fill + line）
        shape.fill.load(['type', 'foregroundColor']);
        shape.lineFormat.load(['color', 'weight', 'visible']);
        await ctx.sync();

        // 抓取 before-image（Pitfall 2：null guard，原样存入）
        const beforeImage = {
          fillType: shape.fill.type as string,
          fillColor: shape.fill.foregroundColor as string | null,
          lineColor: shape.lineFormat.color as string | null,
          lineWeight: shape.lineFormat.weight as number | null,
          lineVisible: shape.lineFormat.visible as boolean,
          width: shape.width as number,
          height: shape.height as number,
        };

        // D-11 expected_state 并发防御
        if (expectedState?.fillColor && beforeImage.fillColor !== expectedState.fillColor) {
          throw new HostApiError(
            `PPT setShapeProperty: 并发修改冲突 — fill_color 已被外部改变（期望 ${expectedState.fillColor}，实际 ${beforeImage.fillColor}）`,
            undefined,
          );
        }

        // sync 4: 应用 props 并写入
        if (props.fillColor !== undefined) {
          shape.fill.setSolidColor(props.fillColor);
        }
        if (props.lineColor !== undefined) {
          shape.lineFormat.color = props.lineColor;
        }
        if (props.lineWeight !== undefined) {
          shape.lineFormat.weight = props.lineWeight;
        }
        // 设置了颜色或粗细 → 确保边框可见
        if (props.lineColor !== undefined || props.lineWeight !== undefined) {
          shape.lineFormat.visible = true;
        }
        if (props.width !== undefined) {
          shape.width = props.width;
        }
        if (props.height !== undefined) {
          shape.height = props.height;
        }
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT setShapeProperty 失败', err);
    }
  }

  /**
   * 还原 shape 的 fill/line/geometry 属性（setShapeProperty 的 inverse 方法）。
   *
   * Pitfall 2 防御：fill_type === 'NoFill' 时用 shape.fill.clear()，
   *   而非写入 null 颜色（null 写入会抛 HostApiError）。
   * line_visible === false 时用 shape.lineFormat.visible = false 还原无边框状态。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参），
   *   replay engine 以对象传参（[[project-adapter-inverse-signature]] 地雷防御）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.fill_type before-image 的 fill 类型（'NoFill' | 'Solid' | 其他）
   * @param args.fill_color before-image 的 fill 颜色（null 表示无填充）
   * @param args.line_color before-image 的 line 颜色（null 表示无边框）
   * @param args.line_weight before-image 的 line 粗细
   * @param args.line_visible before-image 的 line 是否可见
   * @param args.width before-image 的宽度
   * @param args.height before-image 的高度
   */
  async restoreShapeProperty(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const fill_type = args.fill_type as string;
    const fill_color = args.fill_color as string | null;
    const line_color = args.line_color as string | null;
    const line_weight = args.line_weight as number | null;
    const line_visible = args.line_visible as boolean;
    const width = args.width as number;
    const height = args.height as number;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeProperty: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/width,items/height');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          width: number;
          height: number;
          fill: {
            setSolidColor: (color: string) => void;
            clear: () => void;
          };
          lineFormat: {
            color: string;
            weight: number;
            visible: boolean;
          };
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeProperty: 形状 ${shape_id} 已不存在`, undefined);
        }

        // Pitfall 2 防御：fill_type === 'NoFill' → clear()，否则 setSolidColor
        if (fill_type === 'NoFill') {
          shape.fill.clear();
        } else if (fill_color !== null) {
          shape.fill.setSolidColor(fill_color);
        }

        // line 还原：无边框 → visible=false，有边框 → 还原颜色+粗细+显示
        if (!line_visible) {
          shape.lineFormat.visible = false;
        } else {
          if (line_color !== null) {
            shape.lineFormat.color = line_color;
          }
          if (line_weight !== null) {
            shape.lineFormat.weight = line_weight;
          }
          shape.lineFormat.visible = true;
        }

        // geometry 还原
        shape.width = width;
        shape.height = height;

        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeProperty 失败', err);
    }
  }

  /**
   * 移动 shape 到指定位置（D-01 护城河，SC4 magic moment 的 move 部分）。
   *
   * 三 sync 范式（shape.left/top 可读写，PowerPointApi 1.4 几何属性）：
   *   sync 1: slides.load('items')
   *   sync 2: slide.shapes.load（id,left,top）
   *   beforeLeft/beforeTop 抓取 + shape.left/top = 新值
   *   sync 3: 写入生效
   *
   * A-06：proxy 不出 PowerPoint.run 闭包
   * T-06-03-01/02：bounds check
   *
   * @returns { beforeLeft, beforeTop } 移动前的位置，供 restoreShapeGeometry inverse 使用
   */
  async moveShape(
    slideIndex: number,
    shapeId: string,
    left: number,
    top: number,
  ): Promise<{ beforeLeft: number; beforeTop: number }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT moveShape: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 left/top）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/left,items/top');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          left: number;
          top: number;
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT moveShape: 形状 ${shapeId} 不存在`, undefined);
        }

        // 抓取 before-image
        const beforeLeft = shape.left as number;
        const beforeTop = shape.top as number;

        // 写入新位置
        shape.left = left;
        shape.top = top;
        await ctx.sync(); // sync 3: 写入生效

        return { beforeLeft, beforeTop };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT moveShape 失败', err);
    }
  }

  /**
   * 还原 shape 的几何位置（moveShape 的 inverse 方法）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.left before-image 的 left（旧 x 坐标）
   * @param args.top before-image 的 top（旧 y 坐标）
   */
  async restoreShapeGeometry(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const left = args.left as number;
    const top = args.top as number;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeGeometry: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          left: number;
          top: number;
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeGeometry: 形状 ${shape_id} 已不存在`, undefined);
        }

        // 还原旧位置
        shape.left = left;
        shape.top = top;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeGeometry 失败', err);
    }
  }

  /**
   * 编辑指定 shape 的文字内容，before-image = 旧文本（TOOL-03 P1 set_shape_text 所需）。
   *
   * fail-closed 类型过滤：只有 TEXT_SHAPE_TYPES.has(shape.type) 的形状才操作，
   *   其余类型访问 .textFrame 会抛 InvalidArgument（真机 UAT 实证）。
   *
   * 四 sync 范式：
   *   sync 1: slides.load('items')
   *   sync 2: slide.shapes.load('items/id,items/type')（fail-closed type 守门）
   *   sync 3: shape.textFrame.textRange.load('text')（仅文本形状）
   *   sync 4: 写入 newText
   *
   * A-06：proxy 不出 PowerPoint.run 闭包
   * T-06-03-05：TEXT_SHAPE_TYPES fail-closed 守门
   *
   * @returns { beforeText } 写前旧文本，供 restoreShapeText inverse 使用
   */
  async setShapeText(
    slideIndex: number,
    shapeId: string,
    newText: string,
  ): Promise<{ beforeText: string }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT setShapeText: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 id 和 type，用于 fail-closed 类型守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/type');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          type: string;
          textFrame: {
            textRange: {
              load: (path: string) => void;
              text: string;
            };
          };
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT setShapeText: 形状 ${shapeId} 不存在`, undefined);
        }

        // T-06-03-05 fail-closed 类型守门（复用 TEXT_SHAPE_TYPES 白名单）
        if (!TEXT_SHAPE_TYPES.has(shape.type)) {
          throw new HostApiError(
            `PPT setShapeText: 形状类型 ${shape.type} 不支持文本编辑（仅支持 ${[...TEXT_SHAPE_TYPES].join('/')}）`,
            undefined,
          );
        }

        // sync 3: load 旧文本（before-image）
        shape.textFrame.textRange.load('text');
        await ctx.sync();

        const beforeText = shape.textFrame.textRange.text as string;

        // 写入新文本
        shape.textFrame.textRange.text = newText;
        await ctx.sync(); // sync 4: 写入生效

        return { beforeText };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT setShapeText 失败', err);
    }
  }

  /**
   * 还原 shape 的文字内容（setShapeText 的 inverse 方法）。
   *
   * 复用 setShapeText 的 fail-closed 路径：同样经 TEXT_SHAPE_TYPES 类型守门，
   *   确保幂等还原安全（非文本形状 → throw HostApiError，replay engine 标 skipped_error）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.before_text before-image 旧文本（setShapeText 写前的原始内容）
   */
  async restoreShapeText(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const before_text = args.before_text as string;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeText: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes（含 type，用于 fail-closed 守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/type');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          type: string;
          textFrame: {
            textRange: {
              text: string;
            };
          };
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeText: 形状 ${shape_id} 已不存在`, undefined);
        }

        // fail-closed 类型守门（与 setShapeText 一致，保证幂等还原安全）
        if (!TEXT_SHAPE_TYPES.has(shape.type)) {
          throw new HostApiError(
            `PPT restoreShapeText: 形状类型 ${shape.type} 不支持文本编辑`,
            undefined,
          );
        }

        // 还原旧文本（不需要 load，直接写入）
        shape.textFrame.textRange.text = before_text;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeText 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 3a：PPT-01 setShapeTextFont / restoreShapeFont
  // ---------------------------------------------------------------------------

  /**
   * 设置指定形状文字的字体属性（PPT-01）。
   *
   * TEXT_SHAPE_TYPES 守门：只有文本形状（GeometricShape/TextBox/Placeholder/Callout）
   *   才有 textFrame，其余类型访问 .textFrame 会抛 InvalidArgument。
   *
   * 四 sync 范式（复用 setShapeProperty 模式）：
   *   sync 1: slides.load('items')
   *   sync 2: slide.shapes.load('items/id,items/type')
   *   sync 3: shape.textFrame.textRange.font.load(字段) — before-image 抓取
   *   sync 4: 写入 font 属性
   *
   * @returns { beforeFont } 写前字体属性包，供 restoreShapeFont inverse 使用
   */
  async setShapeTextFont(
    slideIndex: number,
    shapeId: string,
    font: Record<string, unknown>,
  ): Promise<{ beforeFont: Record<string, unknown> }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT setShapeTextFont: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 id 和 type，用于 TEXT_SHAPE_TYPES 守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/type');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          type: string;
          textFrame: {
            textRange: {
              font: {
                load: (fields: string[]) => void;
                bold: boolean | null;
                italic: boolean | null;
                underline: boolean | null;
                color: string | null;
                size: number | null;
                name: string | null;
              };
            };
          };
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT setShapeTextFont: 形状 ${shapeId} 不存在`, undefined);
        }

        // TEXT_SHAPE_TYPES fail-closed 守门
        if (!TEXT_SHAPE_TYPES.has(shape.type)) {
          throw new HostApiError(
            `PPT setShapeTextFont: 形状类型 ${shape.type} 不支持文本编辑（仅支持 ${[...TEXT_SHAPE_TYPES].join('/')}）`,
            undefined,
          );
        }

        // sync 3: load before-image（font 属性包）
        shape.textFrame.textRange.font.load(['bold', 'italic', 'underline', 'color', 'size', 'name']);
        await ctx.sync();

        const beforeFont: Record<string, unknown> = {
          bold: shape.textFrame.textRange.font.bold,
          italic: shape.textFrame.textRange.font.italic,
          underline: shape.textFrame.textRange.font.underline,
          color: shape.textFrame.textRange.font.color,
          size: shape.textFrame.textRange.font.size,
          name: shape.textFrame.textRange.font.name,
        };

        // sync 4: 写入 font 属性（只写非 undefined 字段）
        const f = shape.textFrame.textRange.font;
        if (font.bold !== undefined) f.bold = font.bold as boolean;
        if (font.italic !== undefined) f.italic = font.italic as boolean;
        if (font.underline !== undefined) f.underline = font.underline as boolean;
        if (font.color !== undefined) f.color = font.color as string;
        if (font.size !== undefined) f.size = font.size as number;
        if (font.name !== undefined) f.name = font.name as string;
        await ctx.sync();

        return { beforeFont };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT setShapeTextFont 失败', err);
    }
  }

  /**
   * 还原形状文字的字体属性（setShapeTextFont 的 inverse 方法，PPT-01）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参，防 Phase 5 UAT 地雷）。
   * inverse 路径不再做 TEXT_SHAPE_TYPES 守门（写入时已保证 shape 支持文字，幂等还原安全）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.before_font before-image 字体属性包（setShapeTextFont 写前记录）
   */
  async restoreShapeFont(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const before_font = args.before_font as Record<string, unknown>;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeFont: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes（id 即可，inverse 不做类型守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          textFrame: {
            textRange: {
              font: {
                bold: boolean | null;
                italic: boolean | null;
                underline: boolean | null;
                color: string | null;
                size: number | null;
                name: string | null;
              };
            };
          };
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeFont: 形状 ${shape_id} 已不存在`, undefined);
        }

        // 还原 font 属性（逐字段判断非 undefined）
        const f = shape.textFrame.textRange.font;
        if (before_font.bold !== undefined) f.bold = before_font.bold as boolean;
        if (before_font.italic !== undefined) f.italic = before_font.italic as boolean;
        if (before_font.underline !== undefined) f.underline = before_font.underline as boolean;
        if (before_font.color !== undefined) f.color = before_font.color as string;
        if (before_font.size !== undefined) f.size = before_font.size as number;
        if (before_font.name !== undefined) f.name = before_font.name as string;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeFont 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 3a：PPT-03 addShape / deleteShapeById
  // ---------------------------------------------------------------------------

  /**
   * 在指定幻灯片插入形状（PPT-03，Spike S7 addTextBox 绕 #2775）。
   *
   * 两条路径：
   *   - shapeType === 'TextBox'：addTextBox + count before/after 校验（#2775 防御）
   *   - 其他几何形状：addGeometricShape
   *
   * T-10-11 #2775 防御：addTextBox 可能静默删除选中形状（已知 Office.js bug）。
   *   count before/after 校验：countAfter < countBefore → throw HostApiError（明确失败，不静默数据丢失）。
   *
   * ⚠️ 真机 UAT（SC#3）：addTextBox 是否真正绕过 #2775 = 待真机验证（S7 spike 结论为真机 UAT 项）。
   *
   * @returns { newShapeId } 新插入形状的 ID，供 deleteShapeById inverse 使用
   */
  async addShape(
    slideIndex: number,
    shapeType: string,
    position: { left: number; top: number; width: number; height: number },
    text?: string,
  ): Promise<{ newShapeId: string }> {
    const { left, top, width, height } = position;
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT addShape: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        const slide = slides.items[idx];

        if (shapeType === 'TextBox') {
          // ── 文本框路径（Spike S7：addTextBox 绕 #2775）──

          // sync 2: 记录 countBefore
          slide.shapes.load('items/$none');
          await ctx.sync();
          const countBefore = (slide.shapes.items as unknown[]).length;

          // 插入文本框（text 为空时写空字符串）
          const textbox = (slide.shapes as unknown as {
            addTextBox: (text: string, opts: { left: number; top: number; width: number; height: number }) => { load: (f: string[]) => void; id: string };
          }).addTextBox(text ?? '', { left, top, width, height });

          textbox.load(['id']);
          await ctx.sync(); // sync 3: 获取新 shape id

          // sync 4: 校验 count（T-10-11 #2775 防御）
          slide.shapes.load('items/$none');
          await ctx.sync();
          const countAfter = (slide.shapes.items as unknown[]).length;

          if (countAfter < countBefore) {
            throw new HostApiError(
              'PPT addTextBox: 插入后 shape 数量减少，可能触发 #2775 bug（选中形状被静默删除）',
              undefined,
            );
          }

          const newShapeId = textbox.id as string;
          return { newShapeId };
        } else {
          // ── 几何形状路径（addGeometricShape）──

          // sync 2: load shapes（获取已有形状列表）
          slide.shapes.load('items/$none');
          await ctx.sync();

          const newShape = (slide.shapes as unknown as {
            addGeometricShape: (type: string, opts: { left: number; top: number; width: number; height: number }) => { load: (f: string[]) => void; id: string; type: string; textFrame: { textRange: { text: string } } };
          }).addGeometricShape(shapeType, { left, top, width, height });

          newShape.load(['id', 'type']);
          await ctx.sync(); // sync 3: 获取新 shape id + type

          const newShapeId = newShape.id as string;

          // 写入文字（如有），仅对 TEXT_SHAPE_TYPES 守门后才写
          if (text !== undefined && TEXT_SHAPE_TYPES.has(newShape.type as string)) {
            newShape.textFrame.textRange.text = text;
            await ctx.sync(); // sync 4: 写入文字
          }

          return { newShapeId };
        }
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT addShape 失败', err);
    }
  }

  /**
   * 按 shape ID 删除形状（addShape 的 inverse 方法，PPT-03）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id 要删除的形状 ID（addShape 返回的 newShapeId）
   */
  async deleteShapeById(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT deleteShapeById: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes（按 id 定位）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          delete: () => void;
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(
            `PPT deleteShapeById: 形状 ${shape_id} 不存在`,
            undefined,
          );
        }

        shape.delete();
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT deleteShapeById 失败', err);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 3a：PPT-07 copySlide / deleteSlideByIndex
  // ---------------------------------------------------------------------------

  /**
   * 复制幻灯片到指定位置（PPT-07）。
   *
   * slide.copy() 追加副本，然后重新 load slides 找到新 slide，
   * 捕获 capturedId + capturedIndex 作为 deleteSlideByIndex 的双定位指纹（D-16）。
   *
   * @param sourceIndex 1-based 源幻灯片序号
   * @param targetIndex 可选目标位置（1-based）；省略则追加末尾
   * @returns { capturedId, capturedIndex } 新幻灯片的 ID 和 0-based index
   */
  async copySlide(
    sourceIndex: number,
    targetIndex?: number,
  ): Promise<{ capturedId: string; capturedIndex: number }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const srcIdx = sourceIndex - 1;
        if (srcIdx < 0 || srcIdx >= (slides.items as unknown[]).length) {
          throw new HostApiError(
            `PPT copySlide: 第 ${sourceIndex} 张 slide 不存在（共 ${(slides.items as unknown[]).length} 张）`,
            undefined,
          );
        }

        const sourceSlide = (slides.items as unknown as Array<{
          index: number;
          id: string;
          copy: () => void;
        }>)[srcIdx];

        // 执行 copy（追加到末尾或目标位置）
        sourceSlide.copy();

        // sync 2: 重新 load slides（含新插入的副本）
        slides.load('items');
        await ctx.sync();

        // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618）
        const sorted = [...(slides.items as Array<{ index: number; id: string; load?: (f: string[]) => void }>)]
          .sort((a, b) => a.index - b.index);

        if (sorted.length === 0) {
          throw new HostApiError('PPT copySlide: 复制后 slide 列表为空', undefined);
        }

        // 取目标位置（targetIndex 指定时取对应位置，否则取末尾）
        const newSlide = targetIndex !== undefined && targetIndex - 1 < sorted.length
          ? sorted[targetIndex - 1]
          : sorted[sorted.length - 1];

        // sync 3: load id + index（双定位指纹）
        (newSlide as unknown as { load: (f: string[]) => void }).load?.(['id', 'index']);
        await ctx.sync();

        return {
          capturedId: newSlide.id as string,
          capturedIndex: newSlide.index as number,
        };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT copySlide 失败', err);
    }
  }

  /**
   * 按 index+ID 双定位删除幻灯片（copySlide 的 inverse 方法，PPT-07，D-16）。
   *
   * 双定位策略（T-10-12：防 capturedId 漂移）：
   *   1. 优先按 capturedId 遍历定位（UUID，不随位置变化）
   *   2. capturedId 找不到 → 按 capturedIndex 定位（index 后备）
   *   3. 都找不到 → throw HostApiError（replay engine 捕获 → skipped_error，诚实告知）
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.capturedIndex copySlide 捕获的 0-based index
   * @param args.capturedId copySlide 捕获的幻灯片 ID（UUID）
   */
  async deleteSlideByIndex(args: Record<string, unknown>): Promise<void> {
    const capturedIndex = args.capturedIndex as number;
    const capturedId = args.capturedId as string;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        // sync 2: load id + index（双定位需要两个字段）
        (slides as unknown as { load: (f: string) => void }).load?.('items/id,items/index');
        await ctx.sync();

        const items = slides.items as Array<{
          id: string;
          index: number;
          delete: () => void;
        }>;

        // 优先按 capturedId 定位（D-16 双定位第一优先）
        let targetSlide = items.find((s) => s.id === capturedId);

        // 找不到 → 按 capturedIndex 后备
        if (!targetSlide) {
          targetSlide = items.find((s) => s.index === capturedIndex);
        }

        if (!targetSlide) {
          throw new HostApiError(
            `PPT deleteSlideByIndex: 目标幻灯片已不存在（capturedId=${capturedId}, capturedIndex=${capturedIndex}）`,
            undefined,
          );
        }

        targetSlide.delete();
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT deleteSlideByIndex 失败', err);
    }
  }
}
