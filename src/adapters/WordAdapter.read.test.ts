/**
 * src/adapters/WordAdapter.read.test.ts — Phase 4 Plan 03 Task 1 (TDD RED)
 *
 * 验证 WordAdapter.read(query) 5 个 kind 实现：
 * - get_paragraph_count — 段落总数
 * - get_paragraph_at — 指定 index 段落文本（0-based）；越界返 NOT_FOUND
 * - get_document_outline — styleBuiltIn 匹配 /Heading\d/ 抽层级（不用本地化 .style）
 * - get_document_full_text — 全文文本
 * - selection_detail — 复用 getSelection() 语义
 *
 * Office.js mock 模式照 WordAdapter.test.ts（Phase 3 Plan 04 Task 5.1）
 * A-06：proxy 不出 Word.run 闭包；只返纯数据。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WordAdapter } from './WordAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// Helper: 构造 paragraphs mock（items 数组 + load + ParagraphCollection 形态）
// ---------------------------------------------------------------------------
function makeParagraphs(
  items: Array<{ text: string; styleBuiltIn: string }>,
  syncFn: ReturnType<typeof vi.fn>,
) {
  const mockItems = items.map((p) => ({ text: p.text, styleBuiltIn: p.styleBuiltIn }));
  const paragraphsProxy = {
    items: mockItems,
    load: vi.fn(),
  };
  // 构造 Word.run ctx
  const ctx = {
    document: {
      body: {
        paragraphs: paragraphsProxy,
        text: items.map((p) => p.text).join('\n'),
        load: vi.fn(),
      },
      getSelection: vi.fn(() => ({
        text: '选中文本',
        load: vi.fn(),
      })),
    },
    sync: syncFn,
  };
  return { ctx, paragraphsProxy };
}

// ---------------------------------------------------------------------------
// describe: get_paragraph_count
// ---------------------------------------------------------------------------
describe('WordAdapter.read — get_paragraph_count', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const items = [
      { text: '第一段', styleBuiltIn: 'Normal' },
      { text: '第二段', styleBuiltIn: 'Normal' },
      { text: '第三段', styleBuiltIn: 'Normal' },
    ];
    const { ctx } = makeParagraphs(items, sync);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('返回 { ok: true, data: { count: 3 } }', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_count' });
    expect(result).toEqual({ ok: true, data: { count: 3 } });
  });

  it('调用 Word.run + paragraphs.load + ctx.sync', async () => {
    const adapter = new WordAdapter();
    await adapter.read({ kind: 'get_paragraph_count' });
    const wordGlobal = (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word;
    expect(wordGlobal.run).toHaveBeenCalledTimes(1);
    expect(sync).toHaveBeenCalled();
  });

  it('Word.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(async () => {
      throw new Error('api error');
    });
    const adapter = new WordAdapter();
    await expect(adapter.read({ kind: 'get_paragraph_count' })).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: get_paragraph_at
// ---------------------------------------------------------------------------
describe('WordAdapter.read — get_paragraph_at', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const items = [
      { text: '第一段正文', styleBuiltIn: 'Normal' },
      { text: '第二段正文', styleBuiltIn: 'Normal' },
      { text: '第三段正文', styleBuiltIn: 'Normal' },
    ];
    const { ctx } = makeParagraphs(items, sync);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('index=0 返回第一段文本', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_at', index: 0 });
    expect(result).toEqual({ ok: true, data: { index: 0, text: '第一段正文' } });
  });

  it('index=2（第 3 段）返回正确文本', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_at', index: 2 });
    expect(result).toEqual({ ok: true, data: { index: 2, text: '第三段正文' } });
  });

  it('index=999 越界返 NOT_FOUND（ok:false，不抛）', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_at', index: 999 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.recoverable).toBe(false);
      expect(result.error.message).toContain('1000');
      expect(result.error.hint).toBeTruthy();
    }
  });

  it('index=-1 负数越界返 NOT_FOUND', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_at', index: -1 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('Word.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(async () => {
      throw new Error('sync failed');
    });
    const adapter = new WordAdapter();
    await expect(
      adapter.read({ kind: 'get_paragraph_at', index: 0 }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: get_document_outline
// ---------------------------------------------------------------------------
describe('WordAdapter.read — get_document_outline', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    // 混合样式：Heading1/Heading2/Normal
    const items = [
      { text: '第一章', styleBuiltIn: 'Heading1' },
      { text: '正文段落一', styleBuiltIn: 'Normal' },
      { text: '1.1 节', styleBuiltIn: 'Heading2' },
      { text: '正文段落二', styleBuiltIn: 'Normal' },
      { text: '第二章', styleBuiltIn: 'Heading1' },
    ];
    const { ctx } = makeParagraphs(items, sync);
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('只抽 Heading 段，返 outline 数组', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_document_outline' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { outline: Array<{ level: number; text: string; paragraphIndex: number }> };
      expect(data.outline).toHaveLength(3);
      expect(data.outline[0]).toEqual({ level: 1, text: '第一章', paragraphIndex: 0 });
      expect(data.outline[1]).toEqual({ level: 2, text: '1.1 节', paragraphIndex: 2 });
      expect(data.outline[2]).toEqual({ level: 1, text: '第二章', paragraphIndex: 4 });
    }
  });

  it('无 Heading 段时 outline 为空数组', async () => {
    // 重设 Word.run — 全 Normal
    const items = [
      { text: '段一', styleBuiltIn: 'Normal' },
      { text: '段二', styleBuiltIn: 'Normal' },
    ];
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const { ctx } = makeParagraphs(items, syncFn);
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => cb(ctx),
    );
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_document_outline' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { outline: unknown[] };
      expect(data.outline).toHaveLength(0);
    }
  });

  it('不用 .style 字段（用 styleBuiltIn）', async () => {
    // 验证：若 styleBuiltIn 不是 Heading，即使某段 text 有「标题」也不入 outline
    const items = [
      { text: '看起来像标题', styleBuiltIn: 'Normal' },
    ];
    const syncFn = vi.fn().mockResolvedValue(undefined);
    const { ctx } = makeParagraphs(items, syncFn);
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => cb(ctx),
    );
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_document_outline' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { outline: unknown[] };
      expect(data.outline).toHaveLength(0);
    }
  });

  it('Word.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(async () => {
      throw new Error('outline error');
    });
    const adapter = new WordAdapter();
    await expect(
      adapter.read({ kind: 'get_document_outline' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: get_document_full_text
// ---------------------------------------------------------------------------
describe('WordAdapter.read — get_document_full_text', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    // body.text 是全文
    const bodyText = '第一段\n第二段\n第三段';
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            body: {
              text: bodyText,
              load: vi.fn(),
            },
          },
          sync,
        }),
      ),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('返回 { ok: true, data: { text: <全文> } }', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'get_document_full_text' });
    expect(result).toEqual({ ok: true, data: { text: '第一段\n第二段\n第三段' } });
  });

  it('调用 body.load + ctx.sync', async () => {
    const adapter = new WordAdapter();
    await adapter.read({ kind: 'get_document_full_text' });
    expect(sync).toHaveBeenCalled();
  });

  it('Word.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(async () => {
      throw new Error('body error');
    });
    const adapter = new WordAdapter();
    await expect(
      adapter.read({ kind: 'get_document_full_text' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: selection_detail
// ---------------------------------------------------------------------------
describe('WordAdapter.read — selection_detail', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    // 设置 Office（supportsUniqueId 返 false，让旧测试不依赖 uniqueLocalId 行为）
    (global as unknown as Record<string, unknown>).Office = {
      context: {
        requirements: { isSetSupported: vi.fn().mockReturnValue(false) },
      },
    };
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            getSelection: vi.fn(() => ({
              text: '我选中了这段文字',
              load: vi.fn(),
            })),
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [
                  { text: '我选中了这段文字' },
                ],
              },
            },
          },
          sync,
        }),
      ),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
    delete (global as unknown as Record<string, unknown>).Office;
  });

  it('有选区 → 返回 { ok: true, data: { kind: "word", charCount: N, text } }（UAT Bug：必须含选中文字）', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { kind: string; charCount: number; text: string };
      expect(data.kind).toBe('word');
      expect(data.charCount).toBe('我选中了这段文字'.length);
      // Bug 修复：selection_detail 必须返回选中文字本身，否则 agent 无法定位/改写选中内容
      expect(data.text).toBe('我选中了这段文字');
    }
  });

  it('无选区（text 为空字符串）→ 返回 { ok: true, data: { kind: "none" } }', async () => {
    (global as unknown as { Word: { run: ReturnType<typeof vi.fn> } }).Word.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            getSelection: vi.fn(() => ({
              text: '',
              load: vi.fn(),
            })),
            body: {
              paragraphs: {
                load: vi.fn(),
                items: [],
              },
            },
          },
          sync,
        }),
    );
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { kind: string };
      expect(data.kind).toBe('none');
    }
  });
});

// ---------------------------------------------------------------------------
// describe: default — UNSUPPORTED kind（防御）
// ---------------------------------------------------------------------------
describe('WordAdapter.read — default UNSUPPORTED', () => {
  beforeEach(() => {
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End', replace: 'Replace', after: 'After' },
      run: vi.fn(),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).Word;
  });

  it('未知 kind 返 { ok: false, error: { code: "UNSUPPORTED" } }（不抛）', async () => {
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'list_slides' } as Parameters<typeof adapter.read>[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED');
      expect(result.error.recoverable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 9 Wave 0：selection_detail 扩展单测骨架（WSEL-01）
//
// RED 骨架：selection_detail 扩展（paragraphIndex + uniqueLocalId）在计划 03 实现。
// 现有 selection_detail case 只返回 { kind, charCount, text }，不含 paragraphIndex/uniqueLocalId。
// 这两条测试在计划 03 实现 WSEL-01 扩展后变绿。
// ---------------------------------------------------------------------------

function mockWordForRead(paragraphTexts: Array<{ text: string; uniqueLocalId?: string }>) {
  (global as unknown as Record<string, unknown>).Office = {
    context: {
      requirements: {
        isSetSupported: vi.fn((setName: string, version: string) =>
          setName === 'WordApi' && version === '1.6'
        ),
      },
    },
  };
  const items = paragraphTexts.map(({ text, uniqueLocalId }) => ({
    text,
    uniqueLocalId: uniqueLocalId ?? 'mock-uid-' + text,
    load: vi.fn(),
  }));
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: {
          body: { paragraphs: { load: vi.fn(), items } },
          getSelection: () => ({ load: vi.fn(), text: items[0]?.text ?? '' }),
        },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

describe('WordAdapter.read selection_detail — WSEL-01 扩展（Phase 9）', () => {
  afterEach(() => {
    delete (global as Record<string, unknown>).Word;
    delete (global as Record<string, unknown>).Office;
  });

  it('selection_detail 返回 paragraphIndex + uniqueLocalId（WordApi 1.6 支持）', async () => {
    (global as unknown as Record<string, unknown>).Office = {
      context: {
        requirements: { isSetSupported: vi.fn().mockReturnValue(true) },
      },
    };
    const para0 = { text: '第一段', uniqueLocalId: 'uid-001', load: vi.fn() };
    const para1 = { text: '第二段', uniqueLocalId: 'uid-002', load: vi.fn() };
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            getSelection: () => ({ load: vi.fn(), text: '第一段' }),
            body: { paragraphs: { load: vi.fn(), items: [para0, para1] } },
          },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as Record<string, unknown>;
    expect(data.paragraphIndex).toBe(0);
    expect(data.uniqueLocalId).toBe('uid-001');
  });

  it('selection_detail — 不支持 WordApi 1.6 时 uniqueLocalId 返 null（降级 D-03）', async () => {
    (global as unknown as Record<string, unknown>).Office = {
      context: {
        requirements: { isSetSupported: vi.fn().mockReturnValue(false) },
      },
    };
    const para0 = { text: '段落', load: vi.fn() };
    (global as unknown as Record<string, unknown>).Word = {
      InsertLocation: { end: 'End' },
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          document: {
            getSelection: () => ({ load: vi.fn(), text: '段落' }),
            body: { paragraphs: { load: vi.fn(), items: [para0] } },
          },
          sync: vi.fn().mockResolvedValue(undefined),
        }),
      ),
    };
    const adapter = new WordAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as Record<string, unknown>;
    expect(data.paragraphIndex).toBe(0);
    expect(data.uniqueLocalId).toBeNull();
  });
});
