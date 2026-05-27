/**
 * src/components/CostBadge.tsx — 成本徽章（COST-02 / D-17）
 *
 * 内置 Provider：显示「本次：N token · 约 ¥X.XXXX」
 * 自定义 Provider（costCny === null）：只显「本次：N token」
 *
 * 安全约束（T-02-23）：costCny 由 calcCostCny 计算，不来自 AI 生成文本，无法被 AI 伪造。
 *
 * 样式：极小字体（11px / --text-3），不抢 AI 输出注意力。
 */
import type { ReactElement } from 'react';
import { useLingui } from '@lingui/react/macro';

interface CostBadgeProps {
  tokenCount: number;
  /** null = 自定义 Provider，不显价格（D-17 / COST-02） */
  costCny: number | null;
}

export default function CostBadge({ tokenCount, costCny }: CostBadgeProps): ReactElement {
  const { t } = useLingui();

  const label =
    costCny != null
      ? t`本次：${tokenCount} token · 约 ¥${costCny.toFixed(4)}`
      : t`本次：${tokenCount} token`;

  return <span className="aster-cost-badge">{label}</span>;
}
