/**
 * src/components/Toast.tsx — 极简 toast UI（16-05 新增）
 *
 * 订阅 useToastStore，fixed 底部居中渲染单条提示，~2s 自动消失（store 控时）。
 *
 * 视觉（aster-design-system teal 克制）：
 * - --surface 底 + --text 文案 + teal --accent 左侧点缀竖条
 * - 圆角 --radius-3 + 轻阴影 --shadow-pop
 * - 进出用 --dur-base 过渡（opacity + translateY）
 * - prefers-reduced-motion 降级（全局 CSS 处理）
 *
 * 无障碍：role="status" + aria-live="polite"（屏幕阅读器播报，不抢焦点）。
 */
import { useToastStore } from '../store/toast';
import { CheckIcon } from './icons';

export default function Toast(): React.ReactElement | null {
  const message = useToastStore((s) => s.message);
  if (!message) return null;

  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="toast__icon" aria-hidden="true">
        <CheckIcon size={14} strokeWidth={2} />
      </span>
      <span className="toast__text">{message}</span>
    </div>
  );
}
