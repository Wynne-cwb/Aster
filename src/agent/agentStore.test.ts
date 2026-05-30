import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';
import { useProviderStore } from '../store/providers';
import { useChatStore } from '../store/chat';

// ---------------------------------------------------------------------------
// Mock ./loop：防止 dynamic import 触发真实 agent loop（bundle guard）
// ---------------------------------------------------------------------------
vi.mock('./loop', () => ({
  runAgent: vi.fn().mockResolvedValue(undefined),
}));

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

// ---------------------------------------------------------------------------
// A-21 pre-flight 拦截测试
// 守门逻辑应立即生效（非 describe.skip）：
//   supportsToolCall === false  → 阻断 → error push + 不调 beginRun
//   supportsToolCall === null   → 放行（未探测状态）
//   supportsToolCall === undefined → 放行（老 Provider 无此字段）
// ---------------------------------------------------------------------------
describe('agentStore A-21 pre-flight 拦截', () => {
  const agentInitState = {
    agentStatus: 'idle' as const,
    currentStep: 0,
    currentRunId: null,
    controller: null,
    lastAbortReason: null,
    runningTools: [],
    currentPhase: null,
    lastUpdateTs: 0,
    lastCircuitInfo: null,
    completedRunIds: [] as string[],
  };

  beforeEach(() => {
    useAgentStore.setState(agentInitState);
    useChatStore.setState({ messages: [] });
    useProviderStore.setState({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          isBuiltIn: true,
        },
      ],
      defaultLLMProviderId: 'deepseek',
    } as never);
  });

  it('supportsToolCall===false → pushMessage error 并 return，不调 beginRun', async () => {
    useProviderStore.setState({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          isBuiltIn: true,
          supportsToolCall: false,
        },
      ],
      defaultLLMProviderId: 'deepseek',
    } as never);

    const adapter = {} as never;
    await useAgentStore.getState().runAgent('test prompt', undefined, adapter);

    // beginRun 未被调用 → completedRunIds 保持空（runId 只在 endRun 时追加）
    expect(useAgentStore.getState().completedRunIds).toHaveLength(0);

    // error message 已 push 到 chatStore，errorCode = 'UNSUPPORTED'
    const errorMsg = useChatStore
      .getState()
      .messages.find((m) => m.role === 'error' && m.errorCode === 'UNSUPPORTED');
    expect(errorMsg).toBeDefined();
  });

  it('supportsToolCall===null → runAgent 放行（未探测状态，不 push error）', async () => {
    useProviderStore.setState({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          isBuiltIn: true,
          supportsToolCall: null,
        },
      ],
      defaultLLMProviderId: 'deepseek',
    } as never);

    const adapter = {} as never;
    await useAgentStore.getState().runAgent('test prompt', undefined, adapter);

    // beginRun 被调用 → run 完成后 completedRunIds 追加了 runId
    expect(useAgentStore.getState().completedRunIds).toHaveLength(1);

    // 无 UNSUPPORTED error
    const errorMsg = useChatStore
      .getState()
      .messages.find((m) => m.errorCode === 'UNSUPPORTED');
    expect(errorMsg).toBeUndefined();
  });

  it('supportsToolCall===undefined → runAgent 放行（无此字段，不 push error）', async () => {
    // Provider 无 supportsToolCall 字段（老版本 Provider）
    useProviderStore.setState({
      providers: [
        {
          id: 'deepseek',
          name: 'DeepSeek',
          baseURL: 'https://api.deepseek.com',
          model: 'deepseek-v4-flash',
          isBuiltIn: true,
          // supportsToolCall 字段缺失 = undefined
        },
      ],
      defaultLLMProviderId: 'deepseek',
    } as never);

    const adapter = {} as never;
    await useAgentStore.getState().runAgent('test prompt', undefined, adapter);

    // beginRun 被调用 → completedRunIds 追加
    expect(useAgentStore.getState().completedRunIds).toHaveLength(1);

    // 无 UNSUPPORTED error
    const errorMsg = useChatStore
      .getState()
      .messages.find((m) => m.errorCode === 'UNSUPPORTED');
    expect(errorMsg).toBeUndefined();
  });
});
