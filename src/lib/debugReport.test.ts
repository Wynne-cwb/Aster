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

  it('[STEPLOG TITLE] buildDebugReport 输出含操作记录段标题', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-t1',
          role: 'user' as const,
          content: '帮我整理',
          ts: 1000000000000,
        },
      ],
    })) as unknown as typeof orig;

    const report = await buildDebugReport();

    chatMod.useChatStore.getState = orig;

    expect(report).toContain('# Aster 操作记录');
  });

  it('[STEPLOG TOOL DATA] buildDebugReport 输出含 tool data 字段', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-tool',
          role: 'tool' as const,
          content: '追加段落',
          toolName: 'append_paragraph',
          toolResult: { ok: true as const, data: { written: 5 } },
          ts: 1000000002000,
        },
      ],
    })) as unknown as typeof orig;

    const report = await buildDebugReport();

    chatMod.useChatStore.getState = orig;

    // tool data 字段出现在拼接段
    expect(report).toContain('written');
  });

  it('[BUILD STAMP 260604-gld] buildDebugReport 输出含 build 版本戳行', async () => {
    const report = await buildDebugReport();
    // define 在 vitest 下生效 → 真实 commit；未生效 → 'unknown'。无论哪种都必须有 build 行。
    expect(report).toMatch(/- build: .+ @ .+/);
  });

  it('[FAIL REASON 260604-gld] 失败 tool 在聊天段透出 error code/message/hint', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-fail',
          role: 'tool' as const,
          content: '套用版式',
          toolName: 'apply_slide_layout',
          toolResult: {
            ok: false as const,
            error: {
              code: 'HOST_API_FAILED',
              message: 'PPT applySlideLayout 失败',
              recoverable: true,
              hint: '宿主操作可瞬时失败，可重试一次',
            },
          },
          ts: 1000000004000,
        },
      ],
    })) as unknown as typeof orig;

    const report = await buildDebugReport();
    chatMod.useChatStore.getState = orig;

    expect(report).toContain('ok=false');
    expect(report).toContain('HOST_API_FAILED');
    expect(report).toContain('PPT applySlideLayout 失败');
    expect(report).toContain('宿主操作可瞬时失败，可重试一次');
  });

  it('[FAIL REASON REDACT 260604-gld] 失败 tool error.message 含 sk- 仍脱敏', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-fail-leak',
          role: 'tool' as const,
          content: '失败',
          toolName: 'x',
          toolResult: {
            ok: false as const,
            error: {
              code: 'HOST_API_FAILED',
              message: '泄露 sk-SECRET-abc123 了',
              recoverable: true,
              hint: 'hint sk-SECRET-abc123',
            },
          },
          ts: 1000000005000,
        },
      ],
    })) as unknown as typeof orig;

    const report = await buildDebugReport();
    chatMod.useChatStore.getState = orig;

    // 防御性脱敏：即便错误文本含 sk-* 也不泄露
    expect(report).not.toMatch(/sk-[A-Za-z0-9]+/);
  });

  it('[STEPLOG REDACT] buildDebugReport 输出不含 sk-* 字符串（拼接段脱敏）', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-leak',
          role: 'user' as const,
          content: '我的 Key 是 sk-SECRET-abc123',
          ts: 1000000000000,
        },
      ],
    })) as unknown as typeof orig;

    const report = await buildDebugReport();

    chatMod.useChatStore.getState = orig;

    // 脱敏守门：buildChatSection + buildStepLog 均已 redactKey，不应出现 sk- 原文
    expect(report).not.toMatch(/sk-[A-Za-z0-9]+/);
  });
});
