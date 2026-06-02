/**
 * src/lib/parsers/pdf.ts — pdf → 文本（FILE-04）
 * D-08：pdfjs-dist 5.7.284，await import() 懒加载
 *
 * WORKER RULE（vite.config.ts L1-6）：
 * GlobalWorkerOptions.workerSrc 必须用 new URL(..., import.meta.url).href
 * 禁止 ?url import（dev 能跑但 build 后 worker 404）
 *
 * 扫描件检测：fullText 全空 → throw Error({ code: 'PDF_NO_TEXT_LAYER' })
 * 本地 dev/build 验证；PDF_NO_TEXT_LAYER → D-14 诚实错误（InputBar Plan 05 处理）
 *
 * Phase 19 延后：pdf.js worker 在 GitHub Pages + Office for Web iframe CSP 真机验证
 */

const MAX_CHARS = 300_000;

export async function parsePdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');

  // WORKER RULE：new URL 静态字符串字面量，Vite 构建时 emit worker 文件
  // 禁止 ?url import（vite.config.ts L1-6）
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).href;

  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pageTexts.push(pageText);
  }

  const fullText = pageTexts.join('\n');

  // 扫描件检测（D-08）：全空 → 诚实结构化报错
  if (!fullText.trim()) {
    const err = new Error(
      '这个 PDF 没有可提取的文字（可能是扫描件），暂不支持 OCR',
    ) as Error & { code: string };
    err.code = 'PDF_NO_TEXT_LAYER';
    throw err;
  }

  if (fullText.length > MAX_CHARS) {
    return fullText.slice(0, MAX_CHARS) + '\n\n[注：文件内容过长，已读取前约 30 万字符]';
  }
  return fullText;
}
