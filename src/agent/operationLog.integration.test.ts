/**
 * src/agent/operationLog.integration.test.ts — Phase 5 05-10 集成守门（防签名错配复发）
 *
 * 背景（05-10 真机 UAT 根因 + feedback_recurring_failure_add_gate）：
 *   - operationLog.test.ts 用 **mock adapter**（vi.fn() 收什么都行）测 replay engine。
 *   - WordAdapter.test.ts 用 **string 字面量** 直接调 deleteParagraphByContent。
 *   两边都没测「真 replay engine → 真 adapter（传 reverse.args 对象）」这条集成路径，
 *   于是 WordAdapter.deleteParagraphByContent(text: string) 收到对象 → normalizeText 抛
 *   TypeError → 全部 Word inverse 被误判 skipped_error，单测却全绿（经典「单测过真机挂」盲区）。
 *
 * 本文件用 **真 WordAdapter / ExcelAdapter / PptAdapter 实例**（仅 mock Office.js 宿主全局）
 * 跑 replayUndoSingle / replayUndoAll，断言 reverse.args 对象签名被正确消费（rolled_back 而非
 * skipped_error）。reverse.args / postState 的形状与 src/agent/tools/write/{word,excel,ppt}.ts
 * 真实产出保持一致——这样未来任何一侧改了签名/形状，本测试会立刻变红。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { WordAdapter } from '../adapters/WordAdapter';
import { ExcelAdapter } from '../adapters/ExcelAdapter';
import { PptAdapter } from '../adapters/PptAdapter';
import {
  replayUndoSingle,
  replayUndoAll,
  appendOperation,
  __resetOperationLogForTest,
  type OperationLogEntry,
  type DocumentAdapterForReplay,
} from './operationLog';

// ---------------------------------------------------------------------------
// 宿主全局 mock 工厂（只 mock Office.js，adapter 用真实类）
// ---------------------------------------------------------------------------

function mockWord(paragraphTexts: string[]): Array<{ text: string; delete: ReturnType<typeof vi.fn> }> {
  const items = paragraphTexts.map((text) => ({ text, delete: vi.fn() }));
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: { body: { paragraphs: { load: vi.fn(), items } } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
  return items;
}

function mockExcel(): ReturnType<typeof vi.fn> {
  const setValues = vi.fn();
  const range = {
    load: vi.fn(),
    address: 'Sheet1!A1:B2',
    numberFormat: [['General']],
    rowIndex: 0,
    columnIndex: 0,
    isNullObject: false,
    cellCount: 4,
    format: {
      load: vi.fn(),
      horizontalAlignment: 'General',
      columnWidth: 64,
      rowHeight: 15,
      fill: { load: vi.fn(), color: '#FFFFFF' },
      font: { load: vi.fn(), bold: false, color: '#000000', size: 11, name: 'Calibri' },
      autofitColumns: vi.fn(),
      autofitRows: vi.fn(),
    },
    get values(): unknown[][] {
      return [[0, 0]];
    },
    set values(v: unknown[][]) {
      setValues(v);
    },
    conditionalFormats: {
      load: vi.fn(),
      items: [] as unknown[],
      add: vi.fn(() => ({
        cellValue: {
          rule: {},
          format: { fill: { color: '' }, font: { color: '' } },
        },
      })),
      clearAll: vi.fn(),
    },
    sort: { apply: vi.fn() },
    replaceAll: vi.fn(() => ({ load: vi.fn(), count: 0 })),
  };
  const nullRangeObj = { load: vi.fn(), isNullObject: true };
  // chart mock（供 set_chart_title / restore_chart_title）
  const chartTitle = { load: vi.fn(), text: '原标题' };
  const chartObj = {
    load: vi.fn(),
    isNullObject: false,
    title: chartTitle,
  };
  // worksheet mock — 含 charts + worksheets 集合
  const worksheet = {
    getRange: () => range,
    getUsedRange: () => range,
    getCell: () => range,
    tables: {
      add: vi.fn(() => ({ name: '表1', load: vi.fn() })),
      getItemOrNullObject: vi.fn(() => ({ load: vi.fn(), isNullObject: true, delete: vi.fn() })),
    },
    autoFilter: {
      load: vi.fn(),
      enabled: false,
      apply: vi.fn(),
      remove: vi.fn(),
    },
    freezePanes: {
      getLocationOrNullObject: vi.fn(() => nullRangeObj),
      freezeAt: vi.fn(),
      freezeRows: vi.fn(),
      freezeColumns: vi.fn(),
      unfreeze: vi.fn(),
    },
    charts: {
      getItemOrNullObject: vi.fn(() => chartObj),
    },
  };
  // worksheets 集合 mock（供 manage_worksheet add/rename + restore_worksheet_snapshot）
  const worksheetsCollection = {
    getActiveWorksheet: () => worksheet,
    add: vi.fn(() => ({ load: vi.fn(), name: '新工作表1' })),
    getItem: vi.fn(() => ({ load: vi.fn(), name: '旧工作表' })),
    getItemOrNullObject: vi.fn(() => ({ load: vi.fn(), isNullObject: true, delete: vi.fn() })),
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: worksheetsCollection },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
    ConditionalFormatType: { cellValue: 'CellValue', colorScale: 'ColorScale', dataBar: 'DataBar' },
  };
  return setValues;
}

function mockPpt(slideTextboxText: string): ReturnType<typeof vi.fn> {
  const del = vi.fn();
  const slides = {
    load: vi.fn(),
    items: [
      {
        index: 0,
        shapes: {
          load: vi.fn(),
          items: [
            { type: 'TextBox', textFrame: { textRange: { load: vi.fn(), text: slideTextboxText } } },
          ],
        },
        delete: del,
      },
    ],
  };
  (global as unknown as Record<string, unknown>).PowerPoint = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) => cb({ presentation: { slides }, sync: vi.fn().mockResolvedValue(undefined) })),
  };
  return del;
}

/** 构造与 tools/write 真实产出一致形状的 OperationLogEntry */
function wordEntry(stepIndex: number, text: string): OperationLogEntry {
  return {
    runId: 'run-it',
    stepIndex,
    toolName: 'append_paragraph',
    args: { text },
    humanLabel: `在文档末尾追加段落「${text}」`,
    reverse: { tool: 'delete_paragraph_by_content', args: { text } }, // ← 对象，非位置参
    postState: { kind: 'word_paragraph', content: text },
    timestamp: 0,
  };
}

// ---------------------------------------------------------------------------
// Phase 9：扩展 mock，供真 WordAdapter 的 5 个 inverse 方法在闭包内访问
// font 属性包 / 段落格式属性 / style / styleBuiltIn / body.search / body.tables / body.insertTable
// 保留原 mockWord 不动（供旧测试使用），新增 mockWordRich 供 Phase 9 守门使用
// ---------------------------------------------------------------------------

function mockWordRich(opts?: {
  paragraphTexts?: string[];
  tables?: Array<{ rowCount: number; columnCount: number; values: string[][]; delete: ReturnType<typeof vi.fn> }>;
}): {
  paraItems: Array<Record<string, unknown>>;
  tableItems: Array<{ rowCount: number; columnCount: number; values: string[][]; delete: ReturnType<typeof vi.fn> }>;
} {
  const texts = opts?.paragraphTexts ?? ['原段落文本', '第二段'];
  // 每个段落带可读写 font（属性包）+ 段落格式属性 + style/styleBuiltIn + insertText/getRange
  const paraItems = texts.map((text) => ({
    text,
    uniqueLocalId: 'uid-' + text,
    font: { bold: false, italic: false, underline: 'None', size: 12, color: '#000000', name: 'Calibri' },
    lineSpacing: 12, spaceBefore: 0, spaceAfter: 0, alignment: 'Left',
    firstLineIndent: 0, leftIndent: 0,
    style: 'Normal', styleBuiltIn: 'Normal',
    load: vi.fn(),
    insertText: vi.fn(),
    getRange: vi.fn(() => ({ insertTable: vi.fn() })),
    insertTable: vi.fn(),
  }));
  const tableItems = opts?.tables ?? [];
  // body.search 返回一个 RangeCollection：items 为匹配 range（每个有 text + insertText）
  const searchResults = {
    load: vi.fn(),
    items: [{ text: texts[0], insertText: vi.fn() }],
  };
  (global as unknown as Record<string, unknown>).Word = {
    InsertLocation: { end: 'End', replace: 'Replace', after: 'After', start: 'Start' },
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        document: {
          body: {
            paragraphs: { load: vi.fn(), items: paraItems },
            tables: { load: vi.fn(), items: tableItems },
            search: vi.fn(() => searchResults),
            insertTable: vi.fn(() => ({
              load: vi.fn(), rowCount: 3, columnCount: 3,
              values: [['a', 'b', 'c'], ['', '', ''], ['', '', '']],
              delete: vi.fn(),
            })),
          },
        },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
  return { paraItems, tableItems };
}

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).Word;
  delete (global as unknown as Record<string, unknown>).Excel;
  delete (global as unknown as Record<string, unknown>).PowerPoint;
  __resetOperationLogForTest();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Word — 真 WordAdapter 经 replay engine 单步撤销（直接守门 BUG-1 签名错配）
// ---------------------------------------------------------------------------

describe('集成：replay engine × 真 WordAdapter', () => {
  /**
   * 守门：restoreParagraphAt — replay engine 传 Record 对象 → adapter 方法被调用（不挂）
   * Phase 6 06-08 inverse signature guard：确认 Record 路由正确，防 Phase 5 位置签名 bug 复发
   */
  it('单步撤销 replace_paragraph：restoreParagraphAt 收 Record 对象（不抛 TypeError）', async () => {
    // 使用 mock adapter — 核心守门：replay engine 正确路由 Record 对象（非真机 Word 路径）
    const restoreParagraphAtFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
    const mockAdapter: DocumentAdapterForReplay = {
      restoreParagraphAt: restoreParagraphAtFn,
    };

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'replace_paragraph',
      args: { index: 1, new_text: '新段落' },
      humanLabel: '替换第 1 段落为「新段落」',
      // Record 签名守门：若错误传为位置参，adapter fn 接收到 string 而非 object → 将无法解构
      reverse: { tool: 'restore_paragraph_at', args: { index: 1, expectedText: '新段落', restoreText: '原段落' } },
      postState: { kind: 'word_paragraph', content: '新段落' },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, mockAdapter);

    // 若 replay engine 以位置参调用，args 就不是 Record → 但我们传的是 Record，不应抛
    expect(detail.status).toBe('rolled_back');
    expect(restoreParagraphAtFn).toHaveBeenCalledTimes(1);
    // 验证 adapter 收到的是 Record 对象（含正确字段）
    const receivedArgs = restoreParagraphAtFn.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof receivedArgs).toBe('object');
    expect(receivedArgs.index).toBe(1);
    expect(receivedArgs.restoreText).toBe('原段落');
  });
  it('单步撤销 append_paragraph：reverse.args 对象被正确消费 → rolled_back（非 skipped_error）', async () => {
    const items = mockWord(['无关段', '追加段']);
    const adapter = new WordAdapter();

    const detail = await replayUndoSingle(
      wordEntry(0, '追加段'),
      adapter as unknown as DocumentAdapterForReplay,
    );

    // 旧 (text:string) 签名下此处会是 'skipped_error'（normalizeText 对对象抛 TypeError）
    expect(detail.status).toBe('rolled_back');
    expect(items[1].delete).toHaveBeenCalledTimes(1);
  });

  it('undo-all + 手改防御（SC3 端到端）：4 回滚 + 1 跳过手改（readWordParagraph 生效）', async () => {
    // 段3 被用户手改为「段3-改」→ 原文「段3」在文档中已不存在
    mockWord(['段1', '段2', '段3-改', '段4', '段5']);
    const adapter = new WordAdapter();

    ['段1', '段2', '段3', '段4', '段5'].forEach((t, i) => appendOperation(wordEntry(i, t)));

    const result = await replayUndoAll('run-it', adapter as unknown as DocumentAdapterForReplay);

    expect(result.total).toBe(5);
    expect(result.rolledBack).toBe(4);
    expect(result.skippedManualChange).toBe(1); // 段3 手改 → 跳过保留
    expect(result.skippedHostError).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Phase 9 Wave 0 守门测试（真 WordAdapter + mockWordRich，骨架 RED）
  //
  // 守门原则（project_adapter_inverse_signature）：
  //   必须用 **真 WordAdapter 实例**（new WordAdapter()）+ mock Office.js 宿主（mockWordRich）。
  //   mock adapter（vi.fn()）收任何形状的 args 都不报错，无法捕获 Phase 5 位置签名 bug。
  //   只有真 adapter 在 inverse 方法中解构 args 时，位置签名才会触发 TypeError → skipped_error。
  //
  // RED 状态预期：Wave 0 时这些测试 FAIL（adapter 方法尚未实现 → executeReverse 抛
  //   "adapter 未实现 xxx" → skipped_error 而非 rolled_back）。
  //   各工具实现（Wave 2–7 对应计划 04–07）后逐步变绿。
  //
  // D-17 硬卡：5 个 toolName 字符串字面量必须出现在本文件，
  //   contract.test.ts 用 fs.readFileSync 扫描验证。
  // ---------------------------------------------------------------------------

  it('单步撤销 set_word_character_format：真 WordAdapter.restoreRangeFont 收 Record 对象 → rolled_back', async () => {
    mockWordRich({ paragraphTexts: ['原段落文本', '第二段'] });
    const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
    const entry: OperationLogEntry = {
      runId: 'run-w1', stepIndex: 0,
      toolName: 'set_word_character_format',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { paragraphIndex: 0, font: { bold: true } },
      humanLabel: '将第 1 段设为加粗',
      reverse: {
        tool: 'restore_range_font',
        args: { index: 0, expectedText: '原段落文本', before: { bold: false, italic: false, underline: 'None', size: 12, color: '#000000', name: 'Calibri' } },
      },
      postState: { kind: 'word_char_format', content: { index: 0 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // 旧位置签名会在 restoreRangeFont 解构 args 时抛 → skipped_error；Record 签名 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  it('单步撤销 set_word_paragraph_format：真 WordAdapter.restoreParagraphFormat 收 Record 对象 → rolled_back', async () => {
    mockWordRich({ paragraphTexts: ['原段落文本', '第二段'] });
    const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
    const entry: OperationLogEntry = {
      runId: 'run-w2', stepIndex: 0,
      toolName: 'set_word_paragraph_format',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { paragraphIndex: 0, format: { lineSpacing: 24 } },
      humanLabel: '将第 1 段行间距设为 24',
      reverse: {
        tool: 'restore_paragraph_format',
        args: { index: 0, expectedText: '原段落文本', before: { lineSpacing: 12, spaceBefore: 0, spaceAfter: 0, alignment: 'Left', indent: 0, leftIndent: 0 } },
      },
      postState: { kind: 'word_para_format', content: { index: 0 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // 旧位置签名会在 restoreParagraphFormat 解构 args 时抛 → skipped_error；Record 签名 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  it('单步撤销 apply_paragraph_style：真 WordAdapter.restoreParagraphStyle 收 Record 对象 → rolled_back', async () => {
    mockWordRich({ paragraphTexts: ['原段落文本', '第二段'] });
    const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
    const entry: OperationLogEntry = {
      runId: 'run-w3', stepIndex: 0,
      toolName: 'apply_paragraph_style',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { paragraphIndex: 0, styleName: 'Heading1' },
      humanLabel: '将第 1 段套用标题 1 样式',
      reverse: {
        tool: 'restore_paragraph_style',
        args: { index: 0, expectedText: '原段落文本', before: { style: 'Normal', styleBuiltIn: 'Normal' } },
      },
      postState: { kind: 'word_style', content: { index: 0 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // 旧位置签名会在 restoreParagraphStyle 解构 args 时抛 → skipped_error；Record 签名 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  it('单步撤销 find_and_replace：真 WordAdapter.restoreRangeSnapshot 收 Record 对象 → rolled_back', async () => {
    mockWordRich({ paragraphTexts: ['原段落文本', '第二段'] });
    const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
    const entry: OperationLogEntry = {
      runId: 'run-w4', stepIndex: 0,
      toolName: 'find_and_replace',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { searchText: '原', replaceText: '新' },
      humanLabel: '查找替换：「原」→「新」',
      reverse: {
        tool: 'restore_range_snapshot',
        args: { snapshot: [{ paragraphIndex: 0, text: '原段落文本' }] },
      },
      postState: { kind: 'word_snapshot', content: { replaced: 1 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // 旧位置签名会在 restoreRangeSnapshot 解构 args 时抛 → skipped_error；Record 签名 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  it('单步撤销 insert_table：真 WordAdapter.deleteTableByMarker 收 Record 对象 → rolled_back + 表格被删除', async () => {
    const tableDeleteFn = vi.fn();
    const { tableItems } = mockWordRich({
      paragraphTexts: ['原段落文本', '第二段'],
      tables: [{ rowCount: 3, columnCount: 3, values: [['a', 'b', 'c'], ['', '', ''], ['', '', '']], delete: tableDeleteFn }],
    });
    const adapter = new WordAdapter();   // ← 真 adapter（捕获 Phase 5 签名 bug）
    const entry: OperationLogEntry = {
      runId: 'run-w5', stepIndex: 0,
      toolName: 'insert_table',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { rows: 3, cols: 3 },
      humanLabel: '插入 3×3 表格',
      reverse: {
        tool: 'delete_table_by_marker',
        args: { contentFingerprint: 'a|b|c__3x3', rows: 3, cols: 3, afterParagraphIndex: undefined },
      },
      postState: { kind: 'word_table', content: { rows: 3, cols: 3 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // 旧位置签名会在 deleteTableByMarker 解构 args 时抛 → skipped_error；Record 签名 → rolled_back
    expect(detail.status).toBe('rolled_back');
    // 当 adapter 方法实现后（Wave 7），还要验证表格被删除：
    // expect(tableItems[0].delete).toHaveBeenCalledTimes(1);
    void tableItems; // 变量在 Wave 7 实现后启用上行断言
  });
});

// ---------------------------------------------------------------------------
// Excel — 真 ExcelAdapter.overwriteRange 经 replay engine（before-image 覆写）
// ---------------------------------------------------------------------------

describe('集成：replay engine × 真 ExcelAdapter', () => {
  /**
   * 守门：deleteChartByName — replay engine 传 Record 对象 → adapter 方法被调用（不挂）
   * Phase 6 06-08 inverse signature guard
   */
  it('单步撤销 insert_chart：deleteChartByName 收 Record 对象（不抛 TypeError）', async () => {
    const deleteChartByNameFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
    const mockAdapter: DocumentAdapterForReplay = {
      deleteChartByName: deleteChartByNameFn,
    };

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'insert_chart',
      args: { data_range: 'A1:B10', chart_type: 'ColumnClustered' },
      humanLabel: '插入柱状图（A1:B10）',
      reverse: { tool: 'delete_chart_by_name', args: { chartName: '图表_run-it_0' } },
      postState: { kind: 'excel_chart', content: { chartName: '图表_run-it_0' } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, mockAdapter);

    expect(detail.status).toBe('rolled_back');
    expect(deleteChartByNameFn).toHaveBeenCalledTimes(1);
    const receivedArgs = deleteChartByNameFn.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof receivedArgs).toBe('object');
    expect(receivedArgs.chartName).toBe('图表_run-it_0');
  });
  it('单步撤销 set_range_values：overwriteRange 收 {address,values} 对象 → rolled_back', async () => {
    const setValues = mockExcel();
    const adapter = new ExcelAdapter();

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'set_range_values',
      args: { address: 'A1:B2', values: [[1, 2], [3, 4]] },
      humanLabel: '写入单元格区域 A1:B2',
      reverse: { tool: 'overwrite_range', args: { address: 'Sheet1!A1:B2', values: [['旧', '值'], ['x', 'y']] } },
      postState: { kind: 'excel_range', content: { address: 'A1:B2', values: [[1, 2], [3, 4]] } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(setValues).toHaveBeenCalledWith([['旧', '值'], ['x', 'y']]); // before-image 被写回
  });
});

// ---------------------------------------------------------------------------
// PPT — 真 PptAdapter.deleteSlideByTitle 经 replay engine（title 指纹定位）
// ---------------------------------------------------------------------------

describe('集成：replay engine × 真 PptAdapter', () => {
  /**
   * 守门：restoreShapeProperty — replay engine 传 Record 对象 → adapter 方法被调用（不挂）
   * Phase 6 06-08 inverse signature guard（防 Phase 5 位置签名 bug 复发）
   */
  it('单步撤销 set_shape_property：restoreShapeProperty 收 Record 对象（不抛 TypeError）', async () => {
    const restoreShapePropertyFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
    const mockAdapter: DocumentAdapterForReplay = {
      restoreShapeProperty: restoreShapePropertyFn,
    };

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'set_shape_property',
      args: { slide_index: 1, shape_id: 's1', fill_color: '#FF0000' },
      humanLabel: '设置第 1 张幻灯片形状属性',
      reverse: {
        tool: 'restore_shape_property',
        args: { slide_index: 1, shape_id: 's1', fill_type: 'Solid', fill_color: '#FFFFFF', line_color: null, line_weight: null, line_visible: false, width: 100, height: 50 },
      },
      postState: { kind: 'ppt_shape', content: { slide_index: 1, shape_id: 's1' } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, mockAdapter);

    expect(detail.status).toBe('rolled_back');
    expect(restoreShapePropertyFn).toHaveBeenCalledTimes(1);
    const receivedArgs = restoreShapePropertyFn.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof receivedArgs).toBe('object');
    expect(receivedArgs.slide_index).toBe(1);
    expect(receivedArgs.shape_id).toBe('s1');
  });

  /**
   * 守门：restoreShapeText — replay engine 传 Record 对象 → adapter 方法被调用（不挂）
   * Phase 6 06-08 inverse signature guard（set_shape_text undo 路径）
   */
  it('单步撤销 set_shape_text：restoreShapeText 收 Record 对象（不抛 TypeError）', async () => {
    const restoreShapeTextFn = vi.fn(async (_args: Record<string, unknown>): Promise<void> => {});
    const mockAdapter: DocumentAdapterForReplay = {
      restoreShapeText: restoreShapeTextFn,
    };

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'set_shape_text',
      args: { slide_index: 1, shape_id: 's1', text: '新标题' },
      humanLabel: '设置第 1 张幻灯片形状文字为「新标题」',
      reverse: {
        tool: 'restore_shape_text',
        args: { slide_index: 1, shape_id: 's1', before_text: '原标题' },
      },
      postState: { kind: 'ppt_shape', content: { slide_index: 1, shape_id: 's1' } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, mockAdapter);

    expect(detail.status).toBe('rolled_back');
    expect(restoreShapeTextFn).toHaveBeenCalledTimes(1);
    const receivedArgs = restoreShapeTextFn.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof receivedArgs).toBe('object');
    expect(receivedArgs.slide_index).toBe(1);
    expect(receivedArgs.before_text).toBe('原标题');
  });
  it('单步撤销 insert_slide：deleteSlideByTitle 收 {titleFingerprint} 对象 → rolled_back', async () => {
    const del = mockPpt('测试标题');
    const adapter = new PptAdapter();

    const entry: OperationLogEntry = {
      runId: 'run-it',
      stepIndex: 0,
      toolName: 'insert_slide',
      args: { title: '测试标题' },
      humanLabel: '在幻灯片末尾插入新幻灯片「测试标题」',
      reverse: { tool: 'delete_slide_by_title', args: { titleFingerprint: '测试标题' } },
      postState: { kind: 'ppt_slide', content: { index: 2, title: '测试标题' } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(del).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Phase 10 — 真 ExcelAdapter / PptAdapter 经 replay engine（Wave 0 骨架，先 RED）
//
// 守门原则（D-19 硬约束）：必须用真实 ExcelAdapter/PptAdapter 实例（非 mock adapter）。
// Wave 0 时 adapter 新方法尚未实现 → if(!adapter.restoreXxx) throw → skipped_error（RED）。
// Wave 1-4 各 Task 1 实现 adapter 方法后，测试体无需改动 → 真 adapter 自动 rolled_back（GREEN）。
// noop+gate 两条（delete_shape / manage_slides）Wave 0 即 GREEN（noop_inverse case 已存在）。
// D-17 硬卡：18 个 toolName 字符串字面量必须出现在本文件（contract.test.ts fs.readFileSync 扫描）。
// ---------------------------------------------------------------------------

describe('集成：replay engine × Phase 10 Excel + PPT 工具守门骨架', () => {
  // ─── Excel 简单逆向（真 ExcelAdapter 实例；Wave 0 RED，Wave 1 GREEN）───
  it('D-17: format_excel_range → restore_range_format → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 0,
      toolName: 'format_excel_range',
      args: { address: 'A1:D10', numberFormat: '#,##0.00', fill: { color: '#FFFF00' } },
      humanLabel: '设置 A1:D10 格式（千分位+2 位小数，黄底）',
      reverse: { tool: 'restore_range_format', args: { address: 'A1:D10', numberFormat: 'General', fillColor: null } },
      postState: { kind: 'excel_range_format', content: { address: 'A1:D10' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 0: adapter.restoreRangeFormat 未实现 → if(!adapter.restoreRangeFormat) throw → skipped_error（RED）
    // Wave 1 实现 restoreRangeFormat 后 → 真 ExcelAdapter 收到 Record 对象 → rolled_back（GREEN）
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: set_column_row_size → restore_column_row_size → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 1,
      toolName: 'set_column_row_size',
      args: { target: 'column', indices: [0], size: 120 },
      humanLabel: '设置第 1 列宽度 120',
      reverse: { tool: 'restore_column_row_size', args: { target: 'column', beforeSizes: [{ index: 0, size: 64 }] } },
      postState: { kind: 'excel_column_row', content: { target: 'column', indices: [0] } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: set_auto_filter → restore_auto_filter → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 2,
      toolName: 'set_auto_filter',
      args: { address: 'A1:E1', enabled: true },
      humanLabel: '对 A1:E1 启用自动筛选',
      reverse: { tool: 'restore_auto_filter', args: { hadFilter: false } },
      postState: { kind: 'excel_filter', content: { address: 'A1:E1' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: add_conditional_format → restore_conditional_format → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 3,
      toolName: 'add_conditional_format',
      args: { address: 'B2:B20', rule: { type: 'cellValue', operator: 'greaterThan', value: 100 } },
      humanLabel: '对 B2:B20 添加高亮条件格式（>100）',
      reverse: { tool: 'restore_conditional_format', args: { address: 'B2:B20', beforeFormats: [] } },
      postState: { kind: 'excel_conditional_format', content: { address: 'B2:B20' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: create_table → delete_table_by_name → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 4,
      toolName: 'create_table',
      args: { address: 'A1:D5', hasHeaders: true, tableName: '季度数据' },
      humanLabel: '将 A1:D5 建为表格「季度数据」',
      reverse: { tool: 'delete_table_by_name', args: { tableName: '季度数据' } },
      postState: { kind: 'excel_table', content: { tableName: '季度数据' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 1 实现 deleteTableByName 后，真 ExcelAdapter 收到 { tableName: '季度数据' } Record 对象 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: freeze_panes → restore_freeze_panes → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 5,
      toolName: 'freeze_panes',
      args: { freezeRows: 1, freezeColumns: 0 },
      humanLabel: '冻结首行',
      reverse: { tool: 'restore_freeze_panes', args: { frozenRows: 0, frozenColumns: 0 } },
      postState: { kind: 'excel_freeze', content: { frozenRows: 1, frozenColumns: 0 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: set_chart_title → restore_chart_title → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 6,
      toolName: 'set_chart_title',
      args: { chartName: '销售图', title: '2024 年销售趋势' },
      humanLabel: '修改图表「销售图」标题',
      reverse: { tool: 'restore_chart_title', args: { chartName: '销售图', beforeTitle: '原标题' } },
      postState: { kind: 'excel_chart_title', content: { chartName: '销售图', title: '2024 年销售趋势' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 1 实现 restoreChartTitle 后，真 ExcelAdapter 收到 { chartName, beforeTitle } Record 对象 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  // ─── Excel 快照式 ─── D-20：sort_range 和 excel_find_and_replace 各需独立用例
  it('D-17/D-20: sort_range → restore_range_values_snapshot → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 7,
      toolName: 'sort_range',
      args: { address: 'A1:E500', key: [{ column: 1, ascending: false }] },
      humanLabel: '对 A1:E500 按第 2 列降序排序',
      reverse: { tool: 'restore_range_values_snapshot', args: { address: 'A1:E500', snapshot: [['a', 'b']] } },
      postState: { kind: 'excel_snapshot', content: { address: 'A1:E500' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17/D-20: excel_find_and_replace → restore_range_values_snapshot → rolled_back（独立用例，D-20）', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 8,
      toolName: 'excel_find_and_replace',
      args: { searchText: '旧值', replaceText: '新值' },
      humanLabel: '全文替换「旧值」→「新值」',
      reverse: { tool: 'restore_range_values_snapshot', args: { address: 'Sheet1!A1:Z100', snapshot: [['旧值', 'b']] } },
      postState: { kind: 'excel_snapshot', content: { address: 'Sheet1!A1:Z100' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: manage_worksheet(add) → restore_worksheet_snapshot → rolled_back', async () => {
    mockExcel();
    const adapter = new ExcelAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 9,
      toolName: 'manage_worksheet',
      args: { operation: 'add', sheetName: '新工作表' },
      humanLabel: '新增工作表「新工作表」',
      reverse: { tool: 'restore_worksheet_snapshot', args: { operation: 'add', sheetName: '新工作表' } },
      postState: { kind: 'excel_worksheet', content: { operation: 'add', sheetName: '新工作表' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  // ─── PPT 简单逆向（真 PptAdapter 实例；Wave 0 RED，Wave 3/4 GREEN）───
  it('D-17: set_shape_text_font → restore_shape_font → rolled_back', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 10,
      toolName: 'set_shape_text_font',
      args: { slideIndex: 1, shapeId: 'shape-01', font: { size: 18, bold: true } },
      humanLabel: '将第 1 页形状「shape-01」字号改为 18、加粗',
      reverse: { tool: 'restore_shape_font', args: { slide_index: 1, shape_id: 'shape-01', before_font: { bold: false, size: 12 } } },
      postState: { kind: 'ppt_shape_font', content: { slideIndex: 1, shapeId: 'shape-01' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 0: adapter.restoreShapeFont 未实现 → RED；Wave 3 实现后 → 真 PptAdapter 收到 Record 对象 → rolled_back（GREEN）
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: set_shape_text_alignment (spike S4 happy-path) → restore_shape_alignment → rolled_back', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 11,
      toolName: 'set_shape_text_alignment',
      args: { slideIndex: 1, shapeId: 'shape-01', alignment: 'Center' },
      humanLabel: '将第 1 页形状「shape-01」文字对齐改为居中',
      reverse: { tool: 'restore_shape_alignment', args: { slide_index: 1, shape_id: 'shape-01', before_alignment: 'Left' } },
      postState: { kind: 'ppt_shape_alignment', content: { slideIndex: 1, shapeId: 'shape-01' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: add_shape → delete_shape_by_id → rolled_back', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 12,
      toolName: 'add_shape',
      args: { slideIndex: 1, shapeType: 'TextBox', position: { left: 100, top: 100, width: 200, height: 50 }, text: '季度总结' },
      humanLabel: '在第 1 页插入文本框「季度总结」',
      reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: 'new-shape-uuid' } },
      postState: { kind: 'ppt_shape_new', content: { slideIndex: 1, shapeId: 'new-shape-uuid' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 3 实现 deleteShapeById 后，真 PptAdapter 收到 { slide_index, shape_id } Record 对象 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });

  // ─── PPT noop+gate（D-17 第 4 步：验 skipped_error 路径；Wave 0 即 GREEN）───
  it('D-17: delete_shape → noop_inverse → skipped_error（noop+gate 行为正确）', async () => {
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 13,
      toolName: 'delete_shape',
      args: { slideIndex: 1, shapeId: 'shape-02' },
      humanLabel: '删除第 1 页形状「shape-02」',
      reverse: { tool: 'noop_inverse', args: { reason: '形状完整状态无法序列化重建，此步不可自动撤销' } },
      postState: { kind: 'ppt_shape', content: { slideIndex: 1, shapeId: 'shape-02' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, {} as DocumentAdapterForReplay);
    expect(detail.status).toBe('skipped_error');  // noop_inverse → throw → skipped_error（非 rolled_back）
  });

  it('D-17: rotate_shape (spike S1 happy-path) → restore_shape_rotation → rolled_back', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 14,
      toolName: 'rotate_shape',
      args: { slideIndex: 1, shapeId: 'shape-03', rotation: 45 },
      humanLabel: '将第 1 页形状「shape-03」旋转 45°',
      reverse: { tool: 'restore_shape_rotation', args: { slide_index: 1, shape_id: 'shape-03', before_rotation: 0 } },
      postState: { kind: 'ppt_shape_rotation', content: { slideIndex: 1, shapeId: 'shape-03' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: set_slide_background (spike S2 happy-path) → restore_slide_background → rolled_back', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 15,
      toolName: 'set_slide_background',
      args: { slideIndex: 1, color: '#1A73E8' },
      humanLabel: '将第 1 页背景设为蓝色 #1A73E8',
      reverse: { tool: 'restore_slide_background', args: { slide_index: 1, before_color: '#FFFFFF' } },
      postState: { kind: 'ppt_slide_background', content: { slideIndex: 1 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
  });

  it('D-17: manage_slides(delete) → noop_inverse → skipped_error（noop+gate 行为正确）', async () => {
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 16,
      toolName: 'manage_slides',
      args: { operation: 'delete', slideIndex: 3 },
      humanLabel: '删除第 3 张幻灯片',
      reverse: { tool: 'noop_inverse', args: { reason: '幻灯片内容无法通过 Office.js 序列化导出，此步不可自动撤销' } },
      postState: { kind: 'ppt_slide', content: { slideIndex: 3, title: '' } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, {} as DocumentAdapterForReplay);
    expect(detail.status).toBe('skipped_error');
  });

  it('D-17: copy_slide → delete_slide_by_index → rolled_back（index+ID 双定位）', async () => {
    mockPpt('');
    const adapter = new PptAdapter();
    const entry: OperationLogEntry = {
      runId: 'r10', stepIndex: 17,
      toolName: 'copy_slide',
      args: { sourceIndex: 1, targetIndex: 2 },
      humanLabel: '复制第 1 张幻灯片到位置 2',
      reverse: { tool: 'delete_slide_by_index', args: { capturedIndex: 1, capturedId: 'slide-uuid-copy' } },
      postState: { kind: 'ppt_slide_copy', content: { sourceIndex: 1, capturedIndex: 1 } },
      timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    // Wave 3 实现 deleteSlideByIndex 后，真 PptAdapter 收到 { capturedIndex, capturedId } Record 对象 → rolled_back
    expect(detail.status).toBe('rolled_back');
  });
});
