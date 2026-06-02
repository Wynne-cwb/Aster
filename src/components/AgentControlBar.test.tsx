/**
 * src/components/AgentControlBar.test.tsx — Phase 3 + Phase 4 Plan 07（AGENT-12）
 *
 * 覆盖：
 *   基础（Phase 3，7 项）：
 *   1. agentStatus='idle' → 不渲染
 *   2. agentStatus='running' currentStep=3 → 渲染 "3 / MAX_STEPS" + 暂停 + 中止
 *   3. agentStatus='paused' currentStep=5 → 渲染 "5 / MAX_STEPS" + 继续（PlayIcon）+ 中止
 *   4. agentStatus='soft-landing' currentStep=MAX_STEPS → 渲染 "MAX_STEPS / MAX_STEPS" + 中止（无暂停/继续）
 *   5. 点暂停（running 态）→ agentStatus='paused'
 *   6. 点继续（paused 态）→ agentStatus='running'
 *   7. 点中止 → lastAbortReason='user'，controller.signal.aborted=true
 *
 *   三态文案（AGENT-12，3 项）：
 *   8. currentPhase='thinking' → 显示「正在思考…」
 *   9. currentPhase='reading'  → 显示「正在读取…」
 *  10. currentPhase='writing'  → 显示「正在写入…」
 *  11. currentPhase=null       → 不显示 phase 文案行
 *
 *   5 秒安抚行（D-03，3 项）：
 *  12. lastUpdateTs 在 5s 内 → 不显示安抚行
 *  13. 推进 fake timer 5s 后 lastUpdateTs 过期 → 显示 thinking 安抚文案
 *  14. phase=reading，推进 5s → 安抚文案随 phase 变
 *
 * 环境：vitest + jsdom + @testing-library/react
 * lingui mock：t`...` 返回模板字符串原文（无插值）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import AgentControlBar from './AgentControlBar';
import { useAgentStore, MAX_STEPS } from '../agent/agentStore';

vi.mock('@lingui/react/macro', () => ({
  useLingui: () => ({
    t: (s: TemplateStringsArray) => String.raw({ raw: s }),
    i18n: { _: (s: string) => s },
  }),
}));

describe('AgentControlBar (AGENT-02 / AGENT-12 / AGENT-13)', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: Date.now(),
    });
  });

  // ---- Phase 3 基础行为 ----

  it('agentStatus = "idle" → 不渲染', () => {
    const { container } = render(<AgentControlBar />);
    expect(container.firstChild).toBeNull();
  });

  it(`agentStatus = "running" currentStep=3 → 渲染 "3 / ${MAX_STEPS}" + 暂停 + 中止`, () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 3 });
    const { container, getByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(new RegExp(`3 / ${MAX_STEPS}`));
    expect(getByLabelText('暂停')).toBeTruthy();
    expect(getByLabelText('中止')).toBeTruthy();
  });

  it(`agentStatus = "paused" currentStep=5 → 渲染 "5 / ${MAX_STEPS}" + 继续 + 中止`, () => {
    useAgentStore.setState({ agentStatus: 'paused', currentStep: 5 });
    const { container, getByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(new RegExp(`5 / ${MAX_STEPS}`));
    expect(getByLabelText('继续')).toBeTruthy();
    expect(getByLabelText('中止')).toBeTruthy();
  });

  it('agentStatus = "soft-landing" → 渲染 step counter + 中止；不显示暂停/继续', () => {
    useAgentStore.setState({ agentStatus: 'soft-landing', currentStep: MAX_STEPS });
    const { container, getByLabelText, queryByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(new RegExp(`${MAX_STEPS} / ${MAX_STEPS}`));
    expect(getByLabelText('中止')).toBeTruthy();
    expect(queryByLabelText('暂停')).toBeNull();
    expect(queryByLabelText('继续')).toBeNull();
  });

  it('点 pause 按钮（running 态）→ agentStatus = "paused"', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1 });
    const { getByLabelText } = render(<AgentControlBar />);
    fireEvent.click(getByLabelText('暂停'));
    expect(useAgentStore.getState().agentStatus).toBe('paused');
  });

  it('点 resume 按钮（paused 态）→ agentStatus = "running"', () => {
    useAgentStore.setState({ agentStatus: 'paused', currentStep: 1 });
    const { getByLabelText } = render(<AgentControlBar />);
    fireEvent.click(getByLabelText('继续'));
    expect(useAgentStore.getState().agentStatus).toBe('running');
  });

  it('点 abort 按钮 → lastAbortReason="user"，controller.signal.aborted=true', () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, controller: ctrl });
    const { getByLabelText } = render(<AgentControlBar />);
    fireEvent.click(getByLabelText('中止'));
    expect(useAgentStore.getState().lastAbortReason).toBe('user');
    expect(useAgentStore.getState().agentStatus).toBe('idle');
    expect(ctrl.signal.aborted).toBe(true);
  });

  // ---- AGENT-12 三态文案 ----

  it('currentPhase="thinking" → 显示「正在思考…」', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'thinking', lastUpdateTs: Date.now() });
    const { getByText } = render(<AgentControlBar />);
    expect(getByText('正在思考…')).toBeTruthy();
  });

  it('currentPhase="reading" → 显示「正在读取…」', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'reading', lastUpdateTs: Date.now() });
    const { getByText } = render(<AgentControlBar />);
    expect(getByText('正在读取…')).toBeTruthy();
  });

  it('currentPhase="writing" → 显示「正在写入…」', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'writing', lastUpdateTs: Date.now() });
    const { getByText } = render(<AgentControlBar />);
    expect(getByText('正在写入…')).toBeTruthy();
  });

  it('currentPhase=null → 不显示 phase 文案行', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: null, lastUpdateTs: Date.now() });
    const { queryByText } = render(<AgentControlBar />);
    expect(queryByText('正在思考…')).toBeNull();
    expect(queryByText('正在读取…')).toBeNull();
    expect(queryByText('正在写入…')).toBeNull();
  });

  // ---- D-03 5 秒安抚行（fake timer）----

  it('lastUpdateTs 在 5s 内 → 不显示安抚行', () => {
    vi.useFakeTimers();
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'thinking', lastUpdateTs: Date.now() });
    const { queryByText } = render(<AgentControlBar />);
    // 推进 4s — 尚未超过 5s
    act(() => { vi.advanceTimersByTime(4000); });
    expect(queryByText(/还在跑/)).toBeNull();
    vi.useRealTimers();
  });

  it('lastUpdateTs 超 5s（thinking）→ 显示安抚行', () => {
    vi.useFakeTimers();
    const staleTs = Date.now() - 6000; // 已超时
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'thinking', lastUpdateTs: staleTs });
    const { getByText } = render(<AgentControlBar />);
    // 触发 setInterval 首次 tick
    act(() => { vi.advanceTimersByTime(1100); });
    expect(getByText('还在跑，正在等 LLM 思考…')).toBeTruthy();
    vi.useRealTimers();
  });

  it('lastUpdateTs 超 5s（reading）→ 安抚文案随 phase 变「正在读取，稍候…」', () => {
    vi.useFakeTimers();
    const staleTs = Date.now() - 6000;
    useAgentStore.setState({ agentStatus: 'running', currentStep: 1, currentPhase: 'reading', lastUpdateTs: staleTs });
    const { getByText } = render(<AgentControlBar />);
    act(() => { vi.advanceTimersByTime(1100); });
    expect(getByText('正在读取，稍候…')).toBeTruthy();
    vi.useRealTimers();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
