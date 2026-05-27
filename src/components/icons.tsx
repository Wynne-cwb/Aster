/**
 * src/components/icons.tsx — 内联 SVG 图标（Lucide 风格，stroke=currentColor）
 *
 * 弃用 emoji 与栅格图标（UI Skill 硬规则）。统一 24×24 viewBox、stroke 1.75、圆角线帽，
 * 由 CSS 控制实际尺寸与颜色（currentColor）。
 */
import type { ReactElement } from 'react';

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

/** 设置 / 偏好（sliders 造型，比齿轮更轻、更现代） */
export function SettingsIcon(): ReactElement {
  return (
    <svg {...base}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.4" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.4" />
    </svg>
  );
}

/** 上传（箭头入托盘） */
export function UploadIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

/** 发送（上箭头，现代聊天发送键造型） */
export function SendIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 19V5" />
      <path d="M6 11l6-6 6 6" />
    </svg>
  );
}

/** 上下文卡前缀（右向小箭头） */
export function ChevronIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}
