/**
 * wps-tools-trim.test.ts — WPS 运行时工具集裁剪守门（Phase 33 Excel + Phase 34 Word/PPT）
 *
 * 本测试守门：
 *   - WPS 运行时 excel → 仅暴露 WPS_EXCEL_CORE_TOOLS（Phase 32 滩头堡）
 *   - WPS 运行时 word  → 仅暴露 WPS_WORD_CORE_TOOLS（Phase 34 滩头堡）
 *   - WPS 运行时 ppt   → 仅暴露 WPS_PPT_CORE_TOOLS（Phase 34 滩头堡）
 *   - 非 WPS（Office for Web / 测试默认）→ 完整工具集（既有行为不回退）
 *
 * 防回退意义：若未来给 WPS 加了未实现 adapter 方法的工具进白名单，或裁剪逻辑被破坏，本测试变红。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  buildToolsForHost,
  isWpsRuntime,
  WPS_EXCEL_CORE_TOOLS,
  WPS_WORD_CORE_TOOLS,
  WPS_PPT_CORE_TOOLS,
} from './index';

function enterWpsRuntime(): void {
  (globalThis as { Application?: unknown }).Application = { ComponentType: 2 };
  (globalThis as { wps?: unknown }).wps = { CreateTaskPane: () => ({}) };
}

afterEach(() => {
  delete (globalThis as { Application?: unknown }).Application;
  delete (globalThis as { wps?: unknown }).wps;
});

describe('Phase 33 — WPS 运行时工具集裁剪', () => {
  it('非 WPS 环境（默认）：isWpsRuntime=false，excel 返完整工具集（含高级工具）', () => {
    expect(isWpsRuntime()).toBe(false);
    const names = buildToolsForHost('excel').map((t) => t.name);
    // 高级工具在非 WPS 下仍在
    expect(names).toContain('format_excel_range');
    expect(names).toContain('sort_range');
    expect(names.length).toBeGreaterThan(WPS_EXCEL_CORE_TOOLS.size);
  });

  it('WPS 运行时 excel：暴露 WPS_EXCEL_CORE_TOOLS（Phase 35 全工具拉齐）', () => {
    enterWpsRuntime();
    expect(isWpsRuntime()).toBe(true);
    const names = buildToolsForHost('excel').map((t) => t.name);

    // 仅核心集，且全部命中白名单
    for (const name of names) {
      expect(WPS_EXCEL_CORE_TOOLS.has(name)).toBe(true);
    }
    // 不变式：构建出的工具数 === 核心集大小（抓核心集里拼错/不存在的工具名）
    expect(names.length).toBe(WPS_EXCEL_CORE_TOOLS.size);
    // Phase 35 拉齐：高级工具现已暴露
    expect(names).toEqual(
      expect.arrayContaining([
        'set_range_values', 'apply_formula', 'set_cell', 'selection_detail',
        'format_excel_range', 'sort_range', 'insert_chart', 'create_pivot_table',
        'merge_cells', 'remove_duplicates', 'create_table', 'manage_worksheet',
      ]),
    );
    // 仍未实现 → 不暴露
    expect(names).not.toContain('freeze_panes');
    expect(names).not.toContain('get_shape_image');
    expect(names).not.toContain('batch_write');
  });

  it('WPS 运行时 word：暴露 WPS_WORD_CORE_TOOLS（Phase 35 全工具拉齐）', () => {
    enterWpsRuntime();
    const names = buildToolsForHost('word').map((t) => t.name);
    for (const name of names) {
      expect(WPS_WORD_CORE_TOOLS.has(name)).toBe(true);
    }
    expect(names.length).toBe(WPS_WORD_CORE_TOOLS.size);
    // Phase 35 拉齐：格式/样式/表格/批注等现已暴露
    expect(names).toEqual(
      expect.arrayContaining([
        'append_paragraph', 'insert_paragraph', 'replace_paragraph', 'selection_detail',
        'set_word_character_format', 'set_word_paragraph_format', 'apply_paragraph_style',
        'find_and_replace', 'insert_table', 'set_word_list_format', 'insert_word_comment',
        'set_word_header_footer', 'edit_table_cell',
      ]),
    );
    // 仍未实现（生图/图库/批量/视觉）→ 不暴露
    expect(names).not.toContain('batch_write');
    expect(names).not.toContain('get_shape_image');
  });

  it('WPS 运行时 ppt：暴露 WPS_PPT_CORE_TOOLS（Phase 35 全工具拉齐）', () => {
    enterWpsRuntime();
    const names = buildToolsForHost('ppt').map((t) => t.name);
    for (const name of names) {
      expect(WPS_PPT_CORE_TOOLS.has(name)).toBe(true);
    }
    expect(names.length).toBe(WPS_PPT_CORE_TOOLS.size);
    // Phase 35 拉齐：渐变/原生表/线条/版式建页/旋转等现已暴露
    expect(names).toEqual(
      expect.arrayContaining([
        'set_shape_text', 'insert_slide', 'add_shape', 'delete_shape', 'move_shape', 'selection_detail',
        'set_shape_property', 'set_shape_text_font', 'set_shape_text_alignment', 'rotate_shape',
        'set_slide_background', 'copy_slide', 'manage_slides', 'apply_slide_layout',
        'insert_ppt_table', 'add_line', 'set_shape_gradient',
      ]),
    );
    // 仍未实现（生图/图库/视觉/批量）→ 不暴露
    expect(names).not.toContain('batch_write');
    expect(names).not.toContain('get_shape_image');
  });
});
