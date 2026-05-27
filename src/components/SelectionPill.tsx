/**
 * src/components/SelectionPill.tsx — 选区胶囊（D-15 / NFR-02）
 *
 * 显示当前文档选区元数据（不显示正文内容，安全约束 T-02-24）。
 * 响应 providerStore.autoAttach 全局开关：false 时不渲染。
 * × 按钮调用 onDismiss 回调，从消息中移除当前附带的选区上下文。
 *
 * 完全按 ContextCard.tsx 模式：useAdapter + onSelectionChanged + cleanup。
 * 样式：极简不打扰（11px），仅在底部输入栏显示。
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { formatSelection } from './formatSelection';
import { XIcon } from './icons';

interface SelectionPillProps {
  onDismiss: () => void;
}

export default function SelectionPill({ onDismiss }: SelectionPillProps): ReactElement | null {
  const adapter = useAdapter();
  const { t, i18n } = useLingui();
  const autoAttach = useProviderStore((s) => s.autoAttach);

  const [ctx, setCtx] = useState<string>('');

  useEffect(() => {
    void adapter.getSelection().then((sel) => {
      setCtx(formatSelection(sel, i18n));
    });

    const unsub = adapter.onSelectionChanged(async () => {
      const sel = await adapter.getSelection();
      setCtx(formatSelection(sel, i18n));
    });

    return () => {
      unsub();
    };
  }, [adapter, i18n]);

  // autoAttach=false 时不渲染（D-15）
  if (!autoAttach) return null;

  return (
    <span className="aster-selection-pill">
      <span className="aster-selection-pill__text">{ctx}</span>
      <button
        className="aster-selection-pill__dismiss"
        onClick={onDismiss}
        aria-label={t`移除选区附带`}
        title={t`移除选区附带`}
      >
        <XIcon />
      </button>
    </span>
  );
}
