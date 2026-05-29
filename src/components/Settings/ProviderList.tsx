/**
 * src/components/Settings/ProviderList.tsx — Provider 增删改列表（D-08）
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   provider-row / pinfo / pname-line / pname / pmodel / pactions
 *   badge badge-accent（isBuiltIn）/ badge badge-success（有 Key）/ badge（无 Key）
 *   ChevronIcon → 编辑按钮（ChevronIcon 右向，不翻转）
 *
 * 从 useProviderStore 读取 providers，渲染列表：
 *   - 每行：名称 + baseURL（截断）+ 「编辑」+ 「删除」
 *   - isBuiltIn=true：删除按钮 disabled（诚实禁用 + not-allowed）
 *   - 「+ 新增自定义 Provider」按钮触发 onCreate prop（G-06 / D-26：状态提升到 SettingsPanel）
 *
 * focusAnchor 深链（D-12）：
 *   'key-input'   → 触发 onEdit(默认 Provider id)（由 SettingsPanel 控制表单聚焦）
 *   'model-input' → 同上
 *
 * G-06：编辑/新建 state 已提升到 SettingsPanel（三分区路由），
 *       ProviderList 通过 onEdit / onCreate props 上抛事件，不再内嵌 ProviderForm。
 */
import { useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
import type { ProviderConfig } from '../../providers/types';
import { PlusIcon, TrashIcon, ChevronIcon } from '../icons';
import { storage, STORAGE_KEYS } from '../../lib/storage';

interface ProviderListProps {
  focusAnchor?: string;
  onEdit: (providerId: string) => void;
  onCreate: () => void;
}

export default function ProviderList({ focusAnchor, onEdit, onCreate }: ProviderListProps): React.ReactElement {
  const { t } = useLingui();
  const providers = useProviderStore((s) => s.providers);
  const defaultLLMProviderId = useProviderStore((s) => s.defaultLLMProviderId);
  const removeProvider = useProviderStore((s) => s.removeProvider);
  const setDefaultLLM = useProviderStore((s) => s.setDefaultLLM);

  // 深链 anchor：当 focusAnchor 存在时，自动打开默认 Provider 编辑表单（D-12）
  // WR-03 修复：依赖数组补全 providers / defaultLLMProviderId / onEdit，
  // 防止 providers hydrate 后 effect 持有旧闭包导致 defaultProvider 为 undefined。
  useEffect(() => {
    if (focusAnchor) {
      const defaultProvider = providers.find((p) => p.id === defaultLLMProviderId) ?? providers[0];
      if (defaultProvider) {
        onEdit(defaultProvider.id);
      }
    }
  }, [focusAnchor, providers, defaultLLMProviderId, onEdit]);

  function handleDelete(provider: ProviderConfig): void {
    if (provider.isBuiltIn) return;
    removeProvider(provider.id);
  }

  return (
    <div className="aster-settings__section">
      <div className="aster-settings__section-header">
        <span className="aster-settings__section-title">
          <Trans>AI Provider</Trans>
        </span>
        <button
          className="btn-icon"
          onClick={onCreate}
          aria-label={t`新增自定义 Provider`}
          title={t`新增自定义 Provider`}
        >
          <PlusIcon />
        </button>
      </div>

      <div className="aster-provider-list">
        {providers.map((provider) => {
          const hasKey = !!(storage.get<string>(STORAGE_KEYS.KEY_PREFIX + provider.id));
          const modelLabel = provider.model ?? '';
          return (
            <div key={provider.id} className="provider-row">
              <div className="pinfo">
                <div className="pname-line">
                  <span className="pname">{provider.name}</span>
                  {provider.isBuiltIn && (
                    <span className="badge badge-accent">
                      <Trans>默认</Trans>
                    </span>
                  )}
                  {hasKey
                    ? <span className="badge badge-success"><Trans>已配 Key</Trans></span>
                    : <span className="badge"><Trans>未配 Key</Trans></span>}
                </div>
                <div className="pmodel">{modelLabel}</div>
              </div>
              <div className="pactions">
                {/* 设为默认（仅非默认 Provider 显示） */}
                {provider.id !== defaultLLMProviderId && (
                  <button
                    className="aster-link-btn aster-link-btn--sm"
                    onClick={() => setDefaultLLM(provider.id)}
                  >
                    <Trans>设为默认</Trans>
                  </button>
                )}
                {/* 编辑按钮 — ChevronIcon 右向（不翻转） */}
                <button
                  className="btn-icon"
                  onClick={() => onEdit(provider.id)}
                  aria-label={t`编辑 ${provider.name}`}
                  title={t`编辑`}
                >
                  <ChevronIcon />
                </button>
                {/* 删除按钮（内置 Provider disabled） */}
                <button
                  className="btn-icon"
                  onClick={() => handleDelete(provider)}
                  disabled={provider.isBuiltIn}
                  aria-label={provider.isBuiltIn ? t`内置 Provider 不可删除` : t`删除 ${provider.name}`}
                  title={provider.isBuiltIn ? t`内置 Provider 不可删除` : t`删除 ${provider.name}`}
                >
                  <TrashIcon />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
