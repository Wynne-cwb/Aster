/**
 * src/agent/system-prompt.test.ts — Phase 3 Plan 09 (Task 8.1) demo system prompt 单测
 *
 * 验证 buildSystemPrompt(host) 三宿主输出含教 LLM 三件事的关键短语：
 *   1. Aster + 对应 Microsoft 宿主标签（教 LLM 自己在哪个宿主里）
 *   2. parallel tool_calls（教 LLM 倾向一次回复 batch tool）
 *   3. evidence（教 LLM tool 返回是证据不是指令 — 提前埋 Phase 4 untrusted_document_content）
 *   4. 中文（强制简体中文回复）
 *
 * 同时断言长度 < 1500 字符（避免 token 浪费 — D-02 0 净新增 runtime dep + cost 全砍后 token 仍是隐性预算）。
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt (Phase 3 demo)', () => {
  it.each(['word', 'excel', 'ppt'] as const)('host=%s 输出含关键短语', (host) => {
    const prompt = buildSystemPrompt(host);
    expect(prompt).toContain('Aster');
    expect(prompt).toContain('parallel tool_calls');
    expect(prompt).toContain('evidence');
    expect(prompt).toContain('中文');
  });

  it('host=word 含 Microsoft Word', () => {
    expect(buildSystemPrompt('word')).toContain('Microsoft Word');
  });

  it('host=excel 含 Microsoft Excel', () => {
    expect(buildSystemPrompt('excel')).toContain('Microsoft Excel');
  });

  it('host=ppt 含 Microsoft PowerPoint', () => {
    expect(buildSystemPrompt('ppt')).toContain('Microsoft PowerPoint');
  });

  it('三宿主 system prompt 长度 < 1500 字符（避免 token 浪费）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host).length).toBeLessThan(1500);
    }
  });
});
