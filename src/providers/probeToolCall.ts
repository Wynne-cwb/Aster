/**
 * src/providers/probeToolCall.ts — A-21 主动 tool-call 兼容性探针
 *
 * 安全约束（T-07-01）：不得把 config.apiKey 写入任何日志或 Error.message。
 * 调用方（ProviderForm.tsx）负责决定何时调用（仅非内置、已保存的 Provider）。
 *
 * 设计要点：
 * - 用 `decided` sentinel（W4）区分「已 settle 决策」vs「纯超时」，杜绝 abort 来源歧义
 * - OpenAICompatibleLLM.streamChat 内部会静默吞掉 AbortError（返回 generator done）
 *   所以超时路径走的是：loop 正常退出 → `!decided && controller.signal.aborted` → null
 * - catch 块保留作为安全兜底（直接使用 streamSSE 等场景的 AbortError 路径）
 */
import type { LLMConfig } from './types';
import { OpenAICompatibleLLM } from './openai-compat';

// ---------------------------------------------------------------------------
// Probe 常量
// ---------------------------------------------------------------------------

const PROBE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'aster_ping',
    description: 'Aster compatibility probe. Call this function immediately.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
};

const PROBE_MESSAGES = [{ role: 'user' as const, content: 'Call the aster_ping tool now.' }];

// ---------------------------------------------------------------------------
// probeToolCallSupport
// ---------------------------------------------------------------------------

/**
 * 发一次最简 dummy tool call，判定 Provider 是否支持 tool calling。
 *
 * @returns true  = 支持（收到 tool_call_delta 或 tool_call_end）
 *          false = 不支持（收到文字 delta，或其他网络错误）
 *          null  = 超时（10s 内未 settle 任何决策），调用方不写回 supportsToolCall
 */
export async function probeToolCallSupport(config: LLMConfig): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  // W4 — 显式 sentinel：是否已 settle 出 true/false 决策。
  // 区分两种 loop 退出原因：
  //   decided === true  → 我们检测到结果后主动 abort（probe 已 return，不到这里）
  //   decided === false → 10s 超时触发 abort，无决策 → null
  let decided = false;

  try {
    const llm = new OpenAICompatibleLLM();
    const gen = llm.streamChat(PROBE_MESSAGES, config, controller.signal, [PROBE_TOOL]);

    for await (const event of gen) {
      // type === 'tool_call_delta' 或 'tool_call_end'：Provider 已发 tool call → 支持
      if (event.type === 'tool_call_delta' || event.type === 'tool_call_end') {
        decided = true;          // 标记决策已 settle（在 abort 之前置位）
        controller.abort();      // 停止流，不读剩余 chunks
        return true;
      }
      // type === 'delta'：Provider 直接用文字回答（无 tool call） → 不支持
      if (event.type === 'delta') {
        decided = true;
        controller.abort();
        return false;
      }
      // 'reasoning_delta' / 'usage'：忽略，继续等待
    }

    // Generator 正常退出（loop 结束）— 两种可能：
    //   A. 超时 abort → streamChat 静默吞掉 AbortError，generator 正常结束；
    //      此时 decided=false + signal.aborted=true → null
    //   B. 流自然结束但无 decisive event → decided=false + signal.aborted=false → false
    if (!decided && controller.signal.aborted) {
      return null;
    }
    decided = true;
    return false;
  } catch (e) {
    // 安全兜底：若 AbortError 意外传播到此（例如 streamSSE 直连路径），
    // 用 decided sentinel 区分超时（null）vs 已决策（false）
    if (e instanceof Error && e.name === 'AbortError') {
      return decided ? false : null;
    }
    // 4xx 等其他网络错误：视为不支持
    // 注意：不 log e.message（可能含 apiKey，T-07-01）
    return false;
  } finally {
    clearTimeout(timer);
  }
}
