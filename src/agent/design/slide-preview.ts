// src/agent/design/slide-preview.ts
// 纯函数坐标映射渲染器（ShapeSpec[]@960×540pt → 绝对定位 div style 描述）
// 零副作用、零网络、零 React — 可单测
import { DEFAULT_CANVAS_PT } from './ppt-tokens';
import type { ShapeSpec } from './ppt-layouts';

/** 渲染器输出的 shape 描述（给 SlidePreviewPanel 消费） */
export interface SlideRenderShape {
  key: string;
  style: {
    position: 'absolute';
    left: number;
    top: number;
    width: number;
    height: number;
    backgroundColor: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    textAlign: string;
    borderRadius: string | undefined;
    overflow: 'hidden';
    boxSizing: 'border-box';
    padding: string;
    whiteSpace: 'pre-wrap';
  };
  text: string | undefined;
  shapeType: ShapeSpec['shapeType'];
  lineColor: string | undefined;
  lineWeight: number | undefined;
}

/**
 * 将 ShapeSpec[]（@960×540pt 坐标体系）映射为绝对定位 div 的 style 描述对象。
 *
 * 坐标真相源：DEFAULT_CANVAS_PT.widthPt = 960（Phase 22 已定，非 720）
 * scale = containerWidthPx / 960
 *
 * @param shapes  - ShapeSpec[] from ppt-layouts.buildLayout / apply_slide_layout 输出
 * @param containerWidthPx - 预览容器宽度（px），通常约 318px（350px task pane 减 padding）
 */
export function mapShapesToRender(
  shapes: ShapeSpec[],
  containerWidthPx: number,
): SlideRenderShape[] {
  const scale = containerWidthPx / DEFAULT_CANVAS_PT.widthPt; // = containerWidthPx / 960

  return shapes.map((s, i) => {
    const borderRadius: string | undefined =
      s.shapeType === 'RoundRectangle'
        ? `${Math.max(Math.round(4 * scale), 2)}px`
        : s.shapeType === 'Ellipse'
        ? '50%'
        : undefined;

    return {
      key: `${s.role}-${i}`,
      style: {
        position: 'absolute' as const,
        left:   Math.round(s.rect.left   * scale * 100) / 100,
        top:    Math.round(s.rect.top    * scale * 100) / 100,
        width:  Math.round(s.rect.width  * scale * 100) / 100,
        height: Math.round(s.rect.height * scale * 100) / 100,
        backgroundColor: s.fillColor ?? 'transparent',
        // 字号下限 9px（scale 后过小不可辨认，RESEARCH Pattern 2）
        fontSize: Math.max((s.font?.size ?? 14) * scale, 9),
        fontWeight: s.font?.bold ? 700 : 400,
        // 幻灯片内容颜色用 AI 传入 hex，缺省 #222222（物理隔离：不用 --text CSS 变量）
        color: s.font?.color ?? '#222222',
        textAlign: (s.align?.toLowerCase() ?? 'left') as string,
        borderRadius,
        overflow: 'hidden' as const,
        boxSizing: 'border-box' as const,
        padding: `${Math.max(Math.round(2 * scale), 1)}px`,
        whiteSpace: 'pre-wrap' as const,
      },
      text: s.text,
      shapeType: s.shapeType,
      lineColor: s.lineColor,
      lineWeight: s.lineWeight,
    };
  });
}
