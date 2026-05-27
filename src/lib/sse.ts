/**
 * src/lib/sse.ts — SSE 解析器（PROV-06 / NFR-03）
 *
 * 约 40 行原生 fetch + ReadableStream，服务所有 LLM 流式请求。
 * 无任何 LLM SDK 依赖（技术栈硬约束）。
 *
 * 安全约束（T-02-04 / T-02-05）：
 * - apiKey 从 body 副本取出后注入 Authorization header，不进入请求体 JSON
 * - 所有 mapHttpError message 使用固定中文字符串，不插入 apiKey 变量
 */

import {
  AsterError,
  KeyInvalidError,
  QuotaExceededError,
  ContextTooLongError,
  NetworkError,
  RateLimitError,
  ContentFilterError,
  ModelNotFoundError,
} from '../errors';

// ---------------------------------------------------------------------------
// 公共类型
// ---------------------------------------------------------------------------

export interface SSEDelta {
  type: 'delta';
  content: string;
}

export interface SSEUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export type SSEEvent = SSEDelta | SSEUsage;

// ---------------------------------------------------------------------------
// mapHttpError — HTTP 状态 → AsterError 子类
// ---------------------------------------------------------------------------

/**
 * 将 HTTP 错误状态映射为对应的 AsterError 子类。
 *
 * @param status           HTTP 响应状态码
 * @param errBody          响应体 JSON（可能为 {}）
 * @param retryAfterSeconds Retry-After header 解析结果（秒数，仅 429 有效）
 */
export function mapHttpError(
  status: number,
  errBody: unknown,
  retryAfterSeconds?: number,
): AsterError {
  // 检查 body 是否含内容过滤关键词（用于 400/422）
  const bodyStr = JSON.stringify(errBody ?? '').toLowerCase();
  const isContentFilter = bodyStr.includes('content_policy') || bodyStr.includes('filter');

  switch (status) {
    case 401:
      return new KeyInvalidError('API Key 无效，请前往设置更新 Key');
    case 402:
      return new QuotaExceededError('账户余额不足，请前往 Provider 充值');
    case 404:
      return new ModelNotFoundError('模型不存在，请在设置中检查模型名称');
    case 422:
      if (isContentFilter) {
        return new ContentFilterError('内容被过滤，请修改输入内容');
      }
      return new ContextTooLongError('内容过长，请减少选区或切换更大模型');
    case 400:
      if (isContentFilter) {
        return new ContentFilterError('内容被过滤，请修改输入内容');
      }
      return new NetworkError('请求参数错误，请检查设置');
    case 429:
      return new RateLimitError('请求过快，稍后自动重试', retryAfterSeconds);
    case 503:
      return new NetworkError('服务繁忙，稍后自动重试');
    default:
      return new NetworkError('网络错误，请检查连接');
  }
}

// ---------------------------------------------------------------------------
// streamSSE — 异步生成器，逐字 yield SSEDelta；流结束前 yield SSEUsage
// ---------------------------------------------------------------------------

/**
 * 发送 OpenAI-compatible Chat Completions 流式请求，逐事件 yield。
 *
 * 内部自动注入：
 *   stream: true
 *   stream_options: { include_usage: true }
 *
 * apiKey 从 body.apiKey 提取后注入 Authorization header；
 * 发送的请求体 JSON 不含 apiKey（T-02-04）。
 *
 * @param url    完整 API endpoint URL
 * @param body   请求参数（含 apiKey / model / messages 等）
 * @param signal AbortController.signal（用于取消请求）
 */
export async function* streamSSE(
  url: string,
  body: object,
  signal: AbortSignal,
): AsyncGenerator<SSEEvent> {
  // 从 body 副本中取出 apiKey，不放入请求体（T-02-04）
  const { apiKey, ...rest } = body as Record<string, unknown>;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey as string}`,
    },
    body: JSON.stringify({
      ...rest,
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal,
  });

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    // 尝试从响应头解析 Retry-After（用于 429）
    const retryAfterRaw = (resp as Response & { headers?: { get?: (h: string) => string | null } }).headers?.get?.('Retry-After');
    const retryAfterSec = retryAfterRaw != null ? Number(retryAfterRaw) : undefined;
    throw mapHttpError(resp.status, errBody, Number.isFinite(retryAfterSec) ? retryAfterSec : undefined);
  }

  const reader = resp.body!.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      // 跳过不以 "data:" 开头的行（含 ": keep-alive" 注释行）
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();

      // [DONE] 标志流结束
      if (data === '[DONE]') return;

      // 空 data 跳过
      if (!data) continue;

      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string } }>;
          usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
        };

        // usage chunk（stream_options.include_usage: true 时，[DONE] 前额外发一个）
        if (chunk.usage && chunk.usage.total_tokens != null) {
          yield {
            type: 'usage',
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          };
        }

        // delta chunk
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          yield { type: 'delta', content };
        }
      } catch {
        // 畸形 JSON 静默忽略（防止 keep-alive 或 malformed chunk 中断流）
      }
    }
  }
}
