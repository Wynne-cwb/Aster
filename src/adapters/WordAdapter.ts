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

/**
 * normalizeText — 规范化段落文本，消除 Office.js 末尾 \r\n 格式差异（Pitfall 2 防 false-skip）。
 * Word API 返回的段落 text 末尾可能含 \r（段落结束标记），导致字符串对比失败。
 * 处理步骤：\r\n → \n，再 trimEnd()。
 */
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}

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
   * 删除文档中内容与 text 匹配的段落（从尾到头遍历，优先删最近追加的同名段）。
   *
   * append_paragraph 的精确反操作（Phase 5 inverse — AGENT-10/11 undo path）。
   * normalizeText 规范化消除 Office.js 末尾 \r\n 格式差异（Pitfall 2 防 false-skip）。
   *
   * A-06 边界：Word.run 闭包内消费所有 proxy，出闭包前 await ctx.sync()，不返回 proxy。
   *
   * 签名遵循 DocumentAdapterForReplay.deleteParagraphByContent 接口约定：
   *   args: Record<string, unknown>  → args.text as string
   * 这样 operationLog.executeReverse 可直接传 reverse.args 对象（不拆参），
   * 与 ExcelAdapter.overwriteRange / PptAdapter.deleteSlideByTitle 的对象签名一致。
   * （Phase 5 真机 UAT 实证：旧 `(text: string)` 位置签名收到 replay 传来的对象 → normalizeText
   *  对对象调用 .replace 抛 TypeError → 全部 inverse 被误判 skipped_error。见 05-VERIFICATION。）
   *
   * 错误处理：
   *   - 目标段落不存在 → 抛 HostApiError（'目标段落已不存在'）
   *   - Word.run 异常 → 包成 HostApiError（'Word deleteParagraphByContent 失败'）
   */
  async deleteParagraphByContent(args: Record<string, unknown>): Promise<void> {
    const text = args.text as string;
    try {
      await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        const normalTarget = normalizeText(text);
        for (let i = paras.items.length - 1; i >= 0; i--) {
          if (normalizeText(paras.items[i].text) === normalTarget) {
            paras.items[i].delete();
            await ctx.sync();
            return;
          }
        }

        throw new HostApiError('Word deleteParagraphByContent: 目标段落已不存在', undefined);
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word deleteParagraphByContent 失败', err);
    }
  }

  /**
   * 读取与 text 匹配的段落当前内容（供 replayUndoAll/Single 手动改侦测 D-11 — AGENT-09/11）。
   *
   * operationLog.readTargetState 以 { text: postState.content }（追加时的原文）调用本方法，
   * 用返回值与 postState 快照比对（isTargetStateConsistent）：
   *   - 找到（内容未变）→ 返回当前段落 text → 判一致 → 正常 deleteParagraphByContent 回滚
   *   - 未找到（被手动改/删，原文已不存在）→ 返回 '' → 与快照不一致 → 标 skipped_manual，
   *     跳过该步、保留用户手改内容（不删）。
   *
   * 从尾到头遍历，匹配规则与 deleteParagraphByContent 一致（normalizeText 归一，防末尾 \r 误判）。
   *
   * 签名遵循 DocumentAdapterForReplay.readWordParagraph 接口约定（args 对象，非位置参）。
   * A-06：proxy 不出 Word.run 闭包；错误 → HostApiError（readTargetState 再 catch 成 undefined 保守通过）。
   */
  async readWordParagraph(args: Record<string, unknown>): Promise<string> {
    const text = args.text as string;
    try {
      return await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        const normalTarget = normalizeText(text);
        for (let i = paras.items.length - 1; i >= 0; i--) {
          if (normalizeText(paras.items[i].text) === normalTarget) {
            return paras.items[i].text as string;
          }
        }
        // 原文已不存在（被手动改/删）→ 返回空串，触发 skipped_manual
        return '';
      });
    } catch (err) {
      throw new HostApiError('Word readWordParagraph 失败', err);
    }
  }

  /**
   * 在指定 index 前插入新段落（Phase 6 insert_paragraph write tool — TOOL-03）。
   *
   * 定位策略：
   *   - beforeIndex === paras.items.length（末尾）→ body.insertParagraph(text, end)
   *   - 0 ≤ beforeIndex < length → paras.items[beforeIndex].insertParagraph(text, before)
   *   - 越界 → 抛 HostApiError（tool execute 层回 NOT_FOUND）
   *
   * inverse 直接复用 deleteParagraphByContent({ text })（Phase 5 已验 — 按内容定位，不受 index 漂移影响）。
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async insertParagraphAt(
    beforeIndex: number,
    text: string,
  ): Promise<{ insertedText: string }> {
    try {
      return await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        if (beforeIndex < 0 || beforeIndex > paras.items.length) {
          throw new HostApiError(
            `insertParagraphAt: beforeIndex=${beforeIndex} 越界（共 ${paras.items.length} 段）`,
            undefined,
          );
        }

        if (beforeIndex === paras.items.length) {
          // 末尾插入
          ctx.document.body.insertParagraph(text, Word.InsertLocation.end);
        } else {
          // 指定段落前插入
          paras.items[beforeIndex].insertParagraph(text, Word.InsertLocation.before);
        }

        await ctx.sync();
        return { insertedText: text };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word insertParagraphAt 失败', err);
    }
  }

  /**
   * 精确替换指定 index 段落文本（Phase 6 replace_paragraph write tool — TOOL-03）。
   *
   * before-image + D-11 expected_state 并发防御：
   *   - 替换前读取当前段落文本存为 beforeImage（供 inverse 还原 + 手动改侦测）
   *   - 若传入 expectedText，normalizeText 比对当前内容；不一致 → 抛「并发修改冲突」
   *
   * 写入：paras.items[index].insertText(newText, Word.InsertLocation.replace)
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async replaceParagraphAt(
    index: number,
    newText: string,
    expectedText?: string,
  ): Promise<{ beforeImage: string }> {
    try {
      return await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        if (index < 0 || index >= paras.items.length) {
          throw new HostApiError(
            `replaceParagraphAt: index=${index} 不存在（共 ${paras.items.length} 段）`,
            undefined,
          );
        }

        const currentText = normalizeText(paras.items[index].text);

        // D-11 expected_state 并发防御
        if (expectedText !== undefined && normalizeText(expectedText) !== currentText) {
          throw new HostApiError('并发修改冲突：目标段落已被外部改变', undefined);
        }

        const beforeImage = paras.items[index].text as string;
        paras.items[index].insertText(newText, Word.InsertLocation.replace);
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word replaceParagraphAt 失败', err);
    }
  }

  /**
   * 将指定段落还原为 before-image 文本（replace_paragraph 的 inverse，Phase 6 — TOOL-03）。
   *
   * 签名必须是 Record<string, unknown>（项目守门：[[project-adapter-inverse-signature]]）。
   *
   * 定位策略（精确定位防 index 漂移 — Phase 5 Pitfall 3 防御）：
   *   1. 先尝试 index 快速定位：normalizeText(paras.items[index].text) === normalizeText(expectedText)
   *   2. 若 index 不匹配（漂移），降级遍历全文查找 expectedText 内容指纹
   *   3. 找不到 → 抛 HostApiError（replay engine 标 skipped_error）
   *
   * args.expectedText = 替换后的新文本（用于定位当前段落位置）
   * args.restoreText  = 还原的原文（before-image）
   * args.index        = 替换时的 index（优先尝试，不可靠时降级）
   *
   * A-06：proxy 不出 Word.run 闭包；错误 → HostApiError。
   */
  async restoreParagraphAt(args: Record<string, unknown>): Promise<void> {
    const index = args.index as number;
    const restoreText = args.restoreText as string;
    const expectedText = args.expectedText as string;

    try {
      await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        const normalExpected = normalizeText(expectedText);

        // 策略 1：先尝试 index 快速定位
        let targetIndex = -1;
        if (
          index >= 0 &&
          index < paras.items.length &&
          normalizeText(paras.items[index].text) === normalExpected
        ) {
          targetIndex = index;
        }

        // 策略 2：index 不匹配，降级遍历（防 index 漂移）
        if (targetIndex === -1) {
          for (let i = 0; i < paras.items.length; i++) {
            if (normalizeText(paras.items[i].text) === normalExpected) {
              targetIndex = i;
              break;
            }
          }
        }

        if (targetIndex === -1) {
          throw new HostApiError(
            'restoreParagraphAt: 未找到目标段落（内容已变或已被手动删除）',
            undefined,
          );
        }

        paras.items[targetIndex].insertText(restoreText, Word.InsertLocation.replace);
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word restoreParagraphAt 失败', err);
    }
  }

  /**
   * 在光标当前位置插入文本（Phase 6 insert_text_at_cursor write tool — TOOL-03）。
   *
   * API 路径：ctx.document.getSelection().insertText(text, Word.InsertLocation.after)
   *   （已在 WordAdapter.insert 的 'cursor' case 中验证）。
   *
   * inverse：记录 insertedText 作内容指纹，复用 deleteParagraphByContent 逆向删段。
   *   光标插入的精确范围无法可靠 track，inverse 采用近似策略（删含插入文本的段落）。
   *   若需精确，上层 tool 层可走 search-and-replace 路径；adapter 层提供 insertedText 数据。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async insertTextAtCursor(text: string): Promise<{ insertedText: string }> {
    try {
      return await Word.run(async (ctx) => {
        const selection = ctx.document.getSelection();
        selection.insertText(text, Word.InsertLocation.after);
        await ctx.sync();
        return { insertedText: text };
      });
    } catch (err) {
      throw new HostApiError('Word insertTextAtCursor 失败', err);
    }
  }

  /**
   * 替换当前选区文本（Phase 6 replace_selection write tool — TOOL-03）。
   *
   * API 路径：ctx.document.getSelection().insertText(newText, Word.InsertLocation.replace)
   *   （已在 WordAdapter.insert 的 'replace_selection' case 中验证）。
   *
   * before-image：替换前读取 selection.text 存为 beforeImage（返回供调用方参考）。
   *
   * inverse 策略（CR-04 诚实标注，T-06-04-03 accept）：
   *   - replace_selection 的 undo 路径复杂（新文本位置不固定，无法用 index/指纹精确还原）。
   *   - tool 层 reverse 直接用 noop_inverse → DiffLog 老实显示「此步无法自动撤销」，用户知情。
   *   - 不再提供专用 inverse adapter 方法（旧 restoreSelection 是永不被调用的死方法，已删）。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async replaceSelection(newText: string): Promise<{ beforeImage: string }> {
    try {
      return await Word.run(async (ctx) => {
        const sel = ctx.document.getSelection();
        sel.load('text');
        await ctx.sync();

        const beforeImage = sel.text as string;
        sel.insertText(newText, Word.InsertLocation.replace);
        await ctx.sync();

        return { beforeImage };
      });
    } catch (err) {
      throw new HostApiError('Word replaceSelection 失败', err);
    }
  }

  /**
   * 设置指定段落字符格式（Phase 9 WORD-01 — set_word_character_format）。
   *
   * 写前读取当前 font 属性存为 before-image（D-06），供 restoreRangeFont 还原。
   * uniqueLocalId 消歧（D-01/D-03/D-04）：WordApi 1.6 支持时先精确匹配，不支持时仅用 index。
   * only-if-present 写入策略：只写传入的属性，未传的不变（partial update 语义）。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   * D-17：签名使用 Record<string, unknown>，方法体第一行解包（Phase 5 教训）。
   */
  async setCharacterFormat(
    args: Record<string, unknown>,
  ): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
    const index = args.paragraphIndex as number;
    const uniqueLocalId = args.uniqueLocalId as string | undefined;
    const font = args.font as {
      bold?: boolean | null;
      italic?: boolean | null;
      underline?: string;
      size?: number | null;
      color?: string | null;
      name?: string | null;
    };

    try {
      return await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        // D-02/D-03：运行时门控 WordApi 1.6（uniqueLocalId 字段）
        const supportsUniqueId =
          typeof Office !== 'undefined' &&
          Office.context?.requirements?.isSetSupported('WordApi', '1.6') === true;
        const loadStr = supportsUniqueId
          ? 'items/text,items/font/bold,items/font/italic,items/font/underline,items/font/size,items/font/color,items/font/name,items/uniqueLocalId'
          : 'items/text,items/font/bold,items/font/italic,items/font/underline,items/font/size,items/font/color,items/font/name';
        paras.load(loadStr);
        await ctx.sync();

        if (index < 0 || index >= paras.items.length) {
          throw new HostApiError(
            `setCharacterFormat: paragraphIndex=${index} 越界（共 ${paras.items.length} 段）`,
            undefined,
          );
        }

        // uniqueLocalId 消歧（D-04）：index 对应 uid 不一致 → 全文遍历找 uid
        let targetIndex = index;
        if (
          supportsUniqueId &&
          uniqueLocalId !== undefined &&
          uniqueLocalId !== null &&
          paras.items[index].uniqueLocalId !== uniqueLocalId
        ) {
          const found = paras.items.findIndex((p: { uniqueLocalId: string }) => p.uniqueLocalId === uniqueLocalId);
          if (found === -1) {
            throw new HostApiError(
              `setCharacterFormat: NOT_FOUND paragraphIndex=${index} uniqueLocalId=${uniqueLocalId}`,
              undefined,
            );
          }
          targetIndex = found;
        }

        const para = paras.items[targetIndex];
        const f = para.font;

        // before-image（D-06）：写前读取全部字体属性
        const beforeImage: Record<string, unknown> = {
          bold: f.bold,
          italic: f.italic,
          underline: f.underline,
          size: f.size,
          color: f.color,
          name: f.name,
        };
        const afterText = normalizeText(para.text); // 用于 inverse 段落定位

        // only-if-present 写入（未传的属性不变）
        if (font.bold !== undefined) f.bold = font.bold as boolean;
        if (font.italic !== undefined) f.italic = font.italic as boolean;
        if (font.underline !== undefined) f.underline = font.underline as Word.UnderlineType;
        if (font.size !== undefined) f.size = font.size as number;
        if (font.color !== undefined) f.color = font.color as string;
        if (font.name !== undefined) f.name = font.name as string;
        await ctx.sync();

        return { beforeImage, afterText };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word setCharacterFormat 失败', err);
    }
  }

  /**
   * 还原段落字符格式（set_word_character_format 的 inverse，Phase 9 WORD-01）。
   *
   * 签名必须是 Record<string, unknown>（D-17 硬约束：replay engine 以 reverse.args 对象调用）。
   *
   * 定位策略（防 index drift，复用 restoreParagraphAt 双重定位范式）：
   *   1. index 快速定位：normalizeText(paras.items[index].text) === normalizeText(expectedText)
   *   2. 降级遍历：全文查 expectedText 内容指纹
   *   3. 找不到 → 抛 HostApiError（replay engine 标 skipped_error）
   *
   * D-07：null 属性条件跳过写回（避免覆盖 Word 的"混合"状态）。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async restoreRangeFont(args: Record<string, unknown>): Promise<void> {
    // D-17: 第一行解包，不用位置参
    const index = args.index as number;
    const expectedText = args.expectedText as string;
    const before = args.before as Record<string, unknown>;

    try {
      await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        // 策略 1：index 快路径
        let targetIndex = -1;
        if (
          index >= 0 &&
          index < paras.items.length &&
          normalizeText(paras.items[index].text) === normalizeText(expectedText)
        ) {
          targetIndex = index;
        }
        // 策略 2：降级遍历（防 index drift）
        if (targetIndex === -1) {
          for (let i = 0; i < paras.items.length; i++) {
            if (normalizeText(paras.items[i].text) === normalizeText(expectedText)) {
              targetIndex = i;
              break;
            }
          }
        }
        if (targetIndex === -1) {
          throw new HostApiError('restoreRangeFont: 目标段落未找到', undefined);
        }

        const f = paras.items[targetIndex].font;
        // D-07：null 属性条件跳过（不写 null，保留 Word 混合状态）
        if (before.bold !== null && before.bold !== undefined) f.bold = before.bold as boolean;
        if (before.italic !== null && before.italic !== undefined) f.italic = before.italic as boolean;
        if (before.underline !== undefined) f.underline = before.underline as Word.UnderlineType;
        if (before.size !== null && before.size !== undefined) f.size = before.size as number;
        if (before.color !== null && before.color !== undefined) f.color = before.color as string;
        if (before.name !== null && before.name !== undefined) f.name = before.name as string;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word restoreRangeFont 失败', err);
    }
  }

  /**
   * 设置指定段落格式（Phase 9 WORD-02 — set_word_paragraph_format）。
   *
   * 写前读取当前段落格式属性存为 before-image（D-06），供 restoreParagraphFormat 还原。
   * before-image 字段定义（D-06）：lineSpacing / spaceBefore / spaceAfter / alignment /
   *   indent（映射 firstLineIndent） / leftIndent。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async setParaFormat(
    args: Record<string, unknown>,
  ): Promise<{ beforeImage: Record<string, unknown>; afterText: string }> {
    const index = args.paragraphIndex as number;
    const uniqueLocalId = args.uniqueLocalId as string | undefined;
    const format = args.format as {
      lineSpacing?: number;
      spaceBefore?: number;
      spaceAfter?: number;
      alignment?: string;
      indent?: number;    // D-06: indent → firstLineIndent
      leftIndent?: number;
    };

    try {
      return await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        const supportsUniqueId =
          typeof Office !== 'undefined' &&
          Office.context?.requirements?.isSetSupported('WordApi', '1.6') === true;
        const loadStr = supportsUniqueId
          ? 'items/text,items/lineSpacing,items/spaceBefore,items/spaceAfter,items/alignment,items/firstLineIndent,items/leftIndent,items/uniqueLocalId'
          : 'items/text,items/lineSpacing,items/spaceBefore,items/spaceAfter,items/alignment,items/firstLineIndent,items/leftIndent';
        paras.load(loadStr);
        await ctx.sync();

        if (index < 0 || index >= paras.items.length) {
          throw new HostApiError(
            `setParaFormat: paragraphIndex=${index} 越界（共 ${paras.items.length} 段）`,
            undefined,
          );
        }

        let targetIndex = index;
        if (
          supportsUniqueId &&
          uniqueLocalId !== undefined &&
          uniqueLocalId !== null &&
          paras.items[index].uniqueLocalId !== uniqueLocalId
        ) {
          const found = paras.items.findIndex((p: { uniqueLocalId: string }) => p.uniqueLocalId === uniqueLocalId);
          if (found === -1) {
            throw new HostApiError(
              `setParaFormat: NOT_FOUND paragraphIndex=${index} uniqueLocalId=${uniqueLocalId}`,
              undefined,
            );
          }
          targetIndex = found;
        }

        const para = paras.items[targetIndex];
        // before-image（D-06 字段定义）
        const beforeImage: Record<string, unknown> = {
          lineSpacing: para.lineSpacing,
          spaceBefore: para.spaceBefore,
          spaceAfter: para.spaceAfter,
          alignment: para.alignment,
          indent: para.firstLineIndent, // D-06: indent → firstLineIndent
          leftIndent: para.leftIndent,
        };
        const afterText = normalizeText(para.text);

        // only-if-present 写入（只写传入的属性）
        if (format.lineSpacing !== undefined) para.lineSpacing = format.lineSpacing;
        if (format.spaceBefore !== undefined) para.spaceBefore = format.spaceBefore;
        if (format.spaceAfter !== undefined) para.spaceAfter = format.spaceAfter;
        if (format.alignment !== undefined) para.alignment = format.alignment as Word.Alignment;
        if (format.indent !== undefined) para.firstLineIndent = format.indent; // D-06 indent → firstLineIndent
        if (format.leftIndent !== undefined) para.leftIndent = format.leftIndent;
        await ctx.sync();

        return { beforeImage, afterText };
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word setParaFormat 失败', err);
    }
  }

  /**
   * 还原段落格式（set_word_paragraph_format 的 inverse，Phase 9 WORD-02）。
   *
   * 签名必须是 Record<string, unknown>（D-17 硬约束）。
   * 双重定位范式（index 快路径 + 内容指纹降级）防 index drift。
   * D-06 indent 映射：before.indent → para.firstLineIndent。
   *
   * A-06：proxy 不出 Word.run 闭包；入参/出参纯数据。
   */
  async restoreParagraphFormat(args: Record<string, unknown>): Promise<void> {
    // D-17: 第一行解包，不用位置参
    const index = args.index as number;
    const expectedText = args.expectedText as string;
    const before = args.before as Record<string, unknown>;

    try {
      await Word.run(async (ctx) => {
        const paras = ctx.document.body.paragraphs;
        paras.load('items/text');
        await ctx.sync();

        let targetIndex = -1;
        if (
          index >= 0 &&
          index < paras.items.length &&
          normalizeText(paras.items[index].text) === normalizeText(expectedText)
        ) {
          targetIndex = index;
        }
        if (targetIndex === -1) {
          for (let i = 0; i < paras.items.length; i++) {
            if (normalizeText(paras.items[i].text) === normalizeText(expectedText)) {
              targetIndex = i;
              break;
            }
          }
        }
        if (targetIndex === -1) {
          throw new HostApiError('restoreParagraphFormat: 目标段落未找到', undefined);
        }

        const para = paras.items[targetIndex];
        if (before.lineSpacing !== null && before.lineSpacing !== undefined)
          para.lineSpacing = before.lineSpacing as number;
        if (before.spaceBefore !== null && before.spaceBefore !== undefined)
          para.spaceBefore = before.spaceBefore as number;
        if (before.spaceAfter !== null && before.spaceAfter !== undefined)
          para.spaceAfter = before.spaceAfter as number;
        if (before.alignment !== null && before.alignment !== undefined)
          para.alignment = before.alignment as Word.Alignment;
        if (before.indent !== null && before.indent !== undefined)
          para.firstLineIndent = before.indent as number; // D-06 indent → firstLineIndent
        if (before.leftIndent !== null && before.leftIndent !== undefined)
          para.leftIndent = before.leftIndent as number;
        await ctx.sync();
      });
    } catch (err) {
      if (err instanceof HostApiError) throw err;
      throw new HostApiError('Word restoreParagraphFormat 失败', err);
    }
  }

  /**
   * per-query 离散只读（TOOL-01/02）。
   *
   * switch 覆盖 5 个 Word kind：
   * - get_paragraph_count  — 段落总数（metadata）
   * - get_paragraph_at     — 指定 0-based 段落文本（document_content；越界返 NOT_FOUND）
   * - get_document_outline — styleBuiltIn 匹配 /Heading\d/ 抽层级（metadata，跨语言 portable）
   * - get_document_full_text — 全文（document_content；size cap 由上层 wrapReadResult 处理）
   * - selection_detail      — 复用 getSelection() 语义（document_content）
   *
   * A-06：proxy 不出 Word.run 闭包；每 case 各自 try/catch → HostApiError。
   * T-04-07：catch → HostApiError，构造器不存 hostError（防 stack 泄漏）。
   * T-04-09：get_paragraph_at 越界 bounds check 返 NOT_FOUND，不抛、不越界访问。
   */
  async read(query: ReadableQuery): Promise<ReadableResult> {
    switch (query.kind) {
      case 'get_paragraph_count': {
        try {
          return await Word.run(async (ctx) => {
            const paras = ctx.document.body.paragraphs;
            paras.load('items/text');
            await ctx.sync();
            return { ok: true, data: { count: paras.items.length } } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Word get_paragraph_count 失败', err);
        }
      }

      case 'get_paragraph_at': {
        try {
          return await Word.run(async (ctx) => {
            const paras = ctx.document.body.paragraphs;
            paras.load('items/text');
            await ctx.sync();

            const { index } = query;
            if (index < 0 || index >= paras.items.length) {
              return {
                ok: false,
                error: {
                  code: 'NOT_FOUND',
                  message: `第 ${index + 1} 段不存在（共 ${paras.items.length} 段）`,
                  recoverable: false,
                  hint: '请先用 get_paragraph_count 确认段数，再指定 0-based index',
                },
              } satisfies ReadableResult;
            }

            return {
              ok: true,
              data: { index, text: paras.items[index].text },
            } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Word get_paragraph_at 失败', err);
        }
      }

      case 'get_document_outline': {
        try {
          return await Word.run(async (ctx) => {
            const paras = ctx.document.body.paragraphs;
            paras.load('items/text,items/styleBuiltIn');
            await ctx.sync();

            const outline = paras.items
              .map((p: { text: string; styleBuiltIn: string }, i: number) => ({ p, i }))
              .filter(({ p }: { p: { styleBuiltIn: string } }) => /^Heading(\d)$/.test(p.styleBuiltIn))
              .map(({ p, i }: { p: { text: string; styleBuiltIn: string }; i: number }) => {
                const m = p.styleBuiltIn.match(/^Heading(\d)$/);
                return {
                  level: m ? Number(m[1]) : 0,
                  text: p.text,
                  paragraphIndex: i,
                };
              });

            return { ok: true, data: { outline } } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Word get_document_outline 失败', err);
        }
      }

      case 'get_document_full_text': {
        // T-04-08：adapter 不截断，size cap 在上层 tool execute wrapReadResult 处理
        try {
          return await Word.run(async (ctx) => {
            const body = ctx.document.body;
            body.load('text');
            await ctx.sync();
            return { ok: true, data: { text: body.text } } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Word get_document_full_text 失败', err);
        }
      }

      case 'selection_detail': {
        // 返回选区文字 + 字符数 + 段落定位（WSEL-01）。
        // v2.0 已砍 PRIV 授权（agent 默认读内容）。
        // 扩展：返回 paragraphIndex（0-based）+ uniqueLocalId（支持 WordApi 1.6 时）。
        // D-03 降级：不支持 WordApi 1.6 时 uniqueLocalId 为 null。
        // D-04：selection 跨段落或为段落子集时，文本指纹无法精确匹配，
        //        返回 paragraphIndex:-1 + selectionSpansMultipleParagraphs:true。
        try {
          return await Word.run(async (ctx) => {
            const selection = ctx.document.getSelection();
            const body = ctx.document.body;
            const paras = body.paragraphs;

            // D-02/D-03：运行时门控 WordApi 1.6 可用性
            const supportsUniqueId =
              typeof Office !== 'undefined' &&
              Office.context?.requirements?.isSetSupported('WordApi', '1.6') === true;

            // 按支持情况决定加载字段（加载 uniqueLocalId 需要 WordApi 1.6）
            const paraLoadStr = supportsUniqueId
              ? 'items/text,items/uniqueLocalId'
              : 'items/text';
            selection.load('text');
            paras.load(paraLoadStr);
            await ctx.sync();

            const text = selection.text;
            // charCount 为 0 = 光标无实际选区 → none（与 getSelection 语义一致）
            if (text.length === 0) {
              return { ok: true, data: { kind: 'none' } } satisfies ReadableResult;
            }

            // 文本指纹快路径：normalizeText 消除末尾 \r\n 格式差异（Pitfall 2 防 false-skip）
            const selNorm = normalizeText(text);
            let paragraphIndex = -1;
            let uniqueLocalId: string | null = null;

            for (let i = 0; i < paras.items.length; i++) {
              if (normalizeText(paras.items[i].text) === selNorm) {
                // 取第一个匹配段落的 index 和 uniqueLocalId
                paragraphIndex = i;
                uniqueLocalId = supportsUniqueId
                  ? ((paras.items[i].uniqueLocalId as string | null | undefined) ?? null)
                  : null;
                break;
              }
            }

            // 文本指纹未匹配（selection 跨段落或为段落子集）→ D-04 标记
            if (paragraphIndex === -1) {
              return {
                ok: true,
                data: {
                  kind: 'word',
                  charCount: text.length,
                  text,
                  paragraphIndex: -1,
                  uniqueLocalId: null,
                  selectionSpansMultipleParagraphs: true,
                },
              } satisfies ReadableResult;
            }

            return {
              ok: true,
              data: {
                kind: 'word',
                charCount: text.length,
                text,
                paragraphIndex,
                uniqueLocalId,
              },
            } satisfies ReadableResult;
          });
        } catch (err) {
          throw new HostApiError('Word selection_detail 失败', err);
        }
      }

      default: {
        // 防御：Word adapter 只处理 Word kind + selection_detail
        // buildToolsForHost 已按 host 隔离，default 是防御层
        return {
          ok: false,
          error: {
            code: 'UNSUPPORTED',
            message: `Word 不支持 read kind: ${(query as { kind: string }).kind}`,
            recoverable: false,
            hint: '该 kind 属其它宿主，buildToolsForHost 已按 host 隔离',
          },
        };
      }
    }
  }
}
