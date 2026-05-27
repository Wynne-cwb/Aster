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
 */

/** 键名常量（RESEARCH.md §Storage 模式 键名约定表） */
export const STORAGE_KEYS = {
  /** Provider 配置列表（ProviderConfig[]，不含 apiKey） */
  PROVIDERS: 'aster:providers',
  /** 各 Provider 的 API Key 前缀（+ providerId 组成完整 key） */
  KEY_PREFIX: 'aster:keys:',
  /** Onboarding 是否已看过（boolean，D-04） */
  ONBOARDING_SEEN: 'aster:onboarding:seen',
  /** 选区自动附带开关（boolean，D-15） */
  SELECTION_AUTO_ATTACH: 'aster:selection:autoAttach',
  /** 当前默认 LLM Provider ID（string） */
  DEFAULT_PROVIDER: 'aster:providers:default',
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

  /** 写入值（JSON.stringify）。 */
  set(rawKey: string, value: unknown): void {
    localStorage.setItem(prefixedKey(rawKey), JSON.stringify(value));
  },

  /** 删除值。 */
  remove(rawKey: string): void {
    localStorage.removeItem(prefixedKey(rawKey));
  },
};
