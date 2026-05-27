/**
 * src/components/ChatStream.tsx — 聊天流（Phase 2 Wave 5 已激活）
 *
 * 无消息：保留 Phase 1 空态（发光 logo + 标题 + 示例胶囊）。
 * 有消息：渲染 ChatBubble 列表（user/assistant/error 三种 role）。
 * 新消息时自动滚到底部（useEffect）。
 *
 * Props：
 *   onSettings(anchor?)  — 透传给 ChatBubble → ErrorBubble 的 CTA 深链（D-12）
 *
 * 视觉系统见 styles.css。Phase 2 接入 react-markdown 渲染。
 */
import { useEffect, useRef } from 'react';
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

  // 自动滚到底部（新消息时）
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

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

  // 有消息：渲染 ChatBubble 列表
  return (
    <div className="aster-messages" ref={scrollRef}>
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
