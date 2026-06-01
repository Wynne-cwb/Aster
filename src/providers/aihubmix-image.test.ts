/**
 * src/providers/aihubmix-image.test.ts — 三路解析器 fixture-based 单测（Wave 0 脚手架）
 *
 * Phase 14 Plan 01 创建：Wave 0 测试先行（Interface-First 模式）。
 * - 此时 AihubmixImageClient 尚未重写（Plan 05 才完成），测试初始为红（预期行为）。
 * - Plan 05 完成后，三路解析器实现后，测试变绿。
 *
 * fetch 通过 vi.stubGlobal 全局 mock，按 URL 分发对应 fixture，CI 不打真 API（D-15）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import doubaoFixture from './__fixtures__/doubao-response.json';
import gptImage2Fixture from './__fixtures__/gpt-image-2-response.json';
import geminiFixture from './__fixtures__/gemini-response.json';
import { AihubmixImageClient } from './aihubmix-image';
import type { ImageConfig } from './types';

// doubao 路径：两次 fetch（1. predictions API 拿 fixture URL；2. 图片 URL fetch 转 base64）
// gpt-image-2 路径：一次 fetch（predictions API，直接返回 b64_json 数组）
// gemini 路径：一次 fetch（streamGenerateContent，返回 JSON 数组）
vi.stubGlobal(
  'fetch',
  vi.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('doubao') && url.includes('predictions')) {
      return { ok: true, json: async () => doubaoFixture };
    }
    if (typeof url === 'string' && url.includes('doubao')) {
      // doubao 图片 URL fetch（转 base64）
      return {
        ok: true,
        headers: { get: (_: string) => 'image/png' },
        arrayBuffer: async () => new ArrayBuffer(4),
      };
    }
    if (typeof url === 'string' && url.includes('gpt-image-2')) {
      return { ok: true, json: async () => gptImage2Fixture };
    }
    if (typeof url === 'string' && url.includes('gemini')) {
      return { ok: true, json: async () => geminiFixture };
    }
    throw new Error(`Unexpected URL in test: ${String(url)}`);
  }),
);

const makeConfig = (model: string): ImageConfig => ({
  providerId: 'aihubmix-image',
  baseURL: 'https://aihubmix.com',
  apiKey: 'test-key-not-real',
  model,
});

describe('AihubmixImageClient — 三路解析器（MDL-01）', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockClear();
  });

  it('doubao: output[0].url → fetch → base64，返回 { base64, mimeType }（D-01）', async () => {
    const client = new AihubmixImageClient();
    const result = await client.generate('画一棵树', makeConfig('doubao-seedream-5.0-lite'));
    expect(result).toHaveProperty('base64');
    expect(result).toHaveProperty('mimeType');
    expect(result.base64).not.toContain('data:'); // 裸 base64，无 data: 前缀
    expect(result.mimeType).toBeTruthy();
  });

  it('gpt-image-2: output.b64_json[0].bytesBase64 取 base64，mimeType 规范化 png→image/png', async () => {
    const client = new AihubmixImageClient();
    const result = await client.generate('画一棵树', makeConfig('gpt-image-2'));
    expect(result.base64).toBe('iVBO');
    expect(result.mimeType).toBe('image/png'); // 规范化：'png' → 'image/png'
    expect(result.base64).not.toContain('data:');
  });

  it('gemini: 跳过 thoughtSignature，从 inlineData.data 取 base64（D-03）', async () => {
    const client = new AihubmixImageClient();
    const result = await client.generate('画一棵树', makeConfig('gemini-3.1-flash-image-preview'));
    expect(result.base64).toBe('iVBO'); // 真打录制（2026-06-01）：gemini 此次返回 image/png
    expect(result.mimeType).toBe('image/png'); // 真打录制（2026-06-01）：mimeType = image/png（非 jpeg，API 响应可变）
    expect(result.base64).not.toContain('data:');
  });

  it('三路返回值 base64 均不含 data: 前缀（D-01/D-04）', async () => {
    const client = new AihubmixImageClient();
    const models = ['doubao-seedream-5.0-lite', 'gpt-image-2', 'gemini-3.1-flash-image-preview'];
    for (const model of models) {
      const result = await client.generate('test', makeConfig(model));
      expect(result.base64, `model ${model} 的 base64 不应含 data: 前缀`).not.toContain('data:');
    }
  });

  it('apiKey 不出现在 error.message（T-14-01）', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const client = new AihubmixImageClient();
    await expect(
      client.generate('test', makeConfig('doubao-seedream-5.0-lite')),
    ).rejects.toSatisfy((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      return !msg.includes('test-key-not-real'); // apiKey 不进 error.message
    });
  });
});
