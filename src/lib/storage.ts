/**
 * src/lib/storage.ts — partitioned localStorage 工具（KEY-01 / KEY-05）
 *
 * 所有 Aster 的 localStorage 操作都经此工具；
 * 不在其他文件直接调用 localStorage.setItem/getItem/removeItem。
 *
 * partitionKey 行为（Phase 0 GATING #3 已验证）：
 * - Office for Web (Chrome/Edge ≥115)：partitionKey = hash(top-level domain + addin domain)
 *   三宿主（PPT/Excel/Word）产生不同分区——Key 不在宿主间共享（设计上正确）
 * - Office on Windows (WebView)：partitionKey = undefined，无分区，直接用 rawKey
 * - 测试环境（Office 未定义）：fallback 到直接使用 rawKey
 *
 * D-14 quota guard：set() 捕获 DOMException QuotaExceededError → 转为 StorageQuotaError，
 * 其余 DOMException 原样 rethrow。
 */
import { StorageQuotaError } from '../errors/index';

/** 键名常量（RESEARCH.md §Storage 模式 键名约定表） */
export const STORAGE_KEYS = {
  /** Provider 配置列表（ProviderConfig[]，不含 apiKey） */
  PROVIDERS: 'aster:providers',
  /** 各 Provider 的 API Key 前缀（+ providerId 组成完整 key） */
  KEY_PREFIX: 'aster:keys:',
  /** Onboarding 是否已看过（boolean，D-04） */
  ONBOARDING_SEEN: 'aster:onboarding:seen',
  /** G-08 修订（02.1-08）：选区附带开关（boolean，D-32）。
   *  D-32 字面 key = 'selection_attach_enabled'（snake_case）；
   *  本仓库 STORAGE_KEYS 统一使用 'aster:' namespace 前缀约定（非 storage 工具自动注入），
   *  因此完整字面为 'aster:selection:attachEnabled'。
   *  D-32 语义约束（持久化到 partitioned localStorage、默认 true、不走 chatStore）全部兑现，
   *  字面差异仅为仓库 namespace 前缀，不构成 D-32 违背。
   *  prefixedKey() 另外注入 Office.context.partitionKey（与本前缀无关，那是浏览器分区隔离）。 */
  SELECTION_ATTACH_ENABLED: 'aster:selection:attachEnabled',
  /** @deprecated 02.1-08 起改用 SELECTION_ATTACH_ENABLED；保留常量用于一次性迁移读取旧 key。 */
  SELECTION_AUTO_ATTACH: 'aster:selection:autoAttach',
  /** 当前默认 LLM Provider ID（string） */
  DEFAULT_PROVIDER: 'aster:providers:default',
  // Phase 3 Plan 03-05 D-08 / D-19 G-05：AUTO_INSERT_MODE 已删除（v1 confirm/auto 砍）。
  // 残留 localStorage key `aster:autoInsertMode` 不做迁移清理（A6 决策：用户重装即丢）。
  /** Phase 8 F: 聊天记录 key 前缀（完整 key 由 docKey.ts 的 getDocKey() 生成，含 'aster:chat:' 前缀）*/
  CHAT_HISTORY_PREFIX: 'aster:chat:',
  /** Phase 8 A: 用户自定义偏好文本（string，~500 字符上限，已 sanitize 后存储）*/
  USER_PREFERENCES: 'aster:prefs:user',
} as const;

/**
 * 将 rawKey 加上 partitionKey 前缀。
 *
 * partitionKey 不存在时（Windows WebView 或测试环境）直接返回 rawKey。
 * Office.context 在 Office.onReady 之前可能不可用；
 * 组件和 store 只在 onReady 回调内调用 storage，因此此处安全。
 */
function prefixedKey(rawKey: string): string {
  const pk =
    typeof Office !== 'undefined' && Office?.context?.partitionKey
      ? (Office.context.partitionKey as string)
      : undefined;
  return pk ? `${pk}${rawKey}` : rawKey;
}

export const storage = {
  /**
   * 读取值，JSON.parse 后返回；键不存在或 JSON 非法时返回 null（不 throw）。
   * 不记录 JSON 解析错误日志（localStorage 值可能含敏感信息，T-02-08）。
   */
  get<T>(rawKey: string): T | null {
    try {
      const v = localStorage.getItem(prefixedKey(rawKey));
      return v !== null ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },

  /**
   * 写入值（JSON.stringify）。
   *
   * D-14 quota guard：捕获 DOMException QuotaExceededError（name 或 legacy code=22）→
   * 转为 StorageQuotaError；其余异常原样 rethrow。
   */
  set(rawKey: string, value: unknown): void {
    try {
      localStorage.setItem(prefixedKey(rawKey), JSON.stringify(value));
    } catch (err) {
      if (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22)
      ) {
        throw new StorageQuotaError();
      }
      throw err;
    }
  },

  /** 删除值。 */
  remove(rawKey: string): void {
    localStorage.removeItem(prefixedKey(rawKey));
  },
};
