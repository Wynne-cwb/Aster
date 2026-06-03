import { describe, it, expect, vi } from 'vitest';
import { visualCheckSlide } from './visual-check';

// mock 用 vi.hoisted 避免顶层变量提升问题（STATE L112 决策）
const { mockHtml2canvas, mockAnalyzeImages } = vi.hoisted(() => ({
  mockHtml2canvas: vi.fn(),
  mockAnalyzeImages: vi.fn(),
}));

vi.mock('html2canvas', () => ({ default: mockHtml2canvas }));
vi.mock('../../../providers/aihubmix-vision', () => ({
  AihubmixVisionClient: vi.fn().mockImplementation(() => ({
    analyzeImages: mockAnalyzeImages,
  })),
}));

// ---------------------------------------------------------------------------
// describe.skip：Plan 24-03 实现 visual_check_slide execute 真身后解除 skip
// 注：24-03 实现时会引入 registerPreviewElement getter 注入机制；
//     届时解除 skip 并按真实 previewEl 注入 API 调整以下 mock setup（见 24-03 read_first）。
// ---------------------------------------------------------------------------
describe.skip('visualCheckSlide ToolDef（PVQ-06，NFR-09 守门）', () => {
  it('① 元数据：name=visual_check_slide, kind=read', () => {
    expect(visualCheckSlide.name).toBe('visual_check_slide');
    expect(visualCheckSlide.kind).toBe('read');
  });

  it('② html2canvas 被调用（mock 截图）', async () => {
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,FAKEBASE64==' });
    mockAnalyzeImages.mockResolvedValue({ content: '溢出：无' });
    // 24-03 实现后：registerPreviewElement(() => document.createElement('div'))
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    void result;
    expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
  });

  it('③ NFR-09 守门：ToolResult.data 不含 base64 字符串', async () => {
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,' + 'A'.repeat(200) });
    mockAnalyzeImages.mockResolvedValue({ content: '测试 evidence' });
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    // 核心断言：ToolResult.data 序列化后不含 100+ 字符的 base64 串
    expect(JSON.stringify(result.data)).not.toMatch(/[A-Za-z0-9+/]{100,}/);
    expect(result.data).not.toHaveProperty('base64');
    expect(result.data).not.toHaveProperty('screenshot');
  });

  it('④ evidence 文字拼入 result.data.summary', async () => {
    const EXPECTED_EVIDENCE = '溢出：无；重叠：有形状压叠';
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,SHORT' });
    mockAnalyzeImages.mockResolvedValue({ content: EXPECTED_EVIDENCE });
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    expect(result.data).toMatchObject({ summary: expect.stringContaining(EXPECTED_EVIDENCE) });
  });

  it('⑤ previewEl 不存在时返回 advisory（不崩溃，ok:true，含「跳过」）', async () => {
    // 24-03 实现后：registerPreviewElement(() => null)
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    expect(result.ok).toBe(true);
    const summaryText = (result.data as { summary?: string })?.summary ?? '';
    expect(summaryText).toMatch(/跳过|未打开/);
  });
});
