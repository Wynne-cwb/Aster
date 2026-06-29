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

function mockWpsWord(initial: string[]): { paras: string[] } {
  const paras = [...initial];

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
      Style: undefined,
      InsertAfter(_t: string): void {
        /* 段落级 InsertAfter 未在本测试覆盖路径用到 */
      },
      InsertParagraphAfter(): void {
        /* 同上 */
      },
      Delete(): void {
        paras.splice(i - 1, 1);
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
    },
    Delete(): void {
      paras.length = 0;
    },
    Collapse(_d?: number): void {
      /* no-op */
    },
  } as unknown as WpsWordRange;

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
  } as unknown as WpsDocument;

  (globalThis as { Application?: WpsApplication }).Application = {
    ComponentType: 1,
    ActiveDocument: doc,
  } as unknown as WpsApplication;

  return { paras };
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
});
