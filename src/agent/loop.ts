/**
 * src/agent/loop.ts — Phase 3 agent 主路径（AGENT-01 / AGENT-02 / AGENT-13）
 *
 * D-02 预算：本文件 ≤ 80 code lines（jsdoc + import + type 声明 + 纯括号行不计）。
 * turn-level / tool-level helper 抽到 src/agent/loop-helpers.ts，避开主路径 80 行预算。
 *
 * OpenAI tool calling 协议关键点（详见 loop-helpers.ts streamAssistantTurn / runOneToolCall）：
 *   - messages 数组在循环内累积：每轮 assistant push 完整 tool_calls，每个 tool 完成后 push role:'tool'
 *   - 双路径 push（LLM wire vs chatStore UI）— wire 用 JSON.stringify(result)，UI 用 humanLabel(args)
 *
 * 软着陆（D-09）：hit MAX_STEPS=20 后**不**调 controller.abort()，push 特殊 soft-landing 消息让用户选择
 * 「继续」（agentStore.continueRun reset 计数器再跑 20）或「停止」（agentStore.abort('user')）。
 */
import { useAgentStore, MAX_STEPS } from './agentStore';
import { useProviderStore } from '../store/providers';
import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { buildToolsForHost } from './tools';
import { buildSystemPrompt } from './system-prompt';
import type { DocumentAdapter, SelectionContext } from '../adapters/DocumentAdapter';
import {
  streamAssistantTurn,
  runOneToolCall,
  pushSoftLanding,
  truncateTo20Turns,
  type WireMessage,
} from './loop-helpers';
import { usePreferencesStore } from '../store/preferences';
import { useChatStore } from '../store/chat';
import { getDocKey } from '../lib/docKey';

// MAX_STEPS 已上移到 agentStore（轻量模块），此处 import 复用，避免重复定义。

function resolveLLMConfig() {
  const ps = useProviderStore.getState();
  const provider = ps.providers.find((p) => p.id === ps.defaultLLMProviderId);
  if (!provider) throw new Error('未配置默认 LLM Provider');
  const apiKey = ps.getKey(provider.id) ?? '';
  return {
    providerId: provider.id,
    baseURL: provider.baseURL,
    apiKey,
    model: provider.model,
  };
}

export async function runAgent(
  userPrompt: string,
  _selectionCtx: SelectionContext | undefined,
  adapter: DocumentAdapter,
  signal: AbortSignal,
  runId: string,
): Promise<void> {
  const host = adapter.capabilities().host;
  const tools = buildToolsForHost(host);
  const toolDefs = tools.length > 0
    ? tools.map((t) => ({
        type: 'function' as const,
        function: { name: t.name, description: t.description, parameters: t.parameters },
      }))
    : undefined;
  const llm = new OpenAICompatibleLLM();
  const cfg = resolveLLMConfig();

  // Phase 8: docKey（saveHistory 用）+ 偏好 + 历史截断
  const docKey = await getDocKey();
  const userPrefs = usePreferencesStore.getState().userPrefs;
  const historicalMsgs = truncateTo20Turns(useChatStore.getState().messages)
    .filter((m) => m.role === 'user' || m.role === 'assistant');

  const messages: WireMessage[] = [
    { role: 'system', content: buildSystemPrompt(host, userPrefs ? { userPrefs } : undefined) },
    ...historicalMsgs.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: userPrompt },
  ];
  let step = 0;
  while (step < MAX_STEPS) {
    step++;
    if (signal.aborted) return;
    useAgentStore.getState().setCurrentStep(step);
    await useAgentStore.getState().awaitResume(signal);
    if (signal.aborted) return;
    useAgentStore.getState().setPhase('thinking');
    const toolCallsThisTurn = await streamAssistantTurn(
      llm, messages, cfg, signal, toolDefs, runId, step,
    );
    if (toolCallsThisTurn.length === 0) {
      // saveHistory: 仅正常结束保存；error/abort 路径豁免（消息不完整）
      useChatStore.getState().saveHistory(docKey);
      useAgentStore.getState().endRun();
      return;
    }
    for (const tc of toolCallsThisTurn) {
      if (signal.aborted) return;
      const cont = await runOneToolCall(tc, tools, adapter, messages, signal, runId, step);
      if (!cont) return;
    }
  }
  pushSoftLanding(runId, MAX_STEPS);
}
