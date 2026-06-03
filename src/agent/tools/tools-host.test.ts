/**
 * src/agent/tools/tools-host.test.ts — buildToolsForHost per-host 注册守门（IMG-05）
 *
 * 验证：
 *   - Excel host 工具表不含 generate_ppt_image（IMG-05：Excel 无原生插图 API）
 *   - Excel host 工具表不含 generate_word_image（IMG-05 同理）
 *   - PPT host 工具表含 generate_ppt_image（Plan 16-03 注册后通过）— 当前 it.skip
 *   - Word host 工具表含 generate_word_image（Plan 16-03 注册后通过）— 当前 it.skip
 *
 * Excel 守门不需要 Phase 16 实现文件（buildToolsForHost 已存在，Excel case 不会神奇包含 Phase 16 工具）。
 * PPT/Word 含 generate_* 的守门在 Plan 16-03 注册工具后去掉 it.skip。
 */
import { describe, it, expect } from 'vitest';
import { buildToolsForHost } from './index';

describe('buildToolsForHost — IMG-05 per-host 注册守门', () => {
  // Excel host 不含生图工具（当前即 GREEN：Excel case 无 Phase 16 工具注册）
  it('Excel host 工具表不含 generate_ppt_image', () => {
    const excelTools = buildToolsForHost('excel');
    expect(excelTools.map((t) => t.name)).not.toContain('generate_ppt_image');
  });

  it('Excel host 工具表不含 generate_word_image', () => {
    const excelTools = buildToolsForHost('excel');
    expect(excelTools.map((t) => t.name)).not.toContain('generate_word_image');
  });

  // PPT/Word 含 generate_* 的守门：Plan 16-03 注册工具后解除 it.skip
  it('PPT host 工具表含 generate_ppt_image（Plan 16-03 注册后通过）', () => {
    const pptTools = buildToolsForHost('ppt');
    expect(pptTools.map((t) => t.name)).toContain('generate_ppt_image');
  });

  it('Word host 工具表含 generate_word_image（Plan 16-03 注册后通过）', () => {
    const wordTools = buildToolsForHost('word');
    expect(wordTools.map((t) => t.name)).toContain('generate_word_image');
  });

  // Phase 18 LIB-02 per-host 守门：图库工具 PPT/Word 含、Excel 不含（D-11）
  it('Excel host 工具表不含 search_and_insert_stock_image（D-11）', () => {
    expect(buildToolsForHost('excel').map((t) => t.name)).not.toContain('search_and_insert_stock_image');
  });

  it('PPT host 工具表含 search_and_insert_stock_image（LIB-02）', () => {
    expect(buildToolsForHost('ppt').map((t) => t.name)).toContain('search_and_insert_stock_image');
  });

  it('Word host 工具表含 search_and_insert_stock_image（LIB-02）', () => {
    expect(buildToolsForHost('word').map((t) => t.name)).toContain('search_and_insert_stock_image');
  });
});
