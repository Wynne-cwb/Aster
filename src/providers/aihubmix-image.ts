/**
 * src/providers/aihubmix-image.ts — aihubmix 生图客户端（PROV-03）
 *
 * POST /images/generations，model='gpt-image-1'。
 * 响应：{ data: [{b64_json: '...'}], usage: { input_tokens, output_tokens, total_tokens } }
 *
 * 注意：aihubmix 生图的 usage 字段用 input_tokens/output_tokens（非 prompt_tokens/completion_tokens）。
 * [CITED: docs.aihubmix.com/en/api/GPT-Image-1]
 *
 * 安全：
 * - apiKey 仅放 Authorization header，不进请求 body
 * - apiKey 不出现在 error.message（T-01-04）
 */

import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';

export interface ImageGenConfig {
  baseURL: string;
  apiKey: string;
}

export type ImageSize = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
export type ImageQuality = 'high' | 'medium' | 'low' | 'auto';

export interface ImageGenResult {
  b64_json: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  } | null;
}

export class AihubmixImageClient {
  async generate(
    prompt: string,
    size: ImageSize,
    quality: ImageQuality,
    config: ImageGenConfig,
  ): Promise<ImageGenResult> {
    const url = `${config.baseURL.replace(/\/$/, '')}/images/generations`;

    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt,
          n: 1,
          size,
          quality,
        }),
      });
    } catch {
      throw new NetworkError('aihubmix 生图请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    const json = await resp.json() as {
      data?: Array<{ b64_json?: string }>;
      usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
    };
    const b64_json = json.data?.[0]?.b64_json ?? '';

    // aihubmix 生图 usage 字段：input_tokens / output_tokens / total_tokens
    const rawUsage = json.usage;
    const usage = rawUsage
      ? {
          input_tokens: rawUsage.input_tokens,
          output_tokens: rawUsage.output_tokens,
          total_tokens: rawUsage.total_tokens,
        }
      : null;

    return { b64_json, usage };
  }
}
