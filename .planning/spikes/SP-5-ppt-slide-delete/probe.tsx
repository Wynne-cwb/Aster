/**
 * SP-5 探测：PPT slide.delete() + Web 反向排序 bug
 *
 * 用法：sideload Aster → 临时在 App.tsx import SP5SlideDeleteProbe → PPT 真机点按钮顺序：
 *   1) Read initial slide count（基线）
 *   2) Delete last slide（核心：Web 端 slide.delete() 是否真删 / 报错 / silently 失败）
 *   3) Check selected slides order（PITFALLS 已知 PPT Web getSelectedSlides 反向排序）
 *
 * Phase 3 收尾时删除（不进 v2 main 路径）。
 */
import { useState } from 'react';

declare const PowerPoint: any;

export default function SP5SlideDeleteProbe() {
  const [log, setLog] = useState<string[]>([]);
  const append = (m: string) => setLog((l) => [...l, `[${new Date().toISOString()}] ${m}`]);

  async function probeInsertAndDelete() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        const before = slides.items.length;
        append(`Initial slides: ${before}`);
        // 用户手动插入一张 slide 后再点 Probe Delete
      });
    } catch (e: any) { append(`Read failed: ${e.message ?? e}`); }
  }

  async function probeDeleteLast() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        if (slides.items.length <= 1) {
          append('Skip: need ≥2 slides to safely test delete');
          return;
        }
        const last = slides.items[slides.items.length - 1];
        last.delete();
        await ctx.sync();
        append('Last slide delete() called OK');

        // 再 load 一次确认
        const slides2 = ctx.presentation.slides;
        slides2.load('items');
        await ctx.sync();
        append(`After delete: ${slides2.items.length}`);
      });
    } catch (e: any) { append(`Delete failed: ${e.message ?? e}`); }
  }

  async function probeSelectedSlidesOrder() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const selected = ctx.presentation.getSelectedSlides();
        selected.load('items');
        await ctx.sync();
        append(`Selected slides count: ${selected.items.length}`);
        selected.items.forEach((s: any, i: number) => append(`  [${i}] id=${s.id}`));
      });
    } catch (e: any) { append(`Selected order failed: ${e.message ?? e}`); }
  }

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <h3>SP-5 PPT slide.delete Probe</h3>
      <button onClick={probeInsertAndDelete}>1) Read initial slide count</button>
      <button onClick={probeDeleteLast}>2) Delete last slide</button>
      <button onClick={probeSelectedSlidesOrder}>3) Check selected slides order</button>
      <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
        {log.join('\n')}
      </pre>
    </div>
  );
}
