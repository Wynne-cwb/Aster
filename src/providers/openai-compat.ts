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
 *
 * Plan 04（本 plan）：删 v1 INSERT_TO_DOCUMENT_TOOL hardcode；tools 入参全部来自
 *   caller（agent loop → buildToolsForHost → ToolDef[] → OpenAI wire 格式）。
 *   v1 单 tool 路径正式退役。
 */

import type { LLMProvider, LLMConfig, ChatMessage } from './types';
import type { SSEEvent } from '../lib/sse';

/**
 * Plan 03-03：streamChat 可选 tools 入参类型（OpenAI tools wire 格式）。
 * loop.ts 通过 buildToolsForHost 收集到的 ToolDef 转此格式后传入。
 */
export interface OpenAIToolWire {
  type: 'function';
  function: { name: string; description: string; parameters: object };
}
import { streamSSE } from '../lib/sse';
import { singleFlight } from './queue';
import { withRetry } from './retry';
import { AsterError, NetworkError } from '../errors';
import { useProviderStore } from '../store/providers';

export class OpenAICompatibleLLM implements LLMProvider {
  async *streamChat(
    messages: ChatMessage[],
    config: LLMConfig,
    signal: AbortSignal,
    tools?: OpenAIToolWire[],
  ): AsyncGenerator<SSEEvent> {
    try {
      // 通过单飞队列序列化同 Provider 请求
      // withRetry 包裹在 singleFlight 内部（429/503 自动重试）
      const gen = await singleFlight(config.providerId, () =>
        withRetry(() => this._startStream(messages, config, signal, tools)),
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
    tools?: OpenAIToolWire[],
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
    // Plan 04：caller-supplied tools only；INSERT_TO_DOCUMENT_TOOL v1 hardcode 路径已删。
    // shouldAttachTools=false（Provider 曾探测失败）或 tools 空 → body 不含 tools。
    if (shouldAttachTools && tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    // 返回 generator（singleFlight 需要 Promise<T>，所以包在 async 函数里）
    const gen = streamSSE(url, body, signal);
    return Promise.resolve(gen);
  }
}
