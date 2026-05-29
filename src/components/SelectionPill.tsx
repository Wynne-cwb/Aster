/**
 * src/components/SelectionPill.tsx — 选区胶囊（D-15 / G-08 / NFR-02）
 *
 * Phase 04.1 重皮（D-01/D-02）：
 * - className aster-selection-pill → selpill
 * - DocumentIcon 前缀图标（Plan 01 新增）
 * - label class + pill-btn + data-off attribute 驱动视觉降级
 * - 迁入 InputBar 内 selpill-row，App.tsx ContextCard 位置已退役
 *
 * G-08 D-31/D-32 修订（02.1-08）：
 * - 眼睛开 = 附带选区；眼睛闭 = 不附带，但胶囊仍在屏（is-disabled 半透明视觉降级）
 * - 眼睛 toggle 持久化到 partitioned localStorage（SELECTION_ATTACH_ENABLED，D-32）
 * - 与 SettingsPanel「自动附带选区」开关双向绑定（同一个 providerStore.attachEnabled）
 *
 * CARRY-01 修复（03-08 路径 A，D-22/D-23）：
 * - useState 初值改读 useSelectionStore.initial（main.tsx Office.onReady 内预取）
 * - useEffect 内不再首次 adapter.getSelection().then(setCtx)，只保留 onSelectionChanged 订阅
 *
 * 安全约束（T-02-24）：显示选区元数据，不显示正文内容。
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { useSelectionStore } from '../store/selection';
import { formatSelection } from './formatSelection';
import { EyeIcon, EyeOffIcon, DocumentIcon } from './icons';

export default function SelectionPill(): ReactElement | null {
  const adapter = useAdapter();
  const { t, i18n } = useLingui();
  // G-08 D-31：从 providerStore 读取 attachEnabled（替代旧 autoAttach）
  const attachEnabled = useProviderStore((s) => s.attachEnabled);
  const setAttachEnabled = useProviderStore((s) => s.setAttachEnabled);

  // CARRY-01：函数式初值，从 useSelectionStore.initial 读 main.tsx 预取的选区
  const [ctx, setCtx] = useState<string>(() =>
    formatSelection(useSelectionStore.getState().initial, i18n),
  );

  useEffect(() => {
    // CARRY-01：不再在此首次 getSelection — 首值已由 useState 初值从 store 读出。
    // 仅订阅 onSelectionChanged 处理用户后续切换选区的情况（D-13 路径不动）。
    const unsub = adapter.onSelectionChanged(async () => {
      try {
        const sel = await adapter.getSelection();
        setCtx(formatSelection(sel, i18n));
      } catch {
        // 宿主 API 失败时保持上一次 ctx，不 crash
      }
    });

    return () => {
      unsub();
    };
  }, [adapter, i18n]);

  // G-08 D-31 修订：不再因 attachEnabled=false 而 return null；
  // 胶囊始终渲染，attachEnabled=false 时加 is-disabled 类显示半透明视觉降级。
  return (
    <span className={`selpill${attachEnabled ? '' : ' is-disabled'}`}>
      <DocumentIcon size={11} />
      <span className="label">{ctx}</span>
      <span className="actions">
        <button
          type="button"
          className="pill-btn"
          data-off={!attachEnabled || undefined}
          aria-label={attachEnabled ? t`隐藏选区上下文` : t`显示选区上下文`}
          onClick={() => setAttachEnabled(!attachEnabled)}
        >
          {attachEnabled ? <EyeIcon size={11} /> : <EyeOffIcon size={11} />}
        </button>
      </span>
    </span>
  );
}
