/**
 * src/components/Settings/ProviderList.tsx — Provider 增删改列表（D-08）
 *
 * 从 useProviderStore 读取 providers，渲染列表：
 *   - 每行：名称 + baseURL（截断）+ 「编辑」+ 「删除」
 *   - isBuiltIn=true：删除按钮 disabled（诚实禁用 + not-allowed）
 *   - 「+ 新增自定义 Provider」按钮打开 ProviderForm
 *
 * focusAnchor 深链（D-12）：
 *   'key-input'   → focus 当前默认 Provider 的 Key 输入框
 *   'model-input' → focus 当前默认 Provider 的 model 输入框
 */
import { useState, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
import type { ProviderConfig } from '../../providers/types';
import { PlusIcon, TrashIcon } from '../icons';
import ProviderForm, { type ProviderFormData } from './ProviderForm';

interface ProviderListProps {
  focusAnchor?: string;
}

export default function ProviderList({ focusAnchor }: ProviderListProps): React.ReactElement {
  const { t } = useLingui();
  const providers = useProviderStore((s) => s.providers);
  const defaultLLMProviderId = useProviderStore((s) => s.defaultLLMProviderId);
  const addProvider = useProviderStore((s) => s.addProvider);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const removeProvider = useProviderStore((s) => s.removeProvider);
  const setDefaultLLM = useProviderStore((s) => s.setDefaultLLM);
  const setKey = useProviderStore((s) => s.setKey);

  // 编辑/新增表单状态
  const [editingProvider, setEditingProvider] = useState<ProviderConfig | null | 'new'>(null);
  // 深链 anchor：当 focusAnchor 存在时，自动打开默认 Provider 表单
  const [formAnchor, setFormAnchor] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (focusAnchor) {
      // 找到默认 Provider，直接打开其编辑表单并 focus 目标字段
      const defaultProvider = providers.find((p) => p.id === defaultLLMProviderId) ?? providers[0];
      if (defaultProvider) {
        setEditingProvider(defaultProvider);
        setFormAnchor(focusAnchor);
      }
    }
  }, [focusAnchor, defaultLLMProviderId, providers]);

  function handleSave(data: ProviderFormData): void {
    if (editingProvider === 'new') {
      addProvider({
        name: data.name,
        baseURL: data.baseURL,
        model: data.model,
        isBuiltIn: false,
      });
      // 新建的 Provider ID 是 crypto.randomUUID，需要找到最新加入的
      const updatedProviders = useProviderStore.getState().providers;
      const newest = updatedProviders[updatedProviders.length - 1];
      if (newest && data.apiKey) {
        setKey(newest.id, data.apiKey);
      }
    } else if (editingProvider) {
      updateProvider(editingProvider.id, {
        model: data.model,
        // 内置 Provider 不允许改 baseURL，自定义可改
        ...(!editingProvider.isBuiltIn && { name: data.name, baseURL: data.baseURL }),
      });
      if (data.apiKey) {
        setKey(editingProvider.id, data.apiKey);
      }
    }
    setEditingProvider(null);
    setFormAnchor(undefined);
  }

  function handleCancel(): void {
    setEditingProvider(null);
    setFormAnchor(undefined);
  }

  function handleDelete(provider: ProviderConfig): void {
    if (provider.isBuiltIn) return;
    removeProvider(provider.id);
  }

  // 展示 ProviderForm（新增 or 编辑）
  if (editingProvider !== null) {
    return (
      <ProviderForm
        provider={editingProvider === 'new' ? undefined : editingProvider}
        initialFocus={formAnchor}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    );
  }

  return (
    <div className="aster-settings__section">
      <div className="aster-settings__section-header">
        <span className="aster-settings__section-title">
          <Trans>AI Provider</Trans>
        </span>
        <button
          className="aster-iconbtn"
          onClick={() => setEditingProvider('new')}
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
                onClick={() => {
                  setEditingProvider(provider);
                  setFormAnchor(undefined);
                }}
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
