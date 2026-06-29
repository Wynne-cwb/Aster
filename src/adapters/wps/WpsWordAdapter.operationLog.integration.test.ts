/**
 * WpsWordAdapter.operationLog.integration.test.ts — WPS Word adapter × replay engine 集成守门
 *
 * 用 **真 WpsWordAdapter 实例**（mock window.Application.ActiveDocument 同步 VBA 风格），
 * 跑 replayUndoSingle / replayUndoAll，断言：
 *   1. appendParagraph → delete_paragraph_by_content(Record) 往返删除（rolled_back）
 *   2. replaceParagraphAt → restore_paragraph_at(Record) 往返还原（rolled_back，含 D-11 readWordParagraph 一致性）
 *   3. 批量 3 次 append → undo-all 逆序全部 rolled_back
 *   4. read 数据形状对齐 Office.js（count / {index,text} / text）
 *
 * 守门意义（[[adapter-inverse-signature]]）：inverse 必须收 Record 对象。
 * 若 deleteParagraphByContent/restoreParagraphAt 改成位置参，本测试立刻变红。
 *
 * ⚠️ 投机性预写：mock 行为是对 WPS 文字 VBA 语义的**推断**，真机以真机为准（[真机待验]）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WpsWordAdapter } from './WpsWordAdapter';
import {
  replayUndoSingle,
  replayUndoAll,
  appendOperation,
  __resetOperationLogForTest,
  type OperationLogEntry,
  type DocumentAdapterForReplay,
} from '../../agent/operationLog';

// ---------------------------------------------------------------------------
// mock window.Application.ActiveDocument（同步 VBA 风格文字对象模型）
// 文档建模为 paras: string[]（不含尾随 \r；Range.Text getter 补 \r 模拟 VBA 段落标记）
// ---------------------------------------------------------------------------

// 每段并行格式态（与 paras 索引对齐；splice/Delete 时同步维护）。
type FontModel = { Bold: number; Italic: number; Underline: number; Size: number; Color: number; Name: string; HighlightColorIndex: number };
type PfModel = { LineSpacing: number; SpaceBefore: number; SpaceAfter: number; Alignment: number; FirstLineIndent: number; LeftIndent: number };

function freshFont(): FontModel {
  return { Bold: 0, Italic: 0, Underline: 0, Size: 12, Color: 0, Name: '宋体', HighlightColorIndex: 0 };
}
function freshPf(): PfModel {
  return { LineSpacing: 12, SpaceBefore: 0, SpaceAfter: 0, Alignment: 0, FirstLineIndent: 0, LeftIndent: 0 };
}

function mockWpsWord(initial: string[]): {
  paras: string[];
  fonts: FontModel[];
  pfs: PfModel[];
  styles: string[];
} {
  const paras = [...initial];
  const fonts: FontModel[] = initial.map(freshFont);
  const pfs: PfModel[] = initial.map(freshPf);
  const styles: string[] = initial.map(() => '正文');

  const makeParaRange = (i: number): WpsWordRange =>
    ({
      get Text(): string {
        return paras[i - 1] !== undefined ? paras[i - 1] + '\r' : '';
      },
      set Text(v: string) {
        paras[i - 1] = String(v).replace(/[\r\n]+$/, '');
      },
      get Start() {
        return 0;
      },
      get End() {
        return 0;
      },
      get Style(): { NameLocal: string } {
        const idx = i - 1;
        return { get NameLocal() { return styles[idx] ?? ''; } };
      },
      set Style(name: unknown) {
        styles[i - 1] = String(name);
      },
      get Font(): FontModel {
        return fonts[i - 1];
      },
      get ParagraphFormat(): PfModel {
        return pfs[i - 1];
      },
      // [真机待验] VBA Range.ListFormat（mock 仅提供默认 apply 方法，验证调用不抛）
      ListFormat: {
        ApplyBulletDefault(): void {/* applied */},
        ApplyNumberDefault(): void {/* applied */},
      },
      InsertAfter(_t: string): void {
        /* 段落级 InsertAfter 未在本测试覆盖路径用到 */
      },
      InsertParagraphAfter(): void {
        /* 同上 */
      },
      Delete(): void {
        paras.splice(i - 1, 1);
        fonts.splice(i - 1, 1);
        pfs.splice(i - 1, 1);
        styles.splice(i - 1, 1);
      },
      Collapse(_d?: number): void {
        /* no-op */
      },
    }) as unknown as WpsWordRange;

  // 整文 Range（Range() 无参）：供 appendParagraph 用
  const wholeRange: WpsWordRange = {
    get Text(): string {
      return paras.join('\r') + '\r';
    },
    set Text(_v: string) {
      /* 整文覆写未用到 */
    },
    get Start() {
      return 0;
    },
    get End() {
      return paras.join('\r').length;
    },
    Style: undefined,
    InsertAfter(t: string): void {
      paras[paras.length - 1] = (paras[paras.length - 1] ?? '') + t;
    },
    InsertParagraphAfter(): void {
      paras.push('');
      fonts.push(freshFont());
      pfs.push(freshPf());
      styles.push('正文');
    },
    Delete(): void {
      paras.length = 0;
      fonts.length = 0;
      pfs.length = 0;
      styles.length = 0;
    },
    Collapse(_d?: number): void {
      /* no-op */
    },
    get Find() {
      return {
        // 全文一把替换（wdReplaceAll）：对每段做 string replace（mock 简化）
        Execute(
          findText?: string,
          matchCase?: boolean,
          _mww?: boolean,
          _mwc?: boolean,
          _msl?: boolean,
          _mawf?: boolean,
          _fwd?: boolean,
          _wrap?: number,
          _fmt?: boolean,
          replaceWith?: string,
          _replace?: number,
        ): boolean {
          if (!findText) return false;
          const re = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
          let hit = false;
          for (let i = 0; i < paras.length; i++) {
            if (re.test(paras[i])) {
              paras[i] = paras[i].replace(re, replaceWith ?? '');
              hit = true;
            }
          }
          return hit;
        },
      };
    },
  } as unknown as WpsWordRange;

  // ---- Tables 模型（每表是 string[][]，1-based Cell）----
  const tables: string[][][] = [];
  const makeTable = (idx0: number): WpsWordTable =>
    ({
      get Rows() { return { get Count() { return tables[idx0].length; } }; },
      get Columns() { return { get Count() { return tables[idx0][0]?.length ?? 0; } }; },
      Cell: (r: number, c: number) => ({
        get Range(): WpsWordRange {
          return {
            get Text(): string { return (tables[idx0][r - 1]?.[c - 1] ?? '') + '\r\x07'; },
            set Text(v: string) {
              if (!tables[idx0][r - 1]) tables[idx0][r - 1] = [];
              tables[idx0][r - 1][c - 1] = String(v).replace(/[\x07]/g, '').replace(/[\r\n]+$/g, '');
            },
          } as unknown as WpsWordRange;
        },
      }),
      get Range() { return wholeRange; },
      Delete(): void { tables.splice(idx0, 1); },
    }) as unknown as WpsWordTable;

  const tablesColl = {
    get Count() { return tables.length; },
    Item: (i: number) => makeTable(i - 1),
    Add: (_range: WpsWordRange, numRows: number, numCols: number): WpsWordTable => {
      const grid: string[][] = Array.from({ length: numRows }, () => Array.from({ length: numCols }, () => ''));
      tables.push(grid);
      return makeTable(tables.length - 1);
    },
  };

  // ---- Comments 模型（每批注 { text }；Index 1-based 动态）----
  const comments: Array<{ text: string }> = [];
  const makeComment = (idx0: number): WpsWordComment =>
    ({
      get Index() { return idx0 + 1; },
      Delete(): void { comments.splice(idx0, 1); },
    }) as unknown as WpsWordComment;
  const commentsColl = {
    get Count() { return comments.length; },
    Item: (i: number) => makeComment(i - 1),
    Add: (_range: WpsWordRange, text: string): WpsWordComment => {
      comments.push({ text });
      return makeComment(comments.length - 1);
    },
  };

  // ---- Sections 模型（每节 header/footer 文本，Primary/FirstPage/EvenPages）----
  const sectionStore = [{ header: { 1: '', 2: '', 3: '' } as Record<number, string>, footer: { 1: '', 2: '', 3: '' } as Record<number, string> }];
  const makeHFRange = (store: Record<number, string>, idx: number): WpsWordRange =>
    ({
      get Text(): string { return store[idx] ?? ''; },
      set Text(v: string) { store[idx] = String(v).replace(/[\r\n]+$/, ''); },
    }) as unknown as WpsWordRange;
  const sectionsColl = {
    get Count() { return sectionStore.length; },
    Item: (i: number) => ({
      Headers: { Item: (hf: number) => ({ get Range() { return makeHFRange(sectionStore[i - 1].header, hf); } }) },
      Footers: { Item: (hf: number) => ({ get Range() { return makeHFRange(sectionStore[i - 1].footer, hf); } }) },
    }),
  };

  const doc = {
    get Content(): WpsWordRange {
      return wholeRange;
    },
    Paragraphs: {
      get Count(): number {
        return paras.length;
      },
      // VBA Paragraphs.Item(i) 返回 Paragraph（其 .Range 才是文本 Range）
      Item: (i: number) => ({ get Range() { return makeParaRange(i); }, OutlineLevel: undefined }),
    },
    Range: (_s?: number, _e?: number) => wholeRange,
    get Tables() { return tablesColl; },
    get Comments() { return commentsColl; },
    get Sections() { return sectionsColl; },
  } as unknown as WpsDocument;

  (globalThis as { Application?: WpsApplication }).Application = {
    ComponentType: 1,
    ActiveDocument: doc,
  } as unknown as WpsApplication;

  return { paras, fonts, pfs, styles };
}

/** 测试内取当前 mock 文档（adapter 的 getDoc 未导出，这里直接走全局）。 */
function getDoc(): WpsDocument {
  return (globalThis as { Application?: WpsApplication }).Application!.ActiveDocument!;
}

afterEach(() => {
  __resetOperationLogForTest();
  delete (globalThis as { Application?: WpsApplication }).Application;
});

describe('集成：replay engine × 真 WpsWordAdapter（投机预写·真机 pending）', () => {
  it('appendParagraph → delete_paragraph_by_content(Record) 往返删除 → rolled_back', async () => {
    const store = mockWpsWord(['第一段']);
    const adapter = new WpsWordAdapter();

    await adapter.appendParagraph('新增段落');
    expect(store.paras).toContain('新增段落');

    const entry: OperationLogEntry = {
      runId: 'run-word',
      stepIndex: 0,
      toolName: 'append_paragraph',
      args: { text: '新增段落' },
      humanLabel: '追加段落',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: '新增段落' } },
      postState: { kind: 'word_paragraph', content: '新增段落' },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.paras).not.toContain('新增段落');
  });

  it('replaceParagraphAt → restore_paragraph_at(Record) 往返还原 → rolled_back（D-11 一致性）', async () => {
    const store = mockWpsWord(['原文 A', '原文 B', '原文 C']);
    const adapter = new WpsWordAdapter();

    const { beforeImage } = await adapter.replaceParagraphAt(1, '改后 B');
    expect(beforeImage).toBe('原文 B');
    expect(store.paras[1]).toBe('改后 B');

    const entry: OperationLogEntry = {
      runId: 'run-word',
      stepIndex: 0,
      toolName: 'replace_paragraph',
      args: { index: 1, text: '改后 B' },
      humanLabel: '替换第 2 段',
      reverse: {
        tool: 'restore_paragraph_at',
        args: { index: 1, expectedText: '改后 B', restoreText: beforeImage },
      },
      postState: { kind: 'word_paragraph', content: '改后 B' },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.paras[1]).toBe('原文 B');
  });

  it('D-11：段落被手动改过 → skipped_manual（readWordParagraph 侦测，不误覆盖）', async () => {
    const store = mockWpsWord(['原文 A', '改后 B', '原文 C']);
    const adapter = new WpsWordAdapter();

    // 模拟用户在 undo 前手动把第 2 段改成别的内容
    store.paras[1] = '用户手动改的内容';

    const entry: OperationLogEntry = {
      runId: 'run-word',
      stepIndex: 0,
      toolName: 'replace_paragraph',
      args: { index: 1, text: '改后 B' },
      humanLabel: '替换第 2 段',
      reverse: {
        tool: 'restore_paragraph_at',
        args: { index: 1, expectedText: '改后 B', restoreText: '原文 B' },
      },
      postState: { kind: 'word_paragraph', content: '改后 B' },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    // postState '改后 B' 在文档中已不存在 → readWordParagraph 返 '' → 不一致 → 跳过（不覆盖用户编辑）
    expect(detail.status).toBe('skipped_manual');
    expect(store.paras[1]).toBe('用户手动改的内容');
  });

  it('undo-all：批量 3 次 append → 逆序全部 rolled_back', async () => {
    const store = mockWpsWord(['首段']);
    const adapter = new WpsWordAdapter();

    const texts = ['追加1', '追加2', '追加3'];
    for (let i = 0; i < texts.length; i++) {
      await adapter.appendParagraph(texts[i]);
      appendOperation({
        runId: 'run-word',
        stepIndex: i,
        toolName: 'append_paragraph',
        args: { text: texts[i] },
        humanLabel: `追加 ${texts[i]}`,
        reverse: { tool: 'delete_paragraph_by_content', args: { text: texts[i] } },
        postState: { kind: 'word_paragraph', content: texts[i] },
        timestamp: i,
      });
    }
    expect(store.paras).toEqual(['首段', '追加1', '追加2', '追加3']);

    const result = await replayUndoAll('run-word', adapter as unknown as DocumentAdapterForReplay);

    expect(result.total).toBe(3);
    expect(result.rolledBack).toBe(3);
    expect(result.skippedHostError).toBe(0);
    expect(store.paras).toEqual(['首段']);
  });

  it('read 数据形状对齐 Office.js：count / {index,text} / full_text', async () => {
    mockWpsWord(['段落零', '段落一']);
    const adapter = new WpsWordAdapter();

    const cnt = await adapter.read({ kind: 'get_paragraph_count' });
    expect(cnt).toEqual({ ok: true, data: { count: 2 } });

    const p = await adapter.read({ kind: 'get_paragraph_at', index: 1 });
    expect(p).toEqual({ ok: true, data: { index: 1, text: '段落一' } });

    const full = await adapter.read({ kind: 'get_document_full_text' });
    expect(full.ok).toBe(true);
    expect((full as { data: { text: string } }).data.text).toContain('段落零');

    // 越界 → NOT_FOUND（不抛）
    const oob = await adapter.read({ kind: 'get_paragraph_at', index: 9 });
    expect(oob.ok).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Phase 34 完整版新增方法 round-trip undo（forward → reverse via operationLog → 还原）
  // -------------------------------------------------------------------------

  it('WORD-01 setCharacterFormat → restore_range_font(Record) 往返还原字体', async () => {
    const store = mockWpsWord(['加粗这段', '别的段']);
    const adapter = new WpsWordAdapter();

    const { beforeImage, afterText } = await adapter.setCharacterFormat({
      paragraphIndex: 0,
      font: { bold: true, size: 18, color: '#FF0000' },
    });
    expect(store.fonts[0].Bold).toBe(-1);
    expect(store.fonts[0].Size).toBe(18);
    expect(beforeImage.bold).toBe(false);

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'set_word_character_format',
      args: { paragraphIndex: 0 }, humanLabel: '设置第1段字符格式',
      reverse: { tool: 'restore_range_font', args: { index: 0, expectedText: afterText, before: beforeImage } },
      postState: { kind: 'word_char_format', content: { index: 0 } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.fonts[0].Bold).toBe(0);
    expect(store.fonts[0].Size).toBe(12);
  });

  it('WORD-02 setParaFormat → restore_paragraph_format(Record) 往返还原段落格式', async () => {
    const store = mockWpsWord(['段一', '段二']);
    const adapter = new WpsWordAdapter();

    const { beforeImage, afterText } = await adapter.setParaFormat({
      paragraphIndex: 1,
      format: { lineSpacing: 24, alignment: 'Centered', leftIndent: 36 },
    });
    expect(store.pfs[1].LineSpacing).toBe(24);
    expect(store.pfs[1].Alignment).toBe(1); // Centered → 1
    expect(beforeImage.alignment).toBe('Left');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'set_word_paragraph_format',
      args: { paragraphIndex: 1 }, humanLabel: '设置第2段格式',
      reverse: { tool: 'restore_paragraph_format', args: { index: 1, expectedText: afterText, before: beforeImage } },
      postState: { kind: 'word_para_format', content: { index: 1 } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.pfs[1].LineSpacing).toBe(12);
    expect(store.pfs[1].Alignment).toBe(0);
    expect(store.pfs[1].LeftIndent).toBe(0);
  });

  it('WORD-03 applyParagraphStyle → restore_paragraph_style(Record) 往返还原样式', async () => {
    const store = mockWpsWord(['标题候选', '正文段']);
    const adapter = new WpsWordAdapter();

    const { beforeImage, afterText } = await adapter.applyParagraphStyle({
      paragraphIndex: 0,
      styleName: 'Heading1',
    });
    expect(store.styles[0]).toBe('Heading1');
    expect(beforeImage.style).toBe('正文');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'apply_paragraph_style',
      args: { paragraphIndex: 0 }, humanLabel: '套用样式',
      reverse: { tool: 'restore_paragraph_style', args: { index: 0, expectedText: afterText, before: beforeImage } },
      postState: { kind: 'word_style', content: { index: 0, styleName: 'Heading1' } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.styles[0]).toBe('正文');
  });

  it('WORD-04 findAndReplace → restore_range_snapshot(Record) 往返还原文本', async () => {
    const store = mockWpsWord(['苹果很甜', '苹果和橙子', '香蕉']);
    const adapter = new WpsWordAdapter();

    const result = await adapter.findAndReplace({ searchText: '苹果', replaceText: '梨' });
    expect(result.replacedCount).toBe(2);
    expect(result.overLimit).toBe(false);
    expect(store.paras[0]).toBe('梨很甜');
    expect(store.paras[1]).toBe('梨和橙子');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'find_and_replace',
      args: { searchText: '苹果', replaceText: '梨' }, humanLabel: '查找替换',
      reverse: { tool: 'restore_range_snapshot', args: { snapshot: result.snapshot } },
      postState: { kind: 'word_snapshot', content: { snapshottedParagraphs: result.snapshot.length } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(store.paras[0]).toBe('苹果很甜');
    expect(store.paras[1]).toBe('苹果和橙子');
  });

  it('WORD-05 insertTable → delete_table_by_marker(Record) 往返删表', async () => {
    mockWpsWord(['锚段']);
    const adapter = new WpsWordAdapter();

    const result = await adapter.insertTable({
      rows: 2, cols: 2, content: [['A', 'B'], ['C', 'D']],
    });
    expect(getDoc().Tables!.Count).toBe(1);
    expect(result.rows).toBe(2);
    expect(result.cols).toBe(2);

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'insert_table',
      args: { rows: 2, cols: 2 }, humanLabel: '插入表格',
      reverse: {
        tool: 'delete_table_by_marker',
        args: {
          contentFingerprint: result.contentFingerprint,
          rows: result.rows, cols: result.cols, afterParagraphIndex: result.afterParagraphIndex,
        },
      },
      postState: { kind: 'word_table', content: { rows: 2, cols: 2, fingerprint: result.contentFingerprint } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(getDoc().Tables!.Count).toBe(0);
  });

  it('WORD-07 setWordListFormat → noop_inverse → skipped_error（诚实标注无法撤销）', async () => {
    mockWpsWord(['列表候选']);
    const adapter = new WpsWordAdapter();

    await expect(adapter.setWordListFormat({ paragraphIndex: 0, listType: 'bullet' })).resolves.toBeUndefined();

    // noop_inverse → executeReverse throw → skipped_error
    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'set_word_list_format',
      args: { paragraphIndex: 0 }, humanLabel: '改列表',
      reverse: { tool: 'noop_inverse', args: { reason: '列表格式转换无法自动撤销' } },
      postState: { kind: 'word_list_format', content: { index: 0 } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('skipped_error');
  });

  it('WORD-08 insertWordComment → delete_comment_by_id(Record) 往返删批注（含 [Aster] 前缀）', async () => {
    mockWpsWord(['批注目标段']);
    const adapter = new WpsWordAdapter();

    const { commentId } = await adapter.insertWordComment({
      paragraphIndex: 0, commentText: '这里需要补充数据',
    });
    expect(getDoc().Comments!.Count).toBe(1);
    expect(commentId).toBe('1');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'insert_word_comment',
      args: { paragraphIndex: 0, commentText: '这里需要补充数据' }, humanLabel: '插入批注',
      reverse: { tool: 'delete_comment_by_id', args: { commentId } },
      postState: { kind: 'word_comment', content: { commentId } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    expect(getDoc().Comments!.Count).toBe(0);
  });

  it('WORD-09 setWordHeaderFooter → restore_word_header_footer(Record) 往返还原页眉', async () => {
    mockWpsWord(['正文']);
    const adapter = new WpsWordAdapter();

    const result = await adapter.setWordHeaderFooter({ text: '机密文档', headerOrFooter: 'header' });
    expect(result.beforeText).toBe('');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'set_word_header_footer',
      args: { text: '机密文档', headerOrFooter: 'header' }, humanLabel: '改页眉',
      reverse: {
        tool: 'restore_word_header_footer',
        args: { type: result.type, sectionIndex: result.sectionIndex, headerOrFooter: result.headerOrFooter, beforeText: result.beforeText },
      },
      postState: { kind: 'word_header_footer', content: { type: result.type, sectionIndex: result.sectionIndex } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    // 还原后再读应为空
    const after = await adapter.setWordHeaderFooter({ text: '', headerOrFooter: 'header' });
    expect(after.beforeText).toBe('');
  });

  it('WORD-10 editTableCell → restore_table_cell(Record) 往返还原单元格', async () => {
    mockWpsWord(['锚段']);
    const adapter = new WpsWordAdapter();

    // 先插一张表
    await adapter.insertTable({ rows: 2, cols: 2, content: [['x', 'y'], ['z', 'w']] });

    const result = await adapter.editTableCell({ tableIndex: 0, rowIndex: 1, columnIndex: 1, text: '新值' });
    expect(result.beforeValue).toBe('w');

    const entry: OperationLogEntry = {
      runId: 'run-word', stepIndex: 0, toolName: 'edit_table_cell',
      args: { tableIndex: 0, rowIndex: 1, columnIndex: 1, text: '新值' }, humanLabel: '改单元格',
      reverse: {
        tool: 'restore_table_cell',
        args: {
          tableIndex: result.tableIndex, tableFingerprint: result.tableFingerprint,
          rowIndex: result.rowIndex, columnIndex: result.columnIndex, beforeValue: result.beforeValue,
        },
      },
      postState: { kind: 'word_table_cell', content: { tableIndex: 0, rowIndex: 1, columnIndex: 1 } }, timestamp: 0,
    };
    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);

    expect(detail.status).toBe('rolled_back');
    // 还原后再编辑读 before 应为 'w'
    const reread = await adapter.editTableCell({ tableIndex: 0, rowIndex: 1, columnIndex: 1, text: 'check' });
    expect(reread.beforeValue).toBe('w');
  });

  it('undo-all：混合 6 步（字体/格式/样式/替换/批注/表格）逆序全部 rolled_back', async () => {
    const store = mockWpsWord(['第一段含苹果', '第二段', '第三段']);
    const adapter = new WpsWordAdapter();

    // 1. setCharacterFormat
    const cf = await adapter.setCharacterFormat({ paragraphIndex: 1, font: { bold: true } });
    appendOperation({
      runId: 'run-mix', stepIndex: 0, toolName: 'set_word_character_format', args: {}, humanLabel: '字体',
      reverse: { tool: 'restore_range_font', args: { index: 1, expectedText: cf.afterText, before: cf.beforeImage } },
      postState: { kind: 'word_char_format', content: { index: 1 } }, timestamp: 0,
    });
    // 2. setParaFormat
    const pf = await adapter.setParaFormat({ paragraphIndex: 1, format: { alignment: 'Right' } });
    appendOperation({
      runId: 'run-mix', stepIndex: 1, toolName: 'set_word_paragraph_format', args: {}, humanLabel: '格式',
      reverse: { tool: 'restore_paragraph_format', args: { index: 1, expectedText: pf.afterText, before: pf.beforeImage } },
      postState: { kind: 'word_para_format', content: { index: 1 } }, timestamp: 1,
    });
    // 3. applyParagraphStyle
    const st = await adapter.applyParagraphStyle({ paragraphIndex: 2, styleName: 'Heading2' });
    appendOperation({
      runId: 'run-mix', stepIndex: 2, toolName: 'apply_paragraph_style', args: {}, humanLabel: '样式',
      reverse: { tool: 'restore_paragraph_style', args: { index: 2, expectedText: st.afterText, before: st.beforeImage } },
      postState: { kind: 'word_style', content: { index: 2, styleName: 'Heading2' } }, timestamp: 2,
    });
    // 4. findAndReplace
    const fr = await adapter.findAndReplace({ searchText: '苹果', replaceText: '梨' });
    appendOperation({
      runId: 'run-mix', stepIndex: 3, toolName: 'find_and_replace', args: {}, humanLabel: '替换',
      reverse: { tool: 'restore_range_snapshot', args: { snapshot: fr.snapshot } },
      postState: { kind: 'word_snapshot', content: { snapshottedParagraphs: fr.snapshot.length } }, timestamp: 3,
    });
    // 5. insertWordComment
    const cm = await adapter.insertWordComment({ paragraphIndex: 0, commentText: 'note' });
    appendOperation({
      runId: 'run-mix', stepIndex: 4, toolName: 'insert_word_comment', args: {}, humanLabel: '批注',
      reverse: { tool: 'delete_comment_by_id', args: { commentId: cm.commentId } },
      postState: { kind: 'word_comment', content: { commentId: cm.commentId } }, timestamp: 4,
    });
    // 6. insertTable
    const tb = await adapter.insertTable({ rows: 2, cols: 2, content: [['1', '2'], ['3', '4']] });
    appendOperation({
      runId: 'run-mix', stepIndex: 5, toolName: 'insert_table', args: {}, humanLabel: '表格',
      reverse: { tool: 'delete_table_by_marker', args: { contentFingerprint: tb.contentFingerprint, rows: tb.rows, cols: tb.cols, afterParagraphIndex: tb.afterParagraphIndex } },
      postState: { kind: 'word_table', content: { rows: 2, cols: 2, fingerprint: tb.contentFingerprint } }, timestamp: 5,
    });

    expect(store.paras[0]).toBe('第一段含梨'); // 替换生效
    expect(getDoc().Comments!.Count).toBe(1);
    expect(getDoc().Tables!.Count).toBe(1);

    const result = await replayUndoAll('run-mix', adapter as unknown as DocumentAdapterForReplay);

    expect(result.total).toBe(6);
    expect(result.rolledBack).toBe(6);
    expect(result.skippedHostError).toBe(0);
    expect(result.skippedManualChange).toBe(0);
    // 全部还原
    expect(store.paras[0]).toBe('第一段含苹果');
    expect(store.fonts[1].Bold).toBe(0);
    expect(store.pfs[1].Alignment).toBe(0);
    expect(store.styles[2]).toBe('正文');
    expect(getDoc().Comments!.Count).toBe(0);
    expect(getDoc().Tables!.Count).toBe(0);
  });
});
