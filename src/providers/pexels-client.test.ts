/**
 * src/providers/pexels-client.test.ts — Pexels REST client 测试（LIB-01）
 *
 * 覆盖：
 * - 鉴权裸 key（绝不含 "Bearer " 前缀，D-10 头号坑）
 * - query/per_page/page/locale 正确拼进 URL
 * - 429 → RateLimitError；网络 reject → NetworkError
 * - 正常 200 → 返回 data.photos
 * - fetchPexelsImageToBase64 → 裸 base64（无 data: 前缀）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchPexels, fetchPexelsImageToBase64, PEXELS_DEFAULT_BASE_URL } from './pexels-client';
import { NetworkError, RateLimitError } from '../errors';
import type { PexelsPhoto } from './pexels-client';

const mockPhoto: PexelsPhoto = {
  id: 123,
  url: 'https://www.pexels.com/photo/123/',
  photographer: 'Jane Doe',
  photographer_url: 'https://www.pexels.com/@jane',
  alt: 'seaside sunset',
  src: {
    original: 'https://images.pexels.com/photos/123/original.jpg',
    large2x: 'https://images.pexels.com/photos/123/large2x.jpg',
    large: 'https://images.pexels.com/photos/123/large.jpg',
    medium: 'https://images.pexels.com/photos/123/medium.jpg',
    tiny: 'https://images.pexels.com/photos/123/tiny.jpg',
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('searchPexels — 鉴权 + URL 拼装 + 错误映射（LIB-01）', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('鉴权用裸 key（Authorization === apiKey，绝不含 Bearer 前缀）— D-10', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ photos: [mockPhoto] }));
    vi.stubGlobal('fetch', fetchMock);

    await searchPexels('seaside sunset', 'test-key');

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const auth = (init.headers as Record<string, string>).Authorization;
    expect(auth).toBe('test-key');
    expect(auth).not.toMatch(/Bearer/);
  });

  it('query/per_page/page/locale 正确拼进请求 URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ photos: [] }));
    vi.stubGlobal('fetch', fetchMock);

    await searchPexels('seaside sunset', 'test-key', PEXELS_DEFAULT_BASE_URL, {
      per_page: 10,
      page: 2,
      locale: 'zh-CN',
    });

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('/search?');
    expect(url).toContain('query=seaside+sunset');
    expect(url).toContain('per_page=10');
    expect(url).toContain('page=2');
    expect(url).toContain('locale=zh-CN');
  });

  it('429 响应 → RateLimitError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 429)));
    await expect(searchPexels('x', 'k')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('fetch reject（网络失败）→ NetworkError（不泄漏底层错误）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('boom sk-leak')));
    await expect(searchPexels('x', 'k')).rejects.toBeInstanceOf(NetworkError);
  });

  it('非 2xx（非 429）→ NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 500)));
    await expect(searchPexels('x', 'k')).rejects.toBeInstanceOf(NetworkError);
  });

  it('正常 200 → 返回 data.photos', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ photos: [mockPhoto] })));
    const photos = await searchPexels('seaside sunset', 'k');
    expect(photos).toHaveLength(1);
    expect(photos[0].photographer).toBe('Jane Doe');
    expect(photos[0].src.large).toContain('large.jpg');
  });

  it('photos 字段缺失时返回空数组（不抛错）', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})));
    const photos = await searchPexels('x', 'k');
    expect(photos).toEqual([]);
  });
});

describe('fetchPexelsImageToBase64 — URL → 裸 base64（无 data: 前缀）', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('返回裸 base64（去掉 data:image/jpeg;base64, 前缀）', async () => {
    const fakeBlob = { type: 'image/jpeg' } as Blob;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, blob: async () => fakeBlob } as unknown as Response),
    );
    // mock FileReader：onload 给出带 data: 前缀的 result
    class FakeFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      readAsDataURL(_blob: Blob): void {
        void _blob;
        this.result = 'data:image/jpeg;base64,QUJD';
        this.onload?.();
      }
    }
    vi.stubGlobal('FileReader', FakeFileReader as unknown as typeof FileReader);

    const base64 = await fetchPexelsImageToBase64('https://images.pexels.com/photos/123/large.jpg');
    expect(base64).toBe('QUJD');
    expect(base64).not.toContain('data:');
  });

  it('fetch 失败 → NetworkError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    await expect(
      fetchPexelsImageToBase64('https://images.pexels.com/photos/123/large.jpg'),
    ).rejects.toBeInstanceOf(NetworkError);
  });

  it('非 2xx → NetworkError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 404 } as unknown as Response),
    );
    await expect(
      fetchPexelsImageToBase64('https://images.pexels.com/photos/123/large.jpg'),
    ).rejects.toBeInstanceOf(NetworkError);
  });
});
