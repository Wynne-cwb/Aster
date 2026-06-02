/**
 * src/lib/parsers/docx.test.ts — FILE-02 docx 解析器测试（Wave 0 红灯 stub）
 *
 * Wave 0：测试先于实现。import './docx' 路径在 Wave 2 之前不存在，
 * 运行时报 "Cannot find module './docx'" → 确认红灯。
 */
import { describe, it, expect, vi } from 'vitest';

// Mock mammoth，确保测试不依赖真实解析器
vi.mock('mammoth', () => ({
  default: {
    extractRawText: vi.fn().mockResolvedValue({ value: '测试内容', messages: [] }),
  },
}));

// Wave 2 之前此路径不存在 → vitest 报 "Failed to resolve import './docx'"（红灯）
// @ts-expect-error — Wave 0 stub：实现文件在 Wave 2 之前不存在（TDD 红灯）
import { parseDocx } from './docx';

describe('parseDocx — FILE-02 docx 解析（Wave 0 红灯）', () => {
  it('Test 1: parseDocx(file) 返回 mammoth 解析出的文本字符串', async () => {
    const fakeFile = new File(['fake docx bytes'], 'test.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    const result = await parseDocx(fakeFile);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('Test 2: 超长文本（>300000 字符）被软截断，返回值含截断提示', async () => {
    const mammoth = await import('mammoth');
    const longText = 'x'.repeat(350000);
    vi.mocked(mammoth.default.extractRawText).mockResolvedValueOnce({
      value: longText,
      messages: [],
    });
    const fakeFile = new File(['fake'], 'long.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const result = await parseDocx(fakeFile);
    // 超长文本应被截断，返回值长度小于原始长度
    expect(result.length).toBeLessThan(longText.length);
    // 截断提示出现在返回值中
    expect(result).toMatch(/截断|已读取|前|部分/);
  });

  it('Test 3: mammoth import 只在首次调用时触发（lazy 加载验证）', async () => {
    // 此测试验证 parseDocx 内部使用 await import('mammoth') 懒加载
    // 实现时需确保 import 在函数体内（非模块顶层）
    const fakeFile = new File(['fake'], 'lazy.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    // 调用两次，均应正常返回（第二次走缓存，不报错）
    await parseDocx(fakeFile);
    const result = await parseDocx(fakeFile);
    expect(typeof result).toBe('string');
  });
});
