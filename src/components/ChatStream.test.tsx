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
 *
 * jsdom 注意：scrollTo / scrollHeight / clientHeight 默认均为 0 或不实现。
 * 在 beforeEach 里安装 HTMLElement.prototype.scrollTo 空实现，
 * 再通过 vi.spyOn(element, 'scrollTo') 追踪调用。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ChatStream from './ChatStream';
import { useChatStore } from '../store/chat';
import { useAgentStore } from '../agent/agentStore';
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

// ---------------------------------------------------------------------------
// jsdom 不实现 scrollTo —— 添加全局空实现以便 spy
// ---------------------------------------------------------------------------

if (!HTMLElement.prototype.scrollTo) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  HTMLElement.prototype.scrollTo = function () {};
}

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
  read: async () => ({ ok: true, data: null }),
};

// ---------------------------------------------------------------------------
// 辅助：设置 DOM 元素的 scroll 度量（jsdom 默认均为 0）
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
    useChatStore.setState({ messages: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Test 1：已在底部 → 流式 token 追加自动滚到底
  // -------------------------------------------------------------------------
  it('Test 1: 已在底部 → 流式 token 追加自动滚到底', async () => {
    // 设置 store 含一条流式 assistant 消息
    const assistantId = 'asst-1';
    useChatStore.setState({
      messages: [makeAssistantMsg(assistantId, 'Hello', true)],
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    // 模拟「已在底部」：scrollTop=80, clientHeight=20, scrollHeight=100
    setScrollMetrics(scrollEl, 80, 20, 100);

    // spy scrollTo（绑定到实例，覆盖原型方法）
    const scrollToSpy = vi.spyOn(scrollEl, 'scrollTo');

    // act：流式 delta 追加内容（messages 内容变化，length 不变）
    await act(async () => {
      useChatStore.setState({
        messages: [makeAssistantMsg(assistantId, 'Hello world', true)],
      });
    });

    // 期望：scrollTo 应被调用（stickToBottom=true，初始在底部）
    expect(scrollToSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Test 2：用户上滑后流式追加不打断滚动位置
  // -------------------------------------------------------------------------
  it('Test 2: 用户上滑 → 流式追加不打断滚动位置', async () => {
    const assistantId = 'asst-2';
    useChatStore.setState({
      messages: [makeAssistantMsg(assistantId, 'Line 1\n', true)],
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    // spy scrollTo
    const scrollToSpy = vi.spyOn(scrollEl, 'scrollTo');

    // 用户主动上滑：scrollTop=0（远离底部，差 > 8px）
    setScrollMetrics(scrollEl, 0, 20, 100);
    await act(async () => {
      scrollEl.dispatchEvent(new Event('scroll'));
    });

    // 清除此前（初始渲染时）的调用记录
    scrollToSpy.mockClear();

    // act：流式追加 delta（length 不变，只改 content）
    await act(async () => {
      useChatStore.setState({
        messages: [makeAssistantMsg(assistantId, 'Line 1\nLine 2\n', true)],
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
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    const scrollToSpy = vi.spyOn(scrollEl, 'scrollTo');

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
    });

    const { container } = renderChatStream();

    const scrollEl = container.querySelector('.aster-messages') as HTMLElement;
    expect(scrollEl).toBeTruthy();

    const scrollToSpy = vi.spyOn(scrollEl, 'scrollTo');

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
      });
    });

    // 期望：即使 stickToBottom=false，新消息仍强制滚到底
    expect(scrollToSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Plan 06 chat-ui-cleanup — role='tool' 折叠卡 + soft-landing 卡片
// ---------------------------------------------------------------------------

/** 构造 role='tool' 常规折叠卡 fixture */
function makeToolMsg(
  id: string,
  toolName: string,
  content: string,
  toolResult: Message['toolResult'],
): Message {
  return {
    id,
    role: 'tool',
    content,
    toolCallId: `c-${id}`,
    toolName,
    toolResult,
    agentRunId: 'r1',
    agentStep: 1,
  };
}

describe('ChatStream — role="tool" 折叠卡 + soft-landing 卡片（Plan 06 chat-ui-cleanup）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] } as never);
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // ChatStream-1：role='tool' append_paragraph → 渲染 humanLabel header + 默认折叠
  // -------------------------------------------------------------------------
  it('ChatStream-1: role="tool" 渲染 humanLabel header + 默认折叠（toolResult JSON 不展示）', () => {
    useChatStore.setState({
      messages: [
        makeToolMsg(
          'm1',
          'append_paragraph',
          '在文档末尾追加段落「跨境电商物流」',
          { ok: true, data: { written: 5 } },
        ),
      ],
    } as never);

    const { container, queryByText } = renderChatStream();

    expect(container.textContent ?? '').toMatch(/在文档末尾追加段落「跨境电商物流」/);
    // 默认折叠：toolResult JSON 不应渲染
    expect(queryByText(/"written"/)).toBeNull();
    // 不走 ChatBubble（mock 用 data-testid="bubble-*"）
    expect(container.querySelector('[data-testid="bubble-m1"]')).toBeNull();
    // 走 ToolResultCard
    expect(container.querySelector('.aster-tool-card')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // ChatStream-5：点 header → 展开 + 渲染 toolResult JSON pre 块
  // -------------------------------------------------------------------------
  it('ChatStream-5: 点折叠卡 header → 展开后渲染 toolResult JSON', () => {
    useChatStore.setState({
      messages: [
        makeToolMsg(
          'm1',
          'append_paragraph',
          '在文档末尾追加段落「测试段落」',
          { ok: true, data: { written: 5 } },
        ),
      ],
    } as never);

    const { container } = renderChatStream();

    const header = container.querySelector(
      '.aster-tool-card__header',
    ) as HTMLButtonElement | null;
    expect(header).toBeTruthy();
    fireEvent.click(header!);

    // 展开后应渲染 JSON（"written": 5 来自 toolResult.data）
    expect(container.textContent ?? '').toMatch(/"written":\s*5/);
  });

  // -------------------------------------------------------------------------
  // ChatStream-2：role='tool' soft-landing → 渲染两按钮「继续 20 步」+「停下」
  // -------------------------------------------------------------------------
  it('ChatStream-2: role="tool" toolName="soft-landing" → 渲染两按钮「继续 20 步」+「停下」', () => {
    useChatStore.setState({
      messages: [
        makeToolMsg(
          'm-soft',
          'soft-landing',
          'Aster 觉得这事还没干完，要继续吗？',
          {
            ok: false,
            error: {
              code: 'STEP_LIMIT',
              message: '已达 20 步上限',
              recoverable: true,
              hint: '可选择继续 20 步或停下',
            },
          },
        ),
      ],
    } as never);

    const { getByText, container } = renderChatStream();

    expect(getByText(/继续 20 步/)).toBeTruthy();
    expect(getByText(/停下/)).toBeTruthy();
    expect(container.querySelector('.aster-tool-card--soft-landing')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // ChatStream-3：点「继续 20 步」按钮 → useAgentStore.continueRun 被调
  // -------------------------------------------------------------------------
  it('ChatStream-3: 点「继续 20 步」按钮 → agentStatus = running, currentStep reset 到 0', () => {
    useChatStore.setState({
      messages: [
        makeToolMsg(
          'm-soft',
          'soft-landing',
          'Aster 觉得这事还没干完，要继续吗？',
          {
            ok: false,
            error: { code: 'STEP_LIMIT', message: '', recoverable: true, hint: '' },
          },
        ),
      ],
    } as never);
    useAgentStore.setState({ agentStatus: 'soft-landing', currentStep: 20 });

    const { getByText } = renderChatStream();
    fireEvent.click(getByText(/继续 20 步/));

    expect(useAgentStore.getState().agentStatus).toBe('running');
    expect(useAgentStore.getState().currentStep).toBe(0);
  });

  // -------------------------------------------------------------------------
  // ChatStream-4：点「停下」按钮 → useAgentStore.abort('user') 被调
  // -------------------------------------------------------------------------
  it('ChatStream-4: 点「停下」按钮 → lastAbortReason = "user" + controller aborted', () => {
    const ctrl = new AbortController();
    useChatStore.setState({
      messages: [
        makeToolMsg(
          'm-soft',
          'soft-landing',
          'Aster 觉得这事还没干完，要继续吗？',
          {
            ok: false,
            error: { code: 'STEP_LIMIT', message: '', recoverable: true, hint: '' },
          },
        ),
      ],
    } as never);
    useAgentStore.setState({ agentStatus: 'soft-landing', controller: ctrl });

    const { getByText } = renderChatStream();
    fireEvent.click(getByText(/停下/));

    expect(useAgentStore.getState().lastAbortReason).toBe('user');
    expect(ctrl.signal.aborted).toBe(true);
  });
});
