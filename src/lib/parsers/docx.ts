/**
 * src/lib/parsers/docx.ts — docx → 纯文本（FILE-02）
 * D-06：mammoth ≥1.11.0 extractRawText，await import() 懒加载，
 * 超长文本软截断（D-04 ~30 万字符）
 */

const MAX_CHARS = 300_000;

export async function parseDocx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const { default: mammoth } = await import('mammoth');
  // extractRawText：纯文本，不生成 HTML，无需 sanitize HTML（只进 LLM，非渲染）
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + '\n\n[注：文件内容过长，已读取前约 30 万字符]';
  }
  return text;
}
