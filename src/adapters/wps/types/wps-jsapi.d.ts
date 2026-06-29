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
    /** 当前激活的演示文稿（仅演示宿主有意义；Phase 32 PPT 用）。 */
    readonly ActivePresentation?: unknown;
    /** 当前激活的工作簿（仅表格宿主）。 */
    readonly ActiveWorkbook?: unknown;
    /** 当前激活的文档（仅文字宿主）。 */
    readonly ActiveDocument?: unknown;
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
