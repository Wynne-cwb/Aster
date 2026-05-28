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
// AutoInsertMode — D-19 G-05
// ---------------------------------------------------------------------------

export type AutoInsertMode = 'confirm' | 'auto';

// ---------------------------------------------------------------------------
// ProviderState 接口
// ---------------------------------------------------------------------------

interface ProviderState {
  providers: ProviderConfig[];
  defaultLLMProviderId: string;
  /** G-08 修订（02.1-08）：原 autoAttach → attachEnabled（语义更准）。
   *  true = 发消息时附带选区 / 眼睛开；false = 不附带 / 眼睛闭（胶囊仍在屏）。
   *  持久化到 STORAGE_KEYS.SELECTION_ATTACH_ENABLED（D-32）。 */
  attachEnabled: boolean;
  /** D-19 G-05：AI 写文档模式，'confirm'（默认，用户审批）| 'auto'（直接写入） */
  autoInsertMode: AutoInsertMode;

  addProvider(config: Omit<ProviderConfig, 'id'>): void;
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
  /** D-19 G-05：设置 AI 写文档模式并持久化 */
  setAutoInsertMode(v: AutoInsertMode): void;
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
  // D-19 G-05：默认 'confirm'（用户审批，安全优先）
  autoInsertMode: storage.get<AutoInsertMode>(STORAGE_KEYS.AUTO_INSERT_MODE) ?? 'confirm',

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

  setAutoInsertMode(v) {
    set({ autoInsertMode: v });
    storage.set(STORAGE_KEYS.AUTO_INSERT_MODE, v);
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

  // D-19 G-05：恢复 autoInsertMode
  const autoInsertMode = storage.get<AutoInsertMode>(STORAGE_KEYS.AUTO_INSERT_MODE) ?? 'confirm';

  if (stored && stored.length > 0) {
    useProviderStore.setState({
      providers: stored,
      defaultLLMProviderId: defaultId,
      attachEnabled,
      autoInsertMode,
    });
  } else {
    // 无存储数据时也恢复 attachEnabled / autoInsertMode（可能已被用户改过）
    useProviderStore.setState({ attachEnabled, autoInsertMode });
  }
}
