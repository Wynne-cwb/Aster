/**
 * Phase 3 临时探测组件 — SP-4 + SP-5。
 *
 * UAT 完成后整文件 + SettingsPanel 内 import/挂载行一并 revert。
 * 不进 lingui catalog(英文 label 临时即可),不动 styles.css。
 */
import { useState } from 'react';

declare const Word: any;
declare const Excel: any;
declare const PowerPoint: any;

export default function SpikeProbesPanel() {
  const [log, setLog] = useState<string[]>([]);
  const append = (m: string) => setLog((l) => [...l.slice(-200), `[${new Date().toLocaleTimeString()}] ${m}`]);

  // ---------- SP-4 ----------

  async function probeWordDeleteLastParagraph() {
    try {
      await Word.run(async (ctx: any) => {
        const paragraphs = ctx.document.body.paragraphs;
        paragraphs.load('items');
        await ctx.sync();
        append(`[SP-4 Word] total paragraphs: ${paragraphs.items.length}`);
        if (paragraphs.items.length > 0) {
          const last = paragraphs.items[paragraphs.items.length - 1];
          last.delete();
          await ctx.sync();
          append('[SP-4 Word] last paragraph deleted OK');
        }
      });
    } catch (e: any) {
      append(`[SP-4 Word] delete failed: ${e.message ?? e}`);
    }
  }

  async function probeExcelBeforeImage() {
    try {
      await Excel.run(async (ctx: any) => {
        const range = ctx.workbook.getSelectedRange();
        range.load(['values', 'address']);
        await ctx.sync();
        append(`[SP-4 Excel] selected address: ${range.address}`);
        append(`[SP-4 Excel] before-image rows: ${range.values?.length}`);
      });
    } catch (e: any) {
      append(`[SP-4 Excel] read failed: ${e.message ?? e}`);
    }
  }

  async function probePptRead() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        append(`[SP-4 PPT] initial slides: ${slides.items.length}`);
      });
    } catch (e: any) {
      append(`[SP-4 PPT] read failed: ${e.message ?? e}`);
    }
  }

  // ---------- SP-5 ----------

  async function sp5Initial() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        append(`[SP-5] initial slide count: ${slides.items.length}`);
      });
    } catch (e: any) {
      append(`[SP-5] initial read failed: ${e.message ?? e}`);
    }
  }

  async function sp5DeleteLast() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const slides = ctx.presentation.slides;
        slides.load('items');
        await ctx.sync();
        if (slides.items.length <= 1) {
          append('[SP-5] skip: need ≥2 slides to safely test delete');
          return;
        }
        const last = slides.items[slides.items.length - 1];
        last.delete();
        await ctx.sync();
        append('[SP-5] last slide delete() called OK');

        const slides2 = ctx.presentation.slides;
        slides2.load('items');
        await ctx.sync();
        append(`[SP-5] after delete: ${slides2.items.length}`);
      });
    } catch (e: any) {
      append(`[SP-5] delete failed: ${e.message ?? e}`);
    }
  }

  async function sp5SelectedOrder() {
    try {
      await PowerPoint.run(async (ctx: any) => {
        const selected = ctx.presentation.getSelectedSlides();
        selected.load('items');
        await ctx.sync();
        append(`[SP-5] selected slides count: ${selected.items.length}`);
        selected.items.forEach((s: any, i: number) =>
          append(`[SP-5]   [${i}] id=${s.id}`),
        );
      });
    } catch (e: any) {
      append(`[SP-5] selected order failed: ${e.message ?? e}`);
    }
  }

  const btn: React.CSSProperties = {
    padding: '6px 10px',
    fontSize: 12,
    margin: '4px 4px 0 0',
    cursor: 'pointer',
  };

  return (
    <div
      style={{
        marginTop: 24,
        padding: 12,
        borderTop: '1px dashed var(--border)',
        fontSize: 12,
        color: 'var(--text-2)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: 6 }}>
        🔬 Phase 3 Spike Probes (临时,UAT 后删)
      </strong>

      <div style={{ marginTop: 8 }}>
        <em>SP-4 reverse ops</em>
        <div>
          <button style={btn} onClick={probeWordDeleteLastParagraph}>
            Word: delete last paragraph
          </button>
          <button style={btn} onClick={probeExcelBeforeImage}>
            Excel: selected before-image
          </button>
          <button style={btn} onClick={probePptRead}>
            PPT: read slide count
          </button>
        </div>
      </div>

      <div style={{ marginTop: 8 }}>
        <em>SP-5 PPT slide.delete (在 PPT 真机里跑)</em>
        <div>
          <button style={btn} onClick={sp5Initial}>
            1) Read initial slide count
          </button>
          <button style={btn} onClick={sp5DeleteLast}>
            2) Delete last slide (需 ≥2 张)
          </button>
          <button style={btn} onClick={sp5SelectedOrder}>
            3) Check selected slides order
          </button>
        </div>
      </div>

      <pre
        style={{
          marginTop: 10,
          padding: 8,
          background: 'var(--surface-2)',
          maxHeight: 240,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          fontSize: 11,
          fontFamily: 'ui-monospace, Menlo, monospace',
        }}
      >
        {log.length === 0 ? '(点上面按钮跑探测,日志会出现在这里)' : log.join('\n')}
      </pre>

      <button
        style={{ ...btn, marginTop: 6 }}
        onClick={() => setLog([])}
      >
        Clear log
      </button>
    </div>
  );
}
