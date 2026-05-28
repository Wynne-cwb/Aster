/**
 * src/components/ChatBubble.tsx — 消息气泡（PANE-02 / PANE-04 / D-10 / D-11 / G-05）
 *
 * 三种 role：
 * - user：纯文本，右对齐（aster-bubble--user）
 * - assistant：react-markdown 渲染，左对齐（aster-bubble--assistant）
 *             + ToolCallPreviewCard（G-05 confirm 模式预览卡 / auto 模式回执）
 *             + FallbackInsertMenu（仅在 supportsToolCall===false 且无 toolCalls 时）
 *             **注意：默认「插入到文档」按钮已在 G-05 D-16 修订中移除**
 * - error：委托 ErrorBubble 组件（D-10）
 *
 * 安全约束（T-02-21）：AI 输出经 react-markdown 渲染（默认禁用原始 HTML），
 * 不用 dangerouslySetInnerHTML，代码块不注入 script。
 *
 * 流式光标（isStreaming=true）：末尾显示闪烁 aster-cursor（尊重 prefers-reduced-motion）。
 *
 * G-05 tool-call 路径：
 * - confirm 模式（默认）：toolCall.status='pending' → 预览卡（截断 200 字 + position 标签 + 插入/拒绝按钮）
 * - auto 模式：toolCall.status='accepted' → 轻量回执「已写入 N 字到{位置}」
 * - supportsToolCall===false → FallbackInsertMenu 回退菜单（三位置选项）
 */
import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Trans, useLingui } from '@lingui/react/macro';
import type { Message, ToolCall } from '../store/chat';
import { useChatStore } from '../store/chat';
import { useProviderStore } from '../store/providers';
import { useAdapter } from '../context/AdapterContext';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';
import ErrorBubble from './ErrorBubble';
import { InsertIcon, CheckIcon } from './icons';

interface ChatBubbleProps {
  message: Message;
  onRetry: () => void;
  onSettings: (anchor?: string) => void;
}

// ---------------------------------------------------------------------------
// 工具函数：position → 中文标签
// ---------------------------------------------------------------------------

function positionLabel(pos: 'cursor' | 'replace_selection' | 'append_end'): string {
  switch (pos) {
    case 'cursor': return '光标处';
    case 'replace_selection': return '替换选区';
    case 'append_end': return '追加末尾';
  }
}

// ---------------------------------------------------------------------------
// ToolCallPreviewCard — confirm/auto 两路径都用（内嵌在 ChatBubble）
// ---------------------------------------------------------------------------

function ToolCallPreviewCard({
  messageId,
  toolCall,
  adapter,
}: {
  messageId: string;
  toolCall: ToolCall;
  adapter: DocumentAdapter;
}): React.ReactElement {
  const { t } = useLingui();
  const acceptToolCall = useChatStore((s) => s.acceptToolCall);
  const rejectToolCall = useChatStore((s) => s.rejectToolCall);

  const truncated = toolCall.arguments.text.length > 200
    ? toolCall.arguments.text.slice(0, 200) + '…'
    : toolCall.arguments.text;

  if (toolCall.status === 'rejected') {
    return (
      <div className="aster-tool-card aster-tool-card--rejected">
        <Trans>已拒绝写入</Trans>
      </div>
    );
  }

  if (toolCall.status === 'accepted') {
    // auto 模式直接 accepted，或用户点过「插入」后变为 accepted → 显示轻量回执
    return (
      <div className="aster-tool-card aster-tool-card--accepted">
        <CheckIcon />
        <Trans>已写入 {toolCall.arguments.text.length} 字到{positionLabel(toolCall.arguments.position)}</Trans>
      </div>
    );
  }

  // pending（confirm 模式默认）→ 完整预览卡
  return (
    <div className="aster-tool-card aster-tool-card--pending">
      <div className="aster-tool-card__header">
        <span className="aster-tool-card__title"><Trans>AI 想要写入文档</Trans></span>
        <span className="aster-tool-card__pos">{positionLabel(toolCall.arguments.position)}</span>
      </div>
      <pre className="aster-tool-card__preview">{truncated}</pre>
      <div className="aster-tool-card__actions">
        <button
          type="button"
          className="aster-btn-primary aster-btn-primary--sm"
          onClick={() => void acceptToolCall(messageId, toolCall.id, adapter)}
          aria-label={t`接受并插入`}
        >
          <CheckIcon /> <Trans>插入</Trans>
        </button>
        <button
          type="button"
          className="aster-link-btn"
          onClick={() => rejectToolCall(messageId, toolCall.id)}
          aria-label={t`拒绝写入`}
        >
          <Trans>拒绝</Trans>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AutoInsertEffect — auto 模式下 status='pending' 时自动调 adapter.insert（02.1 UAT-4 ③ 修复后）
// 分离为独立组件以确保每个 toolCall 只触发一次
// ---------------------------------------------------------------------------

function AutoInsertEffect({
  messageId,
  toolCall,
  adapter,
}: {
  messageId: string;
  toolCall: ToolCall;
  adapter: DocumentAdapter;
}): null {
  const acceptToolCall = useChatStore((s) => s.acceptToolCall);
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    // 02.1 UAT-4 ③ 修复：触发条件改为 status==='pending'（之前是 'accepted'，
    // 与 acceptToolCall 入口的幂等 guard 冲突导致 adapter.insert 从未真正调用）
    if (toolCall.status === 'pending' && !hasTriggeredRef.current) {
      hasTriggeredRef.current = true;
      void acceptToolCall(messageId, toolCall.id, adapter);
    }
  }, [messageId, toolCall.id, toolCall.status, adapter, acceptToolCall]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

// ---------------------------------------------------------------------------
// FallbackInsertMenu — 仅在 supportsToolCall===false 时显示（回退菜单）
// ---------------------------------------------------------------------------

function FallbackInsertMenu({
  adapter,
  text,
}: {
  adapter: DocumentAdapter;
  text: string;
}): React.ReactElement {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);

  const handle = async (position: 'cursor' | 'replace_selection' | 'append_end') => {
    setOpen(false);
    try {
      await adapter.insert({ type: 'text', value: text, position });
    } catch (err) {
      console.warn('[Aster] FallbackInsertMenu insert 失败', err);
    }
  };

  return (
    <div className="aster-bubble__actions">
      <button
        className="aster-insert-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t`插入到文档`}
      >
        <InsertIcon /> <Trans>插入 ▾</Trans>
      </button>
      {open && (
        <div className="aster-insert-menu" role="menu">
          <button role="menuitem" onClick={() => void handle('cursor')}><Trans>光标处</Trans></button>
          <button role="menuitem" onClick={() => void handle('replace_selection')}><Trans>替换选区</Trans></button>
          <button role="menuitem" onClick={() => void handle('append_end')}><Trans>追加末尾</Trans></button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatBubble — 主组件
// ---------------------------------------------------------------------------

export default function ChatBubble({
  message,
  onRetry,
  onSettings,
}: ChatBubbleProps): React.ReactElement {
  const adapter = useAdapter();
  const defaultId = useProviderStore((s) => s.defaultLLMProviderId);
  const providers = useProviderStore((s) => s.providers);
  const autoInsertMode = useProviderStore((s) => s.autoInsertMode);
  const currentProvider = providers.find((p) => p.id === defaultId);

  // supportsToolCall: null（未探测）视为支持（true）；false = 曾探测失败
  const supportsToolCall = currentProvider?.supportsToolCall !== false;

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

  // assistant role — react-markdown 渲染 + G-05 tool-call UI
  return (
    <div className="aster-bubble aster-bubble--assistant">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {message.content}
      </ReactMarkdown>
      {message.isStreaming && <span className="aster-cursor" aria-hidden="true" />}

      {/* G-05 ① tool_calls 路径：每个 toolCall 一个预览卡 */}
      {message.toolCalls?.map((tc) => (
        <ToolCallPreviewCard
          key={tc.id}
          messageId={message.id}
          toolCall={tc}
          adapter={adapter}
        />
      ))}

      {/* G-05 auto 模式：status='pending' 时自动触发 insert（AutoInsertEffect 内部用
          hasTriggeredRef 防重复；调 acceptToolCall 后由 store 推进到 'accepted'）。
          初始 status 改为 'pending'（02.1 UAT-4 ③ 修复 — accept 幂等 guard 与预设 accepted 冲突）。 */}
      {autoInsertMode === 'auto' && message.toolCalls?.filter((tc) => tc.status === 'pending').map((tc) => (
        <AutoInsertEffect
          key={`auto-${tc.id}`}
          messageId={message.id}
          toolCall={tc}
          adapter={adapter}
        />
      ))}

      {/* G-05 D-22 ② 回退菜单：仅当 supportsToolCall===false 且无 toolCalls 时显示 */}
      {!message.isStreaming && !supportsToolCall && (!message.toolCalls || message.toolCalls.length === 0) && (
        <FallbackInsertMenu adapter={adapter} text={message.content} />
      )}
    </div>
  );
}
