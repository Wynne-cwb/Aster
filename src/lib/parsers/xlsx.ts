/**
 * src/lib/parsers/xlsx.ts — xlsx → CSV（FILE-03）
 * D-07：SheetJS 0.20.3（cdn.sheetjs.com tgz），await import() 懒加载，
 * 多 sheet 全转 CSV，行数超大时软截断（D-04）
 */

const MAX_CHARS = 300_000;
const MAX_ROWS = 1000; // 单 sheet 最大行数（Claude's Discretion，防超大表）

export async function parseXlsx(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const XLSX = await import('xlsx');
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const parts: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    let csv = XLSX.utils.sheet_to_csv(ws);
    // 行数截断（D-04）
    const rows = csv.split('\n');
    if (rows.length > MAX_ROWS) {
      csv = rows.slice(0, MAX_ROWS).join('\n') + `\n[注：表格行数过多，已读取前 ${MAX_ROWS} 行]`;
    }
    parts.push(`=== Sheet: ${sheetName} ===\n${csv}`);
  }
  const fullText = parts.join('\n\n');
  if (fullText.length > MAX_CHARS) {
    return fullText.slice(0, MAX_CHARS) + '\n\n[注：文件内容过长，已读取前约 30 万字符]';
  }
  return fullText;
}
