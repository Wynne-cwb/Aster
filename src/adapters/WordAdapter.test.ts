/**
 * src/adapters/WordAdapter.test.ts — Phase 3 Plan 04 Task 5.1
 *
 * 验证 appendParagraph 方法：
 * - Word.run 闭包内 ctx.document.body.insertParagraph(text, Word.InsertLocation.end) + ctx.sync()
 * - Word.run 抛错 → 包成 HostApiError，不读 hostError（ERR-02 Plan 02 改造）
 *
 * Office.js mock 模式参照 adapters.test.ts L198-208。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WordAdapter } from './WordAdapter';
import { HostApiError } from '../errors';

describe('WordAdapter.appendParagraph', () => {
  let insertParagraph: ReturnType<typeof vi.fn>;
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    insertParagraph = vi.fn();
    sync = vi.fn().mockResolvedValue(undefined);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: { body: { insertParagraph } },
          sync,
        }),
      ),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('调 Word.run 内 insertParagraph(text, Word.InsertLocation.end) + ctx.sync()', async () => {
    const adapter = new WordAdapter();
    await adapter.appendParagraph('hello world');
    const wordGlobal = (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word;
    expect(wordGlobal.run).toHaveBeenCalledTimes(1);
    expect(insertParagraph).toHaveBeenCalledWith('hello world', 'End');
    expect(sync).toHaveBeenCalled();
  });

  it('Word.run 抛错时抛 HostApiError（HostApiError 实例不存 hostError）', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(
      async () => {
        throw new Error('rich api error');
      },
    );
    const adapter = new WordAdapter();
    let caught: unknown = null;
    try {
      await adapter.appendParagraph('x');
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HostApiError);
    // ERR-02 改造：HostApiError 构造器收到 hostError 不存到实例字段
    expect(Object.keys(caught as object)).not.toContain('hostError');
  });

  it('多段连续调用：N 次 appendParagraph 触发 N 次 Word.run（A-06 pure data in/out）', async () => {
    const adapter = new WordAdapter();
    await adapter.appendParagraph('段 1');
    await adapter.appendParagraph('段 2');
    await adapter.appendParagraph('段 3');
    const wordGlobal = (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word;
    expect(wordGlobal.run).toHaveBeenCalledTimes(3);
    expect(insertParagraph).toHaveBeenNthCalledWith(1, '段 1', 'End');
    expect(insertParagraph).toHaveBeenNthCalledWith(2, '段 2', 'End');
    expect(insertParagraph).toHaveBeenNthCalledWith(3, '段 3', 'End');
  });
});
