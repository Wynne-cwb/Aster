---
quick_id: 260527-o8j
slug: fix-empty-lingui-zh-cn-catalog-so-task-p
date: 2026-05-27
status: complete
commit: b02773f
---

# Quick Task 260527-o8j — Summary

## What changed
- `package.json`: `compile` → `lingui compile --typescript`; `build` → `lingui compile --typescript && vite build`.
- `src/i18n/locales/zh-CN/messages.ts`: regenerated from `.po` as the real typed compiled catalog (was an empty placeholder).
- `src/i18n/locales/zh-CN/messages.po`: now committed (CI/Pages compile input).
- Removed stray `src/i18n/locales/zh-CN/messages.mjs`.

## Outcome
- Root cause: bare import resolved to an empty `messages.ts` placeholder while the
  real catalog was in `messages.mjs`; build never compiled. Fixed by compiling to
  `.ts` and wiring compile into build.
- Verified locally: `dist` bundle contains all 5 visible zh-CN strings; 65/65 tests pass.
- Commit: b02773f (code). Docs commit follows.

## Follow-up (not in this task)
- Push to main → GitHub Pages redeploys (user-authorized for this repo).
- Re-run Phase 1 human UAT Test 1 + Test 3 in Office (clean browser / Edge) to
  confirm the Chinese renders end-to-end. Test 1 currently logged as `issue` in
  01-HUMAN-UAT.md — flip to pass after on-screen confirmation.
