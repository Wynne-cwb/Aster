/**
 * src/lib/copyStepLog.ts — 一键复制操作记录（Phase 5 Plan 09 CARRY-03）
 *
 * 导出：
 *   buildStepLog(): Promise<string>  — 组装三角色（user/assistant/tool）Markdown 操作记录
 *   copyToClipboard(text): Promise<boolean> — 复用 debugReport.ts，不重写
 *
 * 安全约束（T-05-09-01）：
 *   - 绝不调用 getKey()
 *   - 绝不读取 aster:keys:* localStorage
 *   - 只输出 configuredKeyIds（id 列表，不含 Key 值）
 *   - redactKey 过滤正文中可能粘贴进来的 sk-* Key 片段（防用户意外泄露场景）
 */

import { useChatStore } from '../store/chat';
import { formatTime } from '../utils/formatTime';
export { copyToClipboard } from './clipboard';

// ---------------------------------------------------------------------------
// redactKey — 脱敏正文中的 API Key 片段（T-05-09-01 守门）
// ---------------------------------------------------------------------------

/**
 * 将文本中形如 sk-XXXXXXXX 的字符串替换为 [API KEY REDACTED]。
 *
 * 安全约束：
 *   - 不调用 getKey()
 *   - 不读取 localStorage
 *   - 仅通过正则过滤传入文本中可能粘贴进来的 Key 片段
 */
export function redactKey(text: string): string {
  return text.replace(/(sk-[A-Za-z0-9\-_]{4,})/g, '[API KEY REDACTED]');
}

// ---------------------------------------------------------------------------
// buildStepLog — 三角色 Markdown dump（D-19 全量三角色，D-21 脱敏）
// ---------------------------------------------------------------------------

/**
 * 组装操作记录 Markdown 文本。
 * 包含 user / assistant / tool 三种 role 的所有消息，脱敏后输出。
 *
 * 安全约束（T-05-09-01）：
 *   - 所有正文经 redactKey() 处理，确保 sk-* Key 片段不出现在输出中
 *   - 不调用 getKey()，不读取 aster:keys:* localStorage
 */
export async function buildStepLog(): Promise<string> {
  const lines: string[] = [
    '# Aster 操作记录',
    `生成时间：${new Date().toISOString()}`,
    '',
  ];

  const messages = useChatStore.getState().messages;

  if (messages.length === 0) {
    lines.push('（无操作记录）');
    return lines.join('\n');
  }

  for (const msg of messages) {
    const time = formatTime(msg.ts ?? 0);

    if (msg.role === 'user') {
      lines.push(`## [${time}] 用户`);
      lines.push(redactKey(msg.content ?? ''));
      lines.push('');
    } else if (msg.role === 'assistant') {
      lines.push(`## [${time}] Aster`);
      lines.push(redactKey(msg.content ?? ''));
      lines.push('');
    } else if (msg.role === 'tool') {
      lines.push(`### [${time}] 工具调用：${msg.toolName ?? 'unknown'}`);
      lines.push(`- 描述：${redactKey(msg.content ?? '')}`);
      lines.push(`- 结果：${msg.toolResult?.ok ? '成功' : '失败'}`);
      // 260604-gld：失败时打印 sanitize 后的错误原因（之前只有「失败」二字无从诊断）。
      // error.code/message/hint 是 AsterError 构造时的中文字面量（非宿主原文），
      // 仍走 redactKey 防御性脱敏。
      const stepErr = msg.toolResult?.error;
      if (msg.toolResult?.ok === false && stepErr) {
        lines.push(`- 错误：${redactKey(stepErr.code ?? '')} ${redactKey(stepErr.message ?? '')}`);
        if (stepErr.hint) {
          lines.push(`- 提示：${redactKey(stepErr.hint)}`);
        }
      }
      if (msg.toolResult?.data !== undefined && msg.toolResult.data !== null) {
        lines.push(`- 数据：${JSON.stringify(msg.toolResult.data)}`);
      }
      lines.push('');
    }
    // 'error' role 不纳入操作记录（仅用于 UI 气泡展示，非操作步骤）
  }

  return lines.join('\n');
}
