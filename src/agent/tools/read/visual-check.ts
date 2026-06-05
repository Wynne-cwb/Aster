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

// ==============================================================
// UAT-10 Blocker B：等待懒加载预览面板挂载
// SlidePreviewPanel 是 lazy(() => import('./SlidePreviewPanel'))，只在其 chunk 加载
// + mount 后的 useLayoutEffect 里才 registerPreviewElement。agent 在 apply_slide_layout
// 返回后立刻调 visual_check_slide——此时懒面板可能尚未挂载完，_previewElementGetter() 还是 null。
// 改为轮询等待：每 150ms 探一次，最多 5000ms；一旦拿到非 null 元素即停，再 settle 400ms
// 让面板渲染完形状再让 html2canvas 截图。全程仍 null（如对任意现存页跑自查、永不挂面板）
// → 保留原 skip advisory。
// ==============================================================
const PREVIEW_WAIT_TIMEOUT_MS = 5000; // 轮询等待预览面板挂载的总上限
const PREVIEW_POLL_INTERVAL_MS = 150; // 每次轮询间隔
const PREVIEW_SETTLE_MS = 400; // 拿到元素后让面板渲染完形状的安定延时

const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));

/**
 * 轮询等待预览面板 DOM 元素就绪。每 PREVIEW_POLL_INTERVAL_MS 探一次，
 * 最多等 PREVIEW_WAIT_TIMEOUT_MS；拿到非 null 立即返回；超时仍 null 则返回 null。
 */
async function waitForPreviewElement(): Promise<HTMLElement | null> {
  // 先同步探一次（面板已挂载时零延迟命中，不浪费一个 poll interval）
  let el = _previewElementGetter();
  if (el) return el;
  let waited = 0;
  while (waited < PREVIEW_WAIT_TIMEOUT_MS) {
    await sleep(PREVIEW_POLL_INTERVAL_MS);
    waited += PREVIEW_POLL_INTERVAL_MS;
    el = _previewElementGetter();
    if (el) return el;
  }
  return null;
}

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

  // UAT-10 Blocker B：轮询等待懒面板挂载（≤5s）+ settle（~0.4s）+ html2canvas + vision API
  // 往返，整体可超 15s 默认 dispatch 超时（TOOL_TIMEOUT_MS）→ 提到 40s 安全上限防误杀。
  timeoutMs: 40_000,

  async execute({ slideIndex }, _ctx): Promise<ToolResult> {
    // 1. 轮询等待预览面板 DOM 元素就绪（懒加载面板可能尚未挂载完）
    const previewEl = await waitForPreviewElement();
    if (!previewEl) {
      // advisory fallback：等满 5s 仍无预览面板（如对任意现存页跑自查），返回文字 advisory（不崩溃）
      return {
        ok: true,
        data: { summary: '预览面板未打开，视觉自查跳过（仅依据几何自查结果）' },
      };
    }
    // 拿到元素后短暂 settle，让面板渲染完形状再截图
    await sleep(PREVIEW_SETTLE_MS);

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
