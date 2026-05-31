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
  const shapeDelete = vi.fn();
  // shapes 需同时满足多个 inverse 方法：
  //   - deleteSlideByTitle：type + textFrame.textRange.load + textFrame.textRange.text
  //   - restoreShapeFont：id='shape-01' + textFrame.textRange.font（可读写）
  //   - deleteShapeById：id='new-shape-uuid' + delete（add_shape 测试用此 ID）
  //   - restoreShapeAlignment：id='shape-01' + textFrame.textRange.paragraphFormat.horizontalAlignment（可读写，260531-m4x 修正属性名）
  //   - restoreShapeRotation：id='shape-03' + rotation（可读写，spike S1）
  const makeShape = (id: string, text: string, extraProps?: Record<string, unknown>) => ({
    id,
    type: 'TextBox',
    rotation: 0 as number,           // 供 restoreShapeRotation 写入（wave 4 spike S1）
    textFrame: {
      textRange: {
        load: vi.fn(),
        text,
        font: {
          bold: false as boolean | null,
          italic: false as boolean | null,
          underline: false as boolean | null,
          color: '#000000' as string | null,
          size: 12 as number | null,
          name: 'Calibri' as string | null,
          load: vi.fn(),
        },
        paragraphFormat: {           // 供 restoreShapeAlignment（wave 4 spike S4 / 260531-m4x）
          load: vi.fn(),
          horizontalAlignment: 'Left' as string | null,   // 修正：alignment → horizontalAlignment
        },
      },
    },
    delete: shapeDelete,
    load: vi.fn(),                   // 供 rotateShape sync 3: shape.load(['rotation'])
    ...extraProps,
  });
  // shape-01：供 restoreShapeFont / restoreShapeAlignment 定位（slide_index=1, shape_id='shape-01'）
  // new-shape-uuid：供 deleteShapeById 定位（add_shape 测试的 reverse.args.shape_id）
  // shape-03：供 restoreShapeRotation 定位（rotate_shape 测试的 reverse.args.shape_id）
  const shapeMain = makeShape('shape-01', slideTextboxText);
  const shapeNew = makeShape('new-shape-uuid', '');
  const shapeRotate = makeShape('shape-03', '');   // wave 4 spike S1 rotate_shape 测试
  // slide.background：供 restoreSlideBackground（wave 4 spike S2 / 260531-m4x 修正 API）
  //   修正：SlideBackgroundFill 无 setSolidColor/clear/foregroundColor →
  //   还原纯色用 fill.setSolidFill({color})，还原默认用 background.reset()
  const slideBg = {
    reset: vi.fn(),                  // before_color === null 时 restore 调 background.reset()
    fill: {
      setSolidFill: vi.fn(),         // before_color 非 null 时 restore 调 fill.setSolidFill({color})
      getSolidFillOrNullObject: vi.fn(() => ({ load: vi.fn(), color: '#FFFFFF', isNullObject: false })),
      type: 'Solid' as string,
      load: vi.fn(),
    },
  };
  const slides = {
    load: vi.fn(),
    items: [
      {
        index: 0,
        id: 'slide-uuid-copy',   // deleteSlideByIndex 测试用 capturedId='slide-uuid-copy' 定位
        background: slideBg,     // 供 restoreSlideBackground（wave 4 spike S2）
        shapes: {
          load: vi.fn(),
          items: [shapeMain, shapeNew, shapeRotate],
          addTextBox: vi.fn(() => ({ load: vi.fn(), id: 'new-textbox-id' })),
          addGeometricShape: vi.fn(() => ({ load: vi.fn(), id: 'new-shape-id', type: 'Rectangle', textFrame: { textRange: { text: '' } } })),
        },
        delete: del,
        copy: vi.fn(),
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

// ---------------------------------------------------------------------------
// Phase 11 D-11/D-17 硬卡：batch_reverse 逆序守门 + executeBatchReverse spy（真 adapter，非 mock）
// ---------------------------------------------------------------------------

describe('集成：replay engine × batch_reverse（Phase 11 D-11/D-17 硬卡）', () => {
  /**
   * 构造专用于 batch_reverse 的 mockExcel，记录 overwriteRange 被调用时的 address 顺序。
   * 扩展现有 mockExcel 工厂模式，增加 getRangeOrNullObject + 按地址区分的 range 对象。
   */
  function mockExcelForBatchReverse(): {
    addressOrder: string[];
    valueOrder: unknown[][][];
  } {
    const addressOrder: string[] = [];
    const valueOrder: unknown[][][] = [];

    const makeRange = (addr: string) => ({
      load: vi.fn(),
      address: addr,
      get values(): unknown[][] { return [[`原${addr.replace('Sheet1!', '')}`]]; },
      set values(v: unknown[][]) {
        addressOrder.push(addr);
        valueOrder.push(v);
      },
    });

    (global as unknown as Record<string, unknown>).Excel = {
      run: vi.fn(async (cb: (ctx: unknown) => unknown) => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        return cb({
          workbook: {
            worksheets: {
              getActiveWorksheet: () => ({
                getRange: (addr: string) => makeRange(addr),
                getRangeOrNullObject: (addr: string) => ({
                  ...makeRange(addr),
                  isNullObject: false,
                }),
              }),
            },
          },
          sync: syncFn,
        });
      }),
    };

    return { addressOrder, valueOrder };
  }

  it('3 subOp batch → batch_reverse → executeBatchReverse spy 调用 1 次 + 逆序执行（A3→A2→A1）', async () => {
    const { addressOrder } = mockExcelForBatchReverse();

    // 构造 3 subOp batch OperationLogEntry（与 tools/write/batch.ts 真实产出形状一致）
    // reverse.args.ops 必须是 Record 对象数组（project_adapter_inverse_signature 铁律）
    const batchEntry: OperationLogEntry = {
      runId: 'run-batch-reverse-test',
      stepIndex: 0,
      toolName: 'batch_write',
      args: { ops: [] },
      humanLabel: '批量改动 3 处',
      reverse: {
        tool: 'batch_reverse',
        args: {
          ops: [
            // subOp 0：写入 A1（最先写的）
            { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [['原A1']] } },
            // subOp 1：写入 A2
            { tool: 'overwrite_range', args: { address: 'Sheet1!A2', values: [['原A2']] } },
            // subOp 2：写入 A3（最后写的，undo 时应最先撤销）
            { tool: 'overwrite_range', args: { address: 'Sheet1!A3', values: [['原A3']] } },
          ],
        },
      },
      postState: { kind: 'batch', content: { subOps: [] } },
      subOps: [],
      timestamp: 0,
    };

    appendOperation(batchEntry);

    // 使用真 ExcelAdapter（非 mock adapter）— spy executeBatchReverse（D-08 优先路径守门）
    const adapter = new ExcelAdapter();
    const spyBatchReverse = vi.spyOn(adapter, 'executeBatchReverse');

    const result = await replayUndoAll(
      'run-batch-reverse-test',
      adapter as unknown as DocumentAdapterForReplay,
    );

    // 1. batch entry 整体 rolled_back（1 条条目）
    expect(result.total).toBe(1);
    expect(result.rolledBack).toBe(1);
    expect(result.skippedHostError).toBe(0);

    // 2. executeBatchReverse 单闭包优先路径被调用 1 次（D-08，非降级 for 循环）
    // 若此断言 FAIL → 说明降级路径被触发（executeBatchReverse 未实现或不可访问）
    expect(spyBatchReverse).toHaveBeenCalledTimes(1);

    // 3. spy 调用参数是逆序 ops（A3→A2→A1），operationLog.ts 负责在传入前逆序
    const calledWithOps = spyBatchReverse.mock.calls[0][0] as Array<{ tool: string; args: Record<string, unknown> }>;
    expect(calledWithOps[0].args.address).toBe('Sheet1!A3'); // 逆序第 1 个（最先执行撤销）
    expect(calledWithOps[1].args.address).toBe('Sheet1!A2');
    expect(calledWithOps[2].args.address).toBe('Sheet1!A1');

    // 4. 逆序执行结果：addressOrder（range.values setter 调用顺序）= A3→A2→A1
    // ExcelAdapter.executeBatchReverse 直接按传入顺序执行（不再次逆序）
    expect(addressOrder[0]).toBe('Sheet1!A3'); // 最后写的先撤（SC#3）
    expect(addressOrder[1]).toBe('Sheet1!A2');
    expect(addressOrder[2]).toBe('Sheet1!A1');

    // 5. reverse.args 是 Record 对象被正确消费（非位置参）
    // 通过「overwriteRange 被 3 次调用」间接验证（Record 对象 address/values 字段正确解构）
    expect(addressOrder.length).toBe(3);
  });

  it('per-subOp 手改防御（D-09）：executeBatchReverse 只收 surviving subOps（手改的 subOp 被过滤）', async () => {
    mockExcelForBatchReverse();

    // 构造 2 subOp batch：
    // subOp[0]（A1）无 postState → 不做手改检测 → surviving（直接传入 executeBatchReverse）
    // subOp[1]（A2）有 postState（kind='excel_range'）→ readTargetState 返回 mock 文档当前值
    //   → mock 文档 get values() 返回 [['原A2']]，而 postState.content.values 是 [['被手改的值']]
    //   → isTargetStateConsistent 比对不一致（JSON.stringify 不同）→ skippedManual → 不进 survivingOps
    const batchEntry2: OperationLogEntry = {
      runId: 'run-batch-manual-d09-test',
      stepIndex: 0,
      toolName: 'batch_write',
      args: {},
      humanLabel: '批量改动 2 处',
      reverse: {
        tool: 'batch_reverse',
        args: {
          ops: [
            // subOp[0]：无 postState → 不做手改检测 → surviving
            { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [['原A1']] } },
            // subOp[1]：有 postState（excel_range），且 postState.content.values 与 mock 不一致
            // mock 文档 get values() → [['原A2']]（来自 makeRange）
            // postState.content.values = [['被手改的值']] → JSON 不同 → skippedManual
            {
              tool: 'overwrite_range',
              args: { address: 'Sheet1!A2', values: [['原A2']] },
              postState: { kind: 'excel_range' as const, content: { address: 'Sheet1!A2', values: [['被手改的值']] } },
            },
          ],
        },
      },
      postState: { kind: 'batch', content: { subOps: [] } },
      subOps: [],
      timestamp: 0,
    };

    appendOperation(batchEntry2);

    const adapter2 = new ExcelAdapter();
    // 为了使 per-subOp 手改检测可观察，给真 ExcelAdapter 实例注入一个 readExcelRange mock：
    // - 对 Sheet1!A2（手改地址）返回与 postState.content.values 不一致的值
    // - operationLog.ts readTargetState('excel_range') 调用此方法，isTargetStateConsistent 返回 false → skippedManual
    // 这是合法的：adapter 是真实 ExcelAdapter，readExcelRange 是动态注入的 mock（模拟「文档当前状态」）
    (adapter2 as unknown as { readExcelRange: (args: Record<string, unknown>) => Promise<unknown[][]> }).readExcelRange =
      vi.fn(async (args: Record<string, unknown>) => {
        // 对 Sheet1!A2 返回当前文档值（手改后的实际值，与 postState 不一致）
        if (args.address === 'Sheet1!A2') {
          return [['当前文档实际值（手改后）']]; // 与 postState.content.values=[['被手改的值']] JSON 不同 → 不一致
        }
        return [['原A1']];
      });

    const spyBatchReverse2 = vi.spyOn(adapter2, 'executeBatchReverse');

    await replayUndoAll(
      'run-batch-manual-d09-test',
      adapter2 as unknown as DocumentAdapterForReplay,
    );

    // D-08 优先路径：executeBatchReverse 被调用 1 次（非降级 for 循环）
    expect(spyBatchReverse2).toHaveBeenCalledTimes(1);

    // D-09 守门核心断言：
    // survivingOps 只含 subOp[0]（A1 无 postState，直接 push）
    // subOp[1]（A2）postState 不一致（readExcelRange 返回 '当前文档实际值' vs postState '被手改的值'）→ skippedManual → 不进 survivingOps
    // reversedOps 是 [subOp[1], subOp[0]]（逆序），subOp[1] 被手改检测过滤后
    // survivingOps = [subOp[0]]（A1），calledWithOps.length === 1
    const calledWithOps2 = spyBatchReverse2.mock.calls[0][0] as Array<{ tool: string; args: Record<string, unknown> }>;
    expect(calledWithOps2.length).toBe(1); // 只有 surviving subOp[0]（手改的 A2 被过滤）
    // subOp[0]（A1）必须在 surviving 中（无 postState 跳过手改检测直接 push）
    expect(calledWithOps2.some((op) => op.args.address === 'Sheet1!A1')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Phase 11 CR-01 守门：Word batch_reverse 真 WordAdapter undo（GREEN from start，复发 gate）
// ---------------------------------------------------------------------------
// 背景（CR-01 = 假阳性，已用真 WordAdapter 探针实测核实）：
//   WordAdapter.executeBatch 每个 subOp 的 postState.content 是**对象**（{text}/{index,afterText} 等）。
//   readTargetState('word_paragraph') 对对象 content 走显式安全侧 → 返回 undefined → subOp **必 survive**
//   → Word 批量 undo 逆序真回滚。Word 批量 undo 本就工作（非 bug）。
// 本 gate 不是「修复后变绿」——它**一开始就 GREEN**，作用是**锁住**「对象 content 的 Word subOp 必 survive
//   + 整批 undo 真逆序回滚」这条正确但曾脆的行为，专门逮两类未来回归（届时变 RED）：
//     (a) Path B 显式安全侧被移除 / readTargetState('word_paragraph') 回到对对象 content 调 readWordParagraph；
//     (b) WordAdapter.normalizeText 被加 null-guard → readWordParagraph({}) 返回 '' → subOp 被误判手改跳过。
//   memory「同故障模式复发≥2次必加结构性 gate」要求的就是它（Excel 已有对应 gate，Word 此前缺）。
// WordAdapter 无 executeBatchReverse → batch_reverse 走降级路径（逐个 executeReverse surviving subOp）。
describe('集成：replay engine × batch_reverse × 真 WordAdapter（Phase 11 CR-01 守门 / 复发 gate，GREEN）', () => {
  it('Word batch（文本改 + format 改，postState.content 为对象）→ 每个 subOp 必 survive + 整批 undo 真逆序回滚', async () => {
    // 真 Office 全局 mock（让真 WordAdapter.readWordParagraph 在「对象 content」路径前后行为真实）
    mockWordRich({ paragraphTexts: ['追加的段落文本', '原段落文本', '第二段'] });
    const adapter = new WordAdapter(); // ← 真 WordAdapter（非 mock adapter，捕获 Phase 5 类签名/路由 bug）

    // 降级路径（WordAdapter 无 executeBatchReverse）→ executeReverse 逐个调真 adapter inverse 方法。
    // 在真 adapter 实例上 spy 两个 reverse 方法（mockResolvedValue）：隔离「subOp 是否被误判手改跳过」这一
    // 待守门行为，避免 inverse 方法自身的 Office mock 表面噪音。与 Excel D-09 gate「在真 adapter 上注入
    // readExcelRange」同范式。
    const spyDelete = vi.spyOn(adapter, 'deleteParagraphByContent').mockResolvedValue(undefined);
    const spyRestoreFmt = vi.spyOn(adapter, 'restoreParagraphFormat').mockResolvedValue(undefined);

    // batch entry：2 个 subOp，postState.content **均为对象**（复刻 WordAdapter.executeBatch 真实产出形状）
    //   subOp[0]（先写）= append_paragraph → reverse delete_paragraph_by_content
    //   subOp[1]（后写）= set_word_paragraph_format → reverse restore_paragraph_format
    const batchEntry: OperationLogEntry = {
      runId: 'run-word-batch-cr01',
      stepIndex: 0,
      toolName: 'batch_write',   // ← D-17 硬卡：字符串必须出现在本文件
      args: { ops: [] },
      humanLabel: '批量改动 2 处',
      reverse: {
        tool: 'batch_reverse',
        args: {
          ops: [
            {
              tool: 'delete_paragraph_by_content',
              args: { text: '追加的段落文本' }, // Record 对象（project_adapter_inverse_signature 铁律）
              postState: { kind: 'word_paragraph', content: { text: '追加的段落文本' } }, // ← 对象 content
            },
            {
              tool: 'restore_paragraph_format',
              args: { index: 1, expectedText: '原段落文本', before: { lineSpacing: 12, spaceBefore: 0, spaceAfter: 0, alignment: 'Left', indent: 0, leftIndent: 0 } },
              postState: { kind: 'word_paragraph', content: { index: 1, afterText: '原段落文本' } }, // ← 对象 content
            },
          ],
        },
      },
      postState: { kind: 'batch', content: { subOps: [] } },
      subOps: [],
      timestamp: 0,
    };

    appendOperation(batchEntry);
    const result = await replayUndoAll('run-word-batch-cr01', adapter as unknown as DocumentAdapterForReplay);

    // 1) batch entry 整体被处理（不抛）
    expect(result.total).toBe(1);
    expect(result.rolledBack).toBe(1);

    // 2) 守门核心：两个对象-content subOp **都 survive 并被真正 reverse-applied**（各调 1 次 = 共 2 个 subOp 回滚）。
    //    若 Path B 安全侧被移除 / normalizeText 加 null-guard → subOp 被误判手改跳过 → 此处变 0 → RED。
    expect(spyDelete).toHaveBeenCalledTimes(1);
    expect(spyRestoreFmt).toHaveBeenCalledTimes(1);

    // 3) 逆序回滚（SC#3）：后写的 format subOp 先撤，先写的 append subOp 后撤
    expect(spyRestoreFmt.mock.invocationCallOrder[0]).toBeLessThan(spyDelete.mock.invocationCallOrder[0]);

    // 4) reverse.args 是 Record 对象（非位置参，project_adapter_inverse_signature 铁律）
    expect(spyDelete.mock.calls[0][0]).toEqual({ text: '追加的段落文本' });
    expect((spyRestoreFmt.mock.calls[0][0] as Record<string, unknown>).index).toBe(1);

    // 5) 无任何 subOp 被误判手改跳过（无 skip 时 batch_reverse 不挂 _batchUndoResult）
    expect((batchEntry.reverse.args as Record<string, unknown>)._batchUndoResult).toBeUndefined();
  });
});
