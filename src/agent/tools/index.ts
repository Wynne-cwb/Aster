/**
 * src/agent/tools/index.ts — Tool registry + dispatchTool（D-07 / D-15）
 *
 * 严格 allowlist sanitize 边界（ERR-02）：
 *   - AsterError 子类（含 isAsterErrorWithMeta 守卫）→ 只读 .code/.message/.hint/.recoverable 四字段
 *   - 陌生异常（非 AsterError）→ 一律兜底 UNSUPPORTED + '宿主操作失败' + '发生错误，请重试'
 *   - 严禁读 err.stack / err.toString() / err.name / 其它字段
 */
import type { DocumentAdapter } from '../../adapters/DocumentAdapter';
import { AsterError, isAsterErrorWithMeta, HostApiError } from '../../errors';
import { recordHostError } from '../../lib/hostErrorLog';
import type { ReverseDescriptor, PostStateSnapshot } from '../operationLog';
import { appendParagraph, insertParagraph, replaceParagraph, insertTextAtCursor, replaceSelection, setWordCharacterFormat, setWordParagraphFormat, applyParagraphStyle, findAndReplace, insertTable, setWordListFormat, insertWordComment, setWordHeaderFooter, editTableCell } from './write/word';
import { insertSlide, setShapeProperty, moveShape, setShapeText, setShapeTextFontTool, addShapeTool, copySlideTool, setShapeTextAlignmentTool, deleteShapeTool, rotateShapeTool, manageSlidesTool, setSlideBackgroundTool, applySlideLayoutTool, insertPptTableTool, addLineTool } from './write/ppt';
import { setRangeValues as setRangeValuesTool, applyFormula, insertChart, setCell, formatExcelRangeTool, setColumnRowSizeTool, setAutoFilterTool, addConditionalFormatTool, createTableTool, freezePanesTool, sortRangeTool, excelFindAndReplaceTool, manageWorksheetTool, setChartTitleTool, mergeCellsTool, removeDuplicatesTool, createPivotTableTool } from './write/excel';
import { batchWrite } from './write/batch';
import { generatePptImageTool } from './write/ppt-image';
import { generateWordImageTool } from './write/word-image';
import { searchAndInsertStockImagePptTool, searchAndInsertStockImageWordTool } from './write/search-stock-image';
import { getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline } from './read/word';
import { listSlides, getSlide, listShapesOnSlide, getShape, checkSlideLayout } from './read/ppt';
import { listWorksheets, getRangeValues, getUsedRangeSummary } from './read/excel';
import { getShapeImage } from './read/vision';
import { visualCheckSlide } from './read/visual-check'; // Phase 24 PVQ-06
import { PVQ06_VISUAL_CHECK_ENABLED } from './visual-check-config'; // Phase 24 降级开关
import { selectionDetail } from './common';

const FALLBACK_HINT = '发生错误，请重试';

/**
 * PPT 工具名集合——dispatchTool 仅对这些工具做 camelCase→snake_case 归一化（D-13）。
 * v2.2 新增 PPT 工具时，在此集合加入工具名（防 casing 覆辙守门）。
 */
const PPT_TOOLS = new Set([
  'insert_slide',
  'set_shape_property',
  'move_shape',
  'set_shape_text',
  'set_shape_text_font',
  'add_shape',
  'copy_slide',
  'set_shape_text_alignment',
  'delete_shape',
  'rotate_shape',
  'manage_slides',
  'set_slide_background',
  'get_shape_image', // Phase 15 VIS-01/VIS-02 新增（防 casing 覆辙守门）
  'generate_ppt_image', // Phase 16 IMG-01（必须在此，否则 normalizeToSnakeCase 不处理其参数）
  'search_and_insert_stock_image', // Phase 18 LIB-02（PPT 必须在此，否则 LLM camelCase 参数不被 normalize）
  'apply_slide_layout', // Phase 23 PVQ-03（顶层 args layout/content/accent_color 归一化；嵌套 content 不递归，按 schema 直接读）
  'insert_ppt_table', // Phase 29 PPT-09（必须在此，否则 LLM camelCase 参数不被 normalize → 静默丢参 no-op）
  'add_line',         // Phase 29 PPT-10
]);

/** camelCase → snake_case，仅一级 key（嵌套 object 不递归，保留 position.left 等）。
 *  幂等：snake_case 入参经过后不变。*/
function normalizeToSnakeCase(args: unknown): unknown {
  if (!args || typeof args !== 'object' || Array.isArray(args)) return args;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    out[k.replace(/([A-Z])/g, (m) => `_${m.toLowerCase()}`)] = v;
  }
  return out;
}

/**
 * 单 tool 调用超时（ms）。真机 Office.js 偶发卡死（如 LLM 一次并行发起多个
 * tool_call → 短时间大量 PowerPoint.run 小批次，在 Office for Web 上会卡住不返回），
 * 没有超时会让 agent loop 无限冻死。超时降级为可恢复 HOST_API 错误：agent 可重试，
 * 同一工具连续 3 次 → 熔断红卡优雅放弃，绝不冻 UI。
 */
const TOOL_TIMEOUT_MS = 15_000;

export type ToolErrorCode =
  | 'INVALID_ARGS'
  | 'INVALID_PARAM'    // D-08: allowlist 校验拒绝（如非法 styleName / paramValue）
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED'
  | 'HOST_API_FAILED'
  | 'PRIVACY_BLOCKED'
  | 'CIRCUIT_OPEN'
  | 'STEP_LIMIT'
  | 'UNSUPPORTED';

export interface ToolError {
  code: ToolErrorCode;
  message: string;        // 中文，user-readable
  recoverable: boolean;
  hint: string;           // 中文，LLM-readable
}

/** Phase 5 TOOL-04：write tool 执行后的文档状态快照（供 replayUndoAll 对比手动改 D-11）
 *  类型定义来自 operationLog.ts（kind: 'word_paragraph' | 'excel_range' | 'ppt_slide'）
 *  此处 re-export 保持向后兼容 */
export type { PostStateSnapshot } from '../operationLog';

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: ToolError;
  reverse?: ReverseDescriptor;
  /** Phase 5 TOOL-04：postState 快照；read-only tool 不填 */
  postState?: PostStateSnapshot;
  /** Phase 11 新增：batch 专用透传字段。loop-helpers.ts appendOperation 用。非 batch tool 不填。*/
  subOps?: Array<{
    humanLabel: string;
    postState?: PostStateSnapshot;
    reverse: ReverseDescriptor;
  }>;
  /**
   * W1 修复（Phase 11 review）：部分失败信号。batch_write 部分成功（完成≥1 步但中途失败）
   * 时 ok 仍为 true（保留 undo 记录 + 让 LLM 从失败步继续，不重做已完成步骤），
   * 但置 partialFailure=true，让 loop-helpers 通知熔断器走 recordFailure
   * （否则反复部分失败的 batch 永远无法开路）。与 ok / reverse / undo 记录解耦。
   */
  partialFailure?: boolean;
}

export interface ToolExecContext {
  adapter: DocumentAdapter;
  runId: string;
  stepIndex: number;
  signal: AbortSignal;
}

export interface ToolDef<TArgs = unknown> {
  name: string;
  description: string;
  parameters: object;                            // JSON schema for LLM
  humanLabel: (args: TArgs) => string;           // D-08 / D-13 强制
  execute: (args: TArgs, ctx: ToolExecContext) => Promise<ToolResult>;
  kind?: 'read' | 'write';                       // 三态判定（AGENT-12）：loop 据此 setPhase
  /**
   * per-tool 超时覆盖（ms）。缺省时用 dispatchTool 的 TOOL_TIMEOUT_MS（15s）。
   * 生图等慢工具需覆盖：doubao 2K 出图 ~21s、gpt-image-2 high ~90s+，默认 15s 会误杀。
   */
  timeoutMs?: number;
}

export interface ToolCallInvocation {
  id: string;
  name: string;
  arguments: unknown;   // 已 parse 的 args（loop.ts 在 tool_call_end 后 JSON.parse 喂入）
}

/**
 * 把 AsterError category code 映射到 ToolError 8 枚举。
 * 来源 RESEARCH.md §Deliverable 4 §4.2 L1263-1275。
 */
function mapAsterCodeToToolErrorCode(code: string): ToolErrorCode {
  switch (code) {
    case 'KEY_INVALID':   return 'PERMISSION_DENIED';
    case 'QUOTA':         return 'PERMISSION_DENIED';
    case 'IMAGE_QUOTA':   return 'PERMISSION_DENIED';
    case 'CONTEXT':       return 'INVALID_ARGS';
    case 'NETWORK':       return 'HOST_API_FAILED';
    case 'RATE_LIMIT':    return 'HOST_API_FAILED';
    case 'FILTER':        return 'INVALID_ARGS';
    case 'MODEL':         return 'NOT_FOUND';
    case 'HOST_API':      return 'HOST_API_FAILED';
    case 'UNSUPPORTED':   return 'UNSUPPORTED';
    case 'CIRCUIT_OPEN':  return 'CIRCUIT_OPEN';
    case 'STEP_LIMIT':    return 'STEP_LIMIT';
    default:              return 'UNSUPPORTED';
  }
}

function sanitizeFromAsterError(
  err: AsterError & { recoverable: boolean; hint: string },
): ToolError {
  return {
    code: mapAsterCodeToToolErrorCode(err.code),
    message: err.message,         // AsterError 子类构造时的中文字面量（D-15）
    recoverable: err.recoverable,
    hint: err.hint || FALLBACK_HINT,
  };
}

/**
 * 唯一 sanitize 边界 — loop / 任何调用方一律走此函数。
 *
 * 关键约束：
 *   - 不读 err.stack / err.toString() / err.name
 *   - 不读 err.message（陌生异常路径），即便看起来像 string 也一律走兜底
 *   - 兜底 message 与 hint 都是固定字面量，与构造时的中文字面量同源
 */
export async function dispatchTool(
  call: ToolCallInvocation,
  ctx: ToolExecContext,
  tools: ToolDef[],
): Promise<ToolResult> {
  const def = tools.find((t) => t.name === call.name);
  if (!def) {
    return {
      ok: false,
      error: {
        code: 'NOT_FOUND',
        message: `工具 ${call.name} 不存在`,
        recoverable: false,
        hint: '请只调用 tools 列表里声明的工具名',
      },
    };
  }

  try {
    // per-tool 超时覆盖（生图等慢工具用 def.timeoutMs，否则默认 15s）
    const effectiveTimeout = def.timeoutMs ?? TOOL_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new HostApiError('工具调用超时，宿主无响应')),
        effectiveTimeout,
      );
    });
    try {
      // Phase 14 新增（D-10/D-13）：PPT 工具入口中央 normalize（camelCase → snake_case）
      const normalizedArgs = PPT_TOOLS.has(call.name)
        ? normalizeToSnakeCase(call.arguments)
        : call.arguments;
      return await Promise.race([def.execute(normalizedArgs as never, ctx), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (err) {
    if (isAsterErrorWithMeta(err)) {
      // 260604-gld UAT-2：HostApiError 的宿主原始 message（debugCause）记入**本地诊断**
      // 环形缓冲，仅供「复制调试报告」就近渲染，让用户不必开 DevTools 翻 iframe 控制台。
      // ⚠ ToolResult 仍按下方 sanitizeFromAsterError 原样脱敏（ERR-02 隐私门保持）——
      //   debugCause 绝不进 ToolResult / LLM wire，只是额外往本地缓冲记一笔。
      //   host 端 Office.js 报错结构上不含用户 LLM Key（Key 只在直连 Provider 的 fetch 路径）。
      //   无 cause 的 HostApiError（如「slide 列表为空」）debugCause 为 undefined → 跳过。
      if (err instanceof HostApiError && typeof err.debugCause === 'string') {
        recordHostError({
          toolName: call.name,
          cause: err.debugCause,
          isoTime: new Date().toISOString(),
        });
      }
      return { ok: false, error: sanitizeFromAsterError(err) };
    }
    // 陌生异常一律兜底：不读 .stack / .message / 其它字段
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: '宿主操作失败',
        hint: FALLBACK_HINT,
        recoverable: false,
      },
    };
  }
}

/** TOOL-04 D-15: write tool 注册层守门——缺 humanLabel → throw（不允许注册） */
function assertWriteToolRegisterable(tool: ToolDef): void {
  if (tool.kind === 'write' && typeof tool.humanLabel !== 'function') {
    throw new Error(
      `TOOL-04: write tool "${tool.name}" missing humanLabel (got: ${typeof tool.humanLabel})`,
    );
  }
}

/**
 * 按 host 返回当前可注册的 ToolDef array（OpenAI tools wire 格式由 caller 转换）。
 * Phase 3 Plan 04 落地：Word host 接 1 个真实 write tool（append_paragraph）；
 * Phase 5 Plan 07 落地：Excel host 加 set_range_values；PPT host 加 insert_slide。
 *
 * 类型注：ToolDef<TArgs> 在 TArgs 上不变（execute / humanLabel 都把 TArgs 当输入位置，
 * 即 contravariant），所以 ToolDef<AppendParagraphArgs> 不能直接赋给 ToolDef<unknown>。
 * 这里 cast 为 ToolDef[]（默认 unknown）— dispatchTool 内部已用 `as never` 把
 * call.arguments 喂入 execute，运行期类型由 dispatch 边界负责（D-15 sanitize 兜底）。
 *
 * TOOL-04：所有注册的 write tool 均通过 assertWriteToolRegisterable 校验。
 */
export function buildToolsForHost(host: 'word' | 'excel' | 'ppt'): ToolDef[] {
  switch (host) {
    case 'word': {
      const wordWriteTools = [
        appendParagraph, insertParagraph, replaceParagraph,
        insertTextAtCursor, replaceSelection,
        setWordCharacterFormat, setWordParagraphFormat, // Phase 9 WORD-01/WORD-02
        applyParagraphStyle, // Phase 9 WORD-03
        findAndReplace, // Phase 9 WORD-04
        insertTable, // Phase 9 WORD-05
        generateWordImageTool, // Phase 16 IMG-02（Word 生图插入，IMG-05：不含 PPT 工具）
        searchAndInsertStockImageWordTool, // Phase 18 LIB-02（Word 图库检索插入）
        setWordListFormat, // Phase 27 WORD-07
        insertWordComment, // Phase 27 WORD-08
        setWordHeaderFooter, // Phase 27 WORD-09
        editTableCell, // Phase 27 WORD-10
        batchWrite, // Phase 11 BATCH-01 追加（D-02 三宿主都注册）
      ] as ToolDef[];
      wordWriteTools.forEach(assertWriteToolRegisterable);
      return [
        getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
        getShapeImage,
        ...wordWriteTools, selectionDetail,
      ].map((t) => t as ToolDef);
    }
    case 'excel': {
      const excelWriteTools = [
        setRangeValuesTool, applyFormula, insertChart, setCell,
        // Phase 10 Wave 1a 新增（EXCEL-01/02/04/06/07/08）
        formatExcelRangeTool, setColumnRowSizeTool, setAutoFilterTool,
        addConditionalFormatTool, createTableTool, freezePanesTool,
        // Phase 10 Wave 2 新增（EXCEL-03/05/09/10）
        sortRangeTool, excelFindAndReplaceTool, manageWorksheetTool, setChartTitleTool,
        // Phase 28 Wave 2 新增（EXCEL-11/12：merge_cells + remove_duplicates）
        mergeCellsTool, removeDuplicatesTool,
        // Phase 28 Wave 3 新增（EXCEL-13：create_pivot_table）
        createPivotTableTool,
        batchWrite, // Phase 11 BATCH-01 追加（D-02 三宿主都注册）
      ] as ToolDef[];
      excelWriteTools.forEach(assertWriteToolRegisterable);
      return [
        listWorksheets, getRangeValues, getUsedRangeSummary,
        getShapeImage,
        ...excelWriteTools, selectionDetail,
      ].map((t) => t as ToolDef);
    }
    case 'ppt': {
      const pptWriteTools = [
        insertSlide, setShapeProperty, moveShape, setShapeText,
        // Phase 10 Wave 3a：PPT-01/03/07
        setShapeTextFontTool, addShapeTool, copySlideTool,
        // Phase 10 Wave 4：PPT-02/04/05/06/08
        setShapeTextAlignmentTool, deleteShapeTool, rotateShapeTool,
        manageSlidesTool, setSlideBackgroundTool,
        generatePptImageTool, // Phase 16 IMG-01（PPT 生图插入，IMG-05：仅 PPT host）
        searchAndInsertStockImagePptTool, // Phase 18 LIB-02（PPT 图库检索插入）
        applySlideLayoutTool, // Phase 23 PVQ-03（盖印章建整页，create+fill；第 16 个 PPT write 工具）
        insertPptTableTool, addLineTool, // Phase 29 PPT-09/10（原生建表 + 线条）
        batchWrite, // Phase 11 BATCH-01 追加（D-02 三宿主都注册）
      ] as ToolDef[];
      pptWriteTools.forEach(assertWriteToolRegisterable);
      return [
        listSlides, getSlide, listShapesOnSlide, getShape, checkSlideLayout, // Phase 22 PVQ-02：新增版面自查 read 工具（checkSlideLayout, 不进 PPT_TOOLS 归一化集）
        ...(PVQ06_VISUAL_CHECK_ENABLED ? [visualCheckSlide] : []), // Phase 24 PVQ-06：视觉自查 read tool（不进 PPT_TOOLS，on-demand，默认铺开）
        getShapeImage,
        ...pptWriteTools, selectionDetail,
      ].map((t) => t as ToolDef);
    }
    default:
      return [];
  }
}
