/**
 * src/adapters/WordAdapter.test.ts — Phase 3 Plan 04 Task 5.1 + Phase 5 Plan 01 Wave 0
 *
 * Phase 3：验证 appendParagraph 方法
 * Phase 5 Wave 0 stub：deleteParagraphByContent inverse mock（Wave 3 实现后变绿）
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

// ---------------------------------------------------------------------------
// deleteParagraphByContent — Phase 5 Plan 04 实现（从 Wave 0 stub 展开为真实测试）
// ---------------------------------------------------------------------------

describe('WordAdapter.deleteParagraphByContent', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('找到匹配文本的段落并删除', async () => {
    const targetText = '段落一';
    const mockDelete = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [
                  { text: '其他段落', delete: vi.fn() },
                  { text: '段落一', delete: mockDelete },
                  { text: '又一段', delete: vi.fn() },
                ],
              },
            },
          },
          sync,
        }),
      ),
    };
    const adapter = new WordAdapter();
    await adapter.deleteParagraphByContent(targetText);
    expect(mockDelete).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalled();
  });

  it('找不到目标段落 → 抛 HostApiError', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [{ text: '无关段落', delete: vi.fn() }],
              },
            },
          },
          sync,
        }),
      ),
    };
    const adapter = new WordAdapter();
    await expect(adapter.deleteParagraphByContent('不存在的段落')).rejects.toBeInstanceOf(
      HostApiError,
    );
  });

  it('规范化：段落 text 末尾含 \\r 与输入不带 \\r 等价（Pitfall 2 防 false-skip）', async () => {
    // Word API 返回的段落文本末尾可能含 \r（Word 段落结束标记）
    // deleteParagraphByContent 应 normalizeText 后对比，防止因末尾 \r 导致 false-skip
    const mockDelete = vi.fn();
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [{ text: '段落一\r', delete: mockDelete }],
              },
            },
          },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    const adapter = new WordAdapter();
    await adapter.deleteParagraphByContent('段落一'); // 不带 \r
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('从尾到头遍历：同名段落时删除最后那个（最近追加的优先）', async () => {
    // 两个同名段落，从尾到头遍历应删 index=1（最后追加的那个）
    const deleteFirst = vi.fn();
    const deleteLast = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [
                  { text: '重复段落', delete: deleteFirst },
                  { text: '重复段落', delete: deleteLast },
                ],
              },
            },
          },
          sync,
        }),
      ),
    };
    const adapter = new WordAdapter();
    await adapter.deleteParagraphByContent('重复段落');
    // 尾部优先 → deleteLast 被调，deleteFirst 不被调
    expect(deleteLast).toHaveBeenCalledTimes(1);
    expect(deleteFirst).not.toHaveBeenCalled();
  });
});
