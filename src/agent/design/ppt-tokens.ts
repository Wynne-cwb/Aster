/**
 * src/agent/design/ppt-tokens.ts — Phase 22（PVQ-01）PPT 生成成品的结构设计 token
 *
 * 调性：商务密实（咨询/财报汇报风、信息密度高），字号阶梯偏紧凑、页边距偏小。
 * ⚠️ 配色不锁死（用户 2026-06-03 推翻原「固定 teal 调色板 + 3-5 色」）：本模块**不内置调色板**；
 *    配色由 AI 按客户/内容意图自由生成 hex（freehand），DEFAULT_ACCENT 仅作无意图信号时的兜底单色。
 *    后果：几何自查「对比度」项是唯一颜色护栏（兜不可读、兜不了整体不协调，用户已知接受）。
 * ⚠️ 与 Aster 面板 UI 的 --accent CSS 变量系统**物理隔离**——这些 token 只服务「生成的幻灯片」，
 *    面板自身 UI 仍 teal 克制不变，绝不复用面板 CSS 变量。
 * ⚠️ 全部为「建议初值，待真机/UAT 调」。
 */

/** 画布/区域几何类型（单位 = points，与 Office.js Shape 几何一致）。 */
export interface Canvas { widthPt: number; heightPt: number; }
export interface Rect { left: number; top: number; width: number; height: number; }

/**
 * 默认画布 = 标准 16:9 宽屏 = 13.333in × 7.5in @ 72pt/in = 960×540pt（Office.js Shape 实际 pt 空间）。
 * ⚠️ 不是 REQUIREMENTS 写的 720×405——那是错误基准（旧 10in 残留），用它会让右半屏形状全被误判越界。
 *    真机确认见 22-CONTEXT D-22-02（攒到 v2.3 末 UAT；若某版本 Office.js 报别的基准，只改这一个常量）。
 */
export const DEFAULT_CANVAS_PT: Canvas = { widthPt: 960, heightPt: 540 };

/** 字号阶梯（pt，商务密实偏紧凑；初值待 UAT 调）。标题>副标>heading>正文>脚注 单调，kpi 最大。 */
export const FONT_LADDER_PT = {
  title: 28,
  subtitle: 18,
  heading: 16,
  body: 14,
  caption: 11,
  kpi: 40,
} as const;

/** 统一页边距 + 元素间距（pt，基于默认画布；商务密实偏小；初值待 UAT 调）。 */
export const MARGINS_PT = { x: 48, y: 36 } as const;
export const GAP_PT = 16;

/** 几何自查阈值（pt；初值待 UAT 调）。 */
export const OVERLAP_MIN_PT = 2;        // 相交边长 > 此值才报重叠
export const OVERFLOW_TOLERANCE_PT = 2; // 文本预估高度超框 > 此值才报溢出

/** 文本宽度估算乘数（保守上界 = 偏大 = 宁多报；初值待 UAT 调）。 */
export const TEXT_METRICS = {
  cjkAdvance: 1.0,    // CJK ≈ 全角方块（× fontSizePt）
  latinAdvance: 0.6,  // 拉丁/数字/空格（保守偏大；真均值更小）
  lineHeight: 1.3,    // 行高（× fontSizePt）
} as const;

/**
 * 缺省/兜底品牌单色（非调色板）——仅在 AI 无配色意图信号时回退。
 * AI 按客户意图自由生成 hex 时，此值不参与（配色不锁死）。
 * 品牌 teal（与面板 UI 同色相，但物理隔离常量）：light #009887 / dark #4FC9B8。
 */
export const DEFAULT_ACCENT = { light: '#009887', dark: '#4FC9B8' } as const;

/** 解析 #RGB / #RRGGBB（带不带 # 均可）→ {r,g,b}(0..255)；非法返回 null。 */
function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

/**
 * 把 accent 与白色按 ratio 混合，返回淡色 hex（UAT-4：KPI 卡淡色底用）。
 * ratio = accent 占比（0..1，clamp）；0.12 ≈ 很淡的 accent 调底，任何色相都显克制。
 * 输入容错 #RGB / #RRGGBB；非法输入回退纯白 `#FFFFFF`（最安全的淡底）。输出恒为 6 位 #RRGGBB。
 */
export function lightTint(hex: string, ratio = 0.12): string {
  const r = Math.min(1, Math.max(0, ratio));
  const rgb = parseHexRgb(hex);
  if (!rgb) return '#FFFFFF';
  const mix = (c: number) => Math.round(Math.min(255, Math.max(0, c * r + 255 * (1 - r))));
  const to2 = (n: number) => n.toString(16).padStart(2, '0');
  return `#${to2(mix(rgb.r))}${to2(mix(rgb.g))}${to2(mix(rgb.b))}`;
}

/** 涨跌/成败语义色（独立于配色，不挤占任何配色预算；初值）。 */
export const SEMANTIC = { success: '#0E9F6E', error: '#E02424' } as const;

/**
 * 整页单栏网格：标题带 + 单一内容区（canvas 参数化 → 任意画布正确，规避 720/960 陷阱）。
 */
export function gridFull(canvas: Canvas = DEFAULT_CANVAS_PT): { titleBand: Rect; content: Rect } {
  const { x, y } = MARGINS_PT;
  const titleH = FONT_LADDER_PT.title * TEXT_METRICS.lineHeight + GAP_PT;
  return {
    titleBand: { left: x, top: y, width: canvas.widthPt - 2 * x, height: titleH },
    content: {
      left: x, top: y + titleH,
      width: canvas.widthPt - 2 * x,
      height: canvas.heightPt - 2 * y - titleH,
    },
  };
}

/**
 * 左右两栏网格：标题带 + 左右等宽两栏（中间 GAP_PT 间隔）。
 */
export function gridTwoColumn(canvas: Canvas = DEFAULT_CANVAS_PT): { titleBand: Rect; left: Rect; right: Rect } {
  const { x, y } = MARGINS_PT;
  const titleH = FONT_LADDER_PT.title * TEXT_METRICS.lineHeight + GAP_PT;
  const contentTop = y + titleH;
  const contentH = canvas.heightPt - 2 * y - titleH;
  const colW = (canvas.widthPt - 2 * x - GAP_PT) / 2;
  return {
    titleBand: { left: x, top: y, width: canvas.widthPt - 2 * x, height: titleH },
    left: { left: x, top: contentTop, width: colW, height: contentH },
    right: { left: x + colW + GAP_PT, top: contentTop, width: colW, height: contentH },
  };
}
