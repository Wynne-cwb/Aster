/**
 * src/providers/registry.test.ts — ProviderRegistry 路由测试（PROV-04）
 *
 * 测试覆盖：
 * - chat / short-task → 路由到默认 LLM Provider（LLMConfig）
 * - vision / image-gen → 路由到 aihubmix（ImageConfig）
 * - stock-image → 读 PEXELS_API_KEY；缺失抛 KeyInvalidError，有 key 返 pexels ImageConfig（Phase 18 D-09）
 * - 未知 taskKind → 抛 ModelNotFoundError
 * - apiKey 未设置 → 抛 KeyInvalidError
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig, ImageConfig } from './types';
import { ModelNotFoundError, KeyInvalidError } from '../errors';
import { IMAGE_GEN_MODELS, DEFAULT_IMAGE_GEN_MODEL } from './registry';

// ---------------------------------------------------------------------------
// Mock storage（registry.ts 内部调用 storage.get）
// ---------------------------------------------------------------------------
vi.mock('../lib/storage', () => ({
  storage: {
    get: vi.fn(),
  },
  STORAGE_KEYS: {
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
    ONBOARDING_SEEN: 'aster:onboarding:seen',
    SELECTION_AUTO_ATTACH: 'aster:selection:autoAttach',
    DEFAULT_PROVIDER: 'aster:providers:default',
    // Phase 16 IMG-04（D-04）：生图 model 持久 pref key
    PREF_IMAGE_GEN_MODEL: 'aster:pref:image-gen-model',
    // Phase 18 LIB-01（D-08/D-09）：Pexels BYO key + 可配 baseURL override
    PEXELS_API_KEY: 'aster:keys:pexels',
    PEXELS_BASE_URL: 'aster:config:pexels-base-url',
  },
}));

import { storage } from '../lib/storage';
import { ProviderRegistry } from './registry';

const mockGetConfig = (): ProviderConfig => ({
  id: 'deepseek',
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  isBuiltIn: true,
});

describe('ProviderRegistry.resolve', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // LLM 路由（chat / short-task）
  // -------------------------------------------------------------------------

  it('resolve("chat") 返回 LLMConfig（defaultLLM 路由）', () => {
    vi.mocked(storage.get).mockReturnValue('sk-test-deepseek-key');

    const result = ProviderRegistry.resolve('chat', mockGetConfig);

    expect(result).toEqual({
      providerId: 'deepseek',
      baseURL: 'https://api.deepseek.com',
      apiKey: 'sk-test-deepseek-key',
      model: 'deepseek-v4-flash',
    });
  });

  it('resolve("short-task") 返回与 chat 相同的 LLMConfig', () => {
    vi.mocked(storage.get).mockReturnValue('sk-test-deepseek-key');

    const result = ProviderRegistry.resolve('short-task', mockGetConfig);

    expect(result).toEqual({
      providerId: 'deepseek',
      baseURL: 'https://api.deepseek.com',
      apiKey: 'sk-test-deepseek-key',
      model: 'deepseek-v4-flash',
    });
  });

  it('resolve("chat") 使用 getDefaultLLM 注入的 providerId 读取 apiKey', () => {
    vi.mocked(storage.get).mockReturnValue('sk-test-key');

    ProviderRegistry.resolve('chat', mockGetConfig);

    // 应以 KEY_PREFIX + provider.id 读取
    expect(storage.get).toHaveBeenCalledWith('aster:keys:deepseek');
  });

  // -------------------------------------------------------------------------
  // 图像路由（vision / image-gen）
  // -------------------------------------------------------------------------

  it('resolve("vision") 返回 ImageConfig（aihubmix-vision，model=gpt-5.4）', () => {
    vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');

    const result = ProviderRegistry.resolve('vision', mockGetConfig);

    expect(result).toEqual({
      providerId: 'aihubmix-vision',
      baseURL: 'https://api.aihubmix.com/v1',
      apiKey: 'sk-aihubmix-key',
      // D-06（Phase 14）：AIHUBMIX_VISION_MODEL 更新为 gpt-5.4
      model: 'gpt-5.4',
    });
  });

  it('resolve("image-gen") 返回 ImageConfig（aihubmix-image，model=doubao-seedream-5.0-lite）', () => {
    // D-04（IMG-04）：image-gen 现在多读一个 PREF_IMAGE_GEN_MODEL key。
    // 用 mockImplementation 按 key 区分：apiKey key 返回真实 key，pref key 返回 null（未选→默认 doubao）。
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:pref:image-gen-model' ? null : ('sk-aihubmix-key' as never),
    );

    const result = ProviderRegistry.resolve('image-gen', mockGetConfig);

    expect(result).toEqual({
      providerId: 'aihubmix-image',
      // D-05/D-07（Phase 14）：生图 base URL 改为不含 /v1 的 host
      baseURL: 'https://aihubmix.com',
      apiKey: 'sk-aihubmix-key',
      // D-05（Phase 14）：默认生图 model 改为 doubao-seedream-5.0-lite（最快）
      model: 'doubao-seedream-5.0-lite',
    });
  });

  it('resolve("vision") 使用 aihubmix providerId 读取 apiKey', () => {
    vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');

    ProviderRegistry.resolve('vision', mockGetConfig);

    expect(storage.get).toHaveBeenCalledWith('aster:keys:aihubmix');
  });

  // -------------------------------------------------------------------------
  // stock-image — Pexels BYO key（Phase 18 D-09）
  // -------------------------------------------------------------------------

  it('resolve("stock-image") 有 Pexels key 时返回 pexels ImageConfig（baseURL 默认直连）', () => {
    // 按 key 区分：PEXELS_API_KEY 返回 key，PEXELS_BASE_URL 返回 null（用默认）
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:keys:pexels' ? ('pk-test' as never) : null,
    );

    const result = ProviderRegistry.resolve('stock-image', () => {
      throw new Error('unused');
    }) as ImageConfig;

    expect(result).toEqual({
      providerId: 'pexels',
      baseURL: 'https://api.pexels.com/v1',
      apiKey: 'pk-test',
      model: '',
    });
  });

  it('resolve("stock-image") 缺 Pexels key 时抛 KeyInvalidError（不再 ModelNotFoundError）', () => {
    vi.mocked(storage.get).mockReturnValue(null);

    expect(() => ProviderRegistry.resolve('stock-image', mockGetConfig)).toThrow(KeyInvalidError);
  });

  it('resolve("stock-image") PEXELS_BASE_URL override 时 baseURL 用 override（Worker 兜底口）', () => {
    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === 'aster:keys:pexels') return 'pk-test' as never;
      if (key === 'aster:config:pexels-base-url') return 'https://worker.example/pexels' as never;
      return null;
    });

    const result = ProviderRegistry.resolve('stock-image', mockGetConfig) as ImageConfig;

    expect(result.baseURL).toBe('https://worker.example/pexels');
    expect(result.providerId).toBe('pexels');
    expect(result.apiKey).toBe('pk-test');
  });

  // -------------------------------------------------------------------------
  // 未知 taskKind → ModelNotFoundError（exhaustive default 分支）
  // -------------------------------------------------------------------------

  it('未知 taskKind 抛出 ModelNotFoundError', () => {
    expect(() =>
      // 故意传非法 taskKind，触发 switch default 分支
      ProviderRegistry.resolve('not-a-task' as never, mockGetConfig),
    ).toThrow(ModelNotFoundError);
  });

  // -------------------------------------------------------------------------
  // apiKey 未设置 → KeyInvalidError
  // -------------------------------------------------------------------------

  it('chat apiKey 为 null 时抛出 KeyInvalidError', () => {
    vi.mocked(storage.get).mockReturnValue(null);

    expect(() => ProviderRegistry.resolve('chat', mockGetConfig)).toThrow(KeyInvalidError);
  });

  it('vision apiKey 为 null 时抛出 KeyInvalidError', () => {
    vi.mocked(storage.get).mockReturnValue(null);

    expect(() => ProviderRegistry.resolve('vision', mockGetConfig)).toThrow(KeyInvalidError);
  });

  it('image-gen apiKey 为空字符串时抛出 KeyInvalidError', () => {
    vi.mocked(storage.get).mockReturnValue('');

    expect(() => ProviderRegistry.resolve('image-gen', mockGetConfig)).toThrow(KeyInvalidError);
  });

  it('KeyInvalidError message 不含 apiKey 原文（T-02-12）', () => {
    vi.mocked(storage.get).mockReturnValue(null);

    try {
      ProviderRegistry.resolve('chat', mockGetConfig);
    } catch (e) {
      const err = e as KeyInvalidError;
      // 错误 message 只说明状态，不含实际 key 值
      expect(err.message).not.toContain('sk-');
      expect(err.code).toBe('KEY_INVALID');
    }
  });
});

// ---------------------------------------------------------------------------
// IMAGE_GEN_MODELS（D-05）——生图 model 列表
// ---------------------------------------------------------------------------

describe('IMAGE_GEN_MODELS（D-05）', () => {
  it('包含三个 model', () => {
    expect(IMAGE_GEN_MODELS).toHaveLength(3);
  });

  it('恰好一个 model 的 isDefault 为 true，且该 model 是 doubao-seedream-5.0-lite', () => {
    const defaults = IMAGE_GEN_MODELS.filter((m) => m.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe('doubao-seedream-5.0-lite');
  });

  it('DEFAULT_IMAGE_GEN_MODEL.id 等于 doubao-seedream-5.0-lite', () => {
    expect(DEFAULT_IMAGE_GEN_MODEL.id).toBe('doubao-seedream-5.0-lite');
  });

  it('每个 model 都有 id/label/endpointKind/authKind/isDefault 字段', () => {
    for (const m of IMAGE_GEN_MODELS) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(['predictions', 'gemini']).toContain(m.endpointKind);
      expect(['bearer', 'goog-api-key']).toContain(m.authKind);
      expect(typeof m.isDefault).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// image-gen resolve — PREF_IMAGE_GEN_MODEL localStorage 覆盖（IMG-04 D-04）
// ---------------------------------------------------------------------------

describe('image-gen resolve — PREF_IMAGE_GEN_MODEL localStorage 覆盖（IMG-04 D-04）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('storage 有 PREF_IMAGE_GEN_MODEL 时 resolve 返回用户选定 model（gpt-image-2）', () => {
    // 按 key 区分：apiKey key 返回真实 key，pref key 返回用户选定的 gpt-image-2
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:pref:image-gen-model'
        ? ('gpt-image-2' as never)
        : ('sk-aihubmix-key' as never),
    );

    const config = ProviderRegistry.resolve('image-gen', mockGetConfig) as ImageConfig;

    expect(config.model).toBe('gpt-image-2');
    // 其余字段不受 model 覆盖影响
    expect(config.providerId).toBe('aihubmix-image');
    expect(config.apiKey).toBe('sk-aihubmix-key');
  });

  it('PREF_IMAGE_GEN_MODEL 选 gemini 时 resolve 返回 gemini model', () => {
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:pref:image-gen-model'
        ? ('gemini-3.1-flash-image-preview' as never)
        : ('sk-aihubmix-key' as never),
    );

    const config = ProviderRegistry.resolve('image-gen', mockGetConfig) as ImageConfig;

    expect(config.model).toBe('gemini-3.1-flash-image-preview');
  });

  it('storage 无 PREF_IMAGE_GEN_MODEL（返回 null）时 resolve 回退默认 doubao', () => {
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:pref:image-gen-model' ? null : ('sk-aihubmix-key' as never),
    );

    const config = ProviderRegistry.resolve('image-gen', mockGetConfig) as ImageConfig;

    expect(config.model).toBe(DEFAULT_IMAGE_GEN_MODEL.id);
    expect(config.model).toBe('doubao-seedream-5.0-lite');
  });

  it('用 KEY_PREFIX+aihubmix 读 apiKey + 用 PREF_IMAGE_GEN_MODEL 读 model（两次 storage.get）', () => {
    vi.mocked(storage.get).mockImplementation((key: string) =>
      key === 'aster:pref:image-gen-model' ? null : ('sk-aihubmix-key' as never),
    );

    ProviderRegistry.resolve('image-gen', mockGetConfig);

    expect(storage.get).toHaveBeenCalledWith('aster:keys:aihubmix');
    expect(storage.get).toHaveBeenCalledWith('aster:pref:image-gen-model');
  });
});
