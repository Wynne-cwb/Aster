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

/** 停止生成（实心方块——对应流式生成中「发送键变停止」D-14） */
export function StopIcon(): ReactElement {
  return (
    <svg {...base} fill="currentColor" stroke="none">
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
export function RetryIcon(): ReactElement {
  return (
    <svg {...base}>
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
export function AlertIcon(): ReactElement {
  return (
    <svg {...base}>
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
export function EyeIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** 眼睛 - 闭（附带选区 OFF，G-08 D-31） */
export function EyeOffIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}
