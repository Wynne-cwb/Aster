/**
 * src/components/InputBar.tsx — 统一输入容器（Phase 04.1 teal 重皮 D-01/D-02）
 *
 * WeChat 范式：.inputbar-wrap > .inputbar > [selpill-row?] + textarea + .tools
 *
 * 结构：
 * - selpill-row（顶部）：条件渲染，有选区（ctx 非空）时显示 SelectionPill
 * - textarea：auto-grow，最大 140px，无边框透明
 * - tools 行（底部）：gear 左 | paperclip disabled 中 | spacer | send 右
 *
 * Phase 3 改造（Plan 05 D-01 / A-14）行为保留：
 * - sendMessage 签名扩展为 (prompt, selectionCtx, adapter) — chatStore thin delegate
 * - Send 按钮在 agentStatus !== 'idle' 时 disabled（防止串场 prompt）
 * - stop 走 AgentControlBar（D-04 / AGENT-13 单一 abort 入口）
 *
 * onGoSettings prop（D-01）：齿轮按钮点击回调，由 App.tsx 传入 handleOpenSettings
 */
import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { ClipboardIcon, GearIcon, PaperclipIcon, SendIcon, StopIcon } from './icons';
import SelectionPill from './SelectionPill';
import { useChatStore } from '../store/chat';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { useAgentStatus } from '../agent/agentStore';
import { useSelectionStore } from '../store/selection';

interface InputBarProps {
  onGoSettings: () => void;
}

export default function InputBar({ onGoSettings }: InputBarProps): React.ReactElement {
  const { t } = useLingui();
  const adapter = useAdapter();

  // 输入框文本
  const [text, setText] = useState('');

  // 复制调试信息按钮：2 秒「已复制」反馈
  const [copied, setCopied] = useState(false);

  // Plan 05 A-14：agentStatus !== 'idle' 时禁用发送（防串场 prompt）
  const agentStatus = useAgentStatus();
  const isAgentBusy = agentStatus !== 'idle';

  // Store action — sendMessage 改 thin delegate（Plan 05 D-01）
  const sendMessage = useChatStore((s) => s.sendMessage);

  // 选区状态：kind !== 'none' 时在顶部显示 selpill-row（条件渲染 D-02）
  const selectionInitial = useSelectionStore((s) => s.initial);
  const hasSelection = selectionInitial.kind !== 'none';

  /** 发送消息：构建 prompt + 可选选区上下文 */
  const handleSend = async (): Promise<void> => {
    const prompt = text.trim();
    if (!prompt || isAgentBusy) return;

    setText('');

    // G-08 D-34：读 attachEnabled，false → 不取选区
    const attachEnabled = useProviderStore.getState().attachEnabled;
    const sel = attachEnabled ? await adapter.getSelection() : undefined;
    // Plan 05 D-01：3 参签名，把 adapter 注入 chatStore.sendMessage → useAgentStore.runAgent
    await sendMessage(prompt, sel ?? undefined, adapter);
  };

  /** 复制调试信息到剪贴板，成功后 2 秒「已复制」反馈。
   *  debugReport 懒加载（dynamic import）——调试工具非热路径，不进初始 bundle（守 size-limit 预算）。 */
  const handleCopyDebug = async (): Promise<void> => {
    const { buildDebugReport, copyToClipboard } = await import('../lib/debugReport');
    const report = await buildDebugReport();
    const ok = await copyToClipboard(report);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  /** 按下 Enter 发送（Shift+Enter 换行） */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div className="inputbar-wrap">
      <div className="inputbar">

        {/* selpill-row：有选区时条件渲染（D-02 — 选区信息从 ContextCard 迁入此处） */}
        {hasSelection && (
          <div className="selpill-row">
            <SelectionPill />
          </div>
        )}

        {/* textarea：auto-grow，最大 140px */}
        <textarea
          className="chat-input"
          rows={2}
          placeholder={isAgentBusy ? t`AI 正在回答…` : t`输入消息…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isAgentBusy}
          aria-label={t`消息输入框`}
        />

        {/* tools row：gear 左 | paperclip disabled 中 | spacer | send 右 */}
        <div className="tools">
          <button
            type="button"
            className="tool-btn"
            aria-label={t`设置`}
            onClick={() => onGoSettings()}
          >
            <GearIcon size={15} strokeWidth={1.4} />
          </button>
          <button
            type="button"
            className="tool-btn"
            aria-label={copied ? t`已复制` : t`复制调试信息`}
            title={copied ? t`已复制 ✓` : t`复制调试信息`}
            onClick={() => void handleCopyDebug()}
          >
            <ClipboardIcon size={15} strokeWidth={1.4} />
          </button>
          <button
            type="button"
            className="tool-btn"
            aria-disabled="true"
            aria-label={t`文件上传`}
            title={t`文件上传即将开放`}
            style={{ opacity: 0.38, cursor: 'not-allowed' }}
          >
            <PaperclipIcon size={15} />
          </button>
          <span className="tools-spacer" />
          <button
            type="button"
            className="send-btn"
            data-streaming={isAgentBusy || undefined}
            disabled={isAgentBusy || !text.trim()}
            onClick={() => void handleSend()}
            aria-label={isAgentBusy ? t`停止` : t`发送`}
          >
            {isAgentBusy ? <StopIcon size={11} /> : <SendIcon size={13} />}
          </button>
        </div>
      </div>
    </div>
  );
}
