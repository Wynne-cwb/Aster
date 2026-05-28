/**
 * src/agent/tools/read/word.ts — Phase 3 占位（不进 buildToolsForHost('word')）
 *
 * 真正消费在 Phase 4 read tools 全套；本文件存在仅为骨架完整 + Phase 4 接口 stub。
 */
import type { ToolDef, ToolResult } from '../index';

interface GetParagraphCountArgs {
  // empty — 该 tool 暂无参数
  _placeholder?: never;
}

export const getParagraphCount: ToolDef<GetParagraphCountArgs> = {
  name: 'get_paragraph_count',
  description: '获取 Word 文档段落总数（Phase 4 才上线，目前是骨架占位）',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取段落总数',
  async execute(_args, _ctx): Promise<ToolResult> {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: '该工具尚未在 Phase 3 启用',
        hint: '该工具计划在 Phase 4 上线',
        recoverable: false,
      },
    };
  },
};
