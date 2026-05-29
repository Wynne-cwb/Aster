/**
 * src/agent/tools/read/excel.ts — Excel read tools（TOOL-02 / Phase 4 Plan 06）
 *
 * 3 个 Excel read ToolDef：
 *   list_worksheets         — 工作表清单（metadata）
 *   get_range_values        — 区域数据（document_content）
 *   get_used_range_summary  — 已用区域概况（metadata）
 *
 * 边界约束（TOOL-07 eslint / A-06）：
 *   execute 不接触 Office.js proxy，只调 ctx.adapter.read() 委托给 adapter 层。
 */
import type { ToolDef, ToolResult } from '../index';
import { wrapReadResult } from '../../read-result';

interface EmptyArgs {
  _placeholder?: never;
}

interface GetRangeValuesArgs {
  address: string;
}

interface GetUsedRangeSummaryArgs {
  sheetName?: string;
}

export const listWorksheets: ToolDef<EmptyArgs> = {
  name: 'list_worksheets',
  description:
    '返回工作簿中所有工作表的名称与序号。用于了解工作簿结构，再按需读取具体区域。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了工作表清单',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'list_worksheets' });
    return wrapReadResult(r, { result_type: 'metadata', source: 'workbook.worksheets' });
  },
};

export const getRangeValues: ToolDef<GetRangeValuesArgs> = {
  name: 'get_range_values',
  description:
    '读取指定区域（如 "A1:C10" 或 "Sheet1!A1:B5"）的单元格值。' +
    '注意：超过 10,000 个单元格会被拒绝，请改用 get_used_range_summary 获取概况。',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: '区域地址，如 "A1:C10" 或 "Sheet1!A1:B5"',
      },
    },
    required: ['address'],
  },
  humanLabel: ({ address }) => `读取了区域 ${address} 的内容`,
  kind: 'read',
  async execute({ address }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_range_values', address });
    return wrapReadResult(r, {
      result_type: 'document_content',
      source: `range_${address}`,
    });
  },
};

export const getUsedRangeSummary: ToolDef<GetUsedRangeSummaryArgs> = {
  name: 'get_used_range_summary',
  description:
    '返回指定工作表（或当前活动表）已用区域的行列数、地址范围等概况。' +
    '比 get_range_values 轻量，用于了解数据规模，避免过大区域拉取。',
  parameters: {
    type: 'object',
    properties: {
      sheetName: {
        type: 'string',
        description: '工作表名称（可选，不填则使用活动工作表）',
      },
    },
    required: [],
  },
  humanLabel: () => '读取了已用区域概况',
  kind: 'read',
  async execute({ sheetName }, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'get_used_range_summary', sheetName });
    return wrapReadResult(r, { result_type: 'metadata', source: 'used_range.summary' });
  },
};
