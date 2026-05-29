/**
 * src/agent/tools/write/word.ts — Word host write tools（Phase 3 Plan 04 / AGENT-08 / D-12）
 *
 * Phase 3 唯一真实 write tool = append_paragraph（D-12）。
 * Phase 5 才补 delete_last_paragraph（作为 reverse 的真实回放）。
 *
 * 边界约束（A-06 / D-15）：
 *   - execute 输入纯数据（string），输出 ToolResult；不接触 Office.js proxy 对象
 *   - adapter.appendParagraph 内部 Word.run 闭包负责所有 proxy 生命周期
 *   - reverse descriptor 只是字面量（Phase 5 由 OperationLog 真实回放消费）
 */
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor } from '../../operationLog';
import type { WordAdapter } from '../../../adapters/WordAdapter';

interface AppendParagraphArgs {
  text: string;
}

const HUMAN_LABEL_TEXT_CAP = 30;

export const appendParagraph: ToolDef<AppendParagraphArgs> = {
  name: 'append_paragraph',
  kind: 'write',
  description:
    '在 Word 文档末尾追加一段文本。优先一次回复里调多次，而不是合并成一个大段。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要追加的段落文本' },
    },
    required: ['text'],
  },
  humanLabel: ({ text }) =>
    `在文档末尾追加段落「${text.slice(0, HUMAN_LABEL_TEXT_CAP)}${
      text.length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    // A-06：adapter method 输入 string、输出 Promise<void>；不返 proxy
    await (ctx.adapter as WordAdapter).appendParagraph(text);
    const reverse: ReverseDescriptor = {
      tool: 'delete_last_paragraph',
      args: {},
    };
    return { ok: true, data: { written: text.length }, reverse };
  },
};
