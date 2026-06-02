/**
 * src/providers/aihubmix-vision.ts — aihubmix 视觉客户端（PROV-03）
 *
 * POST /chat/completions，model=AIHUBMIX_VISION_MODEL（当前 gpt-5.4，D-06），stream=false。
 * 请求体携带 image_url content block（OpenAI multi-content 格式）。
 * 支持多图：analyzeImages() 接受 VisionImage[] 数组，content block text 在前、image_url blocks 在后。
 * 响应为普通 OpenAI-compatible JSON（非流式）。
 *
 * 安全：
 * - apiKey 仅放 Authorization header，不进请求 body（T-01-04）
 * - apiKey 不出现在 error.message（T-01-04）
 */

import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
import { AIHUBMIX_VISION_MODEL } from './registry';

export interface VisionConfig {
  baseURL: string;
  apiKey: string;
}

/**
 * VisionImage — 单张图片的 base64 + mimeType（Phase 15 多图扩展，VIS-02）。
 * 用于 analyzeImages() 方法的入参数组。
 */
export interface VisionImage {
  base64: string;
  mimeType: string;
}

export interface VisionResult {
  content: string;
}

export class AihubmixVisionClient {
  /**
   * analyzeImages — 多图视觉分析（Phase 15 VIS-02 新增）。
   *
   * content array 格式：text block 在前，image_url blocks 在后（OpenAI 最佳实践）。
   * apiKey 仅放 Authorization header，不进 body（T-01-04）。
   * stream: false — 非流式视觉调用。
   */
  async analyzeImages(
    userText: string,
    images: VisionImage[],
    config: VisionConfig,
  ): Promise<VisionResult> {
    const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;
    const imageBlocks = images.map(({ base64, mimeType }) => ({
      type: 'image_url' as const,
      image_url: { url: `data:${mimeType};base64,${base64}` },
    }));
    const content = [
      { type: 'text' as const, text: userText },
      ...imageBlocks,
    ];

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,  // apiKey 仅 header（T-01-04）
        },
        body: JSON.stringify({
          model: AIHUBMIX_VISION_MODEL,
          stream: false,
          messages: [{ role: 'user', content }],
        }),
      });
    } catch {
      throw new NetworkError('aihubmix 视觉请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    const json = await resp.json() as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content ?? '';
    return { content: text };
  }

  /**
   * analyze — 单图向后兼容方法（内部委托给 analyzeImages）。
   *
   * 现有调用方无需改动；Phase 15 之后建议直接用 analyzeImages()。
   */
  async analyze(
    userText: string,
    imageBase64: string,
    mimeType: string,
    config: VisionConfig,
  ): Promise<VisionResult> {
    return this.analyzeImages(userText, [{ base64: imageBase64, mimeType }], config);
  }
}
