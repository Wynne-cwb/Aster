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
import type { ReverseDescriptor, PostStateSnapshot } from '../operationLog';
import { appendParagraph, insertParagraph, replaceParagraph, insertTextAtCursor, replaceSelection, setWordCharacterFormat, setWordParagraphFormat, applyParagraphStyle, findAndReplace, insertTable } from './write/word';
import { insertSlide, setShapeProperty, moveShape, setShapeText, setShapeTextFontTool, addShapeTool, copySlideTool, setShapeTextAlignmentTool, deleteShapeTool, rotateShapeTool, manageSlidesTool, setSlideBackgroundTool } from './write/ppt';
import { setRangeValues as setRangeValuesTool, applyFormula, insertChart, setCell, formatExcelRangeTool, setColumnRowSizeTool, setAutoFilterTool, addConditionalFormatTool, createTableTool, freezePanesTool, sortRangeTool, excelFindAndReplaceTool, manageWorksheetTool, setChartTitleTool } from './write/excel';
import { getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline } from './read/word';
import { listSlides, getSlide, listShapesOnSlide, getShape } from './read/ppt';
import { listWorksheets, getRangeValues, getUsedRangeSummary } from './read/excel';
import { selectionDetail } from './common';

const FALLBACK_HINT = '发生错误，请重试';

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new HostApiError('工具调用超时，宿主无响应')),
        TOOL_TIMEOUT_MS,
      );
    });
    try {
      return await Promise.race([def.execute(call.arguments as never, ctx), timeout]);
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  } catch (err) {
    if (isAsterErrorWithMeta(err)) {
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
      ] as ToolDef[];
      wordWriteTools.forEach(assertWriteToolRegisterable);
      return [
        getDocumentFullText, getParagraphCount, getParagraphAt, getDocumentOutline,
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
      ] as ToolDef[];
      excelWriteTools.forEach(assertWriteToolRegisterable);
      return [
        listWorksheets, getRangeValues, getUsedRangeSummary,
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
      ] as ToolDef[];
      pptWriteTools.forEach(assertWriteToolRegisterable);
      return [
        listSlides, getSlide, listShapesOnSlide, getShape,
        ...pptWriteTools, selectionDetail,
      ].map((t) => t as ToolDef);
    }
    default:
      return [];
  }
}
