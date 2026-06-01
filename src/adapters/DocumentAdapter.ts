/**
 * DocumentAdapter — 跨宿主底座契约（FOUND-03/FOUND-04/NFR-04/NFR-05）
 *
 * 本文件为纯类型文件（0 import，无运行时逻辑）。
 * 定义 Aster 三宿主（PPT/Excel/Word）的统一接口契约，
 * Phase 2-6 所有宿主操作均依赖此文件的 export。
 *
 * 安全注意（T-01-04）：错误类的 message 字段禁止嵌入 API Key 或凭证原文。
 */

// ---------------------------------------------------------------------------
// SelectionContext — discriminated union（判别字段 `kind`）
// REQUIREMENTS FOUND-04 / CONTEXT D-13/D-14/D-16
// ---------------------------------------------------------------------------

/** PPT 宿主：当前聚焦的 slide（对应上下文卡「第 N 张 slide」） */
export type PptSelectionContext = {
  kind: 'ppt';
  /** 当前 slide 的 1-based 序号（直接对应「第 N 张」，消费方无需再 +1） */
  slideIndex: number;
  /** Presentation 总 slide 数 */
  slideCount: number;
  /**
   * 首个选中形状的唯一 id（PowerPointApi 1.5 getSelectedShapes）。
   * 仅当用户在当前 slide 选中了至少一个形状时存在；只选 slide 未选形状时 undefined。
   * Agent 应优先用它精确定位目标形状，避免 list 全部形状去猜（真机把旋转猜成图片的根因）。
   */
  selectedShapeId?: string;
  /** 全部选中形状的 id 列表（多选时；单选时长度为 1）。 */
  selectedShapeIds?: string[];
  /** 首个选中形状的类型（如 GeometricShape / TextBox / Picture / Placeholder）。 */
  selectedShapeType?: string;
};

/** Excel 宿主：当前选中区域（对应上下文卡「选中区域 A1:C10」） */
export type ExcelSelectionContext = {
  kind: 'excel';
  /** 区域地址，如 "A1:C10"；单格选中时形如 "A1" */
  address: string;
};

/** Word 宿主：当前选中文本（对应上下文卡「选中 N 字」） */
export type WordSelectionContext = {
  kind: 'word';
  /** 选中字符数（0 表示光标无选区） */
  charCount: number;
};

/**
 * 空态标记（D-16）：无选中内容时 getSelection() 返回此变体，
 * 而非抛错——上下文卡显示"未选中内容"占位。
 */
export type NoneSelectionContext = {
  kind: 'none';
};

/** SelectionContext — 四变体 discriminated union */
export type SelectionContext =
  | PptSelectionContext
  | ExcelSelectionContext
  | WordSelectionContext
  | NoneSelectionContext;

// ---------------------------------------------------------------------------
// InsertableContent — discriminated union（判别字段 `type`）
// REQUIREMENTS FOUND-04：text / paragraphs / bullets / formula /
//                         range-values / slides / image — 7 个变体
// ---------------------------------------------------------------------------

/** 纯文本插入（Word 段落替换、PPT 文本框等） */
export type TextContent = {
  type: 'text';
  value: string;
  /** D-23 G-05：写入位置；缺省 'cursor'（向后兼容 Phase 02-05 已落地的 insert({type:'text', value:...})） */
  position?: 'cursor' | 'replace_selection' | 'append_end';
};

/** 多段落插入（Word 多段文字） */
export type ParagraphsContent = {
  type: 'paragraphs';
  values: string[];
};

/** 项目符号列表（Word/PPT bullet） */
export type BulletsContent = {
  type: 'bullets';
  items: string[];
};

/** Excel 公式（写入单元格） */
export type FormulaContent = {
  type: 'formula';
  formula: string;
};

/** Excel 二维数组写入（批量 range.values） */
export type RangeValuesContent = {
  type: 'range-values';
  values: (string | number)[][];
};

/**
 * PPT 幻灯片（base64 编码的 pptx 片段）
 * 通过 insertSlidesFromBase64 插入新 slide（PPT-04）
 */
export type SlidesContent = {
  type: 'slides';
  base64: string;
};

/**
 * 图片插入（base64 编码，用于 PPT slide 配图）
 * targetSlideIndex 可选，未指定时插入到当前 slide
 */
export type ImageContent = {
  type: 'image';
  base64: string;
  targetSlideIndex?: number;
};

/** InsertableContent — 七变体 discriminated union */
export type InsertableContent =
  | TextContent
  | ParagraphsContent
  | BulletsContent
  | FormulaContent
  | RangeValuesContent
  | SlidesContent
  | ImageContent;

// ---------------------------------------------------------------------------
// AdapterCapabilities
// REQUIREMENTS FOUND-04
// ---------------------------------------------------------------------------

/**
 * AdapterCapabilities — 描述某宿主 adapter 的能力边界：
 * - 支持哪些 InsertableContent 类型
 * - 是否支持选区监听事件
 * - 所属宿主标识
 */
export interface AdapterCapabilities {
  /** 该宿主支持插入的内容类型列表 */
  supportedInserts: InsertableContent['type'][];
  /** 是否支持 onSelectionChanged 监听（宿主事件 API 是否可用） */
  supportsSelectionEvents: boolean;
  /** 宿主标识 */
  host: 'ppt' | 'excel' | 'word';
}

// ---------------------------------------------------------------------------
// ReadableQuery — discriminated union（判别字段 `kind`）
// REQUIREMENTS TOOL-01 / Phase 4 read tool 契约前提
// ---------------------------------------------------------------------------

/**
 * ReadableQuery — per-query 离散只读查询（TOOL-01）。
 *
 * 每个 kind 与一个 LLM read tool name 1:1 对应（dispatch 单一 tool → 单一 kind）。
 * 禁止 fat inspect（返整个 doc model）——每个 kind 只读取所需的最小信息片段（AP-2）。
 *
 * 判别字段 `kind` 与 SelectionContext 同款风格（保持整个文件一致）。
 */
export type ReadableQuery =
  | { kind: 'selection_detail' }                                    // 跨宿主，复用 SelectionContext
  // PPT
  | { kind: 'list_slides' }
  | { kind: 'get_slide'; slideIndex: number }                       // 1-based（与 SelectionContext 一致）
  | { kind: 'list_shapes_on_slide'; slideIndex: number }
  | { kind: 'get_shape'; slideIndex: number; shapeId: string }
  // Excel
  | { kind: 'list_worksheets' }
  | { kind: 'get_range_values'; address: string }
  | { kind: 'get_used_range_summary'; sheetName?: string }
  // Word
  | { kind: 'get_paragraph_count' }
  | { kind: 'get_paragraph_at'; index: number }
  | { kind: 'get_document_outline' }
  | { kind: 'get_document_full_text' };

// ---------------------------------------------------------------------------
// ReadToolError — 与 src/agent/tools/index.ts ToolError 形态对齐
// 因 0-import 约束不直接 import（防 adapter→agent 反向依赖）
// ---------------------------------------------------------------------------

/**
 * ReadToolError — read 操作失败时的错误形态。
 *
 * 与 src/agent/tools/index.ts 中 ToolError 的形态保持对齐，
 * 但为保持本文件 0 import 约束（防 adapter→agent 反向依赖），
 * 在本文件中 type-only 复制，不直接 import ToolError。
 */
export type ReadToolError = {
  code: string;
  message: string;
  recoverable: boolean;
  hint: string;
};

// ---------------------------------------------------------------------------
// ReadableResult — ok 判别（与 ToolResult 风格对齐）
// ---------------------------------------------------------------------------

/**
 * ReadableResult — read() 方法的返回类型。
 *
 * ok=true 时 data 为宿主 adapter 返回的结构化数据；
 * ok=false 时 error 为 ReadToolError（与 ToolError 形态对齐，0-import）。
 */
export type ReadableResult =
  | { ok: true; data: unknown }
  | { ok: false; error: ReadToolError };

// ---------------------------------------------------------------------------
// DocumentAdapter — 跨宿主接口
// REQUIREMENTS FOUND-03/FOUND-05 / CONTEXT D-13/D-14/D-16 / NFR-04/NFR-05
// ---------------------------------------------------------------------------

/**
 * DocumentAdapter — Aster 跨宿主统一接口。
 *
 * Phase 1 各 adapter 骨架（PptAdapter/ExcelAdapter/WordAdapter）实现此接口，
 * 通过 React Context 暴露给 Task Pane 组件树。
 *
 * 方法实现状态：
 * - getSelection()：Phase 1 真实实现，返回宿主当前选区
 * - onSelectionChanged()：Phase 1 真实实现，监听宿主 selection-changed 事件
 * - capabilities()：Phase 1 桩实现（返回静态声明）
 * - insert()：Phase 1 桩实现（抛 UnsupportedOperationError），Phase 2-6 完整实现
 */
export interface DocumentAdapter {
  /**
   * 获取当前选区上下文。
   * 无选中时返回 `{ kind: 'none' }`，不抛错（D-16）。
   */
  getSelection(): Promise<SelectionContext>;

  /**
   * 订阅宿主 selection-changed 事件（D-13）。
   * 返回解绑函数——在 React useEffect cleanup 中调用以取消监听。
   * 宿主事件差异封在各 adapter 内（NFR-05）。
   */
  onSelectionChanged(callback: () => void): () => void;

  /**
   * 返回该宿主 adapter 的能力声明。
   * Phase 1 各 adapter 返回桩（静态数据）。
   */
  capabilities(): AdapterCapabilities;

  /**
   * 向当前文档写入 AI 生成的内容（PANE-04 / PPT-04 / XLS-05 / DOC-04）。
   * Phase 1 桩：抛 UnsupportedOperationError。
   * Phase 2-6 按宿主实现具体写回逻辑。
   */
  insert(content: InsertableContent): Promise<void>;

  /**
   * per-query 离散只读（TOOL-01）。
   *
   * 禁 fat inspect 返整 doc model；每个 kind 对应一个 LLM read tool name（1:1 dispatch）。
   * 实现在各 *Adapter.read() switch 内，proxy 不出 *.run 闭包（A-06/TOOL-07）。
   * Phase 4 Plan 03/04/05 各宿主 Adapter 实现；本 plan 仅定接口契约。
   */
  read(query: ReadableQuery): Promise<ReadableResult>;
}
