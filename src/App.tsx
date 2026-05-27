/**
 * src/App.tsx — Task Pane shell（Phase 2 Wave 5 串联完成）
 *
 * 自上而下：
 *   0. 未配 Key 提示条（D-01 跳过后，hasKey=false 时显示）
 *   1. 顶部行：上下文卡（选区元数据 pill，flex:1）+ 设置入口（齿轮，已激活）
 *   2. 聊天流（flex:1，可滚动，ChatBubble 列表）
 *   3. 玻璃拟态输入栏（InputBar，已激活发送/停止/选区胶囊）
 *   4. Settings 整页滑入覆盖（translateX 动画，z-index:10）
 *   5. Onboarding Modal（首启时自动弹出，storage 无 aster:onboarding:seen 时）
 *
 * 视觉系统在 src/styles.css，主题随 Office 宿主（main.tsx 设 data-theme）。
 */
import { useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import ContextCard from './components/ContextCard';
import ChatStream from './components/ChatStream';
import InputBar from './components/InputBar';
import SettingsPanel from './components/Settings/SettingsPanel';
import OnboardingModal from './components/Onboarding/OnboardingModal';
import { SettingsIcon } from './components/icons';
import { useProviderStore } from './store/providers';
import { storage, STORAGE_KEYS } from './lib/storage';

export default function App(): React.ReactElement {
  const { t } = useLingui();

  // Settings 覆盖层状态
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<string | undefined>();

  // Onboarding Modal 状态
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 未配 Key 提示条：检查默认 Provider 是否有 Key（D-01）
  const defaultLLMProviderId = useProviderStore((s) => s.defaultLLMProviderId);
  const hasKey = useProviderStore((s) => !!s.getKey(s.defaultLLMProviderId));

  // 首启时检查 Onboarding（storage 无 ONBOARDING_SEEN 则弹出）
  useEffect(() => {
    const seen = storage.get<boolean>(STORAGE_KEYS.ONBOARDING_SEEN);
    if (!seen) setShowOnboarding(true);
  }, []);

  /** 打开 Settings，支持深链到指定字段（D-12） */
  const handleOpenSettings = (anchor?: string): void => {
    setSettingsAnchor(anchor);
    setShowSettings(true);
  };

  const handleCloseSettings = (): void => {
    setShowSettings(false);
    setSettingsAnchor(undefined);
  };

  // 避免 TS unused variable 警告
  void defaultLLMProviderId;

  return (
    <div className="aster-shell">
      {/* 0. 未配 Key 提示条（首启 Onboarding 弹出时隐藏，避免双重提示） */}
      {!hasKey && !showOnboarding && (
        <div className="aster-key-hint" role="alert">
          <span>
            <Trans>请先配置 API Key</Trans>
          </span>
          <button
            className="aster-link-btn aster-link-btn--sm"
            onClick={() => handleOpenSettings('key-input')}
          >
            <Trans>前往设置 →</Trans>
          </button>
        </div>
      )}

      {/* 1. 顶部行：上下文卡 + 设置入口（已激活） */}
      <div className="aster-topbar">
        <ContextCard />
        <button
          className="aster-iconbtn"
          onClick={() => handleOpenSettings()}
          aria-label={t`设置`}
          title={t`设置`}
        >
          <SettingsIcon />
        </button>
      </div>

      {/* 2. 聊天流（可滚动） */}
      <div className="aster-chat">
        <ChatStream onSettings={handleOpenSettings} />
      </div>

      {/* 3. 玻璃拟态输入栏（已激活） */}
      <InputBar />

      {/* 4. Settings 整页滑入覆盖（translateX 动画，z-index:10） */}
      <div className={`aster-settings-overlay${showSettings ? ' is-open' : ''}`}>
        {showSettings && (
          <SettingsPanel
            onClose={handleCloseSettings}
            initialAnchor={settingsAnchor}
            onShowOnboarding={() => {
              handleCloseSettings();
              setShowOnboarding(true);
            }}
          />
        )}
      </div>

      {/* 5. Onboarding Modal（首启弹出，z-index:50 在 Settings 之上） */}
      {showOnboarding && (
        <OnboardingModal
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
