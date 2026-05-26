---
phase: 00-spike-gating
plan: "08"
subsystem: spike
tags: [office-js, powerpoint, api-mixing, getSelectedSlides, workaround, spike]

# Dependency graph
requires:
  - phase: 00-spike-gating
    provides: "Plan 06 GATING checkpoint cleared — PPT 写回主路径已可用，本 plan 验证 Phase 4 adapter 设计所需的两个 Office.js bug workaround"
provides:
  - "spike/api-bugs-test.html — Bug #5022 重现 + Workaround + Bug #3618 sort-by-index workaround 测试页"
  - "Phase 4 PPT adapter 设计的安全/不安全 API 混用模式实证（待 checkpoint 完成后补结论）"
affects: [phase-04-ppt, ppt-adapter, document-adapter-design]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.race + setTimeout 守护 PowerPoint.run.sync 防止页面真挂死"
    - "selectedSlides.items.slice().sort((a, b) => a.index - b.index) 作为 #3618 workaround"
    - "await new Promise(r => setTimeout(r, 0)) 微任务 drain 作为 #5022 候选 workaround（folklore 级别）"

key-files:
  created:
    - "spike/api-bugs-test.html — 两个 bug 测试页（drop-style，不进 v1）"
  modified: []

key-decisions:
  - "保留 setTimeout 微任务 drain 测试（即使 Pitfall 2 标注为 folklore，仍要实测）"
  - "Promise.race + 5s 超时守护 — 防止 Bug #5022 真触发后页面真挂死整个 Task Pane 会话"
  - "测试顺序锁定：先 #3618（无副作用）→ #5022 重现 → 关重开 → workaround，避免会话残留污染"
  - "getActiveSlideOrNullObject() 作为单 slide 取数的 #3618-无关备选方案"

patterns-established:
  - "Spike HTML 测试结构：Office.onReady → requirement set check → 按钮 disabled 控制 → setResult/appendResult 工具函数 + 类 ppt-writeback-test.html 风格的 .scene/.warn/.host-info CSS"
  - "API 混用副作用警告统一格式：测试前明示「本测试会污染会话，需关 Task Pane 重开」"

requirements-completed: []

# Metrics
duration: ~25min
completed: 2026-05-26
---

# Phase 0 Plan 08: 非 GATING #5+#6 — Office.js API bugs workaround 验证 Summary

**Office.js Bug #5022（API 混用挂死）+ Bug #3618（getSelectedSlides 反序）合并 spike：交付 spike/api-bugs-test.html，待 PPT for Web checkpoint 实测决出 workaround 是否可靠**

## Performance

- **Duration:** ~25 min（Task 1 自动化交付，Task 2 待 user checkpoint）
- **Started:** 2026-05-26T12:43:00Z
- **Completed (Task 1):** 2026-05-26T13:08:44Z
- **Tasks:** 1/2 完成（Task 2 为 checkpoint:human-verify）
- **Files modified:** 1 created

## Accomplishments

- 交付 `spike/api-bugs-test.html`（421 行）：
  - Bug #5022 测试 A：`PowerPoint.run → setSelectedDataAsync → PowerPoint.run` 重现序列，第二次 `sync()` 用 `Promise.race + 5s timeout` 守护，避免页面真锁死
  - Bug #5022 测试 B：在 `setSelectedDataAsync` 回调后插入 `await new Promise(r => setTimeout(r, 0))` 微任务 drain，验证 folklore-level workaround 是否真有效
  - Bug #3618 测试：选中多 slide → 调 `getSelectedSlides()` → 同时输出原始顺序 / `.slice().sort((a,b)=>a.index-b.index)` 后的顺序 → 自动判定原始是否已升序
  - 额外验证 `getActiveSlideOrNullObject()`（不受 #3618 影响，单 slide 备选方案）
  - PowerPointApi requirement set 检查（1.2 for PowerPoint.run，1.5 for getSelectedSlides），自动禁用不可用按钮
  - 顶部副作用警告 + 测试顺序建议（先 #3618 → #5022 重现 → 关重开 → workaround）

## Task Commits

1. **Task 1: 创建 Office.js API bugs 测试页** — `a49c472` (feat)
2. **Task 2: 手动执行两个 Bug 验证并记录结论** — ⏸ PENDING checkpoint（user 在 PPT for Web 实测后补结论 + 更新 findings.md × 2 + MANIFEST.md）

**Plan metadata commit:** _(pending — 此 SUMMARY 与最终 metadata commit 由 checkpoint 收尾后写入)_

## Files Created/Modified

- `spike/api-bugs-test.html` — Bug #5022（重现 + setTimeout workaround）+ Bug #3618（sort-by-index workaround + getActiveSlideOrNullObject 备选）合一测试页；无 API key，无 DocumentAdapter，纯 Office.js + 原生 fetch

## Decisions Made

- **Promise.race + 5s timeout 守护两次第二次 PowerPoint.run.sync**：Pitfall 2 描述 #5022 的失效模式是「context.sync() 永远不 resolve」。如果不加 timeout，重现成功 = 测试页彻底假死，user 无法看到结果也无法判断是 bug 触发还是 sync 慢。5s 阈值远超 PPT for Web 正常 sync 的 100ms 量级，能可靠区分「卡住」与「慢」
- **测试 A 与测试 B 独立按钮 + 文案强调"关 Task Pane 重开"**：bug #5022 一旦触发会污染整个 Task Pane 会话，测试 B 必须在干净会话下跑才能反映 workaround 真实效果。强制 user 关重开是最简方案，不需要测试代码自身做会话隔离
- **保留 setTimeout(0) workaround 测试**：Pitfall 2 明说此 workaround 是「folklore，不可靠」，但既然 plan 要求测，就实测——结果可能是「无效，确认 Phase 4 必须走单 API surface」或「有效但偶发，仍建议单 API surface」。两种结论都对 Phase 4 adapter 设计有价值
- **不为 #5022 加 retry/loop**：bug 是 random 触发的，单次跑一遍即可。如果 user 想多次复测，关重开重新点按钮就行，不需要测试代码自动 N 次
- **不验证「最佳实践（单 API surface）」**：Pitfall 2 推荐的真正解（Phase 4 PPT adapter 全部 `.run`）是架构决定，不是 spike 范围。在测试页文档区写明，避免 user 误以为缺测试

## Deviations from Plan

None - 严格按 plan task 1 spec 执行；HTML/CSS/JS 结构对齐既有 `spike/ppt-writeback-test.html` 风格（同色块、同 .scene 卡片、同 setResult/appendResult 工具）保持 spike 目录一致性。

## Issues Encountered

无。Task 1 一次写完即过全部 acceptance criteria：
- 文件存在 ✓
- `setSelectedDataAsync` / `Workaround` 标记 21 处（≥2 ✓）
- `getSelectedSlides` / `slide.index` / `sort` 标记 16 处（≥3 ✓）
- `Promise.race` / `timeout` 9 处（≥1 ✓）
- 无 `DocumentAdapter` / `class.*Adapter`（=0 ✓）
- `appsforoffice.microsoft.com` 1 处（≥1 ✓）
- 无 hardcoded API key/Bearer/sk-（=0 ✓）

## User Setup Required

None for Task 1 — 测试页直接通过 GitHub Pages 部署（与 spike/index.html 同源），无环境变量、无后端配置、无 npm install。

**Task 2 checkpoint 所需 user 操作（待执行）：**
1. 在 PPT for Web Task Pane 打开 `https://wynne-cwb.github.io/Aster/api-bugs-test.html`（push 后自动通过 GitHub Pages 部署）
2. **先**测 Bug #3618：多选 3 张非连续 slide → 点测试按钮 → 截图原始顺序 vs 排序后 → 保存到 `.planning/spikes/006-getselectedslides-order/`
3. **后**测 Bug #5022 测试 A：点「重现 Bug」→ 等结果（5s 超时或正常）→ 截图保存到 `.planning/spikes/005-api-mixing/`
4. **关闭 Task Pane → 重开**（隔离会话）
5. 测 Bug #5022 测试 B：点「测试 Workaround」→ 等结果 → 截图
6. 更新 `005-api-mixing/findings.md` 首行 PASS/FAIL + 实测结果
7. 更新 `006-getselectedslides-order/findings.md` 首行 PASS/FAIL + 实测结果
8. 更新 `.planning/spikes/MANIFEST.md` Spike #5 / #6 状态

## Next Phase Readiness

- **Phase 4 PPT adapter 设计**：等 Task 2 checkpoint 完成后可锁定两条结论 —
  - 若 #5022 触发 + setTimeout workaround 有效 → Phase 4 adapter 允许混 API，但每次 setSelectedDataAsync 后强制 microtask drain（lint rule 校验）
  - 若 #5022 触发 + workaround 无效 → Phase 4 adapter 强制单 API surface（`.run` 优先），仅在没有 `.run` 等价物时才用 `setSelectedDataAsync`，且后续禁用 `.run`（lint rule + 运行时 guard）
  - 若 #5022 没复现 → 仍按「单 API surface」最佳实践设计（保守），因为 Pitfall 2 标注 bug 是 random
  - #3618 sort-by-index workaround：基本可断定有效（`ppt-writeback-test.html` 场景二已经用了，Phase 4 直接复用即可）
- **本 plan 没有阻塞 Phase 1**：Phase 1 在 GATING 三项 PASS 后即可启动（已由 Plan 06 完成），#5/#6 实测结论是 Phase 4 子任务的输入，不阻塞 Phase 1/2/3

## Self-Check: PASSED

- ✓ `spike/api-bugs-test.html` 存在（18.1K，421 行）
- ✓ Commit `a49c472` 在 `git log --oneline` 中可查
- ⏸ `.planning/spikes/005-api-mixing/findings.md` 仍为 PENDING（待 checkpoint 完成后由 user / 后续 agent 更新）
- ⏸ `.planning/spikes/006-getselectedslides-order/findings.md` 仍为 PENDING（同上）
- ⏸ `.planning/spikes/MANIFEST.md` Spike #5 / #6 仍为 PENDING（同上）

---
*Phase: 00-spike-gating*
*Plan: 08*
*Completed (Task 1): 2026-05-26*
*Awaiting checkpoint: Task 2 human-verify on PPT for Web*
