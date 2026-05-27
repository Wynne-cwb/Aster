/**
 * src/components/ChatStream.tsx — 聊天流（Phase 1 空态）
 *
 * Phase 1 无消息，渲染居中空态：发光品牌 logo + 标题 + 副文案 + 按宿主示例 prompt 胶囊。
 * 胶囊只读（Phase 1 输入栏 disabled），承载原本靠 Ribbon 功能按钮承载的功能入口（FOUND-10）。
 *
 * 视觉系统见 styles.css。Phase 2 接入时此处改渲染 messages 列表（react-markdown）。
 */
import { Trans } from '@lingui/react/macro';
import type { ReactElement } from 'react';
import { useAdapter } from '../context/AdapterContext';

/** 按宿主返回示例用法提示胶囊节点数组（i18n 用 <Trans>，默认中文）。 */
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
  const host = useAdapter().capabilities().host;
  const examples = usageExamples(host);
  const logo = `${import.meta.env.BASE_URL}assets/icon-80.png`;

  return (
    <div className="aster-empty">
      {/* 发光品牌 logo */}
      <div className="aster-empty__logo-wrap">
        <span className="aster-empty__glow" />
        <img className="aster-empty__logo" src={logo} alt="Aster" />
      </div>

      <div className="aster-empty__title">
        <Trans>开始使用 Aster</Trans>
      </div>
      <div className="aster-empty__subtitle">
        <Trans>配置 Provider 后即可开始对话</Trans>
      </div>

      {/* 用法提示：小标题 + 按宿主示例胶囊（只读，取代 Ribbon 功能入口） */}
      <div className="aster-empty__hint">
        <Trans>试试这些</Trans>
      </div>
      <div className="aster-chips">
        {examples.map((example, i) => (
          <span key={i} className="aster-chip">
            {example}
          </span>
        ))}
      </div>
    </div>
  );
}
