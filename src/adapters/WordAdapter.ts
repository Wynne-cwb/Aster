/**
 * WordAdapter — Word 宿主 adapter 实现（FOUND-05, NFR-05）
 *
 * 安全约束（T-01-06）：getSelection() 读取选中文本的字符数（charCount = text.length），
 * 不留存文本内容本身，满足 Phase 1 仅读元数据要求。
 * 正文内容读取与发往 Provider 是 Phase 2 行为（受 KEY-03 隐私告知约束）。
 */
import type {
  DocumentAdapter,
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
  ReadableQuery,
  ReadableResult,
} from './DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../errors';

export class WordAdapter implements DocumentAdapter {
  /**
   * 获取 Word 当前选区字符数。
   * - 有选区 → { kind: 'word', charCount }（charCount = text.length）
   * - 光标无选区（charCount === 0）→ { kind: 'none' }（D-16）
   * - Office.js 异常 → 包成 HostApiError
   */
  async getSelection(): Promise<SelectionContext> {
    try {
      return await Word.run(async (ctx) => {
        const selection = ctx.document.getSelection();
        selection.load('text');
        await ctx.sync();

        const charCount = selection.text.length;

        // charCount 为 0 时为光标位置（无实际选区）→ none（D-16）
        if (charCount === 0) {
          return { kind: 'none' } satisfies SelectionContext;
        }

        return {
          kind: 'word',
          charCount,
        } satisfies SelectionContext;
      });
    } catch (err) {
      throw new HostApiError('Word getSelection 失败', err);
    }
  }

  /**
   * 订阅 Word document selection-changed 事件（D-13）。
   * 使用 ctx.document.onSelectionChanged.add()，
   * 返回解绑函数 — 防止 Task Pane 隐藏后事件继续触发（T-01-07）。
   */
  onSelectionChanged(callback: () => void): () => void {
    // 使用 Office.context.document API（Word 宿主下等效于 Common API 的 DocumentSelectionChanged）
    // Word.run 上下文外无法使用 ctx.document.onSelectionChanged；
    // 使用 Common API addHandlerAsync 替代（跨宿主一致）。
    const handler = () => callback();

    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handler,
    );

    return () => {
      Office.context.document.removeHandlerAsync(
        Office.EventType.DocumentSelectionChanged,
        { handler },
      );
    };
  }

  /**
   * Word 宿主能力声明。
   * Phase 2 实现 text 写回；其余类型 Phase 6 实现。
   */
  capabilities(): AdapterCapabilities {
    return {
      host: 'word',
      supportsSelectionEvents: true,
      supportedInserts: ['text', 'paragraphs'],
    };
  }

  /**
   * Word text 写回（D-16）。
   * 使用 InsertLocation.replace 替换当前选区（或在光标处插入）。
   * 非 text 类型抛 UnsupportedOperationError（Phase 6 实现）。
   */
  async insert(content: InsertableContent): Promise<void> {
    if (content.type !== 'text') {
      throw new UnsupportedOperationError(
        `Word Phase 2 仅支持 text 写回，${content.type} 在 Phase 6 实现`,
      );
    }
    // D-23 G-05：position 路由；缺省 'cursor'（向后兼容）
    const position = content.position ?? 'cursor';
    try {
      await Word.run(async (ctx) => {
        switch (position) {
          case 'replace_selection':
            ctx.document.getSelection().insertText(content.value, Word.InsertLocation.replace);
            break;
          case 'cursor':
            ctx.document.getSelection().insertText(content.value, Word.InsertLocation.after);
            break;
          case 'append_end':
            ctx.document.body.insertText(content.value, Word.InsertLocation.end);
            break;
        }
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof UnsupportedOperationError) throw err;
      throw new HostApiError('Word text 写回失败', err);
    }
  }

  /**
   * 在文档末尾追加一段文本（Phase 3 Word demo write tool 走的方法 — AGENT-08 / D-12）。
   *
   * A-06 边界：输入纯 string；Word.run 闭包内消费 ctx.document.body proxy 即丢；
   *           出闭包前 await ctx.sync() 让操作生效；不返回任何 proxy 对象。
   *
   * 错误处理：Word.run 抛错（含 Office.js RichApi.Error）→ 包成 HostApiError；
   *           HostApiError 构造器不存 hostError 字段（ERR-02 Plan 02 改造，
   *           防 stack/path 跨 catch 边界传到 LLM sanitize 路径）。
   */
  async appendParagraph(text: string): Promise<void> {
    try {
      await Word.run(async (ctx) => {
        ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
        await ctx.sync();
      });
    } catch (err) {
      throw new HostApiError('Word append_paragraph 失败', err);
    }
  }

  /**
   * per-query 离散只读（TOOL-01）。
   *
   * 桩实现：Plan 04-03 补充真实实现（get_paragraph_count/get_paragraph_at/get_document_outline/get_document_full_text）。
   * proxy 不出 *.run 闭包（A-06/TOOL-07）。
   */
  async read(_query: ReadableQuery): Promise<ReadableResult> {
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: 'Word read() 尚未实现，Plan 04-03 补充',
        recoverable: false,
        hint: '等待 Phase 4 Plan 04-03 实现',
      },
    };
  }
}
