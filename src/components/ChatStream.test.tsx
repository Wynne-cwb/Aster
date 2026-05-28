/**
 * src/components/ChatStream.test.tsx — 粘底状态机测试（G-03）
 *
 * 覆盖三种粘底分支：
 * Test 1：已在底部 → 流式 token 追加自动滚到底
 * Test 2：用户上滑后流式追加不打断滚动位置
 * Test 3：用户滚回底部 → 恢复粘底，流式追加再次自动滚
 * Test 4：新消息（length 增加）始终强制滚到底（不论 stickToBottom 状态）
 *
 * 测试基础设施：@testing-library/react（路径 A）
 * 环境：vitest + jsdom（vitest.config.ts environment: 'jsdom'）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ChatStream from './ChatStream';
import { useChatStore } from '../store/chat';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';
import type { Message } from '../store/chat';

// ---------------------------------------------------------------------------
// Mock 依赖
// ---------------------------------------------------------------------------

// Mock ChatBubble：避免其内部 useAdapter / react-markdown 等复杂依赖
vi.mock('./ChatBubble', () => ({
  default: ({ message }: { message: Message }) => (
    <div data-testid={`bubble-${message.id}`}>{message.content}</div>
  ),
}));

// Mock @lingui/react/macro（Trans 直接返回子节点）
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({ _: (id: string) => id }),
}));

// Mock import.meta.env.BASE_URL（vitest jsdom 里通常已注入，但确保存在）
// vitest 自动处理 import.meta.env，通常 BASE_URL = '/'

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

const mockAdapter: DocumentAdapter = {
  capabilities: () => ({
    host: 'ppt' as const,
    supportsSelectionEvents: false,
    supportedInserts: ['text' as const],
  }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
};

// ---------------------------------------------------------------------------
// 辅助：设置 scrollRef 元素的 scroll 度量（jsdom 默认均为 0）
// ---------------------------------------------------------------------------

function setScrollMetrics(
  el: HTMLElement,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): void {
  Object.defineProperty(el, 'scrollTop', {
    value: scrollTop,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(el, 'clientHeight', {
    value: clientHeight,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(el, 'scrollHeight', {
    value: scrollHeight,
    configurable: true,
    writable: true,
  });
}

// ---------------------------------------------------------------------------
// 辅助：构造 Message 对象
// ---------------------------------------------------------------------------

function makeUserMsg(id: string, content: string): Message {
  return { id, role: 'user', content };
}

function makeAssistantMsg(id: string, content: string, isStreaming = false): Message {
  return { id, role: 'assistant', content, isStreaming };
}

// ---------------------------------------------------------------------------
// 渲染 ChatStream 包裹 AdapterContext
// ---------------------------------------------------------------------------

function renderChatStream(onSettings = vi.fn()) {
  return render(
    <AdapterContext.Provider value={mockAdapter}>
      <ChatStream onSettings={onSettings} />
    </AdapterContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------

describe('ChatStream — 粘底状态机（G-03）', () => {
  beforeEach(() => {
    // 每个测试前重置 store 到初始空态
    useChatStore.setState({ messages: [], isStreaming: false, abortController: null });
    // 重置 vi mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1：已在底部 → 流式 token 追加自动滚到底
  // -------------------------------------------------------------------------
  it('Test 1: 已在底部 → 流式 token 追加自动滚到底', async () => {
    // 先设置 store 含一条流式 assistant 消息
    const assistantId = 'asst-1';
    useChatStore.setState({
      messages: [makeAssistantMsg(assistantId, 'Hello', true)],
      isStreaming: true,
      abortController: null,
    });

    const { container } = renderChatStream();

    // 取得 .aster-messages 容器
    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    // 模拟「已在底部」：scrollTop=80, clientHeight=20, scrollHeight=100
    setScrollMetrics(scrollEl, 80, 20, 100);

    // spy scrollTo
    const scrollToSpy = vi.fn();
    scrollEl.scrollTo = scrollToSpy;

    // act：流式 delta 追加内容（messages 内容变化，length 不变）
    await act(async () => {
      useChatStore.setState({
        messages: [makeAssistantMsg(assistantId, 'Hello world', true)],
        isStreaming: true,
        abortController: null,
      });
    });

    // 期望：scrollTo 应被调用（因为 stickToBottom=true，初始在底部）
    expect(scrollToSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 2：用户上滑后流式追加不打断滚动位置
  // -------------------------------------------------------------------------
  it('Test 2: 用户上滑 → 流式追加不打断滚动位置', async () => {
    const assistantId = 'asst-2';
    useChatStore.setState({
      messages: [makeAssistantMsg(assistantId, 'Line 1\n', true)],
      isStreaming: true,
      abortController: null,
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    // 初始在底部（scrollTo 可能被调用一次，先 spy 记录）
    setScrollMetrics(scrollEl, 80, 20, 100);
    const scrollToSpy = vi.fn();
    scrollEl.scrollTo = scrollToSpy;

    // 用户主动上滑：scrollTop=0（远离底部）
    setScrollMetrics(scrollEl, 0, 20, 100);
    await act(async () => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // 清除初始渲染时可能的 scrollTo 调用记录
    scrollToSpy.mockClear();

    // act：流式追加 delta（length 不变，只改 content）
    await act(async () => {
      useChatStore.setState({
        messages: [makeAssistantMsg(assistantId, 'Line 1\nLine 2\n', true)],
        isStreaming: true,
        abortController: null,
      });
    });

    // 期望：scrollTo 不应被调用（stickToBottom=false，用户正在上滑阅读）
    expect(scrollToSpy).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 3：用户滚回底部 → 恢复粘底，流式追加再次自动滚
  // -------------------------------------------------------------------------
  it('Test 3: 用户滚回底部 → 恢复粘底，流式追加再次自动滚', async () => {
    const assistantId = 'asst-3';
    useChatStore.setState({
      messages: [makeAssistantMsg(assistantId, 'Content', true)],
      isStreaming: true,
      abortController: null,
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    setScrollMetrics(scrollEl, 80, 20, 100);
    const scrollToSpy = vi.fn();
    scrollEl.scrollTo = scrollToSpy;

    // Step 1：用户上滑（离开底部）→ stickToBottom=false
    setScrollMetrics(scrollEl, 0, 20, 100);
    await act(async () => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // Step 2：用户滚回底部（回到 ≤8px 范围内）→ stickToBottom=true
    setScrollMetrics(scrollEl, 80, 20, 100);
    await act(async () => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // 清除此前所有调用
    scrollToSpy.mockClear();

    // Step 3：流式 delta 追加（length 不变）
    await act(async () => {
      useChatStore.setState({
        messages: [makeAssistantMsg(assistantId, 'Content more', true)],
        isStreaming: true,
        abortController: null,
      });
    });

    // 期望：scrollTo 应被调用（stickToBottom 已恢复 true）
    expect(scrollToSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 4：新消息（length 增加）始终强制滚到底，不论 stickToBottom 状态
  // -------------------------------------------------------------------------
  it('Test 4: 新消息（length 增加）始终强制滚到底', async () => {
    // 先设置一条已有消息
    useChatStore.setState({
      messages: [makeUserMsg('user-1', '你好')],
      isStreaming: false,
      abortController: null,
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    setScrollMetrics(scrollEl, 80, 20, 100);
    const scrollToSpy = vi.fn();
    scrollEl.scrollTo = scrollToSpy;

    // 用户上滑 → stickToBottom=false
    setScrollMetrics(scrollEl, 0, 20, 100);
    await act(async () => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // 清除此前记录
    scrollToSpy.mockClear();

    // act：追加一条新消息（messages.length 增加）
    await act(async () => {
      useChatStore.setState({
        messages: [
          makeUserMsg('user-1', '你好'),
          makeAssistantMsg('asst-4', '', true),
        ],
        isStreaming: true,
        abortController: null,
      });
    });

    // 期望：即使 stickToBottom=false，新消息仍强制滚到底
    expect(scrollToSpy).toHaveBeenCalled();
  });
});
