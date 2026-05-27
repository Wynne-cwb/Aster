/**
 * src/components/ChatStream.tsx — 聊天流（Phase 1 空态）
 *
 * Phase 1 无消息，仅渲染居中空态块：
 * - heading「开始使用 Aster」fontSizeBase400 semibold，居中
 * - body「配置 Provider 后即可开始对话」fontSizeBase300，colorNeutralForeground3，居中
 * - 用法提示区：按当前宿主（ppt/excel/word）给出贴切的示例 prompt 芯片，
 *   取代原本靠 Ribbon 功能按钮承载的功能入口（FOUND-10 最终决策）。
 *   芯片只读、不可点（Phase 1 输入栏 disabled，不让其看起来可触发请求）。
 *
 * Phase 2 接入时：
 *   - 此处渲染 messages 列表，每条消息用 react-markdown 渲染 MD 内容
 *   - import ReactMarkdown from 'react-markdown'（已在 package.json 中，按需 lazy import）
 */
import { Badge, Text, tokens } from '@fluentui/react-components';
import { Trans } from '@lingui/react/macro';
import type { ReactElement } from 'react';
import { useAdapter } from '../context/AdapterContext';

/**
 * 按宿主返回对应的示例用法提示芯片节点数组。
 * 文案用 <Trans> 宏，保持与现有空态一致的 i18n 方式（默认中文）。
 */
function usageExamples(host: 'ppt' | 'excel' | 'word'): ReactElement[] {
  switch (host) {
    case 'ppt':
      return [
        <Trans key="ppt-1">把主题扩展成多页大纲</Trans>,
        <Trans key="ppt-2">为选中的 slide 配一张图</Trans>,
      ];
    case 'excel':
      return [
        <Trans key="excel-1">用自然语言生成公式</Trans>,
        <Trans key="excel-2">解释并修复报错的公式</Trans>,
      ];
    case 'word':
      return [
        <Trans key="word-1">多风格润色选中文段</Trans>,
        <Trans key="word-2">长文一键生成 TL;DR</Trans>,
      ];
  }
}

export default function ChatStream(): React.ReactElement {
  // capabilities() 为 Phase 1 桩，返回静态宿主标识，可安全调用。
  const host = useAdapter().capabilities().host;
  const examples = usageExamples(host);

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

      {/* 用法提示区：小标题 + 按宿主示例 prompt 芯片（只读，取代 Ribbon 功能按钮入口）*/}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: tokens.spacingVerticalS,
          marginTop: tokens.spacingVerticalM,
        }}
      >
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          <Trans>试试这些</Trans>
        </Text>
        {examples.map((example, i) => (
          <Badge
            key={i}
            appearance="tint"
            color="informative"
            size="large"
          >
            {example}
          </Badge>
        ))}
      </div>
    </div>
  );
}
