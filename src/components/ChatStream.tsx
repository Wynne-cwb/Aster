/**
 * src/components/ChatStream.tsx — 聊天流（Phase 2 Wave 5 已激活）
 *
 * 无消息：保留 Phase 1 空态（发光 logo + 标题 + 示例胶囊）。
 * 有消息：渲染 ChatBubble 列表（user/assistant/error 三种 role）。
 * 新消息时自动滚到底部（useEffect）。
 *
 * G-03 粘底状态机：
 *   - 初始 stickToBottom=true（首次渲染就粘底）
 *   - 用户向上滚动（scrollTop + clientHeight < scrollHeight - 8）→ stickToBottom=false
 *   - 用户滚回底部（差 ≤8px）→ stickToBottom=true（恢复粘底）
 *   - 流式 delta 追加（messages 引用变化）→ 仅 stickToBottom 时自动滚
 *   - 新消息（messages.length 增加）→ 始终强制滚到底（无论 stickToBottom）
 *
 * Props：
 *   onSettings(anchor?)  — 透传给 ChatBubble → ErrorBubble 的 CTA 深链（D-12）
 *
 * 视觉系统见 styles.css。Phase 2 接入 react-markdown 渲染。
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Trans } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useMessages, useChatStore } from '../store/chat';
import ChatBubble from './ChatBubble';

interface ChatStreamProps {
  onSettings: (anchor?: string) => void;
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
  const host = useAdapter().capabilities().host;
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

  // 有消息：渲染 ChatBubble 列表（绑定 onScroll 以更新粘底状态）
  return (
    <div className="aster-messages" ref={scrollRef} onScroll={handleScroll}>
      {messages.map((m) => (
        <ChatBubble
          key={m.id}
          message={m}
          onRetry={() => void retryMessage(m.id)}
          onSettings={onSettings}
        />
      ))}
    </div>
  );
}
