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
// Phase 23 PVQ-03/04：盖印章版式库 + 内部几何自查（复用 Phase 22 纯函数）
import { buildLayout, LAYOUT_LABELS, LAYOUT_NAMES, type LayoutName } from '../../design/ppt-layouts';
import { checkSlideLayout as runLayoutCheck, formatViolations, type ShapeBox, type TextBoxAnnotation } from '../../design/geometry-check';
import { DEFAULT_CANVAS_PT } from '../../design/ppt-tokens';
import { usePreferencesStore } from '../../../store/preferences';

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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
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
    required: ['slide_index', 'shape_id', 'font'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `修改第 ${a.slide_index as number} 张幻灯片形状「${a.shape_id as string}」文字字体`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_id = a.shape_id as string;
    const font = a.font as Record<string, unknown>;
    const { beforeFont } = await (ctx.adapter as PptAdapter).setShapeTextFont(slide_index, shape_id, font);
    const reverse: ReverseDescriptor = {
      tool: 'restore_shape_font',
      args: { slide_index, shape_id, before_font: beforeFont },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_font',
      content: { slide_index, shape_id },
    };
    return { ok: true, data: { slide_index, shape_id }, reverse, postState };
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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_type: {
        type: 'string',
        description: '形状类型',
        // ⚠️ 除 'TextBox' 哨兵外，每个值必须是合法 Office.js PowerPoint.GeometricShapeType（守门见 ppt-layouts.test.ts）。
        //   修：'RoundedRectangle'→'RoundRectangle'（无 "ed"）、裸 'Arrow'→'RightArrow'（无裸 "Arrow" 枚举）——
        //   二者非法会令真机 addGeometricShape 抛 "invalid argument"（UAT-1 / 260604-fzn 同类修复）。
        enum: ['TextBox', 'Rectangle', 'RoundRectangle', 'Ellipse', 'Triangle', 'RightTriangle', 'Diamond', 'Pentagon', 'Hexagon', 'RightArrow'],
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
    required: ['slide_index', 'shape_type', 'position'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_type = a.shape_type as string;
    const text = a.text as string | undefined;
    const label = shape_type === 'TextBox' ? '文本框' : `形状「${shape_type}」`;
    if (text) {
      return `在第 ${slide_index} 张幻灯片插入${label}「${String(text).slice(0, 20)}${String(text).length > 20 ? '…' : ''}」`;
    }
    return `在第 ${slide_index} 张幻灯片插入${label}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_type = a.shape_type as string;
    const position = a.position as { left: number; top: number; width: number; height: number };
    const text = a.text as string | undefined;
    const { newShapeId } = await (ctx.adapter as PptAdapter).addShape(slide_index, shape_type, position, text);
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index, shape_id: newShapeId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_new',
      content: { slide_index, shape_id: newShapeId },
    };
    return { ok: true, data: { slide_index, new_shape_id: newShapeId }, reverse, postState };
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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      alignment: {
        type: 'string',
        description: '对齐方式',
        enum: ['Left', 'Center', 'Right', 'Justify'],
      },
    },
    required: ['slide_index', 'shape_id', 'alignment'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const alignment = a.alignment as string;
    const labelMap: Record<string, string> = { Left: '左对齐', Center: '居中', Right: '右对齐', Justify: '两端对齐' };
    return `将第 ${a.slide_index as number} 张幻灯片形状「${a.shape_id as string}」文字设为${labelMap[alignment] ?? alignment}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_id = a.shape_id as string;
    const alignment = a.alignment as string;
    const { beforeAlignment, effective } = await (ctx.adapter as PptAdapter).setShapeTextAlignment(slide_index, shape_id, alignment);
    // 写后回读验证未通过（网页版静默 no-op）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('文字对齐');
    // 生效但写前为混合/未知对齐（beforeAlignment === null）→ 无法可靠还原，noop+gate
    const reverse: ReverseDescriptor = beforeAlignment === null
      ? { tool: 'noop_inverse', args: { reason: '原段落对齐为混合/未知值，此步不可自动撤销' } }
      : { tool: 'restore_shape_alignment', args: { slide_index, shape_id, before_alignment: beforeAlignment } };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_alignment',
      content: { slide_index, shape_id },
    };
    return { ok: true, data: { slide_index, shape_id, alignment }, reverse, postState };
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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
    },
    required: ['slide_index', 'shape_id'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `删除第 ${a.slide_index as number} 张幻灯片形状「${a.shape_id as string}」`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_id = a.shape_id as string;
    await (ctx.adapter as PptAdapter).deleteShape(slide_index, shape_id);
    // noop+gate：形状状态无法序列化，不可自动撤销
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: '形状完整状态（类型/位置/填充/文字/字体）无法序列化重建，此步不可自动撤销' },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape',
      content: { slide_index, shape_id },
    };
    return { ok: true, data: { slide_index, shape_id }, reverse, postState };
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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      rotation: { type: 'number', description: '旋转角度（0-360 degrees）' },
    },
    required: ['slide_index', 'shape_id', 'rotation'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `将第 ${a.slide_index as number} 张幻灯片形状「${a.shape_id as string}」旋转至 ${a.rotation as number}°`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_id = a.shape_id as string;
    const rotation = a.rotation as number;
    const { beforeRotation, effective } = await (ctx.adapter as PptAdapter).rotateShape(slide_index, shape_id, rotation);
    // 写后回读验证未通过（网页版静默 no-op / 受限形状）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('形状旋转');
    const reverse: ReverseDescriptor = beforeRotation === null
      ? { tool: 'noop_inverse', args: { reason: 'shape.rotation 不可读，此步不可自动撤销' } }
      : { tool: 'restore_shape_rotation', args: { slide_index, shape_id, before_rotation: beforeRotation } };
    const postState: PostStateSnapshot = {
      kind: 'ppt_shape_rotation',
      content: { slide_index, shape_id },
    };
    return { ok: true, data: { slide_index, shape_id, rotation }, reverse, postState };
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
      slide_index: { type: 'number', description: '要删除的幻灯片编号（1开始）' },
    },
    required: ['operation', 'slide_index'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const operation = a.operation as string;
    const slide_index = a.slide_index as number;
    if (operation === 'delete') return `删除第 ${slide_index} 张幻灯片`;
    return `管理幻灯片（operation=${operation}）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const operation = a.operation as 'delete';
    const slide_index = a.slide_index as number;
    await (ctx.adapter as PptAdapter).manageSlides(operation, slide_index);
    // noop+gate：幻灯片内容无法序列化，不可自动撤销
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: '幻灯片内容无法通过 Office.js 序列化导出，此步不可自动撤销' },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide',
      content: { slide_index, title: '' },
    };
    return { ok: true, data: { operation, slide_index }, reverse, postState };
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
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      color: { type: 'string', description: '背景颜色 #RRGGBB' },
    },
    required: ['slide_index', 'color'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `将第 ${a.slide_index as number} 张幻灯片背景设为 ${a.color as string}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const color = a.color as string;
    const { beforeColor, effective } = await (ctx.adapter as PptAdapter).setSlideBackground(slide_index, color);
    // 写后回读验证未通过（type 未变 Solid / 宿主不支持 PowerPointApi 1.10）→ 诚实失败，不报 ✅、不记 undo
    if (!effective) return notEffectiveResult('幻灯片背景');
    // 生效 → 真实逆向：before_color 非 null 还原纯色；null 则 adapter 走 background.reset()
    const reverse: ReverseDescriptor = {
      tool: 'restore_slide_background',
      args: { slide_index, before_color: beforeColor },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide_background',
      content: { slide_index },
    };
    return { ok: true, data: { slide_index, color }, reverse, postState };
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
      source_index: { type: 'number', description: '源幻灯片编号（1开始）' },
      target_index: { type: 'number', description: '目标位置（1开始，可选，默认末尾）' },
    },
    required: ['source_index'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const source_index = a.source_index as number;
    const target_index = a.target_index as number | undefined;
    return target_index
      ? `复制第 ${source_index} 张幻灯片到位置 ${target_index}`
      : `复制第 ${source_index} 张幻灯片到末尾`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const source_index = a.source_index as number;
    const target_index = a.target_index as number | undefined;
    const { capturedId, capturedIndex } = await (ctx.adapter as PptAdapter).copySlide(source_index, target_index);
    const reverse: ReverseDescriptor = {
      tool: 'delete_slide_by_index',
      args: { capturedIndex, capturedId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_slide_copy',
      content: { source_index, capturedIndex },
    };
    return { ok: true, data: { source_index, capturedId, capturedIndex }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 23 PVQ-03：apply_slide_layout（盖印章建整页，create+fill）
// ---------------------------------------------------------------------------

interface ApplySlideLayoutArgs {
  layout: LayoutName;                 // 'cover'|'kpi'|'two_column'|'timeline'|'image_text'|'bullet_list'
  content: Record<string, unknown>;   // 各版式 schema（content 子字段不被顶层 normalize → 按 schema 直接读）
  accent_color?: string;              // 选填强调色 hex；默认别传（用户明确指定颜色/品牌色才传）→ 缺省回退 DEFAULT_ACCENT teal（配色不锁死 D-23-04）
}

/**
 * 盖印章建整页（PVQ-03 / D-23-01..06）。一个 tool call 在演示文稿末尾新建一张幻灯片，
 * 按所选版式一次性建好整页所有原生可编辑形状。reverse = delete_slide_by_index（删整张新页，
 * Record 对象 {capturedIndex,capturedId}，复用既有 inverse）；postState kind 'ppt_layout'。
 * 内部自动跑 Phase 22 checkSlideLayout（对刚摆的 rects + AI 文本/颜色）→ data.layout_check evidence。
 */
export const applySlideLayoutTool: ToolDef<ApplySlideLayoutArgs> = {
  name: 'apply_slide_layout',
  kind: 'write',
  // UAT-10 Blocker A：建整页 = Run A + 700ms inter-run gap + Run B（~6 syncs / ~13 shapes），
  // 在慢速 Office for Web 宿主上整体可超 15s 默认 dispatch 超时（TOOL_TIMEOUT_MS）。
  // 默认 15s 会误杀正常完成的建页 → 抛 HOST_API 超时；而宿主后台仍把建页跑完，
  // adapter 的孤儿清理只在「adapter 抛错」时触发、不在「dispatch 超时」时触发 → 残留一张重复空页。
  // 提到 45s 安全上限（仅防真·卡死宿主）：正常建页几秒完成，不改正常延迟、不违反 P95
  // （P95 量的是真实完成耗时，不是这个上限）。dispatch 层已识 def.timeoutMs ?? TOOL_TIMEOUT_MS。
  timeoutMs: 45_000,
  description:
    '盖印章建整页：在演示文稿末尾新建一张幻灯片并按所选版式一次建好整页所有原生可编辑形状。' +
    'layout ∈ {cover 封面, kpi 大数字KPI(1-4个), two_column 两栏对比, timeline 时间线, image_text 图文左右, bullet_list 要点列表}。' +
    'content 按版式提供标题/要点/KPI 等字段；accent_color 选填——**默认不要传**，工具自动用克制的品牌默认色（teal）；仅当用户明确指定了颜色/品牌色时才传该 hex。' +
    '图文左右版式会留出图片位（返回 image_slots 坐标），请随后用 generate_ppt_image 或 search_and_insert_stock_image 把图插进该坐标，不要留空。' +
    '返回里含版面自查（layout_check）——据此判断是否需调整文本长度或配色。一个调用 = 一整页，优先用本工具而非逐个 add_shape。',
  parameters: {
    type: 'object',
    properties: {
      layout: { type: 'string', enum: [...LAYOUT_NAMES], description: '版式名' },
      content: {
        type: 'object',
        description:
          '版式内容字段（封面: title/subtitle/footer；KPI: kpis[{value,label,delta?,delta_direction?}] 最多4；' +
          '两栏: left/right{heading,bullets[]}；时间线: events[{time,label}] 最多5；' +
          '图文左右: title/bullets[]/image_side(left|right)；要点: title/bullets[{heading?,text}] 最多8）',
      },
      accent_color: { type: 'string', description: '强调色 hex（如 #1A73E8）；**选填，默认别传**——不传时工具用品牌默认色（teal #009887）。仅用户明确指定颜色/品牌色时才传。' },
    },
    required: ['layout', 'content'],
  },
  humanLabel: ({ layout }) => `新建幻灯片并套用「${LAYOUT_LABELS[layout] ?? layout}」版式`,
  async execute({ layout, content, accent_color }, ctx): Promise<ToolResult> {
    // accent 取值优先级（UAT-5）：AI 明确指定色 > 用户配置的品牌主题色 > 内置 DEFAULT_ACCENT（buildLayout 兜底）。
    // brandAccentColor 始终为合法 hex（缺省 = #009887），故正常情况下不会落到 buildLayout 内部兜底。
    const accent = accent_color || usePreferencesStore.getState().brandAccentColor;
    // 本地纯计算生成整页 ShapeSpec[]（配色参数化收 accent）
    const { shapes, imageSlots, capNotes } = buildLayout(layout, content ?? {}, { accent });
    // A-06：通过 ctx.adapter 调用，不直接引用 PowerPoint 命名空间
    const { capturedIndex, capturedId, slideIndex, newShapeIds } =
      await (ctx.adapter as PptAdapter).applySlideLayout(shapes);
    // 内部几何自查（D-23-05）：用刚摆的 rects + AI 文本/颜色（纯函数，零宿主 API、零 round-trip）
    const checkShapes: ShapeBox[] = shapes.map((s, i) => ({ id: newShapeIds[i] ?? `s${i}`, type: s.shapeType, ...s.rect }));
    const annotations: TextBoxAnnotation[] = shapes
      .map((s, i) => ({
        shapeId: newShapeIds[i] ?? `s${i}`,
        text: s.text,
        fontSizePt: s.font?.size,
        bold: s.font?.bold,
        foreground: s.font?.color,
        background: s.bgForContrast,
      }))
      .filter((a) => a.text || a.foreground);
    const report = runLayoutCheck(checkShapes, { canvas: DEFAULT_CANVAS_PT, annotations });
    // reverse = 删整张新页（Record 对象，复用既有 deleteSlideByIndex inverse，撤销原子）
    const reverse: ReverseDescriptor = { tool: 'delete_slide_by_index', args: { capturedIndex, capturedId } };
    const postState: PostStateSnapshot = { kind: 'ppt_layout', content: { slideIndex, capturedId, newShapeIds } };
    return {
      ok: true,
      data: {
        slide_index: slideIndex,
        new_shape_ids: newShapeIds,
        image_slots: imageSlots.map((s) => s.rect),
        cap_notes: capNotes,
        layout_check: formatViolations(report),
      },
      reverse,
      postState,
    };
  },
};

// ---------------------------------------------------------------------------
// Phase 29 PPT-09：insert_ppt_table（原生 addTable，PowerPointApi 1.8）
// ---------------------------------------------------------------------------

/**
 * 在 PPT 幻灯片插入原生表格（PPT-09）。
 * 逆向 = delete_shape_by_id（表格是单 shape，复用既有 inverse，零新 reverse 工具）。
 * 门控：PowerPointApi 1.8；写后回读失败 → notEffectiveResult 诚实失败。
 * ⚠️ 工具名 insert_ppt_table 不撞 Word 既有 insert_table（host 隔离硬要求）。
 */
export const insertPptTableTool: ToolDef = {
  name: 'insert_ppt_table',
  kind: 'write',
  description: '在 PPT 指定幻灯片插入原生表格（rows×cols）。可选提供二维数据数组填入单元格。需 PowerPointApi 1.8（Office for Web Supported）。',
  timeoutMs: 45_000, // 建表+填值在慢速宿主可能超 15s 默认超时，镜像 applySlideLayoutTool
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      rows: { type: 'number', description: '行数' },
      cols: { type: 'number', description: '列数' },
      data: {
        type: 'array',
        description: '二维数据数组（可选），缺格自动填空字符串',
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    required: ['slide_index', 'rows', 'cols'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    return `在第 ${a.slide_index as number} 张幻灯片插入 ${a.rows as number}×${a.cols as number} 表格`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const rows = a.rows as number;
    const cols = a.cols as number;
    const data = a.data as string[][] | undefined;
    const { newShapeId, effective } = await (ctx.adapter as PptAdapter).insertTable(slide_index, rows, cols, data);
    if (!effective) return notEffectiveResult('插入表格');
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index, shape_id: newShapeId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_table',
      content: { slide_index, shape_id: newShapeId },
    };
    return { ok: true, data: { slide_index, new_shape_id: newShapeId }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 29 PPT-10：add_line（原生 addLine，PowerPointApi 1.4）
// ---------------------------------------------------------------------------

/**
 * 在 PPT 幻灯片插入线条/连接符（PPT-10）。
 * ⚠️ 不支持箭头头样式：PowerPoint 命名空间无 arrowhead API（仅 Excel.Shape 有），工具层诚实告知。
 * 逆向 = delete_shape_by_id（线条是单 shape，复用既有 inverse）。
 * 门控：PowerPointApi 1.4；写后回读失败 → notEffectiveResult 诚实失败。
 */
export const addLineTool: ToolDef = {
  name: 'add_line',
  kind: 'write',
  description: '在 PPT 指定幻灯片插入直线/折线/曲线连接符，可设颜色/粗细/虚线。**不支持箭头头样式**（平台限制：PowerPoint Office.js 命名空间无 arrowhead API）。需 PowerPointApi 1.4。',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      start: {
        type: 'object',
        description: '起点坐标（单位 pt）',
        properties: {
          left: { type: 'number', description: 'X 坐标' },
          top: { type: 'number', description: 'Y 坐标' },
        },
        required: ['left', 'top'],
      },
      end: {
        type: 'object',
        description: '终点坐标（单位 pt）',
        properties: {
          left: { type: 'number', description: 'X 坐标' },
          top: { type: 'number', description: 'Y 坐标' },
        },
        required: ['left', 'top'],
      },
      connector_type: {
        type: 'string',
        description: '连接符形态（直线/折线/曲线），默认 Straight',
        enum: ['Straight', 'Elbow', 'Curve'],
      },
      color: { type: 'string', description: '线条颜色，#RRGGBB 格式（可选）' },
      weight: { type: 'number', description: '线条粗细（pt，可选）' },
      with_arrow: {
        type: 'boolean',
        description: '是否需要箭头（平台不支持，传 true 时工具会诚实告知已插入无箭头线条）',
      },
    },
    required: ['slide_index', 'start', 'end'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const connectorTypeMap: Record<string, string> = { Straight: '直', Elbow: '折', Curve: '曲' };
    const ct = (a.connector_type as string | undefined) ?? 'Straight';
    return `在第 ${a.slide_index as number} 张幻灯片插入${connectorTypeMap[ct] ?? ct}线条`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const start = a.start as { left: number; top: number };
    const end = a.end as { left: number; top: number };
    const connector_type = (a.connector_type as string | undefined) ?? 'Straight';
    const color = a.color as string | undefined;
    const weight = a.weight as number | undefined;
    const with_arrow = a.with_arrow as boolean | undefined;
    const lineProps = (color !== undefined || weight !== undefined)
      ? { color, weight }
      : undefined;
    const { newShapeId, effective } = await (ctx.adapter as PptAdapter).addLine(
      slide_index,
      connector_type,
      start,
      end,
      lineProps,
    );
    if (!effective) return notEffectiveResult('插入线条');
    const reverse: ReverseDescriptor = {
      tool: 'delete_shape_by_id',
      args: { slide_index, shape_id: newShapeId },
    };
    const postState: PostStateSnapshot = {
      kind: 'ppt_line',
      content: { slide_index, shape_id: newShapeId },
    };
    // 箭头诚实告知（with_arrow 为 true 时，data 含量化告知文案；不静默假装有箭头）
    const resultData: Record<string, unknown> = { slide_index, new_shape_id: newShapeId };
    if (with_arrow) {
      resultData.notice = '平台支持线条但不支持箭头头样式，已插入无箭头线条';
    }
    return { ok: true, data: resultData, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 29 PPT-11：set_shape_gradient（降级纯色 + 量化告知）
// ---------------------------------------------------------------------------

/** 取渐变 stops 首色（PPT-11 降级纯色取色逻辑）。容错字符串色值或 { color } 对象；空数组兜底主色。 */
function pickFirstStopColor(stops: unknown): string {
  const DEFAULT = '#009887'; // teal 主品牌色兜底
  if (Array.isArray(stops) && stops.length > 0) {
    const first = stops[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && typeof (first as { color?: unknown }).color === 'string') {
      return (first as { color: string }).color;
    }
  }
  return DEFAULT;
}

/**
 * 给 PPT 形状设渐变填充（PPT-11）。
 * ⚠️ Office.js ShapeFill 全平台无渐变写 API（HIGH 负面，RESEARCH）→ D-29-02 降级纯色是唯一路径。
 * 取渐变 stops 首色 → 复用既有 PptAdapter.setShapeProperty 的 fillColor 路径 → 纯色 setSolidColor。
 * 逆向 = restore_shape_property（before-image fill，方案 A：0 新 adapter 方法）。
 * D-29-06：web fill 读不回 → fillColor:null → 走 noop_inverse（不拿 null 假装还原，范式 = setShapeTextAlignmentTool）。
 */
export const setShapeGradientTool: ToolDef = {
  name: 'set_shape_gradient',
  kind: 'write',
  description:
    '给 PPT 形状设渐变填充。平台不支持渐变写入，将自动降级为取首色的纯色填充并告知。slide_index 1-based，shape_id 来自 list_shapes_on_slide。',
  parameters: {
    type: 'object',
    properties: {
      slide_index: { type: 'number', description: '幻灯片编号（1开始）' },
      shape_id: { type: 'string', description: '形状 ID，来自 list_shapes_on_slide' },
      gradient_stops: { type: 'array', items: { type: 'string' }, description: '渐变色标（#RRGGBB 数组，首色用于纯色降级）' },
      direction: { type: 'string', description: '渐变方向（linear/radial 等，平台不支持时忽略）' },
    },
    required: ['slide_index', 'shape_id', 'gradient_stops'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const firstColor = pickFirstStopColor(a.gradient_stops);
    return `将第 ${a.slide_index as number} 张幻灯片形状「${a.shape_id as string}」填充设为纯色 ${firstColor}（渐变降级）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const slide_index = a.slide_index as number;
    const shape_id = a.shape_id as string;
    const firstColor = pickFirstStopColor(a.gradient_stops);
    const { beforeImage } = await (ctx.adapter as PptAdapter).setShapeProperty(slide_index, shape_id, { fillColor: firstColor });
    // D-29-06 / RESEARCH：web fill 读不回 → setShapeProperty 返回 fillColor:null（不报错降级）。
    //   原填充非 NoFill 但 fillColor 读不回（渐变/图片填充常见）→ 无法可靠还原 → 走 noop+gate（不拿 null 假装还原）。
    //   范式 = setShapeTextAlignmentTool（beforeAlignment===null → noop_inverse）。
    const beforeUnreadable = beforeImage.fillColor === null && beforeImage.fillType !== 'NoFill';
    const reverse: ReverseDescriptor = beforeUnreadable
      ? { tool: 'noop_inverse', args: { reason: '原填充读不回（平台 fill 读取不稳），此步无法自动撤销' } }
      : {
          tool: 'restore_shape_property',
          args: {
            slide_index, shape_id,
            fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor,
            line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight,
            line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height,
          },
        };
    const postState: PostStateSnapshot = { kind: 'ppt_shape_gradient', content: { slide_index, shape_id } };
    return {
      ok: true,
      data: { slide_index, shape_id, applied_color: firstColor, degraded: 'gradient_to_solid',
              notice: `平台不支持渐变填充，已用纯色 ${firstColor} 代替` },
      reverse, postState,
    };
  },
};
