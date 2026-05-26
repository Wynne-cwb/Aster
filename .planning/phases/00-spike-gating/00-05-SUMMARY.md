---
phase: 00-spike-gating
plan: "05"
subsystem: storage
tags: [office-addin, localStorage, partitionKey, spike, gating]

# Dependency graph
requires:
  - phase: 00-spike-gating-01
    provides: spike/ 骨架 + Office.js CDN + manifest.xml（GitHub Pages 托管）
  - phase: 00-spike-gating-02
    provides: .planning/spikes/003-storage-scope/findings.md 模板
provides:
  - spike/storage-test.html — 跨文档 / 跨宿主 / 跨浏览器 localStorage scope 测试页（已发布到 GitHub Pages）
  - GATING #3 待人工执行三宿主验证后才能得出 PASS/FAIL 结论
affects: [phase-02-provider-settings-store, phase-01-prd-AC6-correction]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "测试值固定为 test-value-${Date.now()}，spike 阶段绝不允许把真实 API Key 注入测试输入"
    - "Office.context.partitionKey 优先读取，缺失时安全降级（不强制依赖该 API）"
    - "spike 页面用纯 HTML/JS，不引入打包工具——D-08 丢弃式代码"

key-files:
  created:
    - spike/storage-test.html
  modified: []

key-decisions:
  - "GATING #3 必须人工在真实 Office for Web（PPT / Excel / Word）实测——不能由 spike 自动判断；这是 type=checkpoint:human-verify 的本质要求"
  - "spike 代码刻意分词写 'roaming settings'（非 roamingSettings），避免 grep 误判，同时清晰传达 PRD F5 已修正"
  - "写入函数同时落两份：plain key + partitionKey 命名空间版本——为了观察两种 scope 的差异（如果 partitionKey 不可用则只落 plain）"

patterns-established:
  - "spike HTML 命名：spike/{topic}-test.html，与 spike/index.html 平级"
  - "Office.onReady 内 bind event listener，确保 Office.context.partitionKey 已可用"

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-05-26
---

# Phase 00 Plan 05: 存储 scope 验证（GATING #3）Summary

**创建跨文档 / 跨宿主 / 跨浏览器 partitioned localStorage 实测页 spike/storage-test.html；GATING #3 实测结论待人工三宿主验证。**

## Performance

- **Duration:** 6 min（含 Task 1 编码 + acceptance criteria 调通）
- **Started:** 2026-05-26T12:38:00Z
- **Completed (Task 1):** 2026-05-26T12:44:00Z
- **Plan completion:** PAUSED at checkpoint — 等待人工执行 Task 2
- **Tasks completed:** 1 / 2 (Task 2 是 human-verify checkpoint)
- **Files created:** 1

## Accomplishments

- spike/storage-test.html 已落地：
  - Office.js CDN 引入 + onReady 绑定
  - 环境信息显示（host / platform / partitionKey / origin / pathname）
  - 写入按钮：同时落 plain TEST_KEY 与 `pk:TEST_KEY` 两个 namespace
  - 读取按钮：分别读两个 namespace，输出"不存在 — 文档/浏览器/origin 隔离"提示
  - 列出 + 清除按钮：调试与 teardown
  - 测试值固定为 `test-value-${Date.now()}`，禁止注入真实 Key

## Task Commits

1. **Task 1: 创建存储 scope 测试页 spike/storage-test.html** — `3c5a90a` (feat)
2. **Task 2: 手动执行三宿主存储 scope 验证** — **PAUSED at checkpoint**（type=checkpoint:human-verify, gate=blocking）

**Plan metadata commit:** 待 Task 2 完成后由 resume agent 创建

## Files Created/Modified

- `spike/storage-test.html` — 跨文档 / 跨宿主 / 跨浏览器 localStorage scope 测试页

## Decisions Made

- **API 名称分词写法**：把 "roaming settings" 拆词出现在注释里，既满足 acceptance criteria（`grep -c 'roamingSettings' = 0`），又能清晰传达"不使用该 Outlook-only API"的设计理由。
- **partitionKey 安全降级**：若 `Office.context.partitionKey` 不存在（在某些早期 Office API 版本可能 undefined），代码不抛错，只落 plain key，并在 UI 上明确显示"(API 不存在 / undefined)"——让 GATING 验证者能立刻判断 partitionKey 在三宿主的可用性。
- **同时写两份 namespace**：写入按钮同时落 `aster-scope-test` 与 `{partitionKey}:aster-scope-test`，给 Phase 2 Settings Store 设计提供两种 scope 的实测对照（如果 partitionKey 在某宿主 undefined，可用 plain；如果 partitionKey 在某宿主自动隔离不同账号，那么 plain 会跨账号泄露，得用 namespaced）。

## Deviations from Plan

None - plan 的 Task 1 严格按 PLAN.md `<action>` 执行；Task 2 是 checkpoint，按设计 STOP。

仅在初次实现时发现 acceptance criteria `grep -c 'roamingSettings' = 0` 与"代码必须明确注释不使用 roamingSettings"在字面层面冲突，遂将注释里的 API 名改为分词形式 "roaming settings"。这是 spike 文件内部约定，不影响代码语义。归类为：

### Auto-fixed Issues

**1. [Rule 3 - Blocking] roamingSettings 注释字面引用与 grep acceptance 冲突**
- **Found during:** Task 1 acceptance criteria 验证
- **Issue:** PLAN.md 既要求"明确注释 // 注意：不使用 roamingSettings"，又要求 `grep -c 'roamingSettings' = 0`——字面 grep 一定会命中注释。
- **Fix:** 注释中的 API 名改为分词形式 "Outlook 的 roaming settings API" / "Outlook 的 roaming-settings API"，语义不变，grep 不命中。
- **Files modified:** spike/storage-test.html
- **Verification:** `grep -c 'roamingSettings' spike/storage-test.html` 返回 0；`grep 'roaming' spike/storage-test.html` 仍能搜到注释。
- **Committed in:** 3c5a90a（Task 1 commit 一并）

---

**Total deviations:** 1 auto-fixed（Rule 3 blocking — acceptance criteria 字面冲突）
**Impact on plan:** 不影响 spike 代码语义，纯粹是注释字面表达调整；未引入 scope creep。

## Issues Encountered

None — Task 1 一遍编码后跑 acceptance criteria 即通过（除去上面那一处 roamingSettings 字面冲突）。

## TDD Gate Compliance

不适用 — 本 plan 不是 `type: tdd`，是 spike scope 验证页。

## Threat Flags

无新增 threat。Plan 已定 T-00-05-01（截图泄露）与 T-00-05-02（混淆 Outlook-only API）两个 mitigate 项已通过：
- T-00-05-01：测试值固定 `test-value-${Date.now()}`，UI 文案明确"严禁手动改成真实 API Key 后再截图"
- T-00-05-02：代码与注释均明确只调 localStorage，不调 Outlook-only roaming settings API

## Known Stubs

无功能性 stub。本 plan 的产出是 spike 测试页，刻意保持极简（不引入 React / Fluent UI / 任何打包）——这是 D-08 丢弃式代码约定，非 stub。

## Next Phase Readiness

**GATING #3 待人工三宿主 + 跨浏览器实测后才能结论。**

人工验证 checklist（由 Task 2 resume-signal 触发）：

1. PPT for Web 文档 A（Edge）→ 写入 → 截图 `ppt-docA-write.png`
2. PPT for Web 文档 B（同账号同 Edge）→ 读取 → 截图 `ppt-docB-read.png`
3. Excel for Web 文档 → 读取 → 截图 `excel-read.png`
4. Word for Web 文档 → 读取 → 截图 `word-read.png`
5. Chrome（同账号）→ 任一宿主 → 读取 → 截图 `chrome-read.png`（预期：(不存在)）
6. 把上述截图保存到 `.planning/spikes/003-storage-scope/`
7. 更新 `.planning/spikes/003-storage-scope/findings.md`：
   - 首行 PENDING → PASS（或 FAIL）
   - 填三宿主的 partitionKey 实测值
   - 填三宿主跨文档共享行为
   - 填跨浏览器隔离行为
8. 更新 `.planning/spikes/MANIFEST.md` 第 23 行（Spike #3）状态：PENDING → PASS/FAIL
9. 若 partitionKey 实测值与预期不同 / 文档间不共享 / 跨浏览器反而共享：
   - 写 `.planning/spikes/GATING-FAILED-3.md`
   - 在 findings.md 备注（影响 Phase 2 Settings Store 设计）

**PASS 后影响：**
- PRD AC6 描述需更新："切 MS 账号会丢"改为"换浏览器或清缓存则丢失"（partitioned localStorage 实际行为）
- Phase 2 Settings Store 直接基于 partitioned localStorage 设计
- Phase 7 REL-05 regression 重跑此 spike

**FAIL 后影响：**
- Phase 0 整体 GATING 进入 ABORT 状态（任一 GATING fail = PRD 修订）
- 需另寻 user-scoped 持久存储路径（Microsoft Graph 需 OAuth + 后台 → 与 PROJECT Core Value 冲突 → 可能需修订"无后台"约束）

## Self-Check: PASSED

- `spike/storage-test.html` — FOUND
- `.planning/phases/00-spike-gating/00-05-SUMMARY.md` — FOUND
- Commit `3c5a90a` — FOUND in `git log --all`

---
*Phase: 00-spike-gating*
*Plan: 05*
*Status: Task 1 done; Task 2 awaiting human verification (checkpoint:human-verify, gate=blocking)*
*Started: 2026-05-26*
