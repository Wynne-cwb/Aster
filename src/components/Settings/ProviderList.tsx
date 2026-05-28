/**
 * src/components/Settings/ProviderList.tsx — Provider 增删改列表（D-08）
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
import { PlusIcon, TrashIcon } from '../icons';

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
          className="aster-iconbtn"
          onClick={onCreate}
          aria-label={t`新增自定义 Provider`}
          title={t`新增自定义 Provider`}
        >
          <PlusIcon />
        </button>
      </div>

      <ul className="aster-provider-list">
        {providers.map((provider) => (
          <li key={provider.id} className="aster-provider-item">
            <div className="aster-provider-item__info">
              <div className="aster-provider-item__name">
                {provider.name}
                {provider.id === defaultLLMProviderId && (
                  <span className="aster-badge-default">
                    <Trans>默认</Trans>
                  </span>
                )}
                {provider.isBuiltIn && (
                  <span className="aster-badge-builtin">
                    <Trans>内置</Trans>
                  </span>
                )}
              </div>
              <div className="aster-provider-item__url">
                {provider.baseURL.replace(/^https?:\/\//, '').slice(0, 30)}
                {provider.baseURL.length > 30 ? '…' : ''}
              </div>
            </div>
            <div className="aster-provider-item__actions">
              {/* 设为默认（仅非默认 Provider 显示） */}
              {provider.id !== defaultLLMProviderId && (
                <button
                  className="aster-link-btn aster-link-btn--sm"
                  onClick={() => setDefaultLLM(provider.id)}
                >
                  <Trans>设为默认</Trans>
                </button>
              )}
              {/* 编辑按钮 */}
              <button
                className="aster-link-btn aster-link-btn--sm"
                onClick={() => onEdit(provider.id)}
              >
                <Trans>编辑</Trans>
              </button>
              {/* 删除按钮（内置 Provider disabled） */}
              <button
                className="aster-iconbtn aster-iconbtn--sm"
                onClick={() => handleDelete(provider)}
                disabled={provider.isBuiltIn}
                aria-label={provider.isBuiltIn ? t`内置 Provider 不可删除` : t`删除 ${provider.name}`}
                title={provider.isBuiltIn ? t`内置 Provider 不可删除` : t`删除 ${provider.name}`}
              >
                <TrashIcon />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
