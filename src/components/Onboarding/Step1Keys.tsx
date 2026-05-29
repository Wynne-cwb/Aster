/**
 * src/components/Onboarding/Step1Keys.tsx — Onboarding 第 1 步：Key 填写 + 隐私告知
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   modal-title / modal-sub / modal-body / modal-foot 新结构
 *   .input 统一输入框 / .btn .btn-primary .btn-ghost .btn-sm 按钮系
 *
 * D-02：预选 DeepSeek（主输入），aihubmix 选填
 * D-01：不阻断跳过（Key 为空也可点「下一步」或「跳过」）
 * D-05 / T-02-25 / KEY-03 / KEY-04：隐私告知内联常驻，不可折叠
 *
 * Props:
 *   onNext()  — 进入第 2 步
 *   onSkip()  — 跳过整个 Onboarding
 */
import { useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';

interface Step1KeysProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function Step1Keys({ onNext, onSkip }: Step1KeysProps): React.ReactElement {
  const { t } = useLingui();
  const setKey = useProviderStore((s) => s.setKey);

  const [dsKey, setDsKey] = useState('');
  const [ahmKey, setAhmKey] = useState('');

  function handleNext(): void {
    // D-01：不阻断跳过——Key 为空也调用 setKey（写空字符串）；ProviderRegistry 在实际调用时抛 KeyInvalidError
    setKey('deepseek', dsKey);
    setKey('aihubmix', ahmKey);
    onNext();
  }

  return (
    <>
      <h2 id="onb-modal-title" className="modal-title">
        <Trans>配置 AI Provider</Trans>
      </h2>
      <p className="modal-sub">
        <Trans>Aster 需要您提供自己的 API Key，Key 仅存储在您的浏览器本地。</Trans>
      </p>

      <div className="modal-body">
        {/* DeepSeek Key 输入（主输入，D-02 预选 DeepSeek） */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="onb-ds-key">
            DeepSeek API Key
          </label>
          <input
            id="onb-ds-key"
            type="password"
            className="input"
            placeholder="sk-..."
            value={dsKey}
            onChange={(e) => setDsKey(e.target.value)}
            autoComplete="off"
            aria-label={t`DeepSeek API Key`}
          />
          <p className="aster-form-hint-sm">
            <Trans>在</Trans>{' '}
            <span className="aster-link-text">platform.deepseek.com</span>{' '}
            <Trans>获取</Trans>
          </p>
        </div>

        {/* aihubmix Key 输入（选填，用于生图和视觉） */}
        <div className="aster-form-field">
          <label className="aster-form-label" htmlFor="onb-ahm-key">
            AiHubMix API Key
            <span className="aster-optional">
              {' '}
              <Trans>（选填，用于生图和视觉）</Trans>
            </span>
          </label>
          <input
            id="onb-ahm-key"
            type="password"
            className="input"
            placeholder="ak-..."
            value={ahmKey}
            onChange={(e) => setAhmKey(e.target.value)}
            autoComplete="off"
            aria-label={t`AiHubMix API Key（选填）`}
          />
          <p className="aster-form-hint-sm">
            <Trans>在</Trans>{' '}
            <span className="aster-link-text">aihubmix.com</span>{' '}
            <Trans>获取</Trans>
          </p>
        </div>

        {/* 隐私告知（D-05 / KEY-03 / T-02-25）：内联常驻，不可折叠，用户在填 Key 前就能看到 */}
        <p className="aster-privacy-notice">
          <Trans>
            你选中的文档内容会发送到所配置的 Provider，不经过 Aster 服务器。
          </Trans>
          <br />
          <Trans>API Key 仅存储在您的浏览器本地。</Trans>
        </p>
      </div>

      {/* 操作按钮行 */}
      <div className="modal-foot">
        <button className="btn btn-ghost btn-sm" onClick={onSkip}>
          <Trans>跳过</Trans>
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleNext}>
          <Trans>下一步</Trans>
        </button>
      </div>
    </>
  );
}
