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
