import { describe, it, expect } from 'vitest';
import { FONT_LADDER_PT, MARGINS_PT, GAP_PT, DEFAULT_CANVAS_PT, DEFAULT_ACCENT, SEMANTIC, gridFull, gridTwoColumn, lightTint } from './ppt-tokens';

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
  it('DEFAULT_ACCENT = 品牌 teal（light #009887 / dark #4FC9B8）', () => {
    expect(DEFAULT_ACCENT.light.toLowerCase()).toBe('#009887');
    expect(DEFAULT_ACCENT.dark.toLowerCase()).toBe('#4fc9b8');
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

describe('lightTint 纯函数（UAT-4：KPI 卡淡色底）', () => {
  it('确定性混合：黑 + 白 各半 = 中灰 #808080', () => {
    expect(lightTint('#000000', 0.5)).toBe('#808080');
  });
  it('ratio=1 = 原色（全 accent）；ratio=0 = 纯白（全白）', () => {
    expect(lightTint('#000000', 1)).toBe('#000000');
    expect(lightTint('#000000', 0)).toBe('#ffffff');
  });
  it('ratio clamp 到 [0,1]（>1 视作 1，<0 视作 0）', () => {
    expect(lightTint('#000000', 5)).toBe('#000000');
    expect(lightTint('#000000', -3)).toBe('#ffffff');
  });
  it('容错 #RGB 三位简写（展开为 #RRGGBB）', () => {
    expect(lightTint('#abc', 1)).toBe('#aabbcc');
    expect(lightTint('#fff', 1)).toBe('#ffffff');
  });
  it('默认 ratio=0.12 → 很淡的 accent 调底：输出合法 6 位 hex，且每通道都更亮（趋白）', () => {
    const out = lightTint('#1A73E8');
    expect(out).toMatch(/^#[0-9a-f]{6}$/);
    expect(out).toBe('#e4eefc');
    // 趋白：每通道 ≥ 原色对应通道
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(out.slice(i, i + 2), 16));
    expect(r).toBeGreaterThanOrEqual(0x1a);
    expect(g).toBeGreaterThanOrEqual(0x73);
    expect(b).toBeGreaterThanOrEqual(0xe8);
  });
  it('非法 hex 输入 → 回退纯白（最安全的淡底）', () => {
    expect(lightTint('nope').toLowerCase()).toBe('#ffffff');
    expect(lightTint('#12').toLowerCase()).toBe('#ffffff');
    expect(lightTint('#12345').toLowerCase()).toBe('#ffffff');
  });
  it('teal 默认 accent 的淡底 + accent 本色大数字 ≥ WCAG 大字阈值 3:1（克制风可读）', async () => {
    const { wcagContrastRatio } = await import('./geometry-check');
    const ratio = wcagContrastRatio(DEFAULT_ACCENT.light, lightTint(DEFAULT_ACCENT.light));
    expect(ratio).not.toBeNull();
    expect(ratio as number).toBeGreaterThanOrEqual(3);
  });
});
