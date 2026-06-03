/**
 * src/agent/design/geometry-check.ts — Phase 22（PVQ-02）确定性版面几何自查
 *
 * 纯函数、确定性、零网络零依赖（仅依赖 ppt-tokens 常量）。输出违规清单作 advisory evidence
 * 喂回 LLM 自主重排——**绝不阻断写操作、绝不自动改文档**（D-22-03）。
 * canvas 作显式参数（默认 DEFAULT_CANVAS_PT=960×540，绝不内部硬编旧的 4:3 残留基准，D-22-02）。
 */
import {
  DEFAULT_CANVAS_PT, MARGINS_PT, OVERLAP_MIN_PT, OVERFLOW_TOLERANCE_PT, TEXT_METRICS,
  type Canvas,
} from './ppt-tokens';

/** list_shapes_on_slide 返回的形状几何（单位 = points）。 */
export interface ShapeBox { id: string; type?: string; left: number; top: number; width: number; height: number; }

/** AI 供入的文本/配色注解（按 shapeId 关联到 ShapeBox；溢出① 与对比④ 需要）。 */
export interface TextBoxAnnotation {
  shapeId: string;
  text?: string;          // ① 溢出需要（list_shapes 不 load 文本，由 AI 供入）
  fontSizePt?: number;    // ①④ 需要
  bold?: boolean;         // ④ 大字阈值判定
  foreground?: string;    // ④ 文字色 hex
  background?: string;    // ④ 背景色 hex（缺失/非法 → 诚实降级 undetermined）
}

export type ViolationKind = 'overflow' | 'overlap' | 'out_of_bounds' | 'low_contrast' | 'contrast_undetermined';
export interface Violation {
  kind: ViolationKind;
  shapeIds: string[];     // 涉及的形状
  detail: string;         // 量化中文描述（如「文本预估高度 142pt 超框 38pt」「对比 2.1:1 < 4.5:1」）
}
export interface LayoutReport {
  canvas: Canvas;
  violations: Violation[];
  notes: string[];        // 诚实降级/未检查说明（如「未提供配色信息，未做对比检查」）
}

// ---------------------------------------------------------------------------
// WCAG 对比度（D-22-05）
// ---------------------------------------------------------------------------

/** 解析 #RGB / #RRGGBB → [r,g,b] (0..255)；非法返回 null。 */
function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** 相对亮度（WCAG 2.x）。 */
function relativeLuminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG 对比比值（1..21）；任一色非法返回 null（→ 调用方诚实降级）。 */
export function wcagContrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg), b = parseHex(bg);
  if (!a || !b) return null;
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG 大字定义：≥18pt，或 ≥14pt 且加粗。 */
function isLargeText(fontSizePt: number, bold: boolean): boolean {
  return fontSizePt >= 18 || (fontSizePt >= 14 && bold);
}

// ---------------------------------------------------------------------------
// 文本溢出保守上界（D-22-06）
// ---------------------------------------------------------------------------

/** 单个字符是否按全角（CJK 表意/假名/CJK 标点/全角形）计宽。 */
function isCjkChar(ch: string): boolean {
  return /[　-〿぀-ヿ一-鿿＀-￯]/.test(ch);
}

/**
 * 保守估算文本在给定框宽下需要的高度（pt）。over-estimate = 安全方向（宁多报）。
 *
 * 显式换行（refinement #2）：先按 `\n` 切段，每段独立按框宽折行、至少占 1 行，再累加行数。
 * 这样多段落文本不会被「整段当一行流式折行」低估高度（低估 → 漏报溢出）。
 */
export function estimateTextBox(text: string, fontSizePt: number, boxWidthPt: number): { neededHeightPt: number; maxCharWidthPt: number } {
  const { cjkAdvance, latinAdvance, lineHeight } = TEXT_METRICS;
  const usableW = Math.max(1, boxWidthPt);
  let maxCharWidthPt = 0;
  let totalLines = 0;
  for (const segment of text.split('\n')) {
    let segAdvance = 0;
    for (const ch of segment) {
      const w = fontSizePt * (isCjkChar(ch) ? cjkAdvance : latinAdvance);
      segAdvance += w;
      if (w > maxCharWidthPt) maxCharWidthPt = w;
    }
    totalLines += Math.max(1, Math.ceil(segAdvance / usableW)); // 每个换行段至少 1 行
  }
  totalLines = Math.max(1, totalLines);
  return { neededHeightPt: totalLines * fontSizePt * lineHeight, maxCharWidthPt };
}

// ---------------------------------------------------------------------------
// 四项检查（每项纯函数；canvas/阈值参数化）
// ---------------------------------------------------------------------------

export function checkOverflow(shapes: ShapeBox[], annotations: TextBoxAnnotation[]): Violation[] {
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const out: Violation[] = [];
  for (const a of annotations) {
    if (!a.text || !a.fontSizePt) continue;        // 无文本/字号 → 不臆测
    const box = byId.get(a.shapeId); if (!box) continue;
    const { neededHeightPt, maxCharWidthPt } = estimateTextBox(a.text, a.fontSizePt, box.width);
    if (neededHeightPt > box.height + OVERFLOW_TOLERANCE_PT) {
      out.push({ kind: 'overflow', shapeIds: [a.shapeId], detail: `文本预估高度 ${Math.round(neededHeightPt)}pt 超出文本框高 ${Math.round(box.height)}pt（保守上界）` });
    } else if (maxCharWidthPt > box.width + OVERFLOW_TOLERANCE_PT) {
      out.push({ kind: 'overflow', shapeIds: [a.shapeId], detail: `单字宽 ${Math.round(maxCharWidthPt)}pt 超出文本框宽 ${Math.round(box.width)}pt` });
    }
  }
  return out;
}

export function checkOverlap(shapes: ShapeBox[]): Violation[] {
  const out: Violation[] = [];
  for (let i = 0; i < shapes.length; i++) for (let j = i + 1; j < shapes.length; j++) {
    const a = shapes[i], b = shapes[j];
    const ix = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
    const iy = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
    if (ix > OVERLAP_MIN_PT && iy > OVERLAP_MIN_PT) {
      out.push({ kind: 'overlap', shapeIds: [a.id, b.id], detail: `形状 ${a.id} 与 ${b.id} 重叠（相交 ${Math.round(ix)}×${Math.round(iy)}pt）` });
    }
  }
  return out;
}

export function checkOutOfBounds(shapes: ShapeBox[], canvas: Canvas): Violation[] {
  const out: Violation[] = [];
  const { x: mx, y: my } = MARGINS_PT;
  for (const s of shapes) {
    const reasons: string[] = [];
    if (s.left < mx - OVERFLOW_TOLERANCE_PT) reasons.push(`左缘 ${Math.round(s.left)}pt < 页边距 ${mx}pt`);
    if (s.top < my - OVERFLOW_TOLERANCE_PT) reasons.push(`上缘 ${Math.round(s.top)}pt < 页边距 ${my}pt`);
    if (s.left + s.width > canvas.widthPt - mx + OVERFLOW_TOLERANCE_PT) reasons.push(`右缘 ${Math.round(s.left + s.width)}pt 超出画布右边距（${canvas.widthPt - mx}pt）`);
    if (s.top + s.height > canvas.heightPt - my + OVERFLOW_TOLERANCE_PT) reasons.push(`下缘 ${Math.round(s.top + s.height)}pt 超出画布下边距（${canvas.heightPt - my}pt）`);
    if (reasons.length) out.push({ kind: 'out_of_bounds', shapeIds: [s.id], detail: `形状 ${s.id} 越界：${reasons.join('；')}` });
  }
  return out;
}

/** 对比④：按 AI 供入色对算 WCAG；bg 缺失/非法 → undetermined（诚实降级，非违规）。 */
export function checkContrast(annotations: TextBoxAnnotation[]): { violations: Violation[]; notes: string[] } {
  const violations: Violation[] = []; const notes: string[] = [];
  for (const a of annotations) {
    if (!a.foreground && !a.background) continue;      // 该形状无配色注解 → 跳过
    if (!a.background) { violations.push({ kind: 'contrast_undetermined', shapeIds: [a.shapeId], detail: `形状 ${a.shapeId} 背景色未知（PPT web 背景读不稳），无法判定对比——请人工确认或提供背景色` }); continue; }
    const ratio = wcagContrastRatio(a.foreground ?? '', a.background);
    if (ratio === null) { violations.push({ kind: 'contrast_undetermined', shapeIds: [a.shapeId], detail: `形状 ${a.shapeId} 颜色解析失败（非法 hex），无法判定对比` }); continue; }
    const large = isLargeText(a.fontSizePt ?? 14, a.bold ?? false);
    const threshold = large ? 3 : 4.5;
    if (ratio < threshold) violations.push({ kind: 'low_contrast', shapeIds: [a.shapeId], detail: `形状 ${a.shapeId} 对比 ${ratio.toFixed(2)}:1 < ${threshold}:1（${large ? '大字' : '正文'}）` });
  }
  return { violations, notes };
}

// ---------------------------------------------------------------------------
// 顶层聚合 + 格式化
// ---------------------------------------------------------------------------

export function checkSlideLayout(
  shapes: ShapeBox[],
  opts?: { canvas?: Canvas; annotations?: TextBoxAnnotation[] },
): LayoutReport {
  const canvas = opts?.canvas ?? DEFAULT_CANVAS_PT;
  const annotations = opts?.annotations ?? [];
  const notes: string[] = [];
  const violations: Violation[] = [
    ...checkOverlap(shapes),
    ...checkOutOfBounds(shapes, canvas),
    ...checkOverflow(shapes, annotations),
  ];
  if (annotations.length === 0) notes.push('未提供文本/配色信息（textBoxes），仅检查了重叠与越界；溢出与对比未检查。');
  const contrast = checkContrast(annotations);
  violations.push(...contrast.violations);
  notes.push(...contrast.notes);
  return { canvas, violations, notes };
}

/** 把 LayoutReport 格式化为给 LLM 的中文 evidence 文字（含锚点）。 */
export function formatViolations(report: LayoutReport): string {
  const head = `【版面自查（确定性，画布 ${report.canvas.widthPt}×${report.canvas.heightPt}pt）】`;
  if (report.violations.length === 0) {
    return `${head}\n未发现溢出/重叠/越界/对比问题。${report.notes.length ? '\n说明：' + report.notes.join(' ') : ''}`;
  }
  const lines = report.violations.map((v, i) => `${i + 1}. [${v.kind}] ${v.detail}`);
  return `${head}\n发现 ${report.violations.length} 项待修正（建议据此调整后重新自查；这是建议非强制）：\n${lines.join('\n')}${report.notes.length ? '\n说明：' + report.notes.join(' ') : ''}`;
}
