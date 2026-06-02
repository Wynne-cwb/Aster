/**
 * src/providers/aihubmix-vision.test.ts — AihubmixVisionClient 单测
 *
 * Wave 0 脚手架：Task 1（aihubmix-vision.ts 扩展）完成后此测试变绿。
 * 覆盖 VIS-02 requirement：analyzeImages 多图格式 + apiKey 安全守门 + 向后兼容。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AihubmixVisionClient } from './aihubmix-vision';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('AihubmixVisionClient', () => {
  const config = { baseURL: 'https://api.aihubmix.com/v1', apiKey: 'test-key' };

  beforeEach(() => mockFetch.mockReset());

  describe('analyzeImages', () => {
    it('多图：content array 格式正确（text 在前，image_url blocks 在后）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '图片描述' } }] }),
      });
      const client = new AihubmixVisionClient();
      const result = await client.analyzeImages(
        '描述这些图片',
        [
          { base64: 'base64abc', mimeType: 'image/png' },
          { base64: 'base64def', mimeType: 'image/jpeg' },
        ],
        config,
      );
      expect(result.content).toBe('图片描述');
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      const msgContent = body.messages[0].content;
      expect(msgContent[0]).toMatchObject({ type: 'text', text: '描述这些图片' });
      expect(msgContent[1]).toMatchObject({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,base64abc' },
      });
      expect(msgContent[2]).toMatchObject({
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,base64def' },
      });
    });

    it('apiKey 仅在 Authorization header，不在 body（T-01-04）', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '' } }] }),
      });
      const client = new AihubmixVisionClient();
      await client.analyzeImages('test', [{ base64: 'b64', mimeType: 'image/png' }], config);
      const [, reqInit] = mockFetch.mock.calls[0];
      expect((reqInit.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
      const body = JSON.parse(reqInit.body as string);
      expect(JSON.stringify(body)).not.toContain('test-key');
    });

    it('stream: false 在请求 body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: '' } }] }),
      });
      const client = new AihubmixVisionClient();
      await client.analyzeImages('test', [{ base64: 'b64', mimeType: 'image/png' }], config);
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.stream).toBe(false);
    });

    it('网络失败 → NetworkError', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));
      const client = new AihubmixVisionClient();
      await expect(
        client.analyzeImages('test', [{ base64: 'b64', mimeType: 'image/png' }], config)
      ).rejects.toThrow('aihubmix 视觉请求网络失败');
    });
  });

  describe('analyze（向后兼容）', () => {
    it('单图调用内部委托给 analyzeImages', async () => {
      const spy = vi.spyOn(AihubmixVisionClient.prototype, 'analyzeImages');
      spy.mockResolvedValueOnce({ content: '单图结果' });
      const client = new AihubmixVisionClient();
      const result = await client.analyze('描述', 'b64abc', 'image/png', config);
      expect(result.content).toBe('单图结果');
      expect(spy).toHaveBeenCalledWith('描述', [{ base64: 'b64abc', mimeType: 'image/png' }], config);
    });
  });
});
