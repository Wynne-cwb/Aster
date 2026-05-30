/**
 * src/agent/tools/write/ppt.test.ts — Phase 6 Wave 3 测试（解锁）
 *
 * 覆盖 3 个 PPT write tool 的 inverse descriptor 形状：
 *   - set_shape_property：reverse.tool === 'restore_shape_property'，reverse.args 含完整 before-image（Record 对象）
 *   - move_shape：reverse.tool === 'restore_shape_geometry'，reverse.args 含 slide_index/shape_id/left/top（Record 对象）
 *   - set_shape_text（TOOL-03 P1）：reverse.tool === 'restore_shape_text'，reverse.args 含 before_text 字段（Record 对象）
 *
 * Analog 来源：
 *   - src/adapters/PptAdapter.test.ts（PPT mock + assert 范式 lines 28-77）
 *   - src/agent/tools/write/ppt.ts（insertSlide 完整范式，模板）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setShapeProperty, moveShape, setShapeText } from './ppt';

// ---------------------------------------------------------------------------
// Mock 工厂（仿 PptAdapter.test.ts 范式）
// ---------------------------------------------------------------------------

function makeMockAdapter(overrides: {
  setShapeProperty?: ReturnType<typeof vi.fn>;
  moveShape?: ReturnType<typeof vi.fn>;
  setShapeText?: ReturnType<typeof vi.fn>;
}) {
  return {
    setShapeProperty: overrides.setShapeProperty ?? vi.fn().mockResolvedValue({
      beforeImage: {
        fillType: 'Solid',
        fillColor: '#FFFFFF',
        lineColor: '#000000',
        lineWeight: 1,
        lineVisible: true,
        width: 200,
        height: 100,
      },
    }),
    moveShape: overrides.moveShape ?? vi.fn().mockResolvedValue({
      beforeLeft: 100,
      beforeTop: 150,
    }),
    setShapeText: overrides.setShapeText ?? vi.fn().mockResolvedValue({
      beforeText: '旧文字',
    }),
    capabilities: () => ({ host: 'ppt' as const }),
  };
}

const mockCtx = {
  runId: 'run-001',
  stepIndex: 0,
  signal: { aborted: false } as AbortSignal,
};

// ---------------------------------------------------------------------------
// set_shape_property
// ---------------------------------------------------------------------------

describe('set_shape_property', () => {
  let mockAdapter: ReturnType<typeof makeMockAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = makeMockAdapter({});
  });

  it('execute 返回 ok=true', async () => {
    const result = await setShapeProperty.execute(
      { slide_index: 1, shape_id: 'shape-001', line_color: '#FF0000', line_weight: 2 },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('reverse.tool === "restore_shape_property"', async () => {
    const result = await setShapeProperty.execute(
      { slide_index: 1, shape_id: 'shape-001', line_color: '#FF0000' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.reverse?.tool).toBe('restore_shape_property');
  });

  it('reverse.args 是 Record 对象，含完整 before-image 字段（fill+line+geometry）', async () => {
    const result = await setShapeProperty.execute(
      { slide_index: 1, shape_id: 'shape-001', fill_color: '#FF0000' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(typeof result.reverse?.args).toBe('object');
    expect(result.reverse?.args).toMatchObject({
      slide_index: 1,
      shape_id: 'shape-001',
      fill_type: 'Solid',
      fill_color: '#FFFFFF',
      line_color: '#000000',
      line_weight: 1,
      line_visible: true,
      width: 200,
      height: 100,
    });
  });

  it('postState.kind === "ppt_shape"', async () => {
    const result = await setShapeProperty.execute(
      { slide_index: 1, shape_id: 'shape-001', line_color: '#FF0000' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.postState?.kind).toBe('ppt_shape');
  });

  it('humanLabel 含 slide_index 和 shape_id', () => {
    const label = setShapeProperty.humanLabel({
      slide_index: 2,
      shape_id: 'shape-007',
      line_color: '#FF0000',
      line_weight: 3,
    });
    expect(label).toContain('第 2 张幻灯片');
    expect(label).toContain('shape-007');
  });

  it('D-11 expected_state 传入 adapter（调用时透传）', async () => {
    const setShapePropertyMock = vi.fn().mockResolvedValue({
      beforeImage: {
        fillType: 'Solid', fillColor: '#FFFFFF',
        lineColor: null, lineWeight: null, lineVisible: false,
        width: 100, height: 50,
      },
    });
    mockAdapter = makeMockAdapter({ setShapeProperty: setShapePropertyMock });
    await setShapeProperty.execute(
      {
        slide_index: 1,
        shape_id: 'shape-001',
        fill_color: '#FF0000',
        expected_state: { fill_color: '#FFFFFF' },
      },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    // 第 4 个参数是 expectedState
    expect(setShapePropertyMock).toHaveBeenCalledWith(
      1, 'shape-001',
      expect.objectContaining({ fillColor: '#FF0000' }),
      expect.objectContaining({ fillColor: '#FFFFFF' }),
    );
  });
});

// ---------------------------------------------------------------------------
// move_shape
// ---------------------------------------------------------------------------

describe('move_shape', () => {
  let mockAdapter: ReturnType<typeof makeMockAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = makeMockAdapter({});
  });

  it('execute 返回 ok=true', async () => {
    const result = await moveShape.execute(
      { slide_index: 1, shape_id: 'shape-001', left: 200, top: 300 },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('reverse.tool === "restore_shape_geometry"', async () => {
    const result = await moveShape.execute(
      { slide_index: 1, shape_id: 'shape-001', left: 200, top: 300 },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.reverse?.tool).toBe('restore_shape_geometry');
  });

  it('reverse.args 是 Record 对象，含 slide_index/shape_id/left/top（before-image）', async () => {
    const result = await moveShape.execute(
      { slide_index: 1, shape_id: 'shape-001', left: 200, top: 300 },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(typeof result.reverse?.args).toBe('object');
    expect(result.reverse?.args).toMatchObject({
      slide_index: 1,
      shape_id: 'shape-001',
      left: 100,   // beforeLeft
      top: 150,    // beforeTop
    });
  });

  it('postState.kind === "ppt_shape"', async () => {
    const result = await moveShape.execute(
      { slide_index: 1, shape_id: 'shape-001', left: 200, top: 300 },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.postState?.kind).toBe('ppt_shape');
  });

  it('humanLabel 含移动目标坐标', () => {
    const label = moveShape.humanLabel({
      slide_index: 1,
      shape_id: 'shape-007',
      left: 50,
      top: 80,
    });
    expect(label).toContain('left=50');
    expect(label).toContain('top=80');
  });
});

// ---------------------------------------------------------------------------
// set_shape_text（TOOL-03 P1）
// inverse before-image 守门：restore_shape_text + before_text 字段
// ---------------------------------------------------------------------------

describe('set_shape_text（TOOL-03 P1 inverse 守门）', () => {
  let mockAdapter: ReturnType<typeof makeMockAdapter>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = makeMockAdapter({});
  });

  it('execute 返回 ok=true', async () => {
    const result = await setShapeText.execute(
      { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.ok).toBe(true);
  });

  it('before-image text restore — reverse descriptor 含 before_text', async () => {
    const result = await setShapeText.execute(
      { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.reverse?.args).toMatchObject({
      before_text: '旧文字',
    });
  });

  it('reverse.tool === "restore_shape_text"（关键命名守门）', async () => {
    const result = await setShapeText.execute(
      { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.reverse?.tool).toBe('restore_shape_text');
  });

  it('reverse.args 是 Record 对象（非位置参），含 slide_index + shape_id + before_text', async () => {
    const result = await setShapeText.execute(
      { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    // Record 对象守门（防 Phase 5 UAT 地雷复发）：
    expect(typeof result.reverse?.args).toBe('object');
    expect(result.reverse?.args).toMatchObject({
      slide_index: 1,
      shape_id: 'shape-001',
      before_text: '旧文字',
    });
  });

  it('postState.kind === "ppt_shape"', async () => {
    const result = await setShapeText.execute(
      { slide_index: 1, shape_id: 'shape-001', text: '新文字' },
      { adapter: mockAdapter, ...mockCtx } as never,
    );
    expect(result.postState?.kind).toBe('ppt_shape');
  });

  it('humanLabel 截断超长文字（> 20 字符 → 末尾 …）', () => {
    const longText = '这是一段超过二十个字符的很长很长的文字内容测试';
    const label = setShapeText.humanLabel({ slide_index: 1, shape_id: 'shape-001', text: longText });
    expect(label).toContain('…');
  });

  it('humanLabel 短文字不截断', () => {
    const shortText = '短文字';
    const label = setShapeText.humanLabel({ slide_index: 1, shape_id: 'shape-001', text: shortText });
    expect(label).not.toContain('…');
    expect(label).toContain('短文字');
  });
});
