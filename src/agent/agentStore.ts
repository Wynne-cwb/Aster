/**
 * src/agent/agentStore.ts — Phase 3 agent 状态机（AGENT-13 单一 abort 入口）
 *
 * 4 路 abort（visibility / user / max_steps / circuit）全部通过 abort(reason) 入口；
 * pause / resume 不调 controller.abort（in-flight tool 自然跑完 — PITFALLS A-08）。
 *
 * 设计要点：
 *   - awaitResume：paused 时阻塞，resume 后 resolve，signal abort 则 reject AbortError
 *   - setSoftLanding：MAX_STEPS=20 软着陆（不 abort controller）
 *   - continueRun：用户点「继续」推进 → reset currentStep + status=running
 *   - runAgent：调 loop.runAgent，try/finally 兜底 endRun
 */
import { create } from 'zustand';
import type { DocumentAdapter, SelectionContext } from '../adapters/DocumentAdapter';
import { useProviderStore } from '../store/providers';

/**
 * AGENT-13 / Q9：max_steps 软着陆阈值。
 * 定义在轻量 agentStore（而非 loop.ts），让 AgentControlBar 等 UI 仅为读此常量
 * 不必静态引入重量级的 loop 链（loop + loop-helpers + 全套工具注册表 + system-prompt）。
 * runAgent 的实现改为在调用时 dynamic import('./loop')，把该链从初始 main chunk 移出，
 * 守住 ≤82KB 预算（[[project_bundle_size_guard]] 非热路径模块一律懒加载；adapters 已用同款模式）。
 */
export const MAX_STEPS = 20;

export type AgentStatus = 'idle' | 'running' | 'paused' | 'soft-landing';
export type AbortReason = 'visibility' | 'user' | 'max_steps' | 'circuit';
export type AgentPhase = 'thinking' | 'reading' | 'writing';

interface RunningTool {
  id: string;
  name: string;
}

/** circuit abort 元数据（ERR-04 红卡 X 来源），由 loop-helpers 在 circuit 分支设置 */
export interface CircuitInfo {
  toolName: string;
  code: string;
  count: number;
}

interface AgentState {
  agentStatus: AgentStatus;
  currentStep: number;
  currentRunId: string | null;
  controller: AbortController | null;
  lastAbortReason: AbortReason | null;
  runningTools: RunningTool[];
  /** 三态进度相位（AGENT-12）：null = 非运行中 */
  currentPhase: AgentPhase | null;
  /** 最近一次 setPhase / setCurrentStep 的时间戳（ms），5 秒安抚用（Plan 07）*/
  lastUpdateTs: number;
  /** circuit abort 元数据（ERR-04）：null = 非 circuit abort */
  lastCircuitInfo: CircuitInfo | null;
  /** 已完成的 runId 列表（AGENT-07）：DiffLogPanel 订阅用，每次 endRun 追加 */
  completedRunIds: string[];

  beginRun(runId: string): AbortController;
  setCurrentStep(n: number): void;
  setPhase(p: AgentPhase): void;
  setCircuitInfo(info: CircuitInfo): void;
  pause(): void;
  resume(): void;
  abort(reason: AbortReason): void;
  awaitResume(signal: AbortSignal): Promise<void>;
  setSoftLanding(runId: string): void;
  continueRun(): void;
  endRun(): void;
  runAgent(
    prompt: string,
    selectionCtx: SelectionContext | undefined,
    adapter: DocumentAdapter,
  ): Promise<void>;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agentStatus: 'idle',
  currentStep: 0,
  currentRunId: null,
  controller: null,
  lastAbortReason: null,
  runningTools: [],
  currentPhase: null,
  lastUpdateTs: 0,
  lastCircuitInfo: null,
  completedRunIds: [],

  beginRun(runId) {
    const controller = new AbortController();
    set({
      agentStatus: 'running',
      currentStep: 0,
      currentRunId: runId,
      controller,
      lastAbortReason: null,
      runningTools: [],
      currentPhase: null,
      lastUpdateTs: Date.now(),
      lastCircuitInfo: null,
    });
    return controller;
  },

  setCurrentStep(n) {
    set({ currentStep: n, lastUpdateTs: Date.now() });
  },

  setPhase(p) {
    set({ currentPhase: p, lastUpdateTs: Date.now() });
  },

  setCircuitInfo(info) {
    set({ lastCircuitInfo: info });
  },

  pause() {
    if (get().agentStatus === 'running') set({ agentStatus: 'paused' });
  },

  resume() {
    if (get().agentStatus === 'paused') set({ agentStatus: 'running' });
  },

  /** 单一 abort 入口（AGENT-13 / D-10） — 4 路调用方一律走此函数 */
  abort(reason) {
    set({ lastAbortReason: reason, agentStatus: 'idle' });
    get().controller?.abort();
  },

  /** pause primitive — paused 时 await 阻塞；resume 时 resolve；signal abort 时 reject */
  awaitResume(signal) {
    if (get().agentStatus !== 'paused') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const unsub = useAgentStore.subscribe((s, prev) => {
        if (prev.agentStatus === 'paused' && s.agentStatus !== 'paused') {
          unsub();
          resolve();
        }
      });
      const onAbort = () => {
        unsub();
        reject(new DOMException('aborted', 'AbortError'));
      };
      if (signal.aborted) {
        unsub();
        reject(new DOMException('aborted', 'AbortError'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    });
  },

  setSoftLanding(_runId) {
    set({ agentStatus: 'soft-landing' });
  },

  /** D-09 软着陆「继续 20 步」— reset counter，同 runId 累计 ≥20 步 */
  continueRun() {
    set({ agentStatus: 'running', currentStep: 0, currentPhase: null });
  },

  endRun() {
    const runId = get().currentRunId;
    set((s) => ({
      agentStatus: 'idle',
      currentRunId: null,
      controller: null,
      currentStep: 0,
      runningTools: [],
      currentPhase: null,
      lastCircuitInfo: null,
      completedRunIds: runId ? [...s.completedRunIds, runId] : s.completedRunIds,
    }));
  },

  async runAgent(prompt, selectionCtx, adapter) {
    // A-21 pre-flight：仅当 supportsToolCall 明确为 false 时拦截（null/undefined = 未探测，放行）
    // RESEARCH.md Pitfall 2：严格 === false，不用 !value（null/undefined 应放行）
    const providerStore = useProviderStore.getState();
    const currentProvider = providerStore.providers.find(
      (p) => p.id === providerStore.defaultLLMProviderId,
    );
    if (currentProvider?.supportsToolCall === false) {
      // 动态 import useChatStore 避免 chat.ts ↔ agentStore.ts 循环依赖（chat.ts 已静态引入 agentStore）
      const { useChatStore } = await import('../store/chat');
      useChatStore.getState().pushMessage({
        role: 'error',
        content: '当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1',
        errorCode: 'UNSUPPORTED',
      });
      return;
    }

    const runId = crypto.randomUUID();
    const controller = get().beginRun(runId);
    try {
      // 按需加载 agent loop（含全套工具注册表 + system-prompt），从初始 main chunk 移出。
      const { runAgent: runAgentLoop } = await import('./loop');
      await runAgentLoop(prompt, selectionCtx, adapter, controller.signal, runId);
    } finally {
      // endRun 在 loop 内部退出或软着陆后调；这里兜底，避免漏 reset 状态
      if (get().agentStatus !== 'soft-landing') {
        get().endRun();
      }
    }
  },
}));

export const useAgentStatus = () => useAgentStore((s) => s.agentStatus);
export const useCurrentStep = () => useAgentStore((s) => s.currentStep);
export const useCompletedRunIds = () => useAgentStore((s) => s.completedRunIds);
