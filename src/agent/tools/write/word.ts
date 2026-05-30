/**
 * src/agent/tools/write/word.ts — Word host write tools（Phase 3 Plan 04 / AGENT-08 / D-12）
 *
 * Phase 3 唯一真实 write tool = append_paragraph（D-12）。
 * Phase 5 Plan 01：reverse 从 delete_last_paragraph → delete_paragraph_by_content（TOOL-04）
 *   + postState 快照（kind:'word_paragraph', content:text）供 replayUndoAll 防御手动改。
 * Phase 6 Plan 07：新增 insert_paragraph / replace_paragraph / insert_text_at_cursor /
 *   replace_selection 四个 ToolDef（TOOL-03 / D-04）。
 *
 * 边界约束（A-06 / D-15）：
 *   - execute 输入纯数据（string），输出 ToolResult；不接触 Office.js proxy 对象
 *   - adapter.appendParagraph 内部 Word.run 闭包负责所有 proxy 生命周期
 *   - reverse descriptor 只是字面量（Phase 5 由 OperationLog 真实回放消费）
 * reverse.args 必须是 Record 对象（非位置参）——
 *   见 [[project-adapter-inverse-signature]]：Phase 5 真机 UAT 实证，位置签名致撤销全挂。
 */
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor } from '../../operationLog';
import type { WordAdapter } from '../../../adapters/WordAdapter';

interface AppendParagraphArgs {
  text: string;
}

interface InsertParagraphArgs {
  text: string;
  before_index: number;
}

interface ReplaceParagraphArgs {
  index: number;
  text: string;
  expected_text?: string;
}

interface InsertTextAtCursorArgs {
  text: string;
}

interface ReplaceSelectionArgs {
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
    // Phase 5 TOOL-04：精确 reverse 使用 delete_paragraph_by_content + args.text
    // 相比旧 delete_last_paragraph 更健壮：按内容定位，不受末尾段落变化干扰
    const reverse: ReverseDescriptor = {
      tool: 'delete_paragraph_by_content',
      args: { text },
    };
    // Phase 5 TOOL-04：postState 快照，供 replayUndoAll 对比手动改（D-11 防御）
    const postState = { kind: 'word_paragraph' as const, content: text };
    return { ok: true, data: { written: text.length }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 6 Plan 07 — 四个新 Word write tool（TOOL-03 / D-04）
// ---------------------------------------------------------------------------

/**
 * insert_paragraph — 在指定位置（before_index，0-based）前插入一段文本。
 *
 * inverse 复用 delete_paragraph_by_content（按内容指纹，不受 index 漂移影响）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const insertParagraph: ToolDef<InsertParagraphArgs> = {
  name: 'insert_paragraph',
  kind: 'write',
  description:
    '在 Word 文档指定位置（before_index，0-based）前插入一段文本。before_index 等于段落总数时插入末尾。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要插入的段落文本' },
      before_index: {
        type: 'number',
        description: '在第几段前插入（0-based），等于段落总数时插入末尾',
      },
    },
    required: ['text', 'before_index'],
  },
  humanLabel: ({ before_index, text }) =>
    `在第 ${Number(before_index) + 1} 段前插入段落「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}${
      String(text).length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ text, before_index }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托，proxy 不出 Word.run 闭包
    await (ctx.adapter as WordAdapter).insertParagraphAt(before_index, text);
    // inverse：复用 delete_paragraph_by_content（按内容指纹，不受 index 漂移影响）
    const reverse: ReverseDescriptor = {
      tool: 'delete_paragraph_by_content',
      args: { text },  // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return { ok: true, data: { insertedText: text }, reverse, postState };
  },
};

/**
 * replace_paragraph — 替换指定段落（index，0-based）文本。
 *
 * before-image 模式（D-06）：adapter 返 { beforeImage }，inverse = restore_paragraph_at。
 * D-11 expected_text：可选并发防御，传入时 adapter 比对不一致返 error。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const replaceParagraph: ToolDef<ReplaceParagraphArgs> = {
  name: 'replace_paragraph',
  kind: 'write',
  description:
    '替换 Word 文档指定段落（index，0-based）的文本。支持 expected_text 并发防御：传入时若当前内容不匹配则返回错误。',
  parameters: {
    type: 'object',
    properties: {
      index: { type: 'number', description: '目标段落编号（0-based）' },
      text: { type: 'string', description: '替换后的新文本' },
      expected_text: {
        type: 'string',
        description:
          '（可选）替换前期望的当前段落文本，用于并发防御（D-11）；不传则跳过验证',
      },
    },
    required: ['index', 'text'],
  },
  humanLabel: ({ index, text }) =>
    `将第 ${Number(index) + 1} 段替换为「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}${
      String(text).length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ index, text, expected_text }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；before-image 由 adapter 内部 Word.run 读取
    const { beforeImage } = await (ctx.adapter as WordAdapter).replaceParagraphAt(
      index,
      text,
      expected_text,
    );
    // before-image inverse = restore_paragraph_at（精确 index + 内容指纹双重定位）
    const reverse: ReverseDescriptor = {
      tool: 'restore_paragraph_at',
      args: {
        index,
        expectedText: text,       // 替换后（当前）的文本，用于定位
        restoreText: beforeImage, // before-image，用于还原
      },  // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return {
      ok: true,
      // data 含 mutated 信息供 LLM self-verify（D-10）：index + 实际替换摘要
      data: { index, beforeLength: beforeImage.length, replacedWith: text.slice(0, 50) },
      reverse,
      postState,
    };
  },
};
