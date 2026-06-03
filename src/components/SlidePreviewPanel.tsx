/**
 * src/components/SlidePreviewPanel.tsx — 幻灯片自渲染预览面板（Phase 24 PVQ-06）
 *
 * 设计系统：teal 克制（quiet）；面板 chrome 走 CSS 变量，幻灯片内容颜色物理隔离。
 * 懒加载：default export 供 ChatStream.tsx React.lazy() 使用（不进 main chunk）。
 * 截图：html2canvas 不在本文件 import，由 visual_check_slide 工具层负责。
 * 注册：挂载时 registerPreviewElement(() => containerElRef.current)，
 *       卸载时 registerPreviewElement(() => null)，工具截图时读取。
 */
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Trans } from '@lingui/react/macro';
import { mapShapesToRender } from '../agent/design/slide-preview';
import { registerPreviewElement } from '../agent/tools/read/visual-check';
import type { ShapeSpec } from '../agent/design/ppt-layouts';

interface Props {
  shapes: ShapeSpec[];
}

/**
 * SlidePreviewPanel — 幻灯片自渲染预览面板。
 *
 * Props:
 *   shapes — ShapeSpec[] 由 ChatStream.tsx 经 buildLayout(tool-call args) 重建，
 *             不从 toolResult.data 读（data 不含几何）。
 *
 * 挂载时注册 previewEl getter，供 visual_check_slide 工具 html2canvas 截图。
 * ResizeObserver 监听容器宽度，动态更新 16:9 预览尺寸（scale = width / 960pt）。
 */
export default function SlidePreviewPanel({ shapes }: Props) {
  const containerElRef = useRef<HTMLDivElement>(null);
  // 默认 318px（350px task pane 减去 2×16px 父层 padding）
  const [containerWidth, setContainerWidth] = useState(318);

  // 挂载时注册 previewEl getter，供 visual_check_slide 工具截图（NFR-09 守门：截图仅此容器）
  useLayoutEffect(() => {
    registerPreviewElement(() => containerElRef.current);
    return () => {
      registerPreviewElement(() => null);
    };
  }, []);

  // ResizeObserver：监听父容器宽度变化，更新 containerWidth → 重新计算 scale
  useLayoutEffect(() => {
    const el = containerElRef.current;
    if (!el) return;
    // 监听父元素宽度（.slide-preview-panel 占满父列宽）
    const target = el.parentElement ?? el;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setContainerWidth(w);
    });
    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, []);

  // mapShapesToRender：纯函数，零副作用；useMemo 避免每帧重算
  const renderedShapes = useMemo(
    () => mapShapesToRender(shapes, containerWidth),
    [shapes, containerWidth],
  );

  // 16:9 预览高度（960×540pt 基准，LOCKED-4）
  const previewHeight = Math.round(containerWidth * (540 / 960));

  return (
    <div className="slide-preview-panel">
      {/* Chrome header：面板标题（走 CSS 变量，teal 克制） */}
      <div className="slide-preview-panel__header">
        <span
          className="slide-preview-panel__title"
          role="heading"
          aria-level={3}
        >
          <Trans>幻灯片预览</Trans>
        </span>
      </div>

      {/* 16:9 渲染容器：绝对定位 div 承载 ShapeSpec 输出 */}
      {/* ⚠️ 颜色物理隔离：形状颜色来自 ShapeSpec hex（AI 传入），不用 --accent/--bg 等面板 token */}
      <div
        ref={containerElRef}
        className="slide-preview-container"
        role="img"
        aria-label="幻灯片预览"
        style={{ height: previewHeight }}
      >
        {renderedShapes.map((s) => (
          <div key={s.key} style={s.style as React.CSSProperties}>
            {s.text}
          </div>
        ))}
      </div>
    </div>
  );
}
