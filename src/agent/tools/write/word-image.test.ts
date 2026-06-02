/**
 * src/agent/tools/write/word-image.test.ts — Phase 16 Wave 0 测试脚手架
 *
 * 覆盖 generate_word_image 工具行为：
 *   Test 4: ok:true + preview_pending:true
 *   Test 5: reverse === undefined（D-02 解耦：工具本身不写文档）
 *
 * 当前 describe.skip：Wave 0 存根（word-image.ts execute 抛 not-implemented）。
 * Plan 16-03 填充 execute 实现后去掉 describe.skip，测试将从 skipped → green。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateWordImageTool } from './word-image';

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

describe('generate_word_image tool（Plan 16-03 实现后去掉 skip）', () => {
  const mockCtx = {
    adapter: {},
    runId: 'r-word-img',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test 4: 成功路径 — ok:true + preview_pending:true
  it('Test 4: execute 返回 ok:true + preview_pending:true', async () => {
    const { ProviderRegistry } = await import('../../../providers/registry');
    vi.mocked(ProviderRegistry.resolve).mockReturnValue({
      providerId: 'aihubmix-image',
      baseURL: 'https://aihubmix.com',
      apiKey: 'test-key',
      model: 'doubao-seedream-5.0-lite',
    } as never);

    const result = await generateWordImageTool.execute(
      { prompt: '一张蓝天白云的图' },
      mockCtx as never,
    );

    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>).preview_pending).toBe(true);
  });

  // Test 5: reverse === undefined（D-02 解耦：Word 生图工具本身不写文档）
  it('Test 5: ToolResult.reverse 为 undefined（D-02 解耦，noop_inverse 在 insertImage helper）', async () => {
    const result = await generateWordImageTool.execute(
      { prompt: '一张蓝天白云的图' },
      mockCtx as never,
    );

    expect(result.reverse).toBeUndefined();
  });
});
