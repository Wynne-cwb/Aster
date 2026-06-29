/**
 * src/adapters/wps/WpsWordAdapter.ts — WPS 文字（WPS Office Word）adapter
 *
 * Phase 34（投机预写，WPS-D1 提前量；用户 2026-06-29 授权、认可推倒重来成本）。
 * 核心读 + 基础段落写 + inverse，对位 Office.js WordAdapter 被工具复用的同名方法。
 *
 * 接缝复用（loop.ts:54）：capabilities().host='word' → buildToolsForHost('word')
 * WPS 运行时下被 WPS_WORD_CORE_TOOLS 裁剪为核心集，工具调本类同名方法
 * （read / appendParagraph / insertParagraphAt / replaceParagraphAt / insertTextAtCursor /
 *   replaceSelection / deleteParagraphByContent / restoreParagraphAt / readWordParagraph）。
 * 工具 / dispatch / operationLog / undo 零改动。
 *
 * WPS JSAPI = 同步 VBA 风格（ARCHITECTURE Anti-Pattern 2）：方法体同步调
 * window.Application.ActiveDocument.*，async 仅为满足 DocumentAdapter 接口签名 → Promise.resolve。
 * **不**模仿 Office.js 的 Word.run()/load/sync；**不**调 Office.isSetSupported。
 *
 * inverse 方法签名必须是 (args: Record<string, unknown>)（[[adapter-inverse-signature]]
 * Phase 5 真机教训：operationLog.executeReverse 以 reverse.args 对象直接调用，位置参会真机翻车）。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29）：未经 Windows WPS 真机验证。
 *    [真机待验] 标注处 VBA 行为（段落 \r 标记、Range.Text 替换语义、OutlineLevel/Style 判定标题、
 *    Selection.TypeText、Delete 是否连带段落标记）需真机坐实，大概率要修。
 */
import type {
  AdapterCapabilities,
  DocumentAdapter,
  InsertableContent,
  ReadableQuery,
  ReadableResult,
  SelectionContext,
} from '../DocumentAdapter';
import { UnsupportedOperationError, HostApiError } from '../../errors';

/** 取 WPS 注入的全局 Application；非 WPS 环境（或注入失败）抛 HostApiError。 */
function getApp(): WpsApplication {
  const app = (globalThis as { Application?: WpsApplication }).Application;
  if (!app) {
    throw new HostApiError('WPS Application 不可用（非 WPS 环境或加载项未就绪）');
  }
  return app;
}

function getDoc(): WpsDocument {
  const doc = getApp().ActiveDocument;
  if (!doc) throw new HostApiError('WPS 无活动文档');
  return doc;
}

/** VBA 段落 Range.Text 末尾带 \r（段落标记），统一去掉用于对外文本。[真机待验] */
function stripParaMark(text: unknown): string {
  return typeof text === 'string' ? text.replace(/[\r\n]+$/, '') : '';
}

/** trim + 换行归一，用于段落内容指纹比对（与 operationLog word_paragraph 归一一致）。 */
function normalizeForMatch(text: unknown): string {
  return (typeof text === 'string' ? text : '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trimEnd();
}

export class WpsWordAdapter implements DocumentAdapter {
  // ---- 选区 ----------------------------------------------------------------

  async getSelection(): Promise<SelectionContext> {
    try {
      const sel = getApp().Selection;
      const text = sel?.Text;
      // 光标无选区时 VBA Selection.Text 可能是 '' 或 '\r'；统一成字符数
      const charCount = stripParaMark(text).length;
      return { kind: 'word', charCount };
    } catch (err) {
      throw new HostApiError('WPS Word getSelection 失败', err);
    }
  }

  /**
   * [真机待验] WPS 文字选区事件 API 未在文档确认（Office.js 是 document.onSelectionChanged）。
   * Phase 34 暂返 no-op 解绑（capabilities.supportsSelectionEvents=false）；真机调研后接 Application 事件。
   */
  onSelectionChanged(_callback: () => void): () => void {
    return () => {
      /* no-op — WPS 文字选区事件未接（[真机待验]） */
    };
  }

  capabilities(): AdapterCapabilities {
    return {
      host: 'word',
      supportsSelectionEvents: false,
      supportedInserts: ['text'],
    };
  }

  // ---- 写入（PANE insert）--------------------------------------------------

  async insert(content: InsertableContent): Promise<void> {
    if (content.type !== 'text') {
      throw new UnsupportedOperationError(
        `WPS Word insert 暂不支持 ${content.type}（WPS-D1）`,
      );
    }
    await this.insertTextAtCursor(content.value);
  }

  // ---- 只读 ----------------------------------------------------------------

  async read(query: ReadableQuery): Promise<ReadableResult> {
    switch (query.kind) {
      case 'get_document_full_text': {
        try {
          const text = stripParaMark(getDoc().Content.Text);
          return { ok: true, data: { text } };
        } catch (err) {
          throw new HostApiError('WPS Word get_document_full_text 失败', err);
        }
      }

      case 'get_paragraph_count': {
        try {
          return { ok: true, data: { count: getDoc().Paragraphs.Count } };
        } catch (err) {
          throw new HostApiError('WPS Word get_paragraph_count 失败', err);
        }
      }

      case 'get_paragraph_at': {
        try {
          const paras = getDoc().Paragraphs;
          const index = query.index; // 0-based（与 Office.js 工具契约一致）
          if (index < 0 || index >= paras.Count) {
            return {
              ok: false,
              error: {
                code: 'NOT_FOUND',
                message: `段落 index ${index} 越界（共 ${paras.Count} 段）`,
                hint: '先用 get_paragraph_count 确认段数，index 为 0-based',
                recoverable: true,
              },
            };
          }
          const text = stripParaMark(paras.Item(index + 1).Range.Text); // VBA 1-based
          return { ok: true, data: { index, text } };
        } catch (err) {
          throw new HostApiError('WPS Word get_paragraph_at 失败', err);
        }
      }

      case 'get_document_outline': {
        try {
          const paras = getDoc().Paragraphs;
          const outline: Array<{ index: number; level: number; text: string }> = [];
          for (let i = 1; i <= paras.Count; i++) {
            const para = paras.Item(i);
            const level = this.headingLevel(para);
            if (level > 0) {
              outline.push({ index: i - 1, level, text: stripParaMark(para.Range.Text) });
            }
          }
          return { ok: true, data: { outline } };
        } catch (err) {
          throw new HostApiError('WPS Word get_document_outline 失败', err);
        }
      }

      case 'selection_detail': {
        return { ok: true, data: await this.getSelection() };
      }

      default: {
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: `WPS Word adapter 不支持 kind: ${(query as ReadableQuery).kind}`,
            recoverable: false,
            hint: '该 read 操作在 WPS 版暂未实现（WPS-D1）或属其它宿主',
          },
        };
      }
    }
  }

  /**
   * 判定段落是否为标题及其层级（1-9；0=非标题）。
   * 优先 OutlineLevel（1-9 为标题，10=正文）；降级看 Style.NameLocal 是否含「标题/Heading」。
   * [真机待验] WPS 的 OutlineLevel/Style 暴露形态。
   */
  private headingLevel(para: WpsParagraph): number {
    try {
      const lvl = para.OutlineLevel;
      if (typeof lvl === 'number' && lvl >= 1 && lvl <= 9) return lvl;
    } catch {
      /* OutlineLevel 不可读 → 降级 Style 判定 */
    }
    try {
      const style = para.Range.Style;
      const name =
        typeof style === 'string' ? style : (style?.NameLocal ?? '');
      const m = /(?:标题|Heading)\s*([1-9])/i.exec(name);
      if (m) return Number(m[1]);
    } catch {
      /* Style 不可读 → 非标题 */
    }
    return 0;
  }

  // ---- 写工具方法（被 Office.js Word 工具复用调用）-------------------------

  /** append_paragraph 工具调用。inverse = delete_paragraph_by_content（args.text）。 */
  async appendParagraph(text: string): Promise<void> {
    try {
      const rng = getDoc().Range();
      rng.Collapse(0); // 0 = wdCollapseEnd（折叠到文末）[真机待验]
      rng.InsertParagraphAfter();
      rng.Collapse(0);
      rng.InsertAfter(text);
    } catch (err) {
      throw new HostApiError('WPS Word appendParagraph 失败', err);
    }
  }

  /** insert_paragraph 工具调用。inverse = delete_paragraph_by_content（args.text）。 */
  async insertParagraphAt(beforeIndex: number, text: string): Promise<{ insertedText: string }> {
    try {
      const paras = getDoc().Paragraphs;
      const count = paras.Count;
      if (beforeIndex >= count) {
        // 等于段数 → 末尾追加
        await this.appendParagraph(text);
        return { insertedText: text };
      }
      const target = paras.Item(Math.max(0, beforeIndex) + 1).Range; // VBA 1-based
      target.Collapse(1); // 1 = wdCollapseStart（折叠到段首）[真机待验]
      target.InsertAfter(text + '\r'); // \r = 段落标记 [真机待验]
      return { insertedText: text };
    } catch (err) {
      throw new HostApiError('WPS Word insertParagraphAt 失败', err);
    }
  }

  /** replace_paragraph 工具调用。before-image 模式，inverse = restore_paragraph_at。 */
  async replaceParagraphAt(
    index: number,
    newText: string,
    expectedText?: string,
  ): Promise<{ beforeImage: string }> {
    try {
      const paras = getDoc().Paragraphs;
      if (index < 0 || index >= paras.Count) {
        throw new HostApiError(`段落 index ${index} 越界（共 ${paras.Count} 段）`);
      }
      const range = paras.Item(index + 1).Range; // VBA 1-based
      const beforeImage = stripParaMark(range.Text);
      // D-11 并发防御：expectedText 不一致 → 拒绝写
      if (expectedText !== undefined && normalizeForMatch(beforeImage) !== normalizeForMatch(expectedText)) {
        throw new HostApiError('段落内容已变化，已取消替换（防并发改写）');
      }
      // 替换正文，保留段落标记：写 newText + \r 覆盖整段 Range [真机待验]
      range.Text = newText + '\r';
      return { beforeImage };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word replaceParagraphAt 失败', err);
    }
  }

  /** insert_text_at_cursor 工具调用。inverse 近似 = delete_paragraph_by_content。 */
  async insertTextAtCursor(text: string): Promise<{ insertedText: string }> {
    try {
      const sel = getApp().Selection;
      if (!sel) throw new HostApiError('WPS 无选区/光标');
      sel.TypeText(text);
      return { insertedText: text };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word insertTextAtCursor 失败', err);
    }
  }

  /** replace_selection 工具调用。inverse = noop_inverse（光标范围无法可靠还原）。 */
  async replaceSelection(newText: string): Promise<{ beforeImage: string }> {
    try {
      const sel = getApp().Selection;
      if (!sel) throw new HostApiError('WPS 无选区');
      const beforeImage = stripParaMark(sel.Text);
      sel.Text = newText;
      return { beforeImage };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word replaceSelection 失败', err);
    }
  }

  // ---- inverse 方法（operationLog.executeReverse 调用，Record 对象签名）-----

  /**
   * delete_paragraph_by_content inverse（append/insert/insert_text_at_cursor 的 reverse）。
   * 按内容指纹定位段落并删除（含段落标记）。
   */
  async deleteParagraphByContent(args: Record<string, unknown>): Promise<void> {
    const text = normalizeForMatch(args.text);
    try {
      const paras = getDoc().Paragraphs;
      // 从后往前找首个匹配段（删后 index 漂移，从尾删更稳）
      for (let i = paras.Count; i >= 1; i--) {
        const range = paras.Item(i).Range;
        if (normalizeForMatch(range.Text) === text) {
          range.Delete(); // [真机待验] 是否连带段落标记
          return;
        }
      }
      // 未找到（可能已被手动改）→ 不抛错，安全跳过
    } catch (err) {
      throw new HostApiError('WPS Word deleteParagraphByContent 失败', err);
    }
  }

  /**
   * restore_paragraph_at inverse（replace_paragraph 的 reverse）。
   * 精确 index + 内容指纹双重定位，还原 before-image。
   */
  async restoreParagraphAt(args: Record<string, unknown>): Promise<void> {
    const index = args.index as number;
    const expectedText = args.expectedText as string; // 替换后（当前）文本，用于定位
    const restoreText = args.restoreText as string; // before-image，用于还原
    try {
      const paras = getDoc().Paragraphs;
      // 快路径：index 直接命中且内容指纹与 expectedText 一致
      if (index >= 0 && index < paras.Count) {
        const range = paras.Item(index + 1).Range;
        if (normalizeForMatch(range.Text) === normalizeForMatch(expectedText)) {
          range.Text = restoreText + '\r';
          return;
        }
      }
      // 降级：全文档按 expectedText 指纹搜索
      for (let i = 1; i <= paras.Count; i++) {
        const range = paras.Item(i).Range;
        if (normalizeForMatch(range.Text) === normalizeForMatch(expectedText)) {
          range.Text = restoreText + '\r';
          return;
        }
      }
      // 未找到 → 视为已被手动改，安全跳过（不抛错避免误覆盖）
    } catch (err) {
      throw new HostApiError('WPS Word restoreParagraphAt 失败', err);
    }
  }

  /**
   * readWordParagraph（D-11 手改侦测，operationLog.readTargetState 调用）。
   * 按内容指纹定位段落，返回其当前文本；未找到返回 '' → 上层判定为「已手改」→ 跳过 undo（安全侧）。
   */
  async readWordParagraph(args: Record<string, unknown>): Promise<string> {
    const text = normalizeForMatch(args.text);
    try {
      const paras = getDoc().Paragraphs;
      for (let i = 1; i <= paras.Count; i++) {
        const cur = paras.Item(i).Range.Text;
        if (normalizeForMatch(cur) === text) return stripParaMark(cur);
      }
      return '';
    } catch (err) {
      throw new HostApiError('WPS Word readWordParagraph 失败', err);
    }
  }
}
