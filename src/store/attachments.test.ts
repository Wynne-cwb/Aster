/**
 * src/store/attachments.test.ts — useAttachmentStore 单测
 *
 * Phase 17 Wave 1 演进：
 * - 原有 4 个测试保留（向后兼容 API：addImages/clearImages/removeImage/NFR-09）
 * - 新增 8 个测试守门新判别联合 store（addAttachment/getImages/getDocuments/
 *   updateAttachment/removeAttachment/clearAttachments/向后兼容/NFR-09）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAttachmentStore } from './attachments';
import type { AttachedImage, AttachedDocument } from './attachments';

/** 构造一个 AttachedImage（kind:'image'） */
const makeImage = (id: string): AttachedImage => ({
  kind: 'image',
  id,
  base64: 'abc123',
  mimeType: 'image/png',
  fileName: `test-${id}.png`,
  sizeBytes: 1024,
});

/** 构造一个 AttachedDocument（kind:'document'，status:'parsing'） */
const makeDoc = (id: string): AttachedDocument => ({
  kind: 'document',
  id,
  fileName: `test-${id}.docx`,
  sizeBytes: 2048,
  fileKind: 'docx',
  status: 'parsing',
});

// ──────────────────────────────────────────────────────────────────────────
// 新 API 测试（Phase 17 判别联合 store）
// ──────────────────────────────────────────────────────────────────────────

describe('useAttachmentStore — 新 API（Phase 17 判别联合）', () => {
  beforeEach(() => useAttachmentStore.getState().clearAttachments());

  it('Test 1: addAttachment({kind:"image"}) + getImages() 返回该 image', () => {
    const img = makeImage('img1');
    useAttachmentStore.getState().addAttachment(img);
    const images = useAttachmentStore.getState().getImages();
    expect(images).toHaveLength(1);
    expect(images[0].id).toBe('img1');
    expect(images[0].kind).toBe('image');
  });

  it('Test 2: addAttachment({kind:"document"}) + getDocuments() 返回该 doc', () => {
    const doc = makeDoc('doc1');
    useAttachmentStore.getState().addAttachment(doc);
    const docs = useAttachmentStore.getState().getDocuments();
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe('doc1');
    expect(docs[0].kind).toBe('document');
    expect(docs[0].status).toBe('parsing');
  });

  it('Test 3: updateAttachment(id, {status:"ready", derivedText}) 更新正确字段', () => {
    const doc = makeDoc('doc2');
    useAttachmentStore.getState().addAttachment(doc);
    useAttachmentStore.getState().updateAttachment('doc2', {
      status: 'ready',
      derivedText: '解析文本内容',
    });
    const docs = useAttachmentStore.getState().getDocuments();
    expect(docs[0].status).toBe('ready');
    expect(docs[0].derivedText).toBe('解析文本内容');
    // 其他字段不受影响
    expect(docs[0].fileName).toBe('test-doc2.docx');
  });

  it('Test 4: removeAttachment(id) 删除附件', () => {
    useAttachmentStore.getState().addAttachment(makeImage('img1'));
    useAttachmentStore.getState().addAttachment(makeDoc('doc1'));
    useAttachmentStore.getState().removeAttachment('img1');
    const { attachments } = useAttachmentStore.getState();
    expect(attachments).toHaveLength(1);
    expect(attachments[0].id).toBe('doc1');
  });

  it('Test 5: clearAttachments() 清空所有附件（image + document）', () => {
    useAttachmentStore.getState().addAttachment(makeImage('img1'));
    useAttachmentStore.getState().addAttachment(makeDoc('doc1'));
    useAttachmentStore.getState().clearAttachments();
    expect(useAttachmentStore.getState().attachments).toHaveLength(0);
  });

  it('Test 6: 向后兼容 addImages([]) 可调用，内部追加 kind:"image" 附件', () => {
    // addImages 接受不含 kind 字段的旧格式（向后兼容）
    useAttachmentStore.getState().addImages([
      { id: 'legacy1', base64: 'x', mimeType: 'image/jpeg', fileName: 'a.jpg', sizeBytes: 512 },
    ]);
    const images = useAttachmentStore.getState().getImages();
    expect(images).toHaveLength(1);
    expect(images[0].kind).toBe('image');
    expect(images[0].id).toBe('legacy1');
  });

  it('Test 7: 向后兼容 clearImages() 可调用，清空图片附件', () => {
    useAttachmentStore.getState().addAttachment(makeImage('img1'));
    useAttachmentStore.getState().addAttachment(makeDoc('doc1'));
    useAttachmentStore.getState().clearImages();
    // 图片清空，文档保留
    const { attachments } = useAttachmentStore.getState();
    const images = attachments.filter((a) => a.kind === 'image');
    const docs = attachments.filter((a) => a.kind === 'document');
    expect(images).toHaveLength(0);
    expect(docs).toHaveLength(1);
  });

  it('Test 8: NFR-09 — store 为纯内存态，localStorage.setItem 不被调用', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    useAttachmentStore.getState().addAttachment(makeImage('img1'));
    useAttachmentStore.getState().addAttachment(makeDoc('doc1'));
    useAttachmentStore.getState().updateAttachment('doc1', { status: 'ready', derivedText: '文本' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 向后兼容 API 测试（Phase 15 旧行为，Wave 3 迁移前保留）
// ──────────────────────────────────────────────────────────────────────────

describe('useAttachmentStore — 向后兼容 API（Phase 15 旧行为）', () => {
  beforeEach(() => useAttachmentStore.getState().clearAttachments());

  it('初始状态 attachments 为空数组', () => {
    expect(useAttachmentStore.getState().attachments).toHaveLength(0);
  });

  it('addImages 追加图片，不覆盖现有', () => {
    useAttachmentStore.getState().addImages([
      { id: 'a', base64: 'abc', mimeType: 'image/png', fileName: 'a.png', sizeBytes: 1024 },
    ]);
    useAttachmentStore.getState().addImages([
      { id: 'b', base64: 'def', mimeType: 'image/png', fileName: 'b.png', sizeBytes: 1024 },
    ]);
    expect(useAttachmentStore.getState().getImages()).toHaveLength(2);
    expect(useAttachmentStore.getState().getImages()[0].id).toBe('a');
    expect(useAttachmentStore.getState().getImages()[1].id).toBe('b');
  });

  it('clearImages 后 getImages() 为空', () => {
    useAttachmentStore.getState().addImages([
      { id: 'a', base64: 'x', mimeType: 'image/png', fileName: 'a.png', sizeBytes: 100 },
    ]);
    useAttachmentStore.getState().clearImages();
    expect(useAttachmentStore.getState().getImages()).toHaveLength(0);
  });

  it('removeImage 精确移除目标 id，保留其余', () => {
    useAttachmentStore.getState().addImages([
      { id: 'a', base64: 'x', mimeType: 'image/png', fileName: 'a.png', sizeBytes: 100 },
      { id: 'b', base64: 'y', mimeType: 'image/png', fileName: 'b.png', sizeBytes: 100 },
      { id: 'c', base64: 'z', mimeType: 'image/png', fileName: 'c.png', sizeBytes: 100 },
    ]);
    useAttachmentStore.getState().removeImage('b');
    const ids = useAttachmentStore.getState().getImages().map((i) => i.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('NFR-09：store 为纯内存态，localStorage.setItem 不被调用', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    useAttachmentStore.getState().addImages([
      { id: 'x', base64: 'abc', mimeType: 'image/png', fileName: 'x.png', sizeBytes: 512 },
    ]);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
