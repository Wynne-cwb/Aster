/**
 * src/components/Onboarding/OnboardingModal.tsx — 2 步 Onboarding Modal
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   modal-scrim 遮罩 + 居中 modal 卡片（320px, r-16, shadow-pop）
 *   modal-brand：logo + "Aster" + "01/02" 步骤文字
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
import { storage, STORAGE_KEYS } from '../../lib/storage';
import Step1Keys from './Step1Keys';
import Step2Guide from './Step2Guide';
const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

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

  function goNext(): void {
    setStep(2);
  }

  function goBack(): void {
    setStep(1);
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="onb-modal-title">
      <div className="modal">
        <div className="modal-brand">
          <img src={logo} alt="Aster" style={{ width: 22, height: 22 }} />
          <span className="brand-name">Aster</span>
          <span className="brand-step">{step === 1 ? '01' : '02'} / 02</span>
        </div>

        {step === 1 ? (
          <Step1Keys onNext={goNext} onSkip={handleSkip} />
        ) : (
          <Step2Guide onBack={goBack} onComplete={onComplete} />
        )}
      </div>
    </div>
  );
}
