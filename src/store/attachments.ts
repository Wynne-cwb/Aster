/**
 * src/store/attachments.ts — 图片附件内存态 store（FILE-06，VIS Phase 15）
 *
 * 纯内存 Zustand slice，**无 persist middleware**（NFR-09 硬约束）。
 * base64 图片字节仅存在于此内存 store，绝不写入 localStorage / sessionStorage。
 * 刷新即丢，用户每次 session 开始需重新上传（NFR-09 memory-only）。
 *
 * 清除时机（2026-06-02 真机 UAT 决策 B，反转原 D-10「发送后保留」）：
 * sendMessage 发送后由 chat.ts 调 clearImages() 自动清空，对齐「发完即清」直觉；
 * 用户也可随时点缩略图 chip 上的 × 手动删除。代价：多轮追问同一张图需重新上传。
 *
 * 安全约束（NFR-09 / T-15-08）：
 * - base64 不写入 localStorage（无 persist middleware）
 * - base64 不进 Message.content（sendMessage 只用 vision 文本结果）
 * - base64 不出现在 serializeForStorage 路径（chat.ts 白名单天然过滤）
 */

import { create } from 'zustand';

export interface AttachedImage {
  id: string;
  /** 裸 base64，不含 data:...;base64, 前缀 */
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileName: string;
  sizeBytes: number;
}

interface AttachmentState {
  images: AttachedImage[];
  /** 追加图片列表（不覆盖现有，支持多次追加） */
  addImages: (imgs: AttachedImage[]) => void;
  /** 清空所有附件图（sendMessage 发送后自动 / 用户主动 / session 结束） */
  clearImages: () => void;
  /** 移除指定 id 的图片（chip × 按钮触发） */
  removeImage: (id: string) => void;
}

// 纯内存 store：不使用 persist()，满足 NFR-09（base64 不进 localStorage）
export const useAttachmentStore = create<AttachmentState>((set) => ({
  images: [],
  addImages: (imgs) =>
    set((s) => ({ images: [...s.images, ...imgs] })),
  clearImages: () => set({ images: [] }),
  removeImage: (id) =>
    set((s) => ({ images: s.images.filter((i) => i.id !== id) })),
}));
