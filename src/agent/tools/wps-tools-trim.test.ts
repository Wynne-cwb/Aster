/**
 * wps-tools-trim.test.ts — Phase 33 诚实收口：WPS 运行时工具集裁剪守门
 *
 * WPS Excel 滩头堡只实现核心 9 方法（Phase 32）。本测试守门：
 *   - WPS 运行时 excel → 仅暴露 WPS_EXCEL_CORE_TOOLS（不含未实现的高级工具）
 *   - WPS 运行时 word/ppt → []（WPS-D1 未实现，诚实不暴露）
 *   - 非 WPS（Office for Web / 测试默认）→ 完整工具集（既有行为不回退）
 *
 * 防回退意义：若未来给 WPS 加了未实现 adapter 方法的工具进白名单，或裁剪逻辑被破坏，本测试变红。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { buildToolsForHost, isWpsRuntime, WPS_EXCEL_CORE_TOOLS } from './index';

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

  it('WPS 运行时 excel：仅暴露 WPS_EXCEL_CORE_TOOLS（核心已实现集）', () => {
    enterWpsRuntime();
    expect(isWpsRuntime()).toBe(true);
    const names = buildToolsForHost('excel').map((t) => t.name);

    // 仅核心集，且全部命中白名单
    for (const name of names) {
      expect(WPS_EXCEL_CORE_TOOLS.has(name)).toBe(true);
    }
    // 核心读写齐
    expect(names).toEqual(
      expect.arrayContaining([
        'list_worksheets', 'get_range_values', 'get_used_range_summary',
        'set_range_values', 'apply_formula', 'set_cell', 'selection_detail',
      ]),
    );
    // 未实现的高级工具 + get_shape_image 不暴露
    expect(names).not.toContain('format_excel_range');
    expect(names).not.toContain('insert_chart');
    expect(names).not.toContain('get_shape_image');
    expect(names).not.toContain('create_pivot_table');
    expect(names).not.toContain('batch_write');
  });

  it('WPS 运行时 word/ppt：返 []（WPS-D1 未实现，诚实不暴露）', () => {
    enterWpsRuntime();
    expect(buildToolsForHost('word')).toEqual([]);
    expect(buildToolsForHost('ppt')).toEqual([]);
  });
});
