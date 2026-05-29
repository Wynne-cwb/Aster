/**
 * src/components/Onboarding/Step2Guide.tsx — Onboarding 第 2 步：宿主功能卡介绍
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   host-card 形态：Lucide 风图标 + 文字标签（规避官方 Office SVG 版权）
 *   modal-title / modal-sub / modal-body / modal-foot 新结构
 *
 * D-03：按当前宿主（ppt / excel / word）显示对应功能卡（单卡，不展示其他宿主）
 * 完成：storage.set(ONBOARDING_SEEN, true) + onComplete()
 *
 * Props:
 *   onBack()     — 返回上一步
 *   onComplete() — 完成引导（写 storage + 关闭 Onboarding）
 */
import { Trans } from '@lingui/react/macro';
import { useAdapter } from '../../context/AdapterContext';
import { storage, STORAGE_KEYS } from '../../lib/storage';
import { DocumentIcon, InsertIcon, CheckIcon } from '../icons';

interface Step2GuideProps {
  onBack: () => void;
  onComplete: () => void;
}

interface FeatureItem {
  key: string;
  label: React.ReactElement;
}

function PptFeatures(): FeatureItem[] {
  return [
    { key: 'ppt-1', label: <Trans>把主题扩展成多页大纲，一次生成整份演示文稿结构</Trans> },
    { key: 'ppt-2', label: <Trans>为选中的 Slide 自动配图，支持 AI 生成图像</Trans> },
    { key: 'ppt-3', label: <Trans>Bullet 压缩精简，一键缩减冗余文字</Trans> },
  ];
}

function ExcelFeatures(): FeatureItem[] {
  return [
    { key: 'excel-1', label: <Trans>用自然语言描述需求，AI 直接生成 Excel 公式</Trans> },
    { key: 'excel-2', label: <Trans>解释报错公式、定位问题并给出修复建议</Trans> },
    { key: 'excel-3', label: <Trans>数据清洗：去重、格式统一、缺失值处理</Trans> },
  ];
}

function WordFeatures(): FeatureItem[] {
  return [
    { key: 'word-1', label: <Trans>多风格润色：商务正式、轻松活泼、简洁有力任选</Trans> },
    { key: 'word-2', label: <Trans>长文 TL;DR：一键生成摘要，快速把握要点</Trans> },
    { key: 'word-3', label: <Trans>大纲扩写：从几条 Bullet 生成完整段落</Trans> },
  ];
}

/** 宿主图标映射（Lucide 风，规避官方 Office SVG 版权） */
function HostIcon({ host }: { host: string }): React.ReactElement {
  if (host === 'ppt') return <InsertIcon />;
  if (host === 'excel') return <CheckIcon />;
  return <DocumentIcon />;
}

export default function Step2Guide({ onBack, onComplete }: Step2GuideProps): React.ReactElement {
  const host = useAdapter().capabilities().host;

  let features: FeatureItem[];
  let hostLabel: React.ReactElement;

  switch (host) {
    case 'ppt':
      features = PptFeatures();
      hostLabel = <Trans>PowerPoint</Trans>;
      break;
    case 'excel':
      features = ExcelFeatures();
      hostLabel = <Trans>Excel</Trans>;
      break;
    case 'word':
    default:
      features = WordFeatures();
      hostLabel = <Trans>Word</Trans>;
      break;
  }

  function handleComplete(): void {
    // 写 storage 标记（D-01 / D-04）
    storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true);
    onComplete();
  }

  return (
    <>
      <h2 id="onb-modal-title" className="modal-title">
        <Trans>在 {hostLabel} 中你可以</Trans>
      </h2>
      <p className="modal-sub">
        <Trans>Aster 已为当前宿主准备好以下功能，随时可在输入框发起对话。</Trans>
      </p>

      {/* 宿主功能卡（D-03：仅展示当前宿主）*/}
      <div className="modal-body">
        <div className="host-card">
          <div className="host-icon">
            <HostIcon host={host} />
          </div>
          <div className="host-info">
            <div className="host-name">{hostLabel}</div>
            <ul>
              {features.map((item) => (
                <li key={item.key}>{item.label}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* 操作按钮行 */}
      <div className="modal-foot">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          <Trans>上一步</Trans>
        </button>
        <button className="btn btn-primary btn-sm" onClick={handleComplete}>
          <Trans>开始使用</Trans>
        </button>
      </div>
    </>
  );
}
