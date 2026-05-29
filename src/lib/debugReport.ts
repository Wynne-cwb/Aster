/**
 * src/lib/debugReport.ts — 一键复制调试信息（VTC 260529）
 *
 * 导出：
 *   buildDebugReport(): Promise<string>  — 组装 5 节 Markdown 报告
 *   copyToClipboard(text): Promise<boolean> — 写入剪贴板（主 + fallback）
 *
 * 安全约束（T-vtc-01）：
 *   - 绝不调用 getKey()
 *   - 绝不读取 aster:keys:* localStorage
 *   - 只输出 configuredKeyIds（id 列表，不含 Key 值）
 *
 * T-vtc-03：只记录 partitionKey 是否存在（boolean），不记录 partitionKey 值
 * T-vtc-02：用户正文截断 500 字符（防超长泄露大段机密）
 * T-vtc-04：Office API / clipboard 失败全部 try/catch，不崩溃
 */

import { useProviderStore } from '../store/providers';
import { useAgentStore } from '../agent/agentStore';
import { useChatStore } from '../store/chat';
import { useSelectionStore } from '../store/selection';
import { formatTime } from '../utils/formatTime';

// ---------------------------------------------------------------------------
// buildDebugReport
// ---------------------------------------------------------------------------

export async function buildDebugReport(): Promise<string> {
  const sections: string[] = [];

  // 报告头
  sections.push(`# Aster Debug Report\n生成时间：${new Date().toISOString()}\n`);

  // ## 环境
  sections.push(buildEnvSection());

  // ## Provider 配置
  sections.push(buildProviderSection());

  // ## Agent 状态
  sections.push(buildAgentSection());

  // ## 当前选区（含异步正文读取）
  sections.push(await buildSelectionSection());

  // ## 聊天记录
  sections.push(buildChatSection());

  return sections.join('\n');
}

// ---------------------------------------------------------------------------
// 各节构建函数
// ---------------------------------------------------------------------------

function buildEnvSection(): string {
  const lines: string[] = ['## 环境', ''];

  // Office diagnostics（T-vtc-03：不输出 partitionKey 值，只记录是否存在）
  try {
    const diag =
      typeof Office !== 'undefined' && Office?.context?.diagnostics
        ? Office.context.diagnostics
        : null;
    if (diag) {
      lines.push(`- host: ${String((diag as { host?: unknown }).host ?? 'N/A')}`);
      lines.push(`- platform: ${String((diag as { platform?: unknown }).platform ?? 'N/A')}`);
      lines.push(`- version: ${String((diag as { version?: unknown }).version ?? 'N/A')}`);
    } else {
      lines.push('- diagnostics: N/A');
    }
  } catch {
    lines.push('- diagnostics: N/A');
  }

  // partitionKey 存在性（T-vtc-03：只 boolean）
  const hasPartitionKey =
    typeof Office !== 'undefined' &&
    Office?.context != null &&
    typeof (Office.context as { partitionKey?: unknown }).partitionKey !== 'undefined';
  lines.push(`- partitionKey: ${hasPartitionKey ? 'present' : 'absent'}`);

  // userAgent（截前 120 字）
  const ua =
    typeof navigator !== 'undefined'
      ? navigator.userAgent.slice(0, 120)
      : 'N/A';
  lines.push(`- userAgent: ${ua}`);

  // theme
  const theme =
    typeof document !== 'undefined'
      ? (document.querySelector('#root') as HTMLElement | null)?.dataset.theme ?? 'unknown'
      : 'N/A';
  lines.push(`- theme: ${theme}`);

  // inOffice
  const inOffice = typeof Office !== 'undefined';
  lines.push(`- inOffice: ${inOffice}`);

  // BASE_URL（仅在 Vite 环境有效）
  const baseUrl =
    typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL != null
      ? String(import.meta.env.BASE_URL)
      : 'N/A';
  lines.push(`- BASE_URL: ${baseUrl}`);

  lines.push('');
  return lines.join('\n');
}

function buildProviderSection(): string {
  const lines: string[] = ['## Provider 配置', ''];

  // ⚠️ 绝不调 getKey()，绝不读 localStorage
  const state = useProviderStore.getState();
  lines.push(`- defaultLLMProviderId: ${state.defaultLLMProviderId}`);
  lines.push(`- attachEnabled: ${state.attachEnabled}`);
  lines.push(`- configuredKeyIds: [${state.configuredKeyIds.join(', ')}]`);
  lines.push('');
  lines.push('**Providers:**');

  for (const p of state.providers) {
    lines.push(
      `- ${p.id} | ${p.name} | ${p.baseURL} | model: ${p.model}` +
        ` | isBuiltIn: ${p.isBuiltIn ?? false}` +
        ` | supportsToolCall: ${p.supportsToolCall ?? 'unknown'}`,
    );
  }

  lines.push('');
  return lines.join('\n');
}

function buildAgentSection(): string {
  const lines: string[] = ['## Agent 状态', ''];

  const state = useAgentStore.getState();
  lines.push(`- agentStatus: ${state.agentStatus}`);
  lines.push(`- currentStep: ${state.currentStep}`);
  lines.push(`- currentPhase: ${state.currentPhase ?? 'null'}`);
  lines.push(`- lastAbortReason: ${state.lastAbortReason ?? '无'}`);

  if (state.lastCircuitInfo) {
    const ci = state.lastCircuitInfo;
    lines.push(`- lastCircuitInfo: toolName=${ci.toolName} code=${ci.code} count=${ci.count}`);
  } else {
    lines.push('- lastCircuitInfo: 无');
  }

  lines.push('');
  return lines.join('\n');
}

async function buildSelectionSection(): Promise<string> {
  const lines: string[] = ['## 当前选区', ''];

  const initial = useSelectionStore.getState().initial;

  if (initial.kind === 'none') {
    lines.push('无选区');
  } else if (initial.kind === 'ppt') {
    lines.push(`- kind: ppt`);
    lines.push(`- slideIndex: ${initial.slideIndex}`);
    lines.push(`- slideCount: ${initial.slideCount}`);
    lines.push('- 正文: PPT 宿主暂无正文读取');
  } else if (initial.kind === 'excel') {
    lines.push(`- kind: excel`);
    lines.push(`- address: ${initial.address}`);

    const text = await readExcelSelection();
    lines.push(`- 正文: ${text}`);
  } else if (initial.kind === 'word') {
    lines.push(`- kind: word`);
    lines.push(`- charCount: ${initial.charCount}`);

    const text = await readWordSelection();
    lines.push(`- 正文: ${text}`);
  }

  lines.push('');
  return lines.join('\n');
}

async function readExcelSelection(): Promise<string> {
  try {
    // eslint-disable-next-line no-undef
    const text = await Excel.run(async (ctx) => {
      const r = (ctx as unknown as { workbook: { getSelectedRange: () => { load: (f: string) => void; text: string[][] } } }).workbook.getSelectedRange();
      r.load('text');
      await (ctx as unknown as { sync: () => Promise<void> }).sync();
      return r.text.flat().join(' ');
    });
    return String(text).slice(0, 500);
  } catch {
    return '无法读取（Office API 不可用）';
  }
}

async function readWordSelection(): Promise<string> {
  try {
    // eslint-disable-next-line no-undef
    const text = await Word.run(async (ctx) => {
      const sel = (ctx as unknown as { document: { getSelection: () => { load: (f: string) => void; text: string } } }).document.getSelection();
      sel.load('text');
      await (ctx as unknown as { sync: () => Promise<void> }).sync();
      return sel.text;
    });
    return String(text).slice(0, 500);
  } catch {
    return '无法读取（Office API 不可用）';
  }
}

function buildChatSection(): string {
  const lines: string[] = ['## 聊天记录', ''];

  const { messages } = useChatStore.getState();

  if (messages.length === 0) {
    lines.push('（无消息）');
  } else {
    for (const msg of messages) {
      const time = formatTime(msg.ts ?? 0);
      const prefix = `[${time} ${msg.role}]`;
      const content = msg.content.length > 300
        ? msg.content.slice(0, 300) + '…'
        : msg.content;

      let line = `${prefix} ${content}`;

      if (msg.role === 'tool') {
        line += ` | toolName=${msg.toolName ?? ''} ok=${msg.toolResult?.ok ?? '?'}`;
      }
      if (msg.role === 'error') {
        line += ` | errorCode=${msg.errorCode ?? ''}`;
      }
      if (msg.isStreaming) {
        line += ' [streaming]';
      }

      lines.push(line);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// copyToClipboard
// ---------------------------------------------------------------------------

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
