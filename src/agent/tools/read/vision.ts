/**
 * src/agent/tools/read/vision.ts — get_shape_image read tool（VIS-01/VIS-02）
 *
 * 第 12 个 read tool。adapter.read({ kind: 'get_shape_image', focus }) 调三宿主取图，
 * adapter 内部已调 AihubmixVisionClient 并返回 vision 文本（base64 不出 adapter）。
 * wrapReadResult 把 vision_result 文本打包为 ToolResult.data，LLM 据此作答。
 *
 * NFR-09 设计契约：base64 在 adapter 层被 vision 消费，不出现在 ToolResult.data 中，
 * 不写入 Message.content，不进入聊天历史。
 */
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';

interface GetShapeImageArgs {
  focus?: string;
}

export const getShapeImage: ToolDef<GetShapeImageArgs> = {
  name: 'get_shape_image',
  description:
    '读取当前文档选中的图片或图表，调用视觉分析返回文字描述作为 evidence。' +
    '有 focus 参数时按问题针对性描述；无则客观描述整体内容。' +
    '无选中图或宿主不支持时返回错误引导，可改用回形针上传图片。',
  parameters: {
    type: 'object',
    properties: {
      focus: {
        type: 'string',
        description:
          '可选。想从图里了解什么——如「图表中的数值」「产品名称和价格」「页面布局」，' +
          '不填则通用客观描述。',
      },
    },
    required: [],
  },
  humanLabel: ({ focus }) =>
    focus ? `正在看这张图（${focus}）…` : '正在看这张图…',
  kind: 'read',
  async execute({ focus }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_shape_image', focus });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: 'selection.image',
    });
  },
};
