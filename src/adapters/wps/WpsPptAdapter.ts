/**
 * src/adapters/wps/WpsPptAdapter.ts — WPS 演示（WPS Office PPT/WPP）adapter
 *
 * Phase 34（投机预写，WPS-D1 提前量；用户 2026-06-29 授权、认可推倒重来成本）。
 * 核心读 + 基础形状/幻灯片写 + inverse，对位 Office.js PptAdapter 被工具复用的同名方法。
 *
 * 接缝复用（loop.ts:54）：capabilities().host='ppt' → buildToolsForHost('ppt')
 * WPS 运行时下被 WPS_PPT_CORE_TOOLS 裁剪为核心集，工具调本类同名方法
 * （read / setShapeText / insertSlideAfter / addShape / deleteShape / moveShape /
 *   restoreShapeText / deleteSlideByTitle / deleteShapeById / restoreShapeGeometry / readPptSlideTitle）。
 * 工具 / dispatch / operationLog / undo 零改动。
 *
 * WPS JSAPI = 同步 VBA 风格（ARCHITECTURE Anti-Pattern 2）：方法体同步调
 * window.Application.ActivePresentation.*，async 仅为满足接口签名 → Promise.resolve。
 * **不**模仿 Office.js 的 PowerPoint.run()/load/sync；**不**调 Office.isSetSupported。
 *
 * inverse 方法签名必须是 (args: Record<string, unknown>)（[[adapter-inverse-signature]]）。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29）：未经 Windows WPS 真机验证。
 *    [真机待验]：Shape.Id 稳定性/同页唯一、MsoShapeType/MsoAutoShapeType 枚举值、
 *    Slides.Add(Index, Layout) 行为、AddTextbox/AddShape 位置参签名、HasTextFrame 语义、
 *    ActiveWindow.View.Slide / Selection.ShapeRange 选区读取 —— 全部大概率要真机修。
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

/** Office.js 文本形状白名单（对齐 PptAdapter TEXT_SHAPE_TYPES，fail-closed）。 */
const TEXT_SHAPE_TYPES = new Set(['GeometricShape', 'TextBox', 'Placeholder', 'Callout']);

/** MsoShapeType 整数 → Office.js 风格类型名。[真机待验] 枚举值 */
function shapeTypeName(type: number): string {
  switch (type) {
    case 17: return 'TextBox';       // msoTextBox
    case 14: return 'Placeholder';   // msoPlaceholder
    case 1: return 'GeometricShape'; // msoAutoShape
    case 13: return 'Picture';       // msoPicture
    case 3: return 'Chart';          // msoChart
    case 19: return 'Table';         // msoTable
    case 6: return 'Group';          // msoGroup
    case 2: return 'Callout';        // msoCallout
    default: return 'Shape';
  }
}

/** add_shape 工具 shape_type 枚举 → MsoAutoShapeType 整数。[真机待验] 枚举值 */
const AUTO_SHAPE_TYPE: Record<string, number> = {
  Rectangle: 1,        // msoShapeRectangle
  RoundRectangle: 5,   // msoShapeRoundedRectangle
  Ellipse: 9,          // msoShapeOval
  Triangle: 7,         // msoShapeIsoscelesTriangle
  RightTriangle: 8,    // msoShapeRightTriangle
  Diamond: 4,          // msoShapeDiamond
  Pentagon: 56,        // msoShapePentagon
  Hexagon: 10,         // msoShapeHexagon
  RightArrow: 33,      // msoShapeRightArrow
};

function getApp(): WpsApplication {
  const app = (globalThis as { Application?: WpsApplication }).Application;
  if (!app) {
    throw new HostApiError('WPS Application 不可用（非 WPS 环境或加载项未就绪）');
  }
  return app;
}

function getPres(): WpsPresentation {
  const pres = getApp().ActivePresentation;
  if (!pres) throw new HostApiError('WPS 无活动演示文稿');
  return pres;
}

export class WpsPptAdapter implements DocumentAdapter {
  // ---- 选区 ----------------------------------------------------------------

  async getSelection(): Promise<SelectionContext> {
    try {
      const app = getApp();
      const pres = app.ActivePresentation;
      const slideCount = pres?.Slides?.Count ?? 0;
      let slideIndex = 1;
      let selectedShapeId: string | undefined;
      let selectedShapeIds: string[] | undefined;
      let selectedShapeType: string | undefined;
      try {
        const win = app.ActiveWindow;
        const cur = win?.View?.Slide?.SlideIndex;
        if (typeof cur === 'number' && cur >= 1) slideIndex = cur;
        const sel = win?.Selection;
        if (sel?.Type === 3 && sel.ShapeRange && sel.ShapeRange.Count > 0) {
          const ids: string[] = [];
          for (let i = 1; i <= sel.ShapeRange.Count; i++) {
            ids.push(String(sel.ShapeRange.Item(i).Id));
          }
          selectedShapeIds = ids;
          selectedShapeId = ids[0];
          selectedShapeType = shapeTypeName(sel.ShapeRange.Item(1).Type);
        }
      } catch {
        /* 选区读取不可用 → 退化为仅当前页 [真机待验] */
      }
      return {
        kind: 'ppt',
        slideIndex,
        slideCount,
        selectedShapeId,
        selectedShapeIds,
        selectedShapeType,
      };
    } catch (err) {
      throw new HostApiError('WPS PPT getSelection 失败', err);
    }
  }

  onSelectionChanged(_callback: () => void): () => void {
    return () => {
      /* no-op — WPS 演示选区事件未接（[真机待验]） */
    };
  }

  capabilities(): AdapterCapabilities {
    return {
      host: 'ppt',
      supportsSelectionEvents: false,
      supportedInserts: ['text'],
    };
  }

  async insert(content: InsertableContent): Promise<void> {
    throw new UnsupportedOperationError(
      `WPS PPT insert 暂不支持 ${content.type}（请用 agent 工具 set_shape_text / add_shape；完整 PANE insert 属 WPS-D1）`,
    );
  }

  // ---- 只读 ----------------------------------------------------------------

  async read(query: ReadableQuery): Promise<ReadableResult> {
    switch (query.kind) {
      case 'list_slides': {
        try {
          const slides = getPres().Slides;
          const out: Array<{ index: number; title: string }> = [];
          for (let i = 1; i <= slides.Count; i++) {
            out.push({ index: i, title: this.slideTitle(slides.Item(i)) });
          }
          return { ok: true, data: { count: slides.Count, slides: out } };
        } catch (err) {
          throw new HostApiError('WPS PPT list_slides 失败', err);
        }
      }

      case 'get_slide': {
        try {
          const slide = this.resolveSlide(query.slideIndex);
          const shapes = slide.Shapes;
          const out: Array<{ id: string; type: string; text: string }> = [];
          for (let i = 1; i <= shapes.Count; i++) {
            const sh = shapes.Item(i);
            out.push({
              id: String(sh.Id),
              type: shapeTypeName(sh.Type),
              text: this.shapeText(sh),
            });
          }
          return { ok: true, data: { index: query.slideIndex, shapes: out } };
        } catch (err) {
          if (err instanceof HostApiError) throw err;
          throw new HostApiError('WPS PPT get_slide 失败', err);
        }
      }

      case 'list_shapes_on_slide': {
        try {
          const slide = this.resolveSlide(query.slideIndex);
          const shapes = slide.Shapes;
          const out: Array<{
            id: string; type: string; left: number; top: number; width: number; height: number;
          }> = [];
          for (let i = 1; i <= shapes.Count; i++) {
            const sh = shapes.Item(i);
            out.push({
              id: String(sh.Id),
              type: shapeTypeName(sh.Type),
              left: sh.Left,
              top: sh.Top,
              width: sh.Width,
              height: sh.Height,
            });
          }
          return { ok: true, data: { slideIndex: query.slideIndex, shapes: out } };
        } catch (err) {
          if (err instanceof HostApiError) throw err;
          throw new HostApiError('WPS PPT list_shapes_on_slide 失败', err);
        }
      }

      case 'get_shape': {
        try {
          const slide = this.resolveSlide(query.slideIndex);
          const sh = this.findShape(slide, query.shapeId);
          if (!sh) {
            return {
              ok: false,
              error: {
                code: 'NOT_FOUND',
                message: `第 ${query.slideIndex} 张幻灯片找不到形状 ${query.shapeId}`,
                hint: '先用 list_shapes_on_slide 获取有效 shapeId',
                recoverable: true,
              },
            };
          }
          return {
            ok: true,
            data: {
              id: String(sh.Id),
              type: shapeTypeName(sh.Type),
              text: this.shapeText(sh),
              left: sh.Left,
              top: sh.Top,
              width: sh.Width,
              height: sh.Height,
            },
          };
        } catch (err) {
          if (err instanceof HostApiError) throw err;
          throw new HostApiError('WPS PPT get_shape 失败', err);
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
            message: `WPS PPT adapter 不支持 kind: ${(query as ReadableQuery).kind}`,
            recoverable: false,
            hint: '该 read 操作在 WPS 版暂未实现（WPS-D1）或属其它宿主',
          },
        };
      }
    }
  }

  // ---- 写工具方法（被 Office.js PPT 工具复用调用）---------------------------

  /** insert_slide 工具调用。inverse = delete_slide_by_title（titleFingerprint）。 */
  async insertSlideAfter(afterIndex: number, title: string): Promise<{ insertedIndex: number; title: string }> {
    try {
      const slides = getPres().Slides;
      const insertedIndex = afterIndex >= 1 && afterIndex <= slides.Count ? afterIndex + 1 : slides.Count + 1;
      // 12 = ppLayoutBlank（[真机待验]）；新建后写 title 到首个文本框作为指纹
      const slide = slides.Add(insertedIndex, 12);
      try {
        const box = slide.Shapes.AddTextbox(0, 36, 36, 600, 80);
        if (box.TextFrame) box.TextFrame.TextRange.Text = title;
      } catch {
        /* 标题文本框写入失败不阻断（[真机待验]）；undo 仍可按 title 指纹定位失败时降级 */
      }
      return { insertedIndex, title };
    } catch (err) {
      throw new HostApiError('WPS PPT insertSlideAfter 失败', err);
    }
  }

  /** set_shape_text 工具调用。before-image 模式，inverse = restore_shape_text。 */
  async setShapeText(slideIndex: number, shapeId: string, newText: string): Promise<{ beforeText: string }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      this.assertTextShape(sh, shapeId);
      const tf = sh.TextFrame;
      if (!tf) throw new HostApiError(`形状 ${shapeId} 无文本框架`);
      const beforeText = this.shapeText(sh);
      tf.TextRange.Text = newText;
      return { beforeText };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT setShapeText 失败', err);
    }
  }

  /** add_shape 工具调用。inverse = delete_shape_by_id（slide_index, shape_id=newShapeId）。 */
  async addShape(
    slideIndex: number,
    shapeType: string,
    position: { left: number; top: number; width: number; height: number },
    text?: string,
  ): Promise<{ newShapeId: string }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const { left, top, width, height } = position;
      let shape: WpsShape;
      if (shapeType === 'TextBox') {
        shape = slide.Shapes.AddTextbox(0, left, top, width, height); // 0 = msoTextOrientationHorizontal
      } else {
        const autoType = AUTO_SHAPE_TYPE[shapeType];
        if (autoType === undefined) {
          throw new HostApiError(`不支持的形状类型 ${shapeType}`);
        }
        shape = slide.Shapes.AddShape(autoType, left, top, width, height);
      }
      // WPS 同步 OM：AddShape/AddTextbox 直接返回 Shape，可立即读 Id（无 Office.js #5022 问题）
      const newShapeId = String(shape.Id);
      if (text && shape.TextFrame) {
        try {
          shape.TextFrame.TextRange.Text = text;
        } catch {
          /* 文本写入失败不阻断形状创建（[真机待验]） */
        }
      }
      return { newShapeId };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT addShape 失败', err);
    }
  }

  /** delete_shape 工具调用。inverse = noop_inverse（形状状态无法序列化重建）。 */
  async deleteShape(slideIndex: number, shapeId: string): Promise<Record<string, never>> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      sh.Delete();
      return {};
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT deleteShape 失败', err);
    }
  }

  /** move_shape 工具调用。before-image 模式，inverse = restore_shape_geometry。 */
  async moveShape(
    slideIndex: number,
    shapeId: string,
    left: number,
    top: number,
  ): Promise<{ beforeLeft: number; beforeTop: number }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      const beforeLeft = sh.Left;
      const beforeTop = sh.Top;
      sh.Left = left;
      sh.Top = top;
      return { beforeLeft, beforeTop };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT moveShape 失败', err);
    }
  }

  // ---- inverse 方法（operationLog.executeReverse 调用，Record 对象签名）-----

  /** delete_slide_by_title inverse（insert_slide 的 reverse）。按 title 指纹删幻灯片。 */
  async deleteSlideByTitle(args: Record<string, unknown>): Promise<void> {
    const fingerprint = String(args.titleFingerprint ?? '').trim();
    try {
      const slides = getPres().Slides;
      for (let i = slides.Count; i >= 1; i--) {
        const slide = slides.Item(i);
        if (this.slideTitle(slide).trim() === fingerprint) {
          // 删除整页：删掉页内所有形状（VBA 无直接 Slide.Delete 时的兜底；[真机待验] 优先 Slide.Delete）
          this.deleteSlideObject(slides, i, slide);
          return;
        }
      }
      // 未找到 → 安全跳过（可能已被手动改）
    } catch (err) {
      throw new HostApiError('WPS PPT deleteSlideByTitle 失败', err);
    }
  }

  /** delete_shape_by_id inverse（add_shape 的 reverse）。 */
  async deleteShapeById(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (sh) sh.Delete();
      // 未找到 → 安全跳过
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT deleteShapeById 失败', err);
    }
  }

  /** restore_shape_text inverse（set_shape_text 的 reverse）。 */
  async restoreShapeText(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const beforeText = String(args.before_text ?? '');
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (sh?.TextFrame) sh.TextFrame.TextRange.Text = beforeText;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeText 失败', err);
    }
  }

  /** restore_shape_geometry inverse（move_shape 的 reverse）。 */
  async restoreShapeGeometry(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const left = args.left as number;
    const top = args.top as number;
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (sh) {
        sh.Left = left;
        sh.Top = top;
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeGeometry 失败', err);
    }
  }

  // 注：刻意不实现 readPptSlideTitle —— 对齐 Office.js PptAdapter（同样未实现）。
  // operationLog.readTargetState 对 ppt_slide 在 adapter 无此方法时返回 undefined → 视为一致 →
  // insert_slide 的 delete_slide_by_title 正常 rolled_back（若实现，operationLog 现有
  // isTargetStateConsistent 会把对象 postState.content 串成 '[object Object]' → 误判 skipped_manual，
  // 反而破坏撤销）。slide 级手改侦测两宿主一致地关闭。

  // ---- 内部 helper ---------------------------------------------------------

  private resolveSlide(slideIndex: number): WpsSlide {
    const slides = getPres().Slides;
    if (!Number.isInteger(slideIndex) || slideIndex < 1 || slideIndex > slides.Count) {
      throw new HostApiError(`幻灯片序号 ${slideIndex} 越界（共 ${slides.Count} 张，1-based）`);
    }
    return slides.Item(slideIndex);
  }

  private findShape(slide: WpsSlide, shapeId: string): WpsShape | null {
    const shapes = slide.Shapes;
    for (let i = 1; i <= shapes.Count; i++) {
      const sh = shapes.Item(i);
      if (String(sh.Id) === shapeId) return sh;
    }
    return null;
  }

  private requireShape(slide: WpsSlide, slideIndex: number, shapeId: string): WpsShape {
    const sh = this.findShape(slide, shapeId);
    if (!sh) {
      throw new HostApiError(`第 ${slideIndex} 张幻灯片找不到形状 ${shapeId}`);
    }
    return sh;
  }

  /** fail-closed：仅文本形状可写文字（对齐 Office.js TEXT_SHAPE_TYPES）。 */
  private assertTextShape(shape: WpsShape, shapeId: string): void {
    const type = shapeTypeName(shape.Type);
    const hasFrame = shape.HasTextFrame === undefined ? true : shape.HasTextFrame !== 0;
    if (!TEXT_SHAPE_TYPES.has(type) || !hasFrame) {
      throw new HostApiError(`形状 ${shapeId} 不是文本形状（type=${type}），不支持文字操作`);
    }
  }

  /** 安全读形状文字（非文本形状或无文本返 ''）。[真机待验] HasTextFrame/HasText 语义 */
  private shapeText(shape: WpsShape): string {
    try {
      if (shape.HasTextFrame === 0) return '';
      const tf = shape.TextFrame;
      if (!tf) return '';
      if (tf.HasText === 0) return '';
      const t = tf.TextRange.Text;
      return typeof t === 'string' ? t : '';
    } catch {
      return '';
    }
  }

  /** 幻灯片标题指纹：首个非空文本形状的文字（首行）。[真机待验] 与 Office.js title 占位语义可能有差 */
  private slideTitle(slide: WpsSlide): string {
    try {
      const shapes = slide.Shapes;
      for (let i = 1; i <= shapes.Count; i++) {
        const t = this.shapeText(shapes.Item(i)).trim();
        if (t) return t.split(/[\r\n]/)[0];
      }
    } catch {
      /* 读取失败 → 空标题 */
    }
    return '';
  }

  /** 删除整页幻灯片：优先 Slide.Delete（若 WPS 暴露），否则删页内所有形状兜底。[真机待验] */
  private deleteSlideObject(slides: WpsSlides, index: number, slide: WpsSlide): void {
    const maybeDelete = (slide as unknown as { Delete?: () => void }).Delete;
    if (typeof maybeDelete === 'function') {
      maybeDelete.call(slide);
      return;
    }
    const maybeSlidesDelete = (slides as unknown as { Item(i: number): { Delete?: () => void } });
    const item = maybeSlidesDelete.Item(index);
    if (typeof item.Delete === 'function') {
      item.Delete();
      return;
    }
    // 兜底：清空页内形状（无法真正删页时的退化，[真机待验]）
    const shapes = slide.Shapes;
    for (let i = shapes.Count; i >= 1; i--) {
      shapes.Item(i).Delete();
    }
  }
}
