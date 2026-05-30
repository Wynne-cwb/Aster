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

  it('Phase 6 Plan 07: buildToolsForHost("word") 含 10 个工具（4 read + 5 write + selection_detail）', () => {
    // Phase 6 Plan 07 新增 4 write tools → 合计 10（4 read + 5 write + 1 selection）
    const tools = buildToolsForHost('word');
    expect(tools).toHaveLength(10);
    const names = tools.map((t) => t.name);
    expect(names).toContain('append_paragraph');
    expect(names).toContain('insert_paragraph');
    expect(names).toContain('replace_paragraph');
    expect(names).toContain('insert_text_at_cursor');
    expect(names).toContain('replace_selection');
    expect(names).toContain('get_document_full_text');
    expect(names).toContain('selection_detail');
  });

  it('Phase 6 Plan 08: buildToolsForHost("excel") 含 8 个工具（3 read + 4 write + selection_detail）', () => {
    // Phase 6 Plan 08 新增 applyFormula / insertChart / setCell → 合计 8
    const tools = buildToolsForHost('excel');
    expect(tools).toHaveLength(8);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_worksheets');
    expect(names).toContain('selection_detail');
    expect(names).toContain('set_range_values');
    expect(names).toContain('apply_formula');
    expect(names).toContain('insert_chart');
    expect(names).toContain('set_cell');
  });

  it('Phase 6 Plan 06: buildToolsForHost("ppt") 含 9 个工具（4 read + 4 write + selection_detail）', () => {
    // Phase 6 Plan 06 新增 setShapeProperty / moveShape / setShapeText → 合计 9
    const tools = buildToolsForHost('ppt');
    expect(tools).toHaveLength(9);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_slides');
    expect(names).toContain('selection_detail');
    expect(names).toContain('insert_slide');
    expect(names).toContain('set_shape_property');
    expect(names).toContain('move_shape');
    expect(names).toContain('set_shape_text');
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
});
