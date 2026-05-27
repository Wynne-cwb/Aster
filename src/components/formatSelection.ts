/**
 * formatSelection — 将 SelectionContext discriminated union 转为显示文案。
 *
 * 抽离为纯函数（无 fluentui / lingui-macro import），便于在 vitest 下直接单测
 * 显示层逻辑——这正是 ROADMAP SC3 的端到端验收点（上下文卡显示值必须正确）。
 *
 * 覆盖全部 4 个 kind，exhaustive never 检查保证类型安全（D-14）。
 */
import type { SelectionContext } from '../adapters';

type TFn = (s: TemplateStringsArray, ...args: unknown[]) => string;

export function formatSelection(sel: SelectionContext, t: TFn): string {
  switch (sel.kind) {
    case 'ppt':
      // D-14 / Copywriting：第 N 张 slide（slideIndex 已是 1-based，直接显示，不再 +1）
      return t`第 ${sel.slideIndex} 张 slide`;
    case 'excel':
      // D-14 / Copywriting：选中区域 {address}
      return t`选中区域 ${sel.address}`;
    case 'word':
      // D-14 / Copywriting：选中 {n} 字
      return t`选中 ${sel.charCount} 字`;
    case 'none':
      // D-16：无选中内容占位，不抛错
      return t`未选中内容`;
    default: {
      // Exhaustive check — TypeScript 会在新增 kind 未处理时报错
      const _exhaustive: never = sel;
      return t`未选中内容`;
    }
  }
}
