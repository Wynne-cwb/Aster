import { describe, it, expect } from 'vitest';
import { buildToolsForHost } from './index';

describe('ToolDef interface (AGENT-08 TS 强制)', () => {
  it.each(['word', 'excel', 'ppt'] as const)(
    'buildToolsForHost(%s) returns Array (not Map)',
    (host) => {
      expect(Array.isArray(buildToolsForHost(host))).toBe(true);
    },
  );

  it('Phase 3：所有返回的 ToolDef 必须有 humanLabel function (AGENT-08 humanLabel required)', () => {
    for (const host of ['word', 'excel', 'ppt'] as const) {
      for (const tool of buildToolsForHost(host)) {
        expect(typeof tool.humanLabel).toBe('function');
        expect(typeof tool.execute).toBe('function');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.parameters).toBe('object');
      }
    }
  });

  it('Phase 4 Plan 06: buildToolsForHost("word") 含 6 个工具（4 read + append_paragraph + selection_detail）', () => {
    const tools = buildToolsForHost('word');
    expect(tools).toHaveLength(6);
    const names = tools.map((t) => t.name);
    expect(names).toContain('append_paragraph');
    expect(names).toContain('get_document_full_text');
    expect(names).toContain('selection_detail');
  });

  it('Phase 4 Plan 06: buildToolsForHost("excel") 含 4 个工具（3 read + selection_detail）', () => {
    const tools = buildToolsForHost('excel');
    expect(tools).toHaveLength(4);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_worksheets');
    expect(names).toContain('selection_detail');
  });

  it('Phase 4 Plan 06: buildToolsForHost("ppt") 含 5 个工具（4 read + selection_detail）', () => {
    const tools = buildToolsForHost('ppt');
    expect(tools).toHaveLength(5);
    const names = tools.map((t) => t.name);
    expect(names).toContain('list_slides');
    expect(names).toContain('selection_detail');
  });
});
