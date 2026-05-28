/**
 * src/components/ContextCard.tsx — 实时上下文卡（D-12/D-13/D-14，ROADMAP SC3）
 *
 * 订阅 adapter.onSelectionChanged（D-13）并在选区变化时调用 adapter.getSelection()
 * 刷新显示内容，证明 adapter 真实可用（ROADMAP SC3）。
 *
 * CARRY-01 修复（03-08 路径 A，D-22/D-23）：
 * - useState 初值改读 useSelectionStore.initial（main.tsx Office.onReady 内预取）
 * - useEffect 内不再首次 adapter.getSelection().then(setCtx)，只保留 onSelectionChanged 订阅
 * - 首帧立即显示真实选区，避免 React mount 与 Office.onReady 间的微任务时序闪烁
 *
 * 安全（T-01-12）：仅显示选区元数据（slide 序号 / range 地址 / 字符数），不渲染正文。
 * DoS 防护（T-01-13）：useEffect cleanup 解绑事件 + 清 timer。
 *
 * 视觉：pill 卡片，选区变化时短暂品牌色 pulse（UI-SPEC Color accent ②）。样式见 styles.css。
 */
import { useEffect, useState, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useSelectionStore } from '../store/selection';
import { formatSelection } from './formatSelection';
import { ChevronIcon } from './icons';

/** 品牌色 pulse 持续时间（ms） */
const PULSE_DURATION_MS = 800;

export default function ContextCard(): React.ReactElement {
  const adapter = useAdapter();
  const { i18n } = useLingui();

  // CARRY-01：函数式初值，从 useSelectionStore.initial 读 main.tsx 预取的选区
  // （main.tsx Office.onReady 内已 await adapter.getSelection() 并 setState）
  const [ctx, setCtx] = useState<string>(() =>
    formatSelection(useSelectionStore.getState().initial, i18n),
  );
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // CARRY-01：不再在此首次 getSelection — 首值已由 useState 初值从 store 读出。
    // 仅订阅 onSelectionChanged 处理用户后续切换选区的情况（D-13 路径不动）。
    const unsub = adapter.onSelectionChanged(async () => {
      try {
        const sel = await adapter.getSelection();
        setCtx(formatSelection(sel, i18n));

        setIsPulsing(true);
        if (pulseTimerRef.current) {
          clearTimeout(pulseTimerRef.current);
        }
        pulseTimerRef.current = setTimeout(() => {
          setIsPulsing(false);
          pulseTimerRef.current = null;
        }, PULSE_DURATION_MS);
      } catch {
        // 宿主 API 失败时保持上一次 ctx，不 crash（对齐 SelectionPill 的 WR-04 兜底）
      }
    });

    return () => {
      unsub();
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, [adapter, i18n]);

  return (
    <div className={`aster-context${isPulsing ? ' is-pulsing' : ''}`}>
      <span className="aster-context__icon">
        <ChevronIcon />
      </span>
      <span className="aster-context__text">{ctx}</span>
    </div>
  );
}
