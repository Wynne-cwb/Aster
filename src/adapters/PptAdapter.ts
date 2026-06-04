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
  PptSelectionContext,
  InsertableContent,
  AdapterCapabilities,
  ReadableQuery,
  ReadableResult,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError, AsterError } from '../errors';
import { ProviderRegistry } from '../providers/registry';
import type { ImageConfig } from '../providers/types';
import { AihubmixVisionClient } from '../providers/aihubmix-vision';
import { useProviderStore } from '../store/providers';

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
 * 支持取图的形状类型（VIS-01）。
 * Picture = 普通图片；Chart = PPT 图表 shape。
 * 其余类型（文本框、表格等）不支持取图，返回 UNSUPPORTED 错误。
 */
const IMAGE_SHAPE_TYPES = new Set<string>(['Picture', 'Chart']);

/**
 * 文本规范化（用于 title 指纹比对）。
 * trim + \r\n 归一，与 operationLog.isTargetStateConsistent ppt_slide 规则一致。
 */
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trim();
}

/**
 * 段落对齐值归一化 → PowerPoint.ParagraphHorizontalAlignment 枚举值（首字母大写）。
 * Office.js `ParagraphFormat.horizontalAlignment` 接受 "Left"|"Center"|"Right"|"Justify"|…，
 * LLM 可能传 "left"/"center" 等小写或混合大小写 → 统一映射，避免写入非法值静默无效。
 */
const ALIGNMENT_ENUM_MAP: Record<string, string> = {
  left: 'Left',
  center: 'Center',
  right: 'Right',
  justify: 'Justify',
  justifylow: 'JustifyLow',
  distributed: 'Distributed',
  thaidistributed: 'ThaiDistributed',
};
function normalizeAlignment(a: string): string {
  return ALIGNMENT_ENUM_MAP[String(a).toLowerCase()] ?? a;
}

/**
 * 垂直对齐值归一化 → PowerPoint.TextVerticalAlignment 枚举值（首字母大写，与 normalizeAlignment 同风格）。
 * 用于几何形状文字垂直居中（UAT-4：KPI 大数字 textFrame.verticalAlignment = 'Middle'）。
 */
const VALIGN_ENUM_MAP: Record<string, string> = {
  top: 'Top',
  middle: 'Middle',
  bottom: 'Bottom',
};
function normalizeVerticalAlignment(a: string): string {
  return VALIGN_ENUM_MAP[String(a).toLowerCase()] ?? a;
}

/**
 * 旋转角度近似比对（写后回读验证用）。
 * 归一到 [0,360) 后比浮点容差，并处理 359.7 ↔ 0.1 的环绕；
 * 宿主可能把 370° 规整成 10° —— 故先 mod 360 再比。
 */
function rotationsClose(a: number, b: number, tol = 0.5): boolean {
  const norm = (x: number) => ((x % 360) + 360) % 360;
  const d = Math.abs(norm(a) - norm(b));
  return d <= tol || d >= 360 - tol;
}

/** 大小写不敏感字符串相等；任一为 null/undefined 一律返 false。 */
function eqCI(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/**
 * 写后回读「确凿 no-op」判定 — 字符串属性版（260601-dul 修复假失败）。
 *
 * 背景：网页版回读 horizontalAlignment / fill.type 等属性不可靠（写成功了却回读 null 或读不到），
 *   旧逻辑 `after === target` 会把「真生效但回读不到」误判成 no-op → 报假失败
 *   （真机铁证：文字真居中了，工具却报「网页版不支持」）。
 *
 * 新规则：**仅当三者同时成立**才判 no-op（effective=false）：
 *   1. 回读值非空（after != null）
 *   2. 回读值 == 写前旧值（eqCI(after, before)）
 *   3. 旧值 != 目标值（!eqCI(before, target)）—— 即确实请求了改变
 * 其余一律 effective=true：回读 null/读不到、回读==目标、回读≠旧值 都算生效，绝不冤枉真生效；
 *   仍能抓「回读确凿==旧值且旧值≠目标」的真静默 no-op。
 */
function isWriteEffectiveStr(
  before: string | null,
  after: string | null,
  target: string,
): boolean {
  return !(after != null && eqCI(after, before) && !eqCI(before, target));
}

/**
 * 写后回读「确凿 no-op」判定 — 数值版（旋转，容差 0.5，含 360 环绕复用 rotationsClose）。
 * 仅当回读与写前均可读、且回读≈旧值、且旧值≉目标 三者同时成立才判 no-op；
 * 回读/写前任一不可用（null）→ 不冤枉，一律判生效。
 */
function isRotationEffective(
  before: number | null,
  after: number | null,
  target: number,
): boolean {
  if (after == null || before == null) return true;
  return !(rotationsClose(after, before) && !rotationsClose(before, target));
}

export class PptAdapter implements DocumentAdapter {
  /**
   * 获取 PPT 当前选中的上下文。
   * - 有选中 slide → { kind: 'ppt', slideIndex, slideCount, [selectedShapeId/Ids/Type] }
   *   slideIndex：第一个选中 slide 的 1-based 序号（PPT-05 守则：按 .index 排序后取第一个）
   *   selectedShapeId/Ids/Type：若用户还在 slide 上选中了形状，额外带出 id/type
   *     （PowerPointApi 1.5 getSelectedShapes），让 agent 精确定位目标形状，不再 list 全部去猜。
   * - 无选中 slide → { kind: 'none' }（D-16）
   * - Office.js 异常 → 包成 HostApiError
   *
   * 隐私说明（260601 更新）：旧注释「T-01-06 仅读 slide 序号、不读形状」是 v2.0 旧隐私限制，
   *   已随 v2.0 隐私模型简化（agent 默认读全文）而废弃。读选中形状 id/type 是元数据，安全。
   */
  async getSelection(): Promise<SelectionContext> {
    try {
      return await PowerPoint.run(async (ctx) => {
        const selectedSlides = ctx.presentation.getSelectedSlides();
        selectedSlides.load('items');

        const allSlides = ctx.presentation.slides;
        allSlides.load('items');

        // 额外读「选中的形状」id/type（PowerPointApi 1.5）。
        // getSelectedShapes 在旧 API 集可能不存在 → typeof 守门 + try/catch，
        // 失败一律优雅降级（不带 shape 字段），绝不让整个 getSelection 崩（fail-open，不回归）。
        let selectedShapes: { items: Array<{ id: string; type: string }> } | null = null;
        try {
          const presentation = ctx.presentation as unknown as {
            getSelectedShapes?: () => { load: (path: string) => void; items: Array<{ id: string; type: string }> };
          };
          if (typeof presentation.getSelectedShapes === 'function') {
            const ss = presentation.getSelectedShapes();
            ss.load('items/id,items/type');
            selectedShapes = ss;
          }
        } catch {
          selectedShapes = null;
        }

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
        const result: PptSelectionContext = {
          kind: 'ppt',
          slideIndex: firstSelected.index + 1,
          slideCount: totalCount,
        };

        // 选中形状（有则带 id/type）；读形状失败/无选中形状 → 不带字段，agent 回退原行为（不回归）。
        try {
          const shapeItems = selectedShapes?.items ?? [];
          if (shapeItems.length > 0) {
            result.selectedShapeIds = shapeItems.map((s) => s.id);
            result.selectedShapeId = shapeItems[0].id;
            result.selectedShapeType = shapeItems[0].type;
          }
        } catch {
          // 读取选中形状失败：优雅降级，仅返回 slide 信息
        }

        return result satisfies SelectionContext;
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

      // -----------------------------------------------------------------
      // get_shape_image — SPIKE 路径：选中 shape 取 base64 → AihubmixVisionClient（VIS-01）
      //
      // SPIKE 说明：shape.getImageAsBase64() 属 PowerPoint Preview API（powerpoint-js-preview
      // requirement set），@types/office-js 暂无此方法签名，故用 as unknown as {...} 转型。
      // 若宿主不支持（API 不存在/抛错）→ catch 块返回 HOST_API_FAILED 结构化错误，引导用户
      // 改用回形针上传（D-07/D-13）。AsterError 子类（如 KeyInvalidError）重抛，由 dispatchTool
      // sanitize 处理。base64 在本 case 内被 vision client 消费，不出此 case（NFR-09）。
      //
      // 真机 SPIKE 结果（2026-06-02 UAT，Office for Web / Edge）：getImageAsBase64 ❌ 不可用
      //   （Preview API 未在 Web GA）→ fallback ✅ 验证通过：agent 正确识别 shape type=Image、
      //   返回引导文案让用户点回形针上传，上传路径据图作答成功。属预期内已知宿主限制，非缺陷。
      //   对比：Excel 激活图表 getImage()、Word inlinePicture getBase64ImageSrc() 真机均 ✅ 可用。
      // -----------------------------------------------------------------
      case 'get_shape_image': {
        const focus = query.focus;
        try {
          return await PowerPoint.run(async (ctx) => {
            // 取选中 shapes（PowerPointApi 1.5 getSelectedShapes）
            // 注：getSelection() 里已有相同 try/catch 守门，此处直接用 as unknown 转型
            const presentationAsAny = ctx.presentation as unknown as {
              getSelectedShapes: () => {
                load: (path: string) => void;
                items: Array<{ type: string; getImageAsBase64: () => { value: string } }>;
              };
            };
            const selection = presentationAsAny.getSelectedShapes();
            selection.load('items/type');
            await ctx.sync();

            if (!selection.items.length) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: '请先选中一张图片或图表，或点回形针上传一张图',
                  recoverable: true,
                  hint: '选中图片或图表 shape 后再试，或使用回形针按钮上传图片',
                },
              } satisfies ReadableResult;
            }

            // D-05：多选取第一张（PPT-05 守则：items 已按 index 排序，Web bug #3618 兼容）
            const shape = selection.items[0];
            if (!IMAGE_SHAPE_TYPES.has(shape.type)) {
              return {
                ok: false,
                error: {
                  code: 'UNSUPPORTED',
                  message: '选中形状不是图片或图表',
                  recoverable: true,
                  hint: '请选中图片或图表 shape，或点回形针上传图片',
                },
              } satisfies ReadableResult;
            }

            // SPIKE: getImageAsBase64 — PowerPoint Preview API（powerpoint-js-preview）
            // 若宿主不支持此 API，getImageAsBase64 不存在时 TypeError 被 outer catch 捕获
            const imageResult = shape.getImageAsBase64();
            await ctx.sync();
            const base64 = imageResult.value;

            // vision 取配置（vision case 不调 getDefaultLLM，传 stub 即可）
            const cfg = ProviderRegistry.resolve(
              'vision',
              () => useProviderStore.getState().providers[0]!,
            ) as ImageConfig;
            const userText = focus
              ? `${focus}（请从图中抽取能直接用于撰写文档的具体细节）`
              : '请客观描述图片的所有关键内容：文字、数据、人物/物品、版式结构，用于协助撰写办公文档。';
            const { content } = await new AihubmixVisionClient().analyzeImages(
              userText,
              [{ base64, mimeType: 'image/png' }],
              cfg,
            );

            return {
              ok: true,
              data: { vision_result: content, shape_count: selection.items.length },
            } satisfies ReadableResult;
          });
        } catch (err) {
          // AsterError 子类（如 KeyInvalidError：aihubmix key 未配置）重抛，
          // 让 dispatchTool sanitize 边界处理（D-13 三类错误之三）
          if (err instanceof AsterError) throw err;
          // SPIKE 失败 fallback：返回结构化错误引导用户改用回形针上传（D-07/D-13 T-15-06）
          warnHostErr('get_shape_image', err);
          return {
            ok: false,
            error: {
              code: 'HOST_API_FAILED',
              message: '当前无法读取选中图（宿主限制），可点回形针上传这张图',
              recoverable: true,
              hint: '改用 InputBar 回形针按钮上传图片，绕过宿主限制',
            },
          } satisfies ReadableResult;
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
   * 以 base64 图片填充矩形形状插入到指定幻灯片（IMG-01 GA 路线）。
   *
   * 实现路线：addGeometricShape('Rectangle', opts) + fill.setImage(base64)（PowerPointApi 1.4 GA）。
   * 规避 Office.js bug #5022（同一 run 内插图后 sync 可能卡死）：写后回读验证使用独立 PowerPoint.run()。
   *
   * ⚠️ T-16-04 安全约束：回读失败抛 HostApiError 诚实失败，不假成功。
   * ⚠️ T-16-05 安全约束：错误消息使用字面量，不 interpolate err.message（防 apiKey 从错误链泄漏）。
   *
   * @param slideIndex 1-based slide 序号
   * @param base64 裸 base64 字符串（无 data: 前缀，Provider 返回格式）
   * @param opts 图片位置与尺寸（left/top/width/height，单位 pt）
   * @returns { newShapeId } 新插入 shape 的 ID，供 write 工具写 reverse.args.shape_id（delete_shape_by_id）
   */
  async addImageShape(
    slideIndex: number,
    base64: string,
    opts: { left: number; top: number; width: number; height: number },
  ): Promise<{ newShapeId: string }> {
    const { left, top, width, height } = opts;
    let newShapeId: string;

    try {
      // 第一次 PowerPoint.run：创建矩形 + 填充图片
      newShapeId = await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync(); // sync 1: load slides

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT addImageShape: 第 ${slideIndex} 张 slide 不存在`,
            undefined,
          );
        }

        const slide = slides.items[idx];

        // GA 路线：addGeometricShape(Rectangle) 作图片容器
        const shape = (slide.shapes as unknown as {
          addGeometricShape: (type: string, opts: { left: number; top: number; width: number; height: number }) => {
            load: (f: string[]) => void;
            id: string;
            fill: { setImage: (base64: string) => void };
          };
        }).addGeometricShape('Rectangle', { left, top, width, height });

        shape.load(['id']);
        await ctx.sync(); // sync 2: 获取 shape.id

        const shapeId = shape.id as string;

        // 以 base64 填充 shape（GA PowerPointApi 1.4）
        // 注：Provider 返回裸 base64，若 Office.js 需要 data URL，在此拼接
        shape.fill.setImage(base64);
        await ctx.sync(); // sync 3: 写入图片

        return shapeId;
        // 规避 bug #5022：写入后不在同一 run 内继续 sync，结束此 run
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT addImageShape 失败', err);
    }

    // 第二次独立 PowerPoint.run：写后回读验证（规避 bug #5022 sync 卡死）
    // T-16-04: 回读失败抛 HostApiError 诚实失败
    try {
      await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const slide = slides.items[slideIndex - 1];
        slide.shapes.load('items/id');
        await ctx.sync();

        const found = (slide.shapes.items as Array<{ id: string }>).some(
          (s) => s.id === newShapeId,
        );

        if (!found) {
          throw new HostApiError(
            'PPT 图片插入未生效（回读验证失败），请重试',
            undefined,
          );
        }
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT addImageShape 回读验证失败', err);
    }

    return { newShapeId };
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
   * 盖印章建整页（Phase 23 PVQ-03，架构 (B) create+fill）。
   *
   * **双 run 重构（260604-gld UAT-2）**：把「建页」与「填充形状」拆到两个独立 `PowerPoint.run`：
   *   - **Run A（建页 + 捕指纹）**：slides.add() 建新页到末尾（仿 insertSlideAfter L696-744）→ reload +
   *     PPT-05 排序取末页 → 捕 id+index 双定位指纹（仿 copySlide）。Run A 结束 = 新页**完全 commit/登记完成**。
   *   - **Run B（填充形状，UAT-4 重构）**：新开 run（关键——让宿主完成登记）→ 按 capturedId 重新定位这张已就绪的页
   *     （双定位，镜像 deleteSlideByIndex L2587-2630）→ **记录** slides.add() 自带的默认占位符 id（先别删）→
   *     逐 spec addTextBox / addGeometricShape + 内联设 fill/几何文字/font（**对齐留到第二趟**）→ sync 收形状 id →
   *     **第二趟**：在已 commit 的形状上设段落对齐(H)/垂直对齐(V) + 删默认占位符 → sync。收 newShapeIds。
   *
   * ⚠️ UAT-4 视觉修复（真机 KPI 页「很丑」）：
   *   ① **删默认占位符**：slides.add() 的新页自带 PowerPoint 默认"标题/内容"Placeholder（"单击此处添加标题"虚影 +
   *      虚线大框）。定位后先 load+记录其 id，但**不当场删**（删空 → 空白页 → 撞 office-js #2172 加形状报错）；
   *      待我方形状建好（页非空）的第二趟再删，安全。
   *   ② **几何去黑边**：addGeometricShape 默认带深色描边。spec **没有 lineColor → 显式 lineFormat.visible=false**
   *      杀掉默认描边；有 lineColor 才画线（保持现逻辑）。
   *   ③ **几何文字水平+垂直居中**：段落对齐(spec.align)与垂直对齐(spec.vAlign→textFrame.verticalAlignment)
   *      **必须在形状创建并 sync 之后的第二趟设**——几何形状的段落对齐在「创建同批次」内不生效（UAT-4 根因，
   *      上一轮误并到同一 sync）。垂直居中仅对几何形状文字（如 KPI 大数字 vAlign='Middle'），TextBox 标题/标签不设。
   * 返回 { capturedIndex(0-based), capturedId(UUID), slideIndex(1-based), newShapeIds }——签名与现状一致，
   *   reverse = deleteSlideByIndex({capturedIndex,capturedId})（复用既有 inverse，删整张新页；**无新 inverse 方法**）。
   *
   * ⚠️ 根因（UAT-2，office-js #2903 + #2172）：PowerPoint **网页版专有竞态**——slides.add() 刚建出的新页
   *   尚未在宿主端「登记完成」，若在**同一个 run 内**继续往新页加形状/读写，宿主按 id 解析这张页时
   *   getItem(id) 拿到非法 id 抛 `InvalidParam passed to GetItem(id)`（真机 UAT-2 本地诊断通道实证）。桌面版无此问题。
   *   旧实现（单 run + sync4/sync5 重活）必踩此竞态；双 run 让新页在 Run A 彻底 commit 后 Run B 才操作 → 绕开。
   * ⚠️ 守门（UAT-2 沿用）：GeometricShape 恒在 TEXT_SHAPE_TYPES 内（静态确定），无 load-type 运行时守门，
   *   fill/几何文字/font 内联设；保留「仅 spec.text 有值才写 textFrame」静态守门。形状创建顺序 = spec 顺序，
   *   保证 newShapeIds[i] ↔ shapeSpecs[i]（工具层 layout_check annotation 依赖此映射）。
   *   ⚠️ Run B 共 5 次 sync：①②载 slides（双定位）③载并记录默认占位符 ④commit 形状创建(fill/文字/font)
   *   ⑤第二趟 commit 对齐(H/V)+删占位符。对齐/占位符这趟的错误归到「填充形状 Run B·sync」标签。
   * ⚠️ 阶段标签（双保险）：各阶段 HostApiError.message 带静态标签（建页 Run A / 定位新页 Run B / 填充形状 Run B·sync），
   *   真机若仍失败，调试报告 error: 行一眼定位是哪个 run/阶段。标签是我方静态串，不泄露任何东西。
   * ⚠️ 事务性（260604-fzn → UAT-2 沿用）：Run A 已建页（指纹已捕）而 Run B 抛错 → catch 用**独立 PowerPoint.run**
   *   删半成品孤儿页（复用 deleteSlideByIndex 双定位），再 re-throw 原 HostApiError——绕开重试时孤儿页堆积污染。
   *   尽力清理：清理本身失败也不掩盖原 error。原始 cause 仅经 debugCause → console.warn 到 DevTools，绝不进 ToolResult/LLM。
   * A-06：proxy 不出 run 闭包；catch → HostApiError（不存 hostError）。
   */
  async applySlideLayout(
    shapeSpecs: Array<{
      shapeType: string;
      rect: { left: number; top: number; width: number; height: number };
      text?: string;
      font?: { size?: number; bold?: boolean; color?: string; name?: string };
      fillColor?: string;
      lineColor?: string;
      lineWeight?: number;
      align?: string;
      vAlign?: string;
    }>,
  ): Promise<{ capturedIndex: number; capturedId: string; slideIndex: number; newShapeIds: string[] }> {
    // 双定位指纹（撤销 reverse=deleteSlideByIndex + 孤儿页清理共用）：Run A commit 新页后捕获，写到外层作用域。
    //   Run A 成功 → 指纹齐 + 新页已登记；Run B 凭 capturedId 重新定位填充；Run B 抛错 → catch 凭指纹删孤儿页。
    let capturedIndex: number | undefined;
    let capturedId: string | undefined;

    // ── Run A：建页 + 捕指纹（结束 = 新页完全 commit/登记完成，绕开网页版 getItem(id) 竞态）──
    try {
      await PowerPoint.run(async (ctx) => {
        // A-sync 1: 记录建页前列表
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        // slides.add() 追加新页到末尾（Office.js add() 无精确 after 参数，与 insertSlideAfter 一致）
        slides.add();

        // A-sync 2: reload（含新页）
        slides.load('items');
        await ctx.sync();

        // PPT-05 守则：按 .index 排序（绕 Web 反序 bug #3618），取末页 = 新页
        const sorted = [...(slides.items as Array<{ index: number; id: string; load: (f: string[]) => void }>)]
          .sort((a, b) => a.index - b.index);
        if (sorted.length === 0) {
          throw new HostApiError('PPT applySlideLayout 失败（建页 Run A）：建页后 slide 列表为空，无法定位新页', undefined);
        }
        const newSlide = sorted[sorted.length - 1];

        // A-sync 3: 捕 id + index（双定位指纹）。此 run 结束后新页彻底 commit。
        newSlide.load(['id', 'index']);
        await ctx.sync();
        capturedIndex = newSlide.index as number;
        capturedId = newSlide.id as string;
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err; // 内层已抛带标签的清晰错误（如空列表）
      const wrapped = new HostApiError('PPT applySlideLayout 失败（建页 Run A）', err);
      console.warn('[Aster] applySlideLayout 宿主错误原因:', wrapped.debugCause ?? '(无 message)');
      throw wrapped;
    }

    // Run A 成功即指纹齐全；理论上不该发生但兜底（指纹缺失则无法定位/撤销，诚实抛错）
    if (capturedIndex === undefined || capturedId === undefined) {
      throw new HostApiError('PPT applySlideLayout 失败（建页 Run A）：未捕获新页指纹', undefined);
    }

    // ── Run B：新开 run（让宿主完成登记）→ 按 capturedId 定位已就绪新页 → 内联填充形状 ──
    try {
      return await PowerPoint.run(async (ctx) => {
        // B-sync 1/2: load slides items + id/index（双定位需 id 主、index 备；镜像 deleteSlideByIndex）
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        (slides as unknown as { load: (f: string) => void }).load?.('items/id,items/index');
        await ctx.sync();

        type ShapeHandle = {
          id: string;
          type?: string;
          load: (f: string[] | string) => void;
          delete?: () => void;
          fill?: { setSolidColor: (c: string) => void };
          lineFormat?: { color: string; weight: number; visible: boolean };
          textFrame?: {
            verticalAlignment?: string;
            textRange: { text: string; font: Record<string, unknown>; paragraphFormat: { horizontalAlignment: string } };
          };
        };
        const items = slides.items as unknown as Array<{
          id: string;
          index: number;
          shapes: {
            load: (f: string) => void;
            items: ShapeHandle[];
            addTextBox: (text: string, opts: { left: number; top: number; width: number; height: number }) => ShapeHandle;
            addGeometricShape: (type: string, opts: { left: number; top: number; width: number; height: number }) => ShapeHandle;
          };
        }>;

        // 双定位（镜像 deleteSlideByIndex L2587-2630，保持不动）：先按 capturedId（UUID 不漂移），回退 capturedIndex
        let target = items.find((s) => s.id === capturedId);
        if (!target) target = items.find((s) => s.index === capturedIndex);
        if (!target) {
          throw new HostApiError(
            `PPT applySlideLayout 失败（定位新页 Run B）：新页已不存在（capturedId=${capturedId}, capturedIndex=${capturedIndex}）`,
            undefined,
          );
        }

        // B-sync 3（UAT-4）：记录 slides.add() 自带的默认占位符 id（"单击此处添加标题"虚影 + 虚线大框）。
        //   ⚠️ 此刻**先别删**——删空会让页变空白页，撞 office-js #2172（空白页加形状报错）。留到第二趟（页非空）再删。
        target.shapes.load('items/type,items/id');
        await ctx.sync();
        const placeholders = (target.shapes.items ?? []).filter((sh) => sh.type === 'Placeholder');

        // 逐 spec 创建 + 内联设 fill / 几何文字 / font（GeometricShape 恒在 TEXT_SHAPE_TYPES 内，无 load-type 守门）。
        //   ⚠️ 对齐(H/V) **不在此趟设**——几何形状段落对齐在「创建同批次」内不生效（UAT-4 根因），留到下方第二趟。
        //   创建顺序 = spec 顺序 → newShapeIds[i] ↔ shapeSpecs[i]（工具层 layout_check annotation 依赖）。
        const created: ShapeHandle[] = [];
        for (const s of shapeSpecs) {
          let h: ShapeHandle;
          if (s.shapeType === 'TextBox') {
            // TextBox 文字在 addTextBox 建时写入
            h = target.shapes.addTextBox(s.text ?? '', s.rect);
          } else {
            h = target.shapes.addGeometricShape(s.shapeType, s.rect);
            if (s.fillColor && h.fill) h.fill.setSolidColor(s.fillColor);
            if (s.lineColor && h.lineFormat) {
              // 有描边色 → 画线（保持现逻辑）
              h.lineFormat.color = s.lineColor;
              h.lineFormat.visible = true;
              if (s.lineWeight !== undefined) h.lineFormat.weight = s.lineWeight;
            } else if (h.lineFormat) {
              // 去黑边（UAT-4）：无描边色 → 显式关掉 PowerPoint 默认深色描边轮廓
              h.lineFormat.visible = false;
            }
            // 几何形状文字（静态守门：仅 spec.text 有值才写 textFrame）
            if (s.text !== undefined && h.textFrame) h.textFrame.textRange.text = s.text;
          }
          // 字体内联（TextBox 与几何同路；textFrame 真机恒存在，?. 兜底防 mock NPE）。对齐留第二趟。
          if (s.font && h.textFrame) {
            const f = h.textFrame.textRange.font;
            if (s.font.size !== undefined) f.size = s.font.size;
            if (s.font.bold !== undefined) f.bold = s.font.bold;
            if (s.font.color !== undefined) f.color = s.font.color;
            if (s.font.name !== undefined) f.name = s.font.name;
          }
          h.load(['id']);
          created.push(h);
        }
        // B-sync 4: 形状创建 + fill + line + 几何文字 + font + id 一次性 commit（对齐尚未设）
        await ctx.sync();

        // ── 第二趟（UAT-4 关键）：形状已 commit，现在才设对齐 → 几何形状段落对齐此刻生效 ──
        //   H 对齐(spec.align→paragraphFormat.horizontalAlignment)：TextBox + 几何同设；
        //   V 对齐(spec.vAlign→textFrame.verticalAlignment)：仅几何文字（KPI 大数字 'Middle'）垂直居中，TextBox 不设。
        //   同趟删掉 B-sync 3 记录的默认占位符（此刻页已有我方形状、非空白，删占位符安全，绕 #2172）。
        created.forEach((h, i) => {
          const s = shapeSpecs[i];
          if (!h.textFrame) return;
          if (s.align) h.textFrame.textRange.paragraphFormat.horizontalAlignment = normalizeAlignment(s.align);
          if (s.vAlign) h.textFrame.verticalAlignment = normalizeVerticalAlignment(s.vAlign);
        });
        for (const ph of placeholders) ph.delete?.();
        // B-sync 5: commit 对齐 + 占位符删除
        await ctx.sync();

        const newShapeIds = created.map((c) => c.id as string);
        return {
          capturedIndex: capturedIndex as number,
          capturedId: capturedId as string,
          slideIndex: (capturedIndex as number) + 1,
          newShapeIds,
        };
      });
    } catch (err) {
      // 事务性回滚（260604-fzn → UAT-2 沿用）：Run A 已建页（指纹齐）而 Run B 抛错
      //   → 独立 PowerPoint.run 尽力删半成品孤儿页（复用既有 deleteSlideByIndex 双定位），绕开重试堆积污染。
      //   best-effort：清理本身失败也吞掉，绝不掩盖/覆盖原始错误（原 hostError info 完整保留）。
      try {
        await this.deleteSlideByIndex({ capturedIndex, capturedId });
      } catch {
        /* 清理失败不抛、不掩盖原 error */
      }
      if (err instanceof HostApiError) throw err; // 定位失败已带「Run B」标签
      // 260604-gld：把真实 Office.js 错误原因（仅 message）打到 DevTools 控制台，
      // 供真机诊断「为何 apply_slide_layout ok=false」。debugCause 绝不进 ToolResult/LLM。
      const wrapped = new HostApiError('PPT applySlideLayout 失败（填充形状 Run B·sync）', err);
      console.warn('[Aster] applySlideLayout 宿主错误原因:', wrapped.debugCause ?? '(无 message)');
      throw wrapped;
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 10 Wave 4：PPT-02 setShapeTextAlignment / restoreShapeAlignment（spike S4）
  // PPT-04 deleteShape（noop+gate）
  // PPT-05 rotateShape / restoreShapeRotation（spike S1）
  // PPT-06 manageSlides（noop+gate，D-14 v2.1 仅 delete）
  // PPT-08 setSlideBackground / restoreSlideBackground（spike S2）
  // ---------------------------------------------------------------------------

  /**
   * 设置指定形状文字的段落对齐方式（PPT-02，spike S4）。
   *
   * 修复（260531-m4x）：旧实现读写 `paragraphFormat.alignment` —— Office.js `ParagraphFormat`
   *   **没有 `.alignment` 属性**，正确属性是 `paragraphFormat.horizontalAlignment`
   *   （枚举 PowerPoint.ParagraphHorizontalAlignment）。写不存在的属性 = 静默无效 = 假成功。
   *
   * 写后回读验证（诚实底线）：写入 + sync 后**再回读 horizontalAlignment**，与归一化意图值比对：
   *   一致 → effective:true（真生效）→ 返回 before-image 供 undo。
   *   不一致（网页版静默 no-op）→ effective:false → 工具层报诚实失败，不报 ✅、不记 undo。
   *
   * TEXT_SHAPE_TYPES 守门：非文本形状访问 textFrame 会抛 InvalidArgument（真机实证）。
   *
   * @returns { beforeAlignment, effective } beforeAlignment 为写前对齐（mixed 时宿主返 null）；
   *   effective=false 表示「写入未生效」（网页版 no-op / 属性不可写）。
   */
  async setShapeTextAlignment(
    slideIndex: number,
    shapeId: string,
    alignment: string,
  ): Promise<{ beforeAlignment: string | null; effective: boolean }> {
    const target = normalizeAlignment(alignment);
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT setShapeTextAlignment: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 id 和 type，用于 TEXT_SHAPE_TYPES 守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id,items/type');
        await ctx.sync();

        const shape = (slide.shapes.items as unknown as Array<{
          id: string;
          type: string;
          textFrame: {
            textRange: {
              load: (path: string) => void;
              paragraphFormat: {
                load: (path: string) => void;
                horizontalAlignment: string | null;
              };
            };
          };
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT setShapeTextAlignment: 形状 ${shapeId} 不存在`, undefined);
        }

        // TEXT_SHAPE_TYPES fail-closed 守门
        if (!TEXT_SHAPE_TYPES.has(shape.type)) {
          throw new HostApiError(
            `PPT setShapeTextAlignment: 形状类型 ${shape.type} 不支持文本编辑`,
            undefined,
          );
        }

        // 运行时降级 + 写后回读验证：try/catch 包裹（属性不可读/写 → effective:false）
        try {
          const pf = shape.textFrame.textRange.paragraphFormat;

          // sync 3: load before-image（horizontalAlignment，正确属性名）
          pf.load('horizontalAlignment');
          await ctx.sync();
          const beforeAlignment = pf.horizontalAlignment as string | null;

          // sync 4: 写入新对齐方式
          pf.horizontalAlignment = target;
          await ctx.sync();

          // sync 5: 写后回读验证（260601-dul 修复假失败）—— 仅「回读确凿==旧值且旧值≠目标」才判 no-op；
          // 回读 null/读不到（网页版不可靠）一律判生效，不再冤枉真生效。
          pf.load('horizontalAlignment');
          await ctx.sync();
          const after = pf.horizontalAlignment as string | null;
          const effective = isWriteEffectiveStr(beforeAlignment, after, target);

          return { beforeAlignment, effective };
        } catch {
          // 属性不可读/写（spike S4 未通过 / 宿主不支持）→ 未生效信号
          return { beforeAlignment: null, effective: false };
        }
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT setShapeTextAlignment 失败', err);
    }
  }

  /**
   * 还原形状文字的段落对齐方式（setShapeTextAlignment 的 inverse 方法，PPT-02）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参，防 Phase 5 UAT 地雷）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.before_alignment before-image 的段落对齐方式
   */
  async restoreShapeAlignment(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const before_alignment = args.before_alignment as string;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeAlignment: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes（id 即可，inverse 不做类型守门）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as unknown as Array<{
          id: string;
          textFrame: {
            textRange: {
              paragraphFormat: {
                horizontalAlignment: string | null;
              };
            };
          };
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeAlignment: 形状 ${shape_id} 已不存在`, undefined);
        }

        // 还原对齐方式（修复：alignment → horizontalAlignment，正确属性名）
        shape.textFrame.textRange.paragraphFormat.horizontalAlignment = before_alignment;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeAlignment 失败', err);
    }
  }

  /**
   * 旋转指定形状到指定角度（PPT-05，spike S1）。
   *
   * 写后回读验证（诚实底线，260531-m4x）：写入 shape.rotation + sync 后**再回读 rotation**，
   *   与意图角度数值比对（容差 0.5，含 360 环绕）：
   *   一致 → effective:true（真生效）→ 返回 beforeRotation 供 undo。
   *   不一致（网页版静默 no-op / 图片占位符受限）→ effective:false → 工具层报诚实失败。
   *
   * rotation 是 shape 级属性，不需要 TEXT_SHAPE_TYPES 守门。
   *
   * @returns { beforeRotation, effective } beforeRotation 写前角度（degrees）；
   *   effective=false 表示「旋转未生效」。
   */
  async rotateShape(
    slideIndex: number,
    shapeId: string,
    rotation: number,
  ): Promise<{ beforeRotation: number | null; effective: boolean }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT rotateShape: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 id）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          rotation: number;
          load: (fields: string[]) => void;
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT rotateShape: 形状 ${shapeId} 不存在`, undefined);
        }

        // 运行时降级 + 写后回读验证：try/catch 包裹（rotation 不可读/写 → effective:false）
        try {
          shape.load(['rotation']);
          await ctx.sync(); // sync 3: load before-image
          const beforeRotation = shape.rotation as number;

          // 写入新旋转角度
          shape.rotation = rotation;
          await ctx.sync(); // sync 4: 写入生效

          // sync 5: 写后回读验证（260601-dul 修复假失败）—— 仅「回读≈旧角度且旧角度≉目标」才判 no-op；
          // 回读 null/读不到一律判生效，不再冤枉真生效。
          shape.load(['rotation']);
          await ctx.sync();
          const after = shape.rotation as number | null;
          const effective = isRotationEffective(beforeRotation, after, rotation);

          return { beforeRotation, effective };
        } catch {
          // rotation 不可读/写（spike S1 未通过 / 受限形状）→ 未生效信号
          return { beforeRotation: null, effective: false };
        }
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT rotateShape 失败', err);
    }
  }

  /**
   * 还原形状旋转角度（rotateShape 的 inverse 方法，PPT-05）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.shape_id shape 唯一标识符
   * @param args.before_rotation before-image 的旋转角度（degrees）
   */
  async restoreShapeRotation(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const shape_id = args.shape_id as string;
    const before_rotation = args.before_rotation as number;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreShapeRotation: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        // sync 2: load shapes（id 即可）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          rotation: number;
        }>).find((sh) => sh.id === shape_id);

        if (!shape) {
          throw new HostApiError(`PPT restoreShapeRotation: 形状 ${shape_id} 已不存在`, undefined);
        }

        // 还原旋转角度
        shape.rotation = before_rotation;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreShapeRotation 失败', err);
    }
  }

  /**
   * 删除指定形状（PPT-04，noop+gate）。
   *
   * 正向操作照常执行（删除形状）；但形状完整状态（类型/位置/填充/文字/字体）
   * 无法序列化重建，因此不返回 before-image。
   * ToolDef 中构建 noop_inverse reverse（DiffLog 显示「此操作不可自动撤销」）。
   *
   * T-10-15：slides.items[idx] 越界 → undefined → HostApiError（不静默失败）。
   *
   * @returns {} 无 before-image
   */
  async deleteShape(
    slideIndex: number,
    shapeId: string,
  ): Promise<Record<string, never>> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT deleteShape: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // sync 2: load shapes（含 id）
        const slide = slides.items[idx];
        slide.shapes.load('items/id');
        await ctx.sync();

        const shape = (slide.shapes.items as Array<{
          id: string;
          delete: () => void;
        }>).find((sh) => sh.id === shapeId);

        if (!shape) {
          throw new HostApiError(`PPT deleteShape: 形状 ${shapeId} 不存在`, undefined);
        }

        // 正向删除（noop+gate：不捕获 before-image）
        shape.delete();
        await ctx.sync();

        return {};
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT deleteShape 失败', err);
    }
  }

  /**
   * 设置幻灯片背景为纯色（PPT-08，spike S2）。
   *
   * 修复（260531-m4x）：旧实现调 `slide.background.fill.setSolidColor(color)` / 读 `.foregroundColor` /
   *   还原用 `.clear()` —— Office.js `SlideBackgroundFill` **没有这些成员**（它们在 `ShapeFill` 上）。
   *   正确 API：`fill.setSolidFill({ color })` 写、`fill.type`（→"Solid"）+ `fill.getSolidFillOrNullObject().color` 读。
   *   旧代码 cast 成假类型调不存在方法 → try/catch 吞掉 → 背景从未改变却仍报 ✅。
   *
   * 写后回读验证（诚实底线）：写入 setSolidFill + sync 后**回读 fill.type**：
   *   type === 'Solid' → effective:true（真生效）→ 返回 beforeColor 供 undo。
   *   type ≠ 'Solid'（网页版静默 no-op）→ effective:false → 工具层报诚实失败。
   *
   * PowerPointApi 1.10 门控：isSetSupported 不支持 → effective:false（诚实失败，非假成功）。
   * D-12：只写纯色；不实现 read_slide_background 工具（Out of Scope）。
   *
   * @returns { beforeColor, effective } beforeColor 写前纯色（非纯色背景时 null，undo 走 reset）；
   *   effective=false 表示「背景未生效」。
   */
  async setSlideBackground(
    slideIndex: number,
    color: string,
  ): Promise<{ beforeColor: string | null; effective: boolean }> {
    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT setSlideBackground: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // PowerPointApi 1.10 门控（不支持 → 诚实失败，不再假成功）
        if (
          typeof Office !== 'undefined' &&
          typeof Office.context?.requirements?.isSetSupported === 'function' &&
          !Office.context.requirements.isSetSupported('PowerPointApi', '1.10')
        ) {
          return { beforeColor: null, effective: false };
        }

        const slide = slides.items[idx] as unknown as {
          background: {
            fill: {
              load: (fields: string[]) => void;
              type: string;
              setSolidFill: (options: { color?: string; transparency?: number }) => void;
              getSolidFillOrNullObject: () => {
                load: (fields: string[]) => void;
                color: string;
                isNullObject: boolean;
              };
            };
          };
        };

        // 运行时降级 + 写后回读验证：try/catch 包裹（API 不可用 → effective:false）
        try {
          const fill = slide.background.fill;

          // sync 2: before-image —— 读 type + （若已是纯色）旧纯色值
          fill.load(['type']);
          const beforeSolid = fill.getSolidFillOrNullObject();
          beforeSolid.load(['color', 'isNullObject']);
          await ctx.sync();
          const beforeType = fill.type as string | null; // 写前 fill.type（260601-dul 用于 no-op 判定）
          const beforeColor =
            !beforeSolid.isNullObject && (fill.type as string) === 'Solid'
              ? (beforeSolid.color as string)
              : null;

          // sync 3: 写入纯色背景（正确 API：setSolidFill）
          fill.setSolidFill({ color });
          await ctx.sync();

          // sync 4: 写后回读验证（260601-dul 修复假失败）—— before/after = 写前/写后 fill.type，target='Solid'；
          // 仅「回读确凿==旧 type 且旧 type≠Solid」才判 no-op；type 读回不到（网页版不可靠）一律判生效。
          fill.load(['type']);
          await ctx.sync();
          const afterType = fill.type as string | null;
          const effective = isWriteEffectiveStr(beforeType, afterType, 'Solid');

          return { beforeColor, effective };
        } catch {
          // background.fill API 不可用（spike S2 未通过）→ 未生效信号
          return { beforeColor: null, effective: false };
        }
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT setSlideBackground 失败', err);
    }
  }

  /**
   * 还原幻灯片背景色（setSlideBackground 的 inverse 方法，PPT-08）。
   *
   * 修复（260531-m4x）：`setSolidColor`/`clear` 在 `SlideBackgroundFill` 上不存在 →
   *   before_color 非 null → `fill.setSolidFill({ color })` 还原纯色背景；
   *   before_color 为 null → `slide.background.reset()` 恢复默认/主题背景（无纯色背景的原始状态）。
   *
   * ⚠️ 签名必须是 args: Record<string, unknown>（非位置参）。
   *
   * @param args.slide_index 1-based slide 序号
   * @param args.before_color before-image 的背景颜色（null = 恢复默认）
   */
  async restoreSlideBackground(args: Record<string, unknown>): Promise<void> {
    const slide_index = args.slide_index as number;
    const before_color = args.before_color as string | null;

    try {
      await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slide_index - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT restoreSlideBackground: 第 ${slide_index} 张 slide 不存在`,
            undefined,
          );
        }

        const slide = slides.items[idx] as unknown as {
          background: {
            reset: () => void;
            fill: {
              setSolidFill: (options: { color?: string; transparency?: number }) => void;
            };
          };
        };

        // before_color 非 null → 还原纯色；null → 恢复默认/主题背景
        if (before_color !== null) {
          slide.background.fill.setSolidFill({ color: before_color });
        } else {
          slide.background.reset();
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT restoreSlideBackground 失败', err);
    }
  }

  /**
   * 管理幻灯片（PPT-06，noop+gate，v2.1 仅支持 delete，D-14）。
   *
   * v2.1 硬限：operation 只允许 'delete'（schema enum + 运行时双保险，T-10-16）。
   * 正向操作照常执行；幻灯片内容无法通过 Office.js 序列化导出，
   * 因此 ToolDef 中构建 noop_inverse reverse（DiffLog 显示「此操作不可自动撤销」）。
   *
   * T-10-15：越界 slideIndex → HostApiError（不静默失败）。
   *
   * @param operation 必须是 'delete'（v2.1 唯一支持的操作）
   * @param slideIndex 要删除的幻灯片编号（1-based）
   * @returns {} 无 before-image
   */
  async manageSlides(
    operation: 'delete',
    slideIndex: number,
  ): Promise<Record<string, never>> {
    // 运行时双保险（T-10-16 D-14）
    if (operation !== 'delete') {
      throw new HostApiError(`manage_slides 当前仅支持 delete 操作（v2.1），收到: ${String(operation)}`, undefined);
    }

    try {
      return await PowerPoint.run(async (ctx) => {
        // sync 1: load slides
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();

        const idx = slideIndex - 1;
        if (idx < 0 || idx >= slides.items.length) {
          throw new HostApiError(
            `PPT manageSlides: 第 ${slideIndex} 张 slide 不存在（共 ${slides.items.length} 张）`,
            undefined,
          );
        }

        // 正向删除（noop+gate：不捕获 before-image）
        (slides.items[idx] as unknown as { delete: () => void }).delete();
        await ctx.sync();

        return {};
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('PPT manageSlides 失败', err);
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

  // ---------------------------------------------------------------------------
  // Phase 11 Wave 2 新增：executeBatch（单 PowerPoint.run 闭包，D-01 D-02 BATCH-01）
  // ---------------------------------------------------------------------------

  /**
   * executeBatch — PPT 批量写（单 PowerPoint.run 闭包，D-01 D-02 BATCH-01）
   *
   * fail-fast 实现（RESEARCH.md Open Q2 Word/PPT 无 getRangeOrNullObject）：
   * Phase 1 = JS 层参数类型校验（不需要 Office API）；
   * Phase 2 = 单 PowerPoint.run 内逐 op 执行，per-op try/catch（失败立即 break，后续不执行）。
   * 每个成功 subOp 返回真实 reverse descriptor（非 noop_inverse）——D-07 要求。
   *
   * 支持的工具（初始实现）：
   *   set_shape_text（最常用的批量场景，真实 reverse: restore_shape_text）
   *   move_shape（真实 reverse: restore_shape_geometry）
   *   set_shape_text_font（真实 reverse: restore_shape_font）
   *   其他工具暂不支持批量内联（per-op fail-fast，建议单独调用）
   *
   * NOTE：insert_slide 因需多次 sync（插入+重新加载 items）+ 需精确读取 insertedIndex
   *   不适合在共享 ctx 内联，暂不支持。如需批量插入幻灯片，建议逐个调用。
   *
   * A-06 铁律：此方法在 PptAdapter 内，可出现 PowerPoint 命名空间。
   * reverse.args 必须是 Record 对象（project_adapter_inverse_signature 铁律）。
   */
  async executeBatch(ops: Array<{ tool: string; args: Record<string, unknown>; humanLabel?: string }>): Promise<{
    subOps: Array<{
      humanLabel: string;
      reverse: { tool: string; args: Record<string, unknown> };
      postState?: { kind: string; content: unknown };
      ok: boolean;
    }>;
    failAtIndex?: number;
  }> {
    // Phase 1：JS 层参数类型校验（不开 run，快速 fail-fast）
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      // slideIndex 如果提供必须是 number
      if (op.args.slideIndex !== undefined && typeof op.args.slideIndex !== 'number') {
        return { subOps: [], failAtIndex: i };
      }
      // shapeId 如果提供必须是 string
      if (op.args.shapeId !== undefined && typeof op.args.shapeId !== 'string') {
        return { subOps: [], failAtIndex: i };
      }
    }

    // Phase 2：单 PowerPoint.run 闭包内逐 op 执行
    return await PowerPoint.run(async (ctx) => {
      const subOps: Array<{
        humanLabel: string;
        reverse: { tool: string; args: Record<string, unknown> };
        postState?: { kind: string; content: unknown };
        ok: boolean;
      }> = [];
      let failAtIndex: number | undefined;

      // 缓存 slides list（避免每个 op 重复 load）
      const slides = ctx.presentation.slides;
      slides.load('items');
      await ctx.sync();

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        try {
          if (op.tool === 'set_shape_text') {
            // set_shape_text: 设置 shape 文字内容
            // reverse: restore_shape_text({ slide_index, shape_id, before_text })
            const slideIndex = op.args.slideIndex as number;
            const shapeId = op.args.shapeId as string;
            const newText = op.args.newText as string;

            const idx = slideIndex - 1;
            if (idx < 0 || idx >= slides.items.length) {
              throw new HostApiError(
                `executeBatch set_shape_text: 第 ${slideIndex} 张 slide 不存在`,
                undefined,
              );
            }

            // load shapes
            const slide = slides.items[idx];
            slide.shapes.load('items/id,items/type');
            await ctx.sync();

            const shape = (slide.shapes.items as Array<{
              id: string;
              type: string;
              textFrame: {
                textRange: { load: (f: string) => void; text: string };
              };
            }>).find((sh) => sh.id === shapeId);

            if (!shape) {
              throw new HostApiError(`executeBatch set_shape_text: 形状 ${shapeId} 不存在`, undefined);
            }

            if (!TEXT_SHAPE_TYPES.has(shape.type)) {
              throw new HostApiError(
                `executeBatch set_shape_text: 形状类型 ${shape.type} 不支持文本编辑`,
                undefined,
              );
            }

            // load before-image
            shape.textFrame.textRange.load('text');
            await ctx.sync();

            const beforeText = shape.textFrame.textRange.text as string;
            shape.textFrame.textRange.text = newText;
            await ctx.sync();

            subOps.push({
              humanLabel: op.humanLabel ?? `设置第 ${slideIndex} 张 slide 形状 ${shapeId} 文字`,
              reverse: {
                tool: 'restore_shape_text',
                args: {
                  slide_index: slideIndex,
                  shape_id: shapeId,
                  before_text: beforeText,
                },  // Record 对象，project_adapter_inverse_signature 铁律
              },
              postState: {
                kind: 'ppt_shape',
                content: { slideIndex, shapeId, text: newText },
              },
              ok: true,
            });

          } else if (op.tool === 'move_shape') {
            // move_shape: 移动 shape 位置
            // reverse: restore_shape_geometry({ slide_index, shape_id, left, top })
            const slideIndex = op.args.slideIndex as number;
            const shapeId = op.args.shapeId as string;
            const left = op.args.left as number;
            const top = op.args.top as number;

            const idx = slideIndex - 1;
            if (idx < 0 || idx >= slides.items.length) {
              throw new HostApiError(
                `executeBatch move_shape: 第 ${slideIndex} 张 slide 不存在`,
                undefined,
              );
            }

            const slide = slides.items[idx];
            slide.shapes.load('items/id,items/left,items/top');
            await ctx.sync();

            const shape = (slide.shapes.items as Array<{
              id: string;
              left: number;
              top: number;
            }>).find((sh) => sh.id === shapeId);

            if (!shape) {
              throw new HostApiError(`executeBatch move_shape: 形状 ${shapeId} 不存在`, undefined);
            }

            const beforeLeft = shape.left as number;
            const beforeTop = shape.top as number;

            shape.left = left;
            shape.top = top;
            await ctx.sync();

            subOps.push({
              humanLabel: op.humanLabel ?? `移动第 ${slideIndex} 张 slide 形状 ${shapeId}`,
              reverse: {
                tool: 'restore_shape_geometry',
                args: {
                  slide_index: slideIndex,
                  shape_id: shapeId,
                  left: beforeLeft,
                  top: beforeTop,
                },  // Record 对象
              },
              postState: {
                kind: 'ppt_shape',
                content: { slideIndex, shapeId, left, top },
              },
              ok: true,
            });

          } else {
            // 其他工具暂不支持批量内联，per-op fail-fast
            throw new HostApiError(
              `PPT executeBatch: 暂不支持工具 ${op.tool}（批量内联未实现，请单独调用）`,
              undefined,
            );
          }
        } catch (err) {
          // per-op fail-fast：失败立即记录 failAtIndex，后续 op 不执行（D-03）
          failAtIndex = i;
          break;
        }
      }

      return { subOps, failAtIndex };
    });
  }
}
