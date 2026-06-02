/**
 * src/agent/tools/write/word-image.ts — generate_word_image 工具（IMG-02）
 *
 * Wave 0 存根：声明导出接口，Plan 16-03 填充完整实现。
 * 测试文件 word-image.test.ts describe.skip 依赖此存根进行 tsc 解析。
 *
 * 完整实现目标（Plan 16-03）：
 *   1. 调 ProviderRegistry.resolve('image-gen', ...) 获取 aihubmix 配置
 *   2. 调 AihubmixImageClient.generate(prompt, config) → { base64, mimeType }
 *   3. 返回 ok:true + data.preview_pending:true + data.base64 + data.mimeType
 *   4. reverse 为 undefined（D-02 解耦：工具本身不写文档，noop_inverse 在 insertImage helper）
 *   5. 错误路径：KeyInvalidError → PERMISSION_DENIED；其余 → HOST_API_FAILED
 */
import type { ToolDef, ToolResult } from '../index';

/** Wave 0 存根：Plan 16-03 实现完整逻辑 */
export const generateWordImageTool: ToolDef = {
  name: 'generate_word_image',
  kind: 'write',
  description: '调用 AI 生成图片并返回预览（base64），等待用户确认后插入 Word 文档末尾。',
  parameters: {
    type: 'object',
    properties: {
      prompt: { type: 'string', description: '图片描述提示词（中文）' },
    },
    required: ['prompt'],
  },
  humanLabel: (args) => {
    const a = args as Record<string, unknown>;
    const prompt = a.prompt as string;
    return `生成图片「${String(prompt).slice(0, 20)}」并预览（Word）`;
  },
  async execute(_args, _ctx): Promise<ToolResult> {
    // Wave 0 存根：Plan 16-03 实现完整逻辑
    throw new Error('generate_word_image: 未实现（Plan 16-03 Wave 1 交付）');
  },
};
