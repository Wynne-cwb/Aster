/**
 * src/App.tsx — 350px flex-column 三段 shell（PANE-01 / D-06）
 *
 * 顶部：ContextCard（content-height，auto）
 * 中部：ChatStream（flex:1，占剩余，可滚动）
 * 底部：InputBar（content-height，auto）
 *
 * 所有 spacing/颜色使用 Fluent v9 token，禁硬编 px/hex（UI-SPEC 硬规则）。
 * 350px 是布局尺寸例外，用 minWidth（UI-SPEC §Spacing 例外条款）。
 */
import { tokens } from '@fluentui/react-components';
import ContextCard from './components/ContextCard';
import ChatStream from './components/ChatStream';
import InputBar from './components/InputBar';

export default function App(): React.ReactElement {
  return (
    <div
      style={{
        minWidth: '350px',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: tokens.colorNeutralBackground1,
        overflowX: 'hidden',
      }}
    >
      {/* 顶部：上下文卡（content-height，colorNeutralBackground2） */}
      <div
        style={{
          backgroundColor: tokens.colorNeutralBackground2,
          padding: tokens.spacingVerticalS,
          paddingLeft: tokens.spacingHorizontalM,
          paddingRight: tokens.spacingHorizontalM,
        }}
      >
        <ContextCard />
      </div>

      {/* 中部：聊天流（flex:1，可滚动，colorNeutralBackground1） */}
      <div
        style={{
          flex: 1,
          backgroundColor: tokens.colorNeutralBackground1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <ChatStream />
      </div>

      {/* 底部：输入栏（content-height，colorNeutralBackground2） */}
      <div
        style={{
          backgroundColor: tokens.colorNeutralBackground2,
          padding: tokens.spacingVerticalS,
          paddingLeft: tokens.spacingHorizontalM,
          paddingRight: tokens.spacingHorizontalM,
        }}
      >
        <InputBar />
      </div>
    </div>
  );
}
