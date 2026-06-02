/**
 * src/agent/tools/write/ppt-image.test.ts — generate_ppt_image 行为测试
 *
 * 产品反转（2026-06-02）：工具改为 loop 内直接插入。覆盖：
 *   Test 1: ok:true + inserted:true + thumbnail/shape_id/slide_index 非空（直插成功）
 *   Test 2: reverse = { tool:'delete_shape_by_id', args:{slide_index, shape_id} }（标准 undo 路径）
 *   Test 3: aihubmix key 未配置 → ok:false + code=PERMISSION_DENIED
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generatePptImageTool } from './ppt-image';
import { KeyInvalidError } from '../../../errors';

// ---------------------------------------------------------------------------
// Mock：AihubmixImageClient（隔离网络调用）
// ---------------------------------------------------------------------------

vi.mock('../../../providers/aihubmix-image', () => ({
  AihubmixImageClient: vi.fn().mockImplementation(() => ({
    generate: vi.fn().mockResolvedValue({ base64: 'abc123', mimeType: 'image/png' }),
  })),
}));

// ---------------------------------------------------------------------------
// Mock：ProviderRegistry（成功路径：返回 image-gen 配置）
// ---------------------------------------------------------------------------

vi.mock('../../../providers/registry', () => ({
  ProviderRegistry: {
    resolve: vi.fn().mockReturnValue({
      providerId: 'aihubmix-image',
      baseURL: 'https://aihubmix.com',
      apiKey: 'test-key',
      model: 'doubao-seedream-5.0-lite',
    }),
  },
  IMAGE_GEN_MODELS: [
    {
      id: 'doubao-seedream-5.0-lite',
      label: 'Doubao SeedDream 5.0 Lite（快速默认）',
      endpointKind: 'predictions',
      authKind: 'bearer',
      isDefault: true,
    },
  ],
  DEFAULT_IMAGE_GEN_MODEL: { id: 'doubao-seedream-5.0-lite' },
}));

// ---------------------------------------------------------------------------
// describe.skip：Plan 16-03 实现 execute 后解除 skip
// ---------------------------------------------------------------------------

describe('generate_ppt_image tool（loop 内直插）', () => {
  // adapter mock：addImageShape 返回 newShapeId（直插成功）
  const addImageShape = vi.fn().mockResolvedValue({ newShapeId: 'shape-99' });
  const mockCtx = {
    adapter: { addImageShape } as never,
    runId: 'r-ppt-img',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    addImageShape.mockResolvedValue({ newShapeId: 'shape-99' });
  });

  // Test 1: 成功路径 — ok:true + inserted:true + thumbnail/shape_id/slide_index 非空
  it('Test 1: execute 直插成功 → ok:true + inserted:true + thumbnail/shape_id/slide_index', async () => {
    const { ProviderRegistry } = await import('../../../providers/registry');
    vi.mocked(ProviderRegistry.resolve).mockReturnValue({
      providerId: 'aihubmix-image',
      baseURL: 'https://aihubmix.com',
      apiKey: 'test-key',
      model: 'doubao-seedream-5.0-lite',
    } as never);

    const result = await generatePptImageTool.execute(
      { prompt: '一张落日的图', slide_index: 1 },
      mockCtx as never,
    );

    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.inserted).toBe(true);
    expect(data.thumbnail).toBeTruthy();   // NFR-09：仅 UI 只读消费
    expect(data.shape_id).toBe('shape-99'); // AI 后续 move_shape 用
    expect(data.slide_index).toBe(1);
    expect(data.mimeType).toBeTruthy();
    // 直插：addImageShape 被调用（裸 base64 + 居中位置）
    expect(addImageShape).toHaveBeenCalledTimes(1);
    expect(addImageShape).toHaveBeenCalledWith(1, 'abc123', expect.objectContaining({ left: 120, top: 90 }));
  });

  // Test 2: reverse = delete_shape_by_id（标准 write-tool undo 路径，Record 对象）
  it('Test 2: ToolResult.reverse = delete_shape_by_id（Record 对象，标准 undo 路径）', async () => {
    const result = await generatePptImageTool.execute(
      { prompt: '一张落日的图', slide_index: 2 },
      mockCtx as never,
    );

    expect(result.reverse).toEqual({
      tool: 'delete_shape_by_id',
      args: { slide_index: 2, shape_id: 'shape-99' },
    });
    // postState camelCase（与 operationLog.integration.test 守门一致）
    expect(result.postState).toEqual({
      kind: 'ppt_shape_new',
      content: { slideIndex: 2, shapeId: 'shape-99' },
    });
  });

  // Test 3: aihubmix key 未配置时返回 ok:false + code=PERMISSION_DENIED
  it('Test 3: aihubmix key 未配置 → ok:false + error.code=PERMISSION_DENIED', async () => {
    const { ProviderRegistry } = await import('../../../providers/registry');
    vi.mocked(ProviderRegistry.resolve).mockImplementationOnce(() => {
      throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
    });

    const result = await generatePptImageTool.execute(
      { prompt: '一张落日的图', slide_index: 1 },
      mockCtx as never,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PERMISSION_DENIED');
  });
});
