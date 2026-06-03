import { describe, it, expect } from 'vitest';
import { FONT_LADDER_PT, MARGINS_PT, GAP_PT, DEFAULT_CANVAS_PT, DEFAULT_ACCENT, SEMANTIC, gridFull, gridTwoColumn } from './ppt-tokens';

describe('ppt-tokens 结构 token（PVQ-01）', () => {
  it('默认画布 = 960×540pt（非 720×405，D-22-02）', () => {
    expect(DEFAULT_CANVAS_PT).toEqual({ widthPt: 960, heightPt: 540 });
  });
  it('字号阶梯单调递减：title>subtitle>heading>body>caption，kpi 最大', () => {
    const { title, subtitle, heading, body, caption, kpi } = FONT_LADDER_PT;
    expect(title).toBeGreaterThan(subtitle);
    expect(subtitle).toBeGreaterThan(heading);
    expect(heading).toBeGreaterThan(body);
    expect(body).toBeGreaterThan(caption);
    expect(kpi).toBeGreaterThanOrEqual(title);
  });
  it('页边距/间距存在且为正', () => {
    expect(MARGINS_PT.x).toBeGreaterThan(0);
    expect(MARGINS_PT.y).toBeGreaterThan(0);
    expect(GAP_PT).toBeGreaterThan(0);
  });
  it('兜底单色 + 涨跌语义色存在（配色不锁死：仅兜底，非调色板）', () => {
    expect(DEFAULT_ACCENT.light).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(DEFAULT_ACCENT.dark).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(SEMANTIC.success).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(SEMANTIC.error).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
  it('无固定调色板：模块未导出任何颜色数组（配色不锁死，D-22-01）', async () => {
    const mod = await import('./ppt-tokens');
    const arrayColorExports = Object.entries(mod).filter(
      ([, v]) => Array.isArray(v) && (v as unknown[]).every((x) => typeof x === 'string' && /^#[0-9a-fA-F]{3,6}$/.test(x)),
    );
    expect(arrayColorExports).toHaveLength(0);
  });
  it('无 palette/colors 命名导出（refinement #5：防 palette 以对象/嵌套形式回归）', async () => {
    const mod = await import('./ppt-tokens');
    const paletteNamedExports = Object.keys(mod).filter((k) => /palette|colou?rs/i.test(k));
    expect(paletteNamedExports).toEqual([]);
  });
  it('gridFull / gridTwoColumn 区域全在画布内、随 canvas 缩放', () => {
    for (const canvas of [DEFAULT_CANVAS_PT, { widthPt: 720, heightPt: 405 }]) {
      const f = gridFull(canvas);
      expect(f.content.left).toBeGreaterThanOrEqual(MARGINS_PT.x);
      expect(f.content.left + f.content.width).toBeLessThanOrEqual(canvas.widthPt - MARGINS_PT.x + 0.01);
      const t = gridTwoColumn(canvas);
      expect(t.left.width).toBeCloseTo(t.right.width); // 两栏等宽
      expect(t.right.left + t.right.width).toBeLessThanOrEqual(canvas.widthPt - MARGINS_PT.x + 0.01);
    }
  });
});
