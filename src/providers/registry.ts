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
// D-09：更新过时常量 gpt-4o → gpt-5.1（备选 gemini-3.5-flash）
// 注：vision/image-gen 真实调用路径在 Phase 6 接入，本 phase 仅更新常量
const AIHUBMIX_VISION_MODEL = 'gpt-5.1';
// D-09：更新过时常量 gpt-image-1 → gpt-image-2（备选 gemini-3.1-flash-image-preview）
const AIHUBMIX_IMAGE_MODEL = 'gpt-image-2';
const AIHUBMIX_PROVIDER_ID = 'aihubmix';

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
          baseURL: AIHUBMIX_BASE_URL,
          apiKey,
          model: AIHUBMIX_IMAGE_MODEL,
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
