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
import { runAgent as runAgentLoop, MAX_STEPS } from './loop';

export type AgentStatus = 'idle' | 'running' | 'paused' | 'soft-landing';
export type AbortReason = 'visibility' | 'user' | 'max_steps' | 'circuit';
export type AgentPhase = 'thinking' | 'reading' | 'writing';

interface RunningTool {
  id: string;
  name: string;
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

  beginRun(runId: string): AbortController;
  setCurrentStep(n: number): void;
  setPhase(p: AgentPhase): void;
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
    });
    return controller;
  },

  setCurrentStep(n) {
    set({ currentStep: n, lastUpdateTs: Date.now() });
  },

  setPhase(p) {
    set({ currentPhase: p, lastUpdateTs: Date.now() });
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
    set({
      agentStatus: 'idle',
      currentRunId: null,
      controller: null,
      currentStep: 0,
      runningTools: [],
      currentPhase: null,
    });
  },

  async runAgent(prompt, selectionCtx, adapter) {
    const runId = crypto.randomUUID();
    const controller = get().beginRun(runId);
    try {
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
export { MAX_STEPS };
