/**
 * src/components/InputBar.test.tsx — Phase 04.1 D-01/D-02 结构验证
 *
 * 覆盖目标（更新后）：
 * - STRUCT-01: ContextCard 不再渲染（ContextCard 已退役，InputBar 无 ContextCard 引用）
 * - STRUCT-02: selpill-row 在顶部（有选区时），tools 行在 textarea 之后（gear | paperclip | send）
 * - agentStatus !== 'idle' 时 send-btn disabled（防止用户在 agent run 中串场 prompt）
 * - agentStatus=idle + input 非空 → send-btn enabled
 * - agentStatus=idle + input 空 → send-btn disabled
 *
 * Test infra: RTL + jsdom + Zustand setState
 * Props: InputBar 现在需要 onGoSettings: () => void prop
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import InputBar from './InputBar';
import { useAgentStore } from '../agent/agentStore';
import { useSelectionStore } from '../store/selection';
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
// Mock formatSelection：避免拉入 i18n 宏
// ---------------------------------------------------------------------------
vi.mock('./formatSelection', () => ({
  formatSelection: () => '第 1 张 slide',
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

const mockOnGoSettings = vi.fn();

function renderInputBar() {
  return render(
    <AdapterContext.Provider value={mockAdapter}>
      <InputBar onGoSettings={mockOnGoSettings} />
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

describe('STRUCT-01: ContextCard 不再渲染（D-02 退役）', () => {
  it('InputBar DOM 内不应有 .aster-context 或 aster-topbar 相关节点', () => {
    renderInputBar();
    expect(document.querySelector('.aster-context')).toBeNull();
    expect(document.querySelector('.aster-topbar')).toBeNull();
  });
});

describe('STRUCT-02: selpill-row 在顶部，tools 行在底部', () => {
  beforeEach(() => {
    setAgentStatus('idle');
    // 无选区状态（default）
    useSelectionStore.setState({ initial: { kind: 'none' } });
  });

  it('无选区时不渲染 selpill-row', () => {
    renderInputBar();
    expect(document.querySelector('.selpill-row')).toBeNull();
  });

  it('有选区时渲染 selpill-row（含 SelectionPill）', () => {
    useSelectionStore.setState({
      initial: { kind: 'ppt', slideIndex: 1, slideCount: 5 },
    });
    renderInputBar();
    expect(document.querySelector('.selpill-row')).not.toBeNull();
    expect(screen.getByTestId('selection-pill-stub')).toBeDefined();
  });

  it('selpill-row 在 textarea 之前（DOM 顺序）', () => {
    useSelectionStore.setState({
      initial: { kind: 'word', charCount: 50 },
    });
    renderInputBar();
    const inputbar = document.querySelector('.inputbar');
    const children = Array.from(inputbar?.children ?? []);
    const selpillIdx = children.findIndex((el) => el.classList.contains('selpill-row'));
    const textareaIdx = children.findIndex((el) => el.tagName === 'TEXTAREA');
    expect(selpillIdx).toBeGreaterThanOrEqual(0);
    expect(textareaIdx).toBeGreaterThan(selpillIdx);
  });

  it('tools 行在 textarea 之后（DOM 顺序）', () => {
    renderInputBar();
    const inputbar = document.querySelector('.inputbar');
    const children = Array.from(inputbar?.children ?? []);
    const toolsIdx = children.findIndex((el) => el.classList.contains('tools'));
    const textareaIdx = children.findIndex((el) => el.tagName === 'TEXTAREA');
    expect(toolsIdx).toBeGreaterThan(textareaIdx);
  });

  it('tools 行内有 gear 按钮（aria-label=设置）', () => {
    renderInputBar();
    const gearBtn = screen.getByLabelText('设置');
    expect(gearBtn).toBeDefined();
  });

  it('gear 按钮点击调用 onGoSettings', () => {
    renderInputBar();
    const gearBtn = screen.getByLabelText('设置');
    fireEvent.click(gearBtn);
    expect(mockOnGoSettings).toHaveBeenCalledTimes(1);
  });

  it('paperclip 按钮 aria-disabled（文件上传即将开放）', () => {
    renderInputBar();
    const paperclipBtn = screen.getByLabelText('文件上传');
    expect(paperclipBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('inputbar-wrap 容器存在', () => {
    renderInputBar();
    expect(document.querySelector('.inputbar-wrap')).not.toBeNull();
  });
});

describe('Send 按钮 — agent 状态守卫（Plan 03-05 D-01 / A-14）', () => {
  beforeEach(() => {
    setAgentStatus('idle');
    useSelectionStore.setState({ initial: { kind: 'none' } });
  });

  it.each([
    ['running', true],
    ['paused', true],
    ['soft-landing', true],
  ] as Array<['running' | 'paused' | 'soft-landing', boolean]>)(
    'agentStatus=%s → send-btn disabled=%s（input 非空时）',
    (status, expectDisabled) => {
      setAgentStatus(status);

      renderInputBar();

      const textarea = screen.getByLabelText('消息输入框') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: 'hi' } });

      const sendBtn = document.querySelector('button.send-btn') as HTMLButtonElement;
      expect(sendBtn).not.toBeNull();
      expect(sendBtn.disabled).toBe(expectDisabled);
    },
  );

  it('agentStatus=idle + input 非空 → send-btn enabled', () => {
    setAgentStatus('idle');

    renderInputBar();

    const textarea = screen.getByLabelText('消息输入框') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });

    const sendBtn = document.querySelector('button.send-btn') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
  });

  it('agentStatus=idle + input 空 → send-btn disabled（empty-input 路径）', () => {
    setAgentStatus('idle');

    renderInputBar();

    const sendBtn = document.querySelector('button.send-btn') as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(true);
  });
});
