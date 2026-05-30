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
  description: '在 Word 指定段落（before_index，0-based）前插入文本，等于段落数时插到末尾。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要插入的段落文本' },
      before_index: {
        type: 'number',
        description: '在第几段前插入（0-based），等于总段数时插末尾',
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
    return { ok: true, data: { written: String(text).length }, reverse, postState };
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
  description: '替换 Word 文档指定段落（index，0-based）的文本。可选 expected_text 做并发防御。',
  parameters: {
    type: 'object',
    properties: {
      index: { type: 'number', description: '目标段落编号（0-based）' },
      text: { type: 'string', description: '替换后的新文本' },
      expected_text: {
        type: 'string',
        description: '（可选）替换前的当前内容，防并发改写；不传则跳过',
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
      data: { index, written: text.length },
      reverse,
      postState,
    };
  },
};

/**
 * insert_text_at_cursor — 在 Word 光标位置（当前选区之后）插入文本。
 *
 * inverse 近似：delete_paragraph_by_content 按插入内容指纹定位删段（近似，非精确）。
 * 光标插入无法精确 track 范围；还原失败时 replay engine 标 skipped_error，用户看「无法自动回滚」。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const insertTextAtCursor: ToolDef<InsertTextAtCursorArgs> = {
  name: 'insert_text_at_cursor',
  kind: 'write',
  description: '在 Word 光标位置（选区之后）插入文本。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '要插入的文本' },
    },
    required: ['text'],
  },
  humanLabel: ({ text }) =>
    `在光标处插入文本「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}${
      String(text).length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托，proxy 不出 Word.run 闭包
    await (ctx.adapter as WordAdapter).insertTextAtCursor(text);
    // inverse 近似：用内容指纹定位，近似还原；失败 → skipped_error
    const reverse: ReverseDescriptor = {
      tool: 'delete_paragraph_by_content',
      args: { text },  // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return { ok: true, data: { written: String(text).length }, reverse, postState };
  },
};

/**
 * replace_selection — 将 Word 当前选中内容替换为新文本。
 *
 * inverse = noop_inverse（CR-04 诚实标注，用户已拍板）：
 *   - replace_selection 无法精确定位/还原原始选区内容（选区位置不稳定，且
 *     beforeImage 无可靠的反向定位锚点）。
 *   - 旧实现用 delete_paragraph_by_content + 新文本指纹是误导的：它会去删「新文本」
 *     而非还原「原文」，语义错误且永远还原不了原始内容。
 *   - 改用 noop_inverse：DiffLog 老实显示「此步无法自动撤销」（replay engine 标
 *     skipped_error），不给用户造假的「已撤销」预期。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const replaceSelection: ToolDef<ReplaceSelectionArgs> = {
  name: 'replace_selection',
  kind: 'write',
  description: '将 Word 当前选中内容替换为新文本。适合快速改写选中段落。',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string', description: '替换后的新文本' },
    },
    required: ['text'],
  },
  humanLabel: ({ text }) =>
    `将选中内容替换为「${String(text).slice(0, HUMAN_LABEL_TEXT_CAP)}${
      String(text).length > HUMAN_LABEL_TEXT_CAP ? '…' : ''
    }」`,
  async execute({ text }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；执行替换（beforeImage 不再用于 inverse，故不接收返回值）
    await (ctx.adapter as WordAdapter).replaceSelection(text);
    // CR-04：noop_inverse —— 诚实标注「无法自动撤销」，不用误导性的 delete_paragraph_by_content
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: 'replace_selection 无法精确还原原始选区内容' },  // Record 对象
    };
    const postState = { kind: 'word_paragraph' as const, content: text };
    return {
      ok: true,
      data: { written: String(text).length },
      reverse,
      postState,
    };
  },
};
