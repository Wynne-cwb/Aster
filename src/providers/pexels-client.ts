/**
 * src/providers/pexels-client.ts — Pexels 公开图库 REST client（LIB-01）
 *
 * 🔴 鉴权 gotcha（D-10）：Pexels 用 `Authorization: <API_KEY>`（裸 key，无 "Bearer " 前缀）——
 *   区别于 aihubmix/openai 的 `Authorization: Bearer <key>`。照抄 Bearer 范式会得 401。
 * 安全（T-14-01 / T-18-01 继承）：apiKey 仅进 Authorization header，不进 body、不 interpolate 进 error.message。
 *   catch 块用 `catch {}`（不绑 err），错误用中文字面量，不拼 err / status / body，防 key 泄漏。
 * 0 净新增运行时依赖：native fetch + FileReader（不装 pexels / unsplash-js npm 包）。
 */
import { NetworkError, RateLimitError } from '../errors';

export const PEXELS_DEFAULT_BASE_URL = 'https://api.pexels.com/v1';

export interface PexelsPhoto {
  id: number;
  url: string; // Pexels 图片页（署名链接 LIB-03）
  photographer: string; // 署名（LIB-03）
  photographer_url: string; // 署名链接（LIB-03）
  alt: string; // AI 可据此选最匹配（D-01）
  src: {
    original: string;
    large2x: string; // ~1880px
    large: string; // ~940px，插图主路推荐
    medium: string;
    tiny: string; // ~280px，缩略图（<img src>，不需 base64）
  };
}

export interface PexelsSearchOpts {
  per_page?: number; // 默认 10（D-12）
  page?: number; // 默认 1（翻页 = 换一张 D-05）
  locale?: string; // 'zh-CN'（影响元数据，不影响英文关键词匹配 D-04）
  orientation?: 'landscape' | 'portrait' | 'square';
  signal?: AbortSignal;
}

/** GET /v1/search — 裸 key 鉴权。429 → RateLimitError；网络失败 → NetworkError；其它非 2xx → NetworkError（不泄漏 key）。 */
export async function searchPexels(
  query: string,
  apiKey: string,
  baseURL: string = PEXELS_DEFAULT_BASE_URL,
  opts: PexelsSearchOpts = {},
): Promise<PexelsPhoto[]> {
  const params = new URLSearchParams({
    query, // URLSearchParams 自动编码（V5 输入校验 / T-18-04）
    per_page: String(opts.per_page ?? 10),
    page: String(opts.page ?? 1),
    ...(opts.locale ? { locale: opts.locale } : {}),
    ...(opts.orientation ? { orientation: opts.orientation } : {}),
  });
  let resp: Response;
  try {
    resp = await fetch(`${baseURL}/search?${params.toString()}`, {
      headers: { Authorization: apiKey }, // ⚠️ 裸 key，无 Bearer（D-10）
      signal: opts.signal,
    });
  } catch {
    throw new NetworkError('Pexels 检索网络失败'); // 字面量，不带 err（防 key 泄漏）
  }
  if (resp.status === 429) {
    throw new RateLimitError('Pexels 检索过于频繁，请稍后再试');
  }
  if (!resp.ok) {
    throw new NetworkError('Pexels 检索失败'); // 不 interpolate status/body
  }
  const data = (await resp.json()) as { photos?: PexelsPhoto[] };
  return data.photos ?? [];
}

/** 远程图片 URL → 裸 base64（无 data: 前缀，喂 addImageShape/insertBodyImage）。透传 signal。 */
export async function fetchPexelsImageToBase64(url: string, signal?: AbortSignal): Promise<string> {
  let resp: Response;
  try {
    resp = await fetch(url, { signal });
  } catch {
    throw new NetworkError('Pexels 图片获取失败');
  }
  if (!resp.ok) throw new NetworkError('Pexels 图片获取失败');
  const blob = await resp.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? ''); // 去掉 data: 前缀 → 裸 base64
    reader.onerror = () => reject(new NetworkError('Pexels 图片 base64 转换失败'));
    reader.readAsDataURL(blob);
  });
}
