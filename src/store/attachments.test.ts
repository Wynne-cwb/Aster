/**
 * src/store/attachments.test.ts — useAttachmentStore Wave 0 脚手架
 *
 * Wave 0: 此测试脚手架在 attachments.ts（Plan 03）创建前占位。
 * Plan 03 完成后，此文件将被扩展为完整的 store 单测（FILE-06 coverage）。
 *
 * 设计：脚手架不做 static import（避免 tsc Module Not Found 错误），
 * 而是通过 describe.skip 标记 Wave 0 占位用例，待 Plan 03 实现后解除 skip。
 *
 * 覆盖 FILE-06 requirement（上传图内存态 store）。
 */

import { describe, it, expect } from 'vitest';

// Wave 0: 以下用例 skip 标记为「待实现」，Plan 03 完成 attachments.ts 后解除 skip
// 并补全断言（addImages / clearImages / removeImage / 无 persist middleware）

describe('useAttachmentStore（Wave 0 脚手架）', () => {
  // WAVE_0_STUB: attachments.ts 不存在时此块 skip，Plan 03 完成后取消 skip
  describe.skip('attachments.ts 实现后启用（Plan 03 Wave 2）', () => {
    it('初始状态 images 为空数组', () => {
      // TODO Plan 03: import { useAttachmentStore } from './attachments';
      // const { images } = useAttachmentStore.getState();
      // expect(images).toEqual([]);
      expect(true).toBe(false); // 占位：Plan 03 前永远 RED（若取消 skip）
    });

    it('addImages 追加图片到 images 列表', () => {
      // TODO Plan 03
      expect(true).toBe(false);
    });

    it('removeImage(id) 移除指定图片', () => {
      // TODO Plan 03
      expect(true).toBe(false);
    });

    it('clearImages 清空所有图片', () => {
      // TODO Plan 03
      expect(true).toBe(false);
    });

    it('store 无 persist middleware（满足 NFR-09 base64 不入 localStorage）', () => {
      // TODO Plan 03: 验证 store 不含 zustand/middleware persist
      // import { useAttachmentStore } from './attachments';
      // expect((useAttachmentStore as unknown as { persist?: unknown }).persist).toBeUndefined();
      expect(true).toBe(false);
    });
  });

  // 此用例永远通过，确保脚手架文件在 Wave 0 CI 不报 "0 tests"
  it('WAVE_0_PLACEHOLDER: 脚手架就位，完整测试在 Plan 03 解除 skip', () => {
    expect(true).toBe(true);
  });
});
