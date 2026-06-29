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
    /** 当前激活的演示文稿（仅演示宿主有意义；WPS-D1 PPT 用）。 */
    readonly ActivePresentation?: unknown;
    /** 当前激活的工作簿（表格宿主，Phase 32）。 */
    readonly ActiveWorkbook?: WpsWorkbook;
    /** 当前激活工作表（表格宿主便捷入口，= ActiveWorkbook.ActiveSheet）。 */
    readonly ActiveSheet?: WpsWorksheet;
    /** 全部工作表集合（表格宿主）。 */
    readonly Worksheets?: WpsWorksheets;
    /** 当前选区（表格宿主：返回一个 Range；无选区时由实现兜底）。 */
    readonly Selection?: WpsRange;
    /** 当前激活的文档（仅文字宿主，WPS-D1）。 */
    readonly ActiveDocument?: unknown;
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
