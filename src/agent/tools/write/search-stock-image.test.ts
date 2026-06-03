/**
 * src/agent/tools/write/search-stock-image.test.ts — search_and_insert_stock_image 行为测试（LIB-02/03）
 *
 * 覆盖：
 *   PPT 1: 无 Pexels key（registry 抛 KeyInvalidError）→ PERMISSION_DENIED 不可恢复
 *   PPT 2: 正常 → reverse delete_shape_by_id（Record snake_case）+ postState ppt_shape_new（camelCase）
 *          + data.shape_id/photographer/thumbnail_url；NFR-09：data 不含 base64
 *   PPT 3: 无结果 → ok:true + data.results=0 + reverse undefined
 *   PPT 4: 429（searchPexels reject RateLimitError）→ HOST_API_FAILED 可恢复
 *   Word 5: 正常 → reverse noop_inverse；data.photographer；data 不含 base64
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  searchAndInsertStockImagePptTool,
  searchAndInsertStockImageWordTool,
} from './search-stock-image';
import { KeyInvalidError, RateLimitError } from '../../../errors';
import type { PexelsPhoto } from '../../../providers/pexels-client';

// ---------------------------------------------------------------------------
// Mock：pexels-client（隔离网络）
// ---------------------------------------------------------------------------
vi.mock('../../../providers/pexels-client', () => ({
  searchPexels: vi.fn(),
  fetchPexelsImageToBase64: vi.fn(),
  PEXELS_DEFAULT_BASE_URL: 'https://api.pexels.com/v1',
}));

// ---------------------------------------------------------------------------
// Mock：ProviderRegistry（默认成功：返回 pexels ImageConfig）
// ---------------------------------------------------------------------------
vi.mock('../../../providers/registry', () => ({
  ProviderRegistry: {
    resolve: vi.fn().mockReturnValue({
      providerId: 'pexels',
      baseURL: 'https://api.pexels.com/v1',
      apiKey: 'pk-test',
      model: '',
    }),
  },
}));

import { searchPexels, fetchPexelsImageToBase64 } from '../../../providers/pexels-client';
import { ProviderRegistry } from '../../../providers/registry';

const FAKE_BASE64 = 'QUJD'; // 模拟裸 base64 payload，断言绝不进 data
const mockPhoto: PexelsPhoto = {
  id: 1,
  url: 'https://www.pexels.com/photo/1/',
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@jane',
  alt: 'seaside sunset',
  src: {
    original: 'https://images.pexels.com/photos/1/original.jpg',
    large2x: 'https://images.pexels.com/photos/1/large2x.jpg',
    large: 'https://images.pexels.com/photos/1/large.jpg',
    medium: 'https://images.pexels.com/photos/1/medium.jpg',
    tiny: 'https://images.pexels.com/photos/1/tiny.jpg',
  },
};

describe('search_and_insert_stock_image — PPT 工具（LIB-02/03）', () => {
  const addImageShape = vi.fn();
  const mockCtx = {
    adapter: { addImageShape } as never,
    runId: 'r-stock-ppt',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProviderRegistry.resolve).mockReturnValue({
      providerId: 'pexels',
      baseURL: 'https://api.pexels.com/v1',
      apiKey: 'pk-test',
      model: '',
    } as never);
    addImageShape.mockResolvedValue({ newShapeId: 'sid-1' });
    vi.mocked(searchPexels).mockResolvedValue([mockPhoto]);
    vi.mocked(fetchPexelsImageToBase64).mockResolvedValue(FAKE_BASE64);
  });

  it('PPT 1: 无 Pexels key（registry 抛 KeyInvalidError）→ PERMISSION_DENIED 不可恢复', async () => {
    vi.mocked(ProviderRegistry.resolve).mockImplementationOnce(() => {
      throw new KeyInvalidError('Pexels Key 未配置，请在设置中填写图库 Key');
    });

    const result = await searchAndInsertStockImagePptTool.execute(
      { query: 'seaside sunset' },
      mockCtx as never,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('PERMISSION_DENIED');
    expect(result.error?.recoverable).toBe(false);
    expect(addImageShape).not.toHaveBeenCalled();
  });

  it('PPT 2: 正常 → reverse delete_shape_by_id + postState ppt_shape_new + data 署名（NFR-09 无 base64）', async () => {
    const result = await searchAndInsertStockImagePptTool.execute(
      { query: 'seaside sunset', slide_index: 1 },
      mockCtx as never,
    );

    expect(result.ok).toBe(true);
    // reverse = Record 对象（snake_case，非位置参）
    expect(result.reverse).toEqual({
      tool: 'delete_shape_by_id',
      args: { slide_index: 1, shape_id: 'sid-1' },
    });
    // postState content = camelCase
    expect(result.postState).toEqual({
      kind: 'ppt_shape_new',
      content: { slideIndex: 1, shapeId: 'sid-1' },
    });
    const data = result.data as Record<string, unknown>;
    expect(data.shape_id).toBe('sid-1');
    expect(data.photographer).toBe('Jane Doe');
    expect(data.thumbnail_url).toBe('https://images.pexels.com/photos/1/tiny.jpg');
    expect(data.inserted).toBe(true);
    // 裸 base64 喂给 addImageShape（large 尺寸），不进 data
    expect(fetchPexelsImageToBase64).toHaveBeenCalledWith(mockPhoto.src.large, mockCtx.signal);
    expect(addImageShape).toHaveBeenCalledWith(1, FAKE_BASE64, expect.objectContaining({ left: 120, top: 90 }));
    // NFR-09：data 绝不含 base64
    expect(JSON.stringify(result.data)).not.toContain(FAKE_BASE64);
  });

  it('PPT 3: 无结果（searchPexels 返 []）→ ok:true + data.results=0 + 无 reverse', async () => {
    vi.mocked(searchPexels).mockResolvedValue([]);

    const result = await searchAndInsertStockImagePptTool.execute(
      { query: 'zzznotfound' },
      mockCtx as never,
    );

    expect(result.ok).toBe(true);
    expect((result.data as Record<string, unknown>).results).toBe(0);
    expect(result.reverse).toBeUndefined();
    expect(addImageShape).not.toHaveBeenCalled();
  });

  it('PPT 4: 429（searchPexels reject RateLimitError）→ HOST_API_FAILED 可恢复', async () => {
    vi.mocked(searchPexels).mockRejectedValue(new RateLimitError('Pexels 检索过于频繁，请稍后再试'));

    const result = await searchAndInsertStockImagePptTool.execute(
      { query: 'seaside sunset' },
      mockCtx as never,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('HOST_API_FAILED');
    expect(result.error?.recoverable).toBe(true);
  });

  it('PPT: 缺 query → INVALID_ARGS 可恢复', async () => {
    const result = await searchAndInsertStockImagePptTool.execute({}, mockCtx as never);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
  });
});

describe('search_and_insert_stock_image — Word 工具（LIB-02/03）', () => {
  const insertBodyImage = vi.fn();
  const mockCtx = {
    adapter: { insertBodyImage } as never,
    runId: 'r-stock-word',
    stepIndex: 0,
    signal: new AbortController().signal,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ProviderRegistry.resolve).mockReturnValue({
      providerId: 'pexels',
      baseURL: 'https://api.pexels.com/v1',
      apiKey: 'pk-test',
      model: '',
    } as never);
    insertBodyImage.mockResolvedValue(undefined);
    vi.mocked(searchPexels).mockResolvedValue([mockPhoto]);
    vi.mocked(fetchPexelsImageToBase64).mockResolvedValue(FAKE_BASE64);
  });

  it('Word 5: 正常 → reverse noop_inverse + data 署名（NFR-09 无 base64）', async () => {
    const result = await searchAndInsertStockImageWordTool.execute(
      { query: 'seaside sunset' },
      mockCtx as never,
    );

    expect(result.ok).toBe(true);
    expect(result.reverse).toEqual({
      tool: 'noop_inverse',
      args: { reason: 'Word 图片插入暂不支持自动撤销' },
    });
    expect(result.postState).toBeUndefined();
    const data = result.data as Record<string, unknown>;
    expect(data.photographer).toBe('Jane Doe');
    expect(data.thumbnail_url).toBe('https://images.pexels.com/photos/1/tiny.jpg');
    expect(data.inserted).toBe(true);
    expect(insertBodyImage).toHaveBeenCalledWith(FAKE_BASE64);
    // NFR-09：data 绝不含 base64
    expect(JSON.stringify(result.data)).not.toContain(FAKE_BASE64);
  });
});
