/**
 * src/agent/tools/read/tools.test.ts — 11 read tool ToolDef 单测（Task 1 TDD）
 *
 * 验证：
 *   1. buildToolsForHost 三宿主返回正确数量与名称
 *   2. 每个 read tool execute 调 adapter.read + 返回 wrapReadResult 包装的 result_type/source
 *   3. kind 字段正确（read tool = 'read', appendParagraph = 'write'）
 *   4. result_type 分类正确（metadata / document_content）
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildToolsForHost, type ToolDef, type ToolExecContext } from '../index';
import type { DocumentAdapter, ReadableResult } from '../../../adapters/DocumentAdapter';

// ——— mock adapter ———
function makeAdapter(readResult: ReadableResult): DocumentAdapter {
  return {
    read: vi.fn().mockResolvedValue(readResult),
    getSelection: vi.fn(),
    onSelectionChanged: vi.fn(),
    capabilities: vi.fn().mockReturnValue({ host: 'word', supportedInserts: [], supportsSelectionEvents: false }),
    insert: vi.fn(),
  } as unknown as DocumentAdapter;
}

function makeCtx(adapter: DocumentAdapter): ToolExecContext {
  return {
    adapter,
    runId: 'test-run',
    stepIndex: 1,
    signal: new AbortController().signal,
  };
}

const OK_RESULT: ReadableResult = { ok: true, data: { test: 'value' } };
const ERR_RESULT: ReadableResult = {
  ok: false,
  error: { code: 'HOST_API_FAILED', message: '失败', recoverable: false, hint: '重试' },
};

// ——— Word host ———
describe('buildToolsForHost("word")', () => {
  it('返回 21 个工具（5 read + 15 write + selection_detail）', () => {
    // Phase 11：新增 batch_write（BATCH-01）→ 合计 16；Phase 15：新增 get_shape_image → 合计 17
    // Phase 16：新增 generate_word_image（IMG-02）→ 合计 18
    // Phase 18：新增 search_and_insert_stock_image（LIB-02）→ 合计 19
    // Phase 27：新增 set_word_list_format（WORD-07）+ insert_word_comment（WORD-08）→ 合计 21
    const tools = buildToolsForHost('word');
    expect(tools).toHaveLength(21);
  });

  it('包含正确的 tool 名称', () => {
    const tools = buildToolsForHost('word');
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_document_full_text');
    expect(names).toContain('get_paragraph_count');
    expect(names).toContain('get_paragraph_at');
    expect(names).toContain('get_document_outline');
    expect(names).toContain('get_shape_image'); // Phase 15 VIS-01
    expect(names).toContain('selection_detail');
    expect(names).toContain('append_paragraph');
    expect(names).toContain('insert_paragraph');
    expect(names).toContain('replace_paragraph');
    expect(names).toContain('insert_text_at_cursor');
    expect(names).toContain('replace_selection');
  });

  it('read tool kind === "read"，write tool kind === "write"', () => {
    const tools = buildToolsForHost('word');
    const readTool = tools.find((t) => t.name === 'get_paragraph_count')!;
    const writeTool = tools.find((t) => t.name === 'append_paragraph')!;
    expect(readTool.kind).toBe('read');
    expect(writeTool.kind).toBe('write');
  });

  it('get_document_full_text execute → result_type = document_content', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_document_full_text')!;
    const result = await tool.execute({}, makeCtx(adapter));
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('document.full_text');
  });

  it('get_paragraph_count execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_paragraph_count')!;
    const result = await tool.execute({}, makeCtx(adapter));
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('document.paragraph_count');
  });

  it('get_paragraph_at execute → result_type = document_content，source 含 index', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_paragraph_at')!;
    const result = await tool.execute({ index: 2 }, makeCtx(adapter));
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('paragraph_2');
  });

  it('get_document_outline execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_document_outline')!;
    const result = await tool.execute({}, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('document.outline');
  });

  it('get_paragraph_count humanLabel 返中文', () => {
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_paragraph_count')! as ToolDef<unknown>;
    expect(tool.humanLabel({})).toContain('段落');
  });

  it('adapter.read 失败时 execute 透传错误', async () => {
    const adapter = makeAdapter(ERR_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'get_paragraph_count')!;
    const result = await tool.execute({}, makeCtx(adapter));
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('HOST_API_FAILED');
  });
});

// ——— Excel host ———
describe('buildToolsForHost("excel")', () => {
  it('返回 20 个工具（4 read + 15 write + 1 跨宿主 selection）', () => {
    // Phase 11：新增 batch_write（BATCH-01）→ 合计 19；Phase 15：新增 get_shape_image → 合计 20
    const tools = buildToolsForHost('excel');
    expect(tools).toHaveLength(20);
  });

  it('包含正确的 tool 名称', () => {
    const tools = buildToolsForHost('excel');
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_worksheets');
    expect(names).toContain('get_range_values');
    expect(names).toContain('get_used_range_summary');
    expect(names).toContain('get_shape_image'); // Phase 15 VIS-01
    expect(names).toContain('selection_detail');
    // Phase 5 Plan 07：新增 write tool
    expect(names).toContain('set_range_values');
  });

  it('list_worksheets execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('excel');
    const tool = tools.find((t) => t.name === 'list_worksheets')!;
    const result = await tool.execute({}, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('workbook.worksheets');
  });

  it('get_range_values execute → result_type = document_content', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('excel');
    const tool = tools.find((t) => t.name === 'get_range_values')!;
    const result = await tool.execute({ address: 'A1:B2' }, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('range_A1:B2');
  });

  it('get_used_range_summary execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('excel');
    const tool = tools.find((t) => t.name === 'get_used_range_summary')!;
    const result = await tool.execute({}, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('used_range.summary');
  });

  it('read tool kind === "read"；write tool kind === "write"', () => {
    const tools = buildToolsForHost('excel');
    // Phase 10 Wave 2 追加 4 个新 write 工具；Phase 11 追加 batch_write
    const writeToolNames = new Set([
      'set_range_values', 'apply_formula', 'insert_chart', 'set_cell',
      'format_excel_range', 'set_column_row_size', 'set_auto_filter',
      'add_conditional_format', 'create_table', 'freeze_panes',
      'sort_range', 'excel_find_and_replace', 'manage_worksheet', 'set_chart_title',
      'batch_write', // Phase 11 BATCH-01
    ]);
    const readTools = tools.filter((t) => !writeToolNames.has(t.name) && t.name !== 'selection_detail');
    for (const tool of readTools) {
      expect(tool.kind).toBe('read');
    }
    const writeTools = tools.filter((t) => writeToolNames.has(t.name));
    for (const tool of writeTools) {
      expect(tool.kind).toBe('write');
    }
  });
});

// ——— PPT host ———
describe('buildToolsForHost("ppt")', () => {
  it('返回 24 个工具（7 read + 16 write + 1 selection_detail）', () => {
    // Phase 10 各工具 → 合计 17；Phase 11：新增 batch_write（BATCH-01）→ 合计 18
    // Phase 15：新增 get_shape_image read tool → 合计 19
    // Phase 16：新增 generate_ppt_image（IMG-01）→ 合计 20
    // Phase 18：新增 search_and_insert_stock_image（LIB-02）→ 合计 21
    // Phase 22：新增 check_slide_layout read tool（PVQ-02）→ 合计 22
    // Phase 23：新增 apply_slide_layout write tool（PVQ-03，第 16 个 write）→ 合计 23
    // Phase 24：新增 visual_check_slide read tool（PVQ-06，铺开路径，PVQ06_VISUAL_CHECK_ENABLED=true）→ 合计 24
    const tools = buildToolsForHost('ppt');
    expect(tools).toHaveLength(24);
  });

  it('包含正确的 tool 名称', () => {
    const tools = buildToolsForHost('ppt');
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_slides');
    expect(names).toContain('get_slide');
    expect(names).toContain('list_shapes_on_slide');
    expect(names).toContain('get_shape');
    expect(names).toContain('selection_detail');
    // Phase 5 Plan 07：新增 write tool
    expect(names).toContain('insert_slide');
    // Phase 15 VIS-01/VIS-02：新增 get_shape_image read tool
    expect(names).toContain('get_shape_image');
    // Phase 22 PVQ-02：新增 check_slide_layout read tool
    expect(names).toContain('check_slide_layout');
    // Phase 23 PVQ-03：新增 apply_slide_layout write tool（盖印章建整页）
    expect(names).toContain('apply_slide_layout');
    // Phase 24 PVQ-06：新增 visual_check_slide read tool（视觉自查，不进 PPT_TOOLS）
    expect(names).toContain('visual_check_slide');
  });

  it('check_slide_layout execute → result_type=metadata，含违规 summary（Phase 22 PVQ-02）', async () => {
    const adapter = makeAdapter({ ok: true, data: { slideIndex: 1, shapes: [
      { id: 'a', type: 'TextBox', left: 50, top: 50, width: 100, height: 100 },
      { id: 'b', type: 'TextBox', left: 60, top: 60, width: 100, height: 100 },
    ] } });
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'check_slide_layout')!;
    expect(tool.kind).toBe('read');
    const res = await tool.execute({ slideIndex: 1 }, makeCtx(adapter));
    expect(res.ok).toBe(true);
    const data = res.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('slide_1.layout_check');
    expect(String(data.content)).toContain('版面自查'); // formatViolations summary 进了 wire content
  });

  it('list_slides execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'list_slides')!;
    const result = await tool.execute({}, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('presentation.slides');
  });

  it('get_slide execute → result_type = document_content，source 含 slideIndex', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'get_slide')!;
    const result = await tool.execute({ slideIndex: 3 }, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('slide_3');
  });

  it('list_shapes_on_slide execute → result_type = metadata', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'list_shapes_on_slide')!;
    const result = await tool.execute({ slideIndex: 1 }, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('metadata');
    expect(data.source).toBe('slide_1.shapes');
  });

  it('get_shape execute → result_type = document_content', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'get_shape')!;
    const result = await tool.execute({ slideIndex: 2, shapeId: 'sh1' }, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('slide_2.shape_sh1');
  });

  it('read tool kind === "read"；write tool kind === "write"', () => {
    const tools = buildToolsForHost('ppt');
    // Phase 6 + Phase 10 Wave 3a + Wave 4 + Phase 11 所有 write tools
    const PPT_WRITE_TOOLS = [
      'insert_slide', 'set_shape_property', 'move_shape', 'set_shape_text',
      'set_shape_text_font', 'add_shape', 'copy_slide',
      // Wave 4 新增
      'set_shape_text_alignment', 'delete_shape', 'rotate_shape', 'manage_slides', 'set_slide_background',
      'batch_write', // Phase 11 BATCH-01
      'generate_ppt_image', // Phase 16 IMG-01
      'search_and_insert_stock_image', // Phase 18 LIB-02
      'apply_slide_layout', // Phase 23 PVQ-03
    ];
    const readTools = tools.filter((t) => !PPT_WRITE_TOOLS.includes(t.name) && t.name !== 'selection_detail');
    for (const tool of readTools) {
      expect(tool.kind).toBe('read');
    }
    const writeTools = tools.filter((t) => PPT_WRITE_TOOLS.includes(t.name));
    for (const tool of writeTools) {
      expect(tool.kind).toBe('write');
    }
  });
});

// ——— selection_detail 跨宿主 ———
describe('selection_detail (跨宿主)', () => {
  it('execute → result_type = document_content，source = selection', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('word');
    const tool = tools.find((t) => t.name === 'selection_detail')!;
    const result = await tool.execute({}, makeCtx(adapter));
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('selection');
  });

  it('adapter.read 以 kind=selection_detail 调用', async () => {
    const adapter = makeAdapter(OK_RESULT);
    const tools = buildToolsForHost('ppt');
    const tool = tools.find((t) => t.name === 'selection_detail')!;
    await tool.execute({}, makeCtx(adapter));
    expect(adapter.read).toHaveBeenCalledWith({ kind: 'selection_detail' });
  });
});
