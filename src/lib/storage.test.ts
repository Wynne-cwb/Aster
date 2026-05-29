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

describe('quota guard（Wave 1b stubs — storage.set QuotaExceededError 转换）', () => {
  let ls: ReturnType<typeof makeLocalStorageMock>;

  beforeEach(() => {
    ls = makeLocalStorageMock();
    vi.stubGlobal('localStorage', ls);
    mockOffice(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.todo('setItem QuotaExceededError → StorageQuotaError（Wave 1b 实现后展开）');
  // Wave 1b 实现后将展开为：
  // import { StorageQuotaError } from './storage'; // 或 '../errors'
  // ls.setItem.mockImplementation(() => {
  //   throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  // });
  // expect(() => storage.set('k', 'v')).toThrow(StorageQuotaError);

  it.todo('非 QuotaExceeded DOMException → 原样 rethrow（Wave 1b 实现后展开）');
  // ls.setItem.mockImplementation(() => {
  //   throw new DOMException('NotFoundError', 'NotFoundError');
  // });
  // expect(() => storage.set('k', 'v')).toThrow(DOMException);
  // expect(() => storage.set('k', 'v')).not.toThrow(StorageQuotaError);
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

  it('共包含 6 个键（Phase 3 Plan 03-05 删 AUTO_INSERT_MODE 后；保留旧 SELECTION_AUTO_ATTACH 迁移 key）', () => {
    expect(Object.keys(STORAGE_KEYS)).toHaveLength(6);
  });

  it('AUTO_INSERT_MODE 已从 STORAGE_KEYS 删除（Phase 3 D-08 / D-19 G-05）', () => {
    expect((STORAGE_KEYS as Record<string, string>).AUTO_INSERT_MODE).toBeUndefined();
  });
});
