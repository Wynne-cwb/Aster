/**
 * SP-4 探测：三宿主 reverse 操作可达性
 *
 * 临时探测组件 — 用户在 sideloaded Aster Task Pane 里挂一个临时按钮即可跑。
 * Phase 3 收尾时删除（不进 v2 main 路径）。
 *
 * 用法：临时在 src/App.tsx 顶部 import SP4ReversePanel 并渲染；用户在 PPT/Excel/Word 真机
 * sideload Aster，点对应按钮，console 看 raw log，截图发回。
 *
 * 验证目标：
 *   - Word 文档：删除最后一段 — `Word.run` 内 paragraph.delete() 是否可用
 *   - Excel：set_range_values 反操作 — pre-state 抓 .values 后能否覆写
 *   - PPT：slide.delete() Web 端是否真删（SP-5 同时跑会更全面）
 */
import { useState } from 'react';

declare const Word: any;
declare const Excel: any;
declare const PowerPoint: any;

export default function SP4ReversePanel() {
  const [log, setLog] = useState<string[]>([]);
  const append = (m: string) => setLog((l) => [...l, `[${new Date().toISOString()}] ${m}`]);

  async function probeWordDeleteLastParagraph() {
    try {
      await Word.run(async (ctx: any) => {
        const paragraphs = ctx.document.body.paragraphs;
        paragraphs.load('items');
        await ctx.sync();
        append(`Word total paragraphs: ${paragraphs.items.length}`);
        if (paragraphs.items.length > 0) {
          const last = paragraphs.items[paragraphs.items.length - 1];
          last.delete();
          await ctx.sync();
          append('Word last paragraph deleted OK');
        }
      });
    } catch (e: any) { append(`Word delete failed: ${e.message ?? e}`); }
  }

  async function probeExcelBeforeImage() {
    try {
      await Excel.run(async (ctx: any) => {
        const range = ctx.workbook.getSelectedRange();
        range.load(['values', 'address']);
        await ctx.sync();
        append(`Excel selected address: ${range.address}`);
        append(`Excel before-image rows: ${range.values?.length}`);
      });
    } catch (e: any) { append(`Excel read failed: ${e.message ?? e}`); }
  }

  async function probePptInsertSlideThenDelete() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        append(`PPT initial slides: ${slides.items.length}`);
        // 仅读，不插不删（SP-5 跑插入+删除组合）
      });
    } catch (e: any) { append(`PPT read failed: ${e.message ?? e}`); }
  }

  return (
    <div style={{ padding: 12, fontSize: 12 }}>
      <h3>SP-4 Reverse Ops Probe</h3>
      <button onClick={probeWordDeleteLastParagraph}>Probe Word delete last paragraph</button>
      <button onClick={probeExcelBeforeImage}>Probe Excel selected before-image</button>
      <button onClick={probePptInsertSlideThenDelete}>Probe PPT slides read</button>
      <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>
        {log.join('\n')}
      </pre>
    </div>
  );
}
