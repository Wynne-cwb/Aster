/**
 * src/lib/storage.test.ts — partitioned localStorage 工具单元测试（KEY-01 / KEY-05）
 *
 * 测试策略：
 * - vi.stubGlobal 分别 mock Office.context.partitionKey（有值 / undefined）
 * - vi.stubGlobal mock localStorage（in-memory 实现）
 * - 覆盖 storage.get / storage.set / storage.remove + JSON 解析失败 + STORAGE_KEYS 常量
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { storage, STORAGE_KEYS } from './storage';

// ---------------------------------------------------------------------------
// In-memory localStorage mock
// ---------------------------------------------------------------------------

function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get _store() { return store; },
  };
}

// ---------------------------------------------------------------------------
// 辅助：设置 Office mock
// ---------------------------------------------------------------------------

function mockOffice(partitionKey: string | undefined) {
  vi.stubGlobal('Office', {
    context: {
      partitionKey,
    },
  });
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------

describe('storage（partitionKey 有值时）', () => {
  let ls: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    mockOffice('pk_');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('storage.set 应使用 partitionKey 前缀后的 key', () => {
    storage.set('foo', 42);
    expect(ls.setItem).toHaveBeenCalledWith('pk_foo', '42');
  });

  it('storage.get 应读取 partitionKey 前缀后的 key，并 JSON.parse', () => {
    ls._store['pk_foo'] = '42';
    const result = storage.get<number>('foo');
    expect(ls.getItem).toHaveBeenCalledWith('pk_foo');
    expect(result).toBe(42);
  });

  it('storage.remove 应使用 partitionKey 前缀后的 key', () => {
    storage.remove('foo');
    expect(ls.removeItem).toHaveBeenCalledWith('pk_foo');
  });

  it('storage.get 不存在的 key 应返回 null', () => {
    const result = storage.get('nonexistent');
    expect(result).toBeNull();
  });

  it('storage.get 畸形 JSON 应返回 null（不 throw）', () => {
    ls._store['pk_malformed'] = '{invalid json}';
    const result = storage.get('malformed');
    expect(result).toBeNull();
  });
});

describe('storage（partitionKey 为 undefined 时）', () => {
  let ls: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    mockOffice(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('storage.set 直接使用 rawKey（无前缀）', () => {
    storage.set('foo', 42);
    expect(ls.setItem).toHaveBeenCalledWith('foo', '42');
  });

  it('storage.get 直接使用 rawKey（无前缀）', () => {
    ls._store['foo'] = '"hello"';
    const result = storage.get<string>('foo');
    expect(ls.getItem).toHaveBeenCalledWith('foo');
    expect(result).toBe('hello');
  });

  it('storage.remove 直接使用 rawKey（无前缀）', () => {
    storage.remove('foo');
    expect(ls.removeItem).toHaveBeenCalledWith('foo');
  });
});

describe('storage（Office 未定义时）', () => {
  let ls: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    // 完全不定义 Office（模拟 Office.js 未加载的测试环境）
    vi.stubGlobal('Office', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Office 未定义时不 throw，直接使用 rawKey', () => {
    expect(() => storage.set('foo', 'bar')).not.toThrow();
    expect(ls.setItem).toHaveBeenCalledWith('foo', '"bar"');
  });
});

// ---------------------------------------------------------------------------
// quota guard — Wave 1b 实现 StorageQuotaError 后变绿
// ---------------------------------------------------------------------------

describe('quota guard（storage.set QuotaExceededError 转换 — D-14）', () => {
  let ls: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    mockOffice(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('setItem QuotaExceededError（name）→ StorageQuotaError', async () => {
    const { StorageQuotaError } = await import('../errors/index');
    ls.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError', 'QuotaExceededError');
    });
    expect(() => storage.set('k', 'v')).toThrow(StorageQuotaError);
  });

  it('setItem QuotaExceededError（code=22）→ StorageQuotaError', async () => {
    const { StorageQuotaError } = await import('../errors/index');
    ls.setItem.mockImplementation(() => {
      // Legacy: code 22 = QUOTA_EXCEEDED_ERR
      const err = new DOMException('quota exceeded', 'UnknownError');
      Object.defineProperty(err, 'code', { value: 22 });
      throw err;
    });
    expect(() => storage.set('k', 'v')).toThrow(StorageQuotaError);
  });

  it('非 QuotaExceeded DOMException → 原样 rethrow（不包成 StorageQuotaError）', async () => {
    const { StorageQuotaError } = await import('../errors/index');
    ls.setItem.mockImplementation(() => {
      throw new DOMException('some other error', 'NotFoundError');
    });
    expect(() => storage.set('k', 'v')).toThrow(DOMException);
    expect(() => storage.set('k', 'v')).not.toThrow(StorageQuotaError);
  });

  it('StorageQuotaError hint 包含存储相关中文提示', async () => {
    const { StorageQuotaError } = await import('../errors/index');
    const err = new StorageQuotaError();
    expect(err.hint).toMatch(/存储|清理|浏览器/);
    expect(err.recoverable).toBe(false);
    expect(err.code).toBe('STORAGE_QUOTA');
  });
});

describe('STORAGE_KEYS 常量', () => {
  it('应包含 PROVIDERS 键', () => {
    expect(STORAGE_KEYS.PROVIDERS).toBe('aster:providers');
  });

  it('应包含 ONBOARDING_SEEN 键', () => {
    expect(STORAGE_KEYS.ONBOARDING_SEEN).toBe('aster:onboarding:seen');
  });

  it('应包含 SELECTION_ATTACH_ENABLED 键（G-08 02.1-08，替代旧 autoAttach）', () => {
    expect(STORAGE_KEYS.SELECTION_ATTACH_ENABLED).toBe('aster:selection:attachEnabled');
  });

  it('应保留 SELECTION_AUTO_ATTACH 键（@deprecated，用于迁移读取）', () => {
    expect(STORAGE_KEYS.SELECTION_AUTO_ATTACH).toBe('aster:selection:autoAttach');
  });

  it('应包含 DEFAULT_PROVIDER 键', () => {
    expect(STORAGE_KEYS.DEFAULT_PROVIDER).toBe('aster:providers:default');
  });

  it('应包含 KEY_PREFIX 键', () => {
    expect(STORAGE_KEYS.KEY_PREFIX).toBe('aster:keys:');
  });

  it('应包含 PREF_IMAGE_GEN_MODEL 键（Phase 16 IMG-04 D-04）', () => {
    expect(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL).toBe('aster:pref:image-gen-model');
  });

  it('应包含 PEXELS_API_KEY / PEXELS_BASE_URL 键（Phase 18 LIB-01 D-08/D-09）', () => {
    expect(STORAGE_KEYS.PEXELS_API_KEY).toBe('aster:keys:pexels');
    expect(STORAGE_KEYS.PEXELS_BASE_URL).toBe('aster:config:pexels-base-url');
  });

  it('共包含 11 个键（Phase 18 LIB-01 新增 PEXELS_API_KEY + PEXELS_BASE_URL）', () => {
    expect(Object.keys(STORAGE_KEYS)).toHaveLength(11);
  });

  it('AUTO_INSERT_MODE 已从 STORAGE_KEYS 删除（Phase 3 D-08 / D-19 G-05）', () => {
    expect((STORAGE_KEYS as Record<string, string>).AUTO_INSERT_MODE).toBeUndefined();
  });
});
