---
phase: 01-foundation
plan: "06"
subsystem: ci-infra
tags: [ci, bundle-size, github-pages, readme, size-limit]
dependency_graph:
  requires: [01-01, 01-04, 01-05]
  provides: [bundle-size-guard, pages-deploy, sideload-docs]
  affects: [all future plans — bundle guard enforces 1 MB cap on every PR]
tech_stack:
  added:
    - "size-limit@11 + @size-limit/preset-app — bundle gate config (.size-limit.json)"
    - "GitHub Actions ci.yml — PR-triggered build + size-limit enforcement"
    - "GitHub Pages pages.yml — dist/ production deploy (was spike/)"
  patterns:
    - "public/assets/ for static icons — Vite copies to dist/assets/ preserving URL path"
key_files:
  created:
    - .size-limit.json
    - .github/workflows/ci.yml
    - README.md
    - public/assets/icon-16.png
    - public/assets/icon-32.png
    - public/assets/icon-80.png
  modified:
    - .github/workflows/pages.yml
decisions:
  - "Icons in public/assets/ (not src/assets/): Vite copies public/ verbatim to dist/ — URL path /Aster/assets/icon-*.png matches manifest.xml references without any import."
  - "GitHub Pages Cache-Control constraint accepted: per-file header customization is unsupported by GH Pages; default ~10 min cache satisfies INSTALL-05 (icons reachable, sideload does not break)."
  - "spike/ not deployed to Pages: only dist/ is served; spike/ preserved in repo for Phase 7 REL-05 regression reference (D-04)."
metrics:
  duration: "4m 16s"
  completed: "2026-05-27T08:03:00Z"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 7
---

# Phase 01 Plan 06: CI Size Guard + GitHub Pages Deploy Summary

**One-liner:** PR-enforced 1 MB bundle guard (size-limit) + production GitHub Pages deploy (dist/) + README sideload guide for Chinese Office for Web users.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | .size-limit.json + ci.yml (size 守卫 job) | 374fd2d | `.size-limit.json`, `.github/workflows/ci.yml` |
| 2 | 改造 pages.yml 部署 dist/ (保留 spike) | 68c6bb5 | `.github/workflows/pages.yml`, `public/assets/icon-{16,32,80}.png` |
| 3 | README sideload 草稿 + 无后台/隐私说明 | 8fa2d1f | `README.md` |

## What Was Built

### Task 1: Bundle Size Guard

- `.size-limit.json` configures size-limit to check `dist/assets/*.js` gzip sum against 1 MB limit
- `.github/workflows/ci.yml` runs on every `pull_request` and `push` to main — executes `npm ci` → `npm run build` → `npm run size`
- size-limit exits non-zero when the limit is exceeded, causing the CI job to fail and marking the PR red (AC4: guard is enforced, not just configured)
- Baseline validated locally: 138.65 KB gzip (13.9% of 1 MB budget)

### Task 2: GitHub Pages Production Deploy

- `.github/workflows/pages.yml` reworked from "Deploy Spike" to "Deploy Aster"
- Now builds `dist/` via `npm ci + npm run build` before uploading (was uploading `spike/` directory directly)
- `upload-pages-artifact` path changed from `spike` to `dist`
- `public/assets/icon-{16,32,80}.png` added — Vite copies `public/` to `dist/` verbatim, so `dist/assets/icon-*.png` exist and satisfy manifest.xml URL references (`https://wynne-cwb.github.io/Aster/assets/icon-*.png`)
- `spike/` directory preserved in repo (D-04, Phase 7 REL-05 regression reference)
- Permissions retained: `pages: write` + `id-token: write`

### Task 3: README

- Core Value statement (from CLAUDE.md) in opening paragraph
- No-backend / BYO Key section: API Key never leaves the browser, no Aster server receives it
- Sideload steps based on spike #010 findings: free personal Microsoft account path (开始 → 加载项 → 更多设置 → 上传我的加载项)
- Compatibility table: Edge/Chrome >= 120, PPT/Excel/Word for Web (NFR-06)
- Draft status explicitly noted; full docs (video, privacy policy) deferred to Phase 7 REL-01/REL-03

## Deviations from Plan

### Auto-added: public/assets/ for icons

**Rule 2 - Missing critical functionality**

- **Found during:** Task 2
- **Issue:** `dist/assets/icon-*.png` did not exist after `npm run build` — icons were only in `spike/assets/`. `manifest.xml` references `https://wynne-cwb.github.io/Aster/assets/icon-*.png`, so missing icons would cause manifest icon 404 in production (INSTALL-05 breach).
- **Fix:** Copied icons from `spike/assets/` to `public/assets/`. Vite copies `public/` verbatim to `dist/` during build, placing icons at `dist/assets/icon-*.png` which maps to the correct GitHub Pages URL.
- **Files modified:** `public/assets/icon-16.png`, `public/assets/icon-32.png`, `public/assets/icon-80.png`
- **Commit:** 68c6bb5

## Known Stubs

None — this plan creates config and documentation files only. No UI components, data sources, or runtime logic involved.

## Threat Flags

No new threat surface introduced. All mitigations from the plan's threat model are applied:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-01-15: CI supply chain | `npm ci` (deterministic, locks package-lock.json); `permissions: contents: read` (size-guard, minimal) |
| T-01-16: dist/ public exposure | No API keys or secrets in build output; README explicitly states "Key never uploaded to Aster server" |
| T-01-17: pages.yml privilege escalation | deploy job has `pages: write` + `id-token: write` only; no `contents: write` |
| T-01-18: sideload manifest source | Accepted — users download from GitHub repo over HTTPS |

## Self-Check: PASSED

All created files exist on disk. All 3 task commits verified in git log.

| Check | Result |
|-------|--------|
| `.size-limit.json` exists | FOUND |
| `.github/workflows/ci.yml` exists | FOUND |
| `.github/workflows/pages.yml` updated | FOUND |
| `README.md` exists | FOUND |
| `public/assets/icon-16.png` exists | FOUND |
| `public/assets/icon-32.png` exists | FOUND |
| `public/assets/icon-80.png` exists | FOUND |
| Commit 374fd2d (Task 1) | FOUND |
| Commit 68c6bb5 (Task 2) | FOUND |
| Commit 8fa2d1f (Task 3) | FOUND |
