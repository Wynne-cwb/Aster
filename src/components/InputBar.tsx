/**
 * src/components/InputBar.tsx — 玻璃拟态输入栏（Phase 2 Wave 5 已激活）
 *
 * 统一输入容器（WeChat 范式）：一个圆角容器内，
 * 上方可选的选区胶囊（SelectionPill，D-15），
 * 中间是无边框透明输入框，
 * 下方一条工具行——工具靠左下、发送靠右下。
 *
 * 发送/停止原地切换（D-14）：
 * - isStreaming=false：发送图标，onClick → handleSend
 * - isStreaming=true：停止方块，onClick → stopStreaming
 *
 * 文件上传按钮：Phase 3 实现，当前诚实禁用（降不透明度 + not-allowed）。
 * 文案全 Lingui macro 包裹。视觉系统见 styles.css。
 */
import { useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { UploadIcon, SendIcon, StopIcon } from './icons';
import SelectionPill from './SelectionPill';
import { useChatStore, useIsStreaming } from '../store/chat';
import { useAdapter } from '../context/AdapterContext';

export default function InputBar(): React.ReactElement {
  const { t } = useLingui();
  const adapter = useAdapter();

  // 输入框文本
  const [text, setText] = useState('');

  // 选区胶囊关闭状态（× 按钮后此次消息不附带选区）
  const [selectionDismissed, setSelectionDismissed] = useState(false);

  // 流式状态（D-14：发送/停止原地切换）
  const isStreaming = useIsStreaming();

  // Store actions
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopStreaming = useChatStore((s) => s.stopStreaming);

  /** 发送消息：构建 prompt + 可选选区上下文 */
  const handleSend = async (): Promise<void> => {
    const prompt = text.trim();
    if (!prompt || isStreaming) return;

    setText('');
    setSelectionDismissed(false); // 发送后重置，下条消息重新附带

    // 若选区胶囊未被 × 关闭，则附带当前选区（D-15）
    const sel = !selectionDismissed ? await adapter.getSelection() : undefined;
    await sendMessage(prompt, sel ?? undefined);
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
      {/* 选区胶囊（D-15）：autoAttach=true 且未被 × 关闭时显示 */}
      {!selectionDismissed && (
        <div className="aster-inputbar__pill-row">
          <SelectionPill onDismiss={() => setSelectionDismissed(true)} />
        </div>
      )}

      <div className="aster-composer">
        {/* 输入框（无边框透明，Phase 2 已激活） */}
        <textarea
          className="aster-field"
          rows={2}
          placeholder={t`输入消息…`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          aria-label={t`消息输入框`}
        />

        {/* 工具行：上传（左）· 发送/停止（右） */}
        <div className="aster-composer__toolbar">
          {/* 文件上传：Phase 3 实现，诚实禁用（D-XX） */}
          <button
            className="aster-iconbtn"
            disabled
            aria-label={t`文件上传即将开放`}
            title={t`文件上传即将开放`}
          >
            <UploadIcon />
          </button>

          {/* 发送/停止原地切换（D-14） */}
          <button
            className="aster-send"
            onClick={isStreaming ? stopStreaming : () => void handleSend()}
            aria-label={isStreaming ? t`停止生成` : t`发送`}
            title={isStreaming ? t`停止生成` : t`发送`}
            disabled={!isStreaming && !text.trim()}
          >
            {isStreaming ? <StopIcon /> : <SendIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}
