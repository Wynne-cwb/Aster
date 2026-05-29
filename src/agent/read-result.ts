/**
 * src/agent/read-result.ts — read 结果包装 + size cap（TOOL-05 / TOOL-06）
 *
 * 三个纯函数，无副作用，无 React，无 Office.js 依赖：
 *   estimateTokens  — 字符数近似 token 数（无 tokenizer，D-12 / Assumption A2）
 *   applySizeCap    — 超 50K tokens 截断并标记 truncated:true（T-04-02 DoS 防护）
 *   wrapReadResult  — 把 adapter 成功结果包装成 WrappedReadResult；失败结果原样透传
 *
 * result_type 分类规则（RESEARCH Pattern 2 L208-210）：
 *   metadata         = 结构/计数类（list_slides / get_paragraph_count / list_worksheets /
 *                      get_used_range_summary / list_shapes_on_slide / get_document_outline）
 *   document_content = 含用户正文（get_slide / get_shape / get_range_values /
 *                      get_paragraph_at / get_document_full_text / selection_detail）
 *   分类由调用方 tool execute 传 opts.result_type 决定（Plan 06 各 tool 传对应值）。
 *
 * T-04-01 安全注记：content 是纯字符串（JSON.stringify(data)），不夹带额外字段；
 *   result_type 让 LLM system prompt 区分 evidence（document_content）vs 元数据（metadata），
 *   降低 prompt injection 风险（配合 system-prompt.ts rule 3）。
 */

import type { ToolResult } from './tools';

/** 50K token 硬上限（T-04-02 DoS 防护；偏大估算让 cap 更早触发，安全方向）。*/
const HARD_CAP_TOKENS = 50_000;

/**
 * 字符 → token 近似（无 tokenizer）。
 * 保守上界：中文密集场景约 1.6 字符/token（比实际 2.5 中文字/token 更小的分母
 * → 估算偏大 → cap 更早触发 = 安全方向，D-12 / Assumption A2）。
 */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 1.6);
}

/**
 * 对 content 字符串应用 50K token 硬上限。
 * 超限则截到 ≤80000 字符并追加 '\n…[truncated]'。
 */
export function applySizeCap(content: string): { content: string; truncated: boolean } {
  if (estimateTokens(content) <= HARD_CAP_TOKENS) {
    return { content, truncated: false };
  }
  const maxChars = HARD_CAP_TOKENS * 1.6; // = 80000
  return {
    content: content.slice(0, maxChars) + '\n…[truncated]',
    truncated: true,
  };
}

/** read 结果的 result_type 分类。*/
export type ReadResultType = 'document_content' | 'metadata';

/** wrapReadResult 成功时返回的包装结构，嵌入 ToolResult.data。*/
export interface WrappedReadResult {
  result_type: ReadResultType;
  content: string;  // JSON.stringify(data) 经 applySizeCap
  source: string;   // tool 名称 / 路径，e.g. 'document.paragraph_count'
  truncated: boolean;
}

/**
 * 把 adapter 返回的 ToolResult 包装成带 result_type 的结构。
 *
 * - 成功（ok=true）：data → JSON.stringify → applySizeCap → WrappedReadResult 塞入新 ToolResult.data
 * - 失败（ok=false）：原样透传（下游 dispatchTool allowlist sanitize D-15 已处理）
 *
 * 包装对象塞进 ToolResult.data，loop-helpers 现有 JSON.stringify(result) 透传时
 * wire content 自然含包装（不改 loop-helpers，Plan 06 验证透传）。
 */
export function wrapReadResult(
  result: ToolResult,
  opts: { result_type: ReadResultType; source: string },
): ToolResult {
  if (!result.ok) {
    // 失败透传：不读 err.stack / err.toString()（T-04-03）
    return result;
  }

  const raw = JSON.stringify(result.data ?? null);
  const { content, truncated } = applySizeCap(raw);

  return {
    ok: true,
    data: {
      result_type: opts.result_type,
      content,
      source: opts.source,
      truncated,
    } satisfies WrappedReadResult,
  };
}
