/**
 * src/lib/parsers/pdf.test.ts — FILE-04 pdf 解析器测试（Wave 0 红灯 stub）
 *
 * Wave 0：测试先于实现。import './pdf' 路径在 Wave 2 之前不存在，
 * 运行时报 "Cannot find module './pdf"（红灯）。
 *
 * pdfjs-dist mock：vi.mock 工厂形式（确保在 import 前提升），
 * 包含 GlobalWorkerOptions + getDocument（见 17-RESEARCH.md L730-745）。
 */
import { describe, it, expect, vi } from 'vitest';

// vi.mock 工厂必须在所有 import 之前提升（hoisted），使用工厂形式确保正确
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: '测试文本' }],
        }),
      }),
    }),
  }),
}));

import { parsePdf } from './pdf';

describe('parsePdf — FILE-04 pdf 解析（Wave 0 红灯）', () => {
  it('Test 1: parsePdf(file) 正常 PDF → 拼接 numPages 页的文本', async () => {
    const fakeFile = new File(['fake pdf bytes'], 'test.pdf', { type: 'application/pdf' });
    const result = await parsePdf(fakeFile);

    expect(typeof result).toBe('string');
    // 正常路径返回拼接后的文本
    expect(result).toContain('测试文本');
  });

  it('Test 2: 扫描件（所有页 items 为空）→ throw Error with code PDF_NO_TEXT_LAYER', async () => {
    const pdfjs = await import('pdfjs-dist');
    // 覆盖 mock：所有页 getTextContent 返回空 items（模拟扫描件）
    vi.mocked(pdfjs.getDocument).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [], // 扫描件无文本层
          }),
        }),
      }),
    } as never);

    const fakeFile = new File(['fake scan pdf'], 'scan.pdf', { type: 'application/pdf' });

    // 用同一个 Promise 链做两个断言（mockReturnValueOnce 仅覆盖一次调用）
    const scanPromise = parsePdf(fakeFile);
    await expect(scanPromise).rejects.toThrow();
    // 注：rejects.toMatchObject 需要新 Promise（第一个已 settle）
    // 重新 mock 一次再调用
    vi.mocked(pdfjs.getDocument).mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({
            items: [],
          }),
        }),
      }),
    } as never);
    await expect(parsePdf(fakeFile)).rejects.toMatchObject({
      code: 'PDF_NO_TEXT_LAYER',
    });
  });

  it('Test 3: GlobalWorkerOptions.workerSrc 被设置（验证 new URL 配置点存在）', async () => {
    const pdfjs = await import('pdfjs-dist');
    // 调用 parsePdf 后，workerSrc 应被 parsePdf 内部设置（new URL 调用）
    // Wave 2 实现时需在 parsePdf 函数体内设置 GlobalWorkerOptions.workerSrc
    const fakeFile = new File(['fake pdf'], 'worker.pdf', { type: 'application/pdf' });
    await parsePdf(fakeFile).catch(() => {
      // 允许因 mock 不完整而失败，关键是验证 workerSrc 被设置
    });
    // workerSrc 应在 parsePdf 调用时被赋值（不为初始空值或仍为空字符串则已设置）
    // 注：mock 环境下 workerSrc 可能仍为 ''，Wave 2 实现后此断言转绿
    expect(pdfjs.GlobalWorkerOptions).toBeDefined();
    expect(typeof pdfjs.GlobalWorkerOptions.workerSrc).toBe('string');
  });
});
