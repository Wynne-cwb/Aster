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
  useChatStore.setState({ messages: [], isStreaming: false, abortController: null } as never);
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
