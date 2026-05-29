/**
 * src/lib/debugReport.test.ts — debugReport 守门测试
 *
 * 四个断言：
 * [KEY GATE]       buildDebugReport 输出不包含 API Key 原文
 * [SECTIONS]       报告含 5 个分节标题
 * [EMPTY MESSAGES] 空消息时不崩溃，输出「（无消息）」
 * [SELECTION TEXT] word 选区正文正确包含在报告里
 *
 * 安全约束 T-vtc-01：Key 绝不出现在报告里（结构性守门）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

vi.mock('../store/providers', () => ({
  useProviderStore: {
    getState: () => ({
      defaultLLMProviderId: 'prov-1',
      attachEnabled: true,
      providers: [
        {
          id: 'prov-1',
          name: 'TestProvider',
          baseURL: 'https://api.test.com',
          model: 'test-model',
          isBuiltIn: false,
          supportsToolCall: true,
        },
      ],
      configuredKeyIds: ['prov-1'],
    }),
  },
}));

vi.mock('../agent/agentStore', () => ({
  useAgentStore: {
    getState: () => ({
      agentStatus: 'idle',
      currentStep: 0,
      currentPhase: null,
      lastAbortReason: null,
      lastCircuitInfo: null,
    }),
  },
}));

vi.mock('../store/chat', () => ({
  useChatStore: {
    getState: () => ({
      messages: [],
    }),
  },
}));

vi.mock('../store/selection', () => ({
  useSelectionStore: {
    getState: () => ({
      initial: { kind: 'none' },
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock Office global（环境信息节）
// ---------------------------------------------------------------------------

vi.stubGlobal('Office', {
  context: {
    diagnostics: {
      host: 'PowerPoint',
      platform: 'OfficeOnline',
      version: '16.0.0',
    },
  },
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { buildDebugReport } from './debugReport';

describe('debugReport', () => {
  beforeEach(() => {
    // [KEY GATE] 在 localStorage 里注入真实 API Key（模拟用户存了 key）
    // 守门测试断言：buildDebugReport 的输出不能含此字符串
    localStorage.setItem('aster:keys:prov-1', JSON.stringify('sk-SECRET-abc123'));
  });

  it('[KEY GATE] buildDebugReport 输出不包含 API Key 原文', async () => {
    const report = await buildDebugReport();
    expect(report).not.toContain('sk-SECRET-abc123');
  });

  it('[SECTIONS] 报告含 5 个分节标题', async () => {
    const report = await buildDebugReport();
    for (const heading of ['## 环境', '## Provider 配置', '## Agent 状态', '## 当前选区', '## 聊天记录']) {
      expect(report).toContain(heading);
    }
  });

  it('[EMPTY MESSAGES] 空消息时不崩溃，输出（无消息）', async () => {
    const report = await buildDebugReport();
    expect(report).toContain('（无消息）');
  });

  it('[SELECTION TEXT] word 选区正文正确包含在报告里', async () => {
    // 覆盖 selection store mock：kind=word
    const selMod = await import('../store/selection');
    const origGetState = selMod.useSelectionStore.getState;
    selMod.useSelectionStore.getState = vi.fn(() => ({
      initial: { kind: 'word' as const, charCount: 5 },
    })) as typeof origGetState;

    // mock Word.run（全局）
    vi.stubGlobal('Word', {
      run: vi.fn(async (cb: (ctx: unknown) => Promise<unknown>) => {
        const fakeCtx = {
          document: {
            getSelection: () => ({
              load: vi.fn(),
              text: '测试文字',
            }),
          },
          sync: vi.fn().mockResolvedValue(undefined),
        };
        return cb(fakeCtx);
      }),
    });

    const report = await buildDebugReport();
    expect(report).toContain('测试文字');

    // 清理：恢复原始 getState
    selMod.useSelectionStore.getState = origGetState;
    vi.unstubAllGlobals();
    // 重新注入 Office global（其他测试需要）
    vi.stubGlobal('Office', {
      context: {
        diagnostics: {
          host: 'PowerPoint',
          platform: 'OfficeOnline',
          version: '16.0.0',
        },
      },
    });
  });
});
