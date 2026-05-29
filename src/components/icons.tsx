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
  strokeWidth: 1.5,
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
export function SendIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
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

/** 停止生成（实心方块——对应流式生成中「发送键变停止」D-14） */
export function StopIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} fill="currentColor" stroke="none" width={size} height={size}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/** 插入到文档（向下箭头入框，PANE-04） */
export function InsertIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}

/** 重试（顺时针循环箭头，失败气泡重试 D-11） */
export function RetryIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M1 4v6h6" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
    </svg>
  );
}

/** 关闭 / 删除（× 号，选区胶囊关闭 D-15） */
export function XIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

/** 警示（三角感叹号，错误气泡前缀 D-10） */
export function AlertIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/** 新增（+ 号，Settings 新增 Provider） */
export function PlusIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

/** 删除（垃圾桶，Settings 删除 Provider） */
export function TrashIcon(): ReactElement {
  return (
    <svg {...base}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

/** 完成（对勾，Onboarding 步骤完成标记） */
export function CheckIcon(): ReactElement {
  return (
    <svg {...base}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/** 眼睛 - 开（附带选区 ON，G-08 D-31） */
export function EyeIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 眼睛 - 闭（附带选区 OFF，G-08 D-31） */
export function EyeOffIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/** 暂停 — 两条粗竖线（Lucide 风：fill 当前色块，no stroke），AgentControlBar 用 */
export function PauseIcon(): ReactElement {
  return (
    <svg {...base}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 继续（播放）— 实心三角，AgentControlBar paused 态用 */
export function PlayIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M7 4 L20 12 L7 20 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 齿轮 — InputBar tools 行左下，size/strokeWidth 可覆盖（默认 1.5） */
export function GearIcon({ size = 24, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }): ReactElement {
  return (
    <svg {...base} strokeWidth={strokeWidth} width={size} height={size}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** 回形针附件 — InputBar tools 行禁用态 */
export function PaperclipIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

/** 折叠 chevron（向下）— D-05 折叠卡；CSS .is-up 时 rotate(180deg) 表示展开 */
export function ChevronDownIcon({ size = 24, className }: { size?: number; className?: string }): ReactElement {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** 返回 chevron（向左）— Settings header 返回 */
export function ChevronLeftIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

/** 警示圆圈 — pane-banner 缺 Key 提示 */
export function AlertCircleIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

/** 文件文本 — selpill 前缀图标 */
export function DocumentIcon({ size = 24 }: { size?: number }): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

/** 剪贴板（Lucide clipboard-copy 风格）— 一键复制调试信息按钮 */
export function ClipboardIcon({ size = 24, strokeWidth = 1.5 }: { size?: number; strokeWidth?: number }): ReactElement {
  return (
    <svg {...base} strokeWidth={strokeWidth} width={size} height={size}>
      <rect x="9" y="2" width="6" height="4" rx="1" ry="1" />
      <path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2" />
      <path d="M13 12h4" />
      <path d="M13 16h4" />
      <path d="M9 12h.01" />
      <path d="M9 16h.01" />
    </svg>
  );
}
