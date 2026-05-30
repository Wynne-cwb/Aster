/**
 * src/agent/tools/write/word.test.ts — Phase 3 Plan 04 Task 5.1（Phase 5 Plan 01 更新）
 *
 * 验证 appendParagraph ToolDef:
 * - humanLabel 截 30 字符规则（短文本不截 / 50 字符截 30 + …）
 * - execute 调 ctx.adapter.appendParagraph(text)
 * - 返 { ok:true, data:{written:text.length},
 *        reverse:{tool:'delete_paragraph_by_content', args:{text:'...'}},（Phase 5 TOOL-04）
 *        postState:{kind:'word_paragraph', content:'...'}（Phase 5 TOOL-04）}
 *
 * Phase 6 Plan 07 更新：
 * - insert_paragraph / replace_paragraph / insert_text_at_cursor / replace_selection 已实现
 * - 取消 describe.skip，转 GREEN（Wave 2 解锁完成）
 * - 所有 reverse.args 必须是 Record<string, unknown>（非位置参）守门
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendParagraph, insertParagraph, replaceParagraph, insertTextAtCursor, replaceSelection } from './word';
import type { ToolExecContext } from '../index';
import type { DocumentAdapter } from '../../../adapters/DocumentAdapter';
import type { WordAdapter } from '../../../adapters/WordAdapter';

function makeMockAdapter(appendParagraphFn: (text: string) => Promise<void>): WordAdapter {
  return {
    appendParagraph: appendParagraphFn,
    capabilities: () => ({
      host: 'word' as const,
      supportsSelectionEvents: true,
      supportedInserts: ['text' as const, 'paragraphs' as const],
    }),
    getSelection: async () => ({ kind: 'none' as const }),
    onSelectionChanged: () => () => {},
    insert: async () => {},
  } as unknown as WordAdapter;
}

function makeCtx(adapter: WordAdapter): ToolExecContext {
  return {
    adapter: adapter as unknown as DocumentAdapter,
    runId: 'r1',
    stepIndex: 1,
    signal: new AbortController().signal,
  };
}

describe('appendParagraph ToolDef — Phase 3 Plan 04 Task 5.1', () => {
  it('name === "append_paragraph"; description / parameters 字段齐全', () => {
    expect(appendParagraph.name).toBe('append_paragraph');
    expect(typeof appendParagraph.description).toBe('string');
    expect(appendParagraph.description.length).toBeGreaterThan(0);
    expect(typeof appendParagraph.parameters).toBe('object');
    const params = appendParagraph.parameters as {
      type: string;
      properties: { text: unknown };
      required: string[];
    };
    expect(params.type).toBe('object');
    expect(params.properties.text).toBeDefined();
    expect(params.required).toContain('text');
  });

  it('humanLabel: 短文本不截断', () => {
    expect(appendParagraph.humanLabel({ text: '短文本' })).toBe('在文档末尾追加段落「短文本」');
  });

  it('humanLabel: == 30 字符正好不追加 …', () => {
    const exactly30 = 'a'.repeat(30);
    const label = appendParagraph.humanLabel({ text: exactly30 });
    expect(label).toBe('在文档末尾追加段落「' + exactly30 + '」');
    expect(label).not.toContain('…');
  });

  it('humanLabel: > 30 字符 → 截前 30 + 追加 "…"', () => {
    const long = 'a'.repeat(50);
    const label = appendParagraph.humanLabel({ text: long });
    expect(label).toContain('…');
    expect(label.startsWith('在文档末尾追加段落「')).toBe(true);
    expect(label).toBe('在文档末尾追加段落「' + 'a'.repeat(30) + '…」');
  });

  it('execute: 调 adapter.appendParagraph(text) + 返 ok + reverse descriptor', async () => {
    const mockAppendParagraph = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx(makeMockAdapter(mockAppendParagraph));

    const result = await appendParagraph.execute({ text: '段落一' }, ctx);

    expect(mockAppendParagraph).toHaveBeenCalledWith('段落一');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ written: 3 });
    // Phase 5 TOOL-04：reverse descriptor 必须定义（守门断言）
    expect(result.reverse).toBeDefined();
    // Phase 5 TOOL-04：精确 reverse 使用 delete_paragraph_by_content + args.text
    expect(result.reverse).toEqual({ tool: 'delete_paragraph_by_content', args: { text: '段落一' } });
    // Phase 5 TOOL-04：postState 快照（Wave 3 实现后变绿）
    expect(result.postState).toEqual({ kind: 'word_paragraph', content: '段落一' });
  });

  it('execute: 空字符串也合法（written=0）', async () => {
    const mockAppendParagraph = vi.fn().mockResolvedValue(undefined);
    const ctx = makeCtx(makeMockAdapter(mockAppendParagraph));

    const result = await appendParagraph.execute({ text: '' }, ctx);

    expect(mockAppendParagraph).toHaveBeenCalledWith('');
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({ written: 0 });
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 07 — insert_paragraph
// ---------------------------------------------------------------------------

describe('insert_paragraph — Phase 6 Plan 07', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    const mockInsertParagraphAt = vi.fn().mockResolvedValue({ insertedText: '新段落' });
    const mockAdapter = {
      insertParagraphAt: mockInsertParagraphAt,
      capabilities: () => ({ host: 'word' as const, supportsSelectionEvents: true, supportedInserts: ['text' as const] }),
    } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };

    const result = await insertParagraph.execute({ before_index: 2, text: '新段落' }, ctx);

    expect(mockInsertParagraphAt).toHaveBeenCalledWith(2, '新段落');
    expect(result.ok).toBe(true);
    expect(result.reverse).toBeDefined();
    expect(typeof result.reverse?.args).toBe('object'); // Record<string, unknown> 守门
    expect(result.reverse?.tool).toBe('delete_paragraph_by_content');
    expect(result.postState).toEqual({ kind: 'word_paragraph', content: '新段落' });
  });

  it('humanLabel 存在且返回中文字符串', () => {
    expect(typeof insertParagraph.humanLabel).toBe('function');
    const label = insertParagraph.humanLabel({ before_index: 2, text: '新段落文本' });
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
    expect(/[一-鿿]/.test(label)).toBe(true); // 含中文字符
    expect(label).toContain('第 3 段'); // before_index=2 → 第 3 段
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 07 — replace_paragraph（含 expected_state 守门）
// ---------------------------------------------------------------------------

describe('replace_paragraph — Phase 6 Plan 07（含 expected_state 守门）', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    const mockReplaceParagraphAt = vi.fn().mockResolvedValue({ beforeImage: '旧段落' });
    const mockAdapter = {
      replaceParagraphAt: mockReplaceParagraphAt,
      capabilities: () => ({ host: 'word' as const, supportsSelectionEvents: true, supportedInserts: ['text' as const] }),
    } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };

    const result = await replaceParagraph.execute({ index: 1, text: '新文本' }, ctx);

    expect(mockReplaceParagraphAt).toHaveBeenCalledWith(1, '新文本', undefined);
    expect(result.ok).toBe(true);
    expect(typeof result.reverse?.args).toBe('object');
    expect(result.reverse?.args).toMatchObject({ restoreText: '旧段落' }); // before-image
    expect(result.reverse?.tool).toBe('restore_paragraph_at');
    expect(result.postState).toEqual({ kind: 'word_paragraph', content: '新文本' });
  });

  it('expected_text 传入时透传给 adapter（D-11 并发防御）', async () => {
    const mockReplaceParagraphAt = vi.fn().mockResolvedValue({ beforeImage: '旧段落' });
    const mockAdapter = {
      replaceParagraphAt: mockReplaceParagraphAt,
    } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };

    await replaceParagraph.execute({ index: 1, text: '新文本', expected_text: '旧段落' }, ctx);
    expect(mockReplaceParagraphAt).toHaveBeenCalledWith(1, '新文本', '旧段落');
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 07 — insert_text_at_cursor
// ---------------------------------------------------------------------------

describe('insert_text_at_cursor — Phase 6 Plan 07', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    const mockInsertTextAtCursor = vi.fn().mockResolvedValue({ insertedText: '光标处插入' });
    const mockAdapter = {
      insertTextAtCursor: mockInsertTextAtCursor,
    } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };

    const result = await insertTextAtCursor.execute({ text: '光标处插入' }, ctx);

    expect(mockInsertTextAtCursor).toHaveBeenCalledWith('光标处插入');
    expect(result.ok).toBe(true);
    expect(typeof result.reverse?.args).toBe('object');
    expect(result.reverse?.tool).toBe('delete_paragraph_by_content');
    expect(result.postState).toEqual({ kind: 'word_paragraph', content: '光标处插入' });
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 07 — replace_selection
// ---------------------------------------------------------------------------

describe('replace_selection — Phase 6 Plan 07', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    const mockReplaceSelection = vi.fn().mockResolvedValue({ beforeImage: '原来的选中内容' });
    const mockAdapter = {
      replaceSelection: mockReplaceSelection,
    } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };

    const result = await replaceSelection.execute({ text: '替换选中内容' }, ctx);

    expect(mockReplaceSelection).toHaveBeenCalledWith('替换选中内容');
    expect(result.ok).toBe(true);
    expect(typeof result.reverse?.args).toBe('object');
    // CR-04：noop_inverse 诚实标注「无法自动撤销」（不再用误导性的 delete_paragraph_by_content）
    expect(result.reverse?.tool).toBe('noop_inverse');
    expect(result.postState).toEqual({ kind: 'word_paragraph', content: '替换选中内容' });
  });

  it('humanLabel 存在且返回中文字符串', () => {
    expect(typeof replaceSelection.humanLabel).toBe('function');
    const label = replaceSelection.humanLabel({ text: '替换的文本' });
    expect(typeof label).toBe('string');
    expect(/[一-鿿]/.test(label)).toBe(true); // 含中文字符
    expect(label).toContain('将选中内容替换为');
  });

  it('reverse.tool === noop_inverse（CR-04 — 诚实标注无法自动撤销）', async () => {
    // CR-04：replace_selection 的 inverse 改为 noop_inverse（语义诚实，不造假撤销）
    const mockReplaceSelection = vi.fn().mockResolvedValue({ beforeImage: '原选中' });
    const mockAdapter = { replaceSelection: mockReplaceSelection } as unknown as WordAdapter;
    const ctx: ToolExecContext = {
      adapter: mockAdapter as unknown as DocumentAdapter,
      runId: 'r1', stepIndex: 1, signal: new AbortController().signal,
    };
    const result = await replaceSelection.execute({ text: '替换文本' }, ctx);
    expect(replaceSelection.name).toBe('replace_selection');
    expect(replaceSelection.kind).toBe('write');
    expect(result.reverse?.tool).toBe('noop_inverse');
    expect(result.reverse?.args).toHaveProperty('reason');
  });
});
