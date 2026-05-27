---
phase: 01-foundation
plan: "03"
subsystem: adapters
tags: [office-js, adapter-pattern, powerpoint, excel, word, vitest, tdd]
dependency_graph:
  requires: ["01-02"]
  provides: ["PptAdapter", "ExcelAdapter", "WordAdapter", "createAdapter factory"]
  affects: ["01-05 (main.tsx host routing)", "01-06 (React context provider)"]
tech_stack:
  added: []
  patterns:
    - "DocumentAdapter interface implementation (implements pattern)"
    - "host→adapter factory (switch on Office.HostType)"
    - "Office.js Common API addHandlerAsync for cross-host events"
    - "try/catch wrapping Office.js calls as HostApiError"
    - "kind: 'none' empty-state discriminated union branch (D-16)"
    - "TDD RED→GREEN with Vitest"
key_files:
  created:
    - src/adapters/PptAdapter.ts
    - src/adapters/ExcelAdapter.ts
    - src/adapters/WordAdapter.ts
    - src/adapters/index.ts
    - src/adapters/adapters.test.ts
  modified:
    - vitest.config.ts
decisions:
  - "WordAdapter onSelectionChanged 使用 Office.context.document.addHandlerAsync (Common API) 而非 Word.run ctx.document.onSelectionChanged — @types/office-js 类型定义中 Word.Document 无 onSelectionChanged 成员"
  - "ExcelAdapter onSelectionChanged handler 签名改为 async () => void 以满足 Excel onSelectionChanged.add() 的 Promise 返回类型约束"
  - "adapters.test.ts 中 'Outlook' as unknown as Office.HostType 双重转换——绕过严格模式类型重叠检查，测试 default 分支行为"
  - "jsdom 已由 Wave 1 npm install 安装到主仓库 node_modules，worktree 通过 node resolution 使用；worktree 分支的 package.json 未被修改"
metrics:
  duration: "~15 min"
  completed: "2026-05-27"
  tasks_completed: 3
  files_created: 5
  files_modified: 1
---

# Phase 01 Plan 03: Three-Host Adapter Skeletons Summary

**一句话结果：** 三宿主 Office.js adapter（PptAdapter/ExcelAdapter/WordAdapter）实现 DocumentAdapter 接口，getSelection/onSelectionChanged 真实调用宿主 API，insert 桩抛 UnsupportedOperationError，工厂 createAdapter 按 Office.HostType 分流，Vitest jsdom 环境就位，10 个 smoke test 全绿（57 个总测试通过）。

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | 三宿主 adapter 骨架 (TDD RED→GREEN) | 71f794f | PptAdapter.ts, ExcelAdapter.ts, WordAdapter.ts, adapters.test.ts |
| 2 | host→adapter 工厂 | f0bb68f | src/adapters/index.ts |
| 3 | vitest.config.ts 更新 + smoke test | e81000b | vitest.config.ts |

## Verification Results

```
npx tsc --noEmit   → 0 errors
npm run test       → 57 passed (3 test files)
```

所有 acceptance criteria grep 验证通过：
- `implements DocumentAdapter` × 3
- `PowerPoint.run`, `DocumentSelectionChanged`, `getSelectedSlides` in PptAdapter
- `Excel.run`, `getSelectedRange`, `onSelectionChanged` in ExcelAdapter
- `Word.run`, `getSelection`, `onSelectionChanged` in WordAdapter
- `kind: 'none'` × 3（D-16 空态分支）
- `UnsupportedOperationError` + `HostApiError` × 3
- `#5022` 注释 in PptAdapter
- `export function createAdapter` in index.ts
- `environment: 'jsdom'` in vitest.config.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WordAdapter onSelectionChanged 类型不兼容**
- **Found during:** tsc 验证 Task 1
- **Issue:** `@types/office-js` 中 `Word.Document` 没有 `onSelectionChanged` 成员，且 `Word.SelectionChangedEventArgs` 不存在
- **Fix:** 改用 `Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged)` (Common API)，与 PptAdapter 保持一致，功能等效
- **Files modified:** src/adapters/WordAdapter.ts

**2. [Rule 1 - Bug] ExcelAdapter onSelectionChanged handler 类型**
- **Found during:** tsc 验证 Task 1
- **Issue:** `worksheet.onSelectionChanged.add()` 要求 handler 返回 `Promise<any>`，但原始写法 `() => void` 不符合
- **Fix:** 改为 `async () => { callback(); }` 满足签名
- **Files modified:** src/adapters/ExcelAdapter.ts

**3. [Rule 1 - Bug] adapters.test.ts 类型转换**
- **Found during:** tsc 验证 Task 3
- **Issue:** `'Outlook' as Office.HostType` — string 与 HostType 无足够重叠，strict 模式拒绝
- **Fix:** 改为 `'Outlook' as unknown as Office.HostType`（双重转换，测试意图明确）
- **Files modified:** src/adapters/adapters.test.ts

**4. [Rule 3 - 阻塞] jsdom 未预装**
- **Found during:** Task 3 执行 npm run test
- **Issue:** vitest 切换到 jsdom 环境后报 `Cannot find package 'jsdom'`
- **Fix:** 在主仓库执行 `npm install --save-dev jsdom @types/jsdom`（jsdom 为 vitest environment 必需依赖）
- **Note:** jsdom 安装到主仓库 node_modules，主仓库 package.json 的修改在 git restore 后被撤回（worktree 分支 package.json 未变更）。orchestrator 在合并时需要将 jsdom + @types/jsdom 添加到主线 package.json。

## Known Stubs

| File | Method | Reason |
|------|--------|--------|
| src/adapters/PptAdapter.ts | `insert()` | Phase 4 实现 PPT 写回 |
| src/adapters/ExcelAdapter.ts | `insert()` | Phase 5 实现 Excel 写回 |
| src/adapters/WordAdapter.ts | `insert()` | Phase 6 实现 Word 写回 |

这些 stub 是计划的预期行为（Phase 1 只读，写回在后续 Phase），不影响本 plan 目标（getSelection/onSelectionChanged 真实实现）。

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information_disclosure | src/adapters/WordAdapter.ts | getSelection() 读取 selection.text 计算长度后丢弃，不留存文本正文（符合 T-01-06 mitigation：仅读元数据） |

T-01-06 mitigation 已在实现中满足：WordAdapter 仅保留 `text.length` 作为 charCount，不存储 text 字符串。

## Self-Check: PASSED

Created files:
- src/adapters/PptAdapter.ts: FOUND
- src/adapters/ExcelAdapter.ts: FOUND
- src/adapters/WordAdapter.ts: FOUND
- src/adapters/index.ts: FOUND
- src/adapters/adapters.test.ts: FOUND
- vitest.config.ts: FOUND (modified)

Commits:
- 71f794f: FOUND
- f0bb68f: FOUND
- e81000b: FOUND
