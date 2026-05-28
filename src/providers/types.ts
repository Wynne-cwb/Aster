/**
 * src/providers/types.ts — Provider 层接口契约（PROV-01）
 *
 * 本文件为纯类型文件（无运行时逻辑）。
 * 定义 Aster Provider 层的所有接口、配置类型和 TaskKind 枚举。
 *
 * 设计原则（PROV-04）：ProviderRegistry 路由无自动 fallback——
 * resolve 失败直接抛 ModelNotFoundError，由 UI 层展示 MODEL 错误。
 */

import type { SSEEvent } from '../lib/sse';

// ---------------------------------------------------------------------------
// TaskKind — Provider 路由的任务类型（PROV-04）
// ---------------------------------------------------------------------------

/**
 * TaskKind — 决定由哪个 Provider 处理的任务类型标识。
 * - 'chat' / 'short-task': 路由到用户配置的默认 LLM Provider（DeepSeek 或自定义）
 * - 'vision': 路由到 aihubmix 视觉客户端（Phase 0 spike #4 锁定）
 * - 'image-gen': 路由到 aihubmix 生图客户端（Phase 0 spike #4 锁定）
 * - 'stock-image': 暂未配置（v1 未引入图库 Provider），resolve 直接抛 ModelNotFoundError
 */
export type TaskKind = 'chat' | 'short-task' | 'vision' | 'image-gen' | 'stock-image';

// ---------------------------------------------------------------------------
// 配置类型（LLMConfig / ImageConfig）
// ---------------------------------------------------------------------------

/**
 * LLMConfig — OpenAI-compatible LLM 客户端的运行时配置。
 * 从 providerStore 读取；apiKey 从 storage.get 获取，不存在 ProviderConfig 中（分开存储）。
 */
export interface LLMConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

/**
 * ImageConfig — aihubmix 图像客户端的运行时配置。
 * 固定路由到 aihubmix；baseURL / model 由 registry 内置，apiKey 由 providerStore 读取。
 */
export interface ImageConfig {
  providerId: string;
  baseURL: string;
  apiKey: string;
  model: string;
}

// ---------------------------------------------------------------------------
// 消息类型
// ---------------------------------------------------------------------------

/** ChatMessage — OpenAI-compatible 消息格式 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ---------------------------------------------------------------------------
// Provider 接口（PROV-01）
// ---------------------------------------------------------------------------

/**
 * LLMProvider — 文本生成 Provider 接口（OpenAI-compatible-first）。
 * streamChat 返回 AsyncGenerator，每次 yield SSEDelta（文本片段）或 SSEUsage（用量）。
 */
export interface LLMProvider {
  streamChat(
    messages: ChatMessage[],
    config: LLMConfig,
    signal: AbortSignal,
  ): AsyncGenerator<SSEEvent>;
}

/**
 * ImageProvider — 图像生成 Provider 接口（aihubmix 专用）。
 * generate 返回 base64 图像数据；usage 字段用 aihubmix 的 input_tokens/output_tokens（非标准）。
 */
export interface ImageProvider {
  generate(
    prompt: string,
    size: string,
    quality: 'high' | 'medium' | 'low' | 'auto',
    config: ImageConfig,
  ): Promise<{
    b64_json: string;
    usage?: { input_tokens: number; output_tokens: number; total_tokens: number };
  }>;
}

/**
 * StockImageProvider — 图库搜索 Provider 接口（v1 未配置，声明留作 Phase 4 引入）。
 */
export interface StockImageProvider {
  search(query: string, limit: number): Promise<StockImage[]>;
}

export interface StockImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  attribution: string;
}

// ---------------------------------------------------------------------------
// ProviderConfig（Settings 存储的 Provider 配置，不含 apiKey）
// ---------------------------------------------------------------------------

/**
 * ProviderConfig — 用户配置的 Provider 信息（存入 storage，不含 apiKey）。
 * apiKey 单独存储在 `storage.get(STORAGE_KEYS.KEY_PREFIX + id)`。
 */
export interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  /** 内置 Provider（deepseek / aihubmix）不可删除 */
  isBuiltIn: boolean;
  /** D-18 G-05：null = 未探测（default）/ true = 支持 / false = 曾探测失败，不再带 tools */
  supportsToolCall?: boolean | null;
}
