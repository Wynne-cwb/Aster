/**
 * src/store/attachments.test.ts — useAttachmentStore 单测
 *
 * Plan 03（Wave 2）：解除 Wave 0 的 describe.skip，补全完整断言。
 * 覆盖 FILE-06（上传图内存态 store）+ NFR-09（base64 不写 localStorage）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAttachmentStore } from './attachments';
import type { AttachedImage } from './attachments';

const makeImage = (id: string): AttachedImage => ({
  id,
  base64: 'abc123',
  mimeType: 'image/png',
  fileName: `test-${id}.png`,
  sizeBytes: 1024,
});

describe('useAttachmentStore', () => {
  beforeEach(() => useAttachmentStore.getState().clearImages());

  it('初始状态 images 为空数组', () => {
    expect(useAttachmentStore.getState().images).toHaveLength(0);
  });

  it('addImages 追加图片，不覆盖现有', () => {
    useAttachmentStore.getState().addImages([makeImage('a')]);
    useAttachmentStore.getState().addImages([makeImage('b')]);
    expect(useAttachmentStore.getState().images).toHaveLength(2);
    expect(useAttachmentStore.getState().images[0].id).toBe('a');
    expect(useAttachmentStore.getState().images[1].id).toBe('b');
  });

  it('clearImages 后 images 为空', () => {
    useAttachmentStore.getState().addImages([makeImage('a'), makeImage('b')]);
    useAttachmentStore.getState().clearImages();
    expect(useAttachmentStore.getState().images).toHaveLength(0);
  });

  it('removeImage 精确移除目标 id，保留其余', () => {
    useAttachmentStore.getState().addImages([makeImage('a'), makeImage('b'), makeImage('c')]);
    useAttachmentStore.getState().removeImage('b');
    const ids = useAttachmentStore.getState().images.map((i) => i.id);
    expect(ids).toEqual(['a', 'c']);
  });

  it('NFR-09：store 为纯内存态，localStorage.setItem 不被调用', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem');
    useAttachmentStore.getState().addImages([makeImage('x')]);
    // 无论 store 内部有何 side effect，localStorage.setItem 均不应被调用
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
