import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';

describe('agentStore state transitions', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: 0,
    });
  });

  it('pause/resume transitions (AGENT-12)', () => {
    useAgentStore.setState({ agentStatus: 'running' });
    useAgentStore.getState().pause();
    expect(useAgentStore.getState().agentStatus).toBe('paused');
    useAgentStore.getState().resume();
    expect(useAgentStore.getState().agentStatus).toBe('running');
  });

  it.each(['visibility', 'user', 'max_steps', 'circuit'] as const)(
    'abort source %s — 调 controller.abort + lastAbortReason 字段 (AGENT-13)',
    (reason) => {
      const ctrl = new AbortController();
      useAgentStore.setState({ controller: ctrl, agentStatus: 'running' });
      useAgentStore.getState().abort(reason);
      expect(useAgentStore.getState().lastAbortReason).toBe(reason);
      expect(useAgentStore.getState().agentStatus).toBe('idle');
      expect(ctrl.signal.aborted).toBe(true);
    },
  );

  it('pause does not abort in-flight tool (PITFALLS A-08)', () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ controller: ctrl, agentStatus: 'running' });
    useAgentStore.getState().pause();
    expect(useAgentStore.getState().agentStatus).toBe('paused');
    expect(ctrl.signal.aborted).toBe(false); // pause 绝不 abort controller
  });

  it('awaitResume — paused 时阻塞；resume 后 resolve', async () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ controller: ctrl, agentStatus: 'paused' });
    let resolved = false;
    const p = useAgentStore
      .getState()
      .awaitResume(ctrl.signal)
      .then(() => {
        resolved = true;
      });
    await new Promise((r) => setTimeout(r, 10));
    expect(resolved).toBe(false);
    useAgentStore.getState().resume();
    await p;
    expect(resolved).toBe(true);
  });

  it('awaitResume — signal abort 时 reject AbortError', async () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ controller: ctrl, agentStatus: 'paused' });
    const p = useAgentStore.getState().awaitResume(ctrl.signal);
    ctrl.abort();
    await expect(p).rejects.toThrow();
  });

  it('awaitResume — running 状态直接 resolve（非阻塞）', async () => {
    const ctrl = new AbortController();
    useAgentStore.setState({ controller: ctrl, agentStatus: 'running' });
    await expect(useAgentStore.getState().awaitResume(ctrl.signal)).resolves.toBeUndefined();
  });

  it('setSoftLanding + continueRun: agentStatus 流转', () => {
    useAgentStore.setState({ agentStatus: 'running', currentStep: 20 });
    useAgentStore.getState().setSoftLanding('r-soft');
    expect(useAgentStore.getState().agentStatus).toBe('soft-landing');
    useAgentStore.getState().continueRun();
    expect(useAgentStore.getState().agentStatus).toBe('running');
    expect(useAgentStore.getState().currentStep).toBe(0);
  });

  it('endRun: 清空所有 run 字段', () => {
    const ctrl = new AbortController();
    useAgentStore.setState({
      agentStatus: 'running',
      currentStep: 5,
      currentRunId: 'r1',
      controller: ctrl,
      runningTools: [{ id: 't1', name: 'append_paragraph' }],
    });
    useAgentStore.getState().endRun();
    expect(useAgentStore.getState().agentStatus).toBe('idle');
    expect(useAgentStore.getState().currentRunId).toBeNull();
    expect(useAgentStore.getState().controller).toBeNull();
    expect(useAgentStore.getState().currentStep).toBe(0);
    expect(useAgentStore.getState().runningTools).toEqual([]);
  });
});

describe('agentStore 三态字段（AGENT-12）', () => {
  beforeEach(() => {
    useAgentStore.setState({
      agentStatus: 'idle',
      currentStep: 0,
      currentRunId: null,
      controller: null,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: 0,
    });
  });

  it('初始 currentPhase = null，lastUpdateTs = 0', () => {
    expect(useAgentStore.getState().currentPhase).toBeNull();
    expect(useAgentStore.getState().lastUpdateTs).toBe(0);
  });

  it('setPhase("thinking") 切换 currentPhase + 更新 lastUpdateTs', () => {
    const before = Date.now();
    useAgentStore.getState().setPhase('thinking');
    const after = Date.now();
    expect(useAgentStore.getState().currentPhase).toBe('thinking');
    expect(useAgentStore.getState().lastUpdateTs).toBeGreaterThanOrEqual(before);
    expect(useAgentStore.getState().lastUpdateTs).toBeLessThanOrEqual(after);
  });

  it('setPhase("reading") 切换 currentPhase', () => {
    useAgentStore.getState().setPhase('reading');
    expect(useAgentStore.getState().currentPhase).toBe('reading');
  });

  it('setPhase("writing") 切换 currentPhase', () => {
    useAgentStore.getState().setPhase('writing');
    expect(useAgentStore.getState().currentPhase).toBe('writing');
  });

  it('setCurrentStep 也刷新 lastUpdateTs', () => {
    const before = Date.now();
    useAgentStore.getState().setCurrentStep(3);
    const after = Date.now();
    expect(useAgentStore.getState().currentStep).toBe(3);
    expect(useAgentStore.getState().lastUpdateTs).toBeGreaterThanOrEqual(before);
    expect(useAgentStore.getState().lastUpdateTs).toBeLessThanOrEqual(after);
  });

  it('beginRun reset currentPhase = null', () => {
    useAgentStore.getState().setPhase('reading');
    useAgentStore.getState().beginRun('run-1');
    expect(useAgentStore.getState().currentPhase).toBeNull();
  });

  it('endRun reset currentPhase = null', () => {
    useAgentStore.setState({ agentStatus: 'running', currentPhase: 'writing' });
    useAgentStore.getState().endRun();
    expect(useAgentStore.getState().currentPhase).toBeNull();
  });

  it('continueRun reset currentPhase = null', () => {
    useAgentStore.setState({ agentStatus: 'soft-landing', currentPhase: 'thinking' });
    useAgentStore.getState().continueRun();
    expect(useAgentStore.getState().currentPhase).toBeNull();
  });
});
