/**
 * src/components/Settings/SettingsPanel.tsx — 整页滑入设置面板（PROV-05 / D-08 / D-15）
 *
 * 由 App.tsx 通过 .aster-settings-overlay.is-open 控制 CSS translateX 滑入动画。
 * 本组件只渲染内容，动画容器在 App.tsx。
 *
 * Props:
 *   onClose()               — 关闭/返回回调
 *   initialAnchor?          — 深链字段 ID（D-12）：'key-input' | 'model-input'
 *   onShowOnboarding?()     — 「重看引导」回调（D-04）
 *
 * G-06 / D-26 三分区路由（编辑态独占，浏览态显列表+全局选项）：
 *   editState.kind === 'browse'   → 渲染 ② Provider 列表 + ③ 全局选项
 *   editState.kind === 'editing'  → 仅渲染 ① ProviderForm（独占整个 body）
 *   editState.kind === 'creating' → 仅渲染 ① ProviderForm（新建，独占整个 body）
 *
 * attachEnabled（D-15 / G-08 02.1-08 修订，原 autoAttach）：从 providerStore 直接读取，onChange 调用 setAttachEnabled
 */
import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
import { ChevronIcon } from '../icons';
import ProviderList from './ProviderList';
import ProviderForm, { type ProviderFormData } from './ProviderForm';
import type { ProviderConfig } from '../../providers/types';

interface SettingsPanelProps {
  onClose: () => void;
  initialAnchor?: string;
  onShowOnboarding?: () => void;
}

/** D-26 三分区路由状态机 */
type EditState =
  | { kind: 'browse' }
  | { kind: 'editing'; providerId: string }
  | { kind: 'creating' };

export default function SettingsPanel({
  onClose,
  initialAnchor,
  onShowOnboarding,
}: SettingsPanelProps): React.ReactElement {
  const { t } = useLingui();

  // D-15 / G-08：attachEnabled 和 setAttachEnabled 从 providerStore 直接消费（双向绑定：设置项 ↔ SelectionPill 眼睛）
  const attachEnabled = useProviderStore((s) => s.attachEnabled);
  const setAttachEnabled = useProviderStore((s) => s.setAttachEnabled);
  const providers = useProviderStore((s) => s.providers);
  const addProvider = useProviderStore((s) => s.addProvider);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const setKey = useProviderStore((s) => s.setKey);

  // D-26 G-06：编辑/新建状态提升到 SettingsPanel（三分区路由）
  // 深链 initialAnchor 存在时，直接进入编辑态（ProviderList 会在 useEffect 里触发 onEdit）
  const [editState, setEditState] = useState<EditState>({ kind: 'browse' });

  // 编辑态对应的 Provider 对象
  const editingProvider: ProviderConfig | undefined =
    editState.kind === 'editing'
      ? providers.find((p) => p.id === editState.providerId)
      : undefined;

  function handleSave(data: ProviderFormData): void {
    if (editState.kind === 'editing') {
      updateProvider(editState.providerId, {
        model: data.model,
        // 内置 Provider 不允许改 baseURL/name
        ...(editingProvider && !editingProvider.isBuiltIn && { name: data.name, baseURL: data.baseURL }),
      });
      if (data.apiKey) {
        setKey(editState.providerId, data.apiKey);
      }
    } else if (editState.kind === 'creating') {
      addProvider({
        name: data.name,
        baseURL: data.baseURL,
        model: data.model,
        isBuiltIn: false,
      });
      // addProvider 内部生成 uuid，找最新加入的 Provider 写 Key
      if (data.apiKey) {
        const updatedProviders = useProviderStore.getState().providers;
        const newest = updatedProviders[updatedProviders.length - 1];
        if (newest) {
          setKey(newest.id, data.apiKey);
        }
      }
    }
    setEditState({ kind: 'browse' });
  }

  function handleCancel(): void {
    setEditState({ kind: 'browse' });
  }

  return (
    <div className="aster-settings">
      {/* 顶部返回行 */}
      <div className="aster-settings__header">
        <button
          className="aster-iconbtn"
          onClick={onClose}
          aria-label={t`返回`}
          title={t`返回`}
        >
          <ChevronIcon />
        </button>
        <span className="aster-settings__title">
          <Trans>设置</Trans>
        </span>
      </div>

      {/* 可滚动内容区 */}
      <div className="aster-settings__body">
        {/*
          D-26 SettingsPanel 分区：① 当前编辑表单 / ② Provider 列表 / ③ 全局选项
          实现策略（G-06 / D-26）：
            - 浏览态 (editState.kind === 'browse')：仅渲染 ②③（Provider 列表 + 全局选项）
            - 编辑态 (editState.kind === 'editing' | 'creating')：仅渲染 ①（ProviderForm 独占整个 body）
          「全局选项绝不能与当前编辑表单混排」（D-26）通过「编辑态独占」实现——
          比 D-26 字面顺序「①②③ 同屏」更强：350px 窄面板里三区同屏太拥挤，独占更符合实际 UX。
        */}
        {editState.kind === 'browse' ? (
          <>
            {/* ② Provider 列表（D-08） */}
            <ProviderList
              focusAnchor={initialAnchor}
              onEdit={(id) => setEditState({ kind: 'editing', providerId: id })}
              onCreate={() => setEditState({ kind: 'creating' })}
            />

            {/* ③ 全局选项分区（D-26 ③） */}
            <div className="aster-settings__global-options">
              {/* 选区自动附带开关（D-15） */}
              <div className="aster-settings__section">
                <label className="aster-settings__toggle-row" htmlFor="setting-auto-attach">
                  <span className="aster-settings__label">
                    <Trans>自动附带选区内容</Trans>
                  </span>
                  <input
                    id="setting-auto-attach"
                    type="checkbox"
                    className="aster-toggle"
                    checked={attachEnabled}
                    onChange={(e) => setAttachEnabled(e.target.checked)}
                    aria-label={t`自动附带选区内容`}
                  />
                </label>
                <p className="aster-settings__hint">
                  <Trans>发送消息时自动附带您当前选中的文档内容</Trans>
                </p>
              </div>

              {/* 重看引导（D-04） */}
              {onShowOnboarding && (
                <div className="aster-settings__section">
                  <button className="aster-link-btn" onClick={onShowOnboarding}>
                    <Trans>重看引导</Trans>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ① 当前编辑表单（独占整个 body，列表/全局选项不渲染，G-06 / D-25 / D-26） */
          <ProviderForm
            provider={editingProvider}
            initialFocus={initialAnchor}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}
