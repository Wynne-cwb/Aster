/**
 * src/components/ContextCard.tsx — 实时上下文卡（D-12/D-13/D-14，ROADMAP SC3）
 *
 * 订阅 adapter.onSelectionChanged（D-13）并在选区变化时调用 adapter.getSelection()
 * 刷新显示内容，证明 adapter 真实可用（ROADMAP SC3）。
 *
 * 安全（T-01-12）：仅显示选区元数据（slide 序号 / range 地址 / 字符数），
 * 不渲染选区正文——避免敏感文档内容意外暴露在 UI / 日志。
 *
 * DoS 防护（T-01-13）：useEffect cleanup 返回 unsub，组件卸载 / Task Pane 隐藏
 * 时自动解绑，防止事件 handler 累积泄漏。
 */
import { useEffect, useState, useRef } from 'react';
import { Card, Text, tokens } from '@fluentui/react-components';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { formatSelection } from './formatSelection';

/** 品牌色 pulse 持续时间（ms）——selection 更新时短暂显示品牌色 tint（UI-SPEC Color accent ②）*/
const PULSE_DURATION_MS = 800;

export default function ContextCard(): React.ReactElement {
  const adapter = useAdapter();
  const { t } = useLingui();

  // 当前选区文案（D-16 初值：未选中内容）
  const [ctx, setCtx] = useState<string>(() => t`未选中内容`);

  // 品牌色 pulse 状态（UI-SPEC Color accent ②）
  const [isPulsing, setIsPulsing] = useState(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 进入时主动拉一次初始选区（可选，提升首屏体验）
    void adapter.getSelection().then((sel) => {
      setCtx(formatSelection(sel, t));
    });

    // 订阅 selection-changed 事件（D-12/D-13）
    const unsub = adapter.onSelectionChanged(async () => {
      const sel = await adapter.getSelection();
      setCtx(formatSelection(sel, t));

      // 触发品牌色 pulse（UI-SPEC Color accent ②）
      setIsPulsing(true);
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
      pulseTimerRef.current = setTimeout(() => {
        setIsPulsing(false);
        pulseTimerRef.current = null;
      }, PULSE_DURATION_MS);
    });

    // cleanup：解绑（D-13，T-01-13 DoS 防护）
    return () => {
      unsub();
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, [adapter, t]);

  return (
    <Card
      style={{
        padding: tokens.spacingVerticalXS,
        paddingLeft: tokens.spacingHorizontalXS,
        paddingRight: tokens.spacingHorizontalXS,
        backgroundColor: isPulsing
          ? tokens.colorBrandBackground2  // 品牌色 pulse tint（subtle，UI-SPEC accent ②）
          : tokens.colorNeutralBackground2,
        transition: `background-color ${PULSE_DURATION_MS}ms ease-out`,
        border: 'none',
        boxShadow: 'none',
        borderRadius: tokens.borderRadiusMedium,
      }}
    >
      <Text
        size={300}
        style={{
          color: isPulsing
            ? tokens.colorBrandForeground1  // 品牌色前景（pulse 时高亮）
            : tokens.colorNeutralForeground2,
          transition: `color ${PULSE_DURATION_MS}ms ease-out`,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {ctx}
      </Text>
    </Card>
  );
}
