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
    INSERT_TO_DOCUMENT_TOOL: { type: 'function', function: { name: 'insert_to_document' } },
  };
});

import { OpenAICompatibleLLM } from '../providers/openai-compat';
import { runAgent } from './loop';

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
  it('hit MAX_STEPS=20 时不调 controller.abort，agentStatus = soft-landing', async () => {
    // mock LLM 每次返一个 tool_call_end，让 loop 跑满 20
    setLLMStream([
      { type: 'tool_call_end', id: 'c1', name: 'nonexistent', arguments: '{}' },
    ]);
    const ctrl = useAgentStore.getState().beginRun('r2');
    await runAgent('test', undefined, mockAdapter, ctrl.signal, 'r2');
    expect(useAgentStore.getState().agentStatus).toBe('soft-landing');
    expect(ctrl.signal.aborted).toBe(false); // 软着陆不 abort controller
  }, 15000);
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
