/**
 * src/agent/tools/write/ppt.ts — PPT 宿主 write tools（Phase 5 Plan 07 / TOOL-03 / AGENT-08）
 *
 * Phase 5 PoC：insert_slide（在末尾插入新幻灯片）。
 * Phase 6 升级为多种精确定位写入。
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
    // TOOL-04 runtime assert：write tool 必须返回 reverse
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
    return { ok: true, data: { insertedIndex, title }, reverse, postState };
  },
};
