/**
 * AihubMix 生图客户端 — 三路 response 解析器（MDL-01）
 *
 * 安全约束（T-14-01）：
 *   - apiKey 仅注入 Authorization / x-goog-api-key header，不进 request body
 *   - apiKey 不出现在 error.message（mapHttpError 固定字面量 message）
 *
 * Wire format 来源：.planning/spikes/011-image-gen-api-formats/findings.md（真机实测）
 *
 * CORS 修复（16-05 真机 UAT，2026-06-02）：
 *   doubao 原用 response_format:'url' 返回火山 TOS 签名 URL（ark-acg-cn-beijing.tos-cn-beijing.volces.com），
 *   从 github.io 源二次 fetch 该 URL 被 CORS 拦死（无 Access-Control-Allow-Origin）。
 *   无后台浏览器直连架构下 URL 模式不可行。改用 response_format:'b64_json'（真机 curl 实锤 HTTP 200，
 *   响应结构 { output: [{ bytesBase64 }] }、JPEG、无 mimeType 字段），不再二次跨源 fetch。
 */
import { mapHttpError } from '../lib/sse';
import { NetworkError } from '../errors';
import type { ImageGenResult, ImageConfig, ImageProvider } from './types';

export interface ImageGenOptions {
  size?: string;
  quality?: 'high' | 'medium' | 'low' | 'auto';
  signal?: AbortSignal;  // D-08：真取消，透传给 fetch
}

export class AihubmixImageClient implements ImageProvider {
  async generate(
    prompt: string,
    config: ImageConfig,
    options?: ImageGenOptions,
  ): Promise<ImageGenResult> {
    const modelId = config.model;
    const base = config.baseURL.replace(/\/$/, '');  // 'https://aihubmix.com'

    if (modelId.startsWith('doubao')) {
      return this._generateDoubao(prompt, modelId, base, config.apiKey, options);
    }
    if (modelId.startsWith('gpt-image')) {
      return this._generateGptImage2(prompt, base, config.apiKey, options);
    }
    if (modelId.startsWith('gemini')) {
      return this._generateGemini(prompt, modelId, base, config.apiKey, options);
    }
    throw new NetworkError(`未知生图 model: ${modelId}`);
  }

  // ─── doubao ───────────────────────────────────────────────────────────────
  private async _generateDoubao(
    prompt: string,
    modelId: string,
    base: string,
    apiKey: string,
    options?: ImageGenOptions,
  ): Promise<ImageGenResult> {
    const url = `${base}/v1/models/doubao/${modelId}/predictions`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,   // T-14-01: apiKey 仅此处
        },
        body: JSON.stringify({
          input: {
            prompt,
            size: '2K',
            sequential_image_generation: 'disabled',
            stream: false,
            response_format: 'b64_json',  // CORS 修复：直接拿 base64，不返回跨源 TOS URL
            watermark: true,
          },
        }),
        signal: options?.signal,  // D-08：真取消
      });
    } catch {
      throw new NetworkError('doubao 生图请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    // b64_json 模式响应结构（真机 curl 实锤）：{ output: [{ bytesBase64 }] }
    // output 是数组、每项只有 bytesBase64、无 mimeType 字段（解码确认是 JPEG，magic ffd8ffe0）
    const json = await resp.json() as { output?: Array<{ bytesBase64?: string }> };
    const bytesBase64 = json.output?.[0]?.bytesBase64;
    if (!bytesBase64) throw new NetworkError('doubao 响应未包含 base64 数据');

    // doubao 返回 JPEG，响应无 mimeType 字段 → 默认 image/jpeg
    return { base64: bytesBase64, mimeType: 'image/jpeg' };
  }

  // ─── gpt-image-2 ──────────────────────────────────────────────────────────
  private async _generateGptImage2(
    prompt: string,
    base: string,
    apiKey: string,
    options?: ImageGenOptions,
  ): Promise<ImageGenResult> {
    const url = `${base}/v1/models/openai/gpt-image-2/predictions`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,   // T-14-01
        },
        body: JSON.stringify({
          input: {
            prompt,
            size: '1024x1024',
            n: 1,
            quality: 'high',
            moderation: 'low',
            background: 'auto',
          },
        }),
        signal: options?.signal,  // D-08：真取消
      });
    } catch {
      throw new NetworkError('gpt-image-2 生图请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    // Pitfall 2: output 是对象（{b64_json, urls}），不是数组！
    const json = await resp.json() as {
      output?: {
        b64_json?: Array<{ bytesBase64?: string; mimeType?: string }>;
      };
    };
    const first = json.output?.b64_json?.[0];
    if (!first?.bytesBase64) throw new NetworkError('gpt-image-2 响应未包含 base64 数据');

    // mimeType 规范化：'png' → 'image/png'（Open Question 2）
    const rawMime = first.mimeType ?? 'png';
    const mimeType = normalizeMimeType(rawMime);

    return { base64: first.bytesBase64, mimeType };
  }

  // ─── gemini ───────────────────────────────────────────────────────────────
  private async _generateGemini(
    prompt: string,
    modelId: string,
    base: string,
    apiKey: string,
    options?: ImageGenOptions,
  ): Promise<ImageGenResult> {
    const url = `${base}/gemini/v1beta/models/${modelId}:streamGenerateContent`;
    let resp: Response;
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,   // T-14-01: Google 鉴权模式，非 Bearer
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: '1:1', imageSize: '1k' },
          },
        }),
        signal: options?.signal,  // D-08：真取消
      });
    } catch {
      throw new NetworkError('gemini 生图请求网络失败');
    }

    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw mapHttpError(resp.status, errBody);
    }

    // gemini 响应是 JSON 数组（多 chunk），图片可能在任意 chunk 的 parts 里
    const chunks = await resp.json() as unknown[];
    return parseGeminiChunks(chunks);
  }
}

// ─── 内部 helper ──────────────────────────────────────────────────────────────

/**
 * Gemini JSON 数组多 chunk 遍历，找到含 inlineData 的 part（D-03）
 * 跳过只含 thoughtSignature 的 part（~1.5M 字符）
 */
function parseGeminiChunks(chunks: unknown[]): { base64: string; mimeType: string } {
  type GeminiPart = {
    inlineData?: { data: string; mimeType: string };
    thoughtSignature?: string;
    text?: string;
  };
  type GeminiChunk = {
    candidates?: Array<{
      content?: { parts?: GeminiPart[] };
    }>;
  };

  for (const chunk of chunks as GeminiChunk[]) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? [];
    for (const part of parts) {
      // D-03: 找到含 inlineData.data 的 part；跳过只含 thoughtSignature/text 的 part
      if (part.inlineData?.data) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }
  }
  throw new NetworkError('gemini 响应未找到 inlineData 图片数据');
}

/** mimeType 规范化：'png' → 'image/png'，'jpeg'/'jpg' → 'image/jpeg'（Open Question 2） */
function normalizeMimeType(raw: string): string {
  if (raw.startsWith('image/')) return raw;
  const map: Record<string, string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    webp: 'image/webp',
  };
  return map[raw.toLowerCase()] ?? `image/${raw.toLowerCase()}`;
}
