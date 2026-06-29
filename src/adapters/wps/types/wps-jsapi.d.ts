/**
 * src/adapters/wps/types/wps-jsapi.d.ts — WPS JSAPI 最小类型声明（Phase 31）
 *
 * 现状：无官方 @types/wps。社区包 `wps-jsapi@1.0.5` 滞后（约 2020），
 * 不足以覆盖现行 JSAPI。本文件只声明 Phase 31 外壳 + 宿主识别用到的最小子集，
 * 后续 Phase 32（PPT adapter）按需补充 Presentation/Slides/Shapes 等。
 *
 * ⚠️ [真机待验]：以下签名据 WPS 官方文档（solution.wps.cn/docs/client/api）+ 探针 probe.js
 * 已用法推断，未经 Windows WPS 真机 IntelliSense 核对。真机若报类型/运行时不符，以真机为准。
 *
 * 设计依据：.planning/research/v2.5/STACK.md §TypeScript Types for WPS JSAPI
 */

declare global {
  /**
   * WPS 注入的全局应用对象（加载项 webview 内直接可用，无需 CDN 脚本）。
   * 替代 Office.js 的 `Office.context` 链。
   */
  interface WpsApplication {
    /**
     * 宿主组件类型判别字段（WPS 官方推荐）。
     * 1 = WPS 文字（Word）/ 2 = WPS 表格（Excel/ET）/ 3 = WPS 演示（PPT/WPP）。
     */
    readonly ComponentType: number;
    /** 当前激活的演示文稿（演示宿主，Phase 34）。 */
    readonly ActivePresentation?: WpsPresentation;
    /** 当前激活的演示窗口（演示宿主选区/当前页，Phase 34）。 */
    readonly ActiveWindow?: WpsPptWindow;
    /** 当前激活的工作簿（表格宿主，Phase 32）。 */
    readonly ActiveWorkbook?: WpsWorkbook;
    /** 当前激活工作表（表格宿主便捷入口，= ActiveWorkbook.ActiveSheet）。 */
    readonly ActiveSheet?: WpsWorksheet;
    /** 全部工作表集合（表格宿主）。 */
    readonly Worksheets?: WpsWorksheets;
    /**
     * 当前选区。表格宿主：返回一个 WpsRange；文字宿主：返回 WpsWordSelection。
     * 由各 adapter 按 ComponentType 自行收窄类型（运行时同名属性，静态用联合表达）。
     */
    readonly Selection?: WpsRange & WpsWordSelection;
    /** 当前激活的文档（文字宿主，Phase 34）。 */
    readonly ActiveDocument?: WpsDocument;
  }

  // -------------------------------------------------------------------------
  // WPS 文字（WPS Office Word）对象模型子集（Phase 34 — 投机预写）
  // ⚠️ [真机待验]：据 WPS 官方文档（solution.wps.cn/docs/client/api/Word）+ PowerPoint/Word VBA
  //    对象模型推断（桌面 wpsjs 加载项 = 同步 VBA 风格，非 WebOffice 异步 instance.Application）。
  //    未经 Windows WPS 真机核对；真机若不符以真机为准。
  // -------------------------------------------------------------------------

  interface WpsDocument {
    /** 全文 Range（≈ VBA Document.Content）。 */
    readonly Content: WpsWordRange;
    /** 段落集合（1-based Item）。 */
    readonly Paragraphs: WpsParagraphs;
    /** 按字符位置取 Range（VBA Document.Range(start, end)；无参=全文）。 */
    Range(start?: number, end?: number): WpsWordRange;
  }

  interface WpsParagraphs {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsParagraph;
  }

  interface WpsParagraph {
    readonly Range: WpsWordRange;
    /** 大纲级别（VBA wdOutlineLevel：1-9=标题层级，10=正文）。[真机待验] */
    readonly OutlineLevel?: number;
  }

  /** 文字 Range（VBA 风格）。[真机待验] 方法集与同步语义。 */
  interface WpsWordRange {
    /** 读/写文本（写入会替换该 Range 的内容）。 */
    Text: string;
    readonly Start: number;
    readonly End: number;
    /** 样式（VBA Range.Style；可读 NameLocal 判定标题）。[真机待验] */
    readonly Style?: { readonly NameLocal?: string } | string;
    /** 在 Range 之后插入文本（不含段落标记）。 */
    InsertAfter(text: string): void;
    /** 在 Range 之后插入一个段落标记。 */
    InsertParagraphAfter(): void;
    /** 删除该 Range 覆盖的内容。 */
    Delete(): void;
    /**
     * 折叠到起点(1=wdCollapseStart)或终点(0=wdCollapseEnd)。
     * [真机待验] WPS 是否沿用 wdCollapseDirection 常量值。
     */
    Collapse(direction?: number): void;
  }

  /** 文字宿主选区（VBA Selection）。[真机待验] */
  interface WpsWordSelection {
    Text: string;
    readonly Range: WpsWordRange;
    /** 在光标处键入文本。 */
    TypeText(text: string): void;
  }

  // -------------------------------------------------------------------------
  // WPS 演示（WPS Office PPT/WPP）对象模型子集（Phase 34 — 投机预写）
  // ⚠️ [真机待验]：据 WPS 官方文档（solution.wps.cn/docs/client/api/PPT）+ PowerPoint VBA 推断。
  //    桌面同步 VBA 风格。颜色为 BGR 整数、Shape.Id 唯一性/稳定性等 gotcha 未真机核对。
  // -------------------------------------------------------------------------

  interface WpsPresentation {
    readonly Slides: WpsSlides;
  }

  interface WpsSlides {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsSlide;
    /**
     * 新增幻灯片（VBA Slides.Add(Index, Layout)；Layout 为 PpSlideLayout 整数，
     * 12=ppLayoutBlank/2=ppLayoutText 等）。返回新建 Slide。[真机待验]
     */
    Add(index: number, layout: number): WpsSlide;
  }

  interface WpsSlide {
    /** 1-based 页序号。 */
    readonly SlideIndex: number;
    readonly Shapes: WpsShapes;
  }

  interface WpsShapes {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsShape;
    /**
     * 新增文本框（VBA 位置参：Orientation, Left, Top, Width, Height）。返回 Shape。[真机待验]
     */
    AddTextbox(orientation: number, left: number, top: number, width: number, height: number): WpsShape;
    /**
     * 新增自选图形（VBA 位置参：Type(MsoAutoShapeType), Left, Top, Width, Height）。返回 Shape。[真机待验]
     */
    AddShape(type: number, left: number, top: number, width: number, height: number): WpsShape;
  }

  interface WpsShape {
    /** 形状唯一 id（VBA Shape.Id，整数；同页内唯一）。[真机待验] 稳定性 */
    readonly Id: number;
    readonly Name: string;
    /** 形状类型（VBA MsoShapeType 整数：17=TextBox/14=Placeholder/1=AutoShape/13=Picture…）。 */
    readonly Type: number;
    Left: number;
    Top: number;
    Width: number;
    Height: number;
    /** 是否有文本框架（VBA msoTrue=-1/msoFalse=0）。[真机待验] */
    readonly HasTextFrame?: number;
    readonly TextFrame?: WpsTextFrame;
    /** 删除形状。 */
    Delete(): void;
  }

  interface WpsTextFrame {
    /** 是否含文本（VBA msoTrue=-1/msoFalse=0）。[真机待验] */
    readonly HasText?: number;
    readonly TextRange: { Text: string };
  }

  /** 演示窗口（当前页 + 选区）。[真机待验] */
  interface WpsPptWindow {
    readonly View?: { readonly Slide?: WpsSlide };
    readonly Selection?: {
      /** PpSelectionType（3=ppSelectionShapes）。[真机待验] */
      readonly Type?: number;
      readonly ShapeRange?: { readonly Count: number; Item(index: number): WpsShape };
    };
  }

  // -------------------------------------------------------------------------
  // WPS 表格（ET）对象模型子集（Phase 32 Excel 滩头堡）
  // ⚠️ [真机待验]：据 WPS 官方文档（solution.wps.cn/docs/client/api/Excel）+ CSDN 实证推断，
  //    同步 VBA 风格；未经 Windows WPS 真机核对。真机若不符以真机为准。
  // -------------------------------------------------------------------------

  interface WpsWorkbook {
    readonly ActiveSheet: WpsWorksheet;
    readonly Worksheets: WpsWorksheets;
  }

  /** 工作表集合：1-based Item(i)，可 for..of 迭代。 */
  interface WpsWorksheets {
    readonly Count: number;
    Item(index: number | string): WpsWorksheet;
    [Symbol.iterator](): Iterator<WpsWorksheet>;
  }

  interface WpsWorksheet {
    readonly Name: string;
    /** 已用区域（≈ Office.js getUsedRange）。空表行为 [真机待验]。 */
    readonly UsedRange: WpsRange;
    /** 全部单元格集合（返回 Range）。 */
    readonly Cells: WpsRange;
    /** 按地址取区域，如 Range("A1:B2") / Range("A1")。 */
    Range(address: string): WpsRange;
  }

  /**
   * 单元格区域。VBA 风格关键 gotcha：
   * - Value2 读单格 → 标量；读多格 → 2D 数组。写：Value2 = 2D 数组。
   * - Address 返绝对格式 "$A$1:$B$2"。[真机待验] 是属性还是 Address() 方法。
   */
  interface WpsRange {
    /** 读/写值（多格 2D 数组，单格标量）。 */
    Value2: unknown;
    /** 读/写公式。 */
    Formula: unknown;
    /** 地址（绝对格式 "$A$1:$B$2"）。[真机待验] 可能是 Address() 方法。 */
    readonly Address: string;
    /** 单元格总数。 */
    readonly Count: number;
    readonly Rows: { readonly Count: number };
    readonly Columns: { readonly Count: number };
    /** 连续数据块（≈ usedRange 局部）。 */
    readonly CurrentRegion: WpsRange;
    /** 按数组尺寸调整区域后再写值。 */
    Resize(rowSize: number, colSize: number): WpsRange;
  }

  /**
   * 任务窗格句柄（wps.CreateTaskPane 返回）。
   */
  interface WpsTaskPane {
    readonly ID: number;
    Visible: boolean;
    Width: number;
  }

  /**
   * WPS 加载项命名空间（全局 `wps`）。
   * 仅声明 Phase 31 ribbon 控制器用到的成员。
   */
  interface WpsNamespace {
    /** 创建任务窗格，url 指向 taskpane html。 */
    CreateTaskPane(url: string): WpsTaskPane;
    /** 按 ID 取已存在任务窗格。 */
    GetTaskPane(id: number): WpsTaskPane | null;
    /**
     * 会话内 KV 缓存。⚠️ 非持久：关闭加载项即失效（官方明确）。
     * 仅用于缓存 taskpane ID 等会话态，**绝不存 API Key**（用 localStorage）。
     */
    PluginStorage: {
      getItem(key: string): string | null;
      setItem(key: string, value: string): void;
    };
  }

  // WPS 注入的全局符号
  // eslint-disable-next-line no-var
  var Application: WpsApplication;
  // eslint-disable-next-line no-var
  var wps: WpsNamespace;

  interface Window {
    Application?: WpsApplication;
    wps?: WpsNamespace;
    // ribbon 控制器（classic script）挂在 window 上的全局回调，供 ribbon.xml 按名绑定
    OnAddinLoad?: (ribbon: unknown) => void;
    ShowTaskPane?: (control?: unknown) => void;
    OnGetEnabled?: (control?: unknown) => boolean;
  }
}

export {};
