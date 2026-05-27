/**
 * src/store/providers.ts — Provider 配置 Zustand Store（KEY-01 / KEY-05 / D-15）
 *
 * 职责：
 * - 管理用户配置的 Provider 列表（内置 + 自定义）
 * - 持久化 providers / defaultLLMProviderId / autoAttach 到 localStorage（via storage）
 * - apiKey 单独存储在 `aster:keys:{providerId}`，不放入 ProviderConfig 对象
 * - hydrateFromStorage()：供 main.tsx 在 Office.onReady 后调用，恢复上次配置
 *
 * 安全约束（T-02-18）：
 * - getKey 仅供 ProviderRegistry 内部调用，不将 Key 暴露到组件 props
 * - ProviderConfig 存储不含 apiKey（分开存储）
 *
 * autoAttach（D-15）：
 * - 初始值从 storage.get(SELECTION_AUTO_ATTACH) ?? true 读取
 * - setAutoAttach 写回 storage，供 Wave 4 SelectionPill 消费
 */

import { create } from 'zustand';
import type { ProviderConfig } from '../providers/types';
import { storage, STORAGE_KEYS } from '../lib/storage';

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
    model: 'gpt-image-1',
    isBuiltIn: true,
  },
];

// ---------------------------------------------------------------------------
// ProviderState 接口
// ---------------------------------------------------------------------------

interface ProviderState {
  providers: ProviderConfig[];
  defaultLLMProviderId: string;
  /** D-15：选区自动附带开关，持久化到 SELECTION_AUTO_ATTACH */
  autoAttach: boolean;

  addProvider(config: Omit<ProviderConfig, 'id'>): void;
  updateProvider(id: string, patch: Partial<ProviderConfig>): void;
  removeProvider(id: string): void;
  setDefaultLLM(id: string): void;
  /** apiKey 单独存储，不放入 ProviderConfig（安全约束 T-02-18） */
  setKey(providerId: string, apiKey: string): void;
  /** getKey 仅供 ProviderRegistry 调用，不暴露给 UI 层 */
  getKey(providerId: string): string | null;
  /** 写 storage，供 SettingsPanel 和 SelectionPill 调用 */
  setAutoAttach(v: boolean): void;
}

// ---------------------------------------------------------------------------
// useProviderStore
// ---------------------------------------------------------------------------

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: BUILT_IN_PROVIDERS,
  defaultLLMProviderId: 'deepseek',
  autoAttach: storage.get<boolean>(STORAGE_KEYS.SELECTION_AUTO_ATTACH) ?? true,

  addProvider(config) {
    const id = crypto.randomUUID();
    const newProvider: ProviderConfig = { ...config, id };
    const updated = [...get().providers, newProvider];
    set({ providers: updated });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
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
    set({ providers: updated });
    storage.set(STORAGE_KEYS.PROVIDERS, updated);
  },

  setDefaultLLM(id) {
    set({ defaultLLMProviderId: id });
    storage.set(STORAGE_KEYS.DEFAULT_PROVIDER, id);
  },

  setKey(providerId, apiKey) {
    storage.set(STORAGE_KEYS.KEY_PREFIX + providerId, apiKey);
  },

  getKey(providerId) {
    return storage.get<string>(STORAGE_KEYS.KEY_PREFIX + providerId);
  },

  setAutoAttach(v) {
    set({ autoAttach: v });
    storage.set(STORAGE_KEYS.SELECTION_AUTO_ATTACH, v);
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
  const autoAttach = storage.get<boolean>(STORAGE_KEYS.SELECTION_AUTO_ATTACH) ?? true;

  if (stored && stored.length > 0) {
    useProviderStore.setState({
      providers: stored,
      defaultLLMProviderId: defaultId,
      autoAttach,
    });
  } else {
    // 无存储数据时也恢复 autoAttach（可能已被用户改过）
    useProviderStore.setState({ autoAttach });
  }
}
