/**
 * src/adapters/PptAdapter.test.ts — Phase 5 Plan 06 Wave 2c 完整 mock 单测
 *
 * 测试 insertSlideAfter + deleteSlideByTitle 方法。
 * Wave 0 阶段 it.todo 占位；Wave 2c 实现后展开为完整 mock 单测（GREEN）。
 *
 * 设计（CARRY-03 / AGENT-10）：
 * - insertSlideAfter(afterIndex, title?) → 调 PowerPoint.run + slides.add()，返回 { insertedIndex, title }
 * - deleteSlideByTitle(titleFingerprint) → 按 title 匹配 slide 并 slide.delete()，找不到抛 HostApiError
 *
 * Office.js 依赖全部 mock（PowerPoint.run = vi.fn()），不调真实 Office API。
 * 范式参照 WordAdapter.test.ts 的 vi.mock / vi.fn() 模式。
 *
 * PPT-05 守则：slides.items 按 .index 排序（绕 Web 反序 bug #3618）。
 * A-06：proxy 不出 PowerPoint.run 闭包。
 * T-04-11：catch → HostApiError，不存 hostError（防 stack 泄漏）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { PptAdapter } from './PptAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// insertSlideAfter — Wave 2c 完整 mock 单测
// ---------------------------------------------------------------------------

describe('PptAdapter.insertSlideAfter', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it('调 PowerPoint.run + slides.add()，返回 insertedIndex + title', async () => {
    const mockAdd = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);

    // 第一次 load: 返回 2 张已有 slide（insert 前）
    // 第二次 add 后 load: 返回 3 张 slide（新增在末尾）
    let syncCallCount = 0;
    const slidesBefore = {
      load: vi.fn(),
      items: [
        { id: 's1', index: 0 },
        { id: 's2', index: 1 },
      ],
      add: mockAdd,
    };
    const slidesAfter = {
      load: vi.fn(),
      items: [
        {
          id: 's1',
          index: 0,
          shapes: {
            load: vi.fn(),
            items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '旧 Slide 1' } } }],
          },
        },
        {
          id: 's2',
          index: 1,
          shapes: {
            load: vi.fn(),
            items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '旧 Slide 2' } } }],
          },
        },
        {
          id: 's3',
          index: 2,
          shapes: {
            load: vi.fn(),
            items: [], // 新 slide 无文本形状 → title = ''
          },
        },
      ],
      add: mockAdd,
    };

    // ctx.presentation.slides 在 sync 1 前返回 slidesBefore，sync 2 后（add 完）返回 slidesAfter
    const slides = slidesBefore;
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          presentation: {
            slides,
          },
          sync: vi.fn().mockImplementation(async () => {
            syncCallCount++;
            // sync 2 时（add 已调用），切换到 slidesAfter
            if (syncCallCount >= 2) {
              Object.assign(slides, slidesAfter);
            }
          }),
        };
        return cb(ctx);
      }),
    };

    const adapter = new PptAdapter();
    const result = await adapter.insertSlideAfter(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ insertedIndex: expect.any(Number), title: expect.any(String) });
  });

  it('PowerPoint.run 报错 → 包成 HostApiError', async () => {
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async () => {
        throw new Error('ppt api error');
      }),
    };
    const adapter = new PptAdapter();
    await expect(adapter.insertSlideAfter(1)).rejects.toBeInstanceOf(HostApiError);
  });

  it('新 slide 含文本形状时，title 为第一个文本形状首行', async () => {
    const mockAdd = vi.fn();
    let syncCallCount = 0;
    const slides = {
      load: vi.fn(),
      items: [
        { id: 's1', index: 0 },
      ],
      add: mockAdd,
    };

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          presentation: { slides },
          sync: vi.fn().mockImplementation(async () => {
            syncCallCount++;
            if (syncCallCount >= 2) {
              // 切换到 add 后 items（含有 title 的新 slide）
              Object.assign(slides, {
                items: [
                  {
                    id: 's1',
                    index: 0,
                    shapes: {
                      load: vi.fn(),
                      items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '原 Slide' } } }],
                    },
                  },
                  {
                    id: 's2',
                    index: 1,
                    shapes: {
                      load: vi.fn(),
                      items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '新 Slide 标题\n副标题' } } }],
                    },
                  },
                ],
              });
            }
          }),
        };
        return cb(ctx);
      }),
    };

    const adapter = new PptAdapter();
    const result = await adapter.insertSlideAfter(0);
    expect(result.title).toBe('新 Slide 标题');
  });
});

// ---------------------------------------------------------------------------
// deleteSlideByTitle — Wave 2c 完整 mock 单测
// ---------------------------------------------------------------------------

describe('PptAdapter.deleteSlideByTitle', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it('找到匹配 title 时调用 slide.delete()', async () => {
    const mockDelete = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            slides: {
              load: vi.fn(),
              items: [
                {
                  id: 's1',
                  index: 0,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        textFrame: { textRange: { load: vi.fn(), text: '目标 Slide' } },
                      },
                    ],
                  },
                  delete: mockDelete,
                },
                {
                  id: 's2',
                  index: 1,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        textFrame: { textRange: { load: vi.fn(), text: '其他 Slide' } },
                      },
                    ],
                  },
                  delete: vi.fn(),
                },
              ],
            },
          },
          sync,
        }),
      ),
    };

    const adapter = new PptAdapter();
    await adapter.deleteSlideByTitle({ titleFingerprint: '目标 Slide' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it('找不到 title → 抛 HostApiError', async () => {
    const sync = vi.fn().mockResolvedValue(undefined);

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            slides: {
              load: vi.fn(),
              items: [
                {
                  id: 's1',
                  index: 0,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        textFrame: { textRange: { load: vi.fn(), text: '不相关的 Slide' } },
                      },
                    ],
                  },
                  delete: vi.fn(),
                },
              ],
            },
          },
          sync,
        }),
      ),
    };

    const adapter = new PptAdapter();
    await expect(
      adapter.deleteSlideByTitle({ titleFingerprint: '不存在的 Slide' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });

  it('多张 slide 时从后往前遍历，只删最后一个匹配', async () => {
    const deleteFirst = vi.fn();
    const deleteSecond = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            slides: {
              load: vi.fn(),
              items: [
                {
                  id: 's1',
                  index: 0,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        textFrame: { textRange: { load: vi.fn(), text: '重名 Slide' } },
                      },
                    ],
                  },
                  delete: deleteFirst,
                },
                {
                  id: 's2',
                  index: 1,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        textFrame: { textRange: { load: vi.fn(), text: '重名 Slide' } },
                      },
                    ],
                  },
                  delete: deleteSecond,
                },
              ],
            },
          },
          sync,
        }),
      ),
    };

    const adapter = new PptAdapter();
    await adapter.deleteSlideByTitle({ titleFingerprint: '重名 Slide' });
    // 从后往前遍历，第一个匹配是 index=1（s2）→ deleteSecond 被调用
    expect(deleteSecond).toHaveBeenCalledTimes(1);
    expect(deleteFirst).not.toHaveBeenCalled();
  });

  it('PowerPoint.run 报错 → 包成 HostApiError', async () => {
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async () => {
        throw new Error('ppt delete error');
      }),
    };
    const adapter = new PptAdapter();
    await expect(
      adapter.deleteSlideByTitle({ titleFingerprint: '任意 Slide' }),
    ).rejects.toBeInstanceOf(HostApiError);
  });

  it('只匹配完整首行（title trim 比对）', async () => {
    const mockDelete = vi.fn();
    const sync = vi.fn().mockResolvedValue(undefined);

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({
          presentation: {
            slides: {
              load: vi.fn(),
              items: [
                {
                  id: 's1',
                  index: 0,
                  shapes: {
                    load: vi.fn(),
                    items: [
                      {
                        type: 'Placeholder',
                        // 带换行的文本，title 应取首行
                        textFrame: { textRange: { load: vi.fn(), text: '  目标标题  \n副标题内容' } },
                      },
                    ],
                  },
                  delete: mockDelete,
                },
              ],
            },
          },
          sync,
        }),
      ),
    };

    const adapter = new PptAdapter();
    // 指纹 = trim 后首行
    await adapter.deleteSlideByTitle({ titleFingerprint: '目标标题' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Structural smoke test — ensures PptAdapter class loads without error
// ---------------------------------------------------------------------------

describe('PptAdapter structural smoke test', () => {
  it('PptAdapter 类可实例化（构造器无副作用）', () => {
    expect(() => new PptAdapter()).not.toThrow();
  });

  it('capabilities() 返回 ppt host + supportedInserts 包含 slides', () => {
    const adapter = new PptAdapter();
    const caps = adapter.capabilities();
    expect(caps.host).toBe('ppt');
    expect(caps.supportedInserts).toContain('slides');
  });
});
