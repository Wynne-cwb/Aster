---
phase: 07-uat-sideload-release-prep
plan: "03"
subsystem: docs
tags: [readme, roadmap, documentation, cleanup]

requires:
  - phase: 07-01
    provides: probeToolCallSupport, agentStore guard

provides:
  - README.md rewritten as agent positioning, 4 killer scenarios, accurate bundle, Chrome-only
  - ROADMAP.md verified clean (¥=0, Edge+Chrome=0, gpt-4o=0)

affects: []

tech-stack:
  added: []
  patterns: []

key-files:
  modified:
    - README.md
    - src/i18n/locales/zh-CN/messages.po

key-decisions:
  - "Bundle size written as ~73.3 KB (from real npm run build && npm run size)"
  - "ROADMAP.md verify-only: all 7 corrections already applied during planning phase"
  - "i18n messages.po updated (Rule 2): new ProviderForm strings needed extraction"

requirements-completed:
  - NFR-01
  - NFR-04
  - NFR-05

duration: 8min
completed: 2026-05-30
---

# Phase 07 Plan 03: README 重写 + ROADMAP 清理 Summary

**README 从 113 行过时初稿完整重写为代理定位版（4 killer scenario + BYO Key + N5 隐私 + Chrome-only + 73.3 KB 实测值）**

## Performance

- **Duration:** ~8 min
- **Completed:** 2026-05-30
- **Tasks:** 2
- **Files modified:** 2 (README.md + messages.po)

## Accomplishments

- Task 1 (ROADMAP): verify-only — 所有 7 处修正（¥、Edge+Chrome、gpt-4o）已在规划阶段应用，grep 全 0
- Task 2 (README): 完整重写，新增：
  - Agent 定位 hero（Office 智能代理）
  - Aster 怎么工作（心智锚定 5 步流程）
  - 4 个核心场景（PPT/Excel/Word/Shape 精细化）
  - BYO Key / 无后台说明
  - Sideload 步骤（Chrome only，5 步）
  - 技术架构表（自写 CSS teal 克制，73.3 KB 实测）
  - 诚实产品口径（作者自用+开源，早期阶段）
  - N5 隐私告知（「选中内容会发往 Provider」）
  - 开发命令（npm ci/dev/build/test/size）
- 删除：draft banner、幻影引用 REL-01/REL-03/REL-04/NFR-06、Fluent UI v9、138 KB、Edge 字样

## Task Commits

1. **Task 1 (ROADMAP verify) + Task 2 (README rewrite)** - `efd08a2` (docs)
2. **i18n messages.po update (Rule 2 deviation)** - `980adff` (chore)

## Files Modified

- `README.md` — 完整重写（113 行旧稿 → 新代理定位版）
- `src/i18n/locales/zh-CN/messages.po` — 新增 ProviderForm 测试按钮字符串后 extract 更新

## Decisions Made

- 使用 `npm run build && npm run size` 实测值 73.3 KB（README 中 build 产物为 73.51 KB，文档写 ~73.3 KB）
- ROADMAP 全部修正已在规划阶段完成，本 Plan Task 1 仅确认正确性

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] i18n messages.po 需要 extract 更新**

- **Found during:** Wave-end gate (npm test)
- **Issue:** Plan 07-02 新增的 ProviderForm Trans 字符串（测试 tool calling / 保存后可测试 / ✓ 支持 / ✗ 不支持）和 ProviderList 字符串（✓ tool call）未在 messages.po 中记录，导致 i18n/coverage.test.ts 运行 lingui extract 后检测到 git diff
- **Fix:** 运行 `./node_modules/.bin/lingui extract` 生成更新，提交 messages.po（66 insertions, 40 deletions — 含行号更新）
- **Files modified:** src/i18n/locales/zh-CN/messages.po
- **Commit:** 980adff

**Total deviations:** 1 auto-fixed

## README Verification Results

| Check | Value | Pass? |
|-------|-------|-------|
| No phantom refs (Fluent/138KB/REL-01/REL-03/REL-04/NFR-06/gpt-4o) | 0 | ✓ |
| No Edge mentions | 0 | ✓ |
| Positive content (killer scenarios / BYO Key / privacy) | 5 | ✓ ≥4 |
| Sideload steps complete | 4 | ✓ ≥2 |
| Chrome mentions | 2 | ✓ ≥1 |
| N5 privacy notice | 1 | ✓ |

## ROADMAP Verification Results

| Check | Value | Pass? |
|-------|-------|-------|
| `grep -c "¥"` | 0 | ✓ |
| `grep -c "Edge + Chrome"` | 0 | ✓ |
| `grep -c "gpt-4o"` | 0 | ✓ |
| `grep -c "gpt-5.1"` | 3 | ✓ ≥1 |

## Wave-End Gate Results

- **npm test:** 49/49 test files pass, 599/599 tests green
- **npm run build && npm run size:** 73.39 KB gzip ≤ 82 KB ✓
- **npm run typecheck (tsc --noEmit):** clean (no output)

## Self-Check

- [x] README.md exists and has correct content ✓
- [x] Commit efd08a2 (docs) exists ✓
- [x] Commit 980adff (chore messages.po) exists ✓
- [x] `grep -Ec "Fluent UI|138 KB|REL-01|REL-03|REL-04|NFR-06|gpt-4o" README.md` = 0 ✓
- [x] `grep -c "Edge" README.md` = 0 ✓
- [x] `grep -c "选中内容会发往" README.md` = 1 ✓

## Self-Check: PASSED
