/**
 * src/App.tsx — Task Pane shell（柔和品牌渐变 + 玻璃拟态，PANE-01 / D-06）
 *
 * 自上而下四段：
 *   1. 品牌渐变 header（logo + Aster 字标 + 设置入口占位）
 *   2. 上下文卡（选区元数据 pill，content-height）
 *   3. 聊天流（flex:1，可滚动）
 *   4. 玻璃拟态输入栏（content-height）
 *
 * 视觉系统在 src/styles.css，主题随 Office 宿主（main.tsx 设 data-theme）。
 * 美观优先，已弃用 Fluent v9 原生 Office 观感（用户 2026-05-27 拍板）。
 */
import { useLingui } from '@lingui/react/macro';
import ContextCard from './components/ContextCard';
import ChatStream from './components/ChatStream';
import InputBar from './components/InputBar';
import { SettingsIcon } from './components/icons';

export default function App(): React.ReactElement {
  const { t } = useLingui();
  const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

  return (
    <div className="aster-shell">
      {/* 1. 品牌渐变 header */}
      <header className="aster-header">
        <img className="aster-header__logo" src={logo} alt="" />
        <span className="aster-header__name">Aster</span>
        <span className="aster-header__spacer" />
        {/* 设置入口：Phase 1 占位禁用，诚实表达「即将开放」（D-08） */}
        <button
          className="aster-iconbtn"
          disabled
          aria-label={t`设置即将开放`}
          title={t`设置即将开放`}
        >
          <SettingsIcon />
        </button>
      </header>

      {/* 2. 上下文卡 */}
      <div className="aster-context-wrap">
        <ContextCard />
      </div>

      {/* 3. 聊天流（可滚动） */}
      <div className="aster-chat">
        <ChatStream />
      </div>

      {/* 4. 玻璃拟态输入栏 */}
      <InputBar />
    </div>
  );
}
