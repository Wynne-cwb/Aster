/**
 * src/store/selection.ts — 选区状态 Zustand store
 *
 * 用途（CARRY-01 修复路径 A）：
 *   main.tsx Office.onReady 回调内 await adapter.getSelection() 一次，
 *   把结果灌到 useSelectionStore.initial；ContextCard / SelectionPill 的
 *   useState 初值改读这个 store，避免 React mount 与 Office.onReady 之间的
 *   微任务时序让用户看到 1-2 帧「未选中内容」占位。
 *
 * 用户切换选区时仍走 adapter.onSelectionChanged 订阅在组件内更新（不动 v1 路径）。
 *
 * 关联决策：D-22 / D-23 路径 A、RESEARCH §Deliverable 6 §6.3、PATTERNS.md
 * 「src/main.tsx (modify, CARRY-01 路径 A)」段。
 */
import { create } from 'zustand';
import type { SelectionContext } from '../adapters/DocumentAdapter';

interface SelectionState {
  /** Office.onReady 内预取的初值；组件 useState 初值读这个字段 */
  initial: SelectionContext;
}

export const useSelectionStore = create<SelectionState>(() => ({
  initial: { kind: 'none' },
}));
