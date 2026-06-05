/**
 * src/agent/loop-helpers.ts — runAgent 内 turn-level / tool-level helper
 *
 * 抽出此文件的目的：保 loop.ts D-02 ≤ 80 code lines（jsdoc + import + type + 纯括号行
 * 不计；纯 helper 实现细节也不应挤占 80 行预算）。
 *
 * 这里的三个函数都是 loop.ts 内的「内部 helper」语义 — 不导出到其他模块（仅 loop.ts 用）。
 */
import { useChatStore, type Message } from '../store/chat';
import { useAgentStore } from './agentStore';
import {
  dispatchTool,
  type ToolCallInvocation,
  type ToolDef,
  type ToolResult,
} from './tools';
import * as breaker from './circuit-breaker';
import { appendOperation, getOperationsByRun } from './operationLog';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { CircuitOpenError, StepLimitError } from '../errors';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';
import { estimateTokens, RECENT_TURNS_FLOOR, HISTORY_BACKSTOP_MAX_TOKENS } from './compaction';

export type WireMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string;
      /**
       * DeepSeek thinking 模式：上一轮流式累积的 reasoning_content（思维链）。
       * 真机实测：带 tool 结果发起的下一轮请求里，assistant 消息缺此字段会被 DeepSeek 拒为 400。
       * 仅在非空时附上（见 streamAssistantTurn）——不返回 reasoning 的 Provider 不带此字段，零影响。
       */
      reasoning_content?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: { name: string; arguments: string };
      }>;
    }
  | { role: 'tool'; tool_call_id: string; content: string };

export function safeParseJSON(s: string): Record<string, unknown> | null {
  try {
    return JSON.parse(s) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Plan 06 才在 chatStore 上加 pushMessage / appendDeltaToMessage / finalizeMessage 三个 thin
 * delegate 方法。Phase 3 用 optional chaining 避免 runtime 报错，并用此 helper 把整个
 * chatStore type 收成 record 以避开 TS 严格模式（避免在 loop body 内散落 cast）。
 *
 * 一旦 Plan 06 在 ChatState 接口上声明三方法，可直接删此 helper，恢复直接 useChatStore.getState() 调用。
 */
type ChatStoreLike = Record<string, ((...args: unknown[]) => unknown) | undefined>;
function chatActions(): ChatStoreLike {
  return useChatStore.getState() as unknown as ChatStoreLike;
}

/**
 * 流一轮 assistant turn：拉 SSE → 收 delta / reasoning_delta / tool_call_end → 把 assistant
 * message 累积到 wire messages（含 tool_calls 字段供 LLM 下轮匹配 tool_call_id；DeepSeek thinking
 * 模式下还须带 reasoning_content，否则下一轮 400）。
 */
export async function streamAssistantTurn(
  llm: OpenAICompatibleLLM,
  messages: WireMessage[],
  cfg: unknown,
  signal: AbortSignal,
  toolDefs: Parameters<OpenAICompatibleLLM['streamChat']>[3],
  runId: string,
  step: number,
): Promise<ToolCallInvocation[]> {
  const assistantMsgId = crypto.randomUUID();
  chatActions().pushMessage?.({
    id: assistantMsgId, role: 'assistant', content: '', isStreaming: true,
    agentRunId: runId, agentStep: step,
  } as never);
  let assistantContent = '';
  let reasoningContent = '';
  const toolCallsThisTurn: ToolCallInvocation[] = [];
  for await (const ev of llm.streamChat(messages as never, cfg as never, signal, toolDefs)) {
    if (ev.type === 'delta') {
      assistantContent += ev.content;
      chatActions().appendDeltaToMessage?.(assistantMsgId, ev.content);
    } else if (ev.type === 'reasoning_delta') {
      // DeepSeek thinking 模式思维链：仅累积以便回传下一轮（不渲染进 UI，超出本次范围）
      reasoningContent += ev.content;
    } else if (ev.type === 'tool_call_end') {
      const args = safeParseJSON(ev.arguments);
      if (args) toolCallsThisTurn.push({ id: ev.id, name: ev.name, arguments: args });
    }
  }
  // toolCalls 必须落到 chat STORE 的 assistant 消息上（而非仅下方 wire messages）：
  // ChatStream 从 store 的 m.toolCalls 里按 c.id === message.toolCallId && c.name === 'apply_slide_layout'
  // 反查触发该卡的 toolCall，读 tc.arguments.layout 推出 layoutArgs，据此条件挂载 <SlidePreviewPanel>
  // （挂载时 registerPreviewElement，visual_check_slide 才有 DOM 可截图自查）。
  // 之前 finalize 只写 { isStreaming:false }，store 消息的 toolCalls 永远为空 → layoutArgs 恒 null
  // → 预览面板从不挂载 → visual_check_slide 永远返回「预览面板未打开」跳过（UAT-11 真机根因）。
  // 仅在本轮确有 tool call 时写入；无 tool call 轮保持 toolCalls 未设（与旧行为一致）。
  chatActions().finalizeMessage?.(assistantMsgId, {
    isStreaming: false,
    ...(toolCallsThisTurn.length > 0 ? { toolCalls: toolCallsThisTurn } : {}),
  } as never);
  messages.push({
    role: 'assistant', content: assistantContent,
    // 非空守卫：只有 Provider 真返回了 reasoning_content 才回传（DeepSeek thinking 模式必需）；
    // 不返回 reasoning 的 Provider（AiHubMix gpt-5.1 / gemini-3.5-flash）此字段保持 undefined。
    ...(reasoningContent ? { reasoning_content: reasoningContent } : {}),
    tool_calls: toolCallsThisTurn.length > 0
      ? toolCallsThisTurn.map((tc) => ({
          id: tc.id, type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        }))
      : undefined,
  });
  return toolCallsThisTurn;
}

/**
 * 单 tool dispatch + 双路径 push + reverse 落 operationLog。
 * 返回 false 表示 circuit-open 已 abort，外层应整轮 return；true 表示继续下一 tool。
 */
export async function runOneToolCall(
  tc: ToolCallInvocation,
  tools: ToolDef[],
  adapter: DocumentAdapter,
  messages: WireMessage[],
  signal: AbortSignal,
  runId: string,
  step: number,
): Promise<boolean> {
  if (breaker.isOpen(tc.name)) {
    const summary = breaker.getFailureSummary(tc.name);
    useAgentStore.getState().setCircuitInfo({
      toolName: tc.name,
      code: summary?.code ?? 'UNSUPPORTED',
      count: summary?.count ?? 3,
    });
    useAgentStore.getState().abort('circuit');
    const errInstance = new CircuitOpenError(tc.name);
    chatActions().pushMessage?.({
      role: 'tool', toolCallId: tc.id, toolName: tc.name,
      toolResult: { ok: false, error: { code: 'CIRCUIT_OPEN', message: errInstance.message, hint: errInstance.hint, recoverable: false } },
      content: errInstance.message, agentRunId: runId, agentStep: step,
    } as never);
    messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ ok: false, error: { code: 'CIRCUIT_OPEN' } }) });
    return false;
  }
  const def = tools.find((t) => t.name === tc.name);
  useAgentStore.getState().setPhase(def?.kind === 'write' ? 'writing' : 'reading');
  const result: ToolResult = await dispatchTool(tc, { adapter, runId, stepIndex: step, signal }, tools);
  // W1 修复：部分失败的 batch（ok:true + partialFailure:true）须走 recordFailure，
  // 否则熔断器把它当成功，反复部分失败的 batch_write 永远无法开路。
  if (result.ok && !result.partialFailure) breaker.recordSuccess(tc.name);
  else breaker.recordFailure(tc.name, result.error?.code ?? 'PARTIAL_BATCH_FAILURE');
  const humanLabel = def ? def.humanLabel(tc.arguments as never) : tc.name;
  chatActions().pushMessage?.({
    role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
    content: humanLabel, agentRunId: runId, agentStep: step,
    kind: def?.kind,  // UI-05 D-14: propagate read/write kind（def 已在上方 tools.find 解析，零额外查表）
  } as never);
  messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
  if (result.reverse && def) {
    // stepIndex 必须按 write op 唯一（DiffLogPanel 用它当 React key + per-step 撤销 state 的键）。
    // 不能用 loop `step`——同一轮里 LLM 常一次调多个 write tool（如连追 3 段），它们共享同一 step，
    // 会让 stepStates 键碰撞 → 撤一步全行显示「已撤销」(05-10 UI bug)。
    // appendOperation 仅在 write op（result.reverse）时调用，故已记录数即下一个唯一递增序号。
    const opIndex = getOperationsByRun(runId).length;
    appendOperation({
      runId, stepIndex: opIndex, toolName: tc.name, args: tc.arguments,
      humanLabel, reverse: result.reverse,
      postState: result.postState,   // Phase 5 TOOL-04：透传 postState 快照
      subOps: result.subOps,         // Phase 11 新增：batch 条目时透传 subOps 到 OperationLogEntry
      timestamp: Date.now(),
    });
  }
  return true;
}

// ---------------------------------------------------------------------------
// Phase 21 CTX-05: applyHistoryBackstop（取代 truncateTo20Turns）
// ---------------------------------------------------------------------------

/**
 * 极端长对话兜底（CTX-05）。常规长度控制 = compaction（compaction.ts，折老入摘要不丢内容）；
 * 本函数仅在 compaction 失效（压缩 LLM 调用失败）或压后原文仍超硬顶时作为最后防线，
 * 按整轮（user + 其后 assistant/tool，直到下一条 user）丢最老的，防止 wire 无上限增长撑爆 context。
 *
 * 诚实降级：这是「盲丢最老整轮」，仅当摘要不可用时启用；正常路径估算 <= maxTokens 时直接 no-op（前缀稳定）。
 * 永不丢到少于 RECENT_TURNS_FLOOR 个 user 轮（保护即时上下文）。
 *
 * @param messages   原文消息（通常已是 post-cutoff 的最近原文）
 * @param maxTokens  token 硬顶（缺省 HISTORY_BACKSTOP_MAX_TOKENS，高于高水位 → 正常不触发）
 */
export function applyHistoryBackstop(
  messages: Message[],
  maxTokens: number = HISTORY_BACKSTOP_MAX_TOKENS,
): Message[] {
  const sumTokens = (msgs: Message[]) => msgs.reduce((s, m) => s + estimateTokens(m.content), 0);
  if (sumTokens(messages) <= maxTokens) return messages; // 正常路径 no-op
  const userIdx = messages.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0);
  if (userIdx.length <= RECENT_TURNS_FLOOR) return messages; // 已到地板，不再丢
  // 从最老整轮开始丢：候选起点 = 各 user 边界；选「后缀 <= maxTokens」的最早边界，但保留地板
  const floorStart = userIdx[userIdx.length - RECENT_TURNS_FLOOR];
  let start = floorStart;
  for (let k = 0; k <= userIdx.length - RECENT_TURNS_FLOOR; k++) {
    const s = userIdx[k];
    if (sumTokens(messages.slice(s)) <= maxTokens) { start = s; break; }
    start = floorStart; // 落到地板兜底
  }
  return messages.slice(start);
}

export function pushSoftLanding(runId: string, maxSteps: number): void {
  const stepLimitErr = new StepLimitError();
  useAgentStore.getState().setSoftLanding(runId);
  chatActions().pushMessage?.({
    role: 'tool', toolName: 'soft-landing',
    content: 'Aster 觉得这事还没干完，要继续吗？',
    toolResult: { ok: false, error: { code: 'STEP_LIMIT', message: stepLimitErr.message, hint: stepLimitErr.hint, recoverable: true } },
    agentRunId: runId, agentStep: maxSteps,
  } as never);
}
