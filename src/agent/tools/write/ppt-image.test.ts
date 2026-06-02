/**
 * src/agent/tools/write/ppt-image.test.ts — Phase 16 Wave 0 测试脚手架
 *
 * 覆盖 generate_ppt_image 工具行为：
 *   Test 1: ok:true + preview_pending:true + base64/mimeType 非空
 *   Test 2: reverse === undefined（D-02 解耦：工具本身不写文档）
 *   Test 3: aihubmix key 未配置 → ok:false + code=PERMISSION_DENIED
 *
 * 当前 describe.skip：Wave 0 存根（ppt-image.ts execute 抛 not-implemented）。
 * Plan 16-03 填充 execute 实现后去掉 describe.skip，测试将从 skipped → green。
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

describe('generate_ppt_image tool（Plan 16-03 实现后去掉 skip）', () => {
  const mockCtx = {
    adapter: {},
    runId: 'r-ppt-img',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 1: 成功路径 — ok:true + preview_pending:true + base64/mimeType 非空
  it('Test 1: execute 返回 ok:true + preview_pending:true + base64/mimeType 非空', async () => {
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
    expect((result.data as Record<string, unknown>).preview_pending).toBe(true);
    expect((result.data as Record<string, unknown>).base64).toBeTruthy();
    expect((result.data as Record<string, unknown>).mimeType).toBeTruthy();
  });

  // Test 2: reverse === undefined（D-02 解耦：生图工具本身不写文档）
  it('Test 2: ToolResult.reverse 为 undefined（D-02 解耦）', async () => {
    const result = await generatePptImageTool.execute(
      { prompt: '一张落日的图', slide_index: 1 },
      mockCtx as never,
    );

    expect(result.reverse).toBeUndefined();
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
