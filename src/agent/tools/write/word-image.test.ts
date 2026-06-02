/**
 * src/agent/tools/write/word-image.test.ts — generate_word_image 行为测试
 *
 * 产品反转（2026-06-02）：工具改为 loop 内直接插入 Word body 末尾。覆盖：
 *   Test 4: ok:true + inserted:true + thumbnail（直插成功）
 *   Test 5: reverse = noop_inverse（Word body 插图不支持自动撤销，诚实模式）
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

describe('generate_word_image tool（loop 内直插）', () => {
  // adapter mock：insertBodyImage 返回尺寸（直插成功）
  const insertBodyImage = vi.fn().mockResolvedValue({ width: 100, height: 100 });
  const mockCtx = {
    adapter: { insertBodyImage } as never,
    runId: 'r-word-img',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    insertBodyImage.mockResolvedValue({ width: 100, height: 100 });
  });

  // Test 4: 成功路径 — ok:true + inserted:true + thumbnail
  it('Test 4: execute 直插成功 → ok:true + inserted:true + thumbnail', async () => {
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
    const data = result.data as Record<string, unknown>;
    expect(data.inserted).toBe(true);
    expect(data.thumbnail).toBeTruthy();   // NFR-09：仅 UI 只读消费
    // 直插：insertBodyImage 被调用（裸 base64）
    expect(insertBodyImage).toHaveBeenCalledTimes(1);
    expect(insertBodyImage).toHaveBeenCalledWith('abc123');
  });

  // Test 5: reverse = noop_inverse（Word body 插图无法自动撤销，诚实模式）
  it('Test 5: ToolResult.reverse = noop_inverse（Word 插图不支持自动撤销）', async () => {
    const result = await generateWordImageTool.execute(
      { prompt: '一张蓝天白云的图' },
      mockCtx as never,
    );

    expect(result.reverse).toEqual({
      tool: 'noop_inverse',
      args: { reason: 'Word 图片插入暂不支持自动撤销' },
    });
  });
});
