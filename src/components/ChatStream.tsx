/**
 * src/components/ChatStream.tsx — 聊天流（Phase 2 Wave 5 + Plan 06 chat-ui-cleanup）
 *
 * 无消息：保留 Phase 1 空态（发光 logo + 标题 + 示例胶囊）。
 * 有消息：按 role 分发渲染：
 *   - user / assistant / error → ChatBubble
 *   - tool（含 soft-landing）  → ToolResultCard（本文件内子组件）
 *
 * 新消息时自动滚到底部（useEffect）。
 *
 * G-03 粘底状态机：
 *   - 初始 stickToBottom=true（首次渲染就粘底）
 *   - 用户向上滚动（scrollTop + clientHeight < scrollHeight - 8）→ stickToBottom=false
 *   - 用户滚回底部（差 ≤8px）→ stickToBottom=true（恢复粘底）
 *   - 流式 delta 追加（messages 引用变化）→ 仅 stickToBottom 时自动滚
 *   - 新消息（messages.length 增加）→ 始终强制滚到底（无论 stickToBottom）
 *
 * Plan 06（D-08 / D-09）— role='tool' 渲染：
 *   - 常规 tool（append_paragraph 等）：折叠卡 header 显示 message.content（humanLabel
 *     中文人话，loop.ts 双路径 push 时写入）；点 header 展开 toolResult JSON。
 *   - soft-landing（toolName='soft-landing'）：特殊卡片，两按钮「继续 20 步」/「停下」，
 *     分别调 useAgentStore.continueRun / abort('user')。loop.ts hit MAX_STEPS=20 时 push
 *     此消息，agentStatus='soft-landing'，等待用户决策（不自动 abort）。
 *
 * Props：
 *   onSettings(anchor?)  — 透传给 ChatBubble → ErrorBubble 的 CTA 深链（D-12）
 *
 * 视觉系统见 styles.css。
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Trans } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useMessages, useChatStore, type Message } from '../store/chat';
import { useAgentStore } from '../agent/agentStore';
import ChatBubble from './ChatBubble';

interface ChatStreamProps {
  onSettings: (anchor?: string) => void;
}

// ---------------------------------------------------------------------------
// ToolResultCard — role='tool' 折叠卡 + soft-landing 特殊卡（Plan 06）
// ---------------------------------------------------------------------------

/**
 * ToolResultCard：渲染 role='tool' 消息。
 *
 * 分两条路径：
 * 1) soft-landing（toolName='soft-landing'）— 渲染两按钮卡片：
 *    - 「继续 20 步」 → useAgentStore.continueRun（reset step + 转 running）
 *    - 「停下」       → useAgentStore.abort('user')
 * 2) 常规 tool（append_paragraph 等）— 渲染折叠卡：
 *    - header 显示 message.content（humanLabel 中文人话，由 loop.ts 双路径 push 时写入）
 *    - 默认折叠；点 header 展开后用 <pre> 渲染 toolResult JSON
 */
function ToolResultCard({ message }: { message: Message }): ReactElement {
  const continueRun = useAgentStore((s) => s.continueRun);
  const abort = useAgentStore((s) => s.abort);
  const [expanded, setExpanded] = useState(false);

  // soft-landing：MAX_STEPS=20 软着陆卡片（D-09）
  if (message.toolName === 'soft-landing') {
    return (
      <div className="aster-tool-card aster-tool-card--soft-landing">
        <div className="aster-tool-card__title">{message.content}</div>
        <div className="aster-tool-card__actions">
          <button
            type="button"
            className="aster-btn-primary aster-btn-primary--sm"
            onClick={() => continueRun()}
          >
            <Trans>继续 20 步</Trans>
          </button>
          <button
            type="button"
            className="aster-tool-card__btn-secondary"
            onClick={() => abort('user')}
          >
            <Trans>停下</Trans>
          </button>
        </div>
      </div>
    );
  }

  // 常规 role='tool' 折叠卡：humanLabel 走 message.content，toolResult 折叠展开
  const showLabel = message.content || message.toolName || 'tool';
  const isError = message.toolResult?.ok === false;
  const className = `aster-tool-card${isError ? ' aster-tool-card--error' : ''}`;

  return (
    <div className={className}>
      <button
        type="button"
        className="aster-tool-card__header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <span className="aster-tool-card__label">{showLabel}</span>
        <span className="aster-tool-card__chev" aria-hidden="true">
          {expanded ? '▾' : '▸'}
        </span>
      </button>
      {expanded && (
        <pre className="aster-tool-card__body">
          {JSON.stringify(message.toolResult, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** 按宿主返回示例用法提示胶囊节点数组（i18n 用 <Trans>，默认中文）。 */
function usageExamples(host: 'ppt' | 'excel' | 'word'): ReactElement[] {
  switch (host) {
    case 'ppt':
      return [
        <Trans key="ppt-1">把主题扩展成多页大纲</Trans>,
        <Trans key="ppt-2">为选中的 slide 配一张图</Trans>,
      ];
    case 'excel':
      return [
        <Trans key="excel-1">用自然语言生成公式</Trans>,
        <Trans key="excel-2">解释并修复报错的公式</Trans>,
      ];
    case 'word':
      return [
        <Trans key="word-1">多风格润色选中文段</Trans>,
        <Trans key="word-2">长文一键生成 TL;DR</Trans>,
      ];
  }
}

export default function ChatStream({ onSettings }: ChatStreamProps): ReactElement {
  const adapter = useAdapter();
  const host = adapter.capabilities().host;
  const examples = usageExamples(host);
  const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

  const messages = useMessages();
  const retryMessage = useChatStore((s) => s.retryMessage);

  // G-03 粘底状态机
  const scrollRef = useRef<HTMLDivElement>(null);
  const [stickToBottom, setStickToBottom] = useState(true);
  const prevLengthRef = useRef(messages.length);

  /** 检测滚动容器是否「在底部」（8px 阈值，避免亚像素抖动）*/
  const isAtBottom = (el: HTMLElement): boolean =>
    el.scrollTop + el.clientHeight >= el.scrollHeight - 8;

  /** onScroll：用户主动滚动时更新 stickToBottom */
  const handleScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    setStickToBottom(isAtBottom(el));
  };

  /** 流式追加 / 新消息时滚到底（条件：新消息强制；否则仅 stickToBottom 时）*/
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isNewMessage = messages.length > prevLengthRef.current;
    prevLengthRef.current = messages.length;

    if (isNewMessage || stickToBottom) {
      // 新消息用 smooth（视觉舒服）；流式 delta 追加用 auto（瞬时跟随 token 速度）
      el.scrollTo({ top: el.scrollHeight, behavior: isNewMessage ? 'smooth' : 'auto' });
    }
    // 依赖 messages 整体引用：流式 delta 追加（content 变化）也会触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, stickToBottom]);

  // 无消息：保留 Phase 1 空态
  if (messages.length === 0) {
    return (
      <div className="aster-empty">
        {/* 发光品牌 logo */}
        <div className="aster-empty__logo-wrap">
          <span className="aster-empty__glow" />
          <img className="aster-empty__logo" src={logo} alt="Aster" />
        </div>

        <div className="aster-empty__title">
          <Trans>开始使用 Aster</Trans>
        </div>
        <div className="aster-empty__subtitle">
          <Trans>配置 Provider 后即可开始对话</Trans>
        </div>

        {/* 用法提示：小标题 + 按宿主示例胶囊（只读，取代 Ribbon 功能入口） */}
        <div className="aster-empty__hint">
          <Trans>试试这些</Trans>
        </div>
        <div className="aster-chips">
          {examples.map((example, i) => (
            <span key={i} className="aster-chip">
              {example}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // 有消息：按 role 分发渲染（user/assistant/error → ChatBubble；tool → ToolResultCard）
  return (
    <div className="aster-messages" ref={scrollRef} onScroll={handleScroll}>
      {messages.map((m) => {
        if (m.role === 'tool') {
          return <ToolResultCard key={m.id} message={m} />;
        }
        return (
          <ChatBubble
            key={m.id}
            message={m}
            onRetry={() => void retryMessage(m.id, adapter)}
            onSettings={onSettings}
          />
        );
      })}
    </div>
  );
}
