/**
 * src/providers/registry.ts — ProviderRegistry 路由表（PROV-04）
 *
 * ProviderRegistry.resolve(taskKind, getDefaultLLM) 将任务类型映射到
 * 对应 Provider 的运行时配置（LLMConfig 或 ImageConfig）。
 *
 * 设计原则（PROV-04）：无自动 fallback——resolve 失败直接抛错，
 * 由 UI 层展示对应的错误气泡。
 *
 * 依赖注入模式：getDefaultLLM 由 providerStore 注入，避免直接 import
 * Zustand store 造成循环依赖（store → registry → store）。
 *
 * 安全约束（T-02-09）：apiKey 从 storage 读取后仅存在 LLMConfig/ImageConfig
 * 对象中，不序列化到日志，只传给 Provider 客户端放入 Authorization header。
 */

import type { LLMConfig, ImageConfig, TaskKind, ProviderConfig } from './types';
import { ModelNotFoundError, KeyInvalidError } from '../errors';
import { storage, STORAGE_KEYS } from '../lib/storage';

// ---------------------------------------------------------------------------
// 内置 aihubmix 配置（Phase 0 spike #4 锁定视觉/生图路径）
// ---------------------------------------------------------------------------

const AIHUBMIX_BASE_URL = 'https://api.aihubmix.com/v1';
// D-06（Phase 14）：vision model 更新为 gpt-5.4（2026-06-01 /v1/models 实测确认可用）
// 推翻旧值 gpt-5.1；比 todos.md L28 的 gpt-5.2 更新一代（质量 >> 成本原则）
export const AIHUBMIX_VISION_MODEL = 'gpt-5.4';
// 生图专用 base host（无 /v1 后缀）。Pitfall: 勿与 AIHUBMIX_BASE_URL 混用。
// D-05/D-07（Phase 14）：生图走 predictions 独立目录，URL 路由在 aihubmix-image.ts
const AIHUBMIX_IMAGE_BASE_URL = 'https://aihubmix.com';
const AIHUBMIX_PROVIDER_ID = 'aihubmix';

// ---------------------------------------------------------------------------
// 生图 model 列表（D-05）——供 image-gen resolve 路由 + Phase 16 picker 消费
// ---------------------------------------------------------------------------

/** 生图模型元数据（D-05）——供 image-gen resolve 路由 + Phase 16 picker 消费 */
export interface ImageGenModel {
  id: string;
  label: string;
  /** 决定 URL 模板和 request body 结构 */
  endpointKind: 'predictions' | 'gemini';
  /** 决定 Authorization header 形式 */
  authKind: 'bearer' | 'goog-api-key';
  isDefault: boolean;
}

export const IMAGE_GEN_MODELS: ImageGenModel[] = [
  {
    id: 'doubao-seedream-5.0-lite',
    label: 'Doubao SeedDream 5.0 Lite（快速默认）',
    endpointKind: 'predictions',
    authKind: 'bearer',
    isDefault: true,
    // D-07: doubao 不在 /v1/models 清单，但走 predictions 独立目录，spike 011 真打 HTTP 200
  },
  {
    id: 'gpt-image-2',
    label: 'GPT-Image-2（高质量）',
    endpointKind: 'predictions',
    authKind: 'bearer',
    isDefault: false,
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Gemini 3.1 Flash Image Preview',
    endpointKind: 'gemini',
    authKind: 'goog-api-key',
    isDefault: false,
  },
];

/** 默认生图 model = doubao-seedream-5.0-lite（最快，满足 P95≤10s，D-05） */
export const DEFAULT_IMAGE_GEN_MODEL = IMAGE_GEN_MODELS.find((m) => m.isDefault)!;

// ---------------------------------------------------------------------------
// ProviderRegistry
// ---------------------------------------------------------------------------

export class ProviderRegistry {
  /**
   * 解析 taskKind 到对应的 Provider 配置。
   * 无自动 fallback（PROV-04）：resolve 失败直接抛错，由 UI 层展示错误气泡。
   *
   * @param taskKind     任务类型
   * @param getDefaultLLM 返回当前默认 LLM Provider 配置（由 providerStore 注入，避免循环依赖）
   * @returns LLMConfig（chat/short-task）或 ImageConfig（vision/image-gen）
   * @throws KeyInvalidError — apiKey 未配置
   * @throws ModelNotFoundError — stock-image 未配置 / 未知 taskKind
   */
  static resolve(
    taskKind: TaskKind,
    getDefaultLLM: () => ProviderConfig,
  ): LLMConfig | ImageConfig {
    switch (taskKind) {
      case 'chat':
      case 'short-task': {
        const providerCfg = getDefaultLLM();
        const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + providerCfg.id);
        if (!apiKey) {
          throw new KeyInvalidError('API Key 未配置，请在设置中填写 Key');
        }
        return {
          providerId: providerCfg.id,
          baseURL: providerCfg.baseURL,
          apiKey,
          model: providerCfg.model,
        } satisfies LLMConfig;
      }

      case 'vision': {
        const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
        if (!apiKey) {
          throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
        }
        return {
          providerId: `${AIHUBMIX_PROVIDER_ID}-vision`,
          baseURL: AIHUBMIX_BASE_URL,
          apiKey,
          model: AIHUBMIX_VISION_MODEL,
        } satisfies ImageConfig;
      }

      case 'image-gen': {
        const apiKey = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + AIHUBMIX_PROVIDER_ID);
        if (!apiKey) {
          throw new KeyInvalidError('aihubmix Key 未配置，请在设置中填写 aihubmix Key');
        }
        return {
          providerId: `${AIHUBMIX_PROVIDER_ID}-image`,
          baseURL: AIHUBMIX_IMAGE_BASE_URL,
          apiKey,
          model: DEFAULT_IMAGE_GEN_MODEL.id,
        } satisfies ImageConfig;
      }

      case 'stock-image':
        throw new ModelNotFoundError('stock-image Provider 未配置（v1 不含图库）');

      default: {
        const _exhaustive: never = taskKind;
        throw new ModelNotFoundError(`未知 taskKind: ${String(_exhaustive)}`);
      }
    }
  }
}
