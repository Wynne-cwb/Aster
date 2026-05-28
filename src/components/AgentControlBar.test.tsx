/**
 * src/components/AgentControlBar.test.tsx — Phase 3 完整版（AGENT-02 / AGENT-12 / AGENT-13）
 *
 * 覆盖 7 个 it：
 *   1. agentStatus='idle' → 不渲染（container.firstChild === null）
 *   2. agentStatus='running' currentStep=3 → 渲染 "3 / 20" + 暂停 + 中止
 *   3. agentStatus='paused' currentStep=5 → 渲染 "5 / 20" + 继续（PlayIcon）+ 中止
 *   4. agentStatus='soft-landing' currentStep=20 → 渲染 "20 / 20" + 中止（无暂停/继续）
 *   5. 点暂停（running 态）→ agentStatus='paused'
 *   6. 点继续（paused 态）→ agentStatus='running'
 *   7. 点中止 → lastAbortReason='user'，controller.signal.aborted=true
 *
 * 测试基础设施：@testing-library/react（路径 A，与 ChatStream.test.tsx 同一套）
 * 环境：vitest + jsdom
 *
 * lingui mock：`t\`暂停\`` 通过 String.raw({raw}) 还原为字符串原文（无插值场景），
 * 这样 getByLabelText('暂停') 可以拿到对应 button。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import AgentControlBar from './AgentControlBar';
import { useAgentStore } from '../agent/agentStore';

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
    });
  });

  it('agentStatus = "idle" → 不渲染', () => {
    const { container } = render(<AgentControlBar />);
    expect(container.firstChild).toBeNull();
  });

  it('agentStatus = "running" currentStep=3 → 渲染 "3 / 20" + 暂停 + 中止', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 3 });
    const { container, getByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(/3 \/ 20/);
    expect(getByLabelText('暂停')).toBeTruthy();
    expect(getByLabelText('中止')).toBeTruthy();
  });

  it('agentStatus = "paused" currentStep=5 → 渲染 "5 / 20" + 继续 + 中止', () => {
    useAgentStore.setState({ agentStatus: 'paused', currentStep: 5 });
    const { container, getByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(/5 \/ 20/);
    expect(getByLabelText('继续')).toBeTruthy();
    expect(getByLabelText('中止')).toBeTruthy();
  });

  it('agentStatus = "soft-landing" → 渲染 step counter + 中止；不显示暂停/继续', () => {
    useAgentStore.setState({ agentStatus: 'soft-landing', currentStep: 20 });
    const { container, getByLabelText, queryByLabelText } = render(<AgentControlBar />);
    expect(container.textContent ?? '').toMatch(/20 \/ 20/);
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
});
