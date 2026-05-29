/**
 * src/adapters/PptAdapter.read.test.ts — Phase 4 Plan 04 Task 1 (TDD RED)
 *
 * 验证 PptAdapter.read(query) 5 个 kind 实现：
 * - list_slides       — 一次性返全部 slide {index, title}，按 .index 升序（PPT-05 / D-13）
 * - get_slide         — 指定 slideIndex 的形状清单 + 文本；越界返 NOT_FOUND
 * - list_shapes_on_slide — 指定 slide 的 shapes {id, type, left, top, width, height}（metadata）
 * - get_shape         — 单 shape 详情；shapeId 找不到返 NOT_FOUND
 * - selection_detail  — 复用 getSelection() 语义
 *
 * Office.js mock 模式照 WordAdapter.read.test.ts（Phase 4 Plan 03）。
 * A-06：proxy 不出 PowerPoint.run 闭包；只返纯数据。
 * PPT-05 守则：list_slides 返回按 .index 升序排序（绕 Web 反序 bug #3618）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PptAdapter } from './PptAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// Helper: 构造 shape mock
// ---------------------------------------------------------------------------
interface MockShape {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  textFrame: {
    hasText: boolean;
    textRange: {
      text: string;
      load: ReturnType<typeof vi.fn>;
    };
    load: ReturnType<typeof vi.fn>;
  };
}

function makeShape(
  id: string,
  type: string,
  text: string,
  left = 0,
  top = 0,
  width = 100,
  height = 50,
  hasText: boolean = text.length > 0,
): MockShape {
  return {
    id,
    type,
    left,
    top,
    width,
    height,
    textFrame: {
      hasText,
      textRange: {
        // 真机行为：无文本框的 shape（图片/Logo/线条）读 textRange.text 会抛错。
        // 适配器必须先用 hasText 守卫再读，否则整个 read 失败（真机 UAT 实证）。
        get text(): string {
          if (!hasText) throw new Error('TextFrame has no text range (simulated host error)');
          return text;
        },
        load: vi.fn(),
      },
      load: vi.fn(),
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: 构造 slide mock（带 shapes 集合）
// ---------------------------------------------------------------------------
interface MockSlide {
  index: number;
  shapes: {
    items: MockShape[];
    load: ReturnType<typeof vi.fn>;
    getItemAt: (i: number) => MockShape;
  };
}

function makeSlide(index: number, shapes: MockShape[]): MockSlide {
  return {
    index,
    shapes: {
      items: shapes,
      load: vi.fn(),
      getItemAt: (i: number) => shapes[i],
    },
  };
}

// ---------------------------------------------------------------------------
// Helper: 构造 PowerPoint.run context mock
// ---------------------------------------------------------------------------
function makePptCtx(slides: MockSlide[], syncFn: ReturnType<typeof vi.fn>) {
  return {
    presentation: {
      slides: {
        items: slides,
        load: vi.fn(),
      },
      getSelectedSlides: vi.fn(() => ({
        items: slides.length > 0 ? [slides[0]] : [],
        load: vi.fn(),
      })),
    },
    sync: syncFn,
  };
}

// ---------------------------------------------------------------------------
// describe: list_slides
// ---------------------------------------------------------------------------
describe('PptAdapter.read — list_slides', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    // Web 反序场景：slide items 顺序是 [index=2, index=0, index=1]（绕 PPT-05 bug #3618）
    const slides: MockSlide[] = [
      makeSlide(2, [makeShape('s1', 'TextBox', '第三张标题')]),
      makeSlide(0, [makeShape('s2', 'TextBox', '第一张标题')]),
      makeSlide(1, [makeShape('s3', 'TextBox', '第二张标题')]),
    ];
    const ctx = makePptCtx(slides, sync);
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('返回 { ok: true, data: { count: 3, slides: [...] } }', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { count: number; slides: Array<{ index: number; title: string }> };
      expect(data.count).toBe(3);
      expect(data.slides).toHaveLength(3);
    }
  });

  it('按 .index 升序排列（PPT-05 守则 — 绕 Web 反序 bug #3618）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { slides: Array<{ index: number; title: string }> };
      // 确认升序（1-based index，原始 items 顺序是反序）
      expect(data.slides[0].index).toBe(1);
      expect(data.slides[1].index).toBe(2);
      expect(data.slides[2].index).toBe(3);
    }
  });

  it('index 是 1-based（对应 slide.index 0-based + 1）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { slides: Array<{ index: number; title: string }> };
      // slide.index=0 → data index=1
      expect(data.slides[0].index).toBe(1);
    }
  });

  it('title 取第一个 shape 的 textRange.text 首行', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { slides: Array<{ index: number; title: string }> };
      // 按 index 排序后 index=1 对应原 slide.index=0（第一张），title='第一张标题'
      expect(data.slides[0].title).toBe('第一张标题');
    }
  });

  it('无形状时 title 为空串', async () => {
    const sync2 = vi.fn().mockResolvedValue(undefined);
    const slides: MockSlide[] = [makeSlide(0, [])]; // 无 shape
    const ctx = makePptCtx(slides, sync2);
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => cb(ctx),
    );
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { slides: Array<{ index: number; title: string }> };
      expect(data.slides[0].title).toBe('');
    }
  });

  it('PowerPoint.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async () => { throw new Error('api error'); },
    );
    const adapter = new PptAdapter();
    await expect(adapter.read({ kind: 'list_slides' })).rejects.toBeInstanceOf(HostApiError);
  });

  // 真机 UAT 实证防御：首形状常是图片/Logo（无文本框），盲读其 textRange.text 会抛错令
  // 整个 list_slides 失败（旧实现 RED）。新实现用 hasText 守卫，跳过无文本形状取标题。
  it('首形状无文本框（图片/Logo）→ 不抛错，标题取首个有文本形状', async () => {
    const localSync = vi.fn().mockResolvedValue(undefined);
    const localSlides: MockSlide[] = [
      makeSlide(0, [
        makeShape('logo', 'Picture', '', 0, 0, 100, 50, false), // 无文本框：读 text 会抛
        makeShape('title', 'TextBox', '真正标题\n副标题'),
      ]),
    ];
    const ctx = makePptCtx(localSlides, localSync);
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => cb(ctx),
    );
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_slides' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { slides: Array<{ index: number; title: string }> };
      expect(data.slides[0].title).toBe('真正标题'); // 跳过图片，取文本框首行
    }
  });
});

// ---------------------------------------------------------------------------
// describe: get_slide
// ---------------------------------------------------------------------------
describe('PptAdapter.read — get_slide', () => {
  let sync: ReturnType<typeof vi.fn>;
  let slides: MockSlide[];

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    slides = [
      makeSlide(0, [
        makeShape('sh1', 'TextBox', '标题文本'),
        makeShape('sh2', 'Rectangle', '图形文本'),
      ]),
      makeSlide(1, [
        makeShape('sh3', 'TextBox', '第二张标题'),
      ]),
    ];
    const ctx = makePptCtx(slides, sync);
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('slideIndex=1 返回该 slide 的 shapes 列表（含文本）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_slide', slideIndex: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        index: number;
        shapes: Array<{ id: string; type: string; text: string }>;
      };
      expect(data.index).toBe(1);
      expect(data.shapes).toHaveLength(2);
      expect(data.shapes[0]).toEqual({ id: 'sh1', type: 'TextBox', text: '标题文本' });
      expect(data.shapes[1]).toEqual({ id: 'sh2', type: 'Rectangle', text: '图形文本' });
    }
  });

  it('slideIndex=2 返回第二张 slide', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_slide', slideIndex: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        index: number;
        shapes: Array<{ id: string; type: string; text: string }>;
      };
      expect(data.index).toBe(2);
      expect(data.shapes).toHaveLength(1);
      expect(data.shapes[0].id).toBe('sh3');
    }
  });

  it('slideIndex=99 越界返 NOT_FOUND（ok:false，不抛）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_slide', slideIndex: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.recoverable).toBe(false);
      expect(result.error.hint).toBeTruthy();
    }
  });

  it('slideIndex=0 (1-based 下界) 返 NOT_FOUND', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_slide', slideIndex: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('PowerPoint.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async () => { throw new Error('slide error'); },
    );
    const adapter = new PptAdapter();
    await expect(adapter.read({ kind: 'get_slide', slideIndex: 1 })).rejects.toBeInstanceOf(HostApiError);
  });

  // 真机 UAT 实证防御：slide 含无文本框形状（图片）时，盲读其 textRange.text 会抛错（旧实现 RED）。
  // 新实现用 hasText 守卫：无文本形状 text 返空串，不抛错。
  it('含无文本框形状（图片）→ 该形状 text 为空串，不抛错', async () => {
    const localSync = vi.fn().mockResolvedValue(undefined);
    const localSlides: MockSlide[] = [
      makeSlide(0, [
        makeShape('pic', 'Picture', '', 0, 0, 100, 50, false), // 无文本框
        makeShape('txt', 'TextBox', '有文本'),
      ]),
    ];
    const ctx = makePptCtx(localSlides, localSync);
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) => cb(ctx),
    );
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_slide', slideIndex: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { shapes: Array<{ id: string; type: string; text: string }> };
      expect(data.shapes[0]).toEqual({ id: 'pic', type: 'Picture', text: '' });
      expect(data.shapes[1]).toEqual({ id: 'txt', type: 'TextBox', text: '有文本' });
    }
  });
});

// ---------------------------------------------------------------------------
// describe: list_shapes_on_slide
// ---------------------------------------------------------------------------
describe('PptAdapter.read — list_shapes_on_slide', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const slides: MockSlide[] = [
      makeSlide(0, [
        makeShape('shA', 'TextBox', '忽略文本', 10, 20, 200, 80),
        makeShape('shB', 'Picture', '忽略', 50, 100, 300, 150),
      ]),
    ];
    const ctx = makePptCtx(slides, sync);
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('返回 { ok: true, data: { slideIndex, shapes: [...位置信息...] } }', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_shapes_on_slide', slideIndex: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        slideIndex: number;
        shapes: Array<{ id: string; type: string; left: number; top: number; width: number; height: number }>;
      };
      expect(data.slideIndex).toBe(1);
      expect(data.shapes).toHaveLength(2);
      expect(data.shapes[0]).toEqual({ id: 'shA', type: 'TextBox', left: 10, top: 20, width: 200, height: 80 });
      expect(data.shapes[1]).toEqual({ id: 'shB', type: 'Picture', left: 50, top: 100, width: 300, height: 150 });
    }
  });

  it('返回的 shapes 不含 text 字段（metadata only）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_shapes_on_slide', slideIndex: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { shapes: Array<Record<string, unknown>> };
      // 位置信息，不含 text
      expect('text' in data.shapes[0]).toBe(false);
    }
  });

  it('slideIndex=99 越界返 NOT_FOUND', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'list_shapes_on_slide', slideIndex: 99 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('PowerPoint.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async () => { throw new Error('shapes error'); },
    );
    const adapter = new PptAdapter();
    await expect(
      adapter.read({ kind: 'list_shapes_on_slide', slideIndex: 1 }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: get_shape
// ---------------------------------------------------------------------------
describe('PptAdapter.read — get_shape', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    const slides: MockSlide[] = [
      makeSlide(0, [
        makeShape('target-id', 'TextBox', '目标形状文本', 15, 25, 180, 60),
        makeShape('other-id', 'Rectangle', '其他形状', 100, 100, 200, 100),
      ]),
    ];
    const ctx = makePptCtx(slides, sync);
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb(ctx)),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('找到 shapeId 返回 { ok: true, data: { id, type, text, left, top, width, height } }', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_shape', slideIndex: 1, shapeId: 'target-id' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as {
        id: string;
        type: string;
        text: string;
        left: number;
        top: number;
        width: number;
        height: number;
      };
      expect(data.id).toBe('target-id');
      expect(data.type).toBe('TextBox');
      expect(data.text).toBe('目标形状文本');
      expect(data.left).toBe(15);
      expect(data.top).toBe(25);
      expect(data.width).toBe(180);
      expect(data.height).toBe(60);
    }
  });

  it('shapeId 不存在返 NOT_FOUND（ok:false，不抛）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_shape', slideIndex: 1, shapeId: 'non-existent' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.recoverable).toBe(false);
      expect(result.error.message).toContain('non-existent');
      expect(result.error.hint).toBeTruthy();
    }
  });

  it('slideIndex 越界返 NOT_FOUND', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_shape', slideIndex: 99, shapeId: 'target-id' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_FOUND');
    }
  });

  it('PowerPoint.run 抛错时抛 HostApiError', async () => {
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async () => { throw new Error('shape error'); },
    );
    const adapter = new PptAdapter();
    await expect(
      adapter.read({ kind: 'get_shape', slideIndex: 1, shapeId: 'target-id' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// describe: selection_detail
// ---------------------------------------------------------------------------
describe('PptAdapter.read — selection_detail', () => {
  let sync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sync = vi.fn().mockResolvedValue(undefined);
    // 两张 slide（Web 反序），选中第一张
    const slides: MockSlide[] = [
      makeSlide(1, []),
      makeSlide(0, []),
    ];
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          presentation: {
            slides: {
              items: slides,
              load: vi.fn(),
            },
            getSelectedSlides: vi.fn(() => ({
              items: [slides[1]], // 选中 index=0 的 slide
              load: vi.fn(),
            })),
          },
          sync,
        };
        return cb(ctx);
      }),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('有选中 → 返回 { ok: true, data: { kind: "ppt", slideIndex, slideCount } }', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'selection_detail' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as { kind: string; slideIndex: number; slideCount: number };
      expect(data.kind).toBe('ppt');
      expect(data.slideIndex).toBe(1); // index=0 → slideIndex=1（1-based）
      expect(data.slideCount).toBe(2);
    }
  });

  it('无选中 → 返回 { ok: true, data: { kind: "none" } }', async () => {
    const slides2: MockSlide[] = [makeSlide(0, [])];
    const sync2 = vi.fn().mockResolvedValue(undefined);
    (global as unknown as { PowerPoint: { run: ReturnType<typeof vi.fn> } }).PowerPoint.run = vi.fn(
      async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            slides: { items: slides2, load: vi.fn() },
            getSelectedSlides: vi.fn(() => ({
              items: [], // 无选中
              load: vi.fn(),
            })),
          },
          sync: sync2,
        }),
    );
    const adapter = new PptAdapter();
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
describe('PptAdapter.read — default UNSUPPORTED', () => {
  beforeEach(() => {
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(),
    };
  });

  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it('未知 kind 返 { ok: false, error: { code: "UNSUPPORTED" } }（不抛）', async () => {
    const adapter = new PptAdapter();
    const result = await adapter.read({ kind: 'get_paragraph_count' } as Parameters<typeof adapter.read>[0]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED');
      expect(result.error.recoverable).toBe(false);
    }
  });
});
