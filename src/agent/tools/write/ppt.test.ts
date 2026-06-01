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
import {
  setShapeProperty,
  moveShape,
  setShapeText,
  setShapeTextAlignmentTool,
  rotateShapeTool,
  setSlideBackgroundTool,
  setShapeTextFontTool,
  addShapeTool,
  deleteShapeTool,
  manageSlidesTool,
  copySlideTool,
} from './ppt';

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

// ---------------------------------------------------------------------------
// 260531-m4x：3 个 spike 工具写后回读验证 → 诚实失败守门
// 核心断言：网页版静默 no-op（effective:false）→ ok:false + 无 reverse/postState
//   （不报假 ✅、不记 undo）；effective:true → ok:true + 真实逆向。
// 结构性 gate：杜绝「报成功但实际没生效」复发。
// ---------------------------------------------------------------------------

describe('PPT spike 工具写后回读验证 — 诚实失败守门（260531-m4x）', () => {
  describe('set_shape_text_alignment', () => {
    it('effective=true → ok:true + restore_shape_alignment（真实逆向 + postState）', async () => {
      const adapter = {
        setShapeTextAlignment: vi.fn().mockResolvedValue({ beforeAlignment: 'Left', effective: true }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setShapeTextAlignmentTool.execute(
        { slide_index: 1, shape_id: 's1', alignment: 'Center' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(true);
      expect(r.reverse?.tool).toBe('restore_shape_alignment');
      expect(r.reverse?.args).toMatchObject({ slide_index: 1, shape_id: 's1', before_alignment: 'Left' });
      expect(r.postState?.kind).toBe('ppt_shape_alignment');
    });

    it('effective=false（网页版 no-op）→ ok:false + 无 reverse/postState（不假成功、不记 undo）', async () => {
      const adapter = {
        setShapeTextAlignment: vi.fn().mockResolvedValue({ beforeAlignment: null, effective: false }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setShapeTextAlignmentTool.execute(
        { slide_index: 1, shape_id: 's1', alignment: 'Center' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(false);
      expect(r.reverse).toBeUndefined();
      expect(r.postState).toBeUndefined();
      expect(r.error?.code).toBe('UNSUPPORTED');
      expect(r.error?.message).toContain('未生效');
    });

    it('effective=true 但 beforeAlignment=null（混合对齐）→ ok:true + noop_inverse（生效但不可撤销）', async () => {
      const adapter = {
        setShapeTextAlignment: vi.fn().mockResolvedValue({ beforeAlignment: null, effective: true }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setShapeTextAlignmentTool.execute(
        { slide_index: 1, shape_id: 's1', alignment: 'Center' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(true);
      expect(r.reverse?.tool).toBe('noop_inverse');
    });
  });

  describe('rotate_shape', () => {
    it('effective=true → ok:true + restore_shape_rotation', async () => {
      const adapter = {
        rotateShape: vi.fn().mockResolvedValue({ beforeRotation: 0, effective: true }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await rotateShapeTool.execute(
        { slide_index: 1, shape_id: 's3', rotation: 45 } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(true);
      expect(r.reverse?.tool).toBe('restore_shape_rotation');
      expect(r.reverse?.args).toMatchObject({ slide_index: 1, shape_id: 's3', before_rotation: 0 });
    });

    it('effective=false（网页版 no-op）→ ok:false + 无 reverse/postState', async () => {
      const adapter = {
        rotateShape: vi.fn().mockResolvedValue({ beforeRotation: null, effective: false }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await rotateShapeTool.execute(
        { slide_index: 1, shape_id: 's3', rotation: 45 } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(false);
      expect(r.reverse).toBeUndefined();
      expect(r.postState).toBeUndefined();
      expect(r.error?.message).toContain('未生效');
    });

    it('humanLabel snake_case 正常（第 2 张/shape-07）', () => {
      const label = rotateShapeTool.humanLabel({ slide_index: 2, shape_id: 'shape-07', rotation: 45 } as never);
      expect(label).toContain('第 2 张');
      expect(label).toContain('shape-07');
      expect(label).not.toContain('undefined');
    });

    it('execute snake_case → 正确透传给 adapter', async () => {
      const fn = vi.fn().mockResolvedValue({ beforeRotation: 0, effective: true });
      const adapter = { rotateShape: fn, capabilities: () => ({ host: 'ppt' as const }) };
      await rotateShapeTool.execute(
        { slide_index: 2, shape_id: 'sx', rotation: 30 } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(fn).toHaveBeenCalledWith(2, 'sx', 30);
    });
  });

  describe('set_slide_background', () => {
    it('effective=true + beforeColor 非 null → ok:true + restore_slide_background', async () => {
      const adapter = {
        setSlideBackground: vi.fn().mockResolvedValue({ beforeColor: '#FFFFFF', effective: true }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setSlideBackgroundTool.execute(
        { slide_index: 1, color: '#1A73E8' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(true);
      expect(r.reverse?.tool).toBe('restore_slide_background');
      expect(r.reverse?.args).toMatchObject({ slide_index: 1, before_color: '#FFFFFF' });
      expect(r.postState?.kind).toBe('ppt_slide_background');
    });

    it('effective=true + beforeColor null（非纯色背景）→ restore_slide_background(before_color:null)（reset 路径，仍可撤销）', async () => {
      const adapter = {
        setSlideBackground: vi.fn().mockResolvedValue({ beforeColor: null, effective: true }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setSlideBackgroundTool.execute(
        { slide_index: 1, color: '#1A73E8' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(true);
      expect(r.reverse?.tool).toBe('restore_slide_background');
      expect(r.reverse?.args).toMatchObject({ slide_index: 1, before_color: null });
    });

    it('effective=false（type 未变 Solid / 宿主不支持 1.10）→ ok:false + 无 reverse/postState', async () => {
      const adapter = {
        setSlideBackground: vi.fn().mockResolvedValue({ beforeColor: null, effective: false }),
        capabilities: () => ({ host: 'ppt' as const }),
      };
      const r = await setSlideBackgroundTool.execute(
        { slide_index: 1, color: '#1A73E8' } as never,
        { adapter, ...mockCtx } as never,
      );
      expect(r.ok).toBe(false);
      expect(r.reverse).toBeUndefined();
      expect(r.postState).toBeUndefined();
      expect(r.error?.message).toContain('未生效');
    });
  });
});

// ---------------------------------------------------------------------------
// 260531-m4x（追加）：camelCase PPT 工具 snake/camel 键名容错守门
// 根因：这 5 个工具 schema 用 camelCase，但 dispatchTool 不做 schema 校验，
//   LLM 跟着 snake_case 同族工具（move_shape/set_shape_text）传 snake_case →
//   旧 execute camelCase 解构得 undefined → 失败（rotate 真机根因）。
// gate：断言传 snake_case key 时 execute 仍把正确值透传给 adapter（不再 undefined）。
// ---------------------------------------------------------------------------

describe('camelCase PPT 工具 snake/camel 键名容错（260531-m4x 追加）', () => {
  it('set_shape_text_font：snake_case → adapter 收到正确 slideIndex/shapeId（非 undefined）', async () => {
    const fn = vi.fn().mockResolvedValue({ beforeFont: { size: 12 } });
    const adapter = { setShapeTextFont: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const r = await setShapeTextFontTool.execute(
      { slide_index: 2, shape_id: 'sx', font: { size: 18 } } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith(2, 'sx', { size: 18 });
    expect(r.ok).toBe(true);
    const label = setShapeTextFontTool.humanLabel({ slide_index: 2, shape_id: 'sx', font: {} } as never);
    expect(label).not.toContain('undefined');
  });

  it('add_shape：snake_case → adapter 收到正确 slide_index/shape_type（非 undefined）', async () => {
    const fn = vi.fn().mockResolvedValue({ newShapeId: 'n1' });
    const adapter = { addShape: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const position = { left: 10, top: 20, width: 100, height: 50 };
    const r = await addShapeTool.execute(
      { slide_index: 3, shape_type: 'TextBox', position, text: '季度总结' } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith(3, 'TextBox', position, '季度总结');
    expect(r.ok).toBe(true);
    const label = addShapeTool.humanLabel({ slide_index: 3, shape_type: 'TextBox', text: '季度总结' } as never);
    expect(label).toContain('第 3 张');
    expect(label).not.toContain('undefined');
  });

  it('delete_shape：snake_case → adapter 收到正确 slideIndex/shapeId（非 undefined）', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const adapter = { deleteShape: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const r = await deleteShapeTool.execute(
      { slide_index: 2, shape_id: 'sx' } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith(2, 'sx');
    expect(r.ok).toBe(true);
    const label = deleteShapeTool.humanLabel({ slide_index: 2, shape_id: 'sx' } as never);
    expect(label).toContain('第 2 张');
    expect(label).toContain('sx');
    expect(label).not.toContain('undefined');
  });

  it('manage_slides：snake_case → adapter 收到正确 operation/slideIndex（非 undefined）', async () => {
    const fn = vi.fn().mockResolvedValue({});
    const adapter = { manageSlides: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const r = await manageSlidesTool.execute(
      { operation: 'delete', slide_index: 3 } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith('delete', 3);
    expect(r.ok).toBe(true);
    const label = manageSlidesTool.humanLabel({ operation: 'delete', slide_index: 3 } as never);
    expect(label).toContain('第 3 张');
    expect(label).not.toContain('undefined');
  });

  it('copy_slide：snake_case → adapter 收到正确 sourceIndex/targetIndex（非 undefined）', async () => {
    const fn = vi.fn().mockResolvedValue({ capturedId: 'c1', capturedIndex: 5 });
    const adapter = { copySlide: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const r = await copySlideTool.execute(
      { source_index: 1, target_index: 4 } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith(1, 4);
    expect(r.ok).toBe(true);
    const label = copySlideTool.humanLabel({ source_index: 1, target_index: 4 } as never);
    expect(label).toContain('第 1 张');
    expect(label).toContain('位置 4');
    expect(label).not.toContain('undefined');
  });

  it('snake_case schema 正常透传（不回归）', async () => {
    const fn = vi.fn().mockResolvedValue({ newShapeId: 'n1' });
    const adapter = { addShape: fn, capabilities: () => ({ host: 'ppt' as const }) };
    const position = { left: 0, top: 0, width: 50, height: 50 };
    await addShapeTool.execute(
      { slide_index: 7, shape_type: 'Rectangle', position } as never,
      { adapter, ...mockCtx } as never,
    );
    expect(fn).toHaveBeenCalledWith(7, 'Rectangle', position, undefined);
  });
});
