import { describe, it, expect } from 'vitest';
import { wcagContrastRatio, estimateTextBox, checkSlideLayout, checkAlignment, formatViolations, type ShapeBox } from './geometry-check';

const box = (id: string, left: number, top: number, width: number, height: number): ShapeBox => ({ id, left, top, width, height });

describe('WCAG 对比（PVQ-02 ④ helper）', () => {
  it('黑/白 = 21:1', () => expect(wcagContrastRatio('#000000', '#FFFFFF')!).toBeCloseTo(21, 0));
  it('白/白 = 1:1', () => expect(wcagContrastRatio('#FFFFFF', '#FFFFFF')!).toBeCloseTo(1, 1));
  it('非法 hex → null（→ 诚实降级）', () => expect(wcagContrastRatio('zzz', '#FFFFFF')).toBeNull());
});

describe('文本宽度估算（PVQ-02 ① 保守上界）', () => {
  it('CJK 比同长度拉丁需要更高（更宽 advance）', () => {
    const cjk = estimateTextBox('中文中文中文中文', 14, 100).neededHeightPt;
    const latin = estimateTextBox('aaaaaaaa', 14, 100).neededHeightPt;
    expect(cjk).toBeGreaterThanOrEqual(latin);
  });
  it('refinement #2：显式 \\n 多段落按行累加（不被流式折行低估高度）', () => {
    // 6 个 \n 分隔的短段：宽框内流式折行只算 1 行，但应按 6 段各 1 行 = 6 行计高
    const multiParagraph = estimateTextBox('行\n行\n行\n行\n行\n行', 18, 400).neededHeightPt;
    const singleLine = estimateTextBox('行行行行行行', 18, 400).neededHeightPt; // 同字数无换行 → 1 行
    expect(multiParagraph).toBeGreaterThan(singleLine);
    expect(multiParagraph).toBeCloseTo(6 * 18 * 1.3, 1); // 6 行 × fontSize × lineHeight
  });
});

describe('checkSlideLayout 四项（PVQ-02）', () => {
  it('① 溢出 happy：短文本不溢出', () => {
    const r = checkSlideLayout([box('s1', 50, 50, 400, 200)], { annotations: [{ shapeId: 's1', text: '短', fontSizePt: 14 }] });
    expect(r.violations.filter((v) => v.kind === 'overflow')).toHaveLength(0);
  });
  it('① 溢出 edge：长文本超小框 → 报溢出', () => {
    const r = checkSlideLayout([box('s1', 50, 50, 100, 20)], { annotations: [{ shapeId: 's1', text: '很长的文本'.repeat(40), fontSizePt: 18 }] });
    expect(r.violations.some((v) => v.kind === 'overflow')).toBe(true);
  });
  it('① 溢出 edge（refinement #2）：显式换行多段落超小框 → 报溢出（流式折行会漏报）', () => {
    // 宽框（流式 1 行不溢出）但 6 段换行 + 小高度 → 按段计行后溢出
    const r = checkSlideLayout([box('s1', 50, 50, 400, 40)], { annotations: [{ shapeId: 's1', text: '行\n行\n行\n行\n行\n行', fontSizePt: 18 }] });
    expect(r.violations.some((v) => v.kind === 'overflow')).toBe(true);
  });
  it('② 重叠 happy：分离的框不报', () => {
    const r = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 200, 50, 100, 100)]);
    expect(r.violations.filter((v) => v.kind === 'overlap')).toHaveLength(0);
  });
  it('② 重叠 edge：相交 >2pt 报', () => {
    const overlap = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 100, 50, 100, 100)]);
    expect(overlap.violations.some((v) => v.kind === 'overlap')).toBe(true);
  });
  it('② 重叠 edge：相邻间隔 1pt（disjoint, ix=-1）不报', () => {
    // a=[50,150], b=[151,251] → 间隔 1pt，不相交
    const gap = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 151, 50, 100, 100)]);
    expect(gap.violations.filter((v) => v.kind === 'overlap')).toHaveLength(0);
  });
  it('② 重叠 edge（refinement #1）：真实 sub-2pt 重叠（ix=1pt）不报，守 OVERLAP_MIN_PT 阈值', () => {
    // a=[50,150], b=[149,249] → 实际相交 1pt（非间隔），1 ≤ OVERLAP_MIN_PT(2) → 不报
    const subThreshold = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 149, 50, 100, 100)]);
    expect(subThreshold.violations.filter((v) => v.kind === 'overlap')).toHaveLength(0);
  });
  it('③ 越界 happy：框在边距内不报', () => {
    const r = checkSlideLayout([box('s', 60, 50, 400, 300)]);
    expect(r.violations.filter((v) => v.kind === 'out_of_bounds')).toHaveLength(0);
  });
  it('③ 越界 edge：框超出 960 画布右缘 → 报（用默认 canvas 960×540，不是 720）', () => {
    const r = checkSlideLayout([box('s', 900, 50, 200, 100)]); // 右缘 1100 > 960
    expect(r.violations.some((v) => v.kind === 'out_of_bounds')).toBe(true);
  });
  it('③ 关键回归：右半屏 (left=700,width=200→右缘 900) 在 960 画布内不越界（若误用 720 会假报）', () => {
    const r = checkSlideLayout([box('s', 700, 50, 200, 100)]);
    expect(r.violations.filter((v) => v.kind === 'out_of_bounds')).toHaveLength(0);
  });
  it('④ 对比 happy：黑字白底不报', () => {
    const r = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: '#000000', background: '#FFFFFF', fontSizePt: 14 }] });
    expect(r.violations.filter((v) => v.kind === 'low_contrast')).toHaveLength(0);
  });
  it('④ 对比 edge：低对比正文 <4.5:1 报 low_contrast', () => {
    const r = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: '#888888', background: '#777777', fontSizePt: 14 }] });
    expect(r.violations.some((v) => v.kind === 'low_contrast')).toBe(true);
  });
  it('④ 大字 3:1 阈值（refinement #3）：ratio 落 3~4.5 带内，20pt 大字放过 / 14pt 正文会报', () => {
    // #898989 on #FFFFFF ≈ 3.50:1（实测），舒适落在 3:1~4.5:1 带内（旧 #949494=3.03 太贴边）
    const ratio = wcagContrastRatio('#898989', '#FFFFFF')!;
    expect(ratio).toBeGreaterThan(3);
    expect(ratio).toBeLessThan(4.5);
    const large = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: '#898989', background: '#FFFFFF', fontSizePt: 20 }] });
    expect(large.violations.filter((v) => v.kind === 'low_contrast')).toHaveLength(0); // 大字阈值 3:1 放过
    const body = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: '#898989', background: '#FFFFFF', fontSizePt: 14 }] });
    expect(body.violations.some((v) => v.kind === 'low_contrast')).toBe(true); // 正文阈值 4.5:1 会报
  });
  it('④ 诚实降级（D-22-05 MUST）：缺背景色 → contrast_undetermined，不报 low_contrast 假阳性', () => {
    const r = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: '#222222', fontSizePt: 14 }] });
    expect(r.violations.some((v) => v.kind === 'contrast_undetermined')).toBe(true);
    expect(r.violations.some((v) => v.kind === 'low_contrast')).toBe(false);
  });
  it('④ 诚实降级：非法 hex → contrast_undetermined，不报 low_contrast 假阳性', () => {
    const r = checkSlideLayout([box('s', 60, 50, 400, 100)], { annotations: [{ shapeId: 's', foreground: 'not-a-hex', background: '#FFFFFF', fontSizePt: 14 }] });
    expect(r.violations.some((v) => v.kind === 'contrast_undetermined')).toBe(true);
    expect(r.violations.some((v) => v.kind === 'low_contrast')).toBe(false);
  });
  it('无 annotations：只查重叠/越界，notes 说明未查溢出/对比', () => {
    const r = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 60, 60, 100, 100)]);
    expect(r.violations.some((v) => v.kind === 'overlap')).toBe(true);
    expect(r.notes.join('')).toContain('未提供');
  });
  it('formatViolations 含画布尺寸锚点 + 建议非强制语', () => {
    const r = checkSlideLayout([box('a', 50, 50, 100, 100), box('b', 60, 60, 100, 100)]);
    const s = formatViolations(r);
    expect(s).toContain('960×540');
    expect(s).toMatch(/建议|非强制/);
  });
});

describe('checkAlignment ⑤ 近似未对齐（UAT-6 odd-one-out）', () => {
  it('KPI 铁证：4 卡顶边 217.2/234.18/234.18/234.18 → 抓 1 条指向 217.2 的离群（差 ~17pt）', () => {
    // 真机复现：第 1 张卡比其余高 ~17pt，旧自查报「0 违规」放过——本用例守门
    const cards = [
      box('c0', 48, 217.2, 200, 100),   // 离群：top 比多数派低 16.98pt
      box('c1', 285, 234.18, 200, 100),
      box('c2', 522, 234.18, 200, 100),
      box('c3', 759, 234.18, 200, 100),
    ];
    const v = checkAlignment(cards).filter((x) => x.kind === 'misalignment');
    expect(v).toHaveLength(1);                 // top/bottom/centerY 同问题去重为 1 条
    expect(v[0].shapeIds[0]).toBe('c0');       // 指向离群卡
    expect(v[0].detail).toContain('17');       // 差值 ~17pt
    expect(v[0].detail).toContain('上缘');      // 首个命中边 = top
  });
  it('精确对齐不报：4 卡 top 全等 → 0 misalignment', () => {
    const cards = [
      box('c0', 48, 234.18, 200, 100), box('c1', 285, 234.18, 200, 100),
      box('c2', 522, 234.18, 200, 100), box('c3', 759, 234.18, 200, 100),
    ];
    expect(checkAlignment(cards).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('近似 ≤EXACT 视为对齐：4 卡 top 差 ≤2pt（多数派内）→ 0', () => {
    const cards = [
      box('c0', 48, 234.18, 200, 100), box('c1', 285, 235.5, 200, 100),
      box('c2', 522, 234.18, 200, 100), box('c3', 759, 233.9, 200, 100),
    ];
    expect(checkAlignment(cards).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('远离不同簇不报：标题 top=36 远离卡 top=234（>NEAR）→ 卡自成簇全对齐 → 0', () => {
    const shapes = [
      box('title', 48, 36, 800, 40),
      box('c0', 48, 234.18, 200, 100), box('c1', 285, 234.18, 200, 100), box('c2', 522, 234.18, 200, 100),
    ];
    expect(checkAlignment(shapes).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('少于 3 不报：仅 2 形状近邻 → 0（无法构成多数派+离群）', () => {
    const two = [box('a', 48, 217.2, 200, 100), box('b', 285, 234.18, 200, 100)];
    expect(checkAlignment(two).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('无多数派不报：3 形状 top=200/212/224 各自离群（无 ≥2 精确对齐）→ 0', () => {
    const shapes = [
      box('a', 48, 200, 200, 80), box('b', 400, 212, 200, 80), box('c', 800, 224, 200, 80),
    ];
    expect(checkAlignment(shapes).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('2+2 双行不误报（如 2×2 近距网格）：无严格多数派 → 0', () => {
    // top 100,100,122,122 同簇（相邻差 ≤24）但 2 对 2，非「多数派+少数」→ 保守不报
    const shapes = [
      box('a', 48, 100, 200, 60), box('b', 400, 100, 200, 60),
      box('c', 48, 122, 200, 60), box('d', 400, 122, 200, 60),
    ];
    expect(checkAlignment(shapes).filter((x) => x.kind === 'misalignment')).toHaveLength(0);
  });
  it('接入 checkSlideLayout 聚合：铁证案例经顶层入口也报 misalignment', () => {
    const cards = [
      box('c0', 48, 217.2, 200, 100), box('c1', 285, 234.18, 200, 100),
      box('c2', 522, 234.18, 200, 100), box('c3', 759, 234.18, 200, 100),
    ];
    const r = checkSlideLayout(cards);
    expect(r.violations.some((x) => x.kind === 'misalignment')).toBe(true);
  });
  it('formatViolations 干净页文案含「对齐」', () => {
    const s = formatViolations(checkSlideLayout([box('s', 60, 50, 400, 300)]));
    expect(s).toContain('对齐');
  });
});
