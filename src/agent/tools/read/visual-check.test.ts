import { describe, it, expect, vi, beforeEach } from 'vitest';
import { visualCheckSlide, registerPreviewElement, _resetPreviewElementGetter } from './visual-check';

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
// ProviderRegistry.resolve('vision') 返回 {baseURL, apiKey, model, providerId}
vi.mock('../../../providers/registry', () => ({
  ProviderRegistry: { resolve: () => ({ baseURL: 'https://x', apiKey: 'k', model: 'm', providerId: 'aihubmix-vision' }) },
}));
// useProviderStore mock（ProviderRegistry.resolve 内部的 getDefaultLLM stub）
vi.mock('../../../store/providers', () => ({
  useProviderStore: { getState: () => ({ providers: [{ id: 'aihubmix', baseURL: 'https://x', model: 'm' }] }) },
}));

// ---------------------------------------------------------------------------
// Plan 24-03：已填 execute 真身，skip 解除，5 个用例转 GREEN
// ---------------------------------------------------------------------------
describe('visualCheckSlide ToolDef（PVQ-06，NFR-09 守门）', () => {
  beforeEach(() => {
    _resetPreviewElementGetter();
    mockHtml2canvas.mockReset();
    mockAnalyzeImages.mockReset();
  });

  it('① 元数据：name=visual_check_slide, kind=read', () => {
    expect(visualCheckSlide.name).toBe('visual_check_slide');
    expect(visualCheckSlide.kind).toBe('read');
  });

  it('② html2canvas 被调用（mock 截图）', async () => {
    registerPreviewElement(() => document.createElement('div'));
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,FAKEBASE64==' });
    mockAnalyzeImages.mockResolvedValue({ content: '溢出：无' });
    await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
  });

  it('③ NFR-09 守门：ToolResult.data 不含 base64 字符串', async () => {
    registerPreviewElement(() => document.createElement('div'));
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,' + 'A'.repeat(200) });
    mockAnalyzeImages.mockResolvedValue({ content: '测试 evidence' });
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    // 核心断言：ToolResult.data 序列化后不含 100+ 字符的 base64 串
    expect(JSON.stringify(result.data)).not.toMatch(/[A-Za-z0-9+/]{100,}/);
    expect(result.data).not.toHaveProperty('base64');
    expect(result.data).not.toHaveProperty('screenshot');
  });

  it('④ evidence 文字拼入 result.data.summary', async () => {
    registerPreviewElement(() => document.createElement('div'));
    const EXPECTED_EVIDENCE = '溢出：无；重叠：有形状压叠';
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,SHORT' });
    mockAnalyzeImages.mockResolvedValue({ content: EXPECTED_EVIDENCE });
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    const data = result.data as { summary?: string };
    expect(data.summary).toContain(EXPECTED_EVIDENCE);
  });

  it('⑤ previewEl 不存在时返回 advisory（不崩溃，ok:true，含「跳过」）', async () => {
    // getter 默认 null（beforeEach 已 reset，未 registerPreviewElement）
    const result = await visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    expect(result.ok).toBe(true);
    const summaryText = (result.data as { summary?: string })?.summary ?? '';
    expect(summaryText).toMatch(/跳过|未打开/);
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });
});
