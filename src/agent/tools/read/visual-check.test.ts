import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// 与 visual-check.ts 内部常量保持一致（内部不导出，测试侧镜像；改源码须同步）
const PREVIEW_POLL_INTERVAL_MS = 150;
const PREVIEW_WAIT_TIMEOUT_MS = 5000;
const PREVIEW_SETTLE_MS = 400;

// ---------------------------------------------------------------------------
// Plan 24-03：已填 execute 真身，skip 解除，5 个用例 GREEN
// UAT-10 Blocker B：新增 (a)(b) 轮询等待预览面板挂载 fake-timer 守门
// 全程 fake timers：execute 内 await sleep(...) 会挂在 setTimeout 上，需 advanceTimersByTimeAsync /
// runAllTimersAsync 驱动；这两个 async timer API 同时 flush 微任务，故被 mock 的 html2canvas /
// analyzeImages（promise-based，非 timer）也能在推进过程中 resolve。
// ---------------------------------------------------------------------------
describe('visualCheckSlide ToolDef（PVQ-06，NFR-09 守门 + UAT-10 轮询等待）', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _resetPreviewElementGetter();
    mockHtml2canvas.mockReset();
    mockAnalyzeImages.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('① 元数据：name=visual_check_slide, kind=read, timeoutMs=40s', () => {
    expect(visualCheckSlide.name).toBe('visual_check_slide');
    expect(visualCheckSlide.kind).toBe('read');
    // UAT-10：覆盖默认 15s dispatch 超时（轮询≤5s + settle + html2canvas + vision 往返）
    expect(visualCheckSlide.timeoutMs).toBe(40_000);
  });

  it('② html2canvas 被调用（mock 截图，面板已挂载）', async () => {
    registerPreviewElement(() => document.createElement('div'));
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,FAKEBASE64==' });
    mockAnalyzeImages.mockResolvedValue({ content: '溢出：无' });
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    await vi.runAllTimersAsync(); // 驱动 settle sleep + 微任务
    await p;
    expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
  });

  it('③ NFR-09 守门：ToolResult.data 不含 base64 字符串', async () => {
    registerPreviewElement(() => document.createElement('div'));
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,' + 'A'.repeat(200) });
    mockAnalyzeImages.mockResolvedValue({ content: '测试 evidence' });
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    await vi.runAllTimersAsync();
    const result = await p;
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
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    await vi.runAllTimersAsync();
    const result = await p;
    const data = result.data as { summary?: string };
    expect(data.summary).toContain(EXPECTED_EVIDENCE);
  });

  it('⑤ previewEl 不存在时返回 advisory（不崩溃，ok:true，含「跳过」）', async () => {
    // getter 默认 null（beforeEach 已 reset，未 registerPreviewElement）
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    await vi.runAllTimersAsync(); // 跑完整轮询窗口（≤5s）后超时返回
    const result = await p;
    expect(result.ok).toBe(true);
    const summaryText = (result.data as { summary?: string })?.summary ?? '';
    expect(summaryText).toMatch(/跳过|未打开/);
    expect(mockHtml2canvas).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // UAT-10 Blocker B 结构守门
  // -------------------------------------------------------------------------
  it('(a) 轮询等待：初始 null，几个 poll interval 后 register → 等待后 PROCEED 截图（非 skip）', async () => {
    mockHtml2canvas.mockResolvedValue({ toDataURL: () => 'data:image/png;base64,SHORT' });
    mockAnalyzeImages.mockResolvedValue({ content: 'VISION-EVIDENCE-文字' });

    // 初始未注册 → _previewElementGetter() 返回 null，工具进入轮询等待
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);

    // 推进两个 poll interval（仍 null）：确认尚未截图，正在等待
    await vi.advanceTimersByTimeAsync(PREVIEW_POLL_INTERVAL_MS * 2);
    expect(mockHtml2canvas).not.toHaveBeenCalled();

    // 现在懒面板「挂载完成」→ 注册真实元素
    registerPreviewElement(() => document.createElement('div'));

    // 跑完剩余 poll（命中元素）+ settle + 截图/vision 微任务
    await vi.runAllTimersAsync();
    const result = await p;

    // 断言：等待后真的 PROCEED 到截图 + vision，data.summary 是 vision 文字而非 skip 串
    expect(mockHtml2canvas).toHaveBeenCalledTimes(1);
    expect(mockAnalyzeImages).toHaveBeenCalledTimes(1);
    const data = result.data as { summary?: string };
    expect(data.summary).toBe('VISION-EVIDENCE-文字');
    expect(data.summary).not.toMatch(/跳过|未打开/);
  });

  it('(b) 轮询超时：全程 null → ~5s 后返回 skip advisory（不截图）', async () => {
    // 永不注册元素 → getter 始终 null
    const p = visualCheckSlide.execute({ slideIndex: 0 }, {} as never);
    let settled = false;
    void p.then(() => {
      settled = true;
    });

    // 中途（3s < 5s）：仍在等待，未 settle、未截图
    await vi.advanceTimersByTimeAsync(3000);
    expect(settled).toBe(false);
    expect(mockHtml2canvas).not.toHaveBeenCalled();

    // 推进越过 5s 总超时窗口
    await vi.advanceTimersByTimeAsync(PREVIEW_WAIT_TIMEOUT_MS - 3000 + PREVIEW_POLL_INTERVAL_MS * 2);
    const result = await p;

    expect(result.ok).toBe(true);
    const summaryText = (result.data as { summary?: string })?.summary ?? '';
    expect(summaryText).toBe('预览面板未打开，视觉自查跳过（仅依据几何自查结果）');
    expect(mockHtml2canvas).not.toHaveBeenCalled();
    expect(mockAnalyzeImages).not.toHaveBeenCalled();
  });
});
