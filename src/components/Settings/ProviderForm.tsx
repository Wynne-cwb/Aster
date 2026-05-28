/**
 * src/components/Settings/ProviderForm.tsx — Provider 新建/编辑表单（D-08）
 *
 * Props:
 *   provider?: ProviderConfig  — 有值=编辑模式，无值=新建模式
 *   onSave(data)               — 保存回调（新建/更新）
 *   onCancel()                 — 取消/返回
 *
 * 三个字段（D-08）：baseURL / model / apiKey（password）
 * 安全约束（T-02-26）：baseURL 必须以 https:// 开头
 * 隐私告知（T-02-25 / KEY-03）：内联常驻，不可折叠
 * 内置 Provider：baseURL 字段 disabled（不允许改内置 URL）
 */
import { useState, useRef, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ProviderConfig } from '../../providers/types';

export interface ProviderFormData {
  name: string;
  baseURL: string;
  model: string;
  apiKey: string;
}

interface ProviderFormProps {
  provider?: ProviderConfig;
  initialFocus?: string;
  onSave: (data: ProviderFormData) => void;
  onCancel: () => void;
}

export default function ProviderForm({
  provider,
  initialFocus,
  onSave,
  onCancel,
}: ProviderFormProps): React.ReactElement {
  const { t } = useLingui();
  const isBuiltIn = provider?.isBuiltIn ?? false;

  const [name, setName] = useState(provider?.name ?? '');
  const [baseURL, setBaseURL] = useState(provider?.baseURL ?? '');
  const [model, setModel] = useState(provider?.model ?? '');
  const [apiKey, setApiKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const keyRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);

  // 深链 anchor focus（D-12）
  useEffect(() => {
    if (initialFocus === 'key-input') {
      keyRef.current?.focus();
    } else if (initialFocus === 'model-input') {
      modelRef.current?.focus();
    }
  }, [initialFocus]);

  function validate(): boolean {
    const errs: Record<string, string> = {};

    if (!isBuiltIn && !name.trim()) {
      errs.name = t`名称不能为空`;
    }
    if (!isBuiltIn && !baseURL.trim()) {
      errs.baseURL = t`Base URL 不能为空`;
    } else if (!isBuiltIn && !baseURL.startsWith('https://')) {
      // T-02-26：恶意 URL 缓解，必须 https://
      errs.baseURL = t`Base URL 必须以 https:// 开头`;
    } else if (!isBuiltIn && baseURL.trim()) {
      // URL 格式校验
      try {
        new URL(baseURL);
      } catch {
        errs.baseURL = t`Base URL 格式无效`;
      }
    }
    if (!provider && !apiKey.trim()) {
      // 新建时 apiKey 必填
      errs.apiKey = t`API Key 不能为空`;
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!validate()) return;
    onSave({ name: isBuiltIn ? (provider?.name ?? '') : name, baseURL: isBuiltIn ? (provider?.baseURL ?? '') : baseURL, model, apiKey });
  }

  return (
    <form className="aster-provider-form" onSubmit={handleSubmit} noValidate>
      {/* 头部：标题（不可滚动，flex-shrink:0） */}
      <div className="aster-provider-form__header">
        <h3 className="aster-form-title">
          {provider ? <Trans>编辑 Provider</Trans> : <Trans>新增自定义 Provider</Trans>}
        </h3>
      </div>

      {/* 内容区：所有字段 + 隐私 hint（可滚动，flex:1） */}
      <div className="aster-provider-form__body">
        {/* 名称（仅自定义 Provider） */}
        {!isBuiltIn && (
          <div className="aster-form-field">
            <label className="aster-form-label" htmlFor="pf-name">
              <Trans>名称</Trans>
            </label>
            <input
              id="pf-name"
              type="text"
              className={`aster-field aster-field--standalone${errors.name ? ' aster-field--error' : ''}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t`自定义 Provider 名称`}
            />
            {errors.name && <p className="aster-form-error">{errors.name}</p>}
          </div>
        )}

        {/* Base URL */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="pf-baseurl">
            <Trans>Base URL</Trans>
          </label>
          <input
            id="pf-baseurl"
            type="url"
            className={`aster-field aster-field--standalone${errors.baseURL ? ' aster-field--error' : ''}`}
            value={isBuiltIn ? (provider?.baseURL ?? '') : baseURL}
            onChange={(e) => !isBuiltIn && setBaseURL(e.target.value)}
            disabled={isBuiltIn}
            placeholder="https://api.example.com/v1"
          />
          {errors.baseURL && <p className="aster-form-error">{errors.baseURL}</p>}
          {!isBuiltIn && (
            <p className="aster-form-hint-sm">
              <Trans>必须以 https:// 开头</Trans>
            </p>
          )}
        </div>

        {/* Model */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="pf-model">
            <Trans>模型名称</Trans>
          </label>
          <input
            id="pf-model"
            ref={modelRef}
            type="text"
            className="aster-field aster-field--standalone"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="deepseek-v4-flash"
          />
        </div>

        {/* API Key（password，不回显，D-05/T-02-27） */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="pf-apikey">
            <Trans>API Key</Trans>
            {provider && (
              <span className="aster-optional">
                {' '}
                <Trans>（留空保持不变）</Trans>
              </span>
            )}
          </label>
          <input
            id="pf-apikey"
            ref={keyRef}
            type="password"
            className={`aster-field aster-field--standalone${errors.apiKey ? ' aster-field--error' : ''}`}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            autoComplete="off"
          />
          {errors.apiKey && <p className="aster-form-error">{errors.apiKey}</p>}
        </div>

        {/* 隐私告知（T-02-25 / KEY-03 / D-05）：内联常驻，不可折叠 */}
        <p className="aster-form-hint">
          <Trans>API Key 仅存储在您的浏览器本地，不经过 Aster 服务器</Trans>
        </p>
      </div>

      {/* 操作行：sticky 底部（G-06 / D-25），不随字段滚走 */}
      <div className="aster-provider-form__footer">
        <button
          type="button"
          className="aster-link-btn"
          onClick={onCancel}
        >
          <Trans>取消</Trans>
        </button>
        <button type="submit" className="aster-btn-primary">
          <Trans>保存</Trans>
        </button>
      </div>
    </form>
  );
}
