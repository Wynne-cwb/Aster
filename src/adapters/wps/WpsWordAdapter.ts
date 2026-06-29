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

// ---------------------------------------------------------------------------
// VBA 成员类型增量（declare global 声明合并；与 types/wps-jsapi.d.ts 的同名 interface 合并）
//
// ⚠️ 不改共享 d.ts（避免与后续中央编辑冲突）。这里把 Phase 34 完整版 Word 工具用到的
//    VBA 对象模型成员**增量挂**到既有 global interface 上，全部 [真机待验]。
//    interface 声明合并是 TS 跨文件特性：此处补的成员与 d.ts 里同名 interface 自动并集。
// ---------------------------------------------------------------------------
declare global {
  interface WpsWordRange {
    // [真机待验] VBA Range.Font：Bold/Italic/Underline/Size/Color/Name 是数值/布尔；
    //   Underline 为 WdUnderline 整数枚举（0=None / 1=Single / 3=Double / 4=Word…）；
    //   Color 为 WdColor BGR 整数（wdColorAutomatic=-16777216）；
    //   HighlightColorIndex 为 WdColorIndex 整数（0=wdNoHighlight / 7=wdYellow…）。
    readonly Font?: WpsWordFont;
    // [真机待验] VBA Range.ParagraphFormat：行距/段前后距/对齐/缩进，单位 pt（缩进/段距）；
    //   Alignment 为 WdParagraphAlignment 整数（0=Left/1=Center/2=Right/3=Justify）。
    readonly ParagraphFormat?: WpsWordParagraphFormat;
    // [真机待验] VBA Range.Find：查找替换。Find.Execute 位置参顺序见下。
    readonly Find?: WpsWordFind;
    // [真机待验] VBA Range.InsertComment(text) 返回 Comment（同 doc.Comments.Add(Range, Text)）。
    InsertComment?(text: string): WpsWordComment;
  }

  // [真机待验] VBA Font 对象。布尔属性 VBA 用 True/False（JS 端 -1/0 或 true/false 均可能，真机坐实）。
  interface WpsWordFont {
    Bold: number | boolean;
    Italic: number | boolean;
    Underline: number;
    Size: number;
    Color: number;
    Name: string;
    /** [真机待验] WdColorIndex 整数（0=无高亮）。WPS 是否支持 HighlightColorIndex 待验。 */
    HighlightColorIndex: number;
  }

  // [真机待验] VBA ParagraphFormat 对象（单位 pt）。
  interface WpsWordParagraphFormat {
    LineSpacing: number;
    SpaceBefore: number;
    SpaceAfter: number;
    /** WdParagraphAlignment 整数。 */
    Alignment: number;
    FirstLineIndent: number;
    LeftIndent: number;
  }

  // [真机待验] VBA Find 对象。Execute 参数顺序（VBA 位置参，JS 端按位置传 undefined 占位）：
  //   Execute(FindText, MatchCase, MatchWholeWord, MatchWildcards, MatchSoundsLike,
  //           MatchAllWordForms, Forward, Wrap, Format, ReplaceWith, Replace)
  //   Wrap=1(wdFindContinue)，Replace=2(wdReplaceAll)。返回 boolean（是否找到）。
  interface WpsWordFind {
    Execute(
      findText?: string,
      matchCase?: boolean,
      matchWholeWord?: boolean,
      matchWildcards?: boolean,
      matchSoundsLike?: boolean,
      matchAllWordForms?: boolean,
      forward?: boolean,
      wrap?: number,
      format?: boolean,
      replaceWith?: string,
      replace?: number,
    ): boolean;
  }

  interface WpsDocument {
    // [真机待验] VBA Document.Tables（1-based Item）。
    readonly Tables?: WpsWordTables;
    // [真机待验] VBA Document.Comments（1-based Item）。
    readonly Comments?: WpsWordComments;
    // [真机待验] VBA Document.Sections（1-based Item）。
    readonly Sections?: WpsWordSections;
  }

  // [真机待验] VBA Tables 集合。Add(Range, NumRows, NumColumns) 返回 Table。
  interface WpsWordTables {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsWordTable;
    Add(range: WpsWordRange, numRows: number, numColumns: number): WpsWordTable;
  }

  // [真机待验] VBA Table。Rows.Count / Columns.Count；Cell(row, col) 1-based 返回 Cell；Range 含整表；Delete()。
  interface WpsWordTable {
    readonly Rows: { readonly Count: number };
    readonly Columns: { readonly Count: number };
    /** 1-based 行列。 */
    Cell(row: number, column: number): WpsWordCell;
    readonly Range: WpsWordRange;
    Delete(): void;
  }

  // [真机待验] VBA Cell.Range.Text 末尾带「单元格结束标记」(\r\a)，对外需 strip。
  interface WpsWordCell {
    readonly Range: WpsWordRange;
  }

  // [真机待验] VBA Comments 集合。Add(Range, Text) 返回 Comment；Item(i) 1-based；Comment.Delete()。
  interface WpsWordComments {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsWordComment;
    Add(range: WpsWordRange, text: string): WpsWordComment;
  }

  // [真机待验] VBA Comment。无原生 string id —— WPS comment id 模型不确定（见 deleteCommentById 注释）。
  interface WpsWordComment {
    /** [真机待验] VBA Comment.Index（1-based 整数）。当作稳定 id 的字符串化来源。 */
    readonly Index?: number;
    Delete(): void;
  }

  // [真机待验] VBA Sections 集合。
  interface WpsWordSections {
    readonly Count: number;
    /** 1-based。 */
    Item(index: number): WpsWordSection;
  }

  // [真机待验] VBA Section.Headers / Footers（WdHeaderFooterIndex：1=Primary/2=FirstPage/3=EvenPages）。
  interface WpsWordSection {
    readonly Headers: WpsWordHeadersFooters;
    readonly Footers: WpsWordHeadersFooters;
  }

  interface WpsWordHeadersFooters {
    /** 1-based（WdHeaderFooterIndex）。 */
    Item(index: number): { readonly Range: WpsWordRange };
  }
}

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

/**
 * 去掉 VBA 单元格结束标记（\r\a 或末尾 \r）。
 * [真机待验] VBA Cell.Range.Text 末尾带 \r\a（chr 7）；这里把 \r/\a 全清掉。
 */
function stripCellMark(text: unknown): string {
  // \x07 = BEL（VBA 单元格结束标记 \r\a 的 \a）；末尾 \r/\n 一并清掉。
  return typeof text === 'string' ? text.replace(/[\x07]/g, '').replace(/[\r\n]+$/g, '') : '';
}

/**
 * buildTableFingerprint — 与 Office.js WordAdapter.buildTableFingerprint 逐字等价（D-13）。
 * 首行文本 join('|') + '__rows×cols'（cols 从 values[0].length 推导）。
 * 必须与 Office.js 版完全一致：WPS 表与 Office.js 表共用同一 reverse 工具 + 指纹比对语义。
 */
function buildTableFingerprint(
  values: string[][] | null | undefined,
  rows: number,
): string {
  const firstRow = (values?.[0] ?? []) as string[];
  const cols = firstRow.length;
  return firstRow.join('|') + `__${rows}x${cols}`;
}

/** 读整张表的 values（2D 字符串数组），用于指纹生成/比对。[真机待验] Cell 文本含标记，需 strip。 */
function readTableValues(table: WpsWordTable): string[][] {
  const rows = table.Rows.Count;
  const cols = table.Columns.Count;
  const values: string[][] = [];
  for (let r = 1; r <= rows; r++) {
    const row: string[] = [];
    for (let c = 1; c <= cols; c++) {
      row.push(stripCellMark(table.Cell(r, c).Range.Text));
    }
    values.push(row);
  }
  return values;
}

// --- VBA 枚举映射（[真机待验] 数值与 Office.js 字符串语义对齐）-----------------

/** WdParagraphAlignment：Office.js 字符串 → VBA 整数。[真机待验] */
const WD_ALIGNMENT_TO_INT: Record<string, number> = {
  Left: 0,
  Centered: 1,
  Center: 1,
  Right: 2,
  Justified: 3,
  Justify: 3,
};
const WD_ALIGNMENT_TO_STR: Record<number, string> = {
  0: 'Left',
  1: 'Centered',
  2: 'Right',
  3: 'Justified',
};

/** WdUnderline：Office.js 字符串 → VBA 整数。[真机待验] */
const WD_UNDERLINE_TO_INT: Record<string, number> = {
  None: 0,
  Single: 1,
  Double: 3,
  Word: 4,
};
const WD_UNDERLINE_TO_STR: Record<number, string> = {
  0: 'None',
  1: 'Single',
  3: 'Double',
  4: 'Word',
};

/** WdHeaderFooterIndex：Office.js type 字符串 → VBA 整数。[真机待验] */
const WD_HEADER_FOOTER_INDEX: Record<string, number> = {
  Primary: 1,
  FirstPage: 2,
  EvenPages: 3,
};

/**
 * #RRGGBB / 颜色名 → VBA BGR 整数（[真机待验]）。
 * VBA Font.Color 用 BGR（与 Office.js 的 #RRGGBB 反序）。仅处理 #RRGGBB；其余原样回退 0（黑）。
 */
function hexToBgr(color: unknown): number {
  if (typeof color !== 'string') return 0;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(color.trim());
  if (!m) return 0;
  const rgb = m[1];
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return (b << 16) | (g << 8) | r; // BGR
}

/** VBA BGR 整数 → #RRGGBB（[真机待验]，与 hexToBgr 互逆）。 */
function bgrToHex(bgr: unknown): string {
  if (typeof bgr !== 'number' || bgr < 0) return '#000000';
  const b = (bgr >> 16) & 0xff;
  const g = (bgr >> 8) & 0xff;
  const r = bgr & 0xff;
  const h = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
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

  // ---- 段落定位 helper（index 快路径 + 内容指纹降级，对位 Office.js restoreParagraphAt）----

  /**
   * 双重定位：先用 0-based index 快路径（内容指纹与 expectedText 一致），不中则全文遍历指纹。
   * 返回 1-based VBA Item 序号；找不到返回 -1。
   */
  private locateParagraph1Based(index: number, expectedText: string): number {
    const paras = getDoc().Paragraphs;
    const norm = normalizeForMatch(expectedText);
    // 快路径：index（0-based）→ VBA index+1
    if (index >= 0 && index < paras.Count) {
      if (normalizeForMatch(paras.Item(index + 1).Range.Text) === norm) {
        return index + 1;
      }
    }
    // 降级遍历（防 index drift）
    for (let i = 1; i <= paras.Count; i++) {
      if (normalizeForMatch(paras.Item(i).Range.Text) === norm) {
        return i;
      }
    }
    return -1;
  }

  // ---- WORD-01：setCharacterFormat → restoreRangeFont -----------------------

  /**
   * set_word_character_format 工具调用（对位 Office.js setCharacterFormat）。
   * 写前读 font before-image，only-if-present 写入。inverse = restore_range_font。
   * [真机待验] VBA Range.Font 成员（Bold/Italic/Underline/Size/Color/Name/HighlightColorIndex）、
   *   布尔语义（True/False vs -1/0）、Color 为 BGR 整数、Underline/Highlight 整数枚举。
   */
  async setCharacterFormat(
    args: Record<string, unknown>,
  ): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
    const index = args.paragraphIndex as number;
    const font = (args.font ?? {}) as Record<string, unknown>;
    try {
      const paras = getDoc().Paragraphs;
      if (index < 0 || index >= paras.Count) {
        throw new HostApiError(`setCharacterFormat: paragraphIndex=${index} 越界（共 ${paras.Count} 段）`);
      }
      const range = paras.Item(index + 1).Range;
      const f = range.Font;
      if (!f) throw new HostApiError('setCharacterFormat: Range.Font 不可用（WPS 版本/真机待验）');

      // before-image（统一转成 Office.js 同形：bold/italic 布尔，underline/color 字符串，highlightColor 字符串|null）
      const beforeImage: Record<string, unknown> = {
        bold: Boolean(f.Bold),
        italic: Boolean(f.Italic),
        underline: WD_UNDERLINE_TO_STR[f.Underline] ?? 'None',
        size: f.Size,
        color: bgrToHex(f.Color),
        name: f.Name,
        highlightColor: f.HighlightColorIndex && f.HighlightColorIndex !== 0 ? String(f.HighlightColorIndex) : null,
      };
      const afterText = stripParaMark(range.Text);

      // only-if-present 写入
      if (font.bold !== undefined) f.Bold = font.bold ? -1 : 0; // [真机待验] -1=True
      if (font.italic !== undefined) f.Italic = font.italic ? -1 : 0;
      if (font.underline !== undefined) f.Underline = WD_UNDERLINE_TO_INT[font.underline as string] ?? 0;
      if (font.size !== undefined) f.Size = font.size as number;
      if (font.color !== undefined) f.Color = hexToBgr(font.color);
      if (font.name !== undefined) f.Name = font.name as string;
      // WORD-06：highlightColor null = 移除高亮（HighlightColorIndex=0）；非 null 视作整数索引字符串
      if (font.highlightColor !== undefined) {
        f.HighlightColorIndex = font.highlightColor === null ? 0 : Number(font.highlightColor) || 0;
      }

      return { beforeImage, afterText };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word setCharacterFormat 失败', err);
    }
  }

  /** restore_range_font inverse（set_word_character_format 的 reverse）。Record 签名。 */
  async restoreRangeFont(args: Record<string, unknown>): Promise<void> {
    const index = args.index as number;
    const expectedText = args.expectedText as string;
    const before = (args.before ?? {}) as Record<string, unknown>;
    try {
      const at = this.locateParagraph1Based(index, expectedText);
      if (at === -1) throw new HostApiError('restoreRangeFont: 目标段落未找到（内容已变或被删）');
      const f = getDoc().Paragraphs.Item(at).Range.Font;
      if (!f) throw new HostApiError('restoreRangeFont: Range.Font 不可用（真机待验）');
      // D-07：null/undefined 跳过（保留混合态）；highlightColor null 例外（要写回 0=移除高亮）
      if (before.bold !== null && before.bold !== undefined) f.Bold = before.bold ? -1 : 0;
      if (before.italic !== null && before.italic !== undefined) f.Italic = before.italic ? -1 : 0;
      if (before.underline !== null && before.underline !== undefined)
        f.Underline = WD_UNDERLINE_TO_INT[before.underline as string] ?? 0;
      if (before.size !== null && before.size !== undefined) f.Size = before.size as number;
      if (before.color !== null && before.color !== undefined) f.Color = hexToBgr(before.color);
      if (before.name !== null && before.name !== undefined) f.Name = before.name as string;
      if (before.highlightColor !== undefined)
        f.HighlightColorIndex = before.highlightColor === null ? 0 : Number(before.highlightColor) || 0;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word restoreRangeFont 失败', err);
    }
  }

  // ---- WORD-02：setParaFormat → restoreParagraphFormat ----------------------

  /**
   * set_word_paragraph_format 工具调用（对位 Office.js setParaFormat）。
   * before-image 字段：lineSpacing/spaceBefore/spaceAfter/alignment/indent(=FirstLineIndent)/leftIndent。
   * [真机待验] VBA Range.ParagraphFormat 成员（单位 pt；Alignment 整数枚举）。
   */
  async setParaFormat(
    args: Record<string, unknown>,
  ): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
    const index = args.paragraphIndex as number;
    const format = (args.format ?? {}) as Record<string, unknown>;
    try {
      const paras = getDoc().Paragraphs;
      if (index < 0 || index >= paras.Count) {
        throw new HostApiError(`setParaFormat: paragraphIndex=${index} 越界（共 ${paras.Count} 段）`);
      }
      const range = paras.Item(index + 1).Range;
      const pf = range.ParagraphFormat;
      if (!pf) throw new HostApiError('setParaFormat: Range.ParagraphFormat 不可用（真机待验）');

      const beforeImage: Record<string, unknown> = {
        lineSpacing: pf.LineSpacing,
        spaceBefore: pf.SpaceBefore,
        spaceAfter: pf.SpaceAfter,
        alignment: WD_ALIGNMENT_TO_STR[pf.Alignment] ?? 'Left',
        indent: pf.FirstLineIndent, // D-06: indent ↔ FirstLineIndent
        leftIndent: pf.LeftIndent,
      };
      const afterText = stripParaMark(range.Text);

      if (format.lineSpacing !== undefined) pf.LineSpacing = format.lineSpacing as number;
      if (format.spaceBefore !== undefined) pf.SpaceBefore = format.spaceBefore as number;
      if (format.spaceAfter !== undefined) pf.SpaceAfter = format.spaceAfter as number;
      if (format.alignment !== undefined) pf.Alignment = WD_ALIGNMENT_TO_INT[format.alignment as string] ?? 0;
      if (format.indent !== undefined) pf.FirstLineIndent = format.indent as number;
      if (format.leftIndent !== undefined) pf.LeftIndent = format.leftIndent as number;

      return { beforeImage, afterText };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word setParaFormat 失败', err);
    }
  }

  /** restore_paragraph_format inverse（set_word_paragraph_format 的 reverse）。Record 签名。 */
  async restoreParagraphFormat(args: Record<string, unknown>): Promise<void> {
    const index = args.index as number;
    const expectedText = args.expectedText as string;
    const before = (args.before ?? {}) as Record<string, unknown>;
    try {
      const at = this.locateParagraph1Based(index, expectedText);
      if (at === -1) throw new HostApiError('restoreParagraphFormat: 目标段落未找到');
      const pf = getDoc().Paragraphs.Item(at).Range.ParagraphFormat;
      if (!pf) throw new HostApiError('restoreParagraphFormat: Range.ParagraphFormat 不可用（真机待验）');
      if (before.lineSpacing !== null && before.lineSpacing !== undefined) pf.LineSpacing = before.lineSpacing as number;
      if (before.spaceBefore !== null && before.spaceBefore !== undefined) pf.SpaceBefore = before.spaceBefore as number;
      if (before.spaceAfter !== null && before.spaceAfter !== undefined) pf.SpaceAfter = before.spaceAfter as number;
      if (before.alignment !== null && before.alignment !== undefined)
        pf.Alignment = WD_ALIGNMENT_TO_INT[before.alignment as string] ?? 0;
      if (before.indent !== null && before.indent !== undefined) pf.FirstLineIndent = before.indent as number;
      if (before.leftIndent !== null && before.leftIndent !== undefined) pf.LeftIndent = before.leftIndent as number;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word restoreParagraphFormat 失败', err);
    }
  }

  // ---- WORD-03：applyParagraphStyle → restoreParagraphStyle -----------------

  /**
   * apply_paragraph_style 工具调用（对位 Office.js applyParagraphStyle）。
   * before-image = { style, styleBuiltIn }；styleBuiltIn 在 WPS 无对应内置枚举属性，
   * 这里两者都存当前 Style 名（VBA 仅 Range.Style 一个写口）。还原优先 styleBuiltIn。
   * [真机待验] VBA Range.Style 是 locale 敏感字符串（中文版「标题 1」），styleName 传英文
   *   内置名（Heading1）在中文 WPS 可能 ItemNotFound — 真机大概率要做 locale 映射。
   */
  async applyParagraphStyle(
    args: Record<string, unknown>,
  ): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
    const index = args.paragraphIndex as number;
    const styleName = args.styleName as string;
    try {
      const paras = getDoc().Paragraphs;
      if (index < 0 || index >= paras.Count) {
        throw new HostApiError(`applyParagraphStyle: paragraphIndex=${index} 越界（共 ${paras.Count} 段）`);
      }
      const range = paras.Item(index + 1).Range;
      const curStyle = range.Style;
      const curName = typeof curStyle === 'string' ? curStyle : (curStyle?.NameLocal ?? '');
      const beforeImage: Record<string, unknown> = {
        style: curName,
        styleBuiltIn: curName, // WPS 无 styleBuiltIn 独立枚举 → 用同一名兜底（真机待验）
      };
      const afterText = stripParaMark(range.Text);

      // locale-sensitive 写入（[真机待验]：中文 WPS 可能需要 locale 名）
      (range as unknown as { Style: string }).Style = styleName;

      return { beforeImage, afterText };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word applyParagraphStyle 失败', err);
    }
  }

  /** restore_paragraph_style inverse（apply_paragraph_style 的 reverse）。Record 签名。 */
  async restoreParagraphStyle(args: Record<string, unknown>): Promise<void> {
    const index = args.index as number;
    const expectedText = args.expectedText as string;
    const before = (args.before ?? {}) as Record<string, unknown>;
    try {
      const at = this.locateParagraph1Based(index, expectedText);
      if (at === -1) throw new HostApiError('restoreParagraphStyle: 目标段落未找到');
      const range = getDoc().Paragraphs.Item(at).Range;
      // 优先 styleBuiltIn（非 'Other'），否则回退 style
      const restoreName =
        before.styleBuiltIn !== null && before.styleBuiltIn !== undefined && before.styleBuiltIn !== 'Other'
          ? (before.styleBuiltIn as string)
          : (before.style as string | undefined);
      if (restoreName !== undefined && restoreName !== null && restoreName !== '') {
        (range as unknown as { Style: string }).Style = restoreName;
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word restoreParagraphStyle 失败', err);
    }
  }

  // ---- WORD-04：findAndReplace → restoreRangeSnapshot (快照式 undo) ----------

  /**
   * find_and_replace 工具调用（对位 Office.js findAndReplace）。
   * 返回 { snapshot, replacedCount, overLimit }，与 Office.js 形状逐字一致。
   *
   * WPS 同步 VBA 实现：用 Range.Find.Execute(... Replace=wdReplaceAll) 一把替换；
   * 替换前先逐段落判定哪些段落含 searchText → 记 before-image 快照（D-09），
   * 超 100 段放弃快照（overLimit）但仍执行替换（D-10 noop+gate）。
   * replacedCount 通过「替换前匹配总段落数」近似（[真机待验]：VBA Find.Execute(wdReplaceAll)
   *   不直接返回替换计数；这里以受影响段落数近似，真机可改用循环 Execute 精确计数）。
   */
  async findAndReplace(
    args: Record<string, unknown>,
  ): Promise<{
    snapshot: Array<{ paragraphIndex: number; text: string }>;
    replacedCount: number;
    overLimit: boolean;
  }> {
    const searchText = args.searchText as string;
    const replaceText = args.replaceText as string;
    const matchCase = (args.matchCase as boolean | undefined) ?? false;
    const matchWholeWord = (args.matchWholeWord as boolean | undefined) ?? false;
    const FIND_AND_REPLACE_SNAPSHOT_LIMIT = 100;

    try {
      const doc = getDoc();
      const paras = doc.Paragraphs;
      const cmp = (hay: string) => (matchCase ? hay : hay.toLowerCase());
      const needle = cmp(searchText);

      // Step 1+2：受影响段落集合 + before-image 快照
      const affected: Array<{ paragraphIndex: number; text: string }> = [];
      for (let i = 1; i <= paras.Count; i++) {
        const raw = paras.Item(i).Range.Text;
        const text = typeof raw === 'string' ? raw : '';
        if (cmp(text).includes(needle)) {
          affected.push({ paragraphIndex: i - 1, text: stripParaMark(raw) });
        }
      }

      if (affected.length === 0) {
        return { snapshot: [], replacedCount: 0, overLimit: false };
      }

      const overLimit = affected.length > FIND_AND_REPLACE_SNAPSHOT_LIMIT;
      const snapshot = overLimit ? [] : affected;

      // Step 3：执行替换（[真机待验] Find.Execute(wdReplaceAll) 全文一把替换；
      //   wrap=1(wdFindContinue), replace=2(wdReplaceAll)）。无 Find 时降级逐段字符串替换。
      const find = doc.Content.Find;
      if (find && typeof find.Execute === 'function') {
        find.Execute(
          searchText, matchCase, matchWholeWord,
          false, false, false, true, 1, false,
          replaceText, 2,
        );
      } else {
        // 降级：逐段 string replace（[真机待验] 不保证富文本保真，仅纯文本兜底）
        for (let i = 1; i <= paras.Count; i++) {
          const range = paras.Item(i).Range;
          const raw = typeof range.Text === 'string' ? range.Text : '';
          if (cmp(raw).includes(needle)) {
            const re = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
            range.Text = raw.replace(re, replaceText);
          }
        }
      }

      // replacedCount 近似 = 受影响段落数（[真机待验]：精确 occurrence 数需循环 Execute）
      return { snapshot, replacedCount: affected.length, overLimit };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word findAndReplace 失败', err);
    }
  }

  /** restore_range_snapshot inverse（find_and_replace 的 reverse）。按 paragraphIndex 逐段写回。Record 签名。 */
  async restoreRangeSnapshot(args: Record<string, unknown>): Promise<void> {
    const snapshot = args.snapshot as Array<{ paragraphIndex: number; text: string }> | undefined;
    if (!snapshot || snapshot.length === 0) return; // overLimit 空快照 → 无需还原
    try {
      const paras = getDoc().Paragraphs;
      for (const { paragraphIndex, text } of snapshot) {
        const vbaIndex = paragraphIndex + 1;
        if (vbaIndex < 1 || vbaIndex > paras.Count) continue; // 越界跳过（诚实，不 crash）
        paras.Item(vbaIndex).Range.Text = text + '\r';
      }
    } catch (err) {
      throw new HostApiError('WPS Word restoreRangeSnapshot 失败', err);
    }
  }

  // ---- WORD-05：insertTable → deleteTableByMarker ---------------------------

  /**
   * insert_table 工具调用（对位 Office.js insertTable）。返回 { contentFingerprint, rows, cols, afterParagraphIndex }。
   * [真机待验] VBA Tables.Add(Range, rows, cols)；afterParagraphIndex 用段落 Range 折叠到末尾后插。
   */
  async insertTable(
    args: Record<string, unknown>,
  ): Promise<{
    contentFingerprint: string;
    rows: number;
    cols: number;
    afterParagraphIndex: number | undefined;
  }> {
    const rows = args.rows as number;
    const cols = args.cols as number;
    const afterParagraphIndex = args.afterParagraphIndex as number | undefined;
    const content = args.content as string[][] | undefined;

    try {
      const doc = getDoc();
      const tables = doc.Tables;
      if (!tables || typeof tables.Add !== 'function') {
        throw new HostApiError('insertTable: Document.Tables.Add 不可用（真机待验）');
      }

      // 插入位置 Range
      let anchor: WpsWordRange;
      if (afterParagraphIndex !== undefined) {
        const paras = doc.Paragraphs;
        if (afterParagraphIndex < 0 || afterParagraphIndex >= paras.Count) {
          throw new HostApiError(
            `insertTable: afterParagraphIndex=${afterParagraphIndex} 越界（共 ${paras.Count} 段）`,
          );
        }
        anchor = paras.Item(afterParagraphIndex + 1).Range;
        anchor.Collapse(0); // [真机待验] 0=wdCollapseEnd 折叠到段末
      } else {
        anchor = doc.Range();
        anchor.Collapse(0); // 文末
      }

      const table = tables.Add(anchor, rows, cols);

      // 填内容（[真机待验] 逐 Cell 写 Range.Text）
      if (content) {
        for (let r = 0; r < content.length && r < rows; r++) {
          for (let c = 0; c < (content[r]?.length ?? 0) && c < cols; c++) {
            table.Cell(r + 1, c + 1).Range.Text = String(content[r][c]);
          }
        }
      }

      const values = readTableValues(table);
      const contentFingerprint = buildTableFingerprint(values, table.Rows.Count);
      return { contentFingerprint, rows, cols, afterParagraphIndex };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word insertTable 失败', err);
    }
  }

  /** delete_table_by_marker inverse（insert_table 的 reverse）。按 rows/cols/指纹定位并删表。Record 签名。 */
  async deleteTableByMarker(args: Record<string, unknown>): Promise<void> {
    const contentFingerprint = args.contentFingerprint as string;
    const rows = args.rows as number;
    const cols = args.cols as number;
    try {
      const tables = getDoc().Tables;
      if (!tables) throw new HostApiError('deleteTableByMarker: Document.Tables 不可用（真机待验）');
      for (let i = 1; i <= tables.Count; i++) {
        const table = tables.Item(i);
        const values = readTableValues(table);
        const tableRows = table.Rows.Count;
        const tableCols = (values[0] ?? []).length;
        const fp = buildTableFingerprint(values, tableRows);
        if (tableRows === rows && tableCols === cols && fp === contentFingerprint) {
          table.Delete();
          return;
        }
      }
      throw new HostApiError(
        `deleteTableByMarker: 找不到目标表格（fingerprint=${contentFingerprint} rows=${rows} cols=${cols}）`,
      );
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word deleteTableByMarker 失败', err);
    }
  }

  // ---- WORD-07：setWordListFormat（inverse = noop_inverse，无 adapter 方法）---

  /**
   * set_word_list_format 工具调用（对位 Office.js setWordListFormat）。undo = noop_inverse（无 inverse 方法）。
   * [真机待验] WPS 列表 API：VBA Range.ListFormat.ApplyBulletDefault() / ApplyNumberDefault()。
   *   bulletStyle/numberStyle/level 在 WPS 的精确映射未知 → 仅用默认项目符号/编号兜底。
   */
  async setWordListFormat(args: Record<string, unknown>): Promise<void> {
    const paragraphIndex = args.paragraphIndex as number;
    const listType = args.listType as 'bullet' | 'number';
    try {
      const paras = getDoc().Paragraphs;
      if (paragraphIndex < 0 || paragraphIndex >= paras.Count) {
        throw new HostApiError(`setWordListFormat: 目标段落 index=${paragraphIndex} 越界（共 ${paras.Count} 段）`);
      }
      const range = paras.Item(paragraphIndex + 1).Range;
      // [真机待验] VBA Range.ListFormat.ApplyBulletDefault / ApplyNumberDefault
      const lf = (range as unknown as { ListFormat?: { ApplyBulletDefault?: () => void; ApplyNumberDefault?: () => void } }).ListFormat;
      if (!lf) {
        throw new HostApiError('setWordListFormat: Range.ListFormat 不可用（真机待验）');
      }
      if (listType === 'bullet') {
        lf.ApplyBulletDefault?.();
      } else {
        lf.ApplyNumberDefault?.();
      }
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word setWordListFormat 失败', err);
    }
  }

  // ---- WORD-08：insertWordComment → deleteCommentById -----------------------

  /**
   * insert_word_comment 工具调用（对位 Office.js insertWordComment）。返回 { commentId }。
   * 批注内容自动加 '[Aster] ' 前缀（G-A 透明性）。写后回读 comment.Index 验证（R3）。
   *
   * [真机待验] commentId 模型：Office.js Comment 有 string id；WPS/VBA Comment 仅有 1-based Index（整数）。
   *   这里把 String(Index) 当 commentId（不稳定：删前面批注后 Index 会漂移）。
   *   delete 时按「当前文档里 Index === commentId 的批注」删 —— 真机大概率要换更稳的方案
   *   （如按批注文本指纹匹配，或 WPS 是否暴露 Comment.ID）。
   */
  async insertWordComment(args: Record<string, unknown>): Promise<{ commentId: string }> {
    const paragraphIndex = args.paragraphIndex as number;
    const searchText = args.searchText as string | undefined;
    const commentText = args.commentText as string;
    const COMMENT_PREFIX = '[Aster] ';
    try {
      const doc = getDoc();
      const paras = doc.Paragraphs;
      if (paragraphIndex < 0 || paragraphIndex >= paras.Count) {
        throw new HostApiError(`insertWordComment: 目标段落 index=${paragraphIndex} 越界（共 ${paras.Count} 段）`);
      }
      const comments = doc.Comments;
      if (!comments || typeof comments.Add !== 'function') {
        throw new HostApiError('insertWordComment: Document.Comments.Add 不可用（真机待验）');
      }

      // 定位 anchor range：searchText 在段内搜（[真机待验] 简化为整段；段内子串定位需 Find，真机补）
      const anchor = paras.Item(paragraphIndex + 1).Range;
      if (searchText && !normalizeForMatch(anchor.Text).includes(normalizeForMatch(searchText))) {
        throw new HostApiError(`insertWordComment: 在目标段落中找不到 searchText="${searchText}"`);
      }

      const fullContent = `${COMMENT_PREFIX}${commentText}`;
      const comment = comments.Add(anchor, fullContent);

      // 写后回读 Index（R3 验证）
      const idx = comment?.Index;
      if (idx === undefined || idx === null) {
        throw new HostApiError('insertWordComment: 批注插入后 Index 为空（疑似 WPS 静默失败）');
      }
      return { commentId: String(idx) };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word insertWordComment 失败', err);
    }
  }

  /** delete_comment_by_id inverse（insert_word_comment 的 reverse）。按 Index 字符串匹配删。Record 签名。 */
  async deleteCommentById(args: Record<string, unknown>): Promise<void> {
    const commentId = args.commentId as string;
    try {
      const comments = getDoc().Comments;
      if (!comments) throw new HostApiError('deleteCommentById: Document.Comments 不可用（真机待验）');
      for (let i = 1; i <= comments.Count; i++) {
        const c = comments.Item(i);
        if (String(c?.Index ?? i) === commentId) {
          c.Delete();
          return;
        }
      }
      throw new HostApiError(`deleteCommentById: 找不到 comment id="${commentId}"`);
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word deleteCommentById 失败', err);
    }
  }

  // ---- WORD-09：setWordHeaderFooter → restoreWordHeaderFooter ----------------

  /**
   * set_word_header_footer 工具调用（对位 Office.js setWordHeaderFooter）。
   * before-image = header/footer 当前文本。写后回读验证（R3，fail-honest）。
   * [真机待验] VBA Section.Headers.Item(WdHeaderFooterIndex).Range.Text 读写语义。
   */
  async setWordHeaderFooter(
    args: Record<string, unknown>,
  ): Promise<{ beforeText: string; type: string; headerOrFooter: string; sectionIndex: number }> {
    const text = args.text as string;
    const headerOrFooter = (args.headerOrFooter as string) ?? 'header';
    const type = (args.type as string | undefined) ?? 'Primary';
    const sectionIndex = (args.sectionIndex as number | undefined) ?? 0;
    try {
      const sections = getDoc().Sections;
      if (!sections) throw new HostApiError('setWordHeaderFooter: Document.Sections 不可用（真机待验）');
      if (sectionIndex < 0 || sectionIndex >= sections.Count) {
        throw new HostApiError(`setWordHeaderFooter: sectionIndex=${sectionIndex} 越界（共 ${sections.Count} sections）`);
      }
      const section = sections.Item(sectionIndex + 1);
      const hfIndex = WD_HEADER_FOOTER_INDEX[type] ?? 1;
      const range = (headerOrFooter === 'header' ? section.Headers : section.Footers).Item(hfIndex).Range;

      const beforeText = stripParaMark(range.Text);
      range.Text = text;

      // R3 写后回读（fail-honest）：网页/WPS 若静默 no-op，诚实报错不假报成功
      const afterText = stripParaMark(range.Text);
      if (normalizeForMatch(afterText) !== normalizeForMatch(text) && text.length > 0) {
        throw new HostApiError(
          `setWordHeaderFooter: 写后回读不一致（期望「${text}」，实际「${afterText}」），疑似 WPS 静默忽略页眉/页脚写入`,
        );
      }
      return { beforeText, type, headerOrFooter, sectionIndex };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word setWordHeaderFooter 失败', err);
    }
  }

  /** restore_word_header_footer inverse（set_word_header_footer 的 reverse）。Record 签名。 */
  async restoreWordHeaderFooter(args: Record<string, unknown>): Promise<void> {
    const type = (args.type as string | undefined) ?? 'Primary';
    const sectionIndex = (args.sectionIndex as number | undefined) ?? 0;
    const headerOrFooter = (args.headerOrFooter as string | undefined) ?? 'header';
    const beforeText = args.beforeText as string;
    try {
      const sections = getDoc().Sections;
      if (!sections) throw new HostApiError('restoreWordHeaderFooter: Document.Sections 不可用（真机待验）');
      if (sectionIndex < 0 || sectionIndex >= sections.Count) {
        throw new HostApiError(`restoreWordHeaderFooter: sectionIndex=${sectionIndex} 越界`);
      }
      const section = sections.Item(sectionIndex + 1);
      const hfIndex = WD_HEADER_FOOTER_INDEX[type] ?? 1;
      const range = (headerOrFooter === 'header' ? section.Headers : section.Footers).Item(hfIndex).Range;
      range.Text = beforeText;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word restoreWordHeaderFooter 失败', err);
    }
  }

  // ---- WORD-10：editTableCell → restoreTableCell ----------------------------

  /**
   * edit_table_cell 工具调用（对位 Office.js editTableCell）。
   * 双重定位：tableIndex 快路径 + tableFingerprint 遍历（D-06）。before-image = cell 当前文本。
   * 写后回读验证（R3，fail-honest）。返回「编辑后」指纹（MR-1，与 Office.js 一致）。
   * [真机待验] VBA Table.Cell(row,col).Range.Text 读写（含 \r\a 标记需 strip）、坐标 1-based。
   */
  async editTableCell(
    args: Record<string, unknown>,
  ): Promise<{ beforeValue: string; tableFingerprint: string; tableIndex: number; rowIndex: number; columnIndex: number }> {
    const tableIndex = args.tableIndex as number;
    const rowIndex = args.rowIndex as number;
    const columnIndex = args.columnIndex as number;
    const text = args.text as string;
    const providedFingerprint = args.tableFingerprint as string | undefined;
    try {
      const tables = getDoc().Tables;
      if (!tables || tables.Count === 0) throw new HostApiError('editTableCell: 文档中没有表格');

      const resolvedIndex = this.resolveTable0Based(tables, tableIndex, providedFingerprint);
      if (resolvedIndex === -1) {
        throw new HostApiError(
          `editTableCell: 找不到目标表格（tableIndex=${tableIndex}, fingerprint=${providedFingerprint ?? '无'}）`,
        );
      }

      const table = tables.Item(resolvedIndex + 1);
      const totalRows = table.Rows.Count;
      const totalCols = table.Columns.Count;
      if (rowIndex < 0 || rowIndex >= totalRows || columnIndex < 0 || columnIndex >= totalCols) {
        throw new HostApiError(
          `editTableCell: 坐标越界 row=${rowIndex} col=${columnIndex}（共 ${totalRows}×${totalCols}）`,
        );
      }

      const cellRange = table.Cell(rowIndex + 1, columnIndex + 1).Range;
      const beforeValue = stripCellMark(cellRange.Text);

      cellRange.Text = text;

      // R3 写后回读（fail-honest）
      const after = stripCellMark(cellRange.Text);
      if (after !== text) {
        throw new HostApiError(
          `editTableCell: 写后回读不一致（期望「${text}」，实际「${after}」），疑似 WPS 静默忽略单元格写入`,
        );
      }

      // MR-1：存「编辑后」指纹（含本次写入结果）
      const tableFingerprint = buildTableFingerprint(readTableValues(table), table.Rows.Count);
      return { beforeValue, tableFingerprint, tableIndex: resolvedIndex, rowIndex, columnIndex };
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word editTableCell 失败', err);
    }
  }

  /** restore_table_cell inverse（edit_table_cell 的 reverse）。双重定位还原 before-image。Record 签名。 */
  async restoreTableCell(args: Record<string, unknown>): Promise<void> {
    const tableIndex = args.tableIndex as number;
    const tableFingerprint = args.tableFingerprint as string | undefined;
    const rowIndex = args.rowIndex as number;
    const columnIndex = args.columnIndex as number;
    const beforeValue = args.beforeValue as string;
    try {
      const tables = getDoc().Tables;
      if (!tables) throw new HostApiError('restoreTableCell: Document.Tables 不可用（真机待验）');

      const resolvedIndex = this.resolveTable0Based(tables, tableIndex, tableFingerprint);
      if (resolvedIndex === -1) {
        throw new HostApiError(
          `restoreTableCell: 找不到目标表格（tableIndex=${tableIndex}, fingerprint=${tableFingerprint ?? '无'}）`,
        );
      }
      const table = tables.Item(resolvedIndex + 1);
      if (rowIndex < 0 || rowIndex >= table.Rows.Count || columnIndex < 0 || columnIndex >= table.Columns.Count) {
        throw new HostApiError(`restoreTableCell: 坐标越界 row=${rowIndex} col=${columnIndex}`);
      }
      table.Cell(rowIndex + 1, columnIndex + 1).Range.Text = beforeValue;
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('WPS Word restoreTableCell 失败', err);
    }
  }

  /**
   * 表格双重定位（与 Office.js editTableCell 三策略一致），返回 0-based table index；找不到 -1。
   * 策略 1：tableIndex 快路径 + fingerprint 验证；2：fingerprint 遍历；3：无 fingerprint 裸 tableIndex。
   */
  private resolveTable0Based(
    tables: WpsWordTables,
    tableIndex: number,
    providedFingerprint: string | undefined,
  ): number {
    // 策略 1
    if (tableIndex >= 0 && tableIndex < tables.Count) {
      const t = tables.Item(tableIndex + 1);
      const fp = buildTableFingerprint(readTableValues(t), t.Rows.Count);
      if (!providedFingerprint || fp === providedFingerprint) return tableIndex;
    }
    // 策略 2
    if (providedFingerprint) {
      for (let i = 0; i < tables.Count; i++) {
        const t = tables.Item(i + 1);
        const fp = buildTableFingerprint(readTableValues(t), t.Rows.Count);
        if (fp === providedFingerprint) return i;
      }
    }
    // 策略 3
    if (!providedFingerprint && tableIndex >= 0 && tableIndex < tables.Count) {
      return tableIndex;
    }
    return -1;
  }
}
