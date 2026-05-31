/**
 * src/agent/tools/write/ppt.ts — PPT 宿主 write tools（Phase 5 Plan 07 / TOOL-03 / AGENT-08）
 *
 * Phase 5 PoC：insert_slide（在末尾插入新幻灯片）。
 * Phase 6 升级为多种精确定位写入，新增：
 *   - set_shape_property（D-01 差异化护城河）
 *   - move_shape（SC4 magic moment）
 *   - set_shape_text（TOOL-03 P1）
 *
 * 边界约束（A-06 / D-15）：
 *   - execute 输入纯数据，不接触 Office.js proxy 对象
 *   - adapter.insertSlideAfter 内部 PowerPoint.run 闭包负责所有 proxy 生命周期
 *   - reverse descriptor 仅字面量，由 OperationLog 真实回放消费
 *
 * D-05/D-06 reverse 精确定位：
 *   - 使用 title 指纹（slide 第一个文本形状首行），而非 index
 *   - 防止其他操作改变 slide 顺序导致 index 漂移
 *
 * TOOL-04 postState：
 *   - { kind: 'ppt_slide', content: { index: insertedIndex, title } }
 *   - 供 replayUndoAll 对比手动改（D-11 防御）
 */
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { PptAdapter } from '../../../adapters/PptAdapter';

interface InsertSlideArgs {
  afterIndex?: number;
  title: string;
  bullets?: string[];
}

// ---------------------------------------------------------------------------
// set_shape_property args schema（D-01 护城河 / RESEARCH.md lines 374-388）
// ---------------------------------------------------------------------------

interface SetShapePropertyArgs {
  slide_index: number;
  shape_id: string;
  fill_color?: string;
  line_color?: string;
  line_weight?: number;
  width?: number;
  height?: number;
  expected_state?: { fill_color?: string; line_color?: string }; // D-11 可选并发防御
}

// ---------------------------------------------------------------------------
// move_shape args schema
// ---------------------------------------------------------------------------

interface MoveShapeArgs {
  slide_index: number;
  shape_id: string;
  left: number;
  top: number;
}

// ---------------------------------------------------------------------------
// set_shape_text args schema（TOOL-03 P1）
// ---------------------------------------------------------------------------

interface SetShapeTextArgs {
  slide_index: number;
  shape_id: string;
  text: string;
}

// ---------------------------------------------------------------------------
// 共享 helper（260531-m4x）
// ---------------------------------------------------------------------------

/**
 * 键名容错读取（修 rotate_shape humanLabel undefined bug）。
 * 部分 PPT 工具 schema 用 camelCase（slideIndex/shapeId），sibling 工具用 snake_case
 * （slide_index/shape_id），LLM 易混传 → humanLabel/execute 取错键得 undefined。
 * 两种命名都读，杜绝「第 undefined 张…「undefined」」假标签。
 */
function pickSlideIndex(args: Record<string, unknown>): number {
  return (args.slideIndex ?? args.slide_index) as number;
}
function pickShapeId(args: Record<string, unknown>): string {
  return (args.shapeId ?? args.shape_id) as string;
}
function pickSourceIndex(args: Record<string, unknown>): number {
  return (args.sourceIndex ?? args.source_index) as number;
}
function pickTargetIndex(args: Record<string, unknown>): number | undefined {
  return (args.targetIndex ?? args.target_index) as number | undefined;
}

/**
 * 写后回读验证未通过时的「诚实失败」结果（260531-m4x，诚实底线）。
 * 网页版 PowerPoint 静默 no-op（报成功但实际没生效）→ 返回 ok:false，
 * **不带 reverse、不带 postState** → loop-helpers 不记 undo、UI 不报 ✅、熔断器记 failure。
 */
function notEffectiveResult(what: string): ToolResult {
  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED',
      message: `此操作（${what}）在网页版 PowerPoint 未生效（可能仅桌面版 PowerPoint 支持）`,
      recoverable: false,
      hint: `请勿重复尝试该操作；网页版 PowerPoint 不支持此能力，可在桌面版 PowerPoint 手动设置，或改用其它受支持的工具。`,
    },
  };
}

export const insertSlide: ToolDef<InsertSlideArgs> = {
  name: 'insert_slide',
  kind: 'write',
  description: '在 PPT 末尾插入新幻灯片。title 用于撤销定位。',
  parameters: {
    type: 'object',
    properties: {
      afterIndex: { type: 'number', description: '在第 N 张后插入（1-based）；省略则末尾' },
      title: { type: 'string', description: '新幻灯片标题（撤销定位用）' },
      bullets: { type: 'array', items: { type: 'string' }, description: '要点列表（PoC 暂存）' },
    },
    required: ['title'],
  },
  humanLabel: ({ title }) =>
    `在幻灯片末尾插入新幻灯片「${title.slice(0, 20)}${title.length > 20 ? '…' : ''}」`,
  async execute(args, ctx): Promise<ToolResult> {
    const { afterIndex, title } = args;
    // A-06：通过 ctx.adapter 调用，不直接引用 PowerPoint 命名空间
    const { insertedIndex } = await (ctx.adapter as PptAdapter).insertSlideAfter(
      afterIndex ?? -1,
      title,
    );
    // D-06 / TOOL-04：reverse 使用 title 指纹定位（不受 index 漂移影响）
    const reverse: ReverseDescriptor = {
      tool: 'delete_slide_by_title',
      args: { titleFingerprint: title },
    };
    // TOOL-04 postState 快照，供 replayUndoAll 对比手动改（D-11）
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide',
      content: { index: insertedIndex, title },
    };
    return { ok: true, data: { insertedIndex, title }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// set_shape_property（D-01 差异化护城河 — SC4 magic moment 形状样式修改）
// ---------------------------------------------------------------------------

/**
 * 修改 PPT 指定幻灯片形状的填充色、边框色/粗细或尺寸。
 * D-01 护城河：Copilot Agent Mode 不暴露此能力。
 * D-11：可选 expected_state 并发防御。
 */
export const setShapeProperty: ToolDef<SetShapePropertyArgs> = {
  name: 'set_shape_property',
  kind: 'write',
  description:
    '修改 PPT 指定幻灯片形状的填充色、边框色/粗细或尺寸。slide_index 为 1-based，shape_id 来自 list_shapes_on_slide。',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      fill_color: { type: 'string', description: '填充色 #RRGGBB' },
      line_color: { type: 'string', description: '边框色 #RRGGBB' },
      line_weight: { type: 'number', description: '边框粗细（points）' },
      width: { type: 'number', description: '宽度（points）' },
      height: { type: 'number', description: '高度（points）' },
      expected_state: {
        type: 'object',
        description: 'D-11 可选并发防御：指定期望的当前状态，不匹配则报错',
      },
    },
    required: ['slide_index', 'shape_id'],
  },
  humanLabel: ({ slide_index, shape_id, fill_color, line_color, line_weight }) => {
    const changes: string[] = [];
    if (fill_color) changes.push(`填充色改为 ${fill_color}`);
    if (line_color) changes.push(`边框色改为 ${line_color}`);
    if (line_weight !== undefined) changes.push(`边框粗细改为 ${line_weight}pt`);
    return `将第 ${slide_index} 张幻灯片形状「${shape_id}」${changes.join('，') || '尺寸调整'}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { slide_index, shape_id, fill_color, line_color, line_weight, width, height, expected_state } = args;
    // A-06：通过 ctx.adapter 调用，不直接引用 PowerPoint 命名空间
    const { beforeImage } = await (ctx.adapter as PptAdapter).setShapeProperty(
      slide_index,
      shape_id,
      {
        fillColor: fill_color,
        lineColor: line_color,
        lineWeight: line_weight,
        width,
        height,
      },
      expected_state
        ? { fillColor: expected_state.fill_color, lineColor: expected_state.line_color }
        : undefined,
    );
    // PATTERNS.md lines 135-158：reverse 包含完整 before-image（Record 对象，非位置参）
    const reverse: ReverseDescriptor = {
      tool: 'restore_shape_property',
      args: {
        slide_index,
        shape_id,
        fill_type: beforeImage.fillType,
        fill_color: beforeImage.fillColor,
        line_color: beforeImage.lineColor,
        line_weight: beforeImage.lineWeight,
        line_visible: beforeImage.lineVisible,
        width: beforeImage.width,
        height: beforeImage.height,
      },
    };
    // TOOL-04 postState 快照（kind: ppt_shape）
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape',
      content: { slide_index, shape_id, fill_color, line_color, line_weight, width, height },
    };
    return { ok: true, data: { slide_index, shape_id }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// move_shape（D-01 护城河 — SC4 magic moment 移动部分）
// ---------------------------------------------------------------------------

/**
 * 移动 PPT 指定形状到新的 left/top 位置（points）。
 */
export const moveShape: ToolDef<MoveShapeArgs> = {
  name: 'move_shape',
  kind: 'write',
  description: '移动 PPT 指定形状到新的 left/top 位置（points）。slide_index 为 1-based，shape_id 来自 list_shapes_on_slide。',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      left: { type: 'number', description: '新 X 坐标（points）' },
      top: { type: 'number', description: '新 Y 坐标（points）' },
    },
    required: ['slide_index', 'shape_id', 'left', 'top'],
  },
  humanLabel: ({ slide_index, shape_id, left, top }) =>
    `将第 ${slide_index} 张幻灯片形状「${shape_id}」移动到 left=${left} top=${top}`,
  async execute(args, ctx): Promise<ToolResult> {
    const { slide_index, shape_id, left, top } = args;
    // A-06：通过 ctx.adapter 调用
    const { beforeLeft, beforeTop } = await (ctx.adapter as PptAdapter).moveShape(
      slide_index,
      shape_id,
      left,
      top,
    );
    // reverse = restore_shape_geometry（Record 对象，非位置参）
    const reverse: ReverseDescriptor = {
      tool: 'restore_shape_geometry',
      args: { slide_index, shape_id, left: beforeLeft, top: beforeTop },
    };
    // TOOL-04 postState 快照（kind: ppt_shape）
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape',
      content: { slide_index, shape_id, left, top },
    };
    return { ok: true, data: { slide_index, shape_id, left, top }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// set_shape_text（TOOL-03 P1 — 编辑形状文字，低风险文本编辑工具）
// ---------------------------------------------------------------------------

/**
 * 修改 PPT 指定幻灯片形状的文字内容（TOOL-03 P1）。
 * 仅支持文本形状（GeometricShape/TextBox/Placeholder/Callout），
 * 非文本形状返回错误（fail-closed，T-06-06-04）。
 * 低风险文本编辑，不强制 expected_state（D-11 只给高风险写工具）。
 */
export const setShapeText: ToolDef<SetShapeTextArgs> = {
  name: 'set_shape_text',
  kind: 'write',
  description:
    '修改 PPT 指定幻灯片形状的文字内容。slide_index 为 1-based，shape_id 来自 list_shapes_on_slide。仅支持文本形状（GeometricShape/TextBox/Placeholder/Callout），非文本形状返回错误。',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      text: { type: 'string', description: '要写入的新文字内容' },
    },
    required: ['slide_index', 'shape_id', 'text'],
  },
  humanLabel: ({ slide_index, shape_id, text }) =>
    `将第 ${slide_index} 张幻灯片形状「${shape_id}」的文字改为「${String(text).slice(0, 20)}${String(text).length > 20 ? '…' : ''}」`,
  async execute(args, ctx): Promise<ToolResult> {
    const { slide_index, shape_id, text } = args;
    // A-06：通过 ctx.adapter 调用，不直接引用 PowerPoint 命名空间
    const { beforeText } = await (ctx.adapter as PptAdapter).setShapeText(
      slide_index,
      shape_id,
      text,
    );
    // reverse = restore_shape_text（Record 对象，非位置参，防 Phase 5 UAT 地雷）
    const reverse: ReverseDescriptor = {
      tool: 'restore_shape_text',
      args: { slide_index, shape_id, before_text: beforeText },
    };
    // TOOL-04 postState 快照（kind: ppt_shape，与 set_shape_property 一致）
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape' as const,
      content: { slide_index, shape_id, text },
    };
    return { ok: true, data: { written: String(text).length }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 3a：PPT-01 set_shape_text_font
// ---------------------------------------------------------------------------

/**
 * 设置 PPT 形状文字字体（字号/加粗/斜体/颜色/字体名）。
 * 仅支持文本形状（TEXT_SHAPE_TYPES），非文本形状返回错误。
 * 逆向 = restore_shape_font（Record 签名，before-image 字体属性包）。
 */
export const setShapeTextFontTool: ToolDef = {
  name: 'set_shape_text_font',
  kind: 'write',
  description: '设置 PPT 指定形状文字字体（字号/加粗/斜体/颜色/字体名）。仅支持文本形状（GeometricShape/TextBox/Placeholder/Callout）。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      shapeId: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      font: {
        type: 'object',
        description: '字体属性（至少提供一个字段）',
        properties: {
          size: { type: 'number', description: '字号（pt）' },
          bold: { type: 'boolean', description: '加粗' },
          italic: { type: 'boolean', description: '斜体' },
          underline: { type: 'boolean', description: '下划线' },
          color: { type: 'string', description: '字体颜色 #RRGGBB' },
          name: { type: 'string', description: '字体名称（如「微软雅黑」）' },
        },
      },
    },
    required: ['slideIndex', 'shapeId', 'font'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    // 键名容错（snake/camel）：防 LLM 传 slide_index/shape_id → undefined
    return `修改第 ${pickSlideIndex(a)} 张幻灯片形状「${pickShapeId(a)}」文字字体`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const shapeId = pickShapeId(a);
    const font = a.font as Record<string, unknown>;
    const { beforeFont } = await (ctx.adapter as PptAdapter).setShapeTextFont(slideIndex, shapeId, font);
    const reverse: ReverseDescriptor = {
      tool: 'restore_shape_font',
      args: { slide_index: slideIndex, shape_id: shapeId, before_font: beforeFont },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_font',
      content: { slideIndex, shapeId },
    };
    return { ok: true, data: { slideIndex, shapeId }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 3a：PPT-03 add_shape
// ---------------------------------------------------------------------------

/**
 * 在 PPT 幻灯片插入形状（几何形状或文本框）。
 * TextBox 类型会检测 Office.js #2775 bug：若 shape 数量在插入后减少则操作失败（不静默数据丢失）。
 * 逆向 = delete_shape_by_id（Record 签名，按 newShapeId 精确删除）。
 */
export const addShapeTool: ToolDef = {
  name: 'add_shape',
  kind: 'write',
  description: '在 PPT 指定幻灯片插入形状（几何形状或文本框）。TextBox 类型会检测 Office.js #2775 bug，若检测到 shape 被删除则操作失败。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      shapeType: {
        type: 'string',
        description: '形状类型',
        enum: ['TextBox', 'Rectangle', 'RoundedRectangle', 'Ellipse', 'Triangle', 'RightTriangle', 'Diamond', 'Pentagon', 'Hexagon', 'Arrow'],
      },
      position: {
        type: 'object',
        description: '形状位置和尺寸（points）',
        properties: {
          left: { type: 'number', description: 'X 坐标' },
          top: { type: 'number', description: 'Y 坐标' },
          width: { type: 'number', description: '宽度' },
          height: { type: 'number', description: '高度' },
        },
        required: ['left', 'top', 'width', 'height'],
      },
      text: { type: 'string', description: '形状内文字（可选）' },
    },
    required: ['slideIndex', 'shapeType', 'position'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a); // 键名容错（snake/camel）
    const shapeType = a.shapeType as string;
    const text = a.text as string | undefined;
    const label = shapeType === 'TextBox' ? '文本框' : `形状「${shapeType}」`;
    if (text) {
      return `在第 ${slideIndex} 张幻灯片插入${label}「${String(text).slice(0, 20)}${String(text).length > 20 ? '…' : ''}」`;
    }
    return `在第 ${slideIndex} 张幻灯片插入${label}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const shapeType = a.shapeType as string;
    const position = a.position as { left: number; top: number; width: number; height: number };
    const text = a.text as string | undefined;
    const { newShapeId } = await (ctx.adapter as PptAdapter).addShape(slideIndex, shapeType, position, text);
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index: slideIndex, shape_id: newShapeId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_new',
      content: { slideIndex, shapeId: newShapeId },
    };
    return { ok: true, data: { slideIndex, newShapeId }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 4：PPT-02 set_shape_text_alignment（spike S4）
// ---------------------------------------------------------------------------

/**
 * 设置 PPT 形状文字的段落对齐方式（PPT-02，spike S4）。
 * 运行时降级：若 paragraphFormat.alignment 不可读（S4 未通过），降级为 noop+gate 并显示警告。
 * 仅支持文本形状（GeometricShape/TextBox/Placeholder/Callout）。
 */
export const setShapeTextAlignmentTool: ToolDef = {
  name: 'set_shape_text_alignment',
  kind: 'write',
  description: '设置 PPT 指定形状文字的段落对齐（左/居中/右/两端对齐）。仅支持文本形状。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      shapeId: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      alignment: {
        type: 'string',
        description: '对齐方式',
        enum: ['Left', 'Center', 'Right', 'Justify'],
      },
    },
    required: ['slideIndex', 'shapeId', 'alignment'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const alignment = a.alignment as string;
    const labelMap: Record<string, string> = { Left: '左对齐', Center: '居中', Right: '右对齐', Justify: '两端对齐' };
    return `将第 ${pickSlideIndex(a)} 张幻灯片形状「${pickShapeId(a)}」文字设为${labelMap[alignment] ?? alignment}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const shapeId = pickShapeId(a);
    const alignment = a.alignment as string;
    const { beforeAlignment, effective } = await (ctx.adapter as PptAdapter).setShapeTextAlignment(slideIndex, shapeId, alignment);
    // 写后回读验证未通过（网页版静默 no-op）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('文字对齐');
    // 生效但写前为混合/未知对齐（beforeAlignment === null）→ 无法可靠还原，noop+gate
    const reverse: ReverseDescriptor = beforeAlignment === null
      ? { tool: 'noop_inverse', args: { reason: '原段落对齐为混合/未知值，此步不可自动撤销' } }
      : { tool: 'restore_shape_alignment', args: { slide_index: slideIndex, shape_id: shapeId, before_alignment: beforeAlignment } };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_alignment',
      content: { slideIndex, shapeId },
    };
    return { ok: true, data: { slideIndex, shapeId, alignment }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 4：PPT-04 delete_shape（noop+gate）
// ---------------------------------------------------------------------------

/**
 * 删除 PPT 指定幻灯片上的形状（PPT-04，noop+gate）。
 * 形状完整状态（类型/位置/填充/文字/字体）无法序列化重建，此步不可自动撤销。
 * DiffLog 显示「此操作不可自动撤销」警告，agent 流程不中断。
 */
export const deleteShapeTool: ToolDef = {
  name: 'delete_shape',
  kind: 'write',
  description: '删除 PPT 指定幻灯片上的形状。此操作不可自动撤销（形状状态无法序列化重建）。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      shapeId: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
    },
    required: ['slideIndex', 'shapeId'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    // 键名容错（snake/camel）
    return `删除第 ${pickSlideIndex(a)} 张幻灯片形状「${pickShapeId(a)}」`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const shapeId = pickShapeId(a);
    await (ctx.adapter as PptAdapter).deleteShape(slideIndex, shapeId);
    // noop+gate：形状状态无法序列化，不可自动撤销
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: '形状完整状态（类型/位置/填充/文字/字体）无法序列化重建，此步不可自动撤销' },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape',
      content: { slideIndex, shapeId },
    };
    return { ok: true, data: { slideIndex, shapeId }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 4：PPT-05 rotate_shape（spike S1）
// ---------------------------------------------------------------------------

/**
 * 旋转 PPT 指定形状到指定角度（PPT-05，spike S1）。
 * 运行时降级：若 shape.rotation 不可读（S1 未通过），降级为 noop+gate 并显示警告。
 */
export const rotateShapeTool: ToolDef = {
  name: 'rotate_shape',
  kind: 'write',
  description: '旋转 PPT 指定形状到指定角度（0-360 degrees）。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      shapeId: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      rotation: { type: 'number', description: '旋转角度（0-360 degrees）' },
    },
    required: ['slideIndex', 'shapeId', 'rotation'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    // 键名容错（修真机「第 undefined 张…「undefined」旋转至 45°」bug）
    return `将第 ${pickSlideIndex(a)} 张幻灯片形状「${pickShapeId(a)}」旋转至 ${a.rotation as number}°`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const shapeId = pickShapeId(a);
    const rotation = a.rotation as number;
    const { beforeRotation, effective } = await (ctx.adapter as PptAdapter).rotateShape(slideIndex, shapeId, rotation);
    // 写后回读验证未通过（网页版静默 no-op / 受限形状）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('形状旋转');
    const reverse: ReverseDescriptor = beforeRotation === null
      ? { tool: 'noop_inverse', args: { reason: 'shape.rotation 不可读，此步不可自动撤销' } }
      : { tool: 'restore_shape_rotation', args: { slide_index: slideIndex, shape_id: shapeId, before_rotation: beforeRotation } };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_rotation',
      content: { slideIndex, shapeId },
    };
    return { ok: true, data: { slideIndex, shapeId, rotation }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 4：PPT-06 manage_slides（noop+gate，v2.1 仅 delete，D-14）
// ---------------------------------------------------------------------------

/**
 * 管理 PPT 幻灯片（PPT-06，noop+gate，v2.1 仅支持删除）。
 * v2.1 限制：operation 只允许 'delete'（schema enum 硬限 + 运行时双保险，D-14）。
 * 幻灯片内容无法通过 Office.js 序列化导出，此步不可自动撤销。
 */
export const manageSlidesTool: ToolDef = {
  name: 'manage_slides',
  kind: 'write',
  description: '管理 PPT 幻灯片。v2.1 仅支持删除幻灯片（operation=delete）。此操作不可自动撤销（幻灯片内容无法序列化）。',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: '操作类型（v2.1 仅支持 delete）',
        enum: ['delete'],
      },
      slideIndex: { type: 'number', description: '要删除的幻灯片编号（1开始）' },
    },
    required: ['operation', 'slideIndex'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const operation = a.operation as string;
    const slideIndex = pickSlideIndex(a); // 键名容错（snake/camel）
    if (operation === 'delete') return `删除第 ${slideIndex} 张幻灯片`;
    return `管理幻灯片（operation=${operation}）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const operation = a.operation as 'delete';
    const slideIndex = pickSlideIndex(a);
    await (ctx.adapter as PptAdapter).manageSlides(operation, slideIndex);
    // noop+gate：幻灯片内容无法序列化，不可自动撤销
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: '幻灯片内容无法通过 Office.js 序列化导出，此步不可自动撤销' },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide',
      content: { slideIndex, title: '' },
    };
    return { ok: true, data: { operation, slideIndex }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 4：PPT-08 set_slide_background（spike S2）
// ---------------------------------------------------------------------------

/**
 * 设置 PPT 幻灯片背景为纯色（PPT-08，spike S2）。
 * 运行时降级：若 slide.background.fill 不可读（S2 未通过）或宿主不支持 PowerPointApi 1.10，
 * 降级为 noop+gate 并显示警告。仅支持纯色背景（不支持图片/渐变背景）。
 */
export const setSlideBackgroundTool: ToolDef = {
  name: 'set_slide_background',
  kind: 'write',
  description: '设置 PPT 幻灯片背景为纯色（#RRGGBB）。仅支持纯色背景；undo 需 Office for Web 真机验证（spike S2）。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: { type: 'number', description: '幻灯片编号（1开始）' },
      color: { type: 'string', description: '背景颜色 #RRGGBB' },
    },
    required: ['slideIndex', 'color'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `将第 ${pickSlideIndex(a)} 张幻灯片背景设为 ${a.color as string}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slideIndex = pickSlideIndex(a);
    const color = a.color as string;
    const { beforeColor, effective } = await (ctx.adapter as PptAdapter).setSlideBackground(slideIndex, color);
    // 写后回读验证未通过（type 未变 Solid / 宿主不支持 PowerPointApi 1.10）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('幻灯片背景');
    // 生效 → 真实逆向：before_color 非 null 还原纯色；null 则 adapter 走 background.reset()
    const reverse: ReverseDescriptor = {
      tool: 'restore_slide_background',
      args: { slide_index: slideIndex, before_color: beforeColor },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide_background',
      content: { slideIndex },
    };
    return { ok: true, data: { slideIndex, color }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 3a：PPT-07 copy_slide
// ---------------------------------------------------------------------------

/**
 * 复制 PPT 幻灯片到指定位置（或末尾）。
 * 复制后新幻灯片将追加到演示文稿末尾或指定位置。
 * 逆向 = delete_slide_by_index（Record 签名，D-16 index+ID 双定位）。
 */
export const copySlideTool: ToolDef = {
  name: 'copy_slide',
  kind: 'write',
  description: '复制 PPT 指定幻灯片到新位置（默认末尾）。复制后新幻灯片追加到末尾或指定位置。支持撤销。',
  parameters: {
    type: 'object',
    properties: {
      sourceIndex: { type: 'number', description: '源幻灯片编号（1开始）' },
      targetIndex: { type: 'number', description: '目标位置（1开始，可选，默认末尾）' },
    },
    required: ['sourceIndex'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    // 键名容错（snake/camel）：sourceIndex/source_index、targetIndex/target_index
    const sourceIndex = pickSourceIndex(a);
    const targetIndex = pickTargetIndex(a);
    return targetIndex
      ? `复制第 ${sourceIndex} 张幻灯片到位置 ${targetIndex}`
      : `复制第 ${sourceIndex} 张幻灯片到末尾`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const sourceIndex = pickSourceIndex(a);
    const targetIndex = pickTargetIndex(a);
    const { capturedId, capturedIndex } = await (ctx.adapter as PptAdapter).copySlide(sourceIndex, targetIndex);
    const reverse: ReverseDescriptor = {
      tool: 'delete_slide_by_index',
      args: { capturedIndex, capturedId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide_copy',
      content: { sourceIndex, capturedIndex },
    };
    return { ok: true, data: { sourceIndex, capturedId, capturedIndex }, reverse, postState };
  },
};
