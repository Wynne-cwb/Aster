/**
 * src/components/StockImageResultCard.tsx — 图库只读结果卡（Phase 18 LIB-03）
 *
 * 产品方向（Q1=B 自动直插）：图库工具已 loop 内直接插入文档；此卡只读展示已插入图片的
 * 缩略图 +「已插入到 X」+ Pexels/摄影师署名链接。无任何操作按钮（D-06）。**不叠水印**——
 * 署名只在 chat 内（LIB-03 + ROADMAP，保 slide 视觉）。
 *
 * 安全/NFR-09：缩略图用 Pexels 远程 URL（photo.src.tiny），<img src> 不受 CORS 限制，
 * 无 base64；署名外链带 rel="noopener noreferrer"（防 tabnabbing / referrer 泄漏，T-18-08）。
 */
import type { ReactElement } from 'react';
import { Trans } from '@lingui/react/macro';

export interface StockImageResultCardProps {
  /** Pexels 远程 URL（photo.src.tiny），<img src> 不受 CORS 限制，非 base64 */
  thumbnailUrl: string;
  photographer: string;
  photographerUrl: string;
  /** Pexels 图片页（署名链接） */
  photoUrl: string;
  host: 'ppt' | 'word';
}

export function StockImageResultCard({
  thumbnailUrl,
  photographer,
  photographerUrl,
  photoUrl,
  host,
}: StockImageResultCardProps): ReactElement {
  return (
    <div className="aster-tool-card img-result-card">
      <img
        src={thumbnailUrl}
        alt="已插入的图库图片"
        className="img-result-card__thumb"
        loading="lazy"
      />
      <div className="img-result-card__label">
        {host === 'ppt' ? <Trans>已插入到 PPT</Trans> : <Trans>已插入到 Word</Trans>}
      </div>
      <div className="img-result-card__attribution">
        <Trans>照片来自</Trans>{' '}
        <a href={photoUrl} target="_blank" rel="noopener noreferrer">
          Pexels
        </a>
        {' · '}
        <a href={photographerUrl} target="_blank" rel="noopener noreferrer">
          {photographer}
        </a>
      </div>
    </div>
  );
}
