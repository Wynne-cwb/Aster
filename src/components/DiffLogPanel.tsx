/**
 * src/components/DiffLogPanel.tsx — Phase 5 Wave 4：Diff Log 汇总卡
 *
 * 在 agent run 完成后，展示本次写操作的汇总折叠卡（D-01/D-02/D-03）：
 *   - 头行「本次改动 N 处」折叠展开（.tool-group + .tool-group__head 复用范式）
 *   - 每步一行：humanLabel + 「撤销该步」.btn-ghost.btn-sm 按钮（D-04）
 *   - 撤销后行变 .is-undone + 「已撤销」.badge-accent 胶囊（D-05）
 *   - 底部「撤销本次所有操作」.btn-ghost → 二次确认 modal → replayUndoAll → 总结 modal（D-12）
 *
 * 懒加载（React.lazy）：只在 run 完成后渲染，不进初始 main chunk（NFR-05）。
 * A-06 守门：不引用 Word/Excel/PowerPoint 命名空间；通过 useAdapter() 调 adapter。
 */
import { useState, useEffect, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Trans } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import {
  getWriteOpsByRun,
  replayUndoAll,
  replayUndoSingle,
  type OperationLogEntry,
  type UndoResult,
  type UndoStepStatus,
  type DocumentAdapterForReplay,
} from '../agent/operationLog';
import { ChevronDownIcon } from './icons';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DiffLogPanelProps {
  /** 已完成的 agent run 的唯一标识 */
  runId: string;
}

// ---------------------------------------------------------------------------
// per-step undo 状态
// ---------------------------------------------------------------------------

type StepUndoState = UndoStepStatus | 'loading';

// ---------------------------------------------------------------------------
// StatusBadge — 单步状态胶囊
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Exclude<StepUndoState, 'loading'> }): ReactElement {
  if (status === 'rolled_back') {
    return <span className="badge badge-accent"><Trans>已撤销</Trans></span>;
  }
  if (status === 'skipped_manual') {
    return <span className="badge badge-warning"><Trans>未回滚 · 手改</Trans></span>;
  }
  // skipped_error
  return <span className="badge badge-error"><Trans>未能回滚</Trans></span>;
}

// ---------------------------------------------------------------------------
// ConfirmModal — 二次确认 modal（D-07/D-10 文案）
// ---------------------------------------------------------------------------

interface ConfirmModalProps {
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ count, loading, onConfirm, onCancel }: ConfirmModalProps): ReactElement {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && !loading) onCancel();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [loading, onCancel]);

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlp-confirm-title"
      onClick={(e) => { if (e.target === e.currentTarget && !loading) onCancel(); }}
    >
      <div className="modal">
        <h2 className="modal-title" id="dlp-confirm-title">
          <Trans>撤销本次所有操作？</Trans>
        </h2>
        <div className="modal-body">
          <p className="modal-sub">
            <Trans>
              将逆序撤销本次 AI 改动的 {count} 处写操作。你手动改过的内容会自动跳过、保留不动。
            </Trans>
          </p>
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={loading}
          >
            <Trans>取消</Trans>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Trans>撤销中…</Trans> : <Trans>确认撤销</Trans>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SummaryModal — undo-all 总结 modal（D-12 三态）
// ---------------------------------------------------------------------------

interface SummaryModalProps {
  result: UndoResult;
  onClose: () => void;
}

function SummaryModal({ result, onClose }: SummaryModalProps): ReactElement {
  // ESC 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const { rolledBack, skippedManualChange, skippedHostError } = result;

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dlp-summary-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <h2 className="modal-title" id="dlp-summary-title">
          <Trans>撤销完成</Trans>
        </h2>
        <div className="modal-body">
          {rolledBack > 0 && (
            <p className="modal-sub diff-log-status-row diff-log-status--success">
              <Trans>已回滚 {rolledBack} 步</Trans>
            </p>
          )}
          {skippedManualChange > 0 && (
            <p className="modal-sub diff-log-status-row diff-log-status--warning">
              <Trans>跳过 {skippedManualChange} 步（你已手动修改，保留不动）</Trans>
            </p>
          )}
          {skippedHostError > 0 && (
            <p className="modal-sub diff-log-status-row diff-log-status--error">
              <Trans>{skippedHostError} 步未能回滚（宿主报错）</Trans>
            </p>
          )}
        </div>
        <div className="modal-foot">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
          >
            <Trans>知道了</Trans>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DiffLogPanel — 主组件
// ---------------------------------------------------------------------------

export default function DiffLogPanel({ runId }: DiffLogPanelProps): ReactElement | null {
  const adapter = useAdapter();

  // 写操作列表（只含有 reverse 的条目）
  const writeOps: OperationLogEntry[] = getWriteOpsByRun(runId);

  // 折叠/展开状态
  const [expanded, setExpanded] = useState(false);

  // per-step 撤销状态：stepIndex → 状态
  const [stepStates, setStepStates] = useState<Record<number, StepUndoState>>({});

  // 二次确认 modal
  const [confirming, setConfirming] = useState(false);

  // undo-all 进行中
  const [undoAllLoading, setUndoAllLoading] = useState(false);

  // 总结 modal
  const [undoResult, setUndoResult] = useState<UndoResult | null>(null);

  // 写操作数量为 0 时不渲染（防守）
  if (writeOps.length === 0) return null;

  const N = writeOps.length;

  // -----------------------------------------------------------------------
  // handleUndoStep — 单步撤销（任意顺序，D-05）
  // -----------------------------------------------------------------------

  const handleUndoStep = useCallback(
    async (entry: OperationLogEntry): Promise<void> => {
      const idx = entry.stepIndex;

      // 防重复点击（已有终态则不再处理）
      const current = stepStates[idx];
      if (current != null && current !== 'loading') return;

      setStepStates((prev) => ({ ...prev, [idx]: 'loading' }));

      try {
        const detail = await replayUndoSingle(
          entry,
          adapter as unknown as DocumentAdapterForReplay,
        );
        setStepStates((prev) => ({ ...prev, [idx]: detail.status }));
      } catch {
        setStepStates((prev) => ({ ...prev, [idx]: 'skipped_error' }));
      }
    },
    [adapter, stepStates],
  );

  // -----------------------------------------------------------------------
  // handleUndoAll — 全量撤销（D-12）
  // -----------------------------------------------------------------------

  const handleUndoAll = useCallback(async (): Promise<void> => {
    setConfirming(false);
    setUndoAllLoading(true);
    try {
      const result = await replayUndoAll(
        runId,
        adapter as unknown as DocumentAdapterForReplay,
      );
      // 同步 per-step 状态
      const newStates: Record<number, UndoStepStatus> = {};
      for (const detail of result.details) {
        newStates[detail.stepIndex] = detail.status;
      }
      setStepStates(newStates);
      setUndoResult(result);
    } catch {
      // 兜底不崩
    } finally {
      setUndoAllLoading(false);
    }
  }, [adapter, runId]);

  // -----------------------------------------------------------------------
  // 渲染
  // -----------------------------------------------------------------------

  return (
    <div className="diff-log-panel tool-group">
      {/* 汇总卡头——整行可点，折叠/展开 */}
      <button
        type="button"
        className="tool-group__head diff-log-head"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <ChevronDownIcon
          size={11}
          className={expanded ? 'is-up' : ''}
        />
        <span className="tool-group__count">
          <Trans>本次改动 {N} 处</Trans>
        </span>
      </button>

      {/* 展开后：每步行 + 底部 undo-all 按钮 */}
      {expanded && (
        <>
          <ul className="tool-group__list">
            {writeOps.map((entry) => {
              const state = stepStates[entry.stepIndex];
              const isUndone =
                state === 'rolled_back' ||
                state === 'skipped_manual' ||
                state === 'skipped_error';
              const isError = state === 'skipped_error';
              const isLoading = state === 'loading';

              const liClass = [
                isUndone && state === 'rolled_back' ? 'is-undone' : '',
                isError ? 'is-error' : '',
              ]
                .filter(Boolean)
                .join(' ') || undefined;

              return (
                <li key={entry.stepIndex} className={liClass}>
                  <div className="wb-action-head" style={{ cursor: 'default' }}>
                    <span className="wb-action-target">{entry.humanLabel}</span>
                    {/* 状态胶囊：已有状态时显示 */}
                    {isUndone && (
                      <StatusBadge status={state as Exclude<StepUndoState, 'loading'>} />
                    )}
                    {/* 撤销该步按钮：未撤销且未报错时显示 */}
                    {!isUndone && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={isLoading || undoAllLoading}
                        onClick={() => { void handleUndoStep(entry); }}
                        aria-busy={isLoading}
                      >
                        {isLoading ? <Trans>撤销中…</Trans> : <Trans>撤销该步</Trans>}
                      </button>
                    )}
                  </div>
                  {/* 已撤销细提示 */}
                  {state === 'rolled_back' && (
                    <div className="wb-action-body writeback-undone-hint">
                      <Trans>已撤销，文档已回滚到上一状态</Trans>
                    </div>
                  )}
                  {/* 报错提示 */}
                  {state === 'skipped_error' && (
                    <div className="wb-action-body" style={{ color: 'var(--error)' }}>
                      <Trans>宿主 API 报错，无法回滚此步</Trans>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* 底部：撤销本次所有操作（仅在未有总结结果时显示，且写操作数 > 1）*/}
          {!undoResult && N > 1 && (
            <div className="diff-log-footer">
              <button
                type="button"
                className="btn btn-ghost diff-log-undo-all-btn"
                disabled={undoAllLoading}
                onClick={() => setConfirming(true)}
              >
                <Trans>撤销本次所有操作</Trans>
              </button>
            </div>
          )}
        </>
      )}

      {/* 二次确认 modal */}
      {confirming && (
        <ConfirmModal
          count={N}
          loading={undoAllLoading}
          onConfirm={() => { void handleUndoAll(); }}
          onCancel={() => setConfirming(false)}
        />
      )}

      {/* 总结 modal */}
      {undoResult && (
        <SummaryModal
          result={undoResult}
          onClose={() => setUndoResult(null)}
        />
      )}
    </div>
  );
}
