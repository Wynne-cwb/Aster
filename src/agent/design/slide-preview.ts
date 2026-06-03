// src/agent/design/slide-preview.ts — Wave 0 stub（24-02 填真身）
// 纯函数坐标映射渲染器（ShapeSpec[]@960×540pt → 绝对定位 div style 描述）
import type { ShapeSpec } from './ppt-layouts';

/** 渲染器输出的 shape 描述（给 SlidePreviewPanel 消费）。最终形状以 24-02 实现为准。 */
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

/** Wave 0 stub：24-02 实现真身（坐标映射，960 基准）。 */
export function mapShapesToRender(
  _shapes: ShapeSpec[],
  _containerWidthPx: number,
): SlideRenderShape[] {
  throw new Error('mapShapesToRender not implemented (Wave 0 stub — 24-02 填真身)');
}
