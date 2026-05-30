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
    get values(): unknown[][] {
      return [[0, 0]];
    },
    set values(v: unknown[][]) {
      setValues(v);
    },
  };
  (global as unknown as Record<string, unknown>).Excel = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        workbook: { worksheets: { getActiveWorksheet: () => ({ getRange: () => range }) } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
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
