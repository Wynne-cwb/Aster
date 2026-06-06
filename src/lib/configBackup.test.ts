/**
 * src/lib/configBackup.test.ts — 配置导入导出核心逻辑单测（CFG-01 / CFG-02）
 *
 * 覆盖 VALIDATION.md 全部 9 个自动化用例：
 * 1. buildExportData 字段集（D-02 锁定，不含 ONBOARDING_SEEN / PEXELS_BASE_URL / 聊天历史）
 * 2. key 遍历完整性（内置 deepseek/aihubmix + 自定义 provider + pexels）
 * 3. parseImportFile INVALID_JSON
 * 4. parseImportFile NOT_ASTER_CONFIG
 * 5. parseImportFile UNSUPPORTED_VERSION
 * 6. parseImportFile EMPTY_CONFIG
 * 7. detectConflicts（同 id 冲突识别，无漏报无误报）
 * 8. 往返幂等（buildExportData → parseImportFile → ok:true，字段完整）
 * 9. applyImport（setKey 被调用，hydrateFromStorage 最终调用）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from '../providers/types';

// ---------------------------------------------------------------------------
// Mock storage（从 configBackup.ts 视角的相对路径）
// 注意：ONBOARDING_SEEN / PEXELS_BASE_URL / CHAT_HISTORY_PREFIX 不进 mock，
// 保证 acceptance_criteria grep 守门成立（applyImport 不读写这三个 key）
// ---------------------------------------------------------------------------
vi.mock('./storage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
    SELECTION_ATTACH_ENABLED: 'aster:selection:attachEnabled',
    DEFAULT_PROVIDER: 'aster:providers:default',
    USER_PREFERENCES: 'aster:prefs:user',
    BRAND_ACCENT_COLOR: 'aster:prefs:brand-accent',
    PREF_IMAGE_GEN_MODEL: 'aster:pref:image-gen-model',
    PEXELS_API_KEY: 'aster:keys:pexels',
  },
}));

// ---------------------------------------------------------------------------
// Mock providers store
// ---------------------------------------------------------------------------
vi.mock('../store/providers', () => ({
  useProviderStore: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
  hydrateFromStorage: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Mock preferences store
// ---------------------------------------------------------------------------
vi.mock('../store/preferences', () => ({
  usePreferencesStore: {
    getState: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Mock 后再 import 实现文件
// ---------------------------------------------------------------------------
import { storage, STORAGE_KEYS } from './storage';
import { useProviderStore, hydrateFromStorage } from '../store/providers';
import { usePreferencesStore } from '../store/preferences';
import {
  ASTER_CONFIG_VERSION,
  buildExportData,
  exportConfig,
  parseImportFile,
  detectConflicts,
  applyImport,
} from './configBackup';

// ---------------------------------------------------------------------------
// 测试夹具
// ---------------------------------------------------------------------------

const mockBuiltinProviders: ProviderConfig[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseURL: 'https://api.deepseek.com',
    model: 'deepseek-v4-flash',
    isBuiltIn: true,
  },
  {
    id: 'aihubmix',
    name: 'AiHubMix',
    baseURL: 'https://api.aihubmix.com/v1',
    model: 'gpt-5.1',
    isBuiltIn: true,
  },
];

const mockCustomProvider: ProviderConfig = {
  id: 'custom-uuid-1234',
  name: '我的自定义 Provider',
  baseURL: 'https://custom.example.com/v1',
  model: 'custom-model',
  isBuiltIn: false,
};

const mockAllProviders = [...mockBuiltinProviders, mockCustomProvider];

// ---------------------------------------------------------------------------
// describe 1: buildExportData 字段集（VALIDATION.md 用例 1）
// ---------------------------------------------------------------------------

describe('buildExportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 设置 providers store mock
    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    // 设置 storage.get 按 key 区分
    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.KEY_PREFIX + 'deepseek') return 'sk-deepseek-key' as never;
      if (key === STORAGE_KEYS.KEY_PREFIX + 'aihubmix') return 'sk-aihubmix-key' as never;
      if (key === STORAGE_KEYS.PEXELS_API_KEY) return 'pk-pexels-key' as never;
      if (key === STORAGE_KEYS.DEFAULT_PROVIDER) return 'deepseek' as never;
      if (key === STORAGE_KEYS.SELECTION_ATTACH_ENABLED) return true as never;
      if (key === STORAGE_KEYS.USER_PREFERENCES) return '回复简洁' as never;
      if (key === STORAGE_KEYS.BRAND_ACCENT_COLOR) return '#009887' as never;
      if (key === STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) return 'doubao-seedream-5.0-lite' as never;
      return null;
    });
  });

  it('返回含全部 D-02 字段的 AsterConfigExport 对象', () => {
    const result = buildExportData();

    expect(result.app).toBe('aster');
    expect(result.version).toBe(ASTER_CONFIG_VERSION);
    expect(result.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601
    expect(result.data).toBeDefined();
    expect(result.data.providers).toHaveLength(2);
    expect(result.data.defaultProviderId).toBe('deepseek');
    expect(result.data.selectionAttachEnabled).toBe(true);
    expect(result.data.userPreferences).toBe('回复简洁');
    expect(result.data.brandAccentColor).toBe('#009887');
    expect(result.data.pexelsKey).toBe('pk-pexels-key');
    expect(result.data.imageGenModel).toBe('doubao-seedream-5.0-lite');
  });

  it('keys Record 包含各 provider 的 API key', () => {
    const result = buildExportData();

    expect(result.data.keys['deepseek']).toBe('sk-deepseek-key');
    expect(result.data.keys['aihubmix']).toBe('sk-aihubmix-key');
  });
});

// ---------------------------------------------------------------------------
// describe 2: key 遍历完整性（VALIDATION.md 用例 2）
// ---------------------------------------------------------------------------

describe('buildExportData — key 遍历完整性', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('内置 deepseek/aihubmix key 均被收入，自定义 provider key 也收入，pexels key 单独收入', () => {
    // 三个 provider（含自定义）
    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockAllProviders,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.KEY_PREFIX + 'deepseek') return 'sk-deepseek' as never;
      if (key === STORAGE_KEYS.KEY_PREFIX + 'aihubmix') return 'sk-aihubmix' as never;
      if (key === STORAGE_KEYS.KEY_PREFIX + 'custom-uuid-1234') return 'sk-custom' as never;
      if (key === STORAGE_KEYS.PEXELS_API_KEY) return 'pk-pexels' as never;
      return null;
    });

    const result = buildExportData();

    expect(result.data.keys['deepseek']).toBe('sk-deepseek');
    expect(result.data.keys['aihubmix']).toBe('sk-aihubmix');
    expect(result.data.keys['custom-uuid-1234']).toBe('sk-custom');
    expect(result.data.pexelsKey).toBe('pk-pexels');
    // keys Record 不含 pexels（pexels 走单独字段）
    expect('pexels' in result.data.keys).toBe(false);
  });

  it('未配置 key 的 provider 不出现在 keys Record', () => {
    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(storage.get).mockImplementation((key: string) => {
      // deepseek 有 key，aihubmix 没有
      if (key === STORAGE_KEYS.KEY_PREFIX + 'deepseek') return 'sk-deepseek' as never;
      return null;
    });

    const result = buildExportData();

    expect('deepseek' in result.data.keys).toBe(true);
    expect('aihubmix' in result.data.keys).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// describe 3 & 4 & 5 & 6: parseImportFile 错误码（VALIDATION.md 用例 3-6）
// ---------------------------------------------------------------------------

describe('parseImportFile — 错误码', () => {
  it('INVALID_JSON: 非 JSON 字符串 → code: INVALID_JSON', () => {
    const result = parseImportFile('not json at all {{{');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_JSON');
      expect(result.error.message).toBeTruthy();
      expect(result.error.hint).toBeTruthy();
    }
  });

  it('NOT_ASTER_CONFIG: app 字段为其他值 → code: NOT_ASTER_CONFIG', () => {
    const result = parseImportFile(JSON.stringify({ app: 'other', version: 1, data: {} }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_ASTER_CONFIG');
    }
  });

  it('NOT_ASTER_CONFIG: 缺少必要字段（无 version）→ code: NOT_ASTER_CONFIG', () => {
    const result = parseImportFile(JSON.stringify({ app: 'aster', data: {} }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_ASTER_CONFIG');
    }
  });

  it('UNSUPPORTED_VERSION: version > ASTER_CONFIG_VERSION → code: UNSUPPORTED_VERSION', () => {
    const futureVersion = ASTER_CONFIG_VERSION + 1;
    const result = parseImportFile(
      JSON.stringify({
        app: 'aster',
        version: futureVersion,
        exportedAt: new Date().toISOString(),
        data: {
          providers: [{ id: 'test', name: 'Test', baseURL: 'https://x.com', model: 'x', isBuiltIn: false }],
          keys: { test: 'sk-test' },
          defaultProviderId: 'test',
          selectionAttachEnabled: true,
          userPreferences: '',
          brandAccentColor: '',
          pexelsKey: '',
          imageGenModel: '',
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('UNSUPPORTED_VERSION');
    }
  });

  it('EMPTY_CONFIG: providers=[] 且 keys={} → code: EMPTY_CONFIG', () => {
    const result = parseImportFile(
      JSON.stringify({
        app: 'aster',
        version: ASTER_CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        data: {
          providers: [],
          keys: {},
          defaultProviderId: '',
          selectionAttachEnabled: true,
          userPreferences: '',
          brandAccentColor: '',
          pexelsKey: '',
          imageGenModel: '',
        },
      }),
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('EMPTY_CONFIG');
    }
  });

  it('合法 Aster JSON → ok: true，config 字段完整', () => {
    const validConfig = {
      app: 'aster',
      version: ASTER_CONFIG_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        providers: [{ id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true }],
        keys: { deepseek: 'sk-ds' },
        defaultProviderId: 'deepseek',
        selectionAttachEnabled: true,
        userPreferences: '简洁',
        brandAccentColor: '#009887',
        pexelsKey: '',
        imageGenModel: 'doubao-seedream-5.0-lite',
      },
    };

    const result = parseImportFile(JSON.stringify(validConfig));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.app).toBe('aster');
      expect(result.config.data.providers).toHaveLength(1);
    }
  });
});

// ---------------------------------------------------------------------------
// describe 5: detectConflicts（VALIDATION.md 用例 7）
// ---------------------------------------------------------------------------

describe('detectConflicts', () => {
  it('返回 imported 中与 currentProviders 存在同 id 的 provider id 列表', () => {
    const importedData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
        { id: 'new-custom', name: 'New', baseURL: 'https://new.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: { deepseek: 'sk-ds', 'new-custom': 'sk-new' },
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: true,
      userPreferences: '',
      brandAccentColor: '',
      pexelsKey: '',
      imageGenModel: '',
    };

    const currentProviders: ProviderConfig[] = [
      { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
    ];

    const conflicts = detectConflicts(importedData, currentProviders);

    expect(conflicts).toContain('deepseek');
    expect(conflicts).not.toContain('new-custom');
    expect(conflicts).toHaveLength(1);
  });

  it('无冲突时返回空数组', () => {
    const importedData = {
      providers: [
        { id: 'brand-new', name: 'Brand New', baseURL: 'https://new.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: { 'brand-new': 'sk-bn' },
      defaultProviderId: 'brand-new',
      selectionAttachEnabled: true,
      userPreferences: '',
      brandAccentColor: '',
      pexelsKey: '',
      imageGenModel: '',
    };

    const currentProviders: ProviderConfig[] = [
      { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
    ];

    const conflicts = detectConflicts(importedData, currentProviders);

    expect(conflicts).toHaveLength(0);
  });

  it('同时有内置和自定义冲突时均正确识别', () => {
    const importedData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
        { id: 'aihubmix', name: 'AiHubMix', baseURL: 'https://api.aihubmix.com/v1', model: 'gpt-5.1', isBuiltIn: true },
        { id: 'custom-1', name: 'Custom 1', baseURL: 'https://c1.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: {},
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: true,
      userPreferences: '',
      brandAccentColor: '',
      pexelsKey: '',
      imageGenModel: '',
    };

    const currentProviders: ProviderConfig[] = [
      { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
      { id: 'aihubmix', name: 'AiHubMix', baseURL: 'https://api.aihubmix.com/v1', model: 'gpt-5.1', isBuiltIn: true },
    ];

    const conflicts = detectConflicts(importedData, currentProviders);

    expect(conflicts).toContain('deepseek');
    expect(conflicts).toContain('aihubmix');
    expect(conflicts).not.toContain('custom-1');
    expect(conflicts).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// describe 6: 往返幂等（VALIDATION.md 用例 8）
// ---------------------------------------------------------------------------

describe('往返幂等', () => {
  it('buildExportData 输出序列化后 parseImportFile 返回 ok:true 且字段完整', () => {
    vi.clearAllMocks();

    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(storage.get).mockImplementation((key: string) => {
      if (key === STORAGE_KEYS.KEY_PREFIX + 'deepseek') return 'sk-ds' as never;
      if (key === STORAGE_KEYS.KEY_PREFIX + 'aihubmix') return 'sk-ah' as never;
      if (key === STORAGE_KEYS.PEXELS_API_KEY) return 'pk-test' as never;
      if (key === STORAGE_KEYS.DEFAULT_PROVIDER) return 'deepseek' as never;
      if (key === STORAGE_KEYS.SELECTION_ATTACH_ENABLED) return true as never;
      if (key === STORAGE_KEYS.USER_PREFERENCES) return '简洁回复' as never;
      if (key === STORAGE_KEYS.BRAND_ACCENT_COLOR) return '#009887' as never;
      if (key === STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) return 'doubao-seedream-5.0-lite' as never;
      return null;
    });

    const exported = buildExportData();
    const json = JSON.stringify(exported);
    const imported = parseImportFile(json);

    expect(imported.ok).toBe(true);
    if (imported.ok) {
      expect(imported.config.data.providers).toHaveLength(2);
      expect(imported.config.data.keys['deepseek']).toBe('sk-ds');
      expect(imported.config.data.keys['aihubmix']).toBe('sk-ah');
      expect(imported.config.data.pexelsKey).toBe('pk-test');
      expect(imported.config.data.defaultProviderId).toBe('deepseek');
      expect(imported.config.data.userPreferences).toBe('简洁回复');
      expect(imported.config.data.brandAccentColor).toBe('#009887');
      expect(imported.config.data.imageGenModel).toBe('doubao-seedream-5.0-lite');
    }
  });
});

// ---------------------------------------------------------------------------
// describe 7: applyImport（VALIDATION.md 用例 9）
// ---------------------------------------------------------------------------

describe('applyImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('调用后 useProviderStore.getState().setKey 被调用，最终 hydrateFromStorage() 被调用', async () => {
    const mockSetKey = vi.fn();
    const mockSetDefaultLLM = vi.fn();
    const mockSetAttachEnabled = vi.fn();
    const mockSetPrefs = vi.fn();
    const mockSetBrandAccentColor = vi.fn();

    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
      setKey: mockSetKey,
      setDefaultLLM: mockSetDefaultLLM,
      setAttachEnabled: mockSetAttachEnabled,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(usePreferencesStore.getState).mockReturnValue({
      setPrefs: mockSetPrefs,
      setBrandAccentColor: mockSetBrandAccentColor,
    } as unknown as ReturnType<typeof usePreferencesStore.getState>);

    const configData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
      ],
      keys: { deepseek: 'sk-imported-deepseek' },
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: true,
      userPreferences: '导入的偏好',
      brandAccentColor: '#009887',
      pexelsKey: 'pk-imported',
      imageGenModel: 'doubao-seedream-5.0-lite',
    };

    await applyImport(configData, {});

    // setKey 应被调用（用于导入 provider key）
    expect(mockSetKey).toHaveBeenCalledWith('deepseek', 'sk-imported-deepseek');
    // hydrateFromStorage 必须在最后被调用（F-07 守门）
    expect(hydrateFromStorage).toHaveBeenCalled();
  });

  it('applyImport 返回 ImportResult 含正确计数', async () => {
    const mockSetKey = vi.fn();
    const mockSetDefaultLLM = vi.fn();
    const mockSetAttachEnabled = vi.fn();
    const mockSetPrefs = vi.fn();
    const mockSetBrandAccentColor = vi.fn();

    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: [],
      setKey: mockSetKey,
      setDefaultLLM: mockSetDefaultLLM,
      setAttachEnabled: mockSetAttachEnabled,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(usePreferencesStore.getState).mockReturnValue({
      setPrefs: mockSetPrefs,
      setBrandAccentColor: mockSetBrandAccentColor,
    } as unknown as ReturnType<typeof usePreferencesStore.getState>);

    const configData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
        { id: 'custom-1', name: 'Custom', baseURL: 'https://c.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: { deepseek: 'sk-ds', 'custom-1': 'sk-c1' },
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: false,
      userPreferences: '测试偏好',
      brandAccentColor: '#123456',
      pexelsKey: '',
      imageGenModel: '',
    };

    const result = await applyImport(configData, {});

    expect(result.providerCount).toBe(2);
    expect(result.keyCount).toBe(2);
    expect(result.prefsRestored).toBe(true);
  });

  it('skipIds 中的 provider 被跳过，不 upsert', async () => {
    const mockSetKey = vi.fn();
    const mockSetDefaultLLM = vi.fn();
    const mockSetAttachEnabled = vi.fn();
    const mockSetPrefs = vi.fn();
    const mockSetBrandAccentColor = vi.fn();

    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
      setKey: mockSetKey,
      setDefaultLLM: mockSetDefaultLLM,
      setAttachEnabled: mockSetAttachEnabled,
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(usePreferencesStore.getState).mockReturnValue({
      setPrefs: mockSetPrefs,
      setBrandAccentColor: mockSetBrandAccentColor,
    } as unknown as ReturnType<typeof usePreferencesStore.getState>);

    const configData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
        { id: 'custom-skip', name: 'Skip Me', baseURL: 'https://s.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: { deepseek: 'sk-ds', 'custom-skip': 'sk-skip' },
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: true,
      userPreferences: '',
      brandAccentColor: '',
      pexelsKey: '',
      imageGenModel: '',
    };

    // 跳过 custom-skip，useProviderStore.setState 不应被 custom-skip 触发
    const res = await applyImport(configData, { skipIds: ['custom-skip'] });

    // hydrateFromStorage 仍然被调用
    expect(hydrateFromStorage).toHaveBeenCalled();

    // HR-01 结构性守门（凭证覆盖回归防线）：
    // 被跳过的 provider，其 API key 绝不可被导入文件里的 key 覆盖。
    expect(mockSetKey).not.toHaveBeenCalledWith('custom-skip', expect.anything());
    // 未跳过的 provider（deepseek）的 key 仍正常写入。
    expect(mockSetKey).toHaveBeenCalledWith('deepseek', 'sk-ds');
    // keyCount 同步只计未跳过的 key（skip 路径 toast 的密钥数不得偏大）。
    expect(res.keyCount).toBe(1);
  });

  it('HR-01：跳过多个冲突 provider 时，全部被跳 id 的 key 均不写入', async () => {
    const mockSetKey = vi.fn();

    vi.mocked(useProviderStore.getState).mockReturnValue({
      providers: mockBuiltinProviders,
      setKey: mockSetKey,
      setDefaultLLM: vi.fn(),
      setAttachEnabled: vi.fn(),
    } as unknown as ReturnType<typeof useProviderStore.getState>);

    vi.mocked(usePreferencesStore.getState).mockReturnValue({
      setPrefs: vi.fn(),
      setBrandAccentColor: vi.fn(),
    } as unknown as ReturnType<typeof usePreferencesStore.getState>);

    const configData = {
      providers: [
        { id: 'deepseek', name: 'DeepSeek', baseURL: 'https://api.deepseek.com', model: 'deepseek-v4-flash', isBuiltIn: true },
        { id: 'aihubmix', name: 'AiHubMix', baseURL: 'https://api.aihubmix.com/v1', model: 'gpt-5.1', isBuiltIn: true },
        { id: 'custom-new', name: 'New', baseURL: 'https://n.example.com', model: 'x', isBuiltIn: false },
      ],
      keys: { deepseek: 'sk-evil-ds', aihubmix: 'sk-evil-ah', 'custom-new': 'sk-new' },
      defaultProviderId: 'deepseek',
      selectionAttachEnabled: true,
      userPreferences: '',
      brandAccentColor: '',
      pexelsKey: '',
      imageGenModel: '',
    };

    // 两个内置 provider 都冲突 → 跳过；只有 custom-new 是新 id 应导入
    const res = await applyImport(configData, { skipIds: ['deepseek', 'aihubmix'] });

    expect(mockSetKey).not.toHaveBeenCalledWith('deepseek', expect.anything());
    expect(mockSetKey).not.toHaveBeenCalledWith('aihubmix', expect.anything());
    expect(mockSetKey).toHaveBeenCalledWith('custom-new', 'sk-new');
    expect(res.keyCount).toBe(1);
    expect(res.providerCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// describe 8: ASTER_CONFIG_VERSION 常量存在（文件导出核验）
// ---------------------------------------------------------------------------

describe('导出符号完整性', () => {
  it('ASTER_CONFIG_VERSION 是正数整数', () => {
    expect(typeof ASTER_CONFIG_VERSION).toBe('number');
    expect(ASTER_CONFIG_VERSION).toBeGreaterThan(0);
  });

  it('exportConfig 是函数', () => {
    expect(typeof exportConfig).toBe('function');
  });
});
