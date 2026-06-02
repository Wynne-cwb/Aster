/**
 * src/store/attachments.ts — 统一附件内存态 store（Phase 17 FILE 演进）
 *
 * Phase 17 演进：AttachedImage[] → Attachment 判别联合（image | document）
 * 向后兼容：addImages/clearImages/removeImage 保留（Wave 3 迁移后废弃）
 * 纯内存 Zustand slice，无 persist middleware（NFR-09 硬约束）
 *
 * D-03：多轮复用——sendMessage 不再 clearImages()；visionEvidence 缓存首次 vision 结果
 * D-05：统一 store — image/document 混合；document 字节解析后即丢（只存 derivedText）
 *
 * 安全约束（NFR-09 / T-17-02-03）：
 * - base64 不写入 localStorage（无 persist middleware）
 * - derivedText 不进 Message.content / serializeForStorage（chat.ts 白名单天然过滤）
 * - document 字节解析完即丢，只保留 derivedText（内存态，刷新即丢）
 */

import { create } from 'zustand';

export interface AttachedImage {
  kind: 'image';
  id: string;
  /** 裸 base64，不含 data:...;base64, 前缀 */
  base64: string;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  fileName: string;
  sizeBytes: number;
  /** D-03：首次 vision 调用后缓存结果，多轮不重复调 vision */
  visionEvidence?: string;
}

export type FileKind = 'docx' | 'xlsx' | 'pdf' | 'pptx' | 'text';
export type ParseStatus = 'parsing' | 'ready' | 'error';

export interface AttachedDocument {
  kind: 'document';
  id: string;
  fileName: string;
  sizeBytes: number;
  fileKind: FileKind;
  /** 解析状态：parsing → ready | error */
  status: ParseStatus;
  /** 解析后的纯文本（status=ready 时有值）*/
  derivedText?: string;
  /** D-04 软截断：解析文本超 ~30 万字符时 true */
  truncated?: boolean;
  /** 用户可读错误消息（status=error 时有值）*/
  errorMessage?: string;
}

export type Attachment = AttachedImage | AttachedDocument;

interface AttachmentState {
  attachments: Attachment[];

  // 新 API（Phase 17）
  addAttachment: (a: Attachment) => void;
  updateAttachment: (id: string, patch: Partial<AttachedDocument> | Partial<AttachedImage>) => void;
  removeAttachment: (id: string) => void;
  clearAttachments: () => void;
  getImages: () => AttachedImage[];
  getDocuments: () => AttachedDocument[];

  // 向后兼容 API（Phase 15 调用点，Wave 3 迁移后废弃）
  /** @deprecated 用 addAttachment({kind:'image',...}) 替代 */
  addImages: (imgs: Omit<AttachedImage, 'kind'>[]) => void;
  /** @deprecated 用 clearAttachments() 替代 */
  clearImages: () => void;
  /** @deprecated 用 removeAttachment(id) 替代 */
  removeImage: (id: string) => void;
}

// 纯内存 store：不使用 persist()，满足 NFR-09（base64 + derivedText 不进 localStorage）
export const useAttachmentStore = create<AttachmentState>((set, get) => ({
  attachments: [],

  addAttachment: (a) =>
    set((s) => ({ attachments: [...s.attachments, a] })),

  updateAttachment: (id, patch) =>
    set((s) => ({
      attachments: s.attachments.map((a) =>
        a.id === id ? ({ ...a, ...patch } as Attachment) : a,
      ),
    })),

  removeAttachment: (id) =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),

  clearAttachments: () => set({ attachments: [] }),

  getImages: () =>
    get().attachments.filter((a): a is AttachedImage => a.kind === 'image'),

  getDocuments: () =>
    get().attachments.filter((a): a is AttachedDocument => a.kind === 'document'),

  // 向后兼容：追加旧格式图片（自动补 kind:'image'）
  addImages: (imgs) =>
    set((s) => ({
      attachments: [
        ...s.attachments,
        ...imgs.map((img) => ({ ...img, kind: 'image' as const })),
      ],
    })),

  // 向后兼容：清空所有图片附件（保留文档附件）
  clearImages: () =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.kind !== 'image') })),

  // 向后兼容：按 id 移除（与 removeAttachment 等价）
  removeImage: (id) =>
    set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) })),
}));
