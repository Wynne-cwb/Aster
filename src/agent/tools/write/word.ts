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

// ---------------------------------------------------------------------------
// Phase 9 Plan 04 — WORD-01: set_word_character_format + WORD-02: set_word_paragraph_format
// ---------------------------------------------------------------------------

interface SetWordCharacterFormatArgs {
  paragraphIndex: number;
  uniqueLocalId?: string;
  font: {
    bold?: boolean;
    italic?: boolean;
    underline?: string;
    size?: number;
    color?: string;
    name?: string;
  };
}

/**
 * set_word_character_format — 设置 Word 指定段落字符格式（加粗/斜体/下划线/字号/颜色/字体名）。
 *
 * before-image 模式（D-06）：adapter 返 { beforeImage, afterText }，inverse = restore_range_font。
 * reverse.args 必须是 Record 对象（[[project-adapter-inverse-signature]]）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const setWordCharacterFormat: ToolDef<SetWordCharacterFormatArgs> = {
  name: 'set_word_character_format',
  kind: 'write',
  description:
    '设置 Word 指定段落的字符格式（加粗/斜体/下划线/字号/颜色/字体名）。传哪些属性改哪些，其余不变。',
  parameters: {
    type: 'object',
    properties: {
      paragraphIndex: { type: 'number', description: '目标段落编号（0-based）' },
      uniqueLocalId: { type: 'string', description: '段落唯一 ID（可选，精确消歧）' },
      font: {
        type: 'object',
        description: '字符格式属性（传哪些改哪些，未传的不变）',
        properties: {
          bold: { type: 'boolean', description: '加粗' },
          italic: { type: 'boolean', description: '斜体' },
          underline: {
            type: 'string',
            description: '下划线类型（None/Single/Double/Word/Mixed 等）',
          },
          size: { type: 'number', description: '字号（磅，如 12 / 14 / 16）' },
          color: { type: 'string', description: '颜色（十六进制如 #FF0000 或颜色名）' },
          name: { type: 'string', description: '字体名（如 "微软雅黑" / "Arial"）' },
        },
      },
    },
    required: ['paragraphIndex', 'font'],
  },
  humanLabel: ({ paragraphIndex, font }) => {
    const props = Object.entries(font as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => k)
      .join('/');
    return `将第 ${Number(paragraphIndex) + 1} 段字符格式改为 ${props}`;
  },
  async execute({ paragraphIndex, uniqueLocalId, font }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；before-image 由 adapter 内部 Word.run 读取
    const result = await (ctx.adapter as WordAdapter).setCharacterFormat({
      paragraphIndex,
      uniqueLocalId,
      font,
    });
    // before-image inverse = restore_range_font（精确 index + 内容指纹双重定位）
    const reverse: ReverseDescriptor = {
      tool: 'restore_range_font', // ← CONTRACT.md 逐字对齐
      args: {
        index: paragraphIndex,
        expectedText: result.afterText,
        before: result.beforeImage,
      }, // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_char_format' as const, content: { index: paragraphIndex } };
    return {
      ok: true,
      data: { paragraphIndex, modified: Object.keys(font as Record<string, unknown>).length },
      reverse,
      postState,
    };
  },
};

interface SetWordParagraphFormatArgs {
  paragraphIndex: number;
  uniqueLocalId?: string;
  format: {
    lineSpacing?: number;
    spaceBefore?: number;
    spaceAfter?: number;
    alignment?: string;
    indent?: number;
    leftIndent?: number;
  };
}

/**
 * set_word_paragraph_format — 设置 Word 指定段落格式（行距/段前后距/对齐/缩进）。
 *
 * before-image 模式（D-06）：adapter 返 { beforeImage, afterText }，inverse = restore_paragraph_format。
 * lineSpacing 单位为磅（1.5 倍行距 ≈ 18pt 对 12pt 字体）。
 * reverse.args 必须是 Record 对象（[[project-adapter-inverse-signature]]）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const setWordParagraphFormat: ToolDef<SetWordParagraphFormatArgs> = {
  name: 'set_word_paragraph_format',
  kind: 'write',
  description:
    '设置 Word 指定段落的段落格式（行距/段前距/段后距/对齐/缩进）。lineSpacing 单位为磅，传哪些改哪些。',
  parameters: {
    type: 'object',
    properties: {
      paragraphIndex: { type: 'number', description: '目标段落编号（0-based）' },
      uniqueLocalId: { type: 'string', description: '段落唯一 ID（可选，精确消歧）' },
      format: {
        type: 'object',
        description: '段落格式属性（传哪些改哪些，未传的不变）',
        properties: {
          lineSpacing: {
            type: 'number',
            description: '行距（磅值，1.5 倍行距 ≈ 18，单倍 ≈ 12）',
          },
          spaceBefore: { type: 'number', description: '段前距（磅）' },
          spaceAfter: { type: 'number', description: '段后距（磅）' },
          alignment: {
            type: 'string',
            description: '对齐（Left/Centered/Right/Justified）',
          },
          indent: { type: 'number', description: '首行缩进（磅，正值为缩进，负值为悬挂）' },
          leftIndent: { type: 'number', description: '左缩进（磅）' },
        },
      },
    },
    required: ['paragraphIndex', 'format'],
  },
  humanLabel: ({ paragraphIndex, format }) => {
    const props = Object.entries(format as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(', ');
    return `将第 ${Number(paragraphIndex) + 1} 段格式改为 ${props.slice(0, 40)}`;
  },
  async execute({ paragraphIndex, uniqueLocalId, format }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；before-image 由 adapter 内部 Word.run 读取
    const result = await (ctx.adapter as WordAdapter).setParaFormat({
      paragraphIndex,
      uniqueLocalId,
      format,
    });
    // before-image inverse = restore_paragraph_format（精确 index + 内容指纹双重定位）
    const reverse: ReverseDescriptor = {
      tool: 'restore_paragraph_format', // ← CONTRACT.md 逐字对齐
      args: {
        index: paragraphIndex,
        expectedText: result.afterText,
        before: result.beforeImage,
      }, // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_para_format' as const, content: { index: paragraphIndex } };
    return {
      ok: true,
      data: { paragraphIndex, modified: Object.keys(format as Record<string, unknown>).length },
      reverse,
      postState,
    };
  },
};

// ---------------------------------------------------------------------------
// Phase 9 Plan 05 — WORD-03: apply_paragraph_style
// ---------------------------------------------------------------------------

// D-08 allowlist（locale-safe 内置样式名，在调 Word 之前校验，防中文 Office ItemNotFound）
const VALID_BUILTIN_STYLES = new Set([
  'Heading1', 'Heading2', 'Heading3', 'Heading4', 'Heading5',
  'Heading6', 'Heading7', 'Heading8', 'Heading9',
  'Normal', 'NoSpacing', 'Title', 'Subtitle',
  'Quote', 'IntenseQuote', 'ListParagraph', 'Caption',
  'Strong', 'Emphasis', 'IntenseEmphasis', 'BookTitle',
]);

interface ApplyParagraphStyleArgs {
  paragraphIndex: number;
  uniqueLocalId?: string;
  styleName: string;
}

/**
 * apply_paragraph_style — 套用 Word 内置段落样式（D-08 allowlist + locale-safe）。
 *
 * D-08 allowlist 校验在调 adapter 之前（工具层）：非法 styleName（含中文样式名、"Normal1" 等）
 * 直接返 INVALID_PARAM，Word.run 未调用，不因语言版本 crash。
 *
 * before-image 模式（D-06）：adapter 返 { beforeImage, afterText }，inverse = restore_paragraph_style。
 * reverse.args 必须是 Record 对象（[[project-adapter-inverse-signature]]）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const applyParagraphStyle: ToolDef<ApplyParagraphStyleArgs> = {
  name: 'apply_paragraph_style',
  kind: 'write',
  description:
    '套用 Word 内置段落样式（Heading1-9, Normal, Title 等 BuiltInStyleName 值）。中文样式名会被拒绝，请传英文枚举值。',
  parameters: {
    type: 'object',
    properties: {
      paragraphIndex: { type: 'number', description: '目标段落编号（0-based）' },
      uniqueLocalId: { type: 'string', description: '段落唯一 ID（可选，精确消歧）' },
      styleName: {
        type: 'string',
        description:
          'Word.BuiltInStyleName 枚举值（Heading1-9, Normal, NoSpacing, Title, Subtitle, Quote, IntenseQuote, ListParagraph, Caption, Strong, Emphasis, IntenseEmphasis, BookTitle）',
      },
    },
    required: ['paragraphIndex', 'styleName'],
  },
  humanLabel: ({ paragraphIndex, styleName }) =>
    `将第 ${Number(paragraphIndex) + 1} 段套用样式「${String(styleName)}」`,
  async execute({ paragraphIndex, uniqueLocalId, styleName }, ctx): Promise<ToolResult> {
    // D-08: allowlist 校验在调 Word 之前（locale-safe 防御）
    if (!VALID_BUILTIN_STYLES.has(styleName)) {
      return {
        ok: false,
        error: {
          code: 'INVALID_PARAM',
          message: `未知内置样式：${styleName}。可用值：Heading1–9, Normal, Title, Quote 等（Word.BuiltInStyleName 枚举值）`,
          recoverable: true,
          hint: '请传入 Word.BuiltInStyleName 枚举的英文值，如 Heading1, Normal, Title',
        },
      };
    }
    const result = await (ctx.adapter as WordAdapter).applyParagraphStyle({
      paragraphIndex,
      uniqueLocalId,
      styleName,
    });
    // before-image inverse = restore_paragraph_style（精确 index + 内容指纹双重定位）
    const reverse: ReverseDescriptor = {
      tool: 'restore_paragraph_style', // ← CONTRACT.md 逐字对齐
      args: {
        index: paragraphIndex,
        expectedText: result.afterText,
        before: result.beforeImage,
      }, // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = { kind: 'word_style' as const, content: { index: paragraphIndex, styleName } };
    return { ok: true, data: { paragraphIndex, styleName }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 9 Plan 06 — WORD-04: find_and_replace（快照式 undo）
// ---------------------------------------------------------------------------

interface FindAndReplaceArgs {
  searchText: string;
  replaceText: string;
  matchCase?: boolean;
  matchWholeWord?: boolean;
}

/**
 * find_and_replace — 全文查找替换（快照式 undo，D-09/D-10/D-11/D-12）。
 *
 * 快照式 undo（D-09）：adapter.findAndReplace 写前计算受影响段落 before-image，
 *   返回 { snapshot, replacedCount, overLimit }。
 * D-10 超限降级（noop+gate）：受影响段落 > 100 → adapter 仍执行替换（不中断），
 *   但 reverse = noop_inverse，data.replaced 仍是真实替换数（SC#4）。
 * D-11 matchCase / matchWholeWord 透传给 adapter.findAndReplace → body.search。
 * D-12 / SC#4 data.replaced：正常路径与超限路径都返回真实替换数（改动卡显示改动数）。
 *
 * reverse.args 必须是 Record 对象（[[project-adapter-inverse-signature]]）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const findAndReplace: ToolDef<FindAndReplaceArgs> = {
  name: 'find_and_replace',
  kind: 'write',
  description:
    '全文查找替换文字（支持 matchCase / matchWholeWord）。undo 按段落快照还原；受影响段落超过 100 个时仍执行替换，但标记为无法自动撤销。',
  parameters: {
    type: 'object',
    properties: {
      searchText: { type: 'string', description: '要查找的文字' },
      replaceText: { type: 'string', description: '替换后的文字' },
      matchCase: { type: 'boolean', description: '区分大小写（默认 false）' },
      matchWholeWord: { type: 'boolean', description: '全词匹配（默认 false）' },
    },
    required: ['searchText', 'replaceText'],
  },
  humanLabel: ({ searchText, replaceText }) =>
    `将「${String(searchText).slice(0, HUMAN_LABEL_TEXT_CAP)}」替换为「${String(replaceText).slice(0, HUMAN_LABEL_TEXT_CAP)}」`,
  async execute({ searchText, replaceText, matchCase, matchWholeWord }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；before-image 快照由 adapter 内部 Word.run 读取
    const result = await (ctx.adapter as WordAdapter).findAndReplace({
      searchText,
      replaceText,
      matchCase,
      matchWholeWord,
    });

    // D-10: 超限降级（noop+gate）。
    // 注意：替换已在 adapter 内部执行（Step 3），这里只是把 reverse 标为 noop_inverse。
    // data.replaced 仍返回真实替换数（SC#4「改动卡显示改动数」要求）。
    if (result.overLimit) {
      return {
        ok: true,
        data: {
          replaced: result.replacedCount, // ← 真实替换数（SC#4），即使超限也返回
          warning: '受影响段落超过 100 个，替换已执行但无法自动撤销',
        },
        reverse: {
          tool: 'noop_inverse',
          args: { reason: '替换段落数超 100，无法自动撤销' }, // Record 对象
        },
        postState: { kind: 'word_snapshot' as const, content: { snapshottedParagraphs: 0 } },
      };
    }

    // 正常路径：快照式 undo（restore_range_snapshot）
    const reverse: ReverseDescriptor = {
      tool: 'restore_range_snapshot', // ← CONTRACT.md 逐字对齐
      args: {
        snapshot: result.snapshot,
      }, // Record 对象（[[project-adapter-inverse-signature]]）
    };
    const postState = {
      kind: 'word_snapshot' as const,
      content: { snapshottedParagraphs: result.snapshot.length },
    };
    return {
      ok: true,
      data: { replaced: result.replacedCount }, // D-12：返回替换数（SC#4）
      reverse,
      postState,
    };
  },
};

// ---------------------------------------------------------------------------
// Phase 9 Plan 07 — WORD-05: insert_table（简单逆向 delete_table_by_marker）
// ---------------------------------------------------------------------------

interface InsertTableArgs {
  rows: number;
  cols: number;
  afterParagraphIndex?: number;
  content?: string[][];
}

/**
 * insert_table — 在 Word 文档插入表格（rows × cols）。
 *
 * D-15 插入位置：afterParagraphIndex 提供 → 在指定段落后插入；省略 → 文档末尾。
 * D-13 指纹：adapter.insertTable 返回 contentFingerprint，填入 reverse.args。
 * reverse.tool = 'delete_table_by_marker'（简单逆向，CONTRACT.md 逐字对齐）。
 * reverse.args 必须是 Record 对象（[[project-adapter-inverse-signature]]）。
 * A-06：adapter 纯数据进出；proxy 不出 Word.run 闭包。
 */
export const insertTable: ToolDef<InsertTableArgs> = {
  name: 'insert_table',
  kind: 'write',
  description:
    '在 Word 文档插入表格（rows × cols）。afterParagraphIndex 指定插入位置（段落后，0-based），省略时插入到文档末尾。content 为二维字符串数组（可选，省略则空表）。',
  parameters: {
    type: 'object',
    properties: {
      rows: { type: 'number', description: '行数' },
      cols: { type: 'number', description: '列数' },
      afterParagraphIndex: {
        type: 'number',
        description: '在第 N 段之后插入（0-based，省略则末尾）',
      },
      content: {
        type: 'array',
        description: '表格内容（二维数组，外层为行，内层为列，省略则空表）',
        items: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
    required: ['rows', 'cols'],
  },
  humanLabel: ({ rows, cols }) => `插入 ${Number(rows)}×${Number(cols)} 表格`,
  async execute({ rows, cols, afterParagraphIndex, content }, ctx): Promise<ToolResult> {
    // A-06：adapter 委托；指纹由 adapter 内部 Word.run 读取
    const result = await (ctx.adapter as WordAdapter).insertTable({
      rows,
      cols,
      afterParagraphIndex,
      content,
    });
    // D-17：reverse.args 必须是 Record 对象（非位置参）
    const reverse: ReverseDescriptor = {
      tool: 'delete_table_by_marker', // ← CONTRACT.md 逐字对齐
      args: {
        contentFingerprint: result.contentFingerprint,
        rows: result.rows,
        cols: result.cols,
        afterParagraphIndex: result.afterParagraphIndex,
      },
    };
    const postState = {
      kind: 'word_table' as const,
      content: { rows, cols, fingerprint: result.contentFingerprint },
    };
    return {
      ok: true,
      data: { rows, cols, inserted: true },
      reverse,
      postState,
    };
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
