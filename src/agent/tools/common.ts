/**
 * src/agent/tools/common.ts — 跨宿主共用 read tool（TOOL-02 / Phase 4 Plan 06）
 *
 * selection_detail：读取当前选区详情，三宿主均可用。
 * 委托 ctx.adapter.read({ kind: 'selection_detail' }) → adapter 内部复用 getSelection 语义。
 *
 * 边界约束（TOOL-07 eslint / A-06）：
 *   execute 不接触 Office.js proxy，只调 ctx.adapter.read()。
 */
import type { ToolDef, ToolResult } from './index';
import { wrapReadResult } from '../read-result';

interface EmptyArgs {
  _placeholder?: never;
}

export const selectionDetail: ToolDef<EmptyArgs> = {
  name: 'selection_detail',
  description:
    '读取当前选区的详细信息（Word 选区文字 / Excel 选中区域地址 / PPT 当前 slide）。' +
    '三宿主均可调用，用于了解用户当前关注点。',
  parameters: { type: 'object', properties: {}, required: [] },
  humanLabel: () => '读取了当前选区详情',
  kind: 'read',
  async execute(_args, ctx): Promise<ToolResult> {
    const r = await ctx.adapter.read({ kind: 'selection_detail' });
    return wrapReadResult(r, { result_type: 'document_content', source: 'selection' });
  },
};
