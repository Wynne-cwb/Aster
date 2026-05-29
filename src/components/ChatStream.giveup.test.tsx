/**
 * src/components/ChatStream.giveup.test.tsx — ERR-04「Agent gave up」红卡测试
 *
 * 覆盖：
 *   1. CIRCUIT_OPEN tool message → 渲染红卡，包含 X 次失败信息
 *   2. 红卡包含 LLM 最后 assistant 建议 Y
 *   3. 红卡有「重新试试」按钮
 *   4. 红卡无「撤销」字样（D-05）
 *   5. 点击「重新试试」→ 触发 useAgentStore.getState().runAgent（spy 断言被调用，参数含原始 user prompt）
 *   6. read 折叠卡展开预览 — 展示 source + content 截断（前 500 字）而非整个 JSON
 *   7. read 折叠卡 content > 500 字 → 显示「…(共 X 字)」
 *
 * 环境：vitest + jsdom + @testing-library/react
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import ChatStream from './ChatStream';
import { useChatStore } from '../store/chat';
import { useAgentStore } from '../agent/agentStore';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';
import type { Message } from '../store/chat';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./ChatBubble', () => ({
  default: ({ message }: { message: Message }) => (
    <div data-testid={`bubble-${message.id}`}>{message.content}</div>
  ),
}));

vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (s: TemplateStringsArray) => String.raw({ raw: s }),
    i18n: { _: (s: string) => s },
  }),
}));

if (!HTMLElement.prototype.scrollTo) {
  HTMLElement.prototype.scrollTo = function () {};
}

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

const mockAdapter: DocumentAdapter = {
  capabilities: () => ({
    host: 'word' as const,
    supportsSelectionEvents: false,
    supportedInserts: ['text' as const],
  }),
  getSelectionContext: () => Promise.resolve(undefined),
  insertText: () => Promise.resolve({ ok: true }),
  read: () => Promise.resolve({ ok: true, data: { result_type: 'text', content: '', source: '' } }),
};

// ---------------------------------------------------------------------------
// Helper: render with adapter provider
// ---------------------------------------------------------------------------

function renderChatStream() {
  return render(
    <AdapterContext.Provider value={mockAdapter}>
      <ChatStream onSettings={() => {}} />
    </AdapterContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const RUN_ID = 'run-abc';
const USER_PROMPT = '帮我把文档重写成摘要';

/** 构建测试消息组：user + assistant 建议 + CIRCUIT_OPEN tool */
function buildMessages(): Message[] {
  return [
    {
      id: 'msg-user-1',
      role: 'user',
      content: USER_PROMPT,
      agentRunId: RUN_ID,
    },
    {
      id: 'msg-asst-1',
      role: 'assistant',
      content: '我建议你先手动解锁文档，再重试。',
      agentRunId: RUN_ID,
    },
    {
      id: 'msg-circuit-1',
      role: 'tool',
      content: '工具失败，电路已断开',
      toolName: 'read_word',
      toolResult: {
        ok: false,
        error: {
          code: 'CIRCUIT_OPEN',
          message: '电路熔断',
          hint: '请稍后重试',
          recoverable: false,
        },
      },
      agentRunId: RUN_ID,
      agentStep: 3,
    },
  ];
}

describe('ChatStream — Agent gave up 红卡（ERR-04）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: 0,
      lastCircuitInfo: { toolName: 'read_word', code: 'HOST_API_FAILED', count: 3 },
    });
  });

  it('CIRCUIT_OPEN tool message → 渲染红卡标题「Aster 试了几次都没成功」', () => {
    useChatStore.setState({ messages: buildMessages() });
    const { getByText } = renderChatStream();
    expect(getByText('Aster 试了几次都没成功')).toBeTruthy();
  });

  it('红卡包含失败次数（X 次）信息', () => {
    useChatStore.setState({ messages: buildMessages() });
    const { container } = renderChatStream();
    expect(container.textContent).toMatch(/3/); // count=3
  });

  it('红卡包含 LLM 最后 assistant 建议 Y', () => {
    useChatStore.setState({ messages: buildMessages() });
    const { container } = renderChatStream();
    expect(container.textContent).toContain('我建议你先手动解锁文档，再重试。');
  });

  it('红卡有「重新试试」按钮', () => {
    useChatStore.setState({ messages: buildMessages() });
    const { getByText } = renderChatStream();
    expect(getByText('重新试试')).toBeTruthy();
  });

  it('红卡无「撤销」字样（D-05 诚实禁用）', () => {
    useChatStore.setState({ messages: buildMessages() });
    const { container } = renderChatStream();
    // 排查红卡区域（CIRCUIT_OPEN 分支），不含「撤销本次」
    expect(container.textContent).not.toMatch(/撤销本次/);
  });

  it('点击「重新试试」→ 触发 useAgentStore.runAgent（参数含原始 user prompt）', () => {
    useChatStore.setState({ messages: buildMessages() });
    const runAgentSpy = vi.fn().mockResolvedValue(undefined);
    // spy on getState().runAgent via store injection
    useAgentStore.setState({ runAgent: runAgentSpy } as never);

    const { getByText } = renderChatStream();
    fireEvent.click(getByText('重新试试'));

    expect(runAgentSpy).toHaveBeenCalledTimes(1);
    // 第一个参数为原始 user prompt
    expect(runAgentSpy.mock.calls[0][0]).toBe(USER_PROMPT);
  });
});

describe('ChatStream — read 折叠卡截断预览（Pitfall 4）', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [] });
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: 0,
      lastCircuitInfo: null,
    });
  });

  /** 构建一条 read 成功 tool message，content 为指定长度 */
  function buildReadMessage(contentLength: number): Message {
    const content = 'A'.repeat(contentLength);
    return {
      id: 'msg-read-1',
      role: 'tool',
      content: '读取文档内容',
      toolName: 'read_word',
      toolResult: {
        ok: true,
        data: { result_type: 'text', content, source: '第1页' },
      },
      agentRunId: 'run-read',
      agentStep: 1,
    };
  }

  it('展开 read 折叠卡 → 显示 source 而非整个 JSON', () => {
    useChatStore.setState({ messages: [buildReadMessage(100)] });
    const { getByText, getByRole } = renderChatStream();
    // 点击 header 展开
    fireEvent.click(getByRole('button', { name: /读取文档内容/ }));
    expect(getByText(/第1页/)).toBeTruthy();
  });

  it('content ≤ 500 字 → 完整显示 content，无「…(共」', () => {
    useChatStore.setState({ messages: [buildReadMessage(300)] });
    const { getByRole, container } = renderChatStream();
    fireEvent.click(getByRole('button', { name: /读取文档内容/ }));
    // 300 个 A 应可见
    expect(container.textContent).toContain('A'.repeat(300));
    expect(container.textContent).not.toMatch(/…\(共/);
  });

  it('content > 500 字 → 截断后显示「…(共 X 字)」', () => {
    useChatStore.setState({ messages: [buildReadMessage(800)] });
    const { getByRole, container } = renderChatStream();
    fireEvent.click(getByRole('button', { name: /读取文档内容/ }));
    expect(container.textContent).toMatch(/…\(共 800 字\)/);
    // 不应包含超过 500 个 A
    const text = container.textContent ?? '';
    expect(text.match(/A+/)?.[0]?.length ?? 0).toBeLessThanOrEqual(500);
  });
});
