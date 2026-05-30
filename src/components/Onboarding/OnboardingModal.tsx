/**
 * src/components/Onboarding/OnboardingModal.tsx — 单步 Onboarding Modal（D-18/D-19）
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   modal-scrim 遮罩 + 居中 modal 卡片（320px, r-16, shadow-pop）
 *   modal-brand：logo + "Aster"（无步骤计数，单步不需要）
 *
 * D-18/D-19：单步 onboarding，仅 Step1Keys 填 API Key。
 *   删除 Step2Guide 整步、删除 step state / goNext / goBack。
 *   onComplete 由 Step1Keys 直接调用（写 ONBOARDING_SEEN 后触发）。
 *
 * Props:
 *   onComplete() — 完成引导（Step1Keys 内写 ONBOARDING_SEEN + 关闭）
 *   onSkip()     — 跳过（D-01）：写 ONBOARDING_SEEN + 关闭
 */
import { storage, STORAGE_KEYS } from '../../lib/storage';
import Step1Keys from './Step1Keys';
const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

interface OnboardingModalProps {
  onComplete: () => void;
  onSkip: () => void;
}

export default function OnboardingModal({
  onComplete,
  onSkip,
}: OnboardingModalProps): React.ReactElement {
  function handleSkip(): void {
    // D-01：跳过也写 storage 标记（下次不再弹出）
    storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true);
    onSkip();
  }

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="onb-modal-title">
      <div className="modal">
        <div className="modal-brand">
          <img src={logo} alt="Aster" style={{ width: 22, height: 22 }} />
          <span className="brand-name">Aster</span>
          {/* brand-step 已删除（D-19：单步无需计数） */}
        </div>

        <Step1Keys onComplete={onComplete} onSkip={handleSkip} />
      </div>
    </div>
  );
}
