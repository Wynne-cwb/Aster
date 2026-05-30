/**
 * src/lib/copyStepLog.test.ts — Phase 5 Plan 09 脱敏守门 + 三角色 dump 测试
 *
 * 威胁守门 T-05-09-01（脱敏 D-21）：
 * 脱敏测试断言 `not.toMatch(/sk-[A-Za-z0-9]+/)` 确保 buildStepLog 输出不泄露 API Key。
 *
 * 测试覆盖：
 * 1. 三角色 user/assistant/tool 都出现在输出
 * 2. tool role 含 toolName + 描述 + 结果
 * 3. 输出不含 sk-* 前缀字符串（脱敏 D-21，T-05-09-01 守门）
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock useChatStore
// ---------------------------------------------------------------------------

vi.mock('../store/chat', () => ({
  useChatStore: {
    getState: () => ({
      messages: [
        {
          id: 'msg-1',
          role: 'user',
          content: '帮我整理第一页',
          ts: 1000000000000,
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: '好的，我来帮您整理。',
          ts: 1000000001000,
        },
        {
          id: 'msg-3',
          role: 'tool',
          content: '追加段落',
          toolName: 'append_paragraph',
          toolResult: { ok: true, data: { written: 5 } },
          ts: 1000000002000,
        },
      ],
    }),
  },
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

import { buildStepLog } from './copyStepLog';

describe('buildStepLog — 三角色 Markdown dump', () => {
  beforeEach(() => {
    // 模拟用户不小心把 API Key 粘进了聊天框——脱敏守门测试用
  });

  it('三角色 user/assistant/tool 都出现在输出', async () => {
    const output = await buildStepLog();
    expect(output).toContain('用户');
    expect(output).toContain('Aster');
    expect(output).toContain('工具调用');
  });

  it('user 消息内容出现在输出', async () => {
    const output = await buildStepLog();
    expect(output).toContain('帮我整理第一页');
  });

  it('assistant 消息内容出现在输出', async () => {
    const output = await buildStepLog();
    expect(output).toContain('好的，我来帮您整理');
  });

  it('tool role 含 toolName + 描述', async () => {
    const output = await buildStepLog();
    expect(output).toContain('append_paragraph');
    expect(output).toContain('追加段落');
  });

  it('tool role 含成功/失败结果', async () => {
    const output = await buildStepLog();
    expect(output).toContain('成功');
  });

  it('输出含报告标题', async () => {
    const output = await buildStepLog();
    expect(output).toContain('Aster 操作记录');
  });
});

describe('buildStepLog — 脱敏 D-21 守门（T-05-09-01）', () => {
  it('[KEY GATE] 含 sk- Key 的 user 消息，输出不含 sk-* 字符串', async () => {
    // 覆盖 mock：user 消息包含 API Key 片段（模拟用户不小心粘贴了 key）
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-leak',
          role: 'user',
          content: '我的 Key 是 sk-SECRET-abc123',
          ts: 1000000000000,
        },
      ],
    })) as unknown as typeof orig;

    const output = await buildStepLog();

    // 恢复原始 mock
    chatMod.useChatStore.getState = orig;

    // 脱敏守门（T-05-09-01）
    expect(output).not.toMatch(/sk-[A-Za-z0-9]+/);
  });

  it('[KEY GATE] assistant 消息中的 sk-* 也要脱敏', async () => {
    const chatMod = await import('../store/chat');
    const orig = chatMod.useChatStore.getState;
    chatMod.useChatStore.getState = vi.fn(() => ({
      messages: [
        {
          id: 'msg-2',
          role: 'assistant',
          content: '您配置的 key 是 sk-ABCDEF1234567890',
          ts: 1000000001000,
        },
      ],
    })) as unknown as typeof orig;

    const output = await buildStepLog();

    chatMod.useChatStore.getState = orig;

    expect(output).not.toMatch(/sk-[A-Za-z0-9]+/);
    expect(output).toContain('[API KEY REDACTED]');
  });
});
