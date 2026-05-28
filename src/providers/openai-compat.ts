/**
 * src/providers/openai-compat.ts — OpenAI-compatible LLM 客户端（PROV-02）
 *
 * 服务 DeepSeek（deepseek-v4-flash / deepseek-v4-pro）和用户自定义 Provider。
 * 实现 LLMProvider 接口，所有方法 async，error 包裹为 AsterError 子类。
 *
 * 关键约束：
 * - 不引入任何 LLM SDK（PROV-10 / tech stack 硬约束）
 * - apiKey 永不出现在 error.message（T-01-04）
 * - setupVisibilityAbort 在 chatStore（02-05）调用，NOT 在此文件——
 *   原因：chatStore 持有 AbortController，openai-compat 只接受 AbortSignal
 * - AbortError 静默处理（用户停止或 Task Pane 隐藏）
 */

import type { LLMProvider, LLMConfig, ChatMessage } from './types';
import type { SSEEvent } from '../lib/sse';
import { streamSSE } from '../lib/sse';
import { singleFlight } from './queue';
import { withRetry } from './retry';
import { AsterError, NetworkError } from '../errors';
import { useProviderStore } from '../store/providers';

// ---------------------------------------------------------------------------
// D-17 INSERT_TO_DOCUMENT_TOOL schema（G-05，字段名/enum/required 按协议不可改）
// ---------------------------------------------------------------------------

export const INSERT_TO_DOCUMENT_TOOL = {
  type: 'function',
  function: {
    name: 'insert_to_document',
    description: '把一段文本写回当前 Office 文档（光标处或选中区域）',
    parameters: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: '要写入文档的纯文本内容',
        },
        position: {
          type: 'string',
          enum: ['cursor', 'replace_selection', 'append_end'],
          description: 'cursor=光标处；replace_selection=替换选区；append_end=追加到文档末尾',
        },
      },
      required: ['text', 'position'],
    },
  },
} as const;

export class OpenAICompatibleLLM implements LLMProvider {
  async *streamChat(
    messages: ChatMessage[],
    config: LLMConfig,
    signal: AbortSignal,
  ): AsyncGenerator<SSEEvent> {
    try {
      // 通过单飞队列序列化同 Provider 请求
      // withRetry 包裹在 singleFlight 内部（429/503 自动重试）
      const gen = await singleFlight(config.providerId, () =>
        withRetry(() => this._startStream(messages, config, signal)),
      );
      yield* gen;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        // 用户停止或 Task Pane 隐藏——不报错，中断生成
        return;
      }

      // D-18 G-05：4xx 错误体含 'tool' / 'function' / 'not supported' 关键字 → 标记 supportsToolCall=false
      if (e instanceof AsterError && (e as unknown as Record<string, unknown>).errBody) {
        const bodyStr = JSON.stringify((e as unknown as Record<string, unknown>).errBody).toLowerCase();
        if (/tool|function[_ ]calls?|not supported/i.test(bodyStr)) {
          useProviderStore.getState().setSupportsToolCall(config.providerId, false);
        }
      }

      // G-07 防御：AsterError（含 KeyInvalidError / NetworkError 及其它 6 类）原样上抛
      // instanceof 比 duck typing 'code' in e 更强语义（防 NodeJS 风格 ERR_NETWORK 误判）
      if (e instanceof AsterError) throw e;
      // 非 AsterError、非 AbortError 才兜底为 NetworkError（T-01-04：不含 Key）
      throw new NetworkError('网络请求异常，请检查连接');
    }
  }

  private _startStream(
    messages: ChatMessage[],
    config: LLMConfig,
    signal: AbortSignal,
  ): Promise<AsyncGenerator<SSEEvent>> {
    const url = `${config.baseURL.replace(/\/$/, '')}/chat/completions`;

    // D-18 G-05：探测语义——默认挂载 tools；若曾探测失败（supportsToolCall===false）则不带
    const providers = useProviderStore.getState().providers;
    const me = providers.find((p) => p.id === config.providerId);
    const shouldAttachTools = me?.supportsToolCall !== false;

    const body: Record<string, unknown> = {
      apiKey: config.apiKey,
      model: config.model,
      messages,
    };
    if (shouldAttachTools) {
      body.tools = [INSERT_TO_DOCUMENT_TOOL];
    }

    // 返回 generator（singleFlight 需要 Promise<T>，所以包在 async 函数里）
    const gen = streamSSE(url, body, signal);
    return Promise.resolve(gen);
  }
}
