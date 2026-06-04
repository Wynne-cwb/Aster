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
import { buildLayout, LAYOUT_NAMES, type ShapeSpec } from './ppt-layouts';
import { checkSlideLayout, type ShapeBox } from './geometry-check';
import { DEFAULT_CANVAS_PT, DEFAULT_ACCENT } from './ppt-tokens';
import { addShapeTool } from '../tools/write/ppt';

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

// ---------------------------------------------------------------------------
// 结构守门（260604-fzn / UAT-1）：shapeType 必须是合法 Office.js PowerPoint.GeometricShapeType
//
// 背景：曾用 'RoundedRectangle'（合法是 'RoundRectangle'，**无 "ed"**）→ 真机 addGeometricShape
//   抛 "invalid argument" → KPI 版式 ok=false，AI 3× 重试各留半成品孤儿页后熔断。单测此前放绿
//   是因 mock 不校验枚举（mock-vs-real gap）。本守门把「非法 shapeType 字符串」变成编译期 / 测试期
//   失败，永不再静默真机 ok=false（memory：同一故障模式复发 → 加结构守门，不靠纪律）。
//
// VALID_PPT_GEOMETRIC_SHAPE_TYPES = @types/office-js `PowerPoint.GeometricShapeType` 全量字符串值
//   （office-js 运行时来自 CDN、@types 仅 .d.ts → 枚举无法在 vitest 运行时 import，此处按 .d.ts 硬编码）。
// ---------------------------------------------------------------------------

/** 'TextBox' = Aster 自己的哨兵（走 addTextBox，非 addGeometricShape），不属于 GeometricShapeType。 */
const TEXTBOX_SENTINEL = 'TextBox';

const VALID_PPT_GEOMETRIC_SHAPE_TYPES = new Set<string>([
  'LineInverse', 'Triangle', 'RightTriangle', 'Rectangle', 'Diamond', 'Parallelogram', 'Trapezoid',
  'NonIsoscelesTrapezoid', 'Pentagon', 'Hexagon', 'Heptagon', 'Octagon', 'Decagon', 'Dodecagon',
  'Star4', 'Star5', 'Star6', 'Star7', 'Star8', 'Star10', 'Star12', 'Star16', 'Star24', 'Star32',
  'RoundRectangle', 'Round1Rectangle', 'Round2SameRectangle', 'Round2DiagonalRectangle',
  'SnipRoundRectangle', 'Snip1Rectangle', 'Snip2SameRectangle', 'Snip2DiagonalRectangle', 'Plaque',
  'Ellipse', 'Teardrop', 'HomePlate', 'Chevron', 'PieWedge', 'Pie', 'BlockArc', 'Donut', 'NoSmoking',
  'RightArrow', 'LeftArrow', 'UpArrow', 'DownArrow', 'StripedRightArrow', 'NotchedRightArrow',
  'BentUpArrow', 'LeftRightArrow', 'UpDownArrow', 'LeftUpArrow', 'LeftRightUpArrow', 'QuadArrow',
  'LeftArrowCallout', 'RightArrowCallout', 'UpArrowCallout', 'DownArrowCallout', 'LeftRightArrowCallout',
  'UpDownArrowCallout', 'QuadArrowCallout', 'BentArrow', 'UturnArrow', 'CircularArrow', 'LeftCircularArrow',
  'LeftRightCircularArrow', 'CurvedRightArrow', 'CurvedLeftArrow', 'CurvedUpArrow', 'CurvedDownArrow',
  'SwooshArrow', 'Cube', 'Can', 'LightningBolt', 'Heart', 'Sun', 'Moon', 'SmileyFace', 'IrregularSeal1',
  'IrregularSeal2', 'FoldedCorner', 'Bevel', 'Frame', 'HalfFrame', 'Corner', 'DiagonalStripe', 'Chord',
  'Arc', 'LeftBracket', 'RightBracket', 'LeftBrace', 'RightBrace', 'BracketPair', 'BracePair',
  'Callout1', 'Callout2', 'Callout3', 'AccentCallout1', 'AccentCallout2', 'AccentCallout3',
  'BorderCallout1', 'BorderCallout2', 'BorderCallout3', 'AccentBorderCallout1', 'AccentBorderCallout2',
  'AccentBorderCallout3', 'WedgeRectCallout', 'WedgeRRectCallout', 'WedgeEllipseCallout', 'CloudCallout',
  'Cloud', 'Ribbon', 'Ribbon2', 'EllipseRibbon', 'EllipseRibbon2', 'LeftRightRibbon', 'VerticalScroll',
  'HorizontalScroll', 'Wave', 'DoubleWave', 'Plus', 'FlowChartProcess', 'FlowChartDecision',
  'FlowChartInputOutput', 'FlowChartPredefinedProcess', 'FlowChartInternalStorage', 'FlowChartDocument',
  'FlowChartMultidocument', 'FlowChartTerminator', 'FlowChartPreparation', 'FlowChartManualInput',
  'FlowChartManualOperation', 'FlowChartConnector', 'FlowChartPunchedCard', 'FlowChartPunchedTape',
  'FlowChartSummingJunction', 'FlowChartOr', 'FlowChartCollate', 'FlowChartSort', 'FlowChartExtract',
  'FlowChartMerge', 'FlowChartOfflineStorage', 'FlowChartOnlineStorage', 'FlowChartMagneticTape',
  'FlowChartMagneticDisk', 'FlowChartMagneticDrum', 'FlowChartDisplay', 'FlowChartDelay',
  'FlowChartAlternateProcess', 'FlowChartOffpageConnector', 'ActionButtonBlank', 'ActionButtonHome',
  'ActionButtonHelp', 'ActionButtonInformation', 'ActionButtonForwardNext', 'ActionButtonBackPrevious',
  'ActionButtonEnd', 'ActionButtonBeginning', 'ActionButtonReturn', 'ActionButtonDocument',
  'ActionButtonSound', 'ActionButtonMovie', 'Gear6', 'Gear9', 'Funnel', 'MathPlus', 'MathMinus',
  'MathMultiply', 'MathDivide', 'MathEqual', 'MathNotEqual', 'CornerTabs', 'SquareTabs', 'PlaqueTabs',
  'ChartX', 'ChartStar', 'ChartPlus',
]);

/**
 * 编译期穷举守门：若 `ShapeSpec['shapeType']` 联合新增/改名几何成员（如误写回 'RoundedRectangle'），
 * 这个 `satisfies Record<Exclude<…,'TextBox'>, true>` 会让 tsc 失败（缺键/多键），逼迫同步本表 →
 * 配合下方运行时断言 (a)，非法值在编译期 + 测试期双重拦截。
 */
const SHAPESPEC_GEOMETRIC_MEMBERS = {
  Rectangle: true,
  RoundRectangle: true,
  Ellipse: true,
} satisfies Record<Exclude<ShapeSpec['shapeType'], typeof TEXTBOX_SENTINEL>, true>;

describe('结构守门：shapeType ⊆ 合法 PowerPoint.GeometricShapeType（260604-fzn / UAT-1）', () => {
  it('(a) ShapeSpec shapeType 联合的每个非-TextBox 成员都是合法 GeometricShapeType', () => {
    const invalid = Object.keys(SHAPESPEC_GEOMETRIC_MEMBERS).filter((t) => !VALID_PPT_GEOMETRIC_SHAPE_TYPES.has(t));
    expect(invalid).toEqual([]);
  });

  it('(b) 6 套版式 buildLayout 产出的每个非-TextBox shapeType 都是合法 GeometricShapeType', () => {
    const seen = new Set<string>();
    for (const name of LAYOUT_NAMES) {
      for (const s of buildLayout(name, SAMPLE[name], { accent: '#1A73E8' }).shapes) {
        if (s.shapeType !== TEXTBOX_SENTINEL) seen.add(s.shapeType);
      }
    }
    // 确认确实跑到了几何分支（KPI 圆角色块 + 时间线矩形/椭圆），否则守门是空转
    expect(seen.has('RoundRectangle')).toBe(true); // KPI kpi_value（曾是 bug 源头）
    expect(seen.has('Rectangle')).toBe(true);      // timeline_connector
    expect(seen.has('Ellipse')).toBe(true);        // timeline_node
    expect([...seen].filter((t) => !VALID_PPT_GEOMETRIC_SHAPE_TYPES.has(t))).toEqual([]);
  });

  it('(c) add_shape 工具 schema enum 的每个非-TextBox 值都是合法 GeometricShapeType', () => {
    const addShapeEnum = (
      addShapeTool.parameters as { properties: { shape_type: { enum: string[] } } }
    ).properties.shape_type.enum;
    const geo = addShapeEnum.filter((t) => t !== TEXTBOX_SENTINEL);
    expect(geo.length).toBeGreaterThan(0);
    expect(geo.filter((t) => !VALID_PPT_GEOMETRIC_SHAPE_TYPES.has(t))).toEqual([]);
  });
});
