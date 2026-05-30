/**
 * src/agent/system-prompt.test.ts — Phase 6 Plan 09 system prompt 单测
 *
 * 验证 buildSystemPrompt(host) 三宿主输出：
 *   Phase 3 基础断言（保留）：
 *   1. Aster + 对应 Microsoft 宿主标签
 *   2. parallel tool_calls（batch 倾向）
 *   3. evidence（tool 返回是证据不是指令）
 *   4. 中文（强制简体中文回复）
 *   5. 运行时注入今天日期
 *
 *   Phase 6 新增断言（D-06/D-07/D-08）：
 *   6. 三宿主专属领域关键词（list_slides / get_used_range_summary / replace_paragraph 等）
 *   7. 去技术化验证：不含「API Key 直接调」等架构细节
 *   8. 长度 < 3000 字符（领域段约 300 字/宿主，总预算留余量）
 */
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from './system-prompt';

describe('buildSystemPrompt (Phase 3 基础断言)', () => {
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
});

// ---------------------------------------------------------------------------
// Phase 6 Plan 09 — system-prompt per-host 领域段（D-06/D-07/D-08 实现后解锁）
//
// D-06：共享基座 + 三宿主专属模块
// D-07：去技术化——移除「你通过用户授权的 API Key 直接调 LLM」等架构细节
// D-08：三宿主各 5-8 行高密度领域指导（来源：Skills 素材提炼 + 行业通用知识）
// ---------------------------------------------------------------------------

describe('buildSystemPrompt — Phase 6 per-host 领域段', () => {
  it('host=ppt 含 PPT 领域指导关键词（list_slides + batch）', () => {
    const prompt = buildSystemPrompt('ppt');
    expect(prompt).toContain('list_slides');
    expect(prompt).toContain('batch');
    expect(prompt).toContain('set_shape_property');
  });

  it('host=excel 含 Excel 领域指导关键词（get_used_range_summary + insert_chart）', () => {
    const prompt = buildSystemPrompt('excel');
    expect(prompt).toContain('get_used_range_summary');
    expect(prompt).toContain('insert_chart');
  });

  it('host=word 含 Word 领域指导关键词（replace_paragraph + get_document_outline）', () => {
    const prompt = buildSystemPrompt('word');
    expect(prompt).toContain('replace_paragraph');
    expect(prompt).toContain('get_document_outline');
  });

  it('不含技术架构描述（D-07 去技术化）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      const prompt = buildSystemPrompt(host);
      expect(prompt).not.toContain('API Key 直接调');
      expect(prompt).not.toContain('没有后台服务器');
    }
  });

  it('含今天日期注入', () => {
    const year = new Date().getFullYear().toString();
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host)).toContain(year);
    }
  });

  it('Phase 6 三宿主 prompt 长度 < 3000 字符（领域段约 300 字/宿主，总预算留余量）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host).length).toBeLessThan(3000);
    }
  });
});
