/**
 * src/agent/loop-helpers.ts — runAgent 内 turn-level / tool-level helper
 *
 * 抽出此文件的目的：保 loop.ts D-02 ≤ 80 code lines（jsdoc + import + type + 纯括号行
 * 不计；纯 helper 实现细节也不应挤占 80 行预算）。
 *
 * 这里的三个函数都是 loop.ts 内的「内部 helper」语义 — 不导出到其他模块（仅 loop.ts 用）。
 */
import { useChatStore } from '../store/chat';
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
  chatActions().finalizeMessage?.(assistantMsgId, { isStreaming: false } as never);
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
  if (result.ok) breaker.recordSuccess(tc.name);
  else breaker.recordFailure(tc.name, result.error?.code ?? 'UNSUPPORTED');
  const humanLabel = def ? def.humanLabel(tc.arguments as never) : tc.name;
  chatActions().pushMessage?.({
    role: 'tool', toolCallId: tc.id, toolName: tc.name, toolResult: result,
    content: humanLabel, agentRunId: runId, agentStep: step,
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
      timestamp: Date.now(),
    });
  }
  return true;
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
