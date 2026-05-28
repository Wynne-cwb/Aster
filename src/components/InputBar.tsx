/**
 * src/components/InputBar.tsx — 玻璃拟态输入栏（Phase 3 Plan 05 改造后）
 *
 * 统一输入容器（WeChat 范式）：一个圆角容器内，
 * 上方可选的选区胶囊（SelectionPill，D-15），
 * 中间是无边框透明输入框，
 * 下方一条工具行——工具靠左下、发送靠右下。
 *
 * Phase 3 改造（Plan 05 D-01 / A-14）：
 * - sendMessage 签名扩展为 (prompt, selectionCtx, adapter) — chatStore thin delegate
 *   到 useAgentStore.runAgent 需要 adapter 入参（loop.ts 在 agent loop 内调 adapter.appendParagraph 等）
 * - Send 按钮在 agentStatus !== 'idle' 时 disabled：防止用户在 agent run 中串场 prompt
 *   - 停止 agent 走 AgentControlBar 「中止」按钮（D-10 / AGENT-13 单一 abort 入口）
 *   - v1 D-14「发送/停止原地切换」在 agent loop 时代退役（按钮只承担发送）
 *
 * 文件上传按钮：Phase 3+ 实现，当前诚实禁用（降不透明度 + not-allowed）。
 * 文案全 Lingui macro 包裹。视觉系统见 styles.css。
 */
import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { UploadIcon, SendIcon } from './icons';
import SelectionPill from './SelectionPill';
import { useChatStore } from '../store/chat';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { useAgentStatus } from '../agent/agentStore';

export default function InputBar(): React.ReactElement {
  const { t } = useLingui();
  const adapter = useAdapter();

  // 输入框文本
  const [text, setText] = useState('');

  // Plan 05 A-14：agentStatus !== 'idle' 时禁用发送（防串场 prompt）
  const agentStatus = useAgentStatus();
  const isAgentBusy = agentStatus !== 'idle';

  // Store action — sendMessage 改 thin delegate（Plan 05 D-01）
  const sendMessage = useChatStore((s) => s.sendMessage);

  /** 发送消息：构建 prompt + 可选选区上下文 */
  const handleSend = async (): Promise<void> => {
    const prompt = text.trim();
    if (!prompt || isAgentBusy) return;

    setText('');

    // G-08 D-34：读 attachEnabled，false → 不取选区
    // useProviderStore.getState() 是非订阅式读取，避免组件每次 attachEnabled 变就重渲。
    const attachEnabled = useProviderStore.getState().attachEnabled;
    const sel = attachEnabled ? await adapter.getSelection() : undefined;
    // Plan 05 D-01：3 参签名，把 adapter 注入 chatStore.sendMessage → useAgentStore.runAgent
    await sendMessage(prompt, sel ?? undefined, adapter);
  };

  /** 按下 Enter 发送（Shift+Enter 换行） */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="aster-inputbar">
      {/* 选区胶囊（D-15 / G-08）：attachEnabled 控制是否附带（眼睛 toggle 持久化）。
          02.1 UAT-1 ④：移除 × 临时隐藏入口（与眼睛 toggle 语义重叠），胶囊始终渲染。 */}
      <div className="aster-inputbar__pill-row">
        <SelectionPill />
      </div>

      <div className="aster-composer">
        {/* 输入框（无边框透明，Phase 2 已激活）；agent busy 时一并禁用 — 防止用户键入半成品 prompt */}
        <textarea
          className="aster-field"
          rows={2}
          placeholder={t`输入消息…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAgentBusy}
          aria-label={t`消息输入框`}
        />

        {/* 工具行：上传（左）· 发送（右） */}
        <div className="aster-composer__toolbar">
          {/* 文件上传：Phase 3+ 实现，诚实禁用 */}
          <button
            className="aster-iconbtn"
            disabled
            aria-label={t`文件上传即将开放`}
            title={t`文件上传即将开放`}
          >
            <UploadIcon />
          </button>

          {/* Send：Plan 05 A-14 — agentStatus !== 'idle' 时 disabled；
              停止 agent 由 AgentControlBar 「中止」按钮负责（D-10 / AGENT-13 单一 abort 入口） */}
          <button
            type="button"
            className="aster-send"
            onClick={() => void handleSend()}
            aria-label={t`发送`}
            aria-disabled={isAgentBusy || !text.trim() ? 'true' : 'false'}
            title={isAgentBusy ? t`Agent 正在运行` : t`发送`}
            disabled={isAgentBusy || !text.trim()}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
