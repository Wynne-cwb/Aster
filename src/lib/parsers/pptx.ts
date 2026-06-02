/**
 * src/lib/parsers/pptx.ts — pptx → 文本（FILE-05）
 * D-09：jszip 3.10.1 + 原生 DOMParser，await import() 懒加载，
 * slide 数字序排序 + 演讲者备注（notesSlides）
 * text-only 不保真（不还原版式/图）
 */

const MAX_CHARS = 300_000;
const DRAWINGML_T_RE = /<a:t[^>]*>([^<]*)<\/a:t>/g;

/**
 * 从 DrawingML XML 字符串中提取所有 <a:t> 标签的文本内容。
 * 使用正则提取，避免 jsdom 命名空间 XML 解析问题（spike #8 验证的 DOMParser 方案
 * 在真实浏览器下工作，但 jsdom 下 application/xml 解析报错）。
 */
function extractDrawingMLText(xml: string): string {
  const texts: string[] = [];
  let match: RegExpExecArray | null;
  DRAWINGML_T_RE.lastIndex = 0;
  while ((match = DRAWINGML_T_RE.exec(xml)) !== null) {
    const text = match[1].trim();
    if (text) texts.push(text);
  }
  return texts.join(' ');
}

export async function parsePptx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const { default: JSZip } = await import('jszip');
  const zip = await new JSZip().loadAsync(arrayBuffer);
  const parts: string[] = [];

  // 按数字序排 slide（非字典序，防 slide10 排在 slide2 前）
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      return na - nb;
    });

  for (let idx = 0; idx < slideFiles.length; idx++) {
    const filename = slideFiles[idx];
    const xml = await zip.files[filename].async('string');
    const slideText = extractDrawingMLText(xml);
    if (slideText) parts.push(`[Slide ${idx + 1}] ${slideText}`);

    // 演讲者备注（D-09）
    const notesName = filename.replace('slides/slide', 'notesSlides/notesSlide');
    if (zip.files[notesName]) {
      const notesXml = await zip.files[notesName].async('string');
      const notesText = extractDrawingMLText(notesXml);
      if (notesText) parts.push(`[Slide ${idx + 1} 备注] ${notesText}`);
    }
  }

  const fullText = parts.join('\n');
  if (fullText.length > MAX_CHARS) {
    return fullText.slice(0, MAX_CHARS) + '\n\n[注：文件内容过长，已读取前约 30 万字符]';
  }
  return fullText;
}
