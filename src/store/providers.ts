/**
 * src/store/providers.ts — Provider 配置 Zustand Store（KEY-01 / KEY-05 / D-15）
 *
 * 职责：
 * - 管理用户配置的 Provider 列表（内置 + 自定义）
 * - 持久化 providers / defaultLLMProviderId / attachEnabled 到 localStorage（via storage）
 * - apiKey 单独存储在 `aster:keys:{providerId}`，不放入 ProviderConfig 对象
 * - hydrateFromStorage()：供 main.tsx 在 Office.onReady 后调用，恢复上次配置
 *
 * 安全约束（T-02-18）：
 * - getKey 仅供 ProviderRegistry 内部调用，不将 Key 暴露到组件 props
 * - ProviderConfig 存储不含 apiKey（分开存储）
 *
 * attachEnabled（D-15 / G-08 02.1-08 修订，原 autoAttach）：
 * - 初始值优先从 storage.get(SELECTION_ATTACH_ENABLED) 读取；
 *   新 key 不存在但旧 SELECTION_AUTO_ATTACH 存在 → 用旧值并在 hydrateFromStorage 时写入新 key（一次性迁移）
 * - setAttachEnabled 写回新 key SELECTION_ATTACH_ENABLED，供 SelectionPill 眼睛 toggle 和 SettingsPanel 消费
 */

import { create } from 'zustand';
import type { ProviderConfig } from '../providers/types';
import { storage, STORAGE_KEYS } from '../lib/storage';

// ---------------------------------------------------------------------------
// 内置 Provider model 下拉清单（D-07 / CARRY-02）
// ---------------------------------------------------------------------------

/** 内置 Provider 的 model 固定清单，供 ProviderForm select 渲染。
 *  key = provider.id；value = 合法 model 字符串数组（按推荐顺序排列）。 */
export const BUILTIN_MODEL_OPTIONS: Record<string, string[]> = {
  deepseek: ['deepseek-v4-pro', 'deepseek-v4-flash'],
  // gpt-5.1 / gemini-3.5-flash：支持 tool calling 的多模态聊天 model（D-07）
  aihubmix: ['gpt-5.1', 'gemini-3.5-flash'],
};

// ---------------------------------------------------------------------------
// 内置 Provider（isBuiltIn=true，不可删除）
// ---------------------------------------------------------------------------

const BUILT_IN_PROVIDERS: ProviderConfig[] = [
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
    // Open Q2 / D-08：兜底 LLM model 改 gpt-5.1（在 D-07 清单内，避免 select 落清单外）
    model: 'gpt-5.1',
    isBuiltIn: true,
  },
];

// ---------------------------------------------------------------------------
// configuredKeyIds 计算（WR-01）
// ---------------------------------------------------------------------------

/**
 * computeConfiguredKeyIds — 扫描 storage，返回给定 providers 中「已存非空 apiKey」的 id 列表。
 *
 * WR-01：banner 显隐原本读 `getKey()`（localStorage），不是 Zustand state，setKey 也从不 set()，
 * 导致配置 Key 后红条不刷新。把「哪些 provider 配了 Key」做成响应式 state（仅 id，不含 Key 值，
 * 遵守 T-02-18 不暴露 Key 到 UI），banner selector 订阅它即可即时更新。
 */
function computeConfiguredKeyIds(providers: ProviderConfig[]): string[] {
  return providers
    .filter((p) => !!storage.get<string>(STORAGE_KEYS.KEY_PREFIX + p.id))
    .map((p) => p.id);
}

// ---------------------------------------------------------------------------
// ProviderState 接口
// ---------------------------------------------------------------------------
//
// Phase 3 改造（Plan 03-05 D-08 / D-19 G-05）：
//   AutoInsertMode 类型 / autoInsertMode 字段 / setAutoInsertMode 方法 / hydrate
//   读路径全部删除 —— v1 confirm/auto 双模式砍，agent loop 是唯一主路径（D-01）。
//   storage 内的 AUTO_INSERT_MODE 常量已在 src/lib/storage.ts 删除。
//   残留 localStorage key (`aster:autoInsertMode`) 不做迁移清理（A6 决策）。

interface ProviderState {
  providers: ProviderConfig[];
  defaultLLMProviderId: string;
  /** G-08 修订（02.1-08）：原 autoAttach → attachEnabled（语义更准）。
   *  true = 发消息时附带选区 / 眼睛开；false = 不附带 / 眼睛闭（胶囊仍在屏）。
   *  持久化到 STORAGE_KEYS.SELECTION_ATTACH_ENABLED（D-32）。 */
  attachEnabled: boolean;

  /** WR-01：已配置非空 Key 的 provider id 列表（响应式）。仅存 id，不存 Key 值（T-02-18 不暴露
   *  Key 到 UI）。banner / hasKey selector 订阅它，使「配置 Key 后红条即时消失」。
   *  由 setKey / removeProvider / hydrateFromStorage 维护，与 storage 中的 KEY_PREFIX 项同步。 */
  configuredKeyIds: string[];

  /** WR-07：返回新建 Provider 的 id，供调用方直接写 Key，避免依赖数组末尾位置的脆弱假设 */
  addProvider(config: Omit<ProviderConfig, 'id'>): string;
  updateProvider(id: string, patch: Partial<ProviderConfig>): void;
  removeProvider(id: string): void;
  setDefaultLLM(id: string): void;
  /** apiKey 单独存储，不放入 ProviderConfig（安全约束 T-02-18） */
  setKey(providerId: string, apiKey: string): void;
  /** getKey 仅供 ProviderRegistry 调用，不暴露给 UI 层 */
  getKey(providerId: string): string | null;
  /** G-08：写 SELECTION_ATTACH_ENABLED，供 SettingsPanel 开关和 SelectionPill 眼睛 toggle 调用 */
  setAttachEnabled(v: boolean): void;
  /** D-18 G-05：标记 Provider 是否支持 tool-call（4xx + tool 关键词 → false；成功调用过 → true） */
  setSupportsToolCall(providerId: string, supports: boolean): void;
}

// ---------------------------------------------------------------------------
// useProviderStore
// ---------------------------------------------------------------------------

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: BUILT_IN_PROVIDERS,
  defaultLLMProviderId: 'deepseek',
  // G-08：优先读新 key；新 key 不存在则 fallback 到旧 key（迁移路径），最终默认 true（D-15）
  attachEnabled:
    storage.get<boolean>(STORAGE_KEYS.SELECTION_ATTACH_ENABLED) ??
    storage.get<boolean>(STORAGE_KEYS.SELECTION_AUTO_ATTACH) ??
    true,
  // WR-01：初始扫描内置 Provider 的已存 Key；自定义 Provider 在 hydrateFromStorage 时补算
  configuredKeyIds: computeConfiguredKeyIds(BUILT_IN_PROVIDERS),

  addProvider(config) {
    const id = crypto.randomUUID();
    const newProvider: ProviderConfig = { ...config, id };
    const updated = [...get().providers, newProvider];
    set({ providers: updated });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
    return id; // WR-07：返回新建 id，caller 可直接 setKey(id, key)
  },

  updateProvider(id, patch) {
    const updated = get().providers.map((p) => (p.id === id ? { ...p, ...patch } : p));
    set({ providers: updated });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
  },

  removeProvider(id) {
    const p = get().providers.find((p) => p.id === id);
    if (p?.isBuiltIn) return; // 内置 Provider 不可删除
    const updated = get().providers.filter((p) => p.id !== id);
    set({
      providers: updated,
      // WR-01：provider 删除后其 id 不再算「已配置 Key」（孤儿 storage key 不影响响应式判断）
      configuredKeyIds: get().configuredKeyIds.filter((kid) => kid !== id),
    });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
  },

  setDefaultLLM(id) {
    set({ defaultLLMProviderId: id });
    storage.set(STORAGE_KEYS.DEFAULT_PROVIDER, id);
  },

  setKey(providerId, apiKey) {
    storage.set(STORAGE_KEYS.KEY_PREFIX + providerId, apiKey);
    // WR-01：把「该 provider 是否已配置非空 Key」反映进响应式 state，banner/hasKey selector
    // 才能在配置后即时更新。仅当成员资格变化时 set，避免多余渲染。
    const has = !!apiKey;
    const ids = get().configuredKeyIds;
    const had = ids.includes(providerId);
    if (has !== had) {
      set({
        configuredKeyIds: has
          ? [...ids, providerId]
          : ids.filter((id) => id !== providerId),
      });
    }
  },

  getKey(providerId) {
    return storage.get<string>(STORAGE_KEYS.KEY_PREFIX + providerId);
  },

  setAttachEnabled(v) {
    set({ attachEnabled: v });
    storage.set(STORAGE_KEYS.SELECTION_ATTACH_ENABLED, v);
  },

  setSupportsToolCall(providerId, supports) {
    const updated = get().providers.map((p) =>
      p.id === providerId ? { ...p, supportsToolCall: supports } : p,
    );
    set({ providers: updated });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
  },
}));

// ---------------------------------------------------------------------------
// hydrateFromStorage — 在 Office.onReady 后调用，恢复用户上次配置
// ---------------------------------------------------------------------------

/**
 * hydrateFromStorage — 从 localStorage 恢复 Provider 配置。
 *
 * 调用时机：main.tsx Office.onReady 回调内，root.render 之前。
 * 若 storage 无数据则保持内置 Provider 默认值不变。
 */
export function hydrateFromStorage(): void {
  const stored = storage.get<ProviderConfig[]>(STORAGE_KEYS.PROVIDERS);
  const defaultId = storage.get<string>(STORAGE_KEYS.DEFAULT_PROVIDER) ?? 'deepseek';

  // G-08 迁移（02.1-08）：先读新 key；新 key 不存在但旧 key 有值 → 用旧值并写入新 key（一次性迁移）
  const newVal = storage.get<boolean>(STORAGE_KEYS.SELECTION_ATTACH_ENABLED);
  const oldVal = storage.get<boolean>(STORAGE_KEYS.SELECTION_AUTO_ATTACH);
  const attachEnabled = newVal ?? oldVal ?? true;
  if (newVal == null && oldVal != null) {
    // 一次性迁移：将旧 key 值写入新 key，下次启动走纯新 key 路径
    storage.set(STORAGE_KEYS.SELECTION_ATTACH_ENABLED, oldVal);
  }

  if (stored && stored.length > 0) {
    // WR-02 修复：hydrate 时强制合并 BUILT_IN_PROVIDERS，防止 localStorage 污染导致内置 Provider 消失。
    // 以 id 为主键：stored 中不含某内置 id → 补入；含有 → 强制覆盖 isBuiltIn=true（防外部篡改）。
    const storedById = new Map(stored.map((p) => [p.id, p]));
    for (const builtin of BUILT_IN_PROVIDERS) {
      const existing = storedById.get(builtin.id);
      if (!existing) {
        storedById.set(builtin.id, builtin);
      } else {
        // 保留用户改过的 model/baseURL，但强制 isBuiltIn=true
        storedById.set(builtin.id, { ...existing, isBuiltIn: true });
      }
    }
    // 保持顺序：先内置（按 BUILT_IN_PROVIDERS 顺序），再自定义
    const builtinIds = new Set(BUILT_IN_PROVIDERS.map((p) => p.id));
    const mergedProviders: typeof BUILT_IN_PROVIDERS = [
      ...BUILT_IN_PROVIDERS.map((b) => storedById.get(b.id)!),
      ...stored.filter((p) => !builtinIds.has(p.id)),
    ];
    useProviderStore.setState({
      providers: mergedProviders,
      defaultLLMProviderId: defaultId,
      attachEnabled,
      // WR-01：合并完整 provider 列表（含自定义）后重算已配置 Key 的 id
      configuredKeyIds: computeConfiguredKeyIds(mergedProviders),
    });
  } else {
    // 无存储数据时也恢复 attachEnabled（可能已被用户改过）
    useProviderStore.setState({
      attachEnabled,
      configuredKeyIds: computeConfiguredKeyIds(BUILT_IN_PROVIDERS),
    });
  }
}
