/**
 * src/App.tsx — Task Pane shell（柔和品牌渐变 accent + 玻璃拟态，PANE-01 / D-06）
 *
 * 自上而下三段：
 *   1. 顶部行：上下文卡（选区元数据 pill，flex:1）+ 设置入口（齿轮，Provider 等配置归此处）
 *   2. 聊天流（flex:1，可滚动）
 *   3. 玻璃拟态输入栏（content-height）
 *
 * 不再画品牌渐变 header —— Office 面板已自带「Aster」原生标题，重复且与 Office chrome
 * 风格冲突（用户 2026-05-27 真机反馈）。品牌感保留在空态 logo / 发送键 / 光晕的渐变 accent。
 *
 * 视觉系统在 src/styles.css，主题随 Office 宿主（main.tsx 设 data-theme）。
 */
import { useLingui } from '@lingui/react/macro';
import ContextCard from './components/ContextCard';
import ChatStream from './components/ChatStream';
import InputBar from './components/InputBar';
import { SettingsIcon } from './components/icons';

export default function App(): React.ReactElement {
  const { t } = useLingui();

  return (
    <div className="aster-shell">
      {/* 1. 顶部行：上下文卡 + 设置入口 */}
      <div className="aster-topbar">
        <ContextCard />
        {/* 设置入口：Phase 1 占位禁用；Provider（AiHubMix / DeepSeek）等配置归此处（D-08） */}
        <button
          className="aster-iconbtn"
          disabled
          aria-label={t`设置即将开放`}
          title={t`设置即将开放`}
        >
          <SettingsIcon />
        </button>
      </div>

      {/* 2. 聊天流（可滚动） */}
      <div className="aster-chat">
        <ChatStream />
      </div>

      {/* 3. 玻璃拟态输入栏 */}
      <InputBar />
    </div>
  );
}
