/**
 * src/agent/tools/write/ppt.test.ts — Phase 6 Wave 0 测试桩
 *
 * 覆盖 3 个 PPT write tool 的 inverse descriptor 形状：
 *   - set_shape_property：reverse.tool === 'restore_shape_property'，reverse.args 含完整 before-image（Record 对象）
 *   - move_shape：reverse.tool === 'restore_shape_geometry'，reverse.args 含 slide_index/shape_id/left/top（Record 对象）
 *   - set_shape_text（TOOL-03 P1）：reverse.tool === 'restore_shape_text'，reverse.args 含 before_text 字段（Record 对象）
 *
 * Wave 0 说明：
 *   - Wave 2/3 实现就位前，以 describe.skip 包裹，保证 npm test 不因模块缺失而 ERROR
 *   - Wave 2/3 实现后取消 skip，跑真正 RED→GREEN 节奏
 *
 * Analog 来源：
 *   - src/adapters/PptAdapter.test.ts（PPT mock + assert 范式 lines 28-77）
 *   - src/agent/tools/write/ppt.ts（insertSlide 完整范式，模板）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock 工厂（仿 PptAdapter.test.ts 范式）
// ---------------------------------------------------------------------------

interface MockShape {
  id: string;
  type: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fill: {
    load: ReturnType<typeof vi.fn>;
    type: string;
    foregroundColor: string;
    setSolidColor: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  lineFormat: {
    load: ReturnType<typeof vi.fn>;
    color: string;
    weight: number;
    visible: boolean;
  };
  textFrame: {
    textRange: {
      load: ReturnType<typeof vi.fn>;
      text: string;
    };
  };
}

function mockPptWithShape(shapeId: string, initial: {
  fillType?: string;
  fillColor?: string;
  lineColor?: string;
  lineWeight?: number;
  lineVisible?: boolean;
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  text?: string;
}): MockShape {
  const shape: MockShape = {
    id: shapeId,
    type: 'Rectangle',
    left: initial.left ?? 100,
    top: initial.top ?? 150,
    width: initial.width ?? 200,
    height: initial.height ?? 100,
    fill: {
      load: vi.fn(),
      type: initial.fillType ?? 'Solid',
      foregroundColor: initial.fillColor ?? '#FFFFFF',
      setSolidColor: vi.fn(),
      clear: vi.fn(),
    },
    lineFormat: {
      load: vi.fn(),
      color: initial.lineColor ?? '#000000',
      weight: initial.lineWeight ?? 1,
      visible: initial.lineVisible ?? true,
    },
    textFrame: {
      textRange: {
        load: vi.fn(),
        text: initial.text ?? '旧文字',
      },
    },
  };

  const slideItem = {
    shapes: {
      load: vi.fn(),
      items: [shape],
    },
  };

  const slides = {
    load: vi.fn(),
    items: [slideItem],
  };

  (global as unknown as Record<string, unknown>).PowerPoint = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        presentation: { slides },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };

  return shape;
}

// ---------------------------------------------------------------------------
// set_shape_property（Wave 2/3 解锁）
// ---------------------------------------------------------------------------

describe.skip('set_shape_property — Wave 2/3 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPptWithShape('shape-001', {
      fillType: 'Solid',
      fillColor: '#FFFFFF',
      lineColor: '#000000',
      lineWeight: 1,
      lineVisible: true,
      width: 200,
      height: 100,
    });
  });

  it('execute 返回 reverse.tool === "restore_shape_property"', async () => {
    // import { setShapeProperty } from './ppt';
    //
    // const mockAdapter = {
    //   setShapeProperty: vi.fn().mockResolvedValue({
    //     beforeImage: {
    //       fillType: 'Solid', fillColor: '#FFFFFF',
    //       lineColor: '#000000', lineWeight: 1, lineVisible: true,
    //       width: 200, height: 100,
    //     },
    //   }),
    //   capabilities: () => ({ host: 'ppt' as const }),
    // };
    // const result = await setShapeProperty.execute(
    //   { slide_index: 1, shape_id: 'shape-001', line_color: '#FF0000' },
    //   { adapter: mockAdapter } as never,
    // );
    // expect(result.reverse?.tool).toBe('restore_shape_property');
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });

  it('reverse.args 是 Record 对象，含完整 before-image 字段（fill+line+geometry）', async () => {
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   slide_index: 1,
    //   shape_id: 'shape-001',
    //   fill_type: 'Solid',
    //   fill_color: '#FFFFFF',
    //   line_color: '#000000',
    //   line_weight: 1,
    //   line_visible: true,
    //   width: 200,
    //   height: 100,
    // });
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });

  it('postState.kind === "ppt_shape"', async () => {
    // expect(result.postState?.kind).toBe('ppt_shape');
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// move_shape（Wave 2/3 解锁）
// ---------------------------------------------------------------------------

describe.skip('move_shape — Wave 2/3 解锁', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPptWithShape('shape-001', { left: 100, top: 150 });
  });

  it('execute 返回 reverse.tool === "restore_shape_geometry"', async () => {
    // import { moveShape } from './ppt';
    //
    // const mockAdapter = {
    //   moveShape: vi.fn().mockResolvedValue({ beforeLeft: 100, beforeTop: 150 }),
    //   capabilities: () => ({ host: 'ppt' as const }),
    // };
    // const result = await moveShape.execute(
    //   { slide_index: 1, shape_id: 'shape-001', left: 200, top: 300 },
    //   { adapter: mockAdapter } as never,
    // );
    // expect(result.reverse?.tool).toBe('restore_shape_geometry');
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });

  it('reverse.args 是 Record 对象，含 slide_index/shape_id/left/top（before-image）', async () => {
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   slide_index: expect.any(Number),
    //   shape_id: 'shape-001',
    //   left: 100,
    //   top: 150,
    // });
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// set_shape_text（TOOL-03 P1）— Wave 2/3 解锁
// inverse before-image 守门：restore_shape_text + before_text 字段
// ---------------------------------------------------------------------------

describe.skip('set_shape_text — Wave 2/3 解锁（TOOL-03 P1 inverse 守门）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPptWithShape('shape-001', { text: '旧文字' });
  });

  it('before-image text restore — reverse descriptor 含 before_text', async () => {
    // import { setShapeText } from './ppt';
    //
    const mockAdapter = {
      setShapeText: vi.fn().mockResolvedValue({ beforeText: '旧文字' }),
      capabilities: () => ({ host: 'ppt' as const }),
    };
    // const result = await setShapeText.execute(
    //   { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
    //   { adapter: mockAdapter } as never,
    // );

    // Wave 2/3 实现后断言（当前仅验证 mock 结构）：
    const adapterResult = await mockAdapter.setShapeText({ slide_index: 1, shape_id: 'shape-001', text: '新文字' });
    expect(adapterResult.beforeText).toBe('旧文字');

    // 以下断言 Wave 2/3 解锁后打开：
    // expect(result.reverse?.tool).toBe('restore_shape_text');
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   slide_index: expect.any(Number),
    //   shape_id: expect.any(String),
    //   before_text: '旧文字',
    // });
    // expect(result.postState?.kind).toBe('ppt_shape');
    expect(true).toBe(true); // 占位确认 mock 结构正确
  });

  it('reverse.tool === "restore_shape_text"（关键命名守门）', async () => {
    // const result = await setShapeText.execute(
    //   { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
    //   { adapter: mockAdapter } as never,
    // );
    // expect(result.reverse?.tool).toBe('restore_shape_text');
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });

  it('reverse.args 是 Record 对象（非位置参），含 slide_index + shape_id + before_text', async () => {
    // Record 对象守门（防 Phase 5 UAT 地雷复发）：
    // expect(typeof result.reverse?.args).toBe('object');
    // expect(result.reverse?.args).toMatchObject({
    //   slide_index: expect.any(Number),
    //   shape_id: expect.any(String),
    //   before_text: '旧文字',
    // });
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });

  it('postState.kind === "ppt_shape"', async () => {
    // expect(result.postState?.kind).toBe('ppt_shape');
    expect(true).toBe(true); // 占位：Wave 2/3 解锁后替换
  });
});
