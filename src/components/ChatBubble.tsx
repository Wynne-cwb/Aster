/**
 * src/components/ChatBubble.tsx — 消息气泡（PANE-02 / PANE-04 / D-10 / D-11）
 *
 * 三种 role：
 * - user：纯文本，右对齐（aster-bubble--user）
 * - assistant：react-markdown 渲染，左对齐（aster-bubble--assistant）
 *             + CostBadge（流式结束后）
 *             + 「插入到文档」按钮（流式结束后，PANE-04）
 * - error：委托 ErrorBubble 组件（D-10）
 *
 * 安全约束（T-02-21）：AI 输出经 react-markdown 渲染（默认禁用原始 HTML），
 * 不用 dangerouslySetInnerHTML，代码块不注入 script。
 *
 * 流式光标（isStreaming=true）：末尾显示闪烁 aster-cursor（尊重 prefers-reduced-motion）。
 */
import type { ReactElement } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Message } from '../store/chat';
import { useAdapter } from '../context/AdapterContext';
import CostBadge from './CostBadge';
import ErrorBubble from './ErrorBubble';
import { InsertIcon } from './icons';

interface ChatBubbleProps {
  message: Message;
  onRetry: () => void;
  onSettings: (anchor?: string) => void;
}

export default function ChatBubble({
  message,
  onRetry,
  onSettings,
}: ChatBubbleProps): ReactElement {
  const { t } = useLingui();
  const adapter = useAdapter();

  // error role — 委托 ErrorBubble
  if (message.role === 'error') {
    return (
      <ErrorBubble
        errorCode={message.errorCode ?? 'NETWORK'}
        message={message.content}
        retryPrompt={message.retryPrompt}
        onRetry={onRetry}
        onSettings={onSettings}
      />
    );
  }

  // user role — 纯文本，无 markdown 渲染
  if (message.role === 'user') {
    return (
      <div className="aster-bubble aster-bubble--user">
        {message.content}
      </div>
    );
  }

  // assistant role — react-markdown 渲染 + CostBadge + 插入按钮
  const handleInsert = (): void => {
    void adapter.insert({ type: 'text', value: message.content });
  };

  return (
    <div className="aster-bubble aster-bubble--assistant">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>
      {message.isStreaming && <span className="aster-cursor" aria-hidden="true" />}
      {!message.isStreaming && message.tokenCount != null && (
        <CostBadge
          tokenCount={message.tokenCount}
          costCny={message.costCny ?? null}
        />
      )}
      {!message.isStreaming && (
        <div className="aster-bubble__actions">
          <button
            className="aster-insert-btn"
            onClick={handleInsert}
            aria-label={t`插入到文档`}
            title={t`插入到文档`}
          >
            <InsertIcon />
            <Trans>插入到文档</Trans>
          </button>
        </div>
      )}
    </div>
  );
}
