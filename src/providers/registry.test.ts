/**
 * src/providers/registry.test.ts — ProviderRegistry 路由测试（PROV-04）
 *
 * 测试覆盖：
 * - chat / short-task → 路由到默认 LLM Provider（LLMConfig）
 * - vision / image-gen → 路由到 aihubmix（ImageConfig）
 * - stock-image → 抛 ModelNotFoundError
 * - 未知 taskKind → 抛 ModelNotFoundError
 * - apiKey 未设置 → 抛 KeyInvalidError
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from './types';
import { ModelNotFoundError, KeyInvalidError } from '../errors';

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

  it('resolve("vision") 返回 ImageConfig（aihubmix-vision，model=gpt-5.1）', () => {
    vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');

    const result = ProviderRegistry.resolve('vision', mockGetConfig);

    expect(result).toEqual({
      providerId: 'aihubmix-vision',
      baseURL: 'https://api.aihubmix.com/v1',
      apiKey: 'sk-aihubmix-key',
      // D-09：AIHUBMIX_VISION_MODEL gpt-4o → gpt-5.1
      model: 'gpt-5.1',
    });
  });

  it('resolve("image-gen") 返回 ImageConfig（aihubmix-image，model=gpt-image-2）', () => {
    vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');

    const result = ProviderRegistry.resolve('image-gen', mockGetConfig);

    expect(result).toEqual({
      providerId: 'aihubmix-image',
      baseURL: 'https://api.aihubmix.com/v1',
      apiKey: 'sk-aihubmix-key',
      // D-09：AIHUBMIX_IMAGE_MODEL gpt-image-1 → gpt-image-2
      model: 'gpt-image-2',
    });
  });

  it('resolve("vision") 使用 aihubmix providerId 读取 apiKey', () => {
    vi.mocked(storage.get).mockReturnValue('sk-aihubmix-key');

    ProviderRegistry.resolve('vision', mockGetConfig);

    expect(storage.get).toHaveBeenCalledWith('aster:keys:aihubmix');
  });

  // -------------------------------------------------------------------------
  // stock-image — 未配置，抛 ModelNotFoundError
  // -------------------------------------------------------------------------

  it('resolve("stock-image") 抛出 ModelNotFoundError', () => {
    expect(() => ProviderRegistry.resolve('stock-image', mockGetConfig)).toThrow(
      ModelNotFoundError,
    );
  });

  it('resolve("stock-image") 错误 code 为 MODEL', () => {
    try {
      ProviderRegistry.resolve('stock-image', mockGetConfig);
    } catch (e) {
      expect((e as ModelNotFoundError).code).toBe('MODEL');
    }
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
