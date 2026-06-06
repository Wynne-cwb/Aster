/**
 * src/lib/configBackup.ts — 配置导入导出核心逻辑（CFG-01 / CFG-02）
 *
 * 职责：
 * - buildExportData() — 从 storage + store 收集全部 D-02 锁定字段，构造 AsterConfigExport
 * - exportConfig() — 调用 buildExportData() 后触发浏览器下载（Blob + <a> click）
 * - parseImportFile() — 解析并校验 JSON 字符串，返回结构化 Result（不 throw）
 * - detectConflicts() — 纯函数，识别 imported providers 中与当前 providers 同 id 的冲突项
 * - applyImport() — 副作用层：upsert providers + 写 keys + 写偏好 + hydrateFromStorage
 *
 * 安全约束：
 * - 永不收集聊天历史 / 引导已读标记 / Pexels Worker 兜底地址（D-02 out-of-scope）
 * - API key 仅落用户本地文件（Blob 浏览器下载），不经 Aster 服务器（no-backend 硬约束）
 * - applyImport 写入后必须调用 hydrateFromStorage() 刷新 configuredKeyIds（F-07 / WR-01）
 * - provider upsert 使用方案 A（useProviderStore.setState 直接 upsert），保留原 id（F-08）
 */

import { storage, STORAGE_KEYS } from './storage';
import { useProviderStore, hydrateFromStorage } from '../store/providers';
import { usePreferencesStore } from '../store/preferences';
import type { ProviderConfig } from '../providers/types';

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export const ASTER_CONFIG_VERSION = 1;

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

export interface AsterConfigExport {
  app: 'aster';
  version: number;
  exportedAt: string; // ISO 8601
  data: AsterConfigData;
}

export interface AsterConfigData {
  providers: ProviderConfig[];
  keys: Record<string, string>; // key = provider.id（逐 provider 一条）；'pexels' 走单独字段
  defaultProviderId: string;
  selectionAttachEnabled: boolean;
  userPreferences: string;
  brandAccentColor: string;
  pexelsKey: string;
  imageGenModel: string;
}

export type ImportErrorCode =
  | 'INVALID_JSON'
  | 'NOT_ASTER_CONFIG'
  | 'UNSUPPORTED_VERSION'
  | 'EMPTY_CONFIG';

export interface ImportError {
  code: ImportErrorCode;
  message: string;
  hint: string;
}

export interface ImportResult {
  providerCount: number;
  keyCount: number;
  prefsRestored: boolean;
}

// ---------------------------------------------------------------------------
// 内部：schema 校验
// ---------------------------------------------------------------------------

/**
 * 检查对象是否符合 AsterConfigExport 结构。
 * 只做结构性检查（app/version/data 存在性），不验证 data 内容的深度语义。
 */
function validateAsterConfig(parsed: unknown): parsed is AsterConfigExport {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const p = parsed as Record<string, unknown>;
  if (p['app'] !== 'aster') return false;
  if (typeof p['version'] !== 'number') return false;
  if (typeof p['data'] !== 'object' || p['data'] === null) return false;
  const data = p['data'] as Record<string, unknown>;
  if (!Array.isArray(data['providers'])) return false;
  if (typeof data['keys'] !== 'object' || data['keys'] === null) return false;
  return true;
}

/**
 * isValidProviderConfig — MR-02：逐元素校验导入 provider 结构。
 * 合法 = 非空 string id + string name/baseURL/model（缺失或类型错误一律拒绝）。
 * 顶层 validateAsterConfig 只查 providers 是数组、不查元素结构，损坏/恶意元素
 * （如 `{}`、`{ id: 123 }`、`{ id: 'x', baseURL: null }`）需在此拦截，
 * 否则会被 upsertProviderById 当作垃圾对象持久化进 store/storage。
 */
function isValidProviderConfig(p: unknown): p is ProviderConfig {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' &&
    o['id'].trim().length > 0 &&
    typeof o['name'] === 'string' &&
    typeof o['baseURL'] === 'string' &&
    typeof o['model'] === 'string'
  );
}

// ---------------------------------------------------------------------------
// 纯函数层
// ---------------------------------------------------------------------------

/**
 * buildExportData — 从 storage + Zustand store 收集全部 D-02 锁定字段，返回 AsterConfigExport。
 *
 * 字段集（锁定，D-02）：
 *   providers, keys（per-provider API key），defaultProviderId，selectionAttachEnabled，
 *   userPreferences，brandAccentColor，pexelsKey，imageGenModel
 *
 * 不收集（D-02 out-of-scope，grep 守门）：
 *   聊天历史 / 引导已读标记 / Pexels Worker 兜底地址
 */
export function buildExportData(): AsterConfigExport {
  const providers = useProviderStore.getState().providers;

  // 遍历 providers 收集 API key（参考 computeConfiguredKeyIds 范式）
  const keys: Record<string, string> = {};
  for (const p of providers) {
    const k = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + p.id);
    if (k) keys[p.id] = k;
  }

  // Pexels key 单独读（走 PEXELS_API_KEY，不走 KEY_PREFIX，单独字段）
  const pexelsKey = storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '';

  // 其余字段
  const defaultProviderId = storage.get<string>(STORAGE_KEYS.DEFAULT_PROVIDER) ?? 'deepseek';
  const selectionAttachEnabled = storage.get<boolean>(STORAGE_KEYS.SELECTION_ATTACH_ENABLED) ?? true;
  const userPreferences = storage.get<string>(STORAGE_KEYS.USER_PREFERENCES) ?? '';
  const brandAccentColor = storage.get<string>(STORAGE_KEYS.BRAND_ACCENT_COLOR) ?? '';
  const imageGenModel = storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? '';

  return {
    app: 'aster',
    version: ASTER_CONFIG_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      providers,
      keys,
      defaultProviderId,
      selectionAttachEnabled,
      userPreferences,
      brandAccentColor,
      pexelsKey,
      imageGenModel,
    },
  };
}

/**
 * exportConfig — 触发浏览器下载配置 JSON 文件（F-04，零新依赖）。
 *
 * 文件名：aster-config-YYYYMMDD.json
 * 安全：key 仅落用户本地文件（Blob 浏览器直接下载），不经 Aster 服务器。
 */
export function exportConfig(): void {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `aster-config-${ymd}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * parseImportFile — 解析并校验导入的 JSON 字符串（T-26-01 mitigate）。
 *
 * 返回 Result 形态（不 throw）：
 *   { ok: true; config: AsterConfigExport }
 *   { ok: false; error: { code: ImportErrorCode; message: string; hint: string } }
 *
 * 错误码：
 *   INVALID_JSON        — JSON.parse 失败
 *   NOT_ASTER_CONFIG    — 缺 app/version/data 或 app !== 'aster'
 *   UNSUPPORTED_VERSION — version > ASTER_CONFIG_VERSION
 *   EMPTY_CONFIG        — providers 为空且 keys 为空
 */
export function parseImportFile(
  raw: string,
): { ok: true; config: AsterConfigExport } | { ok: false; error: ImportError } {
  // 1. JSON.parse
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      ok: false,
      error: {
        code: 'INVALID_JSON',
        message: '文件不是有效的 JSON 格式',
        hint: '请确认文件未损坏，且是由 Aster「导出配置」生成的 JSON 文件。',
      },
    };
  }

  // 2. 结构校验（app / version / data）
  if (!validateAsterConfig(parsed)) {
    return {
      ok: false,
      error: {
        code: 'NOT_ASTER_CONFIG',
        message: '此文件不是 Aster 配置文件',
        hint: '请选择由 Aster「导出配置」按钮生成的 JSON 文件（文件名通常为 aster-config-*.json）。',
      },
    };
  }

  // 3. 版本检查
  if (parsed.version > ASTER_CONFIG_VERSION) {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED_VERSION',
        message: `配置文件版本 ${parsed.version} 高于当前支持的版本 ${ASTER_CONFIG_VERSION}`,
        hint: '请更新 Aster 至最新版本后再导入，或使用当前版本导出的配置文件。',
      },
    };
  }

  // 4. 空配置检查（providers 为空且 keys 为空）
  const data = parsed.data as AsterConfigData;
  if (
    (!data.providers || data.providers.length === 0) &&
    (!data.keys || Object.keys(data.keys).length === 0)
  ) {
    return {
      ok: false,
      error: {
        code: 'EMPTY_CONFIG',
        message: '配置文件中没有可导入的内容',
        hint: '此文件不含任何 Provider 或 API Key 配置。请确认导出时已配置好 Provider。',
      },
    };
  }

  return { ok: true, config: parsed };
}

/**
 * detectConflicts — 纯函数，返回 imported.providers 中与 currentProviders 存在同 id 的 id 列表。
 *
 * 无副作用，可独立测试。
 * 同 id = 内置（deepseek/aihubmix）或自定义 Provider 的 id 相同。
 */
export function detectConflicts(
  imported: AsterConfigData,
  currentProviders: ProviderConfig[],
): string[] {
  const currentIds = new Set(currentProviders.map((p) => p.id));
  return imported.providers
    .filter((p) => currentIds.has(p.id))
    .map((p) => p.id);
}

// ---------------------------------------------------------------------------
// 副作用层
// ---------------------------------------------------------------------------

/**
 * upsertProviderById — 方案 A：直接通过 useProviderStore.setState upsert，
 * 绕开 addProvider 的 crypto.randomUUID() 障碍，保留导入 provider 的原 id（F-08）。
 */
function upsertProviderById(config: ProviderConfig): void {
  const store = useProviderStore.getState();
  const exists = store.providers.find((p) => p.id === config.id);
  const updated = exists
    ? store.providers.map((p) => (p.id === config.id ? { ...config } : p))
    : [...store.providers, config];
  useProviderStore.setState({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
}

/**
 * applyImport — 副作用层：将导入的配置写入 store + storage，最后统一调用 hydrateFromStorage()。
 *
 * 流程：
 * 1. upsert providers（跳过 skipIds 中的 id）
 * 2. 写 API keys（逐 provider setKey，跳过 pexels）
 * 3. 写 Pexels key（storage.set）
 * 4. 写 imageGenModel（storage.set）
 * 5. 写用户偏好（usePreferencesStore.getState().setPrefs，含 sanitize）
 * 6. 写品牌强调色（usePreferencesStore.getState().setBrandAccentColor，含 normalizeHexColor）
 * 7. 写默认 Provider（setDefaultLLM）
 * 8. 写 attachEnabled（setAttachEnabled）
 * 9. hydrateFromStorage()（F-07 守门：重算 configuredKeyIds，消除红条）
 */
export async function applyImport(
  config: AsterConfigData,
  options: { skipIds?: string[] },
): Promise<ImportResult> {
  const { skipIds = [] } = options;
  const skipSet = new Set(skipIds);

  // MR-02：逐元素校验 provider 结构，过滤掉损坏/恶意元素（缺 id/name/baseURL/model 或类型错误）。
  // 顶层 validateAsterConfig 只查 providers 是数组、不查元素，不在此过滤会把垃圾对象持久化进 store。
  const validProviders = config.providers.filter(isValidProviderConfig);
  const validProviderIds = new Set(validProviders.map((p) => p.id));

  // 1. upsert providers（保留原 id，绕开 addProvider 的 randomUUID 障碍；跳过 skipIds）
  for (const provider of validProviders) {
    if (!skipSet.has(provider.id)) {
      upsertProviderById(provider);
    }
  }

  // 2. 写 API keys（逐 provider setKey，跳过 pexels id）
  // HR-01：被跳过（skipIds）的 provider 其 API key 不得被覆盖——
  // 「跳过冲突项」语义 = 保留本地现有，含密钥；否则用户主动选择「不动我的」却被静默换 key（凭证级数据丢失）。
  // MR-02：只为「结构合法的 provider」写 key（连带跳过损坏 provider 的 key，不留孤儿密钥）。
  const store = useProviderStore.getState();
  let keyCount = 0;
  for (const [id, key] of Object.entries(config.keys)) {
    if (id !== 'pexels' && key && !skipSet.has(id) && validProviderIds.has(id)) {
      store.setKey(id, key);
      keyCount++;
    }
  }

  // 3. 写 Pexels key（storage.set，无 Zustand setter）
  if (config.pexelsKey) {
    storage.set(STORAGE_KEYS.PEXELS_API_KEY, config.pexelsKey);
  }

  // 4. 写 imageGenModel（storage.set，组件态需 importNonce 刷新）
  if (config.imageGenModel) {
    storage.set(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL, config.imageGenModel);
  }

  // 5. 写用户偏好（setPrefs 含 sanitizePrefs，T-26-03 mitigate）
  // MR-01：合并语义对齐对话框承诺「保留现有 + 加入新的」——仅在导入文件确有偏好时覆盖。
  // 空字符串 / 缺失的 userPreferences 不得清空导入方现有偏好（旧逻辑 setPrefs('') 会清空）。
  const prefsStore = usePreferencesStore.getState();
  const hasUserPrefs = typeof config.userPreferences === 'string' && config.userPreferences.trim().length > 0;
  const hasAccent = typeof config.brandAccentColor === 'string' && config.brandAccentColor.trim().length > 0;
  const hasPrefs = hasUserPrefs || hasAccent;
  if (hasUserPrefs) {
    prefsStore.setPrefs(config.userPreferences);
  }

  // 6. 写品牌强调色（setBrandAccentColor 含 normalizeHexColor，非法 hex 静默忽略）
  // MR-01：仅在导入值非空时覆盖（空字符串保持现有主题色，与 userPreferences 守门一致）。
  if (hasAccent) {
    prefsStore.setBrandAccentColor(config.brandAccentColor);
  }

  // 7. 写默认 Provider（MR-01：空值不覆盖现有默认，避免把 default 设成 '' 破坏选中态）
  if (config.defaultProviderId) {
    store.setDefaultLLM(config.defaultProviderId);
  }

  // 8. 写 attachEnabled
  store.setAttachEnabled(config.selectionAttachEnabled ?? true);

  // 9. 最后统一调用 hydrateFromStorage（F-07 守门：重算 configuredKeyIds，红条消失路径）
  hydrateFromStorage();

  return {
    providerCount: validProviders.filter((p) => !skipSet.has(p.id)).length,
    keyCount,
    prefsRestored: hasPrefs,
  };
}
