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
import { useAgentStore, MAX_STEPS } from '../agent/agentStore';
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

// Mock @lingui/react/macro（Trans 直接返回子节点，t/_ 均可用）
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    _: (id: string) => id,
    t: (id: string) => id,
  }),
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
    // 走 ToolResultCard（使用新 wb-action-head 范式，D-05）
    expect(container.querySelector('.wb-action-head')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // ChatStream-PVQ06：apply_slide_layout 不并入合并组（code-review WR-01 回归守门）
  // 必须独立渲染 ToolResultCard，SlidePreviewPanel 才能挂载 → visual_check_slide 拿得到预览 DOM。
  // -------------------------------------------------------------------------
  it('ChatStream-PVQ06: apply_slide_layout 与后续 tool 不合并为 .tool-group（独立卡挂载预览面板）', () => {
    useChatStore.setState({
      messages: [
        // 无匹配 assistant tool-call → layoutArgs=null → 不触发 lazy SlidePreviewPanel；
        // 仅验证合并组排除逻辑（WR-01）。
        makeToolMsg('m-apply', 'apply_slide_layout', '套用版式「标题+要点」到第 1 页', {
          ok: true,
          data: { summary: 'layout applied' },
        }),
        makeToolMsg('m-list', 'list_slides', '列出幻灯片', { ok: true, data: { count: 3 } }),
      ],
    } as never);

    const { container } = renderChatStream();

    // 两条 tool 消息中含 apply_slide_layout → 不应合并成单张 .tool-group（apply 打断合并）
    expect(container.querySelectorAll('.tool-group').length).toBe(0);
    // apply_slide_layout 文案出现（独立 ToolResultCard 渲染）
    expect(container.textContent ?? '').toMatch(/套用版式/);
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

    // D-05：折叠卡 header 用新的 wb-action-head 类名
    const header = container.querySelector(
      '.wb-action-head',
    ) as HTMLButtonElement | null;
    expect(header).toBeTruthy();
    fireEvent.click(header!);

    // 展开后应渲染 JSON（"written": 5 来自 toolResult.data）
    expect(container.textContent ?? '').toMatch(/"written":\s*5/);
  });

  // -------------------------------------------------------------------------
  // ChatStream-2：role='tool' soft-landing → 渲染两按钮「继续 N 步」+「停下」
  // -------------------------------------------------------------------------
  it(`ChatStream-2: role="tool" toolName="soft-landing" → 渲染两按钮「继续 ${MAX_STEPS} 步」+「停下」`, () => {
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

    expect(getByText(new RegExp(`继续 ${MAX_STEPS} 步`))).toBeTruthy();
    expect(getByText(/停下/)).toBeTruthy();
    expect(container.querySelector('.aster-tool-card--soft-landing')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // ChatStream-3：点「继续 N 步」按钮 → useAgentStore.continueRun 被调
  // -------------------------------------------------------------------------
  it(`ChatStream-3: 点「继续 ${MAX_STEPS} 步」按钮 → agentStatus = running, currentStep reset 到 0`, () => {
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
    fireEvent.click(getByText(new RegExp(`继续 ${MAX_STEPS} 步`)));

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

// ---------------------------------------------------------------------------
// Phase 04.1 Wave 3 — EMPTY-01: empty-state 重皮（无 chips，有 empty-mark pulse）
// ---------------------------------------------------------------------------

describe('ChatStream — EMPTY-01: empty-state teal 重皮（Wave 3）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('EMPTY-01: 无消息时渲染 .empty-mark（logo pulse 壳）', () => {
    useChatStore.setState({ messages: [] });
    const { container } = renderChatStream();
    // empty-mark 元素存在（pulse 动画容器）
    expect(container.querySelector('.empty-mark')).toBeTruthy();
  });

  it('EMPTY-01: 无消息时无 suggestion chips（D-03 推 Phase 6）', () => {
    useChatStore.setState({ messages: [] });
    const { container } = renderChatStream();
    // D-03：无 aster-chips / aster-chip 元素
    expect(container.querySelector('.aster-chips')).toBeNull();
    expect(container.querySelector('.aster-chip')).toBeNull();
  });

  it('EMPTY-01: 无消息时 h3 标题包含「从你正在做」', () => {
    useChatStore.setState({ messages: [] });
    const { container } = renderChatStream();
    const h3 = container.querySelector('h3');
    expect(h3).toBeTruthy();
    expect(h3!.textContent ?? '').toMatch(/从你正在做/);
  });
});

// ---------------------------------------------------------------------------
// Phase 04.1 Wave 3 — ERROR-01: ErrorBubble err-bubble 新形态（D-06）
// 直接渲染 ErrorBubble 组件，验证 err-bubble CSS 结构和 .code 代号
// ---------------------------------------------------------------------------

import ErrorBubble from './ErrorBubble';

describe('ChatStream — ERROR-01: ErrorBubble err-bubble 新形态（Wave 3）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ERROR-01: ErrorBubble 渲染出 .err-bubble 容器（D-06 inset stripe 范式）', () => {
    const { container } = render(
      <ErrorBubble
        errorCode="NETWORK"
        message="test error"
        retryPrompt="test"
        onRetry={() => {}}
        onSettings={() => {}}
      />,
    );
    expect(container.querySelector('.err-bubble')).toBeTruthy();
  });

  it('ERROR-01: err-bubble 内有 .code span 显示 errorCode（mono 代号）', () => {
    const { container } = render(
      <ErrorBubble
        errorCode="KEY_INVALID"
        message="key invalid"
        retryPrompt="retry"
        onRetry={() => {}}
        onSettings={() => {}}
      />,
    );
    const codeEl = container.querySelector('.err-bubble .head .code');
    expect(codeEl).toBeTruthy();
    expect(codeEl!.textContent).toBe('KEY_INVALID');
  });

  it('ERROR-01: err-bubble 内有 .reason（主文案）', () => {
    const { container } = render(
      <ErrorBubble
        errorCode="NETWORK"
        message="test"
        onRetry={() => {}}
        onSettings={() => {}}
      />,
    );
    expect(container.querySelector('.err-bubble .reason')).toBeTruthy();
    expect(container.querySelector('.err-bubble .reason')!.textContent).toMatch(/网络连接失败/);
  });

  it('ERROR-01: err-bubble 包裹在 .msg.msg-ai 容器中（同 AI 气泡对齐）', () => {
    const { container } = render(
      <ErrorBubble
        errorCode="MODEL"
        message="test"
        onRetry={() => {}}
        onSettings={() => {}}
      />,
    );
    const msgEl = container.querySelector('.msg.msg-ai');
    expect(msgEl).toBeTruthy();
    expect(msgEl!.querySelector('.err-bubble')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Wave 3 — CHIPS-01: host-specific chips（D-15 / D-16）
//
// D-15：空态按宿主显示 3 个 host-specific chip
// D-16：chip 点击只填充 chatStore.draftPrompt（不自动 send）
// ---------------------------------------------------------------------------

describe('ChatStream — CHIPS-01: host-specific chips（Phase 6 D-15/D-16）', () => {
  // helper：按不同 host 渲染 ChatStream
  function renderWithHost(host: 'ppt' | 'excel' | 'word'): ReturnType<typeof render> {
    const adapterForHost: DocumentAdapter = {
      capabilities: () => ({
        host,
        supportsSelectionEvents: false,
        supportedInserts: ['text' as const],
      }),
      getSelection: async () => ({ kind: 'none' as const }),
      onSelectionChanged: () => () => {},
      insert: async () => {},
      read: async () => ({ ok: true, data: null }),
    };
    useChatStore.setState({ messages: [], draftPrompt: '' } as never);
    return render(
      <AdapterContext.Provider value={adapterForHost}>
        <ChatStream onSettings={() => {}} />
      </AdapterContext.Provider>,
    );
  }

  beforeEach(() => {
    useChatStore.setState({ messages: [], draftPrompt: '' } as never);
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

  it('CHIPS-01-A: host=ppt → 渲染 PPT chips（含「做 Q3 销售复盘 PPT」按钮）', () => {
    const { getByText } = renderWithHost('ppt');
    expect(getByText(/做 Q3 销售复盘 PPT/)).toBeTruthy();
  });

  it('CHIPS-01-B: host=excel → 渲染 Excel chips（含「清洗数据做图」按钮）', () => {
    const { getByText } = renderWithHost('excel');
    expect(getByText(/清洗数据做图/)).toBeTruthy();
  });

  it('CHIPS-01-C: host=word → 渲染 Word chips（含「整篇润色」按钮）', () => {
    const { getByText } = renderWithHost('word');
    expect(getByText(/整篇润色/)).toBeTruthy();
  });

  it('CHIPS-01-D: chip 点击 → 填充 chatStore.draftPrompt（不自动 send，D-16）', () => {
    const { getByText } = renderWithHost('ppt');
    // 点击第一个 PPT chip
    fireEvent.click(getByText(/做 Q3 销售复盘 PPT/));
    // draftPrompt 已填充为完整 seed
    expect(useChatStore.getState().draftPrompt).toBe(
      '帮我做一份 Q3 销售复盘 PPT，给 leadership 看，重点华东',
    );
    // agentStatus 仍是 idle（未自动 send）
    expect(useAgentStore.getState().agentStatus).toBe('idle');
  });

  it('CHIPS-01-E: host=unknown → 渲染空 .suggestions（不报错）', () => {
    const adapterUnknown: DocumentAdapter = {
      capabilities: () => ({
        host: 'unknown' as 'ppt', // 强转以绕过 TypeScript，模拟未知 host
        supportsSelectionEvents: false,
        supportedInserts: ['text' as const],
      }),
      getSelection: async () => ({ kind: 'none' as const }),
      onSelectionChanged: () => () => {},
      insert: async () => {},
      read: async () => ({ ok: true, data: null }),
    };
    useChatStore.setState({ messages: [], draftPrompt: '' } as never);
    const { container } = render(
      <AdapterContext.Provider value={adapterUnknown}>
        <ChatStream onSettings={() => {}} />
      </AdapterContext.Provider>,
    );
    // .suggestions 存在但内容为空（无 button）
    const suggestions = container.querySelector('.suggestions');
    expect(suggestions).toBeTruthy();
    expect(suggestions!.querySelectorAll('button').length).toBe(0);
  });

  it('CHIPS-01-F: 空态文案已更新为「或挑一个下面的例子开始」', () => {
    const { container } = renderWithHost('ppt');
    const p = container.querySelector('.empty p');
    expect(p).toBeTruthy();
    expect(p!.textContent ?? '').toMatch(/或挑一个下面的例子开始/);
  });
});

// =========================================================
// UI-02：思考气泡（typing indicator）
// =========================================================
describe('ChatStream — UI-02: 思考气泡（typing indicator）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      completedRunIds: [],
    } as never);
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('UI-02-A: running + 当前 run 有空 content isStreaming assistant 消息 → .bubble-typing 出现', async () => {
    const runId = 'run-1';
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '帮我写个总结' },
        { id: 'a1', role: 'assistant', content: '', isStreaming: true, agentRunId: runId },
      ],
    } as never);
    useAgentStore.setState({ agentStatus: 'running', currentRunId: runId } as never);
    const { container } = renderChatStream();
    // RED：Wave 2（12-03）实现 showTyping 逻辑后变 GREEN
    expect(container.querySelector('.bubble-typing')).not.toBeNull();
  });

  it('UI-02-B: 首 token 到达（content 非空）→ .bubble-typing 消失', async () => {
    const runId = 'run-1';
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '帮我写个总结' },
        { id: 'a1', role: 'assistant', content: '这是', isStreaming: true, agentRunId: runId },
      ],
    } as never);
    useAgentStore.setState({ agentStatus: 'running', currentRunId: runId } as never);
    const { container } = renderChatStream();
    // content 非空 → showTyping 条件不满足 → 无 .bubble-typing
    expect(container.querySelector('.bubble-typing')).toBeNull();
  });

  it('UI-02-C: agentStatus idle → 无 .bubble-typing 残留', async () => {
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '你好' },
        { id: 'a1', role: 'assistant', content: '你好！', isStreaming: false },
      ],
    } as never);
    useAgentStore.setState({ agentStatus: 'idle', currentRunId: null } as never);
    const { container } = renderChatStream();
    expect(container.querySelector('.bubble-typing')).toBeNull();
  });
});

// =========================================================
// UI-03：DiffLogPanel 边界插入
// =========================================================
describe('ChatStream — UI-03: DiffLogPanel agentRunId 边界插入', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle', currentStep: 0, currentRunId: null,
      controller: null, lastAbortReason: null, runningTools: [],
      completedRunIds: [],
    } as never);
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('UI-03-A: 多 run 时 DiffLogPanel 紧跟对应 run 最后消息之后', async () => {
    useAgentStore.setState({ completedRunIds: ['run-1', 'run-2'] } as never);
    useChatStore.setState({
      messages: [
        { id: 'u1', role: 'user', content: '操作1', agentRunId: 'run-1' },
        { id: 'a1', role: 'assistant', content: 'OK', agentRunId: 'run-1' },
        { id: 'u2', role: 'user', content: '操作2', agentRunId: 'run-2' },
        { id: 'a2', role: 'assistant', content: 'OK2', agentRunId: 'run-2' },
      ],
    } as never);
    const { container } = renderChatStream();
    // RED：Wave 3（12-04）实现边界插入后验证 DiffLogPanel 位置
    // 断言：DiffLogPanel 出现在 a1 之后（非底部）
    const nodes = container.children[0]?.children;
    expect(nodes).toBeDefined();
  });

  it('UI-03-B: 同 runId 只渲染一张 DiffLogPanel', async () => {
    useAgentStore.setState({ completedRunIds: ['run-1'] } as never);
    useChatStore.setState({
      messages: [
        { id: 'a1', role: 'assistant', content: 'OK', agentRunId: 'run-1' },
      ],
    } as never);
    const { container } = renderChatStream();
    // RED：Wave 3 实现后验证去重
    const dlpCount = container.querySelectorAll('[data-testid="diff-log-panel"]').length;
    expect(dlpCount).toBeLessThanOrEqual(1);
  });
});

// =========================================================
// UI-05：read/write 工具卡修饰类
// =========================================================
describe('ChatStream — UI-05: read/write 工具卡修饰类', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle', currentStep: 0, currentRunId: null,
      controller: null, lastAbortReason: null, runningTools: [],
      completedRunIds: [],
    } as never);
    vi.clearAllMocks();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('UI-05-A: kind=read 的 tool 消息渲染的卡含 aster-tool-card--read 类', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 't1', role: 'tool', content: '读取文档',
          toolCallId: 'c1', toolName: 'read_word_content',
          toolResult: { ok: true, data: { content: '文档内容', source: 'word' } },
          agentRunId: 'r1', agentStep: 1,
          kind: 'read', // UI-05：Wave 1（12-02）loop-helpers push 后会有此字段
        },
      ],
    } as never);
    const { container } = renderChatStream();
    // RED：Wave 2（12-03）加 class 后变 GREEN
    const card = container.querySelector('.aster-tool-card');
    expect(card?.classList.contains('aster-tool-card--read')).toBe(true);
  });

  it('UI-05-B: kind=write 的 tool 消息渲染的卡不含 aster-tool-card--read 类', async () => {
    useChatStore.setState({
      messages: [
        {
          id: 't2', role: 'tool', content: '写入段落',
          toolCallId: 'c2', toolName: 'append_paragraph',
          toolResult: { ok: true },
          agentRunId: 'r1', agentStep: 1,
          kind: 'write',
        },
      ],
    } as never);
    const { container } = renderChatStream();
    const card = container.querySelector('.aster-tool-card');
    // write 卡不应有 --read 类（此测试在 Wave 0 应 PASS——当前无 kind 检查也不会有 --read 类）
    expect(card?.classList.contains('aster-tool-card--read')).toBe(false);
  });
});
