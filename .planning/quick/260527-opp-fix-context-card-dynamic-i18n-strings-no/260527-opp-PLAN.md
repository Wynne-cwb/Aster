---
quick_id: 260527-opp
slug: fix-context-card-dynamic-i18n-strings-no
date: 2026-05-27
mode: quick (inline execution — fully-diagnosed fix; no planner/executor subagents)
---

# Quick Task 260527-opp: Context card dynamic i18n strings

## Problem (Phase 1 UAT Test 3)
Selecting a slide left the context card blank instead of 第 N 张 slide. Distinct
from quick task 260527-o8j (empty catalog) — here the interpolated selection
messages were never extracted into the catalog at all.

## Root cause
`formatSelection(sel, t)` used a bare `t` parameter for ``t`第 ${n} 张 slide` ``,
not the Lingui macro → `lingui extract` skipped them → catalog missing →
runtime empty. Unit test used identity-mock `t` (blind spot).

## Tasks
1. `formatSelection`: use `msg` (@lingui/core/macro) + `i18n._()`; take `i18n`.
2. `ContextCard`: pass `i18n` from `useLingui` instead of bare `t`.
3. extract + compile so the 3 dynamic messages enter the catalog.
4. Rewrite the test as a catalog-resolution guard (generateMessageId + real i18n)
   that fails if a dynamic message is missing — closes the identity-mock blind spot.

## Verify
- 64 tests pass; build embeds compiled catalog with the dynamic messages.
- After push + Pages redeploy: re-verify in Office (Test 3) — select slides, confirm
  context card shows 第 N 张 slide with the correct, non-off-by-one index (CR-01).
