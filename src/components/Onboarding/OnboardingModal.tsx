/**
 * src/components/Onboarding/OnboardingModal.tsx — 2 步 Onboarding Modal
 *
 * 覆盖整个 Task Pane（inset: 0; z-index: 50），在 Task Pane iframe 内，不超出边界（Pitfall 6）。
 * 由 App.tsx 根据 storage.get(ONBOARDING_SEEN) === null 决定是否展示。
 *
 * 步骤：
 *   Step 1（Step1Keys）：DeepSeek Key + aihubmix Key（选填）+ 隐私告知
 *   Step 2（Step2Guide）：宿主功能卡（按当前宿主显示，D-03）
 *
 * Props:
 *   onComplete() — 完成引导（Step2Guide 内写 ONBOARDING_SEEN + 关闭）
 *   onSkip()     — 跳过（D-01）：写 ONBOARDING_SEEN + 关闭
 */
import { useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { storage, STORAGE_KEYS } from '../../lib/storage';
import Step1Keys from './Step1Keys';
import Step2Guide from './Step2Guide';

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingModal({
  onComplete,
  onSkip,
}: OnboardingModalProps): React.ReactElement {
  const [step, setStep] = useState<1 | 2>(1);

  function handleSkip(): void {
    // D-01：跳过也写 storage 标记（下次不再弹出）
    storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true);
    onSkip();
  }

  return (
    <div className="aster-onboarding-overlay" role="dialog" aria-modal="true" aria-label="Aster 引导">
      <div className="aster-onboarding">
        {/* 步骤指示器 */}
        <div className="aster-onboarding__steps">
          <span className={`aster-step${step >= 1 ? ' is-active' : ''}`}>1</span>
          <span className="aster-step-divider" />
          <span className={`aster-step${step === 2 ? ' is-active' : ''}`}>2</span>
        </div>

        {/* 步骤内容 */}
        {step === 1 ? (
          <Step1Keys onNext={() => setStep(2)} onSkip={handleSkip} />
        ) : (
          <Step2Guide onComplete={onComplete} />
        )}

        {/* 步骤底部说明 */}
        <p className="aster-onboarding__step-hint">
          <Trans>第 {step} 步，共 2 步</Trans>
        </p>
      </div>
    </div>
  );
}
