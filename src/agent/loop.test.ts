import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAgentStore } from './agentStore';
import { useChatStore } from '../store/chat';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

// ---------------------------------------------------------------------------
// Mock openai-compat.streamChat 在 import 前注入；不同 it 用 mockImplementation 改行为
// ---------------------------------------------------------------------------
vi.mock('../providers/openai-compat', () => {
  return {
    OpenAICompatibleLLM: vi.fn().mockImplementation(() => ({
      async *streamChat() {
        // 默认空流；it 内部通过 mockImplementation 覆盖
      },
    })),
    // Plan 04: INSERT_TO_DOCUMENT_TOOL 已删，本 mock 不再 expose 此常量
  };
});

import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { runAgent } from './loop';
import * as circuitBreaker from './circuit-breaker';
import { getWriteOpsByRun, __resetOperationLogForTest } from './operationLog';

function setLLMStream(events: unknown[]) {
  (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    async *streamChat() {
      for (const e of events) yield e as never;
    },
  }));
}

const mockAdapter = {
  capabilities: () => ({
    host: 'word' as const,
    supportsSelectionEvents: true,
    supportedInserts: ['text'],
  }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
} as unknown as DocumentAdapter;

beforeEach(() => {
  useAgentStore.setState({
    agentStatus: 'idle',
    currentStep: 0,
    currentRunId: null,
    controller: null,
    lastAbortReason: null,
    runningTools: [],
  });
  useChatStore.setState({ messages: [], summary: '', summaryThroughId: null, isStreaming: false, abortController: null } as never);
  (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockClear();
  circuitBreaker.__reset();
  __resetOperationLogForTest();
});

describe('runAgent — AGENT-01 自然 break', () => {
  it('LLM delta only（无 tool_calls）→ 自然 break，agentStatus = idle', async () => {
    setLLMStream([{ type: 'delta', content: 'done' }]);
    const ctrl = useAgentStore.getState().beginRun('r1');
    await runAgent('test', undefined, mockAdapter, ctrl.signal, 'r1');
    expect(useAgentStore.getState().agentStatus).toBe('idle');
    expect(ctrl.signal.aborted).toBe(false);
  });

  it('runAgent 第一轮没 tool_call → currentStep 在跑期间设置为 1', async () => {
    setLLMStream([{ type: 'delta', content: 'hello' }]);
    const ctrl = useAgentStore.getState().beginRun('r1');
    await runAgent('test', undefined, mockAdapter, ctrl.signal, 'r1');
    // endRun 后 currentStep 回 0；过程中应曾达 1，验证 idle 终态即可
    expect(useAgentStore.getState().agentStatus).toBe('idle');
    expect(useAgentStore.getState().currentStep).toBe(0);
  });
});

describe('runAgent — AGENT-02 max_steps soft landing', () => {
  it('hit MAX_STEPS 时不调 controller.abort，agentStatus = soft-landing', async () => {
    // 每轮使用不同工具名（missing_tool_0…N-1），绕过熔断器（同名 NOT_FOUND <3 次不触发）
    // runAgent 内部 new OpenAICompatibleLLM() 一次，每次 streamChat() 调用递增 turn
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      let turn = 0;
      return {
        async *streamChat() {
          const n = turn++;
          yield { type: 'tool_call_end', id: `c${n}`, name: `missing_tool_${n}`, arguments: '{}' } as never;
        },
      };
    });
    const ctrl = useAgentStore.getState().beginRun('r2');
    await runAgent('test', undefined, mockAdapter, ctrl.signal, 'r2');
    expect(useAgentStore.getState().agentStatus).toBe('soft-landing');
    expect(ctrl.signal.aborted).toBe(false); // 软着陆不 abort controller
  }, 15000);
});

describe('runAgent — 05-10 同轮多 write op 唯一 stepIndex（防 DiffLogPanel 单步撤销串状态）', () => {
  it('一轮内连调 3 次 append_paragraph → operationLog 三条 stepIndex 唯一 [0,1,2]', async () => {
    // turn 0：一次性发 3 个 append_paragraph tool_call（同一 loop step）；turn 1：delta-only → 自然 break
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => {
      let turn = 0;
      return {
        async *streamChat() {
          const n = turn++;
          if (n === 0) {
            yield { type: 'tool_call_end', id: 'c0', name: 'append_paragraph', arguments: JSON.stringify({ text: '段1' }) } as never;
            yield { type: 'tool_call_end', id: 'c1', name: 'append_paragraph', arguments: JSON.stringify({ text: '段2' }) } as never;
            yield { type: 'tool_call_end', id: 'c2', name: 'append_paragraph', arguments: JSON.stringify({ text: '段3' }) } as never;
          } else {
            yield { type: 'delta', content: 'done' } as never;
          }
        },
      };
    });

    // word adapter，appendParagraph 成功（让 append_paragraph 工具返回 reverse → 入 operationLog）
    const wordAdapter = {
      capabilities: () => ({ host: 'word' as const, supportsSelectionEvents: true, supportedInserts: ['text'] }),
      getSelection: async () => ({ kind: 'none' as const }),
      onSelectionChanged: () => () => {},
      insert: async () => {},
      appendParagraph: async () => {},
    } as unknown as DocumentAdapter;

    const ctrl = useAgentStore.getState().beginRun('rStep');
    await runAgent('test', undefined, wordAdapter, ctrl.signal, 'rStep');

    const ops = getWriteOpsByRun('rStep');
    expect(ops).toHaveLength(3);
    // 唯一递增序号——旧代码全 = loop step（碰撞）→ DiffLogPanel 撤一步全行变「已撤销」
    expect(ops.map((o) => o.stepIndex)).toEqual([0, 1, 2]);
    expect(new Set(ops.map((o) => o.stepIndex)).size).toBe(3);
  });
});

describe('runAgent — AGENT-13 signal abort 中断', () => {
  it('signal 在跑前 abort → runAgent 立即 return', async () => {
    setLLMStream([{ type: 'delta', content: 'hi' }]);
    const ctrl = useAgentStore.getState().beginRun('r3');
    ctrl.abort();
    await runAgent('test', undefined, mockAdapter, ctrl.signal, 'r3');
    // agent 不应进入 soft-landing；endRun 会保持 idle
    expect(useAgentStore.getState().agentStatus).not.toBe('soft-landing');
  });
});

describe('runAgent — CTX-01 wire 时间后缀到当前 user message', () => {
  it('messages 构造时最后一条 user message 含分钟级时钟（HH:MM）', async () => {
    // 捕获实际发给 LLM 的 messages（streamChat 首参 = messages 数组）
    let capturedMessages: unknown[] | undefined;
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      async *streamChat(messages: unknown[]) {
        // 快照：streamAssistantTurn 在 streamChat 返回后会 push assistant 消息到同一数组引用，
        // 必须 copy 才能断言「调用时」最后一条是 user message（否则末条变 assistant）。
        capturedMessages = [...messages];
        yield { type: 'delta', content: 'done' } as never;
      },
    }));
    const ctrl = useAgentStore.getState().beginRun('r-ctx01');
    await runAgent('测试用户输入', undefined, mockAdapter, ctrl.signal, 'r-ctx01');
    const lastMsg = capturedMessages?.[capturedMessages.length - 1] as
      | { role: string; content: string }
      | undefined;
    expect(lastMsg?.role).toBe('user');
    expect(lastMsg?.content).toMatch(/\d{1,2}:\d{2}/); // 含时钟 HH:MM（buildTimeContext 已拼入）
  });
});

// ---------------------------------------------------------------------------
// Phase 21 — CTX-03/04 compaction 接线 + 跨轮缓存稳定守门
// ---------------------------------------------------------------------------

describe('runAgent — CTX-03/04 compaction 接线', () => {
  it('历史超高水位 -> 触发压缩：wire 出现 system 角色摘要消息，chatStore 历史不被 mutate', async () => {
    // seed 超 HIGH 历史（16 条，每条 ~25K token = ~40K 字符，合计 > 120K token）
    const big = 'x'.repeat(40_000);
    const seed = Array.from({ length: 16 }, (_, i) => ({
      id: `m${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: big, ts: i,
    }));
    useChatStore.setState({ messages: seed, summary: '', summaryThroughId: null } as never);
    const calls: Array<Array<{ role: string; content: string }>> = [];
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      async *streamChat(messages: unknown[]) { calls.push([...messages] as never); yield { type: 'delta', content: '摘要' } as never; },
    }));
    const ctrl = useAgentStore.getState().beginRun('r-cmp');
    await runAgent('新问题', undefined, mockAdapter, ctrl.signal, 'r-cmp');
    // 压缩调用先发生（2 条 messages：summarizer system + user），主 run 调用其后（length > 2）
    expect(useChatStore.getState().summary).toBe('摘要');
    // 16 条原始历史一条不少（compaction 绝不 mutate UI 历史）；主 run 另追加的 assistant 回复气泡不在此断言范围
    const seedMsgs = useChatStore.getState().messages.filter((m) => /^m\d+$/.test(m.id));
    expect(seedMsgs).toHaveLength(16);
    // 主 run wire（messages 含 system + 摘要 system + 最近原文 + 当前 user）messages[1] = 摘要
    const mainCall = calls.find((c) => c.length > 2) as Array<{ role: string; content: string }>;
    expect(mainCall[0].role).toBe('system');
    expect(mainCall[1].role).toBe('system');
    expect(mainCall[1].content).toContain('对话历史摘要');
  }, 15000);

  it('历史在高水位以下 -> 不压缩：summary 保持空，wire 无摘要消息', async () => {
    useChatStore.setState({ messages: [{ id: 'u', role: 'user', content: '短', ts: 1 }], summary: '', summaryThroughId: null } as never);
    let captured: Array<{ role: string; content: string }> | undefined;
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      async *streamChat(messages: unknown[]) { captured = [...messages] as never; yield { type: 'delta', content: 'done' } as never; },
    }));
    const ctrl = useAgentStore.getState().beginRun('r-nocmp');
    await runAgent('问题', undefined, mockAdapter, ctrl.signal, 'r-nocmp');
    expect(useChatStore.getState().summary).toBe('');
    // wire 无 system 摘要消息
    expect(captured?.filter((m) => m.role === 'system' && m.content.includes('对话历史摘要')).length).toBe(0);
  });

  // REVISION 2（核心缓存命中守门，MUST）：一次压缩后，连续两个 sub-HIGH 轮里 cutoff 绝不每轮推进、
  // [system][摘要] 前缀逐字稳定。少了这条，「每轮 re-compact」回归会通过所有其它测试却悄悄毁掉 CTX-04 的命中率（本 phase 全部目的）。
  it('一次压缩后跨两个 sub-HIGH 轮 — summaryThroughId/summary 不变 + [system][摘要] 前缀字节稳定', async () => {
    const big = 'x'.repeat(40_000); // 每条 ~25K token
    const seed = Array.from({ length: 16 }, (_, i) => ({
      id: `m${i}`, role: i % 2 === 0 ? 'user' : 'assistant', content: big, ts: i,
    }));
    useChatStore.setState({ messages: seed, summary: '', summaryThroughId: null } as never);
    const calls: Array<Array<{ role: string; content: string }>> = [];
    (OpenAICompatibleLLM as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      async *streamChat(messages: unknown[]) { calls.push([...messages] as never); yield { type: 'delta', content: 'S1' } as never; },
    }));
    // 第一轮：超 HIGH -> 触发压缩，捕获 C1 / S1 / wireA
    const c1 = useAgentStore.getState().beginRun('r-t1');
    await runAgent('问题1', undefined, mockAdapter, c1.signal, 'r-t1');
    const C1 = useChatStore.getState().summaryThroughId;
    const S1 = useChatStore.getState().summary;
    expect(C1).not.toBeNull();
    expect(S1).toBe('S1');
    const wireA = calls.find((c) => c.length > 2)!;       // 第一轮主 run wire
    const beforeSecond = calls.length;
    // 第二轮：post-C1 原文已到地板 -> selectCompactionPlan toFold 空 -> 不应再压缩（不 re-compact every turn）
    const c2 = useAgentStore.getState().beginRun('r-t2');
    await runAgent('问题2', undefined, mockAdapter, c2.signal, 'r-t2');
    expect(useChatStore.getState().summaryThroughId).toBe(C1); // cutoff 未推进
    expect(useChatStore.getState().summary).toBe(S1);          // summary 未变
    const wireB = calls.slice(beforeSecond).find((c) => c.length > 2)!; // 第二轮主 run wire
    expect(wireB[0].role).toBe('system');
    expect(wireB[1].role).toBe('system');
    expect(wireB[0].content).toBe(wireA[0].content); // [system] 字节稳定
    expect(wireB[1].content).toBe(wireA[1].content); // [摘要] 字节稳定 -> 前缀缓存命中
  }, 15000);
});
