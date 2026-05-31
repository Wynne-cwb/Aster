/**
 * src/utils/safeUrlTransform.ts
 * react-markdown urlTransform 回调——白名单放行，拦截危险协议（UI-01，D-03）。
 * 签名与 react-markdown@9.1.0 UrlTransform 类型兼容：(url: string, key: string, node: Element) => string
 * 实际只用 url 参数（key/node 忽略），便于 tree-shaking 和单测。
 *
 * 危险协议（javascript:/data:/vbscript:/file:）→ 返回 '' → react-markdown 把属性设为 '' → 链接退化为无 href 纯文本。
 * NOTE: 必须返回 '' 而非 null——null 会被序列化为 "null" 字符串出现在 href 属性中。
 *
 * CVE-2025-24981 同类防御：LLM 生成含 javascript: href 的 Markdown 链接，
 * 用户点击时在 TaskPane webview 执行任意 JS 可读取 API Key——urlTransform 返回 '' 切断攻击链。
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function safeUrlTransform(url: string): string {
  if (!url) return '';
  // 相对路径、锚点、协议相对 URL → 放行（无协议前缀，安全）
  if (
    url.startsWith('#') ||
    url.startsWith('/') ||
    url.startsWith('./') ||
    url.startsWith('../') ||
    url.startsWith('//')
  ) {
    return url;
  }
  try {
    const { protocol } = new URL(url);
    return SAFE_PROTOCOLS.has(protocol) ? url : '';
  } catch {
    // URL 解析失败（非标准格式）→ 保守放行（已排除了 # / ./ 等最常见相对路径）
    return url;
  }
}
