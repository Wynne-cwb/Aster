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

  it('调 slides.add() + 把 title 写入新 slide（addTextBox），返回 insertedIndex + 写入的 title', async () => {
    const mockAdd = vi.fn();
    const mockAddTextBox = vi.fn();

    // sync 1 前 = 2 张已有 slide；add 后 sync 2 切换到 3 张（新 slide = s3，含 addTextBox）
    let syncCallCount = 0;
    const slides = {
      load: vi.fn(),
      items: [
        { id: 's1', index: 0 },
        { id: 's2', index: 1 },
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
              Object.assign(slides, {
                items: [
                  { id: 's1', index: 0 },
                  { id: 's2', index: 1 },
                  { id: 's3', index: 2, shapes: { addTextBox: mockAddTextBox } },
                ],
              });
            }
          }),
        };
        return cb(ctx);
      }),
    };

    const adapter = new PptAdapter();
    const result = await adapter.insertSlideAfter(1, '测试标题');
    expect(mockAdd).toHaveBeenCalledTimes(1);
    // title 真正写入新 slide（解 05-10 SC1b：旧 PoC 忽略 title 导致撤销失败）
    expect(mockAddTextBox).toHaveBeenCalledTimes(1);
    expect(mockAddTextBox.mock.calls[0][0]).toBe('测试标题');
    // 指纹 = 写入的 title（供 deleteSlideByTitle 定位）
    expect(result).toEqual({ insertedIndex: 3, title: '测试标题' });
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

  it('title 写入前 trim（指纹与 deleteSlideByTitle normalizeText 比对一致）', async () => {
    const mockAddTextBox = vi.fn();
    let syncCallCount = 0;
    const slides = { load: vi.fn(), items: [{ id: 's1', index: 0 }], add: vi.fn() };

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          presentation: { slides },
          sync: vi.fn().mockImplementation(async () => {
            syncCallCount++;
            if (syncCallCount >= 2) {
              Object.assign(slides, {
                items: [
                  { id: 's1', index: 0 },
                  { id: 's2', index: 1, shapes: { addTextBox: mockAddTextBox } },
                ],
              });
            }
          }),
        };
        return cb(ctx);
      }),
    };

    const adapter = new PptAdapter();
    const result = await adapter.insertSlideAfter(0, '  带空格标题  ');
    expect(mockAddTextBox.mock.calls[0][0]).toBe('带空格标题');
    expect(result.title).toBe('带空格标题');
  });

  it('未提供 title 时不调 addTextBox，返回空 title', async () => {
    const mockAddTextBox = vi.fn();
    let syncCallCount = 0;
    const slides = { load: vi.fn(), items: [{ id: 's1', index: 0 }], add: vi.fn() };

    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const ctx = {
          presentation: { slides },
          sync: vi.fn().mockImplementation(async () => {
            syncCallCount++;
            if (syncCallCount >= 2) {
              Object.assign(slides, {
                items: [
                  { id: 's1', index: 0 },
                  { id: 's2', index: 1, shapes: { addTextBox: mockAddTextBox } },
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
    expect(mockAddTextBox).not.toHaveBeenCalled();
    expect(result).toEqual({ insertedIndex: 2, title: '' });
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

  it('空 placeholder 在前 + 标题文本框在后 → 跳过空形状仍能匹配删除（05-10 新 slide 撤销根因）', async () => {
    // 新建 slide 常带空 placeholder；旧逻辑在首个文本形状（空）上 break → 永远匹配不到
    // addTextBox 写入的标题 → 撤销失败。新逻辑取「第一个非空文本形状首行」。
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
                      // 空 placeholder 在前（新建 slide 默认布局）
                      { type: 'Placeholder', textFrame: { textRange: { load: vi.fn(), text: '' } } },
                      // addTextBox 写入的标题在后
                      { type: 'TextBox', textFrame: { textRange: { load: vi.fn(), text: '测试标题' } } },
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
    await adapter.deleteSlideByTitle({ titleFingerprint: '测试标题' });
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 260531-m4x：写后回读验证（adapter 级） — 网页版静默 no-op → effective:false
// 直接验证「写入 + 回读目标属性 + 与意图值比对」核心修复逻辑：
//   - 对齐用正确属性名 paragraphFormat.horizontalAlignment（非 .alignment）
//   - 背景用正确 API fill.setSolidFill + 回读 fill.type==='Solid'
//   - 旋转回读 shape.rotation 数值比对
// no-op 用「setter 不改值」的 mock 模拟（真机网页版静默忽略写入）。
// ---------------------------------------------------------------------------

/** 单 slide + 单 shape 的 PowerPoint mock；shape/background 由调用方构造（含可控 setter）。 */
function setPptMock(shape: Record<string, unknown> | null, background?: Record<string, unknown>): void {
  const slide: Record<string, unknown> = {
    index: 0,
    shapes: { load: vi.fn(), items: shape ? [shape] : [] },
  };
  if (background) slide.background = background;
  (global as unknown as Record<string, unknown>).PowerPoint = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        presentation: { slides: { load: vi.fn(), items: [slide] } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

describe('PptAdapter.setShapeTextAlignment 写后回读验证（260531-m4x）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it('写入生效（回读 horizontalAlignment === 目标）→ effective:true + 真实 beforeAlignment', async () => {
    // 普通对象：setter 真正赋值 → 回读得新值（模拟桌面版/真生效）
    const pf: Record<string, unknown> = { load: vi.fn(), horizontalAlignment: 'Left' };
    const shape = { id: 's1', type: 'TextBox', textFrame: { textRange: { load: vi.fn(), paragraphFormat: pf } } };
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.setShapeTextAlignment(1, 's1', 'Center');
    expect(r).toEqual({ beforeAlignment: 'Left', effective: true });
    expect(pf.horizontalAlignment).toBe('Center'); // 确认写的是 horizontalAlignment（非 .alignment）
  });

  it('网页版静默 no-op（setter 不改值，回读仍旧值）→ effective:false（不假成功）', async () => {
    const pf: Record<string, unknown> = { load: vi.fn() };
    Object.defineProperty(pf, 'horizontalAlignment', { get: () => 'Left', set: () => {}, configurable: true });
    const shape = { id: 's1', type: 'TextBox', textFrame: { textRange: { load: vi.fn(), paragraphFormat: pf } } };
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.setShapeTextAlignment(1, 's1', 'Center');
    expect(r.effective).toBe(false);
  });

  it('小写 alignment 归一化为枚举值（left → Left）后写入', async () => {
    const pf: Record<string, unknown> = { load: vi.fn(), horizontalAlignment: 'Center' };
    const shape = { id: 's1', type: 'TextBox', textFrame: { textRange: { load: vi.fn(), paragraphFormat: pf } } };
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.setShapeTextAlignment(1, 's1', 'left');
    expect(pf.horizontalAlignment).toBe('Left');
    expect(r.effective).toBe(true);
  });

  it('网页版回读不到（写后回读 null）→ effective:true（260601-dul 修复假失败，核心新增）', async () => {
    // 真机网页版：写成功了，但回读 horizontalAlignment 得 null/读不到 → 旧逻辑误判假失败。
    let val: string | null = 'Left';
    const pf: Record<string, unknown> = { load: vi.fn() };
    Object.defineProperty(pf, 'horizontalAlignment', {
      get: () => val,
      set: () => { val = null; }, // 写入后回读得 null（网页版回读不可靠）
      configurable: true,
    });
    const shape = { id: 's1', type: 'TextBox', textFrame: { textRange: { load: vi.fn(), paragraphFormat: pf } } };
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.setShapeTextAlignment(1, 's1', 'Center');
    expect(r.effective).toBe(true); // 不再冤枉真生效
    expect(r.beforeAlignment).toBe('Left'); // 写前旧值仍正确捕获
  });
});

describe('PptAdapter.rotateShape 写后回读验证（260531-m4x）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it('写入生效（回读 rotation ≈ 目标）→ effective:true + beforeRotation', async () => {
    const shape: Record<string, unknown> = { id: 's3', rotation: 0, load: vi.fn() };
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.rotateShape(1, 's3', 45);
    expect(r).toEqual({ beforeRotation: 0, effective: true });
    expect(shape.rotation).toBe(45);
  });

  it('网页版静默 no-op（rotation 不变）→ effective:false', async () => {
    const shape: Record<string, unknown> = { id: 's3', load: vi.fn() };
    Object.defineProperty(shape, 'rotation', { get: () => 0, set: () => {}, configurable: true });
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.rotateShape(1, 's3', 45);
    expect(r.effective).toBe(false);
  });

  it('网页版回读不到（写后回读 null）→ effective:true（260601-dul 修复假失败，核心新增）', async () => {
    let rot: number | null = 0;
    const shape: Record<string, unknown> = { id: 's3', load: vi.fn() };
    Object.defineProperty(shape, 'rotation', {
      get: () => rot,
      set: () => { rot = null; }, // 写后回读得 null
      configurable: true,
    });
    setPptMock(shape);
    const adapter = new PptAdapter();
    const r = await adapter.rotateShape(1, 's3', 45);
    expect(r.effective).toBe(true); // 不再冤枉真生效
    expect(r.beforeRotation).toBe(0);
  });
});

describe('PptAdapter.setSlideBackground 写后回读验证（260531-m4x）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  it('写入生效（setSolidFill 后 type==="Solid"）→ effective:true + 捕获旧纯色', async () => {
    const fill: Record<string, unknown> = {
      load: vi.fn(),
      type: 'Solid',
      setSolidFill: vi.fn(function (this: void) { (fill as { type: string }).type = 'Solid'; }),
      getSolidFillOrNullObject: vi.fn(() => ({ load: vi.fn(), color: '#FFFFFF', isNullObject: false })),
    };
    setPptMock(null, { fill, reset: vi.fn() });
    const adapter = new PptAdapter();
    const r = await adapter.setSlideBackground(1, '#1A73E8');
    expect(r).toEqual({ beforeColor: '#FFFFFF', effective: true });
    expect(fill.setSolidFill).toHaveBeenCalledWith({ color: '#1A73E8' }); // 正确 API（非 setSolidColor）
  });

  it('网页版静默 no-op（setSolidFill 无效，type 未变 Solid）→ effective:false（不假成功）', async () => {
    const fill: Record<string, unknown> = {
      load: vi.fn(),
      type: 'Gradient',
      setSolidFill: vi.fn(), // no-op：type 保持 Gradient
      getSolidFillOrNullObject: vi.fn(() => ({ load: vi.fn(), color: '', isNullObject: true })),
    };
    setPptMock(null, { fill, reset: vi.fn() });
    const adapter = new PptAdapter();
    const r = await adapter.setSlideBackground(1, '#1A73E8');
    expect(r).toEqual({ beforeColor: null, effective: false });
  });

  it('网页版回读不到（写后回读 fill.type 读不到）→ effective:true（260601-dul 修复假失败，核心新增）', async () => {
    // 真机网页版：setSolidFill 写成功，但回读 fill.type 得 null/读不到 → 旧逻辑误判假失败。
    let typeVal: string | null = 'Gradient';
    const fill: Record<string, unknown> = {
      load: vi.fn(),
      setSolidFill: vi.fn(() => { typeVal = null; }), // 写后回读 type 读不到
      getSolidFillOrNullObject: vi.fn(() => ({ load: vi.fn(), color: '', isNullObject: true })),
    };
    Object.defineProperty(fill, 'type', {
      get: () => typeVal,
      set: (v: string | null) => { typeVal = v; },
      configurable: true,
    });
    setPptMock(null, { fill, reset: vi.fn() });
    const adapter = new PptAdapter();
    const r = await adapter.setSlideBackground(1, '#1A73E8');
    expect(r.effective).toBe(true); // 不再冤枉真生效（旧逻辑此处会报假失败）
    expect(r.beforeColor).toBe(null);
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

// ---------------------------------------------------------------------------
// applySlideLayout — 非法 GeometricShapeType + 孤儿页事务性清理（260604-fzn / UAT-1）
//
// 守门双管：① mock 镜像真机——addGeometricShape 收到非法 GeometricShapeType 抛 "invalid argument"
//   （不再对坏 shapeType 放假绿，关闭 mock-vs-real gap）；② 失败时新页（sync 3 已捕双定位指纹）
//   被独立 PowerPoint.run 删掉（复用 deleteSlideByIndex），不留孤儿页、不掩盖原错误。
// ---------------------------------------------------------------------------

describe('PptAdapter.applySlideLayout 非法形状 + 孤儿页清理（260604-fzn）', () => {
  afterEach(() => {
    delete (global as unknown as Record<string, unknown>).PowerPoint;
    vi.restoreAllMocks();
  });

  // mock 镜像真机：Aster 工具能合法产出的 GeometricShapeType 子集；其余抛 invalid argument
  const VALID_GEO = new Set(['Rectangle', 'RoundRectangle', 'Ellipse', 'Triangle', 'RightTriangle', 'Diamond', 'Pentagon', 'Hexagon', 'RightArrow']);

  /** 装配 global.PowerPoint：新页 = 'slide-new'（index 0），addGeometricShape 校验枚举。 */
  function setupLayoutMock() {
    const deleteSpy = vi.fn();
    const addGeometricShape = vi.fn((shapeType: string) => {
      if (!VALID_GEO.has(shapeType)) {
        throw new Error(`Invalid argument: '${shapeType}' is not a valid PowerPoint.GeometricShapeType`);
      }
      return {
        load: vi.fn(),
        id: 'gs-1',
        type: 'GeometricShape',
        fill: { setSolidColor: vi.fn() },
        lineFormat: { color: '', weight: 0, visible: false },
        textFrame: { textRange: { text: '', font: {}, paragraphFormat: {} } },
      };
    });
    const newSlide = {
      index: 0,
      id: 'slide-new',
      load: vi.fn(),
      delete: deleteSpy,
      shapes: {
        addTextBox: vi.fn(() => ({ load: vi.fn(), id: 'tb-1' })),
        addGeometricShape,
      },
    };
    const slides: { load: ReturnType<typeof vi.fn>; items: unknown[]; add: ReturnType<typeof vi.fn> } = {
      load: vi.fn(),
      items: [],
      add: vi.fn(() => { slides.items = [newSlide]; }),
    };
    (global as unknown as Record<string, unknown>).PowerPoint = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
        cb({ presentation: { slides }, sync: vi.fn().mockResolvedValue(undefined) }),
      ),
    };
    return { deleteSpy, addGeometricShape };
  }

  it('合法 RoundRectangle（KPI 色块）→ 成功建页，addGeometricShape 收合法值，不触发清理', async () => {
    const { deleteSpy, addGeometricShape } = setupLayoutMock();
    const adapter = new PptAdapter();
    const r = await adapter.applySlideLayout([
      { shapeType: 'RoundRectangle', rect: { left: 0, top: 0, width: 100, height: 80 }, text: '120%', fillColor: '#009887', font: { size: 28, bold: true, color: '#FFFFFF' }, align: 'Center' },
    ]);
    expect(addGeometricShape).toHaveBeenCalledWith('RoundRectangle', expect.anything());
    expect(r.capturedId).toBe('slide-new');
    expect(r.capturedIndex).toBe(0);
    expect(r.slideIndex).toBe(1);
    expect(deleteSpy).not.toHaveBeenCalled(); // 成功路径不清理
  });

  it('非法 RoundedRectangle → 抛 HostApiError 且删掉半成品孤儿页（事务性清理）', async () => {
    const { deleteSpy } = setupLayoutMock();
    const adapter = new PptAdapter();
    await expect(
      adapter.applySlideLayout([
        // 故意传非法值（adapter 边界收 shapeType:string；真机会抛 invalid argument）——守门确认会被清理而非静默 ok=false
        { shapeType: 'RoundedRectangle', rect: { left: 0, top: 0, width: 100, height: 80 }, fillColor: '#009887' },
      ]),
    ).rejects.toBeInstanceOf(HostApiError);
    // 孤儿页（slide-new）经独立 PowerPoint.run 删除一次（复用 deleteSlideByIndex 双定位）
    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
