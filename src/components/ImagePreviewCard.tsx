/**
 * src/components/ImagePreviewCard.tsx — 生图只读结果卡（Phase 16 IMG-03）
 *
 * 产品方向（2026-06-02 用户拍板，反转 D-02 解耦 + 预览确认）：
 *   生图工具改为 loop 内直接插入文档；此卡片改为**只读**展示已插入图片的缩略图 +
 *   「已插入到 PPT / Word」小标签。移除确认插入 / 重新生成 / 取消三按钮 + 卡内 model 下拉。
 *   重新生成改为对话式（用户说「换一张」/「用 gpt-image-2 重画」，AI 重新调用工具）。
 *
 * 安全约束（NFR-09 路径 C）：
 * - thumbnail base64 只在内存态（来自 tool message 的 toolResult.data.thumbnail）
 * - tool role 消息不进 serializeForStorage 白名单 → base64 永不进 localStorage
 */
import type { ReactElement } from 'react';

export interface ImagePreviewCardProps {
  /** 裸 base64（无 data: 前缀）——已插入图片的缩略图，仅 UI 只读消费 */
  base64: string;
  mimeType: string;
  /** 'ppt' | 'word'（决定「已插入到 X」标签文案） */
  host: 'ppt' | 'word';
}

export function ImagePreviewCard({
  base64,
  mimeType,
  host,
}: ImagePreviewCardProps): ReactElement {
  const hostLabel = host === 'ppt' ? '已插入到 PPT' : '已插入到 Word';

  return (
    <div className="aster-tool-card img-result-card">
      <img
        src={`data:${mimeType};base64,${base64}`}
        alt="已插入的生成图片"
        className="img-result-card__thumb"
      />
      <div className="img-result-card__label">{hostLabel}</div>
    </div>
  );
}
