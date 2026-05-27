/**
 * src/components/ChatStream.tsx — 聊天流（Phase 1 空态）
 *
 * Phase 1 无消息，仅渲染居中空态块：
 * - heading「开始使用 Aster」fontSizeBase400 semibold，居中
 * - body「配置 Provider 后即可开始对话」fontSizeBase300，colorNeutralForeground3，居中
 *
 * Phase 2 接入时：
 *   - 此处渲染 messages 列表，每条消息用 react-markdown 渲染 MD 内容
 *   - import ReactMarkdown from 'react-markdown'（已在 package.json 中，按需 lazy import）
 */
import { Text, tokens } from '@fluentui/react-components';
import { Trans } from '@lingui/react/macro';

export default function ChatStream(): React.ReactElement {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: tokens.spacingVerticalL,
        paddingLeft: tokens.spacingHorizontalL,
        paddingRight: tokens.spacingHorizontalL,
        textAlign: 'center',
        gap: tokens.spacingVerticalS,
      }}
    >
      {/* 空态 heading：fontSizeBase400 semibold（UI-SPEC §Typography）*/}
      <Text
        size={400}
        weight="semibold"
        style={{ color: tokens.colorNeutralForeground1 }}
      >
        <Trans>开始使用 Aster</Trans>
      </Text>

      {/* 空态 body：fontSizeBase300 regular，colorNeutralForeground3（UI-SPEC §Typography/Color）*/}
      <Text
        size={300}
        style={{ color: tokens.colorNeutralForeground3 }}
      >
        <Trans>配置 Provider 后即可开始对话</Trans>
      </Text>
    </div>
  );
}
