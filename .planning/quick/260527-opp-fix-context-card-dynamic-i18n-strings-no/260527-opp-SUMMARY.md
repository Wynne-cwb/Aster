---
quick_id: 260527-opp
slug: fix-context-card-dynamic-i18n-strings-no
date: 2026-05-27
status: complete
commit: e8edc67
---

# Quick Task 260527-opp — Summary

Fix: context card rendered blank when a slide/range/text was selected instead of
showing 第 N 张 slide / 选中区域 {addr} / 选中 N 字. Surfaced in Phase 1 UAT Test 3.

## Root cause
`formatSelection` received `t` as a bare function parameter and called
``t`第 ${n} 张 slide` ``, bypassing the Lingui macro. `lingui extract` only scans
macro call sites, so the 3 interpolated selection messages were never extracted
into the catalog; at runtime they resolved to empty. The unit test used an
identity-mock `t`, so the CR-01 regression test stayed green while masking the
integration bug (the blind spot).

## What changed
- `src/components/formatSelection.ts`: uses `msg` (@lingui/core/macro) + `i18n._()`; signature now takes `i18n: I18n`.
- `src/components/ContextCard.tsx`: passes `i18n` (from `useLingui`) instead of bare `t`.
- `src/i18n/locales/zh-CN/messages.po` + `messages.ts`: re-extracted/compiled — catalog 8 → 11 (adds 第 {0} 张 slide / 选中区域 {0} / 选中 {0} 字).
- `src/components/formatSelection.test.ts`: rewritten as a catalog-resolution guard
  (`generateMessageId` + real i18n against the compiled catalog). Closes the
  identity-mock blind spot — fails if a dynamic message is missing from the catalog.

## Why catalog-level test (not calling formatSelection)
vitest doesn't transform the `msg` macro in a pure `.ts` file (@vitejs/plugin-react
skips non-JSX .ts; the @lingui/vite-plugin macro transform that build relies on
doesn't run the same way under vitest). Production build DOES transform it —
verified: dist embeds the compiled catalog `"5wUQvW":["第 ",["0"]," 张 slide"]` etc.
with no residual macro runtime call. So the test validates the real failure mode
(missing/!resolvable catalog entry) without depending on the macro transform.

## Verification
- 64/64 tests pass.
- `npm run build` succeeds; dist catalog contains the 3 dynamic messages.
- Pending: in-Office re-verification (Phase 1 UAT Test 3) after Pages redeploy —
  select slides, confirm context card shows 第 N 张 slide with correct index.
