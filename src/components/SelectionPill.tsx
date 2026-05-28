/**
 * src/components/SelectionPill.tsx — 选区胶囊（D-15 / G-08 / NFR-02）
 *
 * G-08 D-31/D-32 修订（02.1-08）：
 * - 眼睛开 = 附带选区；眼睛闭 = 不附带，但胶囊仍在屏（is-disabled 半透明视觉降级）
 * - 眼睛 toggle 持久化到 partitioned localStorage（SELECTION_ATTACH_ENABLED，D-32）
 * - 与 SettingsPanel「自动附带选区」开关双向绑定（同一个 providerStore.attachEnabled）
 *
 * 02.1 UAT-1 ④ 修：移除 × 按钮（原 D-33「本次会话隐藏」语义被用户判定为冗余，与眼睛 toggle
 * 重叠）。胶囊一旦渲染就跟随宿主选区与 attachEnabled 状态，用户不再需要临时隐藏入口。
 *
 * 安全约束（T-02-24）：显示选区元数据，不显示正文内容。
 * 完全按 ContextCard.tsx 模式：useAdapter + onSelectionChanged + cleanup。
 * 样式：极简不打扰（11px），仅在底部输入栏显示。
 */
import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useLingui } from '@lingui/react/macro';
import { useAdapter } from '../context/AdapterContext';
import { useProviderStore } from '../store/providers';
import { formatSelection } from './formatSelection';
import { EyeIcon, EyeOffIcon } from './icons';

export default function SelectionPill(): ReactElement | null {
  const adapter = useAdapter();
  const { t, i18n } = useLingui();
  // G-08 D-31：从 providerStore 读取 attachEnabled（替代旧 autoAttach）
  const attachEnabled = useProviderStore((s) => s.attachEnabled);
  const setAttachEnabled = useProviderStore((s) => s.setAttachEnabled);

  const [ctx, setCtx] = useState<string>('');

  useEffect(() => {
    void adapter.getSelection().then((sel) => {
      setCtx(formatSelection(sel, i18n));
    });

    const unsub = adapter.onSelectionChanged(async () => {
      // WR-04 修复：getSelection 可能抛 HostApiError（如 Task Pane 切换宿主时 Office.js 上下文销毁）
      // catch 后保持上一次 ctx，不产生 unhandled promise rejection
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
    <span className={`aster-selection-pill${attachEnabled ? '' : ' is-disabled'}`}>
      {/* 眼睛 toggle - 控制是否附带（D-31 / D-32）：点击切换持久化状态 */}
      <button
        type="button"
        className="aster-selection-pill__eye"
        onClick={() => setAttachEnabled(!attachEnabled)}
        aria-label={attachEnabled ? t`关闭附带选区` : t`开启附带选区`}
        title={attachEnabled ? t`关闭附带选区` : t`开启附带选区`}
      >
        {attachEnabled ? <EyeIcon /> : <EyeOffIcon />}
      </button>

      <span className="aster-selection-pill__text">{ctx}</span>
    </span>
  );
}
