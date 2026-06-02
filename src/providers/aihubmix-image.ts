/**
 * AihubMix 生图客户端 — 三路 response 解析器（MDL-01）
 *
 * 安全约束（T-14-01）：
 *   - apiKey 仅注入 Authorization / x-goog-api-key header，不进 request body
 *   - apiKey 不出现在 error.message（mapHttpError 固定字面量 message）
 *   - doubao 签名 URL 在 provider 内立即 fetch→base64→丢弃，不外泄（D-02，T-14-02）
 *
 * Wire format 来源：.planning/spikes/011-image-gen-api-formats/findings.md（真机实测）
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
            response_format: 'url',
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

    const json = await resp.json() as { output?: Array<{ url?: string }> };
    const imageUrl = json.output?.[0]?.url;
    if (!imageUrl) throw new NetworkError('doubao 响应未包含图片 URL');

    // D-02: 立即 fetch→base64→丢弃 URL（TTL 风险 + Office.js 只吃 base64）
    return fetchUrlToBase64(imageUrl, options?.signal);
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
 * doubao 签名 URL → 裸 base64（D-02）
 * 用 arrayBuffer 路径（浏览器标准，无 FileReader 回调复杂度）
 * 注意：btoa 只接受 Latin-1，需先逐字节转字符串（A3）
 */
async function fetchUrlToBase64(imageUrl: string, signal?: AbortSignal): Promise<{ base64: string; mimeType: string }> {
  let imgResp: Response;
  try {
    imgResp = await fetch(imageUrl, { signal });  // D-08：真取消透传
  } catch {
    // Pitfall 4: CORS 拦截会抛 TypeError，此处统一转 NetworkError
    throw new NetworkError('doubao 图片 URL 下载失败（可能 CORS 限制，建议切换 gpt-image-2 或 gemini）');
  }
  if (!imgResp.ok) throw new NetworkError(`doubao 图片 URL 获取失败（${imgResp.status}）`);

  const contentType = imgResp.headers.get('content-type') ?? 'image/png';
  const mimeType = contentType.split(';')[0].trim();

  const buf = await imgResp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // btoa 不接受 multi-byte，需逐字节 fromCharCode（A3）
  let binary = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return { base64: btoa(binary), mimeType };
}

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
