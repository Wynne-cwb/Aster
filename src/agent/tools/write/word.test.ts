/**
 * src/agent/tools/write/word.test.ts — Phase 3 Plan 04 Task 5.1（Phase 5 Plan 01 更新）
 *
 * 验证 appendParagraph ToolDef:
 * - humanLabel 截 30 字符规则（短文本不截 / 50 字符截 30 + …）
 * - execute 调 ctx.adapter.appendParagraph(text)
 * - 返 { ok:true, data:{written:text.length},
 *        reverse:{tool:'delete_paragraph_by_content', args:{text:'...'}},（Phase 5 TOOL-04）
 *        postState:{kind:'word_paragraph', content:'...'}（Phase 5 TOOL-04）}
 */
import { describe, it, expect, vi } from 'vitest';
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
