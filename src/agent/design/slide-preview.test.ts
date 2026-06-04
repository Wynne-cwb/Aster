import { describe, it, expect } from 'vitest';
import { mapShapesToRender } from './slide-preview';
import type { ShapeSpec } from './ppt-layouts';

// 辅助工厂：创建最小 ShapeSpec
const shape = (
  overrides: Partial<ShapeSpec> & { rect: ShapeSpec['rect'] }
): ShapeSpec => ({
  role: 'test',
  shapeType: 'TextBox',
  text: 'test',
  ...overrides,
});

// ---------------------------------------------------------------------------
// describe.skip：Plan 24-02 实现 mapShapesToRender 真身后解除 skip
// ---------------------------------------------------------------------------
describe('mapShapesToRender 坐标映射（PVQ-06，坐标基准 960×540）', () => {
  it('① happy path：scale=0.5 时坐标减半', () => {
    const shapes = [shape({ rect: { left: 48, top: 36, width: 864, height: 468 } })];
    const result = mapShapesToRender(shapes, 480); // scale = 480/960 = 0.5
    expect(result[0].style.left).toBe(24);
    expect(result[0].style.top).toBe(18);
    expect(result[0].style.width).toBe(432);
    expect(result[0].style.height).toBe(234);
  });

  it('② 坐标基准 960 回归（防 720 错误基准）', () => {
    const shapes = [shape({ rect: { left: 48, top: 36, width: 864, height: 468 } })];
    const result = mapShapesToRender(shapes, 960); // scale = 960/960 = 1.0
    expect(result[0].style.left).toBe(48);
    expect(result[0].style.width).toBe(864);
  });

  it('③ 字号下限：scale 后 < 9px 时兜底为 9', () => {
    const shapes = [shape({ rect: { left: 0, top: 0, width: 100, height: 50 }, font: { size: 4 } })];
    const result = mapShapesToRender(shapes, 480); // scale=0.5, 4*0.5=2 < 9
    expect(result[0].style.fontSize).toBe(9);
  });

  it('④ ShapeType borderRadius 分支', () => {
    const rounded = mapShapesToRender(
      [shape({ shapeType: 'RoundRectangle', rect: { left: 0, top: 0, width: 100, height: 50 } })],
      480,
    );
    expect(rounded[0].style.borderRadius).toMatch(/px$/);

    const ellipse = mapShapesToRender(
      [shape({ shapeType: 'Ellipse', rect: { left: 0, top: 0, width: 100, height: 50 } })],
      480,
    );
    expect(ellipse[0].style.borderRadius).toBe('50%');

    const rect = mapShapesToRender(
      [shape({ shapeType: 'Rectangle', rect: { left: 0, top: 0, width: 100, height: 50 } })],
      480,
    );
    expect(rect[0].style.borderRadius).toBeUndefined();
  });
});
