// src/agent/tools/read/visual-check.ts — Wave 0 stub（24-03 填真身）
// visual_check_slide read tool（自渲染截图 → vision 自查 → 文字 evidence，NFR-09）
import type { ToolDef, ToolResult } from '../index';

interface VisualCheckArgs {
  slideIndex: number;
}

/** Wave 0 stub：24-03 实现 execute（截图 + vision + NFR-09 守门）。 */
export const visualCheckSlide: ToolDef<VisualCheckArgs> = {
  name: 'visual_check_slide',
  kind: 'read',
  description: 'Wave 0 stub — 24-03 填真身',
  parameters: {
    type: 'object' as const,
    properties: { slideIndex: { type: 'number' as const, description: '幻灯片索引' } },
    required: ['slideIndex'],
  },
  humanLabel: (args) => `视觉自查页面 ${args.slideIndex + 1}`,
  async execute(_args: VisualCheckArgs): Promise<ToolResult> {
    throw new Error('visualCheckSlide.execute not implemented (Wave 0 stub — 24-03 填真身)');
  },
};
