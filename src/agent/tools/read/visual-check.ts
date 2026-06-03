// src/agent/tools/read/visual-check.ts
// Phase 24 PVQ-06：自渲染预览视觉自查工具（read-style，on-demand，铺开路径）
// NFR-09：base64 截图不进 ToolResult.data，只回文字 evidence
import type { ToolDef, ToolResult } from '../index';
import { ProviderRegistry } from '../../../providers/registry';
import { AihubmixVisionClient } from '../../../providers/aihubmix-vision';
import type { VisionConfig } from '../../../providers/aihubmix-vision';
import type { ImageConfig } from '../../../providers/types';
import { useProviderStore } from '../../../store/providers';

// ==============================================================
// previewEl 共享机制（全局 mutable getter，仅一个预览面板实例）
// SlidePreviewPanel 挂载时调用 registerPreviewElement(() => ref.current)
// SlidePreviewPanel 卸载时调用 registerPreviewElement(() => null)
// ==============================================================
let _previewElementGetter: () => HTMLElement | null = () => null;

export function registerPreviewElement(getter: () => HTMLElement | null): void {
  _previewElementGetter = getter;
}

/** 仅供测试 mock 用（清理状态）*/
export function _resetPreviewElementGetter(): void {
  _previewElementGetter = () => null;
}

// ==============================================================
// Focus prompt（自查 4 项，中文，对齐 geometry-check 语义）
// ==============================================================
const FOCUS_PROMPT = `你是专业 PPT 版面审查助手，只关注以下四项粗粒度问题，逐项输出中文违规说明（无违规则写"无"）：
1. 【溢出】文字是否超出文本框边界（文字被裁切）
2. 【重叠】形状之间是否有明显相互压叠（内容被遮挡）
3. 【留白】版面空白是否过多或分布明显不均
4. 【对比】文字与背景对比是否明显不足、难以辨认
仅输出四项结果，不要其他分析。`;

interface VisualCheckArgs {
  slideIndex: number;
}

export const visualCheckSlide: ToolDef<VisualCheckArgs> = {
  name: 'visual_check_slide',
  kind: 'read', // read tool：无 undo/operationLog/reverse/postState；不进 PPT_TOOLS

  description:
    '对当前幻灯片自渲染预览截图，用多模态模型视觉自查四项版面问题（溢出/重叠/留白/对比），' +
    '返回文字违规反馈。需先调用 apply_slide_layout 使预览面板显示。',

  parameters: {
    type: 'object' as const,
    properties: {
      slideIndex: {
        type: 'number' as const,
        description: '要自查的幻灯片索引（0-based）',
      },
    },
    required: ['slideIndex'],
  },

  humanLabel: (args) => `视觉自查页面 ${args.slideIndex + 1}`,

  async execute({ slideIndex }, _ctx): Promise<ToolResult> {
    // 1. 取预览面板 DOM 元素
    const previewEl = _previewElementGetter();
    if (!previewEl) {
      // advisory fallback：预览面板未注册，直接返回文字 advisory（不崩溃）
      return {
        ok: true,
        data: { summary: '预览面板未打开，视觉自查跳过（仅依据几何自查结果）' },
      };
    }

    // 2. 动态 import html2canvas（懒加载，不进初始 chunk — CONTEXT 硬约束#1）
    const { default: html2canvas } = await import('html2canvas');
    const htmlCanvas = await html2canvas(previewEl, {
      scale: 2, // 高清截图，AI 识别更准
      useCORS: false, // 我方 DOM 无跨域图片
      allowTaint: false, // 默认安全
      logging: false, // 关闭 console 噪音
      backgroundColor: '#ffffff', // 明确白底，与预览容器白底同步
      foreignObjectRendering: false, // canvas-renderer 路径，Office for Web sandbox 更稳定
    });
    // NFR-09：pureBase64 为局部变量，截图后只传给 analyzeImages，不写入 ToolResult.data
    const pureBase64 = htmlCanvas.toDataURL('image/png').split(',')[1];

    // 3. 取 vision 配置（复用 PptAdapter 既有范式）
    // apiKey 仅经 Authorization header，不进 body/error.message（T-24-01 / T-01-04）
    const cfg = ProviderRegistry.resolve(
      'vision',
      () => useProviderStore.getState().providers[0]!,
    ) as ImageConfig;
    const visionConfig: VisionConfig = { baseURL: cfg.baseURL, apiKey: cfg.apiKey };

    // 4. 调 analyzeImages（NFR-09：pureBase64 局部变量，不出此函数边界进 ToolResult）
    const { content } = await new AihubmixVisionClient().analyzeImages(
      FOCUS_PROMPT,
      [{ base64: pureBase64, mimeType: 'image/png' }],
      visionConfig,
    );
    // pureBase64 至此生命周期结束（不写入 ToolResult，自然 GC）

    // 5. 直接返回文字 evidence（NFR-09：data 仅含 summary 文字，无 base64/screenshot 字段）
    return {
      ok: true,
      data: { summary: content },
    };
  },
};
