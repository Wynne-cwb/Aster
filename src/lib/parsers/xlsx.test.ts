/**
 * src/lib/parsers/xlsx.test.ts — FILE-03 xlsx 解析器测试（Wave 0 红灯 stub）
 *
 * Wave 0：测试先于实现。import './xlsx' 路径在 Wave 2 之前不存在，
 * 运行时报 "Cannot find module './xlsx"（红灯）。
 */
import { describe, it, expect, vi } from 'vitest';

// Mock xlsx（SheetJS）
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: {
    sheet_to_csv: vi.fn().mockReturnValue('col1,col2\n1,2\n3,4'),
  },
  SheetNames: ['Sheet1'],
}));

import { parseXlsx } from './xlsx';

describe('parseXlsx — FILE-03 xlsx 解析（Wave 0 红灯）', () => {
  it('Test 1: parseXlsx(file) 多 sheet 各返回 "=== Sheet: X ===" 表头 + CSV 内容', async () => {
    const xlsx = await import('xlsx');
    // 模拟 2 个 sheet 的工作簿
    vi.mocked(xlsx.read).mockReturnValueOnce({
      SheetNames: ['Sheet1', 'Sheet2'],
      Sheets: {
        Sheet1: {},
        Sheet2: {},
      },
    } as never);
    vi.mocked(xlsx.utils.sheet_to_csv)
      .mockReturnValueOnce('姓名,年龄\n张三,30\n李四,25')
      .mockReturnValueOnce('产品,数量\n苹果,10\n香蕉,20');

    const fakeFile = new File(['fake xlsx bytes'], 'test.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const result = await parseXlsx(fakeFile);

    // 多 sheet 各有表头
    expect(result).toContain('=== Sheet: Sheet1 ===');
    expect(result).toContain('=== Sheet: Sheet2 ===');
    expect(result).toContain('姓名,年龄');
    expect(result).toContain('产品,数量');
  });

  it('Test 2: 单 sheet 返回正确 CSV', async () => {
    const xlsx = await import('xlsx');
    vi.mocked(xlsx.read).mockReturnValueOnce({
      SheetNames: ['数据'],
      Sheets: { 数据: {} },
    } as never);
    vi.mocked(xlsx.utils.sheet_to_csv).mockReturnValueOnce('月份,销售额\n一月,1000\n二月,2000');

    const fakeFile = new File(['fake'], 'single.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = await parseXlsx(fakeFile);

    expect(result).toContain('月份,销售额');
    expect(result).toContain('一月,1000');
  });

  it('Test 3: 超出行数上限时有截断提示', async () => {
    const xlsx = await import('xlsx');
    // 生成超过行数上限的 CSV（10000 行）
    const largeRows = Array.from({ length: 10001 }, (_, i) => `row${i},value${i}`).join('\n');
    vi.mocked(xlsx.read).mockReturnValueOnce({
      SheetNames: ['大表'],
      Sheets: { 大表: {} },
    } as never);
    vi.mocked(xlsx.utils.sheet_to_csv).mockReturnValueOnce(largeRows);

    const fakeFile = new File(['fake'], 'large.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const result = await parseXlsx(fakeFile);

    // 超行数截断提示出现在结果中
    expect(result).toMatch(/截断|已超出|行数上限|前\s*\d+\s*行/);
  });
});
