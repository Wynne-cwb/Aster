/**
 * src/components/AgentControlBar.tsx — Phase 3 + Phase 4 Plan 07（AGENT-12 / D-03）
 *
 * 视觉走 CLAUDE.md §UI 设计系统：玻璃拟态容器 + 品牌渐变 accent（focus / hover）
 *   + 11px 步数小字 + 内联 SVG（Lucide 风 stroke=currentColor）。
 *
 * Plan 07 新增（AGENT-12）：
 *   - 三态文案：currentPhase='thinking'→「正在思考…」/'reading'→「正在读取…」/'writing'→「正在写入…」
 *   - 5 秒安抚行（D-03）：组件内 setInterval（SP-C，不进 store），超时显示随 phase 变文案。
 *     计时器在 status='idle' 或 unmount 时清理。
 *
 * soft-landing 态：不显示 pause/resume（loop 已停在 step 20 等待用户决策；
 * 继续/结束的入口在 ChatStream 内特殊消息卡片，Plan 05 已落）。
 * 仅保留 step counter（"20 / 20"）+ 中止按钮作为兜底。
 *
 * idle 时 return null — 仅按字段订阅（Zustand selector pattern，PATTERNS 范式），
 * 不订阅整个 store 避免无关字段变化导致全量 re-render。
 *
 * AGENT-13 单一 abort 入口：中止按钮调 abort('user')，
 *   abort 内部统一 lastAbortReason + controller.abort() + status='idle'。
 */
import { type ReactElement, useState, useEffect } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAgentStore, MAX_STEPS } from '../agent/agentStore';
import type { AgentPhase } from '../agent/agentStore';
import { PauseIcon, PlayIcon, StopIcon } from './icons';

/** 三态文案映射（正常状态，计时器未超时） */
function phaseLabel(phase: AgentPhase | null, t: (s: TemplateStringsArray) => string): string | null {
  if (phase === 'thinking') return t`正在思考…`;
  if (phase === 'reading') return t`正在读取…`;
  if (phase === 'writing') return t`正在写入…`;
  return null;
}

/** 5 秒安抚文案（超时后，随 phase 变） */
function stallLabel(phase: AgentPhase | null, t: (s: TemplateStringsArray) => string): string {
  if (phase === 'reading') return t`正在读取，稍候…`;
  if (phase === 'writing') return t`正在写入，稍候…`;
  return t`还在跑，正在等 LLM 思考…`;
}

export default function AgentControlBar(): ReactElement | null {
  const { t } = useLingui();
  const status = useAgentStore((s) => s.agentStatus);
  const currentStep = useAgentStore((s) => s.currentStep);
  const currentPhase = useAgentStore((s) => s.currentPhase);
  const pause = useAgentStore((s) => s.pause);
  const resume = useAgentStore((s) => s.resume);
  const abort = useAgentStore((s) => s.abort);

  // SP-C：计时器挂组件，不进 store（避免每秒 setState 全量 re-render）
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      setStalled(false);
      return;
    }
    const id = setInterval(() => {
      const ts = useAgentStore.getState().lastUpdateTs;
      setStalled(Date.now() - ts > 5000);
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  if (status === 'idle') return null;

  // soft-landing 态：不显示 pause/resume
  const showPauseResume = status !== 'soft-landing';
  const isPaused = status === 'paused';

  const label = phaseLabel(currentPhase, t);

  return (
    <div className="agent-bar" role="status" aria-live="polite">
      <span className="agent-step" aria-label={t`当前步骤`}>
        {currentStep} / {MAX_STEPS}
      </span>
      {label && !stalled && (
        <span className="agent-phase">{label}</span>
      )}
      {stalled && (
        <div className="agent-stall" role="status">
          {stallLabel(currentPhase, t)}
        </div>
      )}
      {showPauseResume && (
        <button
          type="button"
          className="btn-icon"
          onClick={isPaused ? resume : pause}
          aria-label={isPaused ? t`继续` : t`暂停`}
          title={isPaused ? t`继续` : t`暂停`}
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}
      <button
        type="button"
        className="btn-icon"
        onClick={() => abort('user')}
        aria-label={t`中止`}
        title={t`中止`}
      >
        <StopIcon />
      </button>
    </div>
  );
}
