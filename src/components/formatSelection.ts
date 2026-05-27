/**
 * formatSelection — 将 SelectionContext discriminated union 转为显示文案。
 *
 * 抽离为纯函数便于单测显示层逻辑——这正是 ROADMAP SC3 的端到端验收点
 * （上下文卡显示值必须正确）。
 *
 * i18n（关键）：动态选区文案带插值（slide 序号 / range 地址 / 字符数），必须用
 * `msg`（@lingui/core/macro）定义可被 `lingui extract` 静态提取的消息描述符，
 * 再用 `i18n._()` 解析。早期实现把 `t` 当裸参数传入并 ``t`第 ${n} 张```，绕过了
 * Lingui 宏 → extract 扫不到 → catalog 缺这些消息 → 运行时渲染空白（Test 3 bug）。
 *
 * 覆盖全部 4 个 kind，exhaustive never 检查保证类型安全（D-14）。
 */
import { msg } from '@lingui/core/macro';
import type { I18n } from '@lingui/core';
import type { SelectionContext } from '../adapters';

export function formatSelection(sel: SelectionContext, i18n: I18n): string {
  switch (sel.kind) {
    case 'ppt':
      // D-14 / Copywriting：第 N 张 slide（slideIndex 已是 1-based，直接显示，不再 +1）
      return i18n._(msg`第 ${sel.slideIndex} 张 slide`);
    case 'excel':
      // D-14 / Copywriting：选中区域 {address}
      return i18n._(msg`选中区域 ${sel.address}`);
    case 'word':
      // D-14 / Copywriting：选中 {n} 字
      return i18n._(msg`选中 ${sel.charCount} 字`);
    case 'none':
      // D-16：无选中内容占位，不抛错
      return i18n._(msg`未选中内容`);
    default: {
      // Exhaustive check — TypeScript 会在新增 kind 未处理时报错
      const _exhaustive: never = sel;
      return i18n._(msg`未选中内容`);
    }
  }
}
