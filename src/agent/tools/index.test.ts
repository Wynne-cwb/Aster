import { describe, it, expect, vi } from 'vitest';
import { buildToolsForHost, dispatchTool, type ToolDef, type ToolExecContext } from './index';

describe('ToolDef interface (AGENT-08 TS 强制)', () => {
  it.each(['word', 'excel', 'ppt'] as const)(
    'buildToolsForHost(%s) returns Array (not Map)',
    (host) => {
      expect(Array.isArray(buildToolsForHost(host))).toBe(true);
    },
  );

  it('Phase 3：所有返回的 ToolDef 必须有 humanLabel function (AGENT-08 humanLabel required)', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      for (const tool of buildToolsForHost(host)) {
        expect(typeof tool.humanLabel).toBe('function');
        expect(typeof tool.execute).toBe('function');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
      }
    }
  });

  it('Phase 27: buildToolsForHost("word") 含 23 个工具（5 read + 17 write + selection_detail）', () => {
    // Phase 11 新增 batch_write (BATCH-01) → 合计 16；Phase 15 新增 get_shape_image → 合计 17
    // Phase 16 新增 generate_word_image (IMG-02) → 合计 18
    // Phase 18 新增 search_and_insert_stock_image (LIB-02) → 合计 19
    // Phase 27 Wave 2 新增 set_word_list_format (WORD-07) + insert_word_comment (WORD-08) → 合计 21
    // Phase 27 Wave 3 新增 set_word_header_footer (WORD-09) + edit_table_cell (WORD-10) → 合计 23
    const tools = buildToolsForHost('word');
    expect(tools).toHaveLength(23);
    const names = tools.map((t) => t.name);
    expect(names).toContain('append_paragraph');
    expect(names).toContain('insert_paragraph');
    expect(names).toContain('replace_paragraph');
    expect(names).toContain('insert_text_at_cursor');
    expect(names).toContain('replace_selection');
    expect(names).toContain('set_word_character_format');
    expect(names).toContain('set_word_paragraph_format');
    expect(names).toContain('apply_paragraph_style');
    expect(names).toContain('find_and_replace');
    expect(names).toContain('insert_table');
    expect(names).toContain('generate_word_image');
    expect(names).toContain('search_and_insert_stock_image');
    expect(names).toContain('get_document_full_text');
    expect(names).toContain('selection_detail');
  });

  it('Phase 28: buildToolsForHost("excel") 含 22 个工具（4 read + 17 write + selection_detail）', () => {
    // Phase 11 新增 batch_write (BATCH-01) → 合计 19；Phase 15 新增 get_shape_image → 合计 20
    // Phase 28 Wave 2 新增 merge_cells + remove_duplicates → 合计 22
    const tools = buildToolsForHost('excel');
    expect(tools).toHaveLength(22);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_worksheets');
    expect(names).toContain('selection_detail');
    expect(names).toContain('set_range_values');
    expect(names).toContain('apply_formula');
    expect(names).toContain('insert_chart');
    expect(names).toContain('set_cell');
    expect(names).toContain('sort_range');
    expect(names).toContain('excel_find_and_replace');
    expect(names).toContain('manage_worksheet');
    expect(names).toContain('set_chart_title');
  });

  it('Phase 24: buildToolsForHost("ppt") 含 24 个工具（7 read + 16 write + 1 selection）', () => {
    // Phase 6/10 各工具 → 合计 17；Phase 11 新增 batch_write (BATCH-01) → 合计 18
    // Phase 15 新增 get_shape_image → 合计 19；Phase 16 新增 generate_ppt_image (IMG-01) → 合计 20
    // Phase 18 新增 search_and_insert_stock_image (LIB-02) → 合计 21
    // Phase 22 新增 check_slide_layout read tool (PVQ-02) → 合计 22
    // Phase 23 新增 apply_slide_layout write tool (PVQ-03，第 16 个 write) → 合计 23
    // Phase 24 新增 visual_check_slide read tool (PVQ-06，PVQ06_VISUAL_CHECK_ENABLED=true) → 合计 24
    const tools = buildToolsForHost('ppt');
    expect(tools).toHaveLength(24);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_slides');
    expect(names).toContain('selection_detail');
    expect(names).toContain('insert_slide');
    expect(names).toContain('set_shape_property');
    expect(names).toContain('move_shape');
    expect(names).toContain('set_shape_text');
    expect(names).toContain('set_shape_text_font');
    expect(names).toContain('add_shape');
    expect(names).toContain('copy_slide');
    // Wave 4 新增工具
    expect(names).toContain('set_shape_text_alignment');
    expect(names).toContain('delete_shape');
    expect(names).toContain('rotate_shape');
    expect(names).toContain('manage_slides');
    expect(names).toContain('set_slide_background');
    // Phase 16 新增生图工具
    expect(names).toContain('generate_ppt_image');
    // Phase 18 新增图库检索插入工具
    expect(names).toContain('search_and_insert_stock_image');
    // Phase 22 新增版面自查 read 工具
    expect(names).toContain('check_slide_layout');
    // Phase 23 新增盖印章建整页 write 工具
    expect(names).toContain('apply_slide_layout');
    // Phase 24 新增视觉自查 read 工具（不进 PPT_TOOLS，on-demand）
    expect(names).toContain('visual_check_slide');
  });
});

// 真机 UAT 实证防御：LLM 一次并行发起多个 tool_call → 大量 PowerPoint.run 在 Office for Web
// 卡死不返回，没有超时会让 agent loop 无限冻死（真机观测：8 并行 get_slide 冻 5 分钟）。
// dispatchTool 必须对卡住的 tool 调用超时降级为可恢复 HOST_API 错误，不能无限挂起。
describe('dispatchTool — 单 tool 调用超时保护（防真机 host 卡死冻 UI）', () => {
  const ctx: ToolExecContext = {
    adapter: {} as never,
    runId: 'run-1',
    stepIndex: 1,
    signal: new AbortController().signal,
  };

  it('execute 永不 resolve（host 卡死）→ 超时后返回可恢复 HOST_API_FAILED，而非无限挂起', async () => {
    vi.useFakeTimers();
    try {
      const hangingTool = {
        name: 'hang_tool',
        description: '',
        parameters: {},
        humanLabel: () => '卡住的工具',
        execute: () => new Promise<never>(() => {}), // 永不 settle，模拟 host 卡死
        kind: 'read',
      } as unknown as ToolDef;

      const p = dispatchTool({ id: 'c1', name: 'hang_tool', arguments: {} }, ctx, [hangingTool]);
      // 推进到超时阈值之后
      await vi.advanceTimersByTimeAsync(15_001);
      const result = await p;

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('HOST_API_FAILED');
      expect(result.error?.recoverable).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('execute 在超时前 resolve → 正常返回，超时不误触发', async () => {
    vi.useFakeTimers();
    try {
      const fastTool = {
        name: 'fast_tool',
        description: '',
        parameters: {},
        humanLabel: () => '快工具',
        execute: () => Promise.resolve({ ok: true, data: { v: 1 } }),
        kind: 'read',
      } as unknown as ToolDef;

      const result = await dispatchTool({ id: 'c2', name: 'fast_tool', arguments: {} }, ctx, [fastTool]);
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ v: 1 });
    } finally {
      vi.useRealTimers();
    }
  });

  // 16-05 真机 UAT 修复：生图慢工具（doubao 2K ~21s / gpt-image-2 high ~90s+）默认 15s 误杀。
  // ToolDef.timeoutMs 覆盖默认值，让慢工具在自身阈值内完成。
  it('def.timeoutMs 覆盖默认 15s：慢工具在 21s resolve（>15s 默认、<120s 覆盖）→ 正常返回', async () => {
    vi.useFakeTimers();
    try {
      // 模拟 doubao 21s 出图：execute 在 21s 后 resolve
      const slowImageTool = {
        name: 'slow_image_tool',
        description: '',
        parameters: {},
        humanLabel: () => '慢生图工具',
        timeoutMs: 120_000, // 覆盖默认 15s
        execute: () =>
          new Promise<{ ok: true; data: unknown }>((resolve) => {
            setTimeout(() => resolve({ ok: true, data: { base64: 'fake' } }), 21_000);
          }),
        kind: 'write',
      } as unknown as ToolDef;

      const p = dispatchTool({ id: 'c3', name: 'slow_image_tool', arguments: {} }, ctx, [slowImageTool]);
      // 推进 21s（超过默认 15s，但远小于 120s 覆盖值）
      await vi.advanceTimersByTimeAsync(21_001);
      const result = await p;

      // 覆盖生效：21s resolve 不被默认 15s 误杀
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ base64: 'fake' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('def.timeoutMs 短覆盖：工具按自身值超时（5s 覆盖 → 6s 卡死被自身阈值杀）', async () => {
    vi.useFakeTimers();
    try {
      const shortTimeoutTool = {
        name: 'short_timeout_tool',
        description: '',
        parameters: {},
        humanLabel: () => '短超时工具',
        timeoutMs: 5_000, // 覆盖为更短的 5s
        execute: () => new Promise<never>(() => {}), // 永不 settle
        kind: 'read',
      } as unknown as ToolDef;

      const p = dispatchTool({ id: 'c4', name: 'short_timeout_tool', arguments: {} }, ctx, [shortTimeoutTool]);
      // 推进到 5s 覆盖阈值之后（但小于 15s 默认）→ 应已超时
      await vi.advanceTimersByTimeAsync(5_001);
      const result = await p;

      expect(result.ok).toBe(false);
      expect(result.error?.code).toBe('HOST_API_FAILED');
    } finally {
      vi.useRealTimers();
    }
  });
});
