/**
 * src/components/ChatBubble.tsx — 消息气泡（Phase 3 Plan 05 改造后骨架）
 *
 * Phase 3 改造（D-01 / D-08 / D-19 G-05）：
 * - 删 ToolCallPreviewCard / AutoInsertEffect / FallbackInsertMenu 三组件
 *   （v1 confirm/auto 双模式砍 — agent loop 是唯一主路径）
 * - 删 acceptToolCall / rejectToolCall / autoInsertMode 订阅（chatStore + providers 内已删）
 * - role='tool' 折叠卡片 + soft-landing 卡片渲染 → Plan 06 接力（ChatStream 内负责）
 *
 * Phase 04.1 重皮（Wave 3）：
 * - 新 bubble-user / bubble-ai 类名（teal accent + 冷灰 AI 气泡）
 * - msg-time 时间戳显示在气泡下方（mono 字体 11px）
 * - 流式时 AI 气泡用 .caret 光标（取代旧 .aster-cursor）
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
import { formatTime } from '../utils/formatTime';

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
      <div className="msg msg-user">
        <div className="bubble bubble-user">
          {message.content}
        </div>
        {message.ts && (
          <span className="msg-time">{formatTime(message.ts)}</span>
        )}
      </div>
    );
  }

  // assistant role — react-markdown 渲染（流式 token + 闪烁光标）
  // 注：tool / soft-landing 卡片由 ChatStream 直接渲染（Plan 06）。
  return (
    <div className="msg msg-ai">
      <div className="bubble bubble-ai">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {message.content}
        </ReactMarkdown>
        {message.isStreaming && <span className="caret" aria-hidden="true" />}
      </div>
      {!message.isStreaming && message.ts && (
        <span className="msg-time">{formatTime(message.ts)}</span>
      )}
    </div>
  );
}
