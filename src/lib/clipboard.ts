/**
 * src/lib/clipboard.ts — 剪贴板写入工具（260530-c14）
 *
 * 独立模块，无上游依赖，供 debugReport.ts 与 copyStepLog.ts 共同 re-export。
 * T-vtc-04：失败静默（不崩溃，返回 false）。
 */

/**
 * 将文本写入剪贴板。
 * 先尝试 navigator.clipboard.writeText（现代 API），失败则 fallback 到
 * textarea + execCommand('copy')（旧式兜底）。
 *
 * T-vtc-04：失败静默（按钮不给反馈），不崩溃。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fallback: textarea + execCommand
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}
