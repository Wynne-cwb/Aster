/**
 * src/adapters/PptAdapter.test.ts — Phase 5 Plan 01 Wave 0 inverse mock stubs
 *
 * 测试 insertSlideAfter + deleteSlideByTitle 方法（Wave 2c 实现后变绿）。
 * Wave 0 阶段：方法未实现 → 用 it.todo 占位，编译通过，不报错。
 *
 * 设计（CARRY-03 / AGENT-10）：
 * - insertSlideAfter(afterIndex) → 调 PowerPoint.run + slides.add()，返回 { insertedIndex, title }
 * - deleteSlideByTitle(title) → 按 title 匹配 slide 并 slide.delete()，找不到抛 HostApiError
 *
 * Office.js 依赖全部 mock（PowerPoint.run = vi.fn()），不调真实 Office API。
 * 范式参照 WordAdapter.test.ts 的 Word.run mock 模式。
 *
 * PPT-05 守则：getSelectedSlides().items 按 .index 排序（绕 Web 反序 bug #3618）。
 * A-06：proxy 不出 PowerPoint.run 闭包。
 * T-04-11：catch → HostApiError，不存 hostError（防 stack 泄漏）。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { PptAdapter } from './PptAdapter';
import { HostApiError } from '../errors';

// ---------------------------------------------------------------------------
// insertSlideAfter — Wave 2c stubs
// ---------------------------------------------------------------------------

describe('PptAdapter.insertSlideAfter（Wave 2c stubs）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
  });

  it.todo('insertSlideAfter 调 PowerPoint.run + slides.add()，返回 insertedIndex + title（Wave 2c 实现后展开）');
  // const mockSlidesAdd = vi.fn();
  // const sync = vi.fn().mockResolvedValue(undefined);
  // (global as unknown as Record<string, unknown>).PowerPoint = {
  //   run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
  //     cb({
  //       presentation: {
  //         slides: {
  //           load: vi.fn(),
  //           items: [
  //             { id: 's1', index: 0 },
  //             { id: 's2', index: 1 },
  //           ],
  //           add: mockSlidesAdd,
  //         },
  //       },
  //       sync,
  //     }),
  //   ),
  // };
  // const adapter = new PptAdapter();
  // const result = await adapter.insertSlideAfter(1); // after slide at index 1 (1-based)
  // expect(mockSlidesAdd).toHaveBeenCalledTimes(1);
  // expect(result).toMatchObject({ insertedIndex: expect.any(Number), title: expect.any(String) });

  it.todo('PowerPoint.run 报错 → HostApiError（Wave 2c 实现后展开）');
  // (global as unknown as Record<string, unknown>).PowerPoint = {
  //   run: vi.fn(async () => { throw new Error('ppt api error'); }),
  // };
  // const adapter = new PptAdapter();
  // await expect(adapter.insertSlideAfter(1)).rejects.toBeInstanceOf(HostApiError);
});

// ---------------------------------------------------------------------------
// deleteSlideByTitle — Wave 2c stubs
// ---------------------------------------------------------------------------

describe('PptAdapter.deleteSlideByTitle（Wave 2c stubs）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it.todo('deleteSlideByTitle 找到匹配 title 时调用 slide.delete()（Wave 2c 实现后展开）');
  // const mockDelete = vi.fn();
  // const sync = vi.fn().mockResolvedValue(undefined);
  // (global as unknown as Record<string, unknown>).PowerPoint = {
  //   run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
  //     cb({
  //       presentation: {
  //         slides: {
  //           load: vi.fn(),
  //           items: [
  //             // 每个 slide mock 含 shapes.items（用于 title 提取）
  //             {
  //               id: 's1',
  //               index: 0,
  //               shapes: {
  //                 load: vi.fn(),
  //                 items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '目标 Slide' } } }],
  //               },
  //               delete: mockDelete,
  //             },
  //             {
  //               id: 's2',
  //               index: 1,
  //               shapes: {
  //                 load: vi.fn(),
  //                 items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '其他 Slide' } } }],
  //               },
  //               delete: vi.fn(),
  //             },
  //           ],
  //         },
  //       },
  //       sync,
  //     }),
  //   ),
  // };
  // const adapter = new PptAdapter();
  // await adapter.deleteSlideByTitle('目标 Slide');
  // expect(mockDelete).toHaveBeenCalledTimes(1);

  it.todo('deleteSlideByTitle 找不到 title → 抛 HostApiError（Wave 2c 实现后展开）');
  // (global as unknown as Record<string, unknown>).PowerPoint = {
  //   run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
  //     cb({
  //       presentation: {
  //         slides: {
  //           load: vi.fn(),
  //           items: [
  //             {
  //               id: 's1',
  //               index: 0,
  //               shapes: { load: vi.fn(), items: [{ type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '不相关' } } }] },
  //               delete: vi.fn(),
  //             },
  //           ],
  //         },
  //       },
  //       sync: vi.fn().mockResolvedValue(undefined),
  //     }),
  //   ),
  // };
  // const adapter = new PptAdapter();
  // await expect(adapter.deleteSlideByTitle('不存在的 Slide')).rejects.toBeInstanceOf(HostApiError);
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
