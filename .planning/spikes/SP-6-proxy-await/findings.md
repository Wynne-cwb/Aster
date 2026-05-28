# Spike SP-6: Office.js context proxy 跨 await 边界生命周期

**Type:** ① archived（PITFALLS A-06 已知 100% 复现 + v1 三宿主 adapter 已防御）
**Status:** PASS（archived）
**Date:** 2026-05-29
**Source:** ROADMAP Phase 3 Week 1 Spike 段

## 验证目标
确认 `Word.run / Excel.run / PowerPoint.run` 闭包内的 proxy 对象（Word.Paragraph / Excel.Range / PowerPoint.Slide）跨 await 边界后失效。

## 探测方法（不跑，直接归档）
PITFALLS.md §A-06 给出 100% 复现条件 + Office.js capabilities matrix 文档明确说明 `*.run` 闭包语义。v1 三宿主 adapter 已按「pure data in / pure data out」写过：
- `src/adapters/WordAdapter.ts` insert()/getSelection() 全在 `Word.run` 闭包内消费 proxy 即丢
- `src/adapters/ExcelAdapter.ts` 同
- `src/adapters/PptAdapter.ts` 同

## 结论
1. Phase 3 沿用现有 adapter 接口契约：tool execute 调 adapter method，**不允许** agent 层直接调 Office.js `*.run`
2. Plan 04 `src/agent/tools/index.ts` 添加 ToolDef.execute 签名：输入 plain TArgs，输出 Promise<ToolResult>；proxy 不出 adapter 边界
3. Plan 05 `src/agent/tools/write/word.ts` 调 `adapter.appendParagraph(text)` 而非自开 Word.run

## Fallback
N/A — 已 archived。Phase 5 写 eslint rule 禁 `Excel.* / Word.* / PowerPoint.*` 命名空间进 store action（D-13 提到的 rule，Phase 3 写好但不阻断）。
