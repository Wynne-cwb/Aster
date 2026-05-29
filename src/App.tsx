/**
 * src/App.tsx — Task Pane shell（Phase 04.1 teal 重皮 D-01/D-02）
 *
 * 自上而下：
 *   0. pane-banner：未配 Key 提示条（!hasKey 时显示，AlertCircleIcon + warning 配色）
 *   1. AgentControlBar — 直接渲染，无包装 div（idle 时 return null 自行消失）
 *   2. ChatStream（flex:1，可滚动）
 *   3. InputBar — 新增 onGoSettings prop（D-01：齿轮移入 InputBar tools 行）
 *   4. settings-overlay（translateX 滑入覆盖，className 重命名）
 *   5. Onboarding Modal（首启弹出，z-index:50 在 Settings 之上）
 *
 * D-01/D-02 变化：
 * - 删除 ContextCard import + 顶栏整块（ContextCard + topbar 齿轮 + aster-topbar div）
 * - 删除 aster-shell__agent-bar 包装 div（AgentControlBar 直接渲染）
 * - 根容器 className: aster-shell → pane
 * - pane-banner 替代 aster-key-hint（AlertCircleIcon + warning 色）
 * - settings-overlay 替代 aster-settings-overlay
 * - InputBar 接收 onGoSettings prop
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import ChatStream from './components/ChatStream';
import InputBar from './components/InputBar';
import AgentControlBar from './components/AgentControlBar';
import { AlertCircleIcon } from './components/icons';
import { useProviderStore } from './store/providers';
import { storage, STORAGE_KEYS } from './lib/storage';

// SettingsPanel + OnboardingModal — lazy chunks（用户点击后才加载，不进初始 main chunk）
const SettingsPanel = lazy(() => import('./components/Settings/SettingsPanel'));
const OnboardingModal = lazy(() => import('./components/Onboarding/OnboardingModal'));

export default function App(): React.ReactElement {
  const { t } = useLingui();

  // Settings 覆盖层状态
  const [showSettings, setShowSettings] = useState(false);
  const [settingsAnchor, setSettingsAnchor] = useState<string | undefined>();

  // Onboarding Modal 状态
  const [showOnboarding, setShowOnboarding] = useState(false);

  // 未配 Key 提示条：检查默认 Provider 是否有 Key（D-01）
  // WR-01：读响应式 configuredKeyIds（state），而非 getKey()（localStorage，Zustand 不追踪）
  // —— 否则 setKey 后 banner 不刷新，要等无关重渲染才消失。
  const defaultLLMProviderId = useProviderStore((s) => s.defaultLLMProviderId);
  const hasKey = useProviderStore((s) => s.configuredKeyIds.includes(s.defaultLLMProviderId));

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
    <div className="pane">
      {/* 0. pane-banner：未配 Key 提示条（首启 Onboarding 弹出时隐藏，避免双重提示） */}
      {!hasKey && !showOnboarding && (
        <div className="pane-banner" role="alert">
          <AlertCircleIcon size={14} />
          <span>
            <Trans>请先配置 API Key</Trans>
          </span>
          <span className="spacer" style={{ flex: 1 }} />
          <button
            className="aster-link-btn aster-link-btn--sm"
            onClick={() => handleOpenSettings('key-input')}
            aria-label={t`前往设置`}
          >
            <Trans>前往设置 →</Trans>
          </button>
        </div>
      )}

      {/* 1. AgentControlBar — 直接渲染，无包装 div（D-01；idle 时 return null 不占位） */}
      <AgentControlBar />

      {/* 2. 聊天流（可滚动） */}
      <ChatStream onSettings={handleOpenSettings} />

      {/* 3. InputBar — onGoSettings 接管齿轮点击（D-01） */}
      <InputBar onGoSettings={handleOpenSettings} />

      {/* 4. settings-overlay（translateX 动画，z-index:10；className 重命名 D-01） */}
      <div className={`settings-overlay${showSettings ? ' is-open' : ''}`}>
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsPanel
              onClose={handleCloseSettings}
              initialAnchor={settingsAnchor}
              onShowOnboarding={() => {
                handleCloseSettings();
                setShowOnboarding(true);
              }}
            />
          </Suspense>
        )}
      </div>

      {/* 5. Onboarding Modal（首启弹出，z-index:50 在 Settings 之上） */}
      {showOnboarding && (
        <Suspense fallback={null}>
          <OnboardingModal
            onComplete={() => setShowOnboarding(false)}
            onSkip={() => setShowOnboarding(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
