/**
 * src/agent/design/ppt-layouts.test.ts — Phase 23（PVQ-04）版式库守门
 *
 * dogfood：每版式产出的 ShapeSpec[] 喂回 Phase 22 checkSlideLayout，断言 0 overlap / 0 out_of_bounds
 *（版式自身按构造干净；溢出/对比由运行时 AI 文本/颜色触发，不在此几何 dogfood 范围）。
 * 另守：KPI 弹性 1–4 + cap 截断；配色参数化（accent 生效 / 缺省回退 DEFAULT_ACCENT）；
 * image_text 返 1 个图片位；无颜色 string[] 导出（配色不锁死结构守门）。
 */
import { describe, it, expect } from 'vitest';
import * as layouts from './ppt-layouts';
import { buildLayout, LAYOUT_NAMES } from './ppt-layouts';
import { checkSlideLayout, type ShapeBox } from './geometry-check';
import { DEFAULT_CANVAS_PT, DEFAULT_ACCENT } from './ppt-tokens';

const SAMPLE: Record<string, Record<string, unknown>> = {
  cover: { title: '华东 Q3 超目标 15%', subtitle: '区域复盘与 Q4 展望', footer: '2026 财年 · 内部资料' },
  kpi: {
    title: '关键指标', kpis: [
      { value: '120%', label: '达成率', delta: '8pct', delta_direction: 'up' },
      { value: '¥3.2亿', label: '营收', delta: '12%', delta_direction: 'up' },
      { value: '23%', label: '毛利率', delta: '2pct', delta_direction: 'down' },
      { value: '4.6', label: 'NPS' },
    ],
  },
  two_column: {
    title: '优势 vs 风险',
    left: { heading: '优势', bullets: ['大客户续签', '渠道下沉', '成本可控'] },
    right: { heading: '风险', bullets: ['汇率波动', '竞品降价'] },
  },
  timeline: {
    title: '上市路线图',
    events: [{ time: 'Q1', label: '立项' }, { time: 'Q2', label: '研发' }, { time: 'Q3', label: '内测' }, { time: 'Q4', label: '上市' }],
  },
  image_text: { title: '产品定位', bullets: ['面向中文职场', 'BYO Key', '无后台直连'], image_side: 'right' },
  bullet_list: {
    title: '三点结论',
    bullets: [
      { heading: '增长', text: '续签驱动 15% 超额' },
      { heading: '效率', text: '人效提升 22%' },
      { heading: '风险', text: '关注汇率敞口' },
    ],
  },
};

function geomViolations(name: layouts.LayoutName, content: Record<string, unknown>, accent?: string) {
  const r = buildLayout(name, content, accent ? { accent } : undefined);
  const boxes: ShapeBox[] = r.shapes.map((s, i) => ({ id: `s${i}`, type: s.shapeType, ...s.rect }));
  const report = checkSlideLayout(boxes, { canvas: DEFAULT_CANVAS_PT });
  return report.violations.filter((v) => v.kind === 'overlap' || v.kind === 'out_of_bounds');
}

describe('ppt-layouts dogfood — Phase 22 几何自查（PVQ-04）', () => {
  it.each(LAYOUT_NAMES)('%s 版式：0 overlap / 0 out_of_bounds（按构造干净）', (name) => {
    const bad = geomViolations(name, SAMPLE[name], '#1A73E8');
    if (bad.length) console.error(name, JSON.stringify(bad, null, 2));
    expect(bad).toHaveLength(0);
  });
});

describe('KPI 弹性 1–4 + cap 截断（D-23-06）', () => {
  it.each([1, 2, 3, 4])('传 %i 个 KPI → 产出对应数量的色块 + 0 几何违规', (n) => {
    const kpis = Array.from({ length: n }, (_, i) => ({ value: `${i + 1}0%`, label: `指标${i + 1}` }));
    const r = buildLayout('kpi', { title: 'K', kpis });
    expect(r.shapes.filter((s) => s.role === 'kpi_value')).toHaveLength(n);
    const boxes: ShapeBox[] = r.shapes.map((s, i) => ({ id: `s${i}`, ...s.rect }));
    const bad = checkSlideLayout(boxes, { canvas: DEFAULT_CANVAS_PT }).violations.filter((v) => v.kind === 'overlap' || v.kind === 'out_of_bounds');
    expect(bad).toHaveLength(0);
  });

  it('传 5 个 KPI → slice 到 4 + capNotes 非空', () => {
    const kpis = Array.from({ length: 5 }, (_, i) => ({ value: `${i}`, label: `L${i}` }));
    const r = buildLayout('kpi', { kpis });
    expect(r.shapes.filter((s) => s.role === 'kpi_value')).toHaveLength(4);
    expect(r.capNotes.length).toBeGreaterThan(0);
  });
});

describe('配色参数化（D-23-04，配色不锁死）', () => {
  it('传 accent_color → 强调色块 fillColor 用该值', () => {
    const r = buildLayout('kpi', { kpis: [{ value: '1', label: 'a' }] }, { accent: '#1A73E8' });
    expect(r.shapes.find((s) => s.role === 'kpi_value')?.fillColor).toBe('#1A73E8');
  });
  it('不传 accent → 回退 DEFAULT_ACCENT.light（兜底单色）', () => {
    const r = buildLayout('kpi', { kpis: [{ value: '1', label: 'a' }] });
    expect(r.shapes.find((s) => s.role === 'kpi_value')?.fillColor).toBe(DEFAULT_ACCENT.light);
  });
  it('涨/跌 delta 用 SEMANTIC 语义色（不挤占强调色）', () => {
    const r = buildLayout('kpi', { kpis: [{ value: '1', label: 'a', delta: '5%', delta_direction: 'down' }] });
    const delta = r.shapes.find((s) => s.role === 'kpi_delta');
    expect(delta?.font?.color).toBe('#E02424'); // SEMANTIC.error
    expect(delta?.text).toContain('▼');
  });
});

describe('图片位 + 无 palette 结构守门', () => {
  it('image_text → imageSlots 长度 1（rect 在画布内）', () => {
    const r = buildLayout('image_text', SAMPLE.image_text);
    expect(r.imageSlots).toHaveLength(1);
    const s = r.imageSlots[0].rect;
    expect(s.left).toBeGreaterThanOrEqual(0);
    expect(s.left + s.width).toBeLessThanOrEqual(DEFAULT_CANVAS_PT.widthPt);
  });
  it('其余版式 imageSlots 为空', () => {
    for (const name of LAYOUT_NAMES) {
      if (name === 'image_text') continue;
      expect(buildLayout(name, SAMPLE[name]).imageSlots).toHaveLength(0);
    }
  });
  it('无颜色 string[] 导出（配色不锁死，无内置调色板）', () => {
    const hex = /^#[0-9a-fA-F]{3,8}$/;
    for (const v of Object.values(layouts)) {
      if (Array.isArray(v)) {
        expect(v.some((x) => typeof x === 'string' && hex.test(x))).toBe(false);
      }
    }
  });
});
