---
phase: 23-apply-slide-layout-prompt-rewrite
plan: 02
subsystem: ppt-agent-prompt
tags: [system-prompt, powerpoint, prompt-engineering, anti-hallucination]

requires:
  - phase: 23-apply-slide-layout-prompt-rewrite (plan 01)
    provides: apply_slide_layout 工具 + image_slots + layout_check + check_slide_layout（机制就位，prompt 描述对齐）
provides:
  - "getDomainSegment('ppt') 重写：删冗余机制规则（坐标推算重叠 #6 / 宪法式自查清单 #8）、保 CTX-06 抗幻觉、修 stale 图片边界、加判断级指引 + 配色 + 硬底线"
  - "system-prompt.test PVQ-05 守门（提及工具 / 保抗幻觉 / 删两冗余 / 修 stale 图片 / 保精确标准）"
affects: [v2.3-uat]

tech-stack:
  added: []
  patterns:
    - "机制就位后下沉冗余 prompt 规则：apply_slide_layout（固化坐标）+ check_slide_layout（几何自查）保证排版正确 → prompt 不再教模型脑补坐标/机械自查，聚焦判断（选版式/填内容/洞察标题/配色意图）+ 硬底线"

key-files:
  modified:
    - src/agent/system-prompt.ts
    - src/agent/system-prompt.test.ts

key-decisions:
  - "删 #6/#8 冗余机制规则；保 #10 CTX-06 抗幻觉仅 renumber；修 stale #9（图片现可用 + autonomous-insert）；精确判断标准（标题/容量/左对齐/工具定位）保留未弱化（precision_over_brevity）"
  - "PVQ-05 守门用 buildSystemPrompt('ppt') scoped 取串 → '宪法式自查' 负向断言不波及 word #7（OUT OF SCOPE）"

patterns-established:
  - "PPT 段 prompt 守门：scoped buildSystemPrompt('ppt')，避免 file-wide grep 误伤 word 段同名标签"

requirements-completed: [PVQ-05]

duration: ~10min
completed: 2026-06-03
---

# Phase 23 (Plan 02): PVQ-05 PPT 段 system prompt 重写 Summary

**机制就位（apply_slide_layout + check_slide_layout）后，把「教模型机械摆坐标 / 宪法式自查清单」的冗余规则从 PPT 领域段下沉移除，保留 CTX-06 抗幻觉与全部精确判断标准，修复 stale 图片边界，新增判断级指引（盖印章建页 / 选版式 / 配色按客户意图 / 故事线 / 洞察标题）+ 硬底线（可编辑优先 / 收到版面自查反馈就改 / 诚实边界）。**

## Performance
- **Duration:** ~10 min
- **Tasks:** 3（全部 auto）
- **Files modified:** 2

## Accomplishments
- `getDomainSegment('ppt')` 重写：删 #6（坐标推算重叠）+ #8（宪法式自查清单）；保 #10（CTX-06「旧读数早已过时」，renumber）；修 stale #9（图片现已可用 generate_ppt_image/search_and_insert_stock_image + 图文左右 image_slots autonomous-insert，删「即将开放/v2.1 暂不可用」）；加 #2 盖印章建页 + #6 配色由你定（accent_color hex）+ #9 硬底线。精确判断标准（断言式≤15字标题 / 每页≤5要点 / 左对齐禁居中 / 故事线金字塔 / get_shape+selection_detail 定位）保留未弱化。
- `system-prompt.test.ts` PVQ-05 守门：5 条（提及 apply_slide_layout / 保「旧读数早已过时」/ 删「推算空间位置」+「宪法式自查」负向 scoped / 修 stale 图片 / 保「断言式」+「左对齐」）。
- 现有绿测全保（L59-65 set_shape_text+list_shapes_on_slide / L115-117 /自查/ / CTX-01 / CTX-06 / word #7 宪法式自查未动）。

## Task Commits
1. **Task 1: 重写 getDomainSegment('ppt')（PVQ-05）** - `39b97de` (feat)
2. **Task 2: system-prompt.test PVQ-05 守门** - `12aa004` (test)
3. **Task 3: 最终验证（tsc + 全套 test + build + size）** - 无代码改动（验证 only）

## Files Created/Modified
- `src/agent/system-prompt.ts` - getDomainSegment('ppt') 重写
- `src/agent/system-prompt.test.ts` - PVQ-05 守门 describe 块

## Decisions Made
None beyond plan — 按处置矩阵精确执行（删冗余机制规则、保抗幻觉与精确描述、修 stale 图片、加判断级指引）。

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None.

## Next Phase Readiness
- PVQ-05 完成；PPT prompt 聚焦判断 + 机制保证排版。
- ⚠️ 真机 A/B「模型照没照做」攒 v2.3 末 UAT（D-23-08 deferred）。
- bundle 持平（纯字符串改动，落懒加载 loop chunk；main gzip 80.6KB ≤82KB）；0 新依赖；不动 Lingui 宏无需 extract。

---
*Phase: 23-apply-slide-layout-prompt-rewrite*
*Completed: 2026-06-03*
