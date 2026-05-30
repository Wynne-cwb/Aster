/**
 * src/lib/docKey.ts — Phase 8 分文档存储 key 构建（HIST-04 / D-11）
 *
 * 安全约束（T-08-tokenleak）：
 * - 禁用 raw 完整 URL 作为 localStorage key（SharePoint URL 含 session token）
 * - 只取 URL pathname 末 80 字符，跳过 query/hash（session token 在此）
 * - btoa 结果替换 +/= 避免 URL 字符冲突
 *
 * Spike S6 结论（manual-only 真机验证）：
 * - Office for Web pathname 稳定 → 启用分文档存储（主路径）
 * - pathname 不稳定或 url 不可用 → 回退 GLOBAL_CHAT_KEY（备用路径）
 */

/** 分文档存储不可用时的全局 fallback key */
export const GLOBAL_CHAT_KEY = 'aster:chat:global';

/**
 * 从 URL 构建稳定 docKey。
 * 取 pathname 末 80 字符 → btoa URL-safe 变体（+ → _ / → - = → 空）。
 *
 * 导出供 docKey.test.ts 测试 query string 防泄露断言。
 */
export function hashUrl(url: string): string {
  let stablePart: string;
  try {
    const parsed = new URL(url);
    // 取 pathname 末 80 字符：跳过 query/hash（session token 在此）
    stablePart = parsed.pathname.slice(-80);
  } catch {
    // URL parse 失败（如 Windows 本地路径 C:\Users\...）→ 取末 80 字符
    stablePart = url.slice(-80);
  }
  try {
    // btoa 只接受 Latin-1；中文路径需 encodeURIComponent 先转义
    return (
      'aster:chat:' +
      btoa(unescape(encodeURIComponent(stablePart)))
        .replace(/\+/g, '_')
        .replace(/\//g, '-')
        .replace(/=/g, '')
    );
  } catch {
    return GLOBAL_CHAT_KEY;
  }
}

/**
 * 异步获取当前文档的稳定 docKey。
 *
 * 优先 Office.context.document.url（同步，Office for Web 通常直接可用）；
 * 不可用时 fallback getFilePropertiesAsync；两者都不可用返回 GLOBAL_CHAT_KEY。
 */
export async function getDocKey(): Promise<string> {
  // 同步路径（Office for Web 通常直接可用）
  try {
    const syncUrl = Office.context.document?.url;
    if (syncUrl) return hashUrl(syncUrl);
  } catch {
    // Office.context 不可用（测试环境）→ 继续异步路径
  }

  // 异步 fallback（Office Desktop 或 url 属性为 null 时）
  return new Promise((resolve) => {
    try {
      Office.context.document.getFilePropertiesAsync((result) => {
        const url = result?.value?.url;
        resolve(url ? hashUrl(url) : GLOBAL_CHAT_KEY);
      });
    } catch {
      resolve(GLOBAL_CHAT_KEY);
    }
  });
}
