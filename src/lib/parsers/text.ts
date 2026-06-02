/**
 * src/lib/parsers/text.ts — txt/md/csv/json → 文本（FILE-05 extra）
 * D-10：File.text() 零库，0 KB 懒加载开销
 */

const MAX_CHARS = 300_000;

export async function parseText(file: File): Promise<string> {
  const text = await file.text();
  if (text.length > MAX_CHARS) {
    return text.slice(0, MAX_CHARS) + '\n\n[注：文件内容过长，已读取前约 30 万字符]';
  }
  return text;
}
