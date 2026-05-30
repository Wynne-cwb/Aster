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

  it('含运行时当前日期与时间（防 LLM 凭空假设年份/时间导致时间计算错）', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (const host of ['word', 'excel', 'ppt'] as const) {
      const prompt = buildSystemPrompt(host);
      expect(prompt).toContain(today); // 注入日期（断言日期部分；时间 HH:MM 易跨分钟翻动，不断言以防 flaky）
      expect(prompt).toContain('现在是');
      expect(prompt).toContain('用户本地时间');
    }
  });

  it('三宿主 system prompt 长度 < 1500 字符（避免 token 浪费）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host).length).toBeLessThan(1500);
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 6 Wave 0 — system-prompt per-host 断言桩（Wave 3 解锁）
//
// Wave 3 (06-08-PLAN) 实现 buildSystemPrompt 三宿主专属领域段后取消 describe.skip
// D-06：共享基座 + 三宿主专属模块
// D-07：去技术化——移除「你通过用户授权的 API Key 直接调 LLM」等架构细节
// ---------------------------------------------------------------------------

describe.skip('buildSystemPrompt — Phase 6 per-host 领域段（Wave 3 解锁）', () => {
  it('host=ppt 含 PPT 领域指导关键词（list_slides + batch）', () => {
    const prompt = buildSystemPrompt('ppt');
    expect(prompt).toContain('list_slides');
    expect(prompt).toContain('batch');
  });

  it('host=excel 含 Excel 领域指导关键词（get_used_range_summary）', () => {
    expect(buildSystemPrompt('excel')).toContain('get_used_range_summary');
  });

  it('host=word 含 Word 领域指导关键词（replace_paragraph）', () => {
    expect(buildSystemPrompt('word')).toContain('replace_paragraph');
  });

  it('host=ppt 不含技术架构说明「你通过用户授权的 API Key」（D-07 去技术化验证）', () => {
    const prompt = buildSystemPrompt('ppt');
    expect(prompt).not.toContain('你通过用户授权的 API Key');
  });

  it('Phase 6 三宿主 prompt 长度 < 3000 字符（领域段约 300 字/宿主，总预算留余量）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host).length).toBeLessThan(3000);
    }
  });
});
