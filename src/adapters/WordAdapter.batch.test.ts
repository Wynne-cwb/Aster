/**
 * src/adapters/WordAdapter.batch.test.ts — Phase 11 Wave 0 WARNING-1 守门骨架（RED）
 *
 * 测试 WordAdapter.executeBatch 返回 real reverse（非 noop_inverse）且不抛 unsupported。
 * executeBatch 在 Wave 2 Task 2b 实现后变绿；此处为 Nyquist Wave 0 RED 骨架。
 *
 * WARNING-1：Word 批量操作 undo 必须是真实的 reverse，不允许用 noop_inverse 退路
 * （违反 BATCH-02 一键 undo 整批的核心承诺）。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WordAdapter } from './WordAdapter';

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).Word;
  vi.restoreAllMocks();
});

/** 构造 mock Word 环境 */
function mockWord(): void {
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End', start: 'Start', before: 'Before', after: 'After' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: {
          body: {
            insertParagraph: vi.fn(() => ({
              styleBuiltIn: undefined,
            })),
          },
        },
        sync: vi.fn().mockResolvedValue(undefined),
      })
    ),
  };
}

describe('WordAdapter.executeBatch — real reverse（非 noop_inverse，WARNING-1 守门）', () => {
  it('executeBatch([append_paragraph]) → subOps[0].reverse.tool !== "noop_inverse" 且是真实 reverse', async () => {
    mockWord();
    const adapter = new WordAdapter();

    // executeBatch 在 Wave 2 才实现；此处 RED（方法不存在）
    const result = await (adapter as unknown as {
      executeBatch: (ops: unknown[]) => Promise<{ subOps: Array<{ reverse: { tool: string; args: Record<string, unknown> } }> }>
    }).executeBatch([
      { tool: 'append_paragraph', args: { text: '测试段落' }, humanLabel: '插入段落' },
    ]);

    expect(result.subOps.length).toBeGreaterThanOrEqual(1);
    expect(result.subOps[0].reverse.tool).not.toBe('noop_inverse');
    // 真实 reverse 应该是 delete_paragraph_by_content 或类似的真实撤销工具
    expect(result.subOps[0].reverse.tool).toBeTruthy();
    // reverse.args 必须是 Record 对象（project_adapter_inverse_signature 铁律）
    expect(typeof result.subOps[0].reverse.args).toBe('object');
    expect(Array.isArray(result.subOps[0].reverse.args)).toBe(false);
  });

  it('executeBatch([append_paragraph]) 不抛 "unsupported" 错误（Word 实现了 executeBatch）', async () => {
    mockWord();
    const adapter = new WordAdapter();

    await expect(
      (adapter as unknown as { executeBatch: (ops: unknown[]) => Promise<unknown> }).executeBatch([
        { tool: 'append_paragraph', args: { text: '测试' }, humanLabel: '插入' },
      ])
    ).resolves.not.toThrow();
  });
});
