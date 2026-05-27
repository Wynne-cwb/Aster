/**
 * src/components/ContextCard.tsx — 实时上下文卡（D-12/D-13/D-14，ROADMAP SC3）
 *
 * 订阅 adapter.onSelectionChanged（D-13）并在选区变化时调用 adapter.getSelection()
 * 刷新显示内容，证明 adapter 真实可用（ROADMAP SC3）。
 *
 * 安全（T-01-12）：仅显示选区元数据（slide 序号 / range 地址 / 字符数），不渲染正文。
 * DoS 防护（T-01-13）：useEffect cleanup 解绑事件 + 清 timer。
 *
 * 视觉：pill 卡片，选区变化时短暂品牌色 pulse（UI-SPEC Color accent ②）。样式见 styles.css。
 */
import { useEffect, useState, useRef } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { formatSelection } from './formatSelection';
import { ChevronIcon } from './icons';

/** 品牌色 pulse 持续时间（ms） */
const PULSE_DURATION_MS = 800;

export default function ContextCard(): React.ReactElement {
  const adapter = useAdapter();
  const { t, i18n } = useLingui();

  const [ctx, setCtx] = useState<string>(() => t`未选中内容`);
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void adapter.getSelection().then((sel) => {
      setCtx(formatSelection(sel, i18n));
    });

    const unsub = adapter.onSelectionChanged(async () => {
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
