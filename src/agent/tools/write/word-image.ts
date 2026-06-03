/**
 * src/agent/tools/write/word-image.ts — generate_word_image 工具（IMG-02 / IMG-03）
 *
 * 产品方向（2026-06-02 用户拍板，反转 D-02 解耦 + 预览确认）：
 *   execute 在 loop 内**直接插入** Word body 末尾（不再 preview_pending、不再等确认卡）。
 *   聊天保留只读缩略图（ImagePreviewCard 只读化），无确认/重新生成/取消按钮。
 *
 * 撤销（走标准 write-tool 路径，单一 undo 记录）：
 *   Word body 插图无法自动撤销 → reverse = noop_inverse（诚实模式，DiffLog 标「不支持自动撤销」）。
 *   loop-helpers 据 reverse 自动 appendOperation。
 *
 * IMG-05：此工具只注册到 Word host（tools/index.ts buildToolsForHost word case）；Excel 不含。
 *
 * 安全约束（T-16-08 / NFR-09）：
 * - KeyInvalidError 路径：error.message 用字面量中文，不 interpolate err.message（防 key 泄漏）
 * - ToolResult.data.thumbnail 是 base64，仅供 UI 只读缩略图消费，绝不进 serializeForStorage（NFR-09 路径 C）
 */
import { AihubmixImageClient } from '../../../providers/aihubmix-image';
import { ProviderRegistry } from '../../../providers/registry';
import { KeyInvalidError } from '../../../errors';
import { storage } from '../../../lib/storage';
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor } from '../../operationLog';
import type { WordAdapter } from '../../../adapters/WordAdapter';
import type { ImageConfig } from '../../../providers/types';

const PREF_IMAGE_GEN_MODEL = 'aster:pref:image-gen-model';

/**
 * 生图慢工具超时（ms）。dispatchTool 默认 15s 会误杀生图：
 * doubao 2K 出图 ~21s（size 只接受 '2K'，固有耗时不可压）、gpt-image-2 high ~90s+。
 * 120s 覆盖二者并留余量；生图非流式、不受 chat P95≤10s 约束。
 */
const IMAGE_GEN_TIMEOUT_MS = 120_000;

export const generateWordImageTool: ToolDef = {
  name: 'generate_word_image',
  kind: 'write',
  timeoutMs: IMAGE_GEN_TIMEOUT_MS,  // 覆盖默认 15s（doubao ~21s 会被默认值误杀）
  description: '根据描述生成一张图片并直接插入当前 Word 文档末尾（inline picture）。' +
    '描述（prompt）请写具体中文，含主体、风格、构图细节——越具体出图质量越好。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '已扩写的中文图片描述（主体/风格/构图，尽量具体）' },
      model_id: { type: 'string', description: '生图模型 ID（可选；默认 doubao-seedream-5.0-lite；可选 gpt-image-2 / gemini-3.1-flash-image-preview）' },
    },
    required: ['prompt'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const prompt = String(a.prompt ?? '');
    return `生成并插入图片（Word）：${prompt.slice(0, 20)}${prompt.length > 20 ? '…' : ''}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const a = args as Record<string, unknown>;
    const prompt = a.prompt as string;
    if (!prompt?.trim()) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ARGS',
          message: '请提供图片描述（prompt）',
          recoverable: true,
          hint: '缺少必填参数 prompt',
        },
      };
    }

    // 读取用户持久选择的 model（D-04）；fallback 到 registry 默认
    const preferredModelId = storage.get<string>(PREF_IMAGE_GEN_MODEL);
    const modelIdFromArgs = a.model_id as string | undefined;
    // 优先级：工具 args > 用户 Settings 持久设置 > registry 默认
    const modelId = modelIdFromArgs ?? preferredModelId ?? undefined;

    // 从 registry 解析 image-gen 配置（读 aihubmix apiKey）
    // image-gen case 不使用 getDefaultLLM（直接读 storage），传虚拟函数即可
    let config: ImageConfig;
    try {
      config = ProviderRegistry.resolve('image-gen', () => { throw new Error('unused'); }) as ImageConfig;
      // 若用户指定了 model，覆盖 config.model
      if (modelId) config = { ...config, model: modelId };
    } catch (err) {
      if (err instanceof KeyInvalidError) {
        // T-16-08：字面量中文，不 interpolate err.message（防 key 从错误链出现）
        return {
          ok: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'aihubmix Key 未配置，请在设置中填写 Key',
            recoverable: false,
            hint: '前往设置 → aihubmix → 填写 API Key',
          },
        };
      }
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: '生图配置解析失败',
          recoverable: false,
          hint: '检查 aihubmix Provider 配置',
        },
      };
    }

    // 调 AihubmixImageClient（生图，非流式）
    let result: { base64: string; mimeType: string };
    try {
      // D-08：传 ctx.signal 实现真取消（B2 已扩展 AihubmixImageClient.generate 支持 signal）
      result = await new AihubmixImageClient().generate(prompt, config, { signal: ctx.signal });
    } catch (err) {
      // 16-05：不再吞错——记 devtools（不进 chat history）+ hint 携带安全错误信息。
      // 我们所有错误类型（NetworkError / mapHttpError / KeyInvalidError）的 message 都是固定
      // 中文字面量、不含 key，所以透传 message 是 key-safe 的（T-16-08 仍满足）。
      console.error('[generate_word_image] 生图失败', err);
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: '图片生成失败，请重试（网络失败或超时）',
          recoverable: true,
          hint: err instanceof Error ? err.message : '可能是网络问题或 model 超时，切换 model 或稍后重试',
        },
      };
    }

    // 直接插入 Word body 末尾（loop 内自动直插，不再等确认卡）
    try {
      await (ctx.adapter as WordAdapter).insertBodyImage(result.base64);  // 裸 base64（spike 确认）
    } catch (err) {
      // T-16-05：不读 err.message，用字面量
      console.error('[generate_word_image] 插入失败', err);
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'Word 图片插入失败，请重试',
          recoverable: true,
          hint: '宿主插图 API 失败；请确认当前文档可编辑',
        },
      };
    }

    // 标准 write-tool reverse 路径（loop-helpers 据此 appendOperation）。
    // Word body 插图无法自动撤销 → noop_inverse 诚实模式（DiffLog 标「不支持自动撤销」）
    const reverse: ReverseDescriptor = {
      tool: 'noop_inverse',
      args: { reason: 'Word 图片插入暂不支持自动撤销' },
    };

    return {
      ok: true,
      data: {
        mimeType: result.mimeType,
        prompt,
        thumbnail: result.base64,  // NFR-09：仅 UI 只读缩略图消费，绝不进 serializeForStorage
        inserted: true,            // ImageResultCard 渲染信号（只读缩略图）
      },
      reverse,
    };
  },
};
