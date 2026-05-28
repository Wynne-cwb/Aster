/**
 * src/components/InputBar.test.tsx — Send 按钮 agent 状态守卫（Plan 03-05 Task 5.2）
 *
 * 覆盖目标：
 * - agentStatus !== 'idle' 时 Send 按钮 disabled（防止用户在 agent run 中串场 prompt）
 *   - running / paused / soft-landing 全 disabled
 *   - idle 且 input 非空 → enabled
 * - Test infra: RTL + jsdom + Zustand setState（沿用 ChatStream.test.tsx / SelectionPill.test.tsx 范式）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import InputBar from './InputBar';
import { useAgentStore } from '../agent/agentStore';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro：t / Trans 直通
// ---------------------------------------------------------------------------
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings.join(''),
    i18n: { _: (id: string) => id },
  }),
}));

// ---------------------------------------------------------------------------
// Mock SelectionPill：避免拉入 selection 全量依赖
// ---------------------------------------------------------------------------
vi.mock('./SelectionPill', () => ({
  default: () => <div data-testid="selection-pill-stub" />,
}));

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------
const mockAdapter = {
  capabilities: () => ({
    host: 'word' as const,
    supportsSelectionEvents: true,
    supportedInserts: ['text' as const],
  }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
} as unknown as DocumentAdapter;

function renderInputBar() {
  return render(
    <AdapterContext.Provider value={mockAdapter}>
      <InputBar />
    </AdapterContext.Provider>,
  );
}

// ---------------------------------------------------------------------------
// Helper: 重置 agentStore 到指定状态
// ---------------------------------------------------------------------------
function setAgentStatus(status: 'idle' | 'running' | 'paused' | 'soft-landing') {
  useAgentStore.setState({
    agentStatus: status,
    currentStep: status === 'idle' ? 0 : 1,
    currentRunId: status === 'idle' ? null : 'r-test',
    controller: status === 'idle' ? null : new AbortController(),
    lastAbortReason: null,
    runningTools: [],
  } as never);
}

// ---------------------------------------------------------------------------
// 测试
// ---------------------------------------------------------------------------
describe('InputBar Send 按钮 — agent 状态守卫（Plan 03-05 D-01 / A-14）', () => {
  beforeEach(() => {
    setAgentStatus('idle');
  });

  it.each([
    ['running', true],
    ['paused', true],
    ['soft-landing', true],
  ] as Array<['running' | 'paused' | 'soft-landing', boolean]>)(
    'agentStatus=%s → Send 按钮 disabled=%s（input 非空时）',
    (status, expectDisabled) => {
      setAgentStatus(status);

      const { getByLabelText } = renderInputBar();

      // 模拟用户输入（让「空 input」disabled 路径失效）
      const textarea = getByLabelText('消息输入框') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'hi' } });

      // running / paused / soft-landing 时按钮显示「停止生成」（v1 D-14 isStreaming 切换）
      // running 时按钮 onClick = stopStreaming 而非 send，但 disabled 仍以 agentStatus 为准
      const buttons = document.querySelectorAll('button.aster-send');
      expect(buttons.length).toBe(1);
      const sendBtn = buttons[0] as HTMLButtonElement;
      expect(sendBtn.disabled).toBe(expectDisabled);
    },
  );

  it('agentStatus=idle + input 非空 → Send 按钮 enabled', () => {
    setAgentStatus('idle');

    const { getByLabelText } = renderInputBar();

    const textarea = getByLabelText('消息输入框') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });

    const sendBtn = document.querySelector('button.aster-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
  });

  it('agentStatus=idle + input 空 → Send 按钮 disabled（v1 empty-input 路径仍生效）', () => {
    setAgentStatus('idle');

    renderInputBar();

    const sendBtn = document.querySelector('button.aster-send') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });
});
