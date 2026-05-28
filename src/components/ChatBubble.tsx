/**
 * src/components/ChatBubble.tsx — 消息气泡（Phase 3 Plan 05 改造后骨架）
 *
 * Phase 3 改造（D-01 / D-08 / D-19 G-05）：
 * - 删 ToolCallPreviewCard / AutoInsertEffect / FallbackInsertMenu 三组件
 *   （v1 confirm/auto 双模式砍 — agent loop 是唯一主路径）
 * - 删 acceptToolCall / rejectToolCall / autoInsertMode 订阅（chatStore + providers 内已删）
 * - role='tool' 折叠卡片 + soft-landing 卡片渲染 → Plan 06 接力（ChatStream 内负责）
 *
 * 当前三种 role：
 * - user：纯文本，右对齐
 * - assistant：react-markdown 渲染，左对齐 + 流式光标
 * - error：委托 ErrorBubble 组件
 *
 * 注：role='tool' 由 ChatStream 直接渲染折叠卡（Plan 06），不走 ChatBubble。
 *
 * 安全约束（T-02-21）：AI 输出经 react-markdown 渲染（默认禁用原始 HTML），
 * 不用 dangerouslySetInnerHTML，代码块不注入 script。
 */
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../store/chat';
import ErrorBubble from './ErrorBubble';

interface ChatBubbleProps {
  message: Message;
  onRetry: () => void;
  onSettings: (anchor?: string) => void;
}

// ---------------------------------------------------------------------------
// ChatBubble — 主组件
// ---------------------------------------------------------------------------

export default function ChatBubble({
  message,
  onRetry,
  onSettings,
}: ChatBubbleProps): React.ReactElement {
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

  // assistant role — react-markdown 渲染（流式 token + 闪烁光标）
  // 注：tool / soft-landing 卡片由 ChatStream 直接渲染（Plan 06）。
  return (
    <div className="aster-bubble aster-bubble--assistant">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>
      {message.isStreaming && <span className="aster-cursor" aria-hidden="true" />}
    </div>
  );
}
