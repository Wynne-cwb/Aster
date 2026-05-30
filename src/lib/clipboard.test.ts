/**
 * src/lib/clipboard.test.ts — copyToClipboard 剪贴板函数测试（260530-c14）
 *
 * 覆盖：
 * [CLIPBOARD MAIN]        navigator.clipboard.writeText 成功 → true
 * [CLIPBOARD FALLBACK]    writeText reject → textarea/execCommand 路径 → execCommand 结果
 * [CLIPBOARD DOUBLE FAIL] 两路径都失败 → false
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { copyToClipboard } from './clipboard';

describe('copyToClipboard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('[CLIPBOARD MAIN] writeText 成功 → 返回 true', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });

    const result = await copyToClipboard('hello');
    expect(result).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('[CLIPBOARD FALLBACK] writeText reject → execCommand 路径', async () => {
    // writeText 失败
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    // jsdom 不实现 execCommand，先 stub 再 spy
    const execCommandMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', {
      value: execCommandMock,
      writable: true,
      configurable: true,
    });

    const result = await copyToClipboard('fallback test');
    expect(result).toBe(true);
    expect(execCommandMock).toHaveBeenCalledWith('copy');

    // 清理
    Object.defineProperty(document, 'execCommand', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });

  it('[CLIPBOARD DOUBLE FAIL] writeText + execCommand 双失败 → false', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
    // jsdom 不实现 execCommand，先 stub 为抛异常
    Object.defineProperty(document, 'execCommand', {
      value: () => { throw new Error('not supported'); },
      writable: true,
      configurable: true,
    });

    const result = await copyToClipboard('fail test');
    expect(result).toBe(false);

    // 清理
    Object.defineProperty(document, 'execCommand', {
      value: undefined,
      writable: true,
      configurable: true,
    });
  });
});
