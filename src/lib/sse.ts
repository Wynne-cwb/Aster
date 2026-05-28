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

/**
 * @deprecated since v2.0 — usage 事件保留兼容 stream_options.include_usage 输出格式，
 *   但 v2 chatStore / agent loop 不消费此字段（cost 全砍，无 budget 估算）。
 *   保留是为了陌生 SSE upstream 不报错；将来若 Provider 强制要求 include_usage:false 可一并移除。
 */
export interface SSEUsage {
  type: 'usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/** G-05 D-17：tool_call 流式 delta（arguments 逐字累积中） */
export interface ToolCallDelta {
  type: 'tool_call_delta';
  /** tool_calls 数组中的 index（>0 表示同一回合多 tool） */
  index: number;
  /** 仅在首 chunk 出现 */
  id?: string;
  /** 仅在首 chunk 出现 */
  name?: string;
  /** 当前 chunk 的 arguments 片段（待累积） */
  argumentsChunk: string;
}

/** G-05 D-17：tool_call 完成事件（finish_reason=tool_calls 时一次性 emit） */
export interface ToolCallEnd {
  type: 'tool_call_end';
  index: number;
  id: string;
  name: string;
  /** 完整累积后的 JSON 字符串（caller 解析） */
  arguments: string;
}

export type SSEEvent = SSEDelta | SSEUsage | ToolCallDelta | ToolCallEnd;

// ---------------------------------------------------------------------------
// sanitizeErrBody — I-09：剥除任何看起来像 apiKey 的字段/值后再挂到 AsterError
// ---------------------------------------------------------------------------

/**
 * I-09：errBody sanitize — 剥除任何看起来像 apiKey 的字段或值后再挂到 AsterError。
 * 防止恶意/有 bug 的 Provider 把请求里的 apiKey 回吐到 errBody，泄漏到 chatStore.errorMessage 与日志。
 *
 * 脱敏规则（递归）：
 * ① 值中含 'sk-' 开头的字符串 → '[REDACTED]'（sk- 模式值匹配）
 * ② 字段名匹配 apiKey / authorization / bearer（大小写不敏感）→ '[REDACTED]'（字段名匹配）
 */
export function sanitizeErrBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  return JSON.parse(
    JSON.stringify(body, (key, val) => {
      // 字段名脱敏：apiKey / api-key / api_key / authorization / bearer
      if (/^(api[_-]?key|authorization|bearer)$/i.test(key)) return '[REDACTED]';
      // 值脱敏：含 'sk-' 前缀的字符串
      if (typeof val === 'string' && /sk-[a-zA-Z0-9]/.test(val)) return '[REDACTED]';
      return val;
    }),
  );
}

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
    case 403:
      return new KeyInvalidError('API Key 权限不足或已被吊销，请前往设置更新 Key');
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
// classifyFetchThrow — fetch throw 路径分类（G-07 / D-28 / D-29）
// ---------------------------------------------------------------------------

/**
 * G-07 / D-28 / D-29：fetch throw 路径分类。
 *
 * 某些浏览器路径（CORS preflight 拒绝、扩展拦截、401 + 无 CORS 头）会让 fetch 抛
 * TypeError 而不是返回 Response。仅靠 TypeError 不能区分「真网络断」与「Key 无效」。
 *
 * 用三条信号判 KEY_INVALID（D-29 fallback 策略，**因无后台无法 ping**）：
 *   ① err 是 TypeError 且 message 包含 'Failed to fetch' / 'NetworkError' / 'Load failed'
 *     （Chrome / Firefox / Safari 不同写法）
 *   ② navigator.onLine === true（浏览器自报网络通）
 *   ③ url 是 https:// 合法 URL（不是 file: / http: / 空）
 *
 * 三条全满足 → KeyInvalidError（措辞「可能无效」而非「100% 错」）。
 * 任一不满足 → NetworkError。
 *
 * @param err 捕获到的 fetch 抛出值
 * @param url 完整的请求 URL（用于提取协议）
 */
export function classifyFetchThrow(err: unknown, url: string): KeyInvalidError | NetworkError {
  // 信号 ①：err 是 TypeError 且 message 含各浏览器标准写法
  const isTypeError =
    err instanceof TypeError &&
    /Failed to fetch|NetworkError|Load failed/i.test(err.message);

  if (!isTypeError) {
    return new NetworkError('网络连接失败，请检查网络');
  }

  // 信号 ②：浏览器自报在线
  const online = typeof navigator !== 'undefined' && navigator.onLine === true;

  // 信号 ③：url 是 https://
  let isHttpsBase = false;
  try {
    const u = new URL(url);
    isHttpsBase = u.protocol === 'https:';
  } catch {
    isHttpsBase = false;
  }

  if (online && isHttpsBase) {
    // 三条信号齐备 → KEY_INVALID（WR-05 措辞更保守：CORS preflight 拒绝时也可触发此路径，
    // 提示用户同时检查 Base URL 与 Key，而非单纯换 Key）
    return new KeyInvalidError('Key 可能无效或 Provider 不允许浏览器直连，请检查 API Key 与 Base URL');
  }

  return new NetworkError('网络连接失败，请检查网络');
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
  // ⚠ I-10：accum 必须在 generator 函数体内声明（每次 invoke 新建 Map），
  // 不能写在模块顶层——并发请求共用同一个 Map 会导致 tool_call id 串污染
  const accum = new Map<number, { id: string; name: string; arguments: string }>();

  // 从 body 副本中取出 apiKey，不放入请求体（T-02-04）
  const { apiKey, ...rest } = body as Record<string, unknown>;

  // G-07：用 try/catch 捕获 fetch throw，区分 KEY_INVALID 与 NETWORK
  let resp: Response;
  try {
    resp = await fetch(url, {
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
  } catch (err) {
    // AbortError 原样上抛（caller 处理：openai-compat 已识别 name==='AbortError'）
    // 注：DOMException 在部分环境不是 instanceof Error，用 .name 检查更兼容
    if (err != null && (err as { name?: string }).name === 'AbortError') throw err;
    // 其余 fetch throw → 分类判断（D-29 三条信号）
    throw classifyFetchThrow(err, url);
  }

  if (!resp.ok) {
    const errBody = await resp.json().catch(() => ({}));
    // 尝试从响应头解析 Retry-After（用于 429）
    const retryAfterRaw = (resp as Response & { headers?: { get?: (h: string) => string | null } }).headers?.get?.('Retry-After');
    const retryAfterSec = retryAfterRaw != null ? Number(retryAfterRaw) : undefined;
    const err = mapHttpError(resp.status, errBody, Number.isFinite(retryAfterSec) ? retryAfterSec : undefined);
    // I-09：sanitize errBody 后挂载到 error（剥除 sk- 值与 apiKey/authorization 字段名）
    (err as unknown as Record<string, unknown>).errBody = sanitizeErrBody(errBody);
    (err as unknown as Record<string, unknown>).httpStatus = resp.status;
    throw err;
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

      // [DONE] 标志流结束（flush 未 emit 的 accum 内容，防止 finish_reason 未到时漏发）
      if (data === '[DONE]') {
        for (const [idx, acc] of accum.entries()) {
          if (acc.id && acc.name) {
            yield { type: 'tool_call_end', index: idx, id: acc.id, name: acc.name, arguments: acc.arguments };
          }
        }
        accum.clear();
        return;
      }

      // 空 data 跳过
      if (!data) continue;

      try {
        const chunk = JSON.parse(data) as {
          choices?: Array<{
            delta?: {
              content?: string;
              tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: string;
                function?: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string | null;
          }>;
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

        // G-05 D-17：tool_calls delta 解析
        const toolCalls = chunk.choices?.[0]?.delta?.tool_calls;
        if (Array.isArray(toolCalls)) {
          for (const tc of toolCalls) {
            const idx = tc.index ?? 0;
            const prev = accum.get(idx) ?? { id: '', name: '', arguments: '' };
            if (tc.id) prev.id = tc.id;
            if (tc.function?.name) prev.name = tc.function.name;
            if (tc.function?.arguments) prev.arguments += tc.function.arguments;
            accum.set(idx, prev);

            yield {
              type: 'tool_call_delta',
              index: idx,
              id: tc.id,
              name: tc.function?.name,
              argumentsChunk: tc.function?.arguments ?? '',
            };
          }
        }

        // G-05 D-17：finish_reason='tool_calls' → flush accum
        if (chunk.choices?.[0]?.finish_reason === 'tool_calls') {
          for (const [idx, acc] of accum.entries()) {
            if (acc.id && acc.name) {
              yield { type: 'tool_call_end', index: idx, id: acc.id, name: acc.name, arguments: acc.arguments };
            }
          }
          accum.clear();
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
