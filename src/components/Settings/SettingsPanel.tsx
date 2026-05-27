/**
 * src/components/Settings/SettingsPanel.tsx — 整页滑入设置面板（PROV-05 / D-08 / D-15）
 *
 * 由 App.tsx 通过 .aster-settings-overlay.is-open 控制 CSS translateX 滑入动画。
 * 本组件只渲染内容，动画容器在 App.tsx。
 *
 * Props:
 *   onClose()               — 关闭/返回回调
 *   initialAnchor?          — 深链字段 ID（D-12）：'key-input' | 'model-input'
 *   onShowOnboarding?()     — 「重看引导」回调（D-04）
 *
 * autoAttach（D-15）：从 providerStore（Wave 3）直接读取，onChange 调用 setAutoAttach
 */
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
import { ChevronIcon } from '../icons';
import ProviderList from './ProviderList';

interface SettingsPanelProps {
  onClose: () => void;
  initialAnchor?: string;
  onShowOnboarding?: () => void;
}

export default function SettingsPanel({
  onClose,
  initialAnchor,
  onShowOnboarding,
}: SettingsPanelProps): React.ReactElement {
  const { t } = useLingui();

  // D-15：autoAttach 和 setAutoAttach 从 Wave 3 providerStore 直接消费
  const autoAttach = useProviderStore((s) => s.autoAttach);
  const setAutoAttach = useProviderStore((s) => s.setAutoAttach);

  return (
    <div className="aster-settings">
      {/* 顶部返回行 */}
      <div className="aster-settings__header">
        <button
          className="aster-iconbtn"
          onClick={onClose}
          aria-label={t`返回`}
          title={t`返回`}
        >
          <ChevronIcon />
        </button>
        <span className="aster-settings__title">
          <Trans>设置</Trans>
        </span>
      </div>

      {/* 可滚动内容区 */}
      <div className="aster-settings__body">
        {/* Provider 增删改列表（D-08） */}
        <ProviderList focusAnchor={initialAnchor} />

        {/* 选区自动附带开关（D-15：Wave 3 providerStore 已实现，此处直接消费） */}
        <div className="aster-settings__section">
          <label className="aster-settings__toggle-row" htmlFor="setting-auto-attach">
            <span className="aster-settings__label">
              <Trans>自动附带选区内容</Trans>
            </span>
            <input
              id="setting-auto-attach"
              type="checkbox"
              className="aster-toggle"
              checked={autoAttach}
              onChange={(e) => setAutoAttach(e.target.checked)}
              aria-label={t`自动附带选区内容`}
            />
          </label>
          <p className="aster-settings__hint">
            <Trans>发送消息时自动附带您当前选中的文档内容</Trans>
          </p>
        </div>

        {/* 重看引导（D-04） */}
        {onShowOnboarding && (
          <div className="aster-settings__section">
            <button className="aster-link-btn" onClick={onShowOnboarding}>
              <Trans>重看引导</Trans>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
