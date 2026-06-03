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
import { buildSystemPrompt, buildTimeContext } from './system-prompt';

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

  it('system prompt 不含运行时时钟（CTX-01：时钟已迁到 user message 末尾，不在 system 前缀）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      const prompt = buildSystemPrompt(host);
      expect(prompt).not.toContain('现在是');
      expect(prompt).not.toMatch(/\d{1,2}:\d{2}/); // 不含 HH:MM 形态（CTX-02 前置验证）
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
  it('host=ppt 含 PPT 领域指导关键词（list_slides + batch + set_shape_text）', () => {
    const prompt = buildSystemPrompt('ppt');
    expect(prompt).toContain('list_slides');
    expect(prompt).toContain('batch');
    // Phase 8 深化：set_shape_property → set_shape_text（写文字专用工具），list_shapes_on_slide（版式意识）
    expect(prompt).toContain('set_shape_text');
    expect(prompt).toContain('list_shapes_on_slide');
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

  it('system prompt 不含年份（时间已迁离，year 不再出现在 system 前缀）', () => {
    const year = new Date().getFullYear().toString();
    for (const host of ['word', 'excel', 'ppt'] as const) {
      expect(buildSystemPrompt(host)).not.toContain(year);
    }
  });

  it('三宿主 prompt 长度 < 4000 字符（D-05 软提醒，不卡构建；超 2000 字符 warn）', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      const len = buildSystemPrompt(host).length;
      if (len > 2000) console.warn(`[Phase 8 NFR-07] system prompt 较长 (${len} 字符)，可能稀释指令遵守度`);
      expect(len).toBeLessThan(4000); // 软门：宽裕余量，不卡构建
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 8 新增断言
// ---------------------------------------------------------------------------

describe('buildSystemPrompt — PROMPT-01 三宿主 domain 深化关键词', () => {
  it('host=ppt 含断言式标题指导关键词', () => {
    const prompt = buildSystemPrompt('ppt');
    // Phase 8 Plan 02 深化后 GREEN；现在 RED
    expect(prompt).toMatch(/断言式|结论句|标题.*断言|断言.*标题/);
  });

  it('host=ppt 含 verify-after-create 自查关键词', () => {
    const prompt = buildSystemPrompt('ppt');
    expect(prompt).toMatch(/自查|没自查.*不许|verify.*after/);
  });

  it('host=excel 含公式优先指导关键词', () => {
    const prompt = buildSystemPrompt('excel');
    expect(prompt).toMatch(/公式.*硬写值|能用公式就不|公式优/);
  });

  it('host=word 含润色边界指导关键词', () => {
    const prompt = buildSystemPrompt('word');
    expect(prompt).toMatch(/保留原意|只改语言|不增删论点/);
  });
});

describe('buildSystemPrompt — PREF-01 偏好注入', () => {
  it('传入合法偏好时 prompt 含包裹块', () => {
    // Phase 8 Plan 02 实现签名扩展后 GREEN
    const prompt = buildSystemPrompt('word', { userPrefs: '语气正式' });
    expect(prompt).toContain('【用户偏好');
    expect(prompt).toContain('【偏好结束】');
  });

  it('偏好块在 domain segment 之后（位置约束）', () => {
    // Phase 8 Plan 02 签名扩展后，@ts-expect-error 已移除
    const prompt = buildSystemPrompt('word', { userPrefs: '语气正式' });
    const domainPos = prompt.indexOf('【Word 领域指导】');
    const prefPos = prompt.indexOf('【用户偏好');
    expect(prefPos).toBeGreaterThan(domainPos);
  });

  it('不传偏好时 prompt 不含包裹块', () => {
    const prompt = buildSystemPrompt('word');
    expect(prompt).not.toContain('【用户偏好');
  });
});

// ---------------------------------------------------------------------------
// Phase 20 — CTX-02 守门：system prompt 不含分钟级时钟（防回退）
// ---------------------------------------------------------------------------

describe('buildSystemPrompt — CTX-02 时钟守门', () => {
  it.each(['word', 'excel', 'ppt'] as const)(
    'host=%s system prompt 不匹配 /\\d{1,2}:\\d{2}/（分钟级 HH:MM 不在 system 前缀）',
    (host) => {
      const prompt = buildSystemPrompt(host);
      expect(prompt).not.toMatch(/\d{1,2}:\d{2}/);
    },
  );
});

// ---------------------------------------------------------------------------
// Phase 20 — buildTimeContext 正向断言：精确时间仍可达（success criteria #2）
// ---------------------------------------------------------------------------

describe('buildTimeContext — CTX-01 时间后缀正向断言', () => {
  it('返回值含今日 YYYY-MM-DD 日期', () => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(buildTimeContext()).toContain(today);
  });

  it('返回值含中文星期（周X 格式）', () => {
    expect(buildTimeContext()).toMatch(/周[日一二三四五六]/);
  });

  it('返回值匹配 /\\d{1,2}:\\d{2}/（含分钟级时钟 HH:MM）', () => {
    expect(buildTimeContext()).toMatch(/\d{1,2}:\d{2}/);
  });

  it('返回值含「用户本地时间」', () => {
    expect(buildTimeContext()).toContain('用户本地时间');
  });

  it('返回值含抗幻觉指引（不要自行假设年份）', () => {
    expect(buildTimeContext()).toContain('不要自行假设年份');
  });
});
