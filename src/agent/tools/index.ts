/**
 * src/agent/tools/index.ts — Tool registry + dispatchTool（D-07 / D-15）
 *
 * 严格 allowlist sanitize 边界（ERR-02）：
 *   - AsterError 子类（含 isAsterErrorWithMeta 守卫）→ 只读 .code/.message/.hint/.recoverable 四字段
 *   - 陌生异常（非 AsterError）→ 一律兜底 UNSUPPORTED + '宿主操作失败' + '发生错误，请重试'
 *   - 严禁读 err.stack / err.toString() / err.name / 其它字段
 */
import type { DocumentAdapter } from '../../adapters/DocumentAdapter';
import { AsterError, isAsterErrorWithMeta } from '../../errors';
import type { ReverseDescriptor } from '../operationLog';
import { appendParagraph } from './write/word';

const FALLBACK_HINT = '发生错误，请重试';

export type ToolErrorCode =
  | 'INVALID_ARGS'
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

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: ToolError;
  reverse?: ReverseDescriptor;
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
    return await def.execute(call.arguments as never, ctx);
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

/**
 * 按 host 返回当前可注册的 ToolDef array（OpenAI tools wire 格式由 caller 转换）。
 * Phase 3 Plan 04 落地：Word host 接 1 个真实 write tool（append_paragraph）；
 * 其它 host 返空数组（Phase 4 / 6 填）。
 */
export function buildToolsForHost(host: 'word' | 'excel' | 'ppt'): ToolDef[] {
  switch (host) {
    case 'word':
      return [appendParagraph];
    case 'excel':
      return [];
    case 'ppt':
      return [];
    default:
      return [];
  }
}
