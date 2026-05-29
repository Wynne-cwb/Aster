/**
 * src/agent/tools/read/word.ts — Word read tools（TOOL-02 / Phase 4 Plan 06）
 *
 * 4 个 Word read ToolDef：
 *   get_document_full_text  — 全文（document_content）
 *   get_paragraph_count     — 段落总数（metadata）
 *   get_paragraph_at        — 单段落（document_content）
 *   get_document_outline    — 大纲（metadata）
 *
 * 边界约束（TOOL-07 eslint / A-06）：
 *   execute 不接触 Office.js proxy，只调 ctx.adapter.read() 委托给 adapter 层。
 *   wrapReadResult 在 execute 内包装，loop-helpers JSON.stringify 透传已含包装。
 */
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';

interface EmptyArgs {
  _placeholder?: never;
}

interface GetParagraphAtArgs {
  index: number;
}

export const getDocumentFullText: ToolDef<EmptyArgs> = {
  name: 'get_document_full_text',
  description:
    '读取 Word 文档的完整正文文本。数据量大时会被截断（50K token 上限）。' +
    '若只需结构信息，优先用 get_document_outline。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了文档全文',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_document_full_text' });
    return wrapReadResult(r, { result_type: 'document_content', source: 'document.full_text' });
  },
};

export const getParagraphCount: ToolDef<EmptyArgs> = {
  name: 'get_paragraph_count',
  description:
    '返回 Word 文档的段落总数（整数）。用于了解文档规模，再按需拉取具体段落。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了文档段落总数',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_paragraph_count' });
    return wrapReadResult(r, { result_type: 'metadata', source: 'document.paragraph_count' });
  },
};

export const getParagraphAt: ToolDef<GetParagraphAtArgs> = {
  name: 'get_paragraph_at',
  description:
    '按 0-based 下标读取 Word 文档的一段文字（第 N 段 = index N-1）。' +
    '需要多段时，优先在一次 turn 内并行调用多个该 tool，而非逐段轮询。',
  parameters: {
    type: 'object',
    properties: {
      index: {
        type: 'number',
        description: '0-based 段落下标（第 1 段 = 0，第 2 段 = 1，以此类推）',
      },
    },
    required: ['index'],
  },
  humanLabel: ({ index }) => `读取了第 ${index + 1} 段`,
  kind: 'read',
  async execute({ index }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_paragraph_at', index });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: `paragraph_${index}`,
    });
  },
};

export const getDocumentOutline: ToolDef<EmptyArgs> = {
  name: 'get_document_outline',
  description:
    '返回 Word 文档的标题大纲（Heading 样式段落的层级与文字），用于了解文档结构。' +
    '比 get_document_full_text 轻量，优先用于导航与规划。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了文档大纲',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_document_outline' });
    return wrapReadResult(r, { result_type: 'metadata', source: 'document.outline' });
  },
};
