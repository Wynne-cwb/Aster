---
quick_id: 260604-fzn
title: Fix UAT-1 apply_slide_layout invalid GeometricShapeType + orphan slide + guard
status: complete
date: 2026-06-04
base_commit: 420e01b
commits:
  - 1ecc05f  # fix: RoundedRectangle→RoundRectangle 非法 GeometricShapeType
  - c878c6d  # fix: applySlideLayout 失败事务性清理孤儿页
  - 0ffad97  # test: 守门 shapeType ⊆ 合法集 + 强化 mock
real_machine_verified: false  # 真机 ok=false 只能由用户 Office for Web 重测 ① 确认
---

# Quick Task 260604-fzn — Fix UAT-1: apply_slide_layout 真机 ok=false

## 根因（Team Lead 已确认）
`apply_slide_layout` 套用 KPI 版式真机返回 `ok=false`。根因：`ppt-layouts.ts` 声明几何形状类型
`'RoundedRectangle'`，但它**不是合法 Office.js `PowerPoint.GeometricShapeType`**（合法是
`'RoundRectangle'`，无 "ed"）。真机 `addGeometricShape('RoundedRectangle', rect)` 抛 "invalid
argument" → catch → HostApiError → ok=false。AI 3× 重试各留一张半成品孤儿页后熔断。
单测此前放绿 = mock 的 `addGeometricShape` 不校验枚举（mock-vs-real gap）。

只 KPI 失败：`'Rectangle'`/`'Ellipse'`（timeline 用）合法；纯 TextBox 版式不碰 addGeometricShape；
只有 KPI `kpi_value` 圆角色块用到非法值。

## 改动（3 commit / 8 文件）

### ① 主修复 — 非法 GeometricShapeType 字符串（commit 1ecc05f）
| 文件 | before → after |
|---|---|
| `src/agent/design/ppt-layouts.ts` | ShapeSpec 类型联合 `'…RoundedRectangle…'` → `'…RoundRectangle…'`；`kpi_value` 用法 `shapeType: 'RoundedRectangle'` → `'RoundRectangle'` |
| `src/agent/tools/write/ppt.ts` | `add_shape` 工具 schema enum：`'RoundedRectangle'` → `'RoundRectangle'`，且 `'Arrow'` → `'RightArrow'`（裸 `'Arrow'` 也非合法 GeometricShapeType）——同一 bug 类、AI 可达 |
| `src/agent/design/slide-preview.ts` + `.test.ts` | 圆角分支匹配 `=== 'RoundedRectangle'` → `=== 'RoundRectangle'`（buildLayout 现产出此值，否则预览 KPI 块变直角） |

全文件扫描确认：`'Rectangle'`(timeline_connector)、`'Ellipse'`(timeline_node) 合法，保留。

### ② 孤儿页事务性清理（commit c878c6d）
`PptAdapter.applySlideLayout`：新页在 sync 2/3 已 commit。把 sync 3 捕获的双定位指纹
`{index,id}` 写到 `try` 外层作用域；`catch` 路径用**独立 `PowerPoint.run`** 复用
`deleteSlideByIndex({capturedIndex, capturedId})` 尽力删半成品孤儿页，再 re-throw 原
HostApiError。best-effort：清理本身失败也 try/catch 吞掉，**绝不掩盖/覆盖原始错误**。
reverse 契约 `{capturedIndex, capturedId}` Record 对象不变。同步更新 D-23-02 deferred-risk 注释
为「UAT 已发现 + 已修（RoundRectangle 大小写）+ 孤儿页清理已加」，保留历史。

### ③ 结构守门 — 关 mock-vs-real gap（commit 0ffad97；memory recurring-failure→add-gate）
- `ppt-layouts.test.ts`：硬编码 `PowerPoint.GeometricShapeType` 全量 177 合法值 Set + 断言
  - (a) ShapeSpec 联合每个非-TextBox 成员 ∈ 合法集（`satisfies Record<Exclude<…,'TextBox'>, true>`
    编译期穷举 → 联合若误写回 'RoundedRectangle'，tsc 直接失败）；
  - (b) 6 版式 `buildLayout` 全部产出的非-TextBox shapeType ∈ 合法集（且确认真跑到 RoundRectangle/Rectangle/Ellipse 几何分支）；
  - (c) `add_shape` 工具 enum 每个非-TextBox 值 ∈ 合法集。
- `operationLog.integration.test.ts`：`addGeometricShape` mock 镜像真机——非法 GeometricShapeType
  **抛 "invalid argument"**（不再放假绿）；返回 `type:'GeometricShape'` 贴近真机。
- `PptAdapter.test.ts`：`applySlideLayout` 动态守门——合法 `RoundRectangle` 成功且不清理；非法
  `RoundedRectangle` 抛 HostApiError 且孤儿页被删 1 次（同时验证 mock 拦截 + 事务性清理）。

**teeth 验证**：临时把 `add_shape` enum 注入回 `'RoundedRectangle'` → 守门 (c) RED
（`expected [ 'RoundedRectangle' ] to deeply equal []`）；`git checkout` 还原。守门确有牙齿。

## 验证
- `npx tsc --noEmit`：✅ 0 errors
- 全套 `vitest run`：**1004 passed / 0 failed**（baseline 999 + 新增 5 用例）
- undo gate `operationLog.integration.test.ts`：✅ 39 passed / 0 failed（reverse 契约不变）
- bundle：`npm run build` 后 `npm run size` → main **80.86 KB gzip < 82 KB**（~1.14KB 余量，~0 delta）

## 诚实边界
**无法跑 Office for Web。** 自动化测试全绿、根因已在代码层修正 + 结构守门已加，但真机 `ok=false`
**只能由用户在 Office for Web PowerPoint 重测 ① 确认**。本任务不声称真机已验证。

## 额外发现（report ⑤）
`add_shape` 工具 schema enum 含**两个**非法 GeometricShapeType：`'RoundedRectangle'` 与裸
`'Arrow'`。二者 AI 可达——若 AI 选中会触发与 KPI 完全相同的真机 ok=false。已一并修正
（→ `'RoundRectangle'` / `'RightArrow'`）并纳入守门 (c)。

## 风险
- `add_shape` enum 把 `'Arrow'` 改成 `'RightArrow'` 略微改变 AI 可见选项语义（裸 Arrow 本就非法、不可用）；影响仅是 AI 现在拿到一个合法的右箭头选项。
- 真机上 `addGeometricShape` 是在「调用时」还是「下一次 sync」抛错未在浏览器实证；无论哪种，孤儿页清理逻辑都覆盖（指纹在抛错前的 sync 3 已捕获）。
