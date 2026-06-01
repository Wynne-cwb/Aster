/**
 * src/providers/aihubmix-vision.ts — aihubmix 视觉客户端（PROV-03）
 *
 * POST /chat/completions，model=AIHUBMIX_VISION_MODEL（当前 gpt-5.4，D-06），stream=false。
 * 请求体携带 image_url content block（OpenAI multi-content 格式）。
 * 响应为普通 OpenAI-compatible JSON（非流式）。
 *
 * 安全：
 * - apiKey 仅放 Authorization header，不进请求 body
 * - apiKey 不出现在 error.message（T-01-04）
 */

import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
import { AIHUBMIX_VISION_MODEL } from './registry';

export interface VisionConfig {
  baseURL: string;
  apiKey: string;
}

export interface VisionResult {
  content: string;
}

export class AihubmixVisionClient {
  async analyze(
    userText: string,
    imageBase64: string,
    mimeType: string,
    config: VisionConfig,
  ): Promise<VisionResult> {
    const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: AIHUBMIX_VISION_MODEL,
          stream: false,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: userText },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType};base64,${imageBase64}` },
              },
            ],
          }],
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
    const content = json.choices?.[0]?.message?.content ?? '';
    return { content };
  }
}
