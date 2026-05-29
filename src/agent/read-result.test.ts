/**
 * src/agent/read-result.test.ts — vitest acceptance (TOOL-05 / TOOL-06)
 *
 * 覆盖：estimateTokens / applySizeCap / wrapReadResult 全部 behavior。
 */
import { describe, it, expect } from 'vitest';
import { estimateTokens, applySizeCap, wrapReadResult } from './read-result';
import type { WrappedReadResult } from './read-result';
import type { ToolResult } from './tools';

describe('estimateTokens', () => {
  it('8 个中文字符 → ceil(8/1.6)=5', () => {
    expect(estimateTokens('一二三四五六七八')).toBe(5);
  });

  it('空字符串 → 0', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('160 个字符 → ceil(160/1.6)=100', () => {
    const s = 'a'.repeat(160);
    expect(estimateTokens(s)).toBe(100);
  });
});

describe('applySizeCap', () => {
  it('≤50K tokens 内容原样返回，truncated:false', () => {
    const short = 'x'.repeat(100);
    const result = applySizeCap(short);
    expect(result.content).toBe(short);
    expect(result.truncated).toBe(false);
  });

  it('>50K tokens（>80000 字符）被截断，truncated:true，末尾含 truncated 标记', () => {
    // 50000 * 1.6 = 80000 字符临界，构造 90000 字符（一定超 cap）
    const long = 'x'.repeat(90000);
    const result = applySizeCap(long);
    expect(result.truncated).toBe(true);
    expect(result.content.endsWith('\n…[truncated]')).toBe(true);
    // 截断后内容 ≤ 80000 + suffix 长度
    expect(result.content.length).toBeLessThanOrEqual(80000 + '\n…[truncated]'.length);
  });

  it('刚好 80000 字符（=50K tokens 临界）返 truncated:false', () => {
    const exact = 'x'.repeat(80000);
    // estimateTokens(80000) = ceil(80000/1.6) = 50000，刚好等于 HARD_CAP_TOKENS → 不截
    const result = applySizeCap(exact);
    expect(result.truncated).toBe(false);
  });

  it('80001 字符 → truncated:true', () => {
    const overBy1 = 'x'.repeat(80001);
    const result = applySizeCap(overBy1);
    expect(result.truncated).toBe(true);
  });
});

describe('wrapReadResult', () => {
  it('成功结果包装成 WrappedReadResult，字段完整', () => {
    const toolResult: ToolResult = {
      ok: true,
      data: { paragraph_count: 42 },
    };
    const result = wrapReadResult(toolResult, {
      result_type: 'metadata',
      source: 'document.paragraph_count',
    });

    expect(result.ok).toBe(true);
    const wrapped = result.data as WrappedReadResult;
    expect(wrapped.result_type).toBe('metadata');
    expect(wrapped.source).toBe('document.paragraph_count');
    expect(typeof wrapped.content).toBe('string');
    expect(wrapped.truncated).toBe(false);
    // content 应是 data 的 JSON
    expect(JSON.parse(wrapped.content)).toEqual({ paragraph_count: 42 });
  });

  it('成功结果 result_type=document_content 正确分类', () => {
    const toolResult: ToolResult = {
      ok: true,
      data: { text: '这是文档正文内容' },
    };
    const result = wrapReadResult(toolResult, {
      result_type: 'document_content',
      source: 'get_paragraph_at',
    });
    const wrapped = result.data as WrappedReadResult;
    expect(wrapped.result_type).toBe('document_content');
  });

  it('失败结果原样透传，不包装为 content', () => {
    const toolResult: ToolResult = {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: '文档不存在',
        recoverable: true,
        hint: '请检查文档是否打开',
      },
    };
    const result = wrapReadResult(toolResult, {
      result_type: 'metadata',
      source: 'list_slides',
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    // 失败时不产生 WrappedReadResult 结构
    expect((result.data as WrappedReadResult | undefined)?.result_type).toBeUndefined();
  });

  it('超大成功结果被 size cap 截断，truncated:true', () => {
    const bigData = { text: 'a'.repeat(90000) };
    const toolResult: ToolResult = { ok: true, data: bigData };
    const result = wrapReadResult(toolResult, {
      result_type: 'document_content',
      source: 'get_document_full_text',
    });
    const wrapped = result.data as WrappedReadResult;
    expect(wrapped.truncated).toBe(true);
    expect(wrapped.content.endsWith('\n…[truncated]')).toBe(true);
  });
});
