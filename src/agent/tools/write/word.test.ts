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
 * Phase 6 Wave 0 新增：
 * - insert_paragraph / replace_paragraph / insert_text_at_cursor / replace_selection 测试桩
 * - 以 describe.skip 包裹（Wave 2 实现后取消 skip，转 RED→GREEN）
 * - 所有 reverse.args 必须是 Record<string, unknown>（非位置参）守门
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appendParagraph } from './word';
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
// Phase 6 Wave 0 测试桩（Wave 2 解锁）— insert_paragraph
// ---------------------------------------------------------------------------

describe.skip('insert_paragraph — Wave 2 解锁', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    // import { insertParagraph } from './word';
    //
    // const mockAdapter = {
    //   insertParagraphAt: vi.fn().mockResolvedValue(undefined),
    //   capabilities: () => ({ host: 'word' as const }),
    // };
    // const result = await insertParagraph.execute(
    //   { index: 2, text: '新段落' },
    //   { adapter: mockAdapter } as never,
    // );
    //
    // expect(result.ok).toBe(true);
    // expect(result.reverse).toBeDefined();
    // expect(typeof result.reverse?.args).toBe('object'); // Record<string, unknown> 守门
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('humanLabel 存在且返回中文字符串', async () => {
    // expect(typeof insertParagraph.humanLabel).toBe('function');
    // const label = insertParagraph.humanLabel({ index: 2, text: '新段落文本' });
    // expect(typeof label).toBe('string');
    // expect(label.length).toBeGreaterThan(0);
    // 中文字符（含汉字）
    // expect(/[一-鿿]/.test(label)).toBe(true);
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Wave 0 测试桩（Wave 2 解锁）— replace_paragraph
// ---------------------------------------------------------------------------

describe.skip('replace_paragraph — Wave 2 解锁（含 expected_state 守门）', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    // import { replaceParagraph } from './word';
    //
    // const mockAdapter = {
    //   replaceParagraphAt: vi.fn().mockResolvedValue({ beforeImage: '旧段落' }),
    //   capabilities: () => ({ host: 'word' as const }),
    // };
    // const result = await replaceParagraph.execute(
    //   { index: 1, text: '新文本' },
    //   { adapter: mockAdapter } as never,
    // );
    //
    // expect(result.ok).toBe(true);
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({ restoreText: '旧段落' });
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('expected_state 传入且不匹配当前段落 → execute 返 ok:false 或抛 INVALID_ARGS（D-11 并发防御）', async () => {
    // import { replaceParagraph } from './word';
    //
    // const mockAdapter = {
    //   replaceParagraphAt: vi.fn().mockRejectedValue(
    //     Object.assign(new Error('并发修改冲突'), { code: 'INVALID_ARGS' }),
    //   ),
    //   capabilities: () => ({ host: 'word' as const }),
    // };
    // const result = await replaceParagraph.execute(
    //   { index: 1, text: '新文本', expected_state: '期望但不一致的旧文本' },
    //   { adapter: mockAdapter } as never,
    // );
    //
    // // 应该返 ok: false 或 throw（tool execute 协议中 error 走 ok:false 路径）
    // expect(result.ok).toBe(false);
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Wave 0 测试桩（Wave 2 解锁）— insert_text_at_cursor
// ---------------------------------------------------------------------------

describe.skip('insert_text_at_cursor — Wave 2 解锁', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    // import { insertTextAtCursor } from './word';
    //
    // const mockAdapter = {
    //   insertTextAtCursor: vi.fn().mockResolvedValue(undefined),
    //   capabilities: () => ({ host: 'word' as const }),
    // };
    // const result = await insertTextAtCursor.execute(
    //   { text: '光标处插入' },
    //   { adapter: mockAdapter } as never,
    // );
    //
    // expect(result.ok).toBe(true);
    // expect(typeof result.reverse?.args).toBe('object');
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Wave 0 测试桩（Wave 2 解锁）— replace_selection
// ---------------------------------------------------------------------------

describe.skip('replace_selection — Wave 2 解锁', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('execute 返回 reverse.args 是 Record<string, unknown>（非位置参守门）', async () => {
    // import { replaceSelection } from './word';
    //
    // const mockAdapter = {
    //   replaceSelection: vi.fn().mockResolvedValue(undefined),
    //   capabilities: () => ({ host: 'word' as const }),
    // };
    // const result = await replaceSelection.execute(
    //   { text: '替换选中内容' },
    //   { adapter: mockAdapter } as never,
    // );
    //
    // expect(result.ok).toBe(true);
    // expect(typeof result.reverse?.args).toBe('object');
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });

  it('humanLabel 存在且返回中文字符串', async () => {
    // import { replaceSelection } from './word';
    // expect(typeof replaceSelection.humanLabel).toBe('function');
    // const label = replaceSelection.humanLabel({ text: '替换的文本' });
    // expect(/[一-鿿]/.test(label)).toBe(true); // 含中文字符
    expect(true).toBe(true); // 占位：Wave 2 解锁后替换
  });
});
