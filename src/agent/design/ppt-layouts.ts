/**
 * src/agent/design/ppt-layouts.ts — Phase 23（PVQ-04）6 套幻灯片版式库
 *
 * 纯数据 + 纯函数（零宿主 API / React / 网络 import，仅 import ppt-tokens）。
 * 每版式 = 一个生成函数 (content, colors) → LayoutResult，坐标**固化 @960×540pt**
 * （开发期 CSS 导出 + pt/px 换算 + 字体回退校准的产物；初值待真机 UAT 调）。
 *
 * provenance / 设计纪律：
 *  - 复用 ppt-tokens 的网格函数（gridFull/gridTwoColumn）与字号阶梯/边距/间距 token，
 *    而非全展开字面量坐标 → 紧凑、bundle 友好、随 canvas 参数缩放。
 *  - **绝不内置调色板数组**（配色不锁死，D-23-04）：形状色取自 accent 入参，
 *    缺省回退 DEFAULT_ACCENT.light（兜底单色）；涨跌用 SEMANTIC（独立语义）。
 *  - 正文/标题文字色默认不设（随宿主主题，通常深色可读）；仅强调元素（KPI 色块、
 *    封面大标题、时间线节点/连接线）着 accent；KPI 色块上的白字与色块同属**一个**填色
 *    形状（FIX2：避免 fill-rect + text-box 堆叠被几何自查判重叠）。
 *  - 所有 rect 按构造落在页边距内、同版式内部互不重叠（>2pt）→ ppt-layouts.test 用
 *    Phase 22 checkSlideLayout dogfood 断言 0 overlap / 0 out_of_bounds。
 *
 * ⚠️ 坐标基准 960×540pt（DEFAULT_CANVAS_PT，D-22-02 非 720×405）。
 */
import {
  FONT_LADDER_PT, MARGINS_PT, GAP_PT, DEFAULT_CANVAS_PT, DEFAULT_ACCENT, SEMANTIC,
  gridFull, gridTwoColumn, type Rect, type Canvas,
} from './ppt-tokens';

/** 一个待 adapter 落地的原生形状规格（pt @960×540）。 */
export interface ShapeSpec {
  /** 语义角色（'title'|'kpi_value'|'bullet'|...），仅 debug / 自查标注用。 */
  role: string;
  /**
   * addTextBox（'TextBox' 哨兵）或 addGeometricShape（其余几何）。
   * ⚠️ 几何值必须是合法 Office.js `PowerPoint.GeometricShapeType`（@types/office-js 枚举）——
   *   `'RoundRectangle'`（**无 "ed"**）才合法；曾写 `'RoundedRectangle'` 致真机 addGeometricShape
   *   抛 "invalid argument" → KPI 版式 ok=false（UAT-1 / 260604-fzn 修复）。守门见 ppt-layouts.test.ts。
   */
  shapeType: 'TextBox' | 'Rectangle' | 'RoundRectangle' | 'Ellipse';
  rect: Rect;
  text?: string;
  font?: { size?: number; bold?: boolean; color?: string; name?: string };
  /** 几何形状底色（AI hex，缺省兜底）。 */
  fillColor?: string;
  lineColor?: string;
  lineWeight?: number;
  align?: 'Left' | 'Center' | 'Right';
  /** 自查用：该形状底色（geometry-check 对比项 background；仅工具同时掌控 fg+bg 时给）。 */
  bgForContrast?: string;
}

export interface ImageSlot { rect: Rect; }

export interface LayoutResult {
  shapes: ShapeSpec[];
  /** 图文左右非空，其余空数组。 */
  imageSlots: ImageSlot[];
  /** 超 cap 截断说明（供工具回传 data.cap_notes）。 */
  capNotes: string[];
}

export const LAYOUT_NAMES = ['cover', 'kpi', 'two_column', 'timeline', 'image_text', 'bullet_list'] as const;
export type LayoutName = typeof LAYOUT_NAMES[number];
export const LAYOUT_LABELS: Record<LayoutName, string> = {
  cover: '封面',
  kpi: '大数字KPI',
  two_column: '两栏对比',
  timeline: '时间线',
  image_text: '图文左右',
  bullet_list: '要点列表',
};

/** 各版式商务密实 cap（初值待 UAT 调）。 */
const CAPS = { kpi: 4, twoColumnBullets: 6, timelineEvents: 5, imageTextBullets: 5, bulletList: 8 } as const;

// ---------------------------------------------------------------------------
// content 取值小工具（content 子字段不被顶层 normalize → 直接读 + 双键容错）
// ---------------------------------------------------------------------------

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim().length > 0 ? v : undefined;
}
function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
/** snake / camel 双键容错读取（content 子字段不归一化，memory project_ppt_officejs_gotchas）。 */
function pick(o: Record<string, unknown>, snake: string, camel: string): unknown {
  return o[snake] !== undefined ? o[snake] : o[camel];
}
/** 数组超 cap → slice 截断 + 记 capNote。 */
function slice<T>(items: T[], cap: number, what: string, capNotes: string[]): T[] {
  if (items.length > cap) {
    capNotes.push(`${what}超过上限 ${cap} 个（实际 ${items.length}），已截断展示前 ${cap} 个，多余内容请拆到新页。`);
    return items.slice(0, cap);
  }
  return items;
}

// ---------------------------------------------------------------------------
// 几何切分小工具（columns/rows 之间留 GAP → 横/纵向天然间隔，互不重叠）
// ---------------------------------------------------------------------------

function splitColumns(rect: Rect, n: number, gap = GAP_PT): Rect[] {
  const colW = (rect.width - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    left: rect.left + i * (colW + gap), top: rect.top, width: colW, height: rect.height,
  }));
}
function splitRows(rect: Rect, n: number, gap = GAP_PT): Rect[] {
  const rowH = (rect.height - gap * (n - 1)) / n;
  return Array.from({ length: n }, (_, i) => ({
    left: rect.left, top: rect.top + i * (rowH + gap), width: rect.width, height: rowH,
  }));
}

/** 标题带 + 内容区：有标题用 gridFull，无标题内容区铺满内边距框。 */
function titleAndContent(title: string | undefined, canvas: Canvas): { titleBand?: Rect; content: Rect } {
  if (title) {
    const g = gridFull(canvas);
    return { titleBand: g.titleBand, content: g.content };
  }
  const { x, y } = MARGINS_PT;
  return { content: { left: x, top: y, width: canvas.widthPt - 2 * x, height: canvas.heightPt - 2 * y } };
}

/** 内容页标题形状（左对齐、title 字号加粗、默认文字色）。 */
function titleShape(title: string, band: Rect): ShapeSpec {
  return { role: 'title', shapeType: 'TextBox', rect: band, text: title, align: 'Left', font: { size: FONT_LADDER_PT.title, bold: true } };
}

// ---------------------------------------------------------------------------
// 6 版式生成函数
// ---------------------------------------------------------------------------

/** 封面：大标题（accent、居中）+ 副标 + 脚注。垂直居中带 + 脚注贴底。 */
function buildCover(content: Record<string, unknown>, accent: string, canvas: Canvas): LayoutResult {
  const { x, y } = MARGINS_PT;
  const w = canvas.widthPt - 2 * x;
  const shapes: ShapeSpec[] = [];
  const title = str(content.title) ?? '标题';
  const titleTop = canvas.heightPt * 0.36;       // @540 → 194.4
  const titleH = 80;
  shapes.push({ role: 'cover_title', shapeType: 'TextBox', rect: { left: x, top: titleTop, width: w, height: titleH }, text: title, align: 'Center', font: { size: FONT_LADDER_PT.title, bold: true, color: accent } });
  const subtitle = str(content.subtitle);
  if (subtitle) {
    shapes.push({ role: 'cover_subtitle', shapeType: 'TextBox', rect: { left: x, top: titleTop + titleH + GAP_PT, width: w, height: 40 }, text: subtitle, align: 'Center', font: { size: FONT_LADDER_PT.subtitle } });
  }
  const footer = str(content.footer);
  if (footer) {
    const fH = 24;
    shapes.push({ role: 'cover_footer', shapeType: 'TextBox', rect: { left: x, top: canvas.heightPt - y - fH, width: w, height: fH }, text: footer, align: 'Center', font: { size: FONT_LADDER_PT.caption } });
  }
  return { shapes, imageSlots: [], capNotes: [] };
}

/** 大数字KPI：弹性 1–4 列；每列 = 色块大数字（白字，单形状）+ 标签 + 可选 delta。 */
function buildKpi(content: Record<string, unknown>, accent: string, canvas: Canvas): LayoutResult {
  const capNotes: string[] = [];
  const shapes: ShapeSpec[] = [];
  const title = str(content.title);
  const { titleBand, content: area } = titleAndContent(title, canvas);
  if (title && titleBand) shapes.push(titleShape(title, titleBand));

  let kpis = arr(pick(content, 'kpis', 'kpis')).map(rec);
  if (kpis.length === 0) kpis = [{}]; // 至少一列，保证版式可渲染
  kpis = slice(kpis, CAPS.kpi, 'KPI 指标', capNotes);
  const n = kpis.length;
  const cols = splitColumns(area, n);

  // 每列垂直居中放置 块/标签/delta（固定块高，组高居中）
  const blockH = 92, labelH = 28, deltaH = 22, vgap = 8;
  const groupH = blockH + vgap + labelH + vgap + deltaH;
  const top0 = area.top + Math.max(0, (area.height - groupH) / 2);
  kpis.forEach((k, i) => {
    const col = cols[i];
    const value = str(pick(k, 'value', 'value')) ?? '—';
    const label = str(pick(k, 'label', 'label')) ?? '';
    // FIX2：色块 + 白色大数字 = 单个填色形状（既持文本、其 fill 又作 bgForContrast）。
    shapes.push({
      role: 'kpi_value', shapeType: 'RoundRectangle',
      rect: { left: col.left, top: top0, width: col.width, height: blockH },
      text: value, align: 'Center', fillColor: accent, bgForContrast: accent,
      font: { size: FONT_LADDER_PT.kpi, bold: true, color: '#FFFFFF' },
    });
    if (label) {
      shapes.push({ role: 'kpi_label', shapeType: 'TextBox', rect: { left: col.left, top: top0 + blockH + vgap, width: col.width, height: labelH }, text: label, align: 'Center', font: { size: FONT_LADDER_PT.caption } });
    }
    const delta = str(pick(k, 'delta', 'delta'));
    if (delta) {
      const dir = str(pick(k, 'delta_direction', 'deltaDirection'));
      const up = dir !== 'down';
      shapes.push({ role: 'kpi_delta', shapeType: 'TextBox', rect: { left: col.left, top: top0 + blockH + vgap + labelH + vgap, width: col.width, height: deltaH }, text: `${up ? '▲' : '▼'} ${delta}`, align: 'Center', font: { size: FONT_LADDER_PT.caption, bold: true, color: up ? SEMANTIC.success : SEMANTIC.error } });
    }
  });
  return { shapes, imageSlots: [], capNotes };
}

/** 两栏对比：标题带 + 左右等宽两栏（各栏 heading + bullets 单文本框换行）。 */
function buildTwoColumn(content: Record<string, unknown>, _accent: string, canvas: Canvas): LayoutResult {
  const capNotes: string[] = [];
  const shapes: ShapeSpec[] = [];
  const g = gridTwoColumn(canvas);
  const title = str(content.title) ?? '对比';
  shapes.push(titleShape(title, g.titleBand));

  const sides: Array<[Rect, Record<string, unknown>, string]> = [
    [g.left, rec(content.left), 'left'],
    [g.right, rec(content.right), 'right'],
  ];
  for (const [col, side, tag] of sides) {
    const heading = str(pick(side, 'heading', 'heading'));
    const headingH = 30;
    if (heading) {
      shapes.push({ role: `${tag}_heading`, shapeType: 'TextBox', rect: { left: col.left, top: col.top, width: col.width, height: headingH }, text: heading, align: 'Left', font: { size: FONT_LADDER_PT.heading, bold: true } });
    }
    const bullets = slice(arr(pick(side, 'bullets', 'bullets')).map((b) => str(b) ?? '').filter(Boolean), CAPS.twoColumnBullets, `${tag === 'left' ? '左' : '右'}栏要点`, capNotes);
    if (bullets.length) {
      const bTop = heading ? col.top + headingH + GAP_PT : col.top;
      shapes.push({ role: `${tag}_bullets`, shapeType: 'TextBox', rect: { left: col.left, top: bTop, width: col.width, height: col.top + col.height - bTop }, text: bullets.map((b) => `• ${b}`).join('\n'), align: 'Left', font: { size: FONT_LADDER_PT.body } });
    }
  }
  return { shapes, imageSlots: [], capNotes };
}

/** 时间线：标题带 + 横向连接线（节点间分段，不压节点）+ 节点 + 时间(上)/标签(下)。 */
function buildTimeline(content: Record<string, unknown>, accent: string, canvas: Canvas): LayoutResult {
  const capNotes: string[] = [];
  const shapes: ShapeSpec[] = [];
  const g = gridFull(canvas);
  const title = str(content.title) ?? '时间线';
  shapes.push(titleShape(title, g.titleBand));
  const area = g.content;

  let events = arr(pick(content, 'events', 'events')).map(rec);
  if (events.length === 0) events = [{}];
  events = slice(events, CAPS.timelineEvents, '时间线节点', capNotes);
  const n = events.length;
  const cols = splitColumns(area, n);
  const yLine = area.top + area.height / 2;
  const nodeD = 14, pad = 4;
  const centers = cols.map((c) => c.left + c.width / 2);

  // 连接线分段（仅在相邻节点之间，留 pad，绝不压到节点上 → FIX2(b) 交叠 ≤2pt）
  for (let i = 0; i < n - 1; i++) {
    const segLeft = centers[i] + nodeD / 2 + pad;
    const segRight = centers[i + 1] - nodeD / 2 - pad;
    if (segRight - segLeft > 0) {
      shapes.push({ role: 'timeline_connector', shapeType: 'Rectangle', rect: { left: segLeft, top: yLine - 1, width: segRight - segLeft, height: 2 }, fillColor: accent, bgForContrast: accent });
    }
  }
  // 节点 + 时间(上) + 标签(下)
  events.forEach((e, i) => {
    const col = cols[i], cxv = centers[i];
    shapes.push({ role: 'timeline_node', shapeType: 'Ellipse', rect: { left: cxv - nodeD / 2, top: yLine - nodeD / 2, width: nodeD, height: nodeD }, fillColor: accent, bgForContrast: accent });
    const time = str(pick(e, 'time', 'time'));
    if (time) {
      const tH = 26;
      shapes.push({ role: 'timeline_time', shapeType: 'TextBox', rect: { left: col.left, top: yLine - nodeD / 2 - 8 - tH, width: col.width, height: tH }, text: time, align: 'Center', font: { size: FONT_LADDER_PT.caption, bold: true, color: accent } });
    }
    const label = str(pick(e, 'label', 'label'));
    if (label) {
      shapes.push({ role: 'timeline_label', shapeType: 'TextBox', rect: { left: col.left, top: yLine + nodeD / 2 + 8, width: col.width, height: 40 }, text: label, align: 'Center', font: { size: FONT_LADDER_PT.body } });
    }
  });
  return { shapes, imageSlots: [], capNotes };
}

/** 图文左右：标题带 + 一侧文本要点 + 另一侧图片位（返回 rect 走 autonomous-insert，不放占位形状）。 */
function buildImageText(content: Record<string, unknown>, _accent: string, canvas: Canvas): LayoutResult {
  const capNotes: string[] = [];
  const shapes: ShapeSpec[] = [];
  const g = gridTwoColumn(canvas);
  const title = str(content.title) ?? '图文';
  shapes.push(titleShape(title, g.titleBand));

  const side = str(pick(content, 'image_side', 'imageSide')) === 'left' ? 'left' : 'right';
  const imageRect = side === 'left' ? g.left : g.right;
  const textRect = side === 'left' ? g.right : g.left;

  const bullets = slice(arr(pick(content, 'bullets', 'bullets')).map((b) => str(b) ?? '').filter(Boolean), CAPS.imageTextBullets, '要点', capNotes);
  if (bullets.length) {
    shapes.push({ role: 'image_text_bullets', shapeType: 'TextBox', rect: textRect, text: bullets.map((b) => `• ${b}`).join('\n'), align: 'Left', font: { size: FONT_LADDER_PT.body } });
  }
  return { shapes, imageSlots: [{ rect: imageRect }], capNotes };
}

/** 要点列表：标题带 + 单栏密实要点（每条 heading：text，逐行排布）。 */
function buildBulletList(content: Record<string, unknown>, _accent: string, canvas: Canvas): LayoutResult {
  const capNotes: string[] = [];
  const shapes: ShapeSpec[] = [];
  const g = gridFull(canvas);
  const title = str(content.title) ?? '要点';
  shapes.push(titleShape(title, g.titleBand));

  let bullets = arr(pick(content, 'bullets', 'bullets')).map((b) => {
    if (typeof b === 'string') return { text: b };
    const o = rec(b);
    return { heading: str(pick(o, 'heading', 'heading')), text: str(pick(o, 'text', 'text')) ?? '' };
  }).filter((b) => b.text || b.heading);
  if (bullets.length === 0) bullets = [{ text: '' }];
  bullets = slice(bullets, CAPS.bulletList, '要点', capNotes);

  const rows = splitRows(g.content, bullets.length);
  bullets.forEach((b, i) => {
    const text = b.heading ? `• ${b.heading}：${b.text}` : `• ${b.text}`;
    shapes.push({ role: 'bullet', shapeType: 'TextBox', rect: rows[i], text, align: 'Left', font: { size: FONT_LADDER_PT.body } });
  });
  return { shapes, imageSlots: [], capNotes };
}

/**
 * 顶层分派：按 layout 名生成整页 ShapeSpec[]（colors.accent 缺省回退 DEFAULT_ACCENT.light）。
 */
export function buildLayout(
  layout: LayoutName,
  content: Record<string, unknown>,
  colors?: { accent?: string },
  canvas: Canvas = DEFAULT_CANVAS_PT,
): LayoutResult {
  const accent = str(colors?.accent) ?? DEFAULT_ACCENT.light;
  const c = rec(content);
  switch (layout) {
    case 'cover':       return buildCover(c, accent, canvas);
    case 'kpi':         return buildKpi(c, accent, canvas);
    case 'two_column':  return buildTwoColumn(c, accent, canvas);
    case 'timeline':    return buildTimeline(c, accent, canvas);
    case 'image_text':  return buildImageText(c, accent, canvas);
    case 'bullet_list': return buildBulletList(c, accent, canvas);
    default:            return { shapes: [], imageSlots: [], capNotes: [`未知版式 ${String(layout)}`] };
  }
}
