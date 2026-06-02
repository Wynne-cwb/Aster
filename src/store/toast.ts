/**
 * src/store/toast.ts — 极简 toast store（16-05 新增）
 *
 * 单条 toast 语义：showToast(message) 显示一条底部居中提示，~2s 自动消失。
 * 后到的 toast 覆盖前一条（重置计时）。无队列、无类型分级——保持极简。
 *
 * 用法：
 *   const showToast = useToastStore((s) => s.showToast);
 *   showToast(t`已复制到剪贴板`);
 *
 * UI 由 <Toast /> 组件（挂在 App 顶层）订阅渲染。
 */
import { create } from 'zustand';

const TOAST_DURATION_MS = 2000;

interface ToastState {
  /** 当前显示的文案；null = 不显示 */
  message: string | null;
  /** 自增计数：每次 showToast +1，供组件 useEffect 依赖以重置淡出计时（同文案连续触发也能重新计时） */
  nonce: number;
  showToast: (message: string) => void;
  clearToast: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  nonce: 0,
  showToast: (message: string): void => {
    if (hideTimer) clearTimeout(hideTimer);
    set((s) => ({ message, nonce: s.nonce + 1 }));
    hideTimer = setTimeout(() => {
      set({ message: null });
      hideTimer = null;
    }, TOAST_DURATION_MS);
  },
  clearToast: (): void => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ message: null });
  },
}));
