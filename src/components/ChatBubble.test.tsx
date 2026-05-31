/**
 * src/components/ChatBubble.test.tsx
 * UI-01 DOM 级别安全断言——验证 ChatBubble 渲染后 DOM 不含危险 href/src（Phase 12 plan 00）
 * RED 状态：Wave 0 建立测试框架；Wave 1（12-01-PLAN）wire urlTransform 后变 GREEN。
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import ChatBubble from './ChatBubble';
import type { Message } from '../store/chat';

// MANDATORY：ChatBubble 经 remark-gfm 依赖链引用 Trans，测试环境必须 mock
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({ _: (id: string) => id, t: (id: string) => id }),
}));

function makeMsg(content: string): Message {
  return { id: 'test-1', role: 'assistant', content, isStreaming: false };
}

function renderBubble(content: string) {
  return render(
    <ChatBubble
      message={makeMsg(content)}
      onRetry={() => {}}
      onSettings={() => {}}
    />,
  );
}

describe('ChatBubble — UI-01 XSS 防御（urlTransform）', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('UI-01-A: javascript: href → DOM anchor 无危险 href', () => {
    const { container } = renderBubble('[点我](javascript:alert(1))');
    const a = container.querySelector('a');
    // Wave 0 时此断言 RED（无 urlTransform，href 含 javascript:）
    // Wave 1 接线后变 GREEN（urlTransform 返回 ''，href 为空）
    expect(a?.getAttribute('href') ?? '').not.toMatch(/javascript:/i);
  });

  it('UI-01-B: data: URI href → 被拦截', () => {
    const { container } = renderBubble('[恶意](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)');
    const a = container.querySelector('a');
    expect(a?.getAttribute('href') ?? '').not.toMatch(/^data:/i);
  });

  it('UI-01-C: https: href → 保留（不误杀）', () => {
    const { container } = renderBubble('[正常链接](https://example.com)');
    const a = container.querySelector('a');
    // 此测试在 Wave 0 应 PASS（react-markdown 默认也保留 https:）
    expect(a?.getAttribute('href')).toBe('https://example.com');
  });

  it('UI-01-D: img src javascript: → 被拦截', () => {
    const { container } = renderBubble('![图](javascript:alert(1))');
    const img = container.querySelector('img');
    // react-markdown 默认对 img src 也应用 defaultUrlTransform，但自写 allowlist 更严
    expect(img?.getAttribute('src') ?? '').not.toMatch(/javascript:/i);
  });

  it('UI-01-E: vbscript: href → 被拦截', () => {
    const { container } = renderBubble('[点我](vbscript:msgbox(1))');
    const a = container.querySelector('a');
    expect(a?.getAttribute('href') ?? '').not.toMatch(/vbscript:/i);
  });
});
