/**
 * src/utils/formatTime.ts
 *
 * 格式化时间戳为 "MM-DD HH:MM" 格式
 * 用于 ChatBubble 气泡底部时间标签（--font-mono，11px）
 *
 * 移植自 .planning/design/aster-redesign/src/proto-app.jsx lines 11–19
 */

/**
 * 将 Unix 毫秒时间戳格式化为 "MM-DD HH:MM" 字符串
 * @param ts - Unix 毫秒时间戳
 * @returns 格式化后的时间字符串，或空字符串（ts 为 0/undefined 时）
 */
export function formatTime(ts: number): string {
  if (!ts) return '';
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${mo}-${da} ${h}:${m}`;
}
