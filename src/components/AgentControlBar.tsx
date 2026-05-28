/**
 * src/components/AgentControlBar.tsx — Phase 3 完整版（AGENT-02 / AGENT-12 / AGENT-13）
 *
 * 视觉走 CLAUDE.md §UI 设计系统：玻璃拟态容器 + 品牌渐变 accent（focus / hover）
 *   + 11px 步数小字 + 内联 SVG（Lucide 风 stroke=currentColor）。
 *
 * 软着陆卡片是 ChatStream 内特殊消息（Plan 05 已落，RESEARCH Open Q4 推荐方案）—
 * 本组件不做 modal 化，只显示 step counter + pause/resume + abort 按钮。
 *
 * idle 时 return null — 仅按字段订阅（Zustand selector pattern，PATTERNS 范式），
 * 不订阅整个 store 避免无关字段变化导致全量 re-render。
 *
 * AGENT-13 单一 abort 入口：中止按钮调 abort('user')，
 *   abort 内部统一 lastAbortReason + controller.abort() + status='idle'。
 */
import { type ReactElement } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAgentStore, MAX_STEPS } from '../agent/agentStore';
import { PauseIcon, PlayIcon, StopIcon } from './icons';

export default function AgentControlBar(): ReactElement | null {
  const { t } = useLingui();
  const status = useAgentStore((s) => s.agentStatus);
  const currentStep = useAgentStore((s) => s.currentStep);
  const pause = useAgentStore((s) => s.pause);
  const resume = useAgentStore((s) => s.resume);
  const abort = useAgentStore((s) => s.abort);

  if (status === 'idle') return null;

  // soft-landing 态：不显示 pause/resume（loop 已停在 step 20 等待用户决策；
  // 继续/结束的入口在 ChatStream 内特殊消息卡片，Plan 05 已落）。
  // 仅保留 step counter（"20 / 20"）+ 中止按钮作为兜底。
  const showPauseResume = status !== 'soft-landing';
  const isPaused = status === 'paused';

  return (
    <div className="aster-agent-bar" role="status" aria-live="polite">
      <span className="aster-agent-bar__step" aria-label={t`当前步骤`}>
        {currentStep} / {MAX_STEPS}
      </span>
      {showPauseResume && (
        <button
          type="button"
          className="aster-iconbtn aster-agent-bar__btn"
          onClick={isPaused ? resume : pause}
          aria-label={isPaused ? t`继续` : t`暂停`}
          title={isPaused ? t`继续` : t`暂停`}
        >
          {isPaused ? <PlayIcon /> : <PauseIcon />}
        </button>
      )}
      <button
        type="button"
        className="aster-iconbtn aster-agent-bar__btn"
        onClick={() => abort('user')}
        aria-label={t`中止`}
        title={t`中止`}
      >
        <StopIcon />
      </button>
    </div>
  );
}
