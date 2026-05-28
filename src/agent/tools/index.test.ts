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

  it('Phase 3 Plan 04: buildToolsForHost("word") 含且仅含 append_paragraph', () => {
    const tools = buildToolsForHost('word');
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('append_paragraph');
  });

  it('Phase 3 Plan 04: buildToolsForHost("excel") / ("ppt") 返回空数组（Phase 4/6 才填）', () => {
    expect(buildToolsForHost('excel')).toEqual([]);
    expect(buildToolsForHost('ppt')).toEqual([]);
  });
});
