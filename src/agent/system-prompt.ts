/**
 * src/agent/system-prompt.ts — Phase 3 占位（Plan 08 接力 refine 文本）
 *
 * Plan 08 会替换为完整 demo system prompt（含 parallel tool_calls 引导 + evidence 提示）。
 */
type HostKey = 'word' | 'excel' | 'ppt';

const HOST_LABEL: Record<HostKey, string> = {
  word: 'Microsoft Word',
  excel: 'Microsoft Excel',
  ppt: 'Microsoft PowerPoint',
};

export function buildSystemPrompt(host: HostKey): string {
  // 最小占位 — Plan 08 替换为完整 demo prompt（含 parallel tool_calls 引导 + evidence 提示）
  return `你是 Aster — 嵌在 ${HOST_LABEL[host]} 里的 AI 智能代理。回复用简体中文。`;
}
