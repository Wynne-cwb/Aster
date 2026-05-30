/**
 * src/components/Settings/ProviderForm.tsx — Provider 新建/编辑表单（D-08）
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   .input 输入框 / .select-wrap + .input.select + .select-caret（ChevronDownIcon）
 *   .builtin-note（内置 Provider 提示）
 *   .btn .btn-primary / .btn .btn-ghost 按钮
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
import { BUILTIN_MODEL_OPTIONS, useProviderStore } from '../../store/providers';
import { probeToolCallSupport } from '../../providers/probeToolCall';
import { ChevronDownIcon } from '../icons';

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

  type TestState = 'idle' | 'loading' | 'supported' | 'unsupported';
  const [testState, setTestState] = useState<TestState>('idle');

  const keyRef = useRef<HTMLInputElement>(null);
  // modelRef 仅供自定义 Provider 的 text input 使用；内置 select 不挂 ref
  const modelRef = useRef<HTMLInputElement>(null);

  // 深链 anchor focus（D-12）
  useEffect(() => {
    if (initialFocus === 'key-input') {
      keyRef.current?.focus();
    } else if (initialFocus === 'model-input') {
      // 自定义 Provider: focus model text input；内置 Provider: select 无 focus，忽略
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

  const handleTestToolCall = async () => {
    // B2/B3：只有已保存的 Provider 才有真实 id；未保存直接返回（防止写入无效 id）
    if (!provider?.id) return;
    if (!apiKey.trim() && !provider.id) return; // apiKey 当前可能为空（编辑时留空=不改）
    setTestState('loading');
    const config = {
      providerId: provider.id, // 直接用 provider.id（B2/B3：禁止传入假 id）
      baseURL: isBuiltIn ? (provider.baseURL ?? '') : baseURL.trim(),
      apiKey: apiKey.trim(),
      model: model.trim(),
    };
    const result = await probeToolCallSupport(config);
    if (result === true) {
      setTestState('supported');
      useProviderStore.getState().setSupportsToolCall(provider.id, true);
    } else if (result === false) {
      setTestState('unsupported');
      useProviderStore.getState().setSupportsToolCall(provider.id, false);
    } else {
      // null = 超时，不写回 supportsToolCall，用户可重试
      setTestState('idle');
    }
  };

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
        {/* 内置 Provider 提示 */}
        {isBuiltIn && (
          <div className="builtin-note">
            <Trans>内置 Provider · 名称与 Base URL 不可改</Trans>
          </div>
        )}

        {/* 名称（仅自定义 Provider） */}
        {!isBuiltIn && (
          <div className="aster-form-field">
            <label className="aster-form-label" htmlFor="pf-name">
              <Trans>名称</Trans>
            </label>
            <input
              id="pf-name"
              type="text"
              className={`input${errors.name ? ' input--error' : ''}`}
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
            className={`input${errors.baseURL ? ' input--error' : ''}`}
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

        {/* Model — 内置 Provider 走 select 固定清单（CARRY-02 / D-07），自定义走 text input */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="pf-model">
            <Trans>模型名称</Trans>
          </label>
          {isBuiltIn ? (
            <div className="select-wrap">
              <select
                id="pf-model"
                className="input select"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              >
                {(BUILTIN_MODEL_OPTIONS[provider!.id] ?? [model]).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <span className="select-caret">
                <ChevronDownIcon size={14} />
              </span>
            </div>
          ) : (
            <input
              id="pf-model"
              ref={modelRef}
              type="text"
              className="input"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="deepseek-v4-flash"
            />
          )}
        </div>

        {/* 测试 tool calling 按钮（仅非内置 Provider；已保存可点击，未保存诚实禁用） */}
        {!isBuiltIn && (
          <div className="aster-form-field">
            {provider?.id ? (
              // 已保存 Provider：按钮可点击
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleTestToolCall}
                disabled={testState === 'loading'}
              >
                <Trans>{testState === 'loading' ? '测试中...' : '测试 tool calling'}</Trans>
              </button>
            ) : (
              // 未保存（新建）：诚实禁用（aster-design-system 范式，B2/B3）
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-disabled="true"
                title={t`保存后可测试`}
                onClick={(e) => e.preventDefault()}
              >
                <Trans>测试 tool calling</Trans>
              </button>
            )}
            {testState === 'supported' && (
              <span className="badge badge-success"><Trans>✓ 支持</Trans></span>
            )}
            {testState === 'unsupported' && (
              <span className="badge badge-error"><Trans>✗ 不支持</Trans></span>
            )}
          </div>
        )}

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
            className={`input${errors.apiKey ? ' input--error' : ''}`}
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
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
        >
          <Trans>取消</Trans>
        </button>
        <button type="submit" className="btn btn-primary btn-sm">
          <Trans>保存</Trans>
        </button>
      </div>
    </form>
  );
}
