/**
 * src/agent/tools/write/ppt-image.ts — generate_ppt_image 工具（IMG-01）
 *
 * D-02 解耦：execute 只调 AihubmixImageClient.generate，返回 preview_pending:true；
 * 不写文档、reverse=undefined。插入由预览卡按钮触发 insertImage helper。
 * D-03：prompt 由 agent 已扩写好传入（工具 description 中说明）。
 * IMG-05：此工具只注册到 PPT host（tools/index.ts buildToolsForHost ppt case）。
 *
 * 安全约束（T-16-08）：
 * - KeyInvalidError 路径：error.message 用字面量中文，不 interpolate err.message（防 key 泄漏）
 * - ToolResult.data.base64 只在内存态（UIPreviewCard 消费），不进 serializeForStorage（NFR-09 路径 C）
 */
import { AihubmixImageClient } from '../../../providers/aihubmix-image';
import { ProviderRegistry } from '../../../providers/registry';
import { KeyInvalidError } from '../../../errors';
import { storage } from '../../../lib/storage';
import type { ToolDef, ToolResult } from '../index';
import type { ImageConfig } from '../../../providers/types';

const PREF_IMAGE_GEN_MODEL = 'aster:pref:image-gen-model';

export const generatePptImageTool: ToolDef = {
  name: 'generate_ppt_image',  // snake_case，须加入 PPT_TOOLS Set（tools/index.ts）
  kind: 'write',
  description: '根据描述生成一张图片，准备插入当前 PPT 幻灯片（生成后弹出预览，用户确认后才实际插入）。' +
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
    return `生成图片：${prompt.slice(0, 20)}${prompt.length > 20 ? '…' : ''}`;
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
    } catch {
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: '图片生成失败，请重试（网络失败或超时）',
          recoverable: true,
          hint: '可能是网络问题或 model 超时，切换 model 或稍后重试',
        },
      };
    }

    // D-02：不写文档，只返回 base64 预览数据（内存态，不进 serializeForStorage，NFR-09 路径 C）
    return {
      ok: true,
      data: {
        base64: result.base64,        // NFR-09：UI 层消费，不进 serializeForStorage
        mimeType: result.mimeType,
        prompt,
        preview_pending: true,        // ImagePreviewCard 渲染信号（Plan 16-05）
      },
      // reverse: undefined — 生图工具本身不写文档；插入动作的 reverse 由 insertImage helper 的 appendOperation 设置
    };
  },
};
