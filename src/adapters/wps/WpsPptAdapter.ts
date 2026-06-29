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

// ---------------------------------------------------------------------------
// declare global 增量声明（declaration merging）—— 给 wps-jsapi.d.ts 的全局接口补
// Phase 34 完整 PPT 写工具用到的 VBA 成员。**不**编辑共享 d.ts（用户中央合并）。
// 全部 [真机待验]：据 PowerPoint VBA OM + WPS 官方文档推断，未经 Windows WPS 真机核对。
// ---------------------------------------------------------------------------
declare global {
  interface WpsSlides {
    /** VBA Slides.Item(i).Duplicate() 复制整页，返回 SlideRange（取 Item(1) 为新页）。[真机待验] */
    // （Duplicate 挂在 WpsSlide 上，见下）
    /** 删除指定页（部分 WPS 版本 Slides 级无 Delete，优先 Slide.Delete）。[真机待验] */
    readonly _slidesDeleteMarker?: never;
  }

  interface WpsSlide {
    /** 删除整页（VBA Slide.Delete）。部分版本可能不暴露 → deleteSlideObject 兜底。[真机待验] */
    Delete?(): void;
    /** 复制整页到其后（VBA Slide.Duplicate），返回包含新页的 SlideRange。[真机待验] */
    Duplicate?(): WpsSlideRange;
    /** 幻灯片背景（VBA Slide.Background → ShapeRange/Fill）。[真机待验] */
    readonly Background?: WpsSlideBackground;
    /** 主题色之外的纯背景填充快捷入口（部分版本 Slide.Background.Fill）。[真机待验] */
    readonly FollowMasterBackground?: number;
  }

  /** Slide.Duplicate() 返回的范围（1-based Item，Count 通常 1）。[真机待验] */
  interface WpsSlideRange {
    readonly Count: number;
    Item(index: number): WpsSlide;
  }

  /** 幻灯片背景对象（VBA Slide.Background 是一个 ShapeRange，.Fill 为 FillFormat）。[真机待验] */
  interface WpsSlideBackground {
    readonly Fill?: WpsFillFormat;
  }

  interface WpsShapes {
    /**
     * 新增表格（VBA Shapes.AddTable(NumRows, NumColumns, Left, Top, Width, Height)）。
     * 返回的 Shape.Table.Cell(r,c).Shape.TextFrame.TextRange.Text 承载单元格文字。[真机待验]
     */
    AddTable?(numRows: number, numCols: number, left: number, top: number, width: number, height: number): WpsShape;
    /**
     * 新增直线（VBA Shapes.AddLine(BeginX, BeginY, EndX, EndY)，起止坐标——非包围盒）。返回 Shape。[真机待验]
     */
    AddLine?(beginX: number, beginY: number, endX: number, endY: number): WpsShape;
    /**
     * 新增连接符（VBA Shapes.AddConnector(Type, BeginX, BeginY, EndX, EndY)）。
     * Type = MsoConnectorType（1=Straight/2=Elbow/3=Curve）。[真机待验]
     */
    AddConnector?(type: number, beginX: number, beginY: number, endX: number, endY: number): WpsShape;
  }

  interface WpsShape {
    /** 旋转角度（VBA Shape.Rotation，degrees，可读写）。[真机待验] 读回稳定性 */
    Rotation?: number;
    /** 填充（VBA Shape.Fill → FillFormat）。[真机待验] */
    readonly Fill?: WpsFillFormat;
    /** 线条（VBA Shape.Line → LineFormat）。[真机待验] */
    readonly Line?: WpsLineFormat;
    /** 表格访问（仅当 Shape.HasTable / Type=Table 时有效；VBA Shape.Table）。[真机待验] */
    readonly Table?: WpsTable;
    /**
     * 导出形状为图片文件（VBA Shape.Export(PathName, Filter, ...)）。WPS 桌面写本地文件，
     * 浏览器/webview 内无可靠 base64 回读路径 → get_shape_image 走诚实降级。[真机待验]
     */
    Export?(pathName: string, filterName: number): void;
  }

  /** 填充格式（VBA FillFormat）。颜色经 ForeColor.RGB（BGR long）。[真机待验] */
  interface WpsFillFormat {
    /** 填充类型（VBA msoFillType：0=mixed/1=solid/...）。读回判 no-op。[真机待验] */
    readonly Type?: number;
    /** 是否可见（VBA msoTrue=-1/msoFalse=0）。[真机待验] */
    Visible?: number;
    /** 前景色（VBA FillFormat.ForeColor 是 ColorFormat，.RGB 为 BGR long）。[真机待验] */
    readonly ForeColor?: WpsColorFormat;
    /** 设为纯色（VBA FillFormat.Solid()）。[真机待验] */
    Solid?(): void;
  }

  /** 线条格式（VBA LineFormat）。[真机待验] */
  interface WpsLineFormat {
    /** 是否可见（VBA msoTrue=-1/msoFalse=0）。[真机待验] */
    Visible?: number;
    /** 线宽（VBA LineFormat.Weight，points）。[真机待验] */
    Weight?: number;
    /** 虚线样式（VBA LineFormat.DashStyle，MsoLineDashStyle 整数）。[真机待验] */
    DashStyle?: number;
    /** 线条颜色（VBA LineFormat.ForeColor.RGB 为 BGR long）。[真机待验] */
    readonly ForeColor?: WpsColorFormat;
  }

  /** 颜色对象（VBA ColorFormat）。.RGB 是 BGR long 整数（非 #RRGGBB）。[真机待验] */
  interface WpsColorFormat {
    /** BGR long 整数（VBA RGB()，蓝在高位）。读写均为 BGR。[真机待验] */
    RGB?: number;
  }

  /** 表格对象（VBA Shape.Table）。[真机待验] */
  interface WpsTable {
    /** 1-based 行列取单元格（VBA Table.Cell(row, col)）。[真机待验] */
    Cell?(row: number, col: number): WpsTableCell;
  }

  /** 表格单元格（VBA TableCell，.Shape.TextFrame.TextRange.Text 承载文字）。[真机待验] */
  interface WpsTableCell {
    readonly Shape?: WpsShape;
  }

  interface WpsTextFrame {
    /** 段落格式（VBA TextFrame.TextRange.ParagraphFormat；也可能挂 TextFrame 级）。[真机待验] */
    readonly TextRange: WpsTextRange;
    /** 垂直对齐（VBA TextFrame.VerticalAnchor，MsoVerticalAnchor 整数）。[真机待验] */
    VerticalAnchor?: number;
  }

  /** 文本范围（VBA TextRange，含 Font + ParagraphFormat）。[真机待验] */
  interface WpsTextRange {
    Text: string;
    /** 字体（VBA TextRange.Font）。[真机待验] */
    readonly Font?: WpsFontFormat;
    /** 段落格式（VBA TextRange.ParagraphFormat）。[真机待验] */
    readonly ParagraphFormat?: WpsParagraphFormat;
  }

  /** 字体格式（VBA Font）。颜色经 Font.Color.RGB（BGR long）。[真机待验] */
  interface WpsFontFormat {
    /** 加粗（VBA msoTrue=-1/msoFalse=0；读写整数）。[真机待验] */
    Bold?: number;
    /** 斜体（同上）。[真机待验] */
    Italic?: number;
    /** 下划线（同上）。[真机待验] */
    Underline?: number;
    /** 字号（VBA Font.Size，points）。[真机待验] */
    Size?: number;
    /** 字体名（VBA Font.Name）。[真机待验] */
    Name?: string;
    /** 颜色（VBA Font.Color 是 ColorFormat，.RGB 为 BGR long）。[真机待验] */
    readonly Color?: WpsColorFormat;
  }

  /** 段落格式（VBA ParagraphFormat）。Alignment 为 PpParagraphAlignment 整数。[真机待验] */
  interface WpsParagraphFormat {
    /** 水平对齐（VBA PpParagraphAlignment：1=Left/2=Center/3=Right/4=Justify）。[真机待验] */
    Alignment?: number;
  }
}

/** Office.js 文本形状白名单（对齐 PptAdapter TEXT_SHAPE_TYPES，fail-closed）。 */
const TEXT_SHAPE_TYPES = new Set(['GeometricShape', 'TextBox', 'Placeholder', 'Callout']);

// ---------------------------------------------------------------------------
// 颜色转换 helper：Office.js 用 #RRGGBB；VBA ColorFormat.RGB 是 BGR long 整数。
// VBA RGB(r,g,b) = r + g*256 + b*65536（蓝在高位）→ 与 #RRGGBB 字节序相反，必须双向转换。
// [真机待验]：ColorFormat.RGB 确为 BGR long、且读写同序（未经 Windows WPS 真机核对）。
// ---------------------------------------------------------------------------

/** #RRGGBB（或 #RGB）→ VBA BGR long 整数。非法输入返回 null（调用方决定降级/跳过）。[真机待验] */
function hexToBgr(hex: string): number | null {
  if (typeof hex !== 'string') return null;
  let s = hex.trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join(''); // #RGB → #RRGGBB
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  // VBA BGR：低字节=R，中字节=G，高字节=B
  return r + (g << 8) + (b << 16);
}

/** VBA BGR long 整数 → #RRGGBB。非数字 / 负数返回 null。[真机待验] */
function bgrToHex(bgr: unknown): string | null {
  if (typeof bgr !== 'number' || !Number.isFinite(bgr) || bgr < 0) return null;
  const v = Math.round(bgr) & 0xffffff;
  const r = v & 0xff;
  const g = (v >> 8) & 0xff;
  const b = (v >> 16) & 0xff;
  const h = (n: number): string => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

/** msoTrue/msoFalse（-1/0）整数 → boolean；undefined/null → null。[真机待验] */
function msoBoolToJs(v: unknown): boolean | null {
  if (v === undefined || v === null) return null;
  return v !== 0;
}

/** boolean → msoTrue(-1)/msoFalse(0)。[真机待验] */
function jsBoolToMso(b: boolean): number {
  return b ? -1 : 0;
}

/**
 * Office.js 段落对齐枚举名 ↔ VBA PpParagraphAlignment 整数（双向）。[真机待验] 枚举值
 * Office.js 用 "Left"/"Center"/"Right"/"Justify"；VBA 1/2/3/4。
 */
const ALIGN_NAME_TO_INT: Record<string, number> = {
  Left: 1, Center: 2, Right: 3, Justify: 4,
};
const ALIGN_INT_TO_NAME: Record<number, string> = { 1: 'Left', 2: 'Center', 3: 'Right', 4: 'Justify' };
function alignNameToInt(name: string): number | null {
  return ALIGN_NAME_TO_INT[name] ?? null;
}
function alignIntToName(v: unknown): string | null {
  return typeof v === 'number' ? (ALIGN_INT_TO_NAME[v] ?? null) : null;
}

/** Office.js connector_type 名 → VBA MsoConnectorType 整数。[真机待验] 枚举值 */
const CONNECTOR_TYPE: Record<string, number> = {
  Straight: 1, // msoConnectorStraight
  Elbow: 2,    // msoConnectorElbow
  Curve: 3,    // msoConnectorCurve
};

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

      // get_shape_image（VIS-01 取图喂 vision）：WPS 桌面 webview 无可靠 base64 导出路径。
      // VBA Shape.Export 只能写本地文件（filter 整数 + 路径），浏览器内无法回读为 base64 喂 vision client。
      // → 诚实降级：返回结构化 UNSUPPORTED，引导用户改用回形针上传（对齐 Office.js PptAdapter Web 端
      //   getImageAsBase64 不可用时的 fallback 文案）。[真机待验] 是否存在 WPS 私有 base64 导出 API。
      case 'get_shape_image': {
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: '当前 WPS 版本无法读取选中图（桌面宿主限制），可点回形针上传这张图',
            recoverable: true,
            hint: '改用 InputBar 回形针按钮上传图片，绕过宿主限制',
          },
        };
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

  /**
   * set_shape_property 工具调用（D-01 护城河）。before-image = fill/line/geometry 快照。
   * inverse = restore_shape_property。返回 { beforeImage } 与 Office.js PptAdapter 同形。
   *
   * 颜色读写经 hexToBgr/bgrToHex（VBA ColorFormat.RGB 是 BGR long，非 #RRGGBB）。[真机待验]
   * D-11 可选 expectedState 并发防御：mismatch → throw HostApiError。
   */
  async setShapeProperty(
    slideIndex: number,
    shapeId: string,
    props: { fillColor?: string; lineColor?: string; lineWeight?: number; width?: number; height?: number },
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
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);

      // before-image 抓取（[真机待验] Fill/Line OM + BGR 读取）
      const fill = sh.Fill;
      const line = sh.Line;
      // fillType：Office.js 用 'Solid'/'NoFill' 等字符串；WPS Fill.Type 是整数（1=solid）。
      //   无法可靠区分 NoFill（msoFillType 无 NoFill 项，靠 Visible=0 判定）→ 映射为字符串。
      const fillVisible = msoBoolToJs(fill?.Visible);
      const fillType = fillVisible === false ? 'NoFill' : 'Solid';
      const fillColor = bgrToHex(fill?.ForeColor?.RGB);
      const lineColor = bgrToHex(line?.ForeColor?.RGB);
      const lineWeight = typeof line?.Weight === 'number' ? line.Weight : null;
      const lineVisible = msoBoolToJs(line?.Visible) ?? true;
      const width = sh.Width;
      const height = sh.Height;

      const beforeImage = { fillType, fillColor, lineColor, lineWeight, lineVisible, width, height };

      // D-11 并发防御
      if (expectedState?.fillColor && beforeImage.fillColor !== expectedState.fillColor) {
        throw new HostApiError(
          `WPS setShapeProperty: 并发修改冲突 — fill_color 已被外部改变（期望 ${expectedState.fillColor}，实际 ${beforeImage.fillColor ?? 'null'}）`,
        );
      }

      // 写入 props（颜色 #RRGGBB → BGR long）
      if (props.fillColor !== undefined && fill) {
        const bgr = hexToBgr(props.fillColor);
        if (bgr !== null) {
          fill.Solid?.();
          if (fill.Visible !== undefined) fill.Visible = -1;
          if (fill.ForeColor) fill.ForeColor.RGB = bgr;
        }
      }
      if (props.lineColor !== undefined && line) {
        const bgr = hexToBgr(props.lineColor);
        if (bgr !== null && line.ForeColor) line.ForeColor.RGB = bgr;
      }
      if (props.lineWeight !== undefined && line) {
        line.Weight = props.lineWeight;
      }
      if ((props.lineColor !== undefined || props.lineWeight !== undefined) && line) {
        line.Visible = -1; // 设了颜色/粗细 → 确保边框可见（对齐 Office.js）
      }
      if (props.width !== undefined) sh.Width = props.width;
      if (props.height !== undefined) sh.Height = props.height;

      return { beforeImage };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT setShapeProperty 失败', err);
    }
  }

  /**
   * set_shape_text_font 工具调用（PPT-01）。before-image = 字体属性包，inverse = restore_shape_font。
   * 字体颜色经 BGR 转换。仅文本形状（assertTextShape）。[真机待验] Font OM + Color.RGB BGR
   */
  async setShapeTextFont(
    slideIndex: number,
    shapeId: string,
    font: Record<string, unknown>,
  ): Promise<{ beforeFont: Record<string, unknown> }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      this.assertTextShape(sh, shapeId);
      const f = sh.TextFrame?.TextRange?.Font;
      if (!f) throw new HostApiError(`形状 ${shapeId} 无字体对象`);

      // before-image（msoBool → JS boolean；BGR → #RRGGBB；对齐 Office.js beforeFont 形状）
      const beforeFont: Record<string, unknown> = {
        bold: msoBoolToJs(f.Bold),
        italic: msoBoolToJs(f.Italic),
        underline: msoBoolToJs(f.Underline),
        color: bgrToHex(f.Color?.RGB),
        size: typeof f.Size === 'number' ? f.Size : null,
        name: typeof f.Name === 'string' ? f.Name : null,
      };

      if (font.bold !== undefined) f.Bold = jsBoolToMso(font.bold as boolean);
      if (font.italic !== undefined) f.Italic = jsBoolToMso(font.italic as boolean);
      if (font.underline !== undefined) f.Underline = jsBoolToMso(font.underline as boolean);
      if (font.color !== undefined) {
        const bgr = hexToBgr(font.color as string);
        if (bgr !== null && f.Color) f.Color.RGB = bgr;
      }
      if (font.size !== undefined) f.Size = font.size as number;
      if (font.name !== undefined) f.Name = font.name as string;

      return { beforeFont };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT setShapeTextFont 失败', err);
    }
  }

  /**
   * set_shape_text_alignment 工具调用（PPT-02）。before-image = 对齐枚举名，inverse = restore_shape_alignment。
   * 写后回读验证：写入后回读 Alignment，与目标比对 → effective（同步 OM 桌面通常可靠，回读 null 不冤枉判生效）。
   * [真机待验] ParagraphFormat.Alignment 枚举值（PpParagraphAlignment 1/2/3/4）。
   *
   * @returns { beforeAlignment: string|null, effective } beforeAlignment 为对齐枚举名（"Left"等），
   *   无法读 → null（工具层走 noop_inverse）。
   */
  async setShapeTextAlignment(
    slideIndex: number,
    shapeId: string,
    alignment: string,
  ): Promise<{ beforeAlignment: string | null; effective: boolean }> {
    const targetInt = alignNameToInt(alignment);
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      this.assertTextShape(sh, shapeId);
      const pf = sh.TextFrame?.TextRange?.ParagraphFormat;
      if (!pf) {
        // 段落格式不可读/写 → 诚实未生效（工具层报失败、不记 undo）
        return { beforeAlignment: null, effective: false };
      }
      try {
        const beforeInt = pf.Alignment;
        const beforeAlignment = alignIntToName(beforeInt);
        if (targetInt !== null) pf.Alignment = targetInt;
        // 写后回读验证（桌面同步 OM 通常可靠；回读不到不冤枉，一律判生效）
        const after = pf.Alignment;
        const effective =
          targetInt === null
            ? true
            : !(typeof after === 'number' && after === beforeInt && beforeInt !== targetInt);
        return { beforeAlignment, effective };
      } catch {
        return { beforeAlignment: null, effective: false };
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT setShapeTextAlignment 失败', err);
    }
  }

  /**
   * rotate_shape 工具调用（PPT-05）。before-image = 旋转角度，inverse = restore_shape_rotation。
   * 写后回读验证：写入后回读 Rotation 与目标比对（容差 0.5，含 360 环绕）。
   * [真机待验] Shape.Rotation 读回稳定性。
   *
   * @returns { beforeRotation: number|null, effective }
   */
  async rotateShape(
    slideIndex: number,
    shapeId: string,
    rotation: number,
  ): Promise<{ beforeRotation: number | null; effective: boolean }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.requireShape(slide, slideIndex, shapeId);
      try {
        const beforeRotation = typeof sh.Rotation === 'number' ? sh.Rotation : null;
        sh.Rotation = rotation;
        const after = typeof sh.Rotation === 'number' ? sh.Rotation : null;
        // 回读 null → 不冤枉判生效；回读≈旧角度且旧角度≉目标 → no-op
        const norm = (x: number): number => ((x % 360) + 360) % 360;
        const close = (a: number, b: number): boolean => {
          const d = Math.abs(norm(a) - norm(b));
          return d <= 0.5 || d >= 360 - 0.5;
        };
        const effective =
          after == null || beforeRotation == null
            ? true
            : !(close(after, beforeRotation) && !close(beforeRotation, rotation));
        return { beforeRotation, effective };
      } catch {
        return { beforeRotation: null, effective: false };
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT rotateShape 失败', err);
    }
  }

  /**
   * set_slide_background 工具调用（PPT-08）。before-image = 纯色（无纯色背景时 null），
   * inverse = restore_slide_background。仅纯色。写后回读验证（读回 fill 颜色匹配目标）。
   * [真机待验] Slide.Background.Fill OM + BGR。
   *
   * @returns { beforeColor: string|null, effective }
   */
  async setSlideBackground(
    slideIndex: number,
    color: string,
  ): Promise<{ beforeColor: string | null; effective: boolean }> {
    const targetBgr = hexToBgr(color);
    try {
      const slide = this.resolveSlide(slideIndex);
      const bg = slide.Background;
      const fill = bg?.Fill;
      if (!fill || targetBgr === null) {
        return { beforeColor: null, effective: false };
      }
      try {
        // before-image：仅当背景已是纯色才读得到旧色
        const beforeVisible = msoBoolToJs(fill.Visible);
        const beforeColor = beforeVisible === false ? null : bgrToHex(fill.ForeColor?.RGB);

        fill.Solid?.();
        if (fill.Visible !== undefined) fill.Visible = -1;
        if (fill.ForeColor) fill.ForeColor.RGB = targetBgr;

        // 写后回读验证（桌面同步 OM；回读不到不冤枉判生效）
        const after = fill.ForeColor?.RGB;
        const afterHex = bgrToHex(after);
        const effective = afterHex == null ? true : afterHex.toUpperCase() === (bgrToHex(targetBgr) ?? '').toUpperCase();
        return { beforeColor, effective };
      } catch {
        return { beforeColor: null, effective: false };
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT setSlideBackground 失败', err);
    }
  }

  /**
   * copy_slide 工具调用（PPT-07）。复制整页，inverse = delete_slide_by_index（capturedIndex+capturedId 双定位）。
   * VBA Slide.Duplicate() 复制到原页之后，返回 SlideRange（取 Item(1)=新页）。
   * 兜底：无 Duplicate → 抛 HostApiError（诚实失败，不假成功）。[真机待验] Duplicate 行为。
   *
   * 注：WPS Shape.Id 是同页唯一整数，跨页未必全局唯一 → capturedId 用「新页内首个形状 id 拼页号」无意义；
   *   改用 SlideIndex 作为 capturedId 兜底（与 capturedIndex 一致），双定位仍以 index 为主（deleteSlideByIndex
   *   先 id 后 index，两者相等不影响正确性）。[真机待验] Slide 是否有稳定 SlideID。
   *
   * @returns { capturedId, capturedIndex } capturedIndex 为 0-based（对齐 Office.js）
   */
  async copySlide(
    sourceIndex: number,
    targetIndex?: number,
  ): Promise<{ capturedId: string; capturedIndex: number }> {
    try {
      const slides = getPres().Slides;
      const src = this.resolveSlide(sourceIndex);
      const dup = src.Duplicate;
      if (typeof dup !== 'function') {
        throw new HostApiError('WPS PPT copySlide: 当前版本不支持 Slide.Duplicate（无法复制幻灯片）');
      }
      const range = dup.call(src);
      // Duplicate 后副本通常紧跟源页之后（sourceIndex+1）。SlideRange.Item(1) 取新页。
      const newSlide = range && range.Count >= 1 ? range.Item(1) : slides.Item(Math.min(sourceIndex + 1, slides.Count));
      // 1-based SlideIndex → 0-based capturedIndex（对齐 Office.js）
      const oneBased = typeof newSlide.SlideIndex === 'number' ? newSlide.SlideIndex : sourceIndex + 1;
      const capturedIndex = oneBased - 1;
      // capturedId：WPS Slide 无统一全局 ID → 用 0-based index 字符串（deleteSlideByIndex 双定位以 index 为主）
      const capturedId = String(capturedIndex);
      // targetIndex 重排：WPS 无简单 MoveTo；v1 投机预写忽略精确目标位（追加在源页后），对齐 Office.js「默认末尾/位置」语义弱保证。
      void targetIndex;
      return { capturedId, capturedIndex };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT copySlide 失败', err);
    }
  }

  /**
   * manage_slides 工具调用（PPT-06，v2.1 仅 delete）。inverse = noop_inverse（页内容无法序列化）。
   * @returns {} 无 before-image
   */
  async manageSlides(operation: 'delete', slideIndex: number): Promise<Record<string, never>> {
    if (operation !== 'delete') {
      throw new HostApiError(`manage_slides 当前仅支持 delete 操作（v2.1），收到: ${String(operation)}`);
    }
    try {
      const slides = getPres().Slides;
      const slide = this.resolveSlide(slideIndex);
      this.deleteSlideObject(slides, slideIndex, slide);
      return {};
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT manageSlides 失败', err);
    }
  }

  /**
   * apply_slide_layout 工具调用（PVQ-03 盖印章建整页）。在末尾新建一页 + 批量建好 ShapeSpec[] 所有形状。
   * inverse = delete_slide_by_index（删整张新页，capturedIndex+capturedId）。
   * WPS 同步 OM 无 Office.js #5022/#2903 竞态 → 单趟顺序建形状即可（不需双 run / set-diff）。
   * newShapeIds[i] ↔ shapeSpecs[i]（建序 = spec 序，工具层 layout_check 依赖）。
   * 颜色经 BGR；对齐经枚举整数。[真机待验] Slides.Add layout、AddShape/AddTextbox、Fill/Line/Font/Align OM。
   *
   * @returns { capturedIndex(0-based), capturedId, slideIndex(1-based), newShapeIds }
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
    let createdAt: number | undefined; // 1-based 新页序号（catch 清孤儿页用）
    try {
      const slides = getPres().Slides;
      // 末尾新建空白页（12=ppLayoutBlank，[真机待验]）
      const oneBased = slides.Count + 1;
      const slide = slides.Add(oneBased, 12);
      createdAt = typeof slide.SlideIndex === 'number' ? slide.SlideIndex : oneBased;
      const capturedIndex = createdAt - 1;
      const capturedId = String(capturedIndex);

      const newShapeIds: string[] = [];
      for (const s of shapeSpecs) {
        const { left, top, width, height } = s.rect;
        let shape: WpsShape;
        if (s.shapeType === 'TextBox') {
          shape = slide.Shapes.AddTextbox(0, left, top, width, height);
          if (s.text !== undefined && shape.TextFrame) shape.TextFrame.TextRange.Text = s.text;
        } else {
          const autoType = AUTO_SHAPE_TYPE[s.shapeType];
          if (autoType === undefined) {
            throw new HostApiError(`WPS applySlideLayout: 不支持的形状类型 ${s.shapeType}`);
          }
          shape = slide.Shapes.AddShape(autoType, left, top, width, height);
          // 几何文字（仅文本形状）
          if (s.text !== undefined && shape.TextFrame) shape.TextFrame.TextRange.Text = s.text;
        }

        // fill（几何）：有色 → 纯色填充
        if (s.shapeType !== 'TextBox' && s.fillColor) {
          const bgr = hexToBgr(s.fillColor);
          const fill = shape.Fill;
          if (bgr !== null && fill) {
            fill.Solid?.();
            if (fill.Visible !== undefined) fill.Visible = -1;
            if (fill.ForeColor) fill.ForeColor.RGB = bgr;
          }
        }
        // line（几何）：有色 → 画线；无 → 去黑边（UAT-4 对齐）
        if (s.shapeType !== 'TextBox') {
          const line = shape.Line;
          if (s.lineColor && line) {
            const bgr = hexToBgr(s.lineColor);
            if (bgr !== null && line.ForeColor) line.ForeColor.RGB = bgr;
            line.Visible = -1;
            if (s.lineWeight !== undefined) line.Weight = s.lineWeight;
          } else if (line) {
            line.Visible = 0;
          }
        }
        // 字体（TextBox + 几何同路）
        if (s.font) {
          const f = shape.TextFrame?.TextRange?.Font;
          if (f) {
            if (s.font.size !== undefined) f.Size = s.font.size;
            if (s.font.bold !== undefined) f.Bold = jsBoolToMso(s.font.bold);
            if (s.font.color !== undefined) {
              const bgr = hexToBgr(s.font.color);
              if (bgr !== null && f.Color) f.Color.RGB = bgr;
            }
            if (s.font.name !== undefined) f.Name = s.font.name;
          }
        }
        // 对齐：H（段落 Alignment）+ V（TextFrame.VerticalAnchor，仅几何如 KPI 大数字）
        const tf = shape.TextFrame;
        if (tf) {
          if (s.align) {
            const ai = alignNameToInt(s.align);
            if (ai !== null && tf.TextRange?.ParagraphFormat) tf.TextRange.ParagraphFormat.Alignment = ai;
          }
          if (s.vAlign && tf.VerticalAnchor !== undefined) {
            // MsoVerticalAnchor：1=Top/3=Middle/4=Bottom（[真机待验]）
            const vmap: Record<string, number> = { Top: 1, Middle: 3, Bottom: 4 };
            const vi = vmap[s.vAlign];
            if (vi !== undefined) tf.VerticalAnchor = vi;
          }
        }

        newShapeIds.push(String(shape.Id));
      }

      return { capturedIndex, capturedId, slideIndex: capturedIndex + 1, newShapeIds };
    } catch (err) {
      // 事务性：建页后失败 → 尽力删半成品孤儿页（对齐 Office.js）
      if (createdAt !== undefined) {
        try {
          await this.deleteSlideByIndex({ capturedIndex: createdAt - 1, capturedId: String(createdAt - 1) });
        } catch {
          /* 清理失败不掩盖原 error */
        }
      }
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT applySlideLayout 失败', err);
    }
  }

  /**
   * insert_ppt_table 工具调用（PPT-09）。VBA Shapes.AddTable(rows, cols, left, top, width, height)。
   * 单元格文字经 shape.Table.Cell(r,c).Shape.TextFrame.TextRange.Text（1-based 行列）。
   * inverse = delete_shape_by_id（表格是单 shape，复用既有 inverse）。
   * 无 AddTable → 抛 HostApiError（诚实失败）。[真机待验] AddTable 签名 + Table.Cell OM。
   *
   * @returns { newShapeId, effective } effective:false 仅当门控不支持（WPS 无 isSetSupported → 恒 true 或抛错）
   */
  async insertTable(
    slideIndex: number,
    rows: number,
    cols: number,
    data?: string[][],
  ): Promise<{ newShapeId: string; effective: boolean }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const addTable = slide.Shapes.AddTable;
      if (typeof addTable !== 'function') {
        throw new HostApiError('WPS PPT insertTable: 当前版本不支持 Shapes.AddTable（无法插入表格）');
      }
      // 默认位置/尺寸（pt）；Office.js addTable 无显式位置但 WPS AddTable 要求 → 给合理默认
      const left = 50, top = 80, width = 600, height = Math.max(40, rows * 30);
      const tableShape = addTable.call(slide.Shapes, rows, cols, left, top, width, height);
      const newShapeId = String(tableShape.Id);

      // 填值（1-based 行列；缺格 ""，对齐 Office.js Pitfall 4）
      if (data !== undefined && tableShape.Table?.Cell) {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            try {
              const cell = tableShape.Table.Cell(r + 1, c + 1);
              const cellTf = cell?.Shape?.TextFrame;
              if (cellTf) cellTf.TextRange.Text = data?.[r]?.[c] ?? '';
            } catch {
              /* 单格填值失败不阻断（[真机待验] Cell OM） */
            }
          }
        }
      }

      return { newShapeId, effective: true };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT insertTable 失败', err);
    }
  }

  /**
   * add_line 工具调用（PPT-10）。VBA Shapes.AddLine(beginX, beginY, endX, endY)（起止坐标，非包围盒）；
   * Elbow/Curve 走 AddConnector(type, ...)。可设 line color/weight/dashStyle。
   * inverse = delete_shape_by_id（线条单 shape，复用既有 inverse）。
   * 无 AddLine/AddConnector → 抛 HostApiError。[真机待验] AddLine/AddConnector 签名。
   *
   * @returns { newShapeId, effective }
   */
  async addLine(
    slideIndex: number,
    connectorType: string,
    start: { left: number; top: number },
    end: { left: number; top: number },
    lineProps?: { color?: string; weight?: number; dashStyle?: string },
  ): Promise<{ newShapeId: string; effective: boolean }> {
    try {
      const slide = this.resolveSlide(slideIndex);
      const shapes = slide.Shapes;
      let lineShape: WpsShape;
      if (connectorType === 'Straight' || !CONNECTOR_TYPE[connectorType]) {
        // 直线：优先 AddLine（起止坐标）
        const addLine = shapes.AddLine;
        if (typeof addLine === 'function') {
          lineShape = addLine.call(shapes, start.left, start.top, end.left, end.top);
        } else if (typeof shapes.AddConnector === 'function') {
          lineShape = shapes.AddConnector.call(shapes, CONNECTOR_TYPE.Straight, start.left, start.top, end.left, end.top);
        } else {
          throw new HostApiError('WPS PPT addLine: 当前版本不支持 AddLine/AddConnector（无法插入线条）');
        }
      } else {
        // 折线/曲线：AddConnector
        const addConnector = shapes.AddConnector;
        if (typeof addConnector !== 'function') {
          throw new HostApiError('WPS PPT addLine: 当前版本不支持 AddConnector（无法插入折线/曲线）');
        }
        lineShape = addConnector.call(shapes, CONNECTOR_TYPE[connectorType], start.left, start.top, end.left, end.top);
      }

      const newShapeId = String(lineShape.Id);

      // 线条样式（color #RRGGBB → BGR；weight pt；dashStyle 名 → MsoLineDashStyle 整数）
      if (lineProps) {
        const line = lineShape.Line;
        if (line) {
          if (lineProps.color !== undefined) {
            const bgr = hexToBgr(lineProps.color);
            if (bgr !== null && line.ForeColor) line.ForeColor.RGB = bgr;
          }
          if (lineProps.weight !== undefined) line.Weight = lineProps.weight;
          if (lineProps.dashStyle !== undefined) {
            // MsoLineDashStyle：1=Solid/2=Square/3=Dash/4=DashDot/5=DashDotDot/6=LongDash/...（[真机待验]）
            const dashMap: Record<string, number> = {
              Solid: 1, SquareDot: 2, Dash: 3, DashDot: 4, DashDotDot: 5,
              LongDash: 6, LongDashDot: 7, RoundDot: 2,
            };
            const di = dashMap[lineProps.dashStyle];
            if (di !== undefined) line.DashStyle = di;
          }
        }
      }

      return { newShapeId, effective: true };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT addLine 失败', err);
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

  /** restore_shape_property inverse（set_shape_property / set_shape_gradient 的 reverse）。 */
  async restoreShapeProperty(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const fillType = args.fill_type as string;
    const fillColor = args.fill_color as string | null;
    const lineColor = args.line_color as string | null;
    const lineWeight = args.line_weight as number | null;
    const lineVisible = args.line_visible as boolean;
    const width = args.width as number;
    const height = args.height as number;
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (!sh) throw new HostApiError(`WPS restoreShapeProperty: 形状 ${shapeId} 已不存在`);

      const fill = sh.Fill;
      const line = sh.Line;
      // fill 还原：NoFill → 隐藏填充；否则纯色还原
      if (fill) {
        if (fillType === 'NoFill') {
          if (fill.Visible !== undefined) fill.Visible = 0;
        } else if (fillColor !== null) {
          const bgr = hexToBgr(fillColor);
          if (bgr !== null) {
            fill.Solid?.();
            if (fill.Visible !== undefined) fill.Visible = -1;
            if (fill.ForeColor) fill.ForeColor.RGB = bgr;
          }
        }
      }
      // line 还原：无边框 → 隐藏；有边框 → 还原色+粗细+显示
      if (line) {
        if (!lineVisible) {
          line.Visible = 0;
        } else {
          if (lineColor !== null) {
            const bgr = hexToBgr(lineColor);
            if (bgr !== null && line.ForeColor) line.ForeColor.RGB = bgr;
          }
          if (lineWeight !== null) line.Weight = lineWeight;
          line.Visible = -1;
        }
      }
      // geometry 还原
      if (typeof width === 'number') sh.Width = width;
      if (typeof height === 'number') sh.Height = height;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeProperty 失败', err);
    }
  }

  /** restore_shape_font inverse（set_shape_text_font 的 reverse）。 */
  async restoreShapeFont(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const beforeFont = (args.before_font ?? {}) as Record<string, unknown>;
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (!sh) throw new HostApiError(`WPS restoreShapeFont: 形状 ${shapeId} 已不存在`);
      const f = sh.TextFrame?.TextRange?.Font;
      if (!f) return; // 无字体对象 → 安全跳过
      if (beforeFont.bold !== undefined && beforeFont.bold !== null) f.Bold = jsBoolToMso(beforeFont.bold as boolean);
      if (beforeFont.italic !== undefined && beforeFont.italic !== null) f.Italic = jsBoolToMso(beforeFont.italic as boolean);
      if (beforeFont.underline !== undefined && beforeFont.underline !== null) f.Underline = jsBoolToMso(beforeFont.underline as boolean);
      if (beforeFont.color !== undefined && beforeFont.color !== null) {
        const bgr = hexToBgr(beforeFont.color as string);
        if (bgr !== null && f.Color) f.Color.RGB = bgr;
      }
      if (beforeFont.size !== undefined && beforeFont.size !== null) f.Size = beforeFont.size as number;
      if (beforeFont.name !== undefined && beforeFont.name !== null) f.Name = beforeFont.name as string;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeFont 失败', err);
    }
  }

  /** restore_shape_alignment inverse（set_shape_text_alignment 的 reverse）。 */
  async restoreShapeAlignment(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const beforeAlignment = args.before_alignment as string | null;
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (!sh) throw new HostApiError(`WPS restoreShapeAlignment: 形状 ${shapeId} 已不存在`);
      const pf = sh.TextFrame?.TextRange?.ParagraphFormat;
      if (pf && beforeAlignment !== null) {
        const ai = alignNameToInt(beforeAlignment);
        if (ai !== null) pf.Alignment = ai;
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeAlignment 失败', err);
    }
  }

  /** restore_shape_rotation inverse（rotate_shape 的 reverse）。 */
  async restoreShapeRotation(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const shapeId = String(args.shape_id ?? '');
    const beforeRotation = args.before_rotation as number | null;
    try {
      const slide = this.resolveSlide(slideIndex);
      const sh = this.findShape(slide, shapeId);
      if (!sh) throw new HostApiError(`WPS restoreShapeRotation: 形状 ${shapeId} 已不存在`);
      if (beforeRotation !== null && sh.Rotation !== undefined) sh.Rotation = beforeRotation;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreShapeRotation 失败', err);
    }
  }

  /** restore_slide_background inverse（set_slide_background 的 reverse）。before_color null → 留原状（WPS 无 reset 通用 API）。 */
  async restoreSlideBackground(args: Record<string, unknown>): Promise<void> {
    const slideIndex = args.slide_index as number;
    const beforeColor = args.before_color as string | null;
    try {
      const slide = this.resolveSlide(slideIndex);
      const fill = slide.Background?.Fill;
      if (!fill) return; // 背景不可写 → 安全跳过
      if (beforeColor !== null) {
        const bgr = hexToBgr(beforeColor);
        if (bgr !== null) {
          fill.Solid?.();
          if (fill.Visible !== undefined) fill.Visible = -1;
          if (fill.ForeColor) fill.ForeColor.RGB = bgr;
        }
      }
      // before_color null = 原本非纯色背景：WPS 无统一 reset API → 不强行改（best-effort，[真机待验]）。
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT restoreSlideBackground 失败', err);
    }
  }

  /** delete_slide_by_index inverse（copy_slide / apply_slide_layout 的 reverse）。index+id 双定位删页。 */
  async deleteSlideByIndex(args: Record<string, unknown>): Promise<void> {
    const capturedIndex = args.capturedIndex as number; // 0-based
    const capturedId = String(args.capturedId ?? '');
    try {
      const slides = getPres().Slides;
      // 双定位：capturedId 在 WPS 即 0-based index 字符串（copySlide/applySlideLayout 约定），
      //   优先按 id（= index）定位，回退 capturedIndex。两者通常一致 → 1-based = index+1。
      const idAsIndex = /^\d+$/.test(capturedId) ? Number(capturedId) : NaN;
      const targetZeroBased = Number.isInteger(idAsIndex) ? idAsIndex : capturedIndex;
      const oneBased = targetZeroBased + 1;
      if (oneBased < 1 || oneBased > slides.Count) {
        throw new HostApiError(
          `WPS deleteSlideByIndex: 目标幻灯片已不存在（capturedIndex=${capturedIndex}, capturedId=${capturedId}, 共 ${slides.Count} 张）`,
        );
      }
      const slide = slides.Item(oneBased);
      this.deleteSlideObject(slides, oneBased, slide);
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS PPT deleteSlideByIndex 失败', err);
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
