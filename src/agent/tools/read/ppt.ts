/**
 * src/agent/tools/read/ppt.ts — PPT read tools（TOOL-02 / Phase 4 Plan 06）
 *
 * 4 个 PPT read ToolDef：
 *   list_slides           — 全部 slide 清单（metadata）
 *   get_slide             — 单张 slide 完整内容（document_content）
 *   list_shapes_on_slide  — 单张 slide 的形状清单（metadata）
 *   get_shape             — 单个形状内容（document_content）
 *
 * 边界约束（TOOL-07 eslint / A-06）：
 *   execute 不接触 Office.js proxy，只调 ctx.adapter.read() 委托给 adapter 层。
 */
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';

interface EmptyArgs {
  _placeholder?: never;
}

interface SlideIndexArgs {
  slideIndex: number;
}

interface GetShapeArgs {
  slideIndex: number;
  shapeId: string;
}

export const listSlides: ToolDef<EmptyArgs> = {
  name: 'list_slides',
  description:
    '一次返回整个演示文稿的全部幻灯片清单（index 与标题）。' +
    '禁止逐张循环调用 get_slide 拉取列表，先用本 tool 了解结构。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了全部幻灯片清单',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'list_slides' });
    return wrapReadResult(r, { result_type: 'metadata', source: 'presentation.slides' });
  },
};

export const getSlide: ToolDef<SlideIndexArgs> = {
  name: 'get_slide',
  description:
    '读取指定幻灯片（1-based slideIndex）的所有形状与文字内容。' +
    '先调 list_slides 了解整体结构，再按需拉取具体 slide。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: {
        type: 'number',
        description: '1-based 幻灯片序号（第 1 张 = 1）',
      },
    },
    required: ['slideIndex'],
  },
  humanLabel: ({ slideIndex }) => `读取了第 ${slideIndex} 张幻灯片`,
  kind: 'read',
  async execute({ slideIndex }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_slide', slideIndex });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: `slide_${slideIndex}`,
    });
  },
};

export const listShapesOnSlide: ToolDef<SlideIndexArgs> = {
  name: 'list_shapes_on_slide',
  description:
    '返回指定幻灯片（1-based）的形状清单（id 与类型），用于了解结构再精准拉取内容。' +
    '比 get_slide 轻量，优先用于导航。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: {
        type: 'number',
        description: '1-based 幻灯片序号',
      },
    },
    required: ['slideIndex'],
  },
  humanLabel: ({ slideIndex }) => `读取了第 ${slideIndex} 张幻灯片的形状清单`,
  kind: 'read',
  async execute({ slideIndex }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'list_shapes_on_slide', slideIndex });
    return wrapReadResult(r, {
      result_type: 'metadata',
      source: `slide_${slideIndex}.shapes`,
    });
  },
};

export const getShape: ToolDef<GetShapeArgs> = {
  name: 'get_shape',
  description:
    '读取指定幻灯片（1-based）上指定形状（shapeId）的内容（文字、属性等）。' +
    '需要 shapeId 时先调 list_shapes_on_slide 获取。',
  parameters: {
    type: 'object',
    properties: {
      slideIndex: {
        type: 'number',
        description: '1-based 幻灯片序号',
      },
      shapeId: {
        type: 'string',
        description: '形状 ID（由 list_shapes_on_slide 返回）',
      },
    },
    required: ['slideIndex', 'shapeId'],
  },
  humanLabel: ({ slideIndex }) => `读取了第 ${slideIndex} 张幻灯片的某个形状`,
  kind: 'read',
  async execute({ slideIndex, shapeId }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_shape', slideIndex, shapeId });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: `slide_${slideIndex}.shape_${shapeId}`,
    });
  },
};
