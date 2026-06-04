/**
 * src/lib/hostErrorLog.ts — 宿主原始错误本地诊断环形缓冲（260604-gld UAT-2）
 *
 * 目的：把 Office.js 宿主操作的**原始报错 message** 留在本地，供「复制调试报告」
 * 就近渲染，让用户无需开 DevTools (F12) 翻 iframe 控制台即可看到失败工具的原始原因。
 *
 * ⚠ 隐私边界（硬约束）：
 *   - 本缓冲是**纯内存**模块级状态：不 import 宿主 API、不碰 network、不碰 localStorage。
 *   - 只接收 HostApiError 的 debugCause（已在 errors/index.ts 截断 300 字、仅取
 *     cause.message，不含 stack/path）。host 端 Office.js 报错结构上不含用户 LLM Key
 *     （Key 只在直连 Provider 的 fetch 路径，不在 Office.js 操作里）。
 *   - **绝不**进 ToolResult / LLM wire——dispatchTool 仍按 ERR-02 脱敏，只是额外往此缓冲记一笔。
 *   - **绝不**持久化：刷新页面即清空（模块级变量），符合「只为当下调试」的定位。
 */

export interface HostErrorEntry {
  /** 失败的工具名（如 'apply_slide_layout'）。来自 dispatchTool 的 call.name。 */
  readonly toolName: string;
  /** 宿主原始错误 message（HostApiError.debugCause，已截断 300 字）。 */
  readonly cause: string;
  /** 记录时刻 ISO 字符串（运行时浏览器代码，new Date().toISOString()）。 */
  readonly isoTime: string;
}

/** 环形缓冲容量上限：只留最近 N 条，防长会话无限增长占内存。 */
const CAP = 12;

/** 模块级缓冲（纯内存，刷新即失）。最旧在前、最新在后。 */
let buffer: HostErrorEntry[] = [];

/** 记录一条宿主原始错误。超过 CAP 时丢弃最旧（保留最近 CAP 条）。 */
export function recordHostError(entry: HostErrorEntry): void {
  buffer.push({
    toolName: entry.toolName,
    cause: entry.cause,
    isoTime: entry.isoTime,
  });
  if (buffer.length > CAP) {
    buffer = buffer.slice(buffer.length - CAP);
  }
}

/**
 * 返回最近记录（只读副本，按时间顺序：最旧在前、最新在后）。
 * 返回的是 slice 副本，外部对其修改不影响内部缓冲。
 */
export function getRecentHostErrors(): readonly HostErrorEntry[] {
  return buffer.slice();
}

/** 清空缓冲（测试用例之间复位，避免串扰）。 */
export function clearHostErrors(): void {
  buffer = [];
}
