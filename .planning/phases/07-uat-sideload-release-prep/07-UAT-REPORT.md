# Phase 7 UAT 报告

**日期：** 2026-05-30
**浏览器：** Chrome（最新版，OfficeOnline）— D-12 只跑 Chrome
**线上版本：** GitHub Pages `f9fdcc4`（验证通过的发布版）
**执行：** 用户真机（D-11 分工：Claude 备清单 + 自跑非真机门禁；用户跑真机）
**结论：** ✅ **全部 PASS**（4 killer scenario + A-21 + sideload；2 个 bug 当场修复后重测通过 — D-15 迭代）

---

## Sideload（NFR-01 / 发布）
- ✅ Chrome × PowerPoint / Excel / Word 三宿主 sideload，Task Pane 正常渲染（用户真机确认）
- 部署机制：`.github/workflows/pages.yml`（Actions 源构建），manifest SourceLocation → `wynne-cwb.github.io/Aster/`

## Killer Scenario 结果

| SC | 场景 | 宿主 | 结果 |
|----|------|------|------|
| SC1 | Topic→Deck | PowerPoint | ✅ PASS |
| SC2 | 清洗+图+洞察 | Excel | ✅ PASS |
| SC3 | 整篇润色 + 选区改写 | Word | ✅ PASS（修复 Bug 3 后） |
| SC4 | Shape 精细化（红边+右移） | PowerPoint | ✅ PASS |

> 证据格式（D-14）：用户真机逐场景确认 PASS；NFR-03 性能（首 token ≤2s / 单步 ≤10s）肉眼无明显卡顿。具体步数/耗时未逐项回填（终态 PASS 为准）。

## A-21 测试按钮（唯一新功能）
- ✅ 已保存自定义 Provider 编辑表单出现「测试 tool calling」按钮，点击 → loading → ✓/✗ badge（修复 Bug 2 后）
- ✅ 内置 model 不显示按钮（hardcode 支持）
- ✅ 不支持的 model pre-flight 拦截（启动 agent 前明确报错，文案含 gpt-5.1）

---

## 发现的 Bug 与修复（D-15 迭代）

| # | Bug | 根因 | 修复 commit | 重测 |
|---|-----|------|------------|------|
| Bug 2 | A-21 测试按钮点击无响应（无请求/无报错） | CR-01 原修法（空 Key→按钮诚实禁用）叠加 B2/B3（仅已保存可测）+ 不回填 Key 设计 → 编辑模式 Key 字段恒空 → 按钮永久禁用，点到 `aria-disabled` 按钮静默无反应 | `f9fdcc4` | ✅ PASS |
| Bug 3 | Word 读不到选中文字内容（只知字符数） | `selection_detail` 只返 `{kind,charCount}`、丢弃 `selection.text`（隐私时代 T-01-06 遗留；v2.0 已砍 PRIV，全文本就可读）→ agent 读遍全文仍无法定位选区、放弃 | `8078988` | ✅ PASS |

**修复要点（守住既有约束）：**
- Bug 2：probe 在 **providers 层** `getKey(providerId)` 回退（与 `loop.ts:33` 一致），UI 层仍不碰 Key（守 T-02-18）；无任何 Key 时 probe 返回 null（不发空 Bearer，保住原 CR-01 防污染初衷）。
- Bug 3：`selection_detail` 返回选中文字本身；`getSelection()` 仍只回 charCount 供 UI selpill。
- 两修复均补了守门单测（防回归）。

## 非真机门禁（Claude 自跑）
- `npm test`：tsc clean + **604 passed / 49 files**（`retry.test.ts` 预存在 flaky，单跑 9/9，非回归）
- `npm run build && npm run size`：**73.42 KB gzip ≤ 82 KB**（NFR-05）
- NFR-04：无 Aster 自有服务器 URL（架构不变量）

---

*Phase 7 UAT 通过 = v2.0 首次公开发布完成。报告由 Claude 记录（D-11/D-14/D-15）。*
