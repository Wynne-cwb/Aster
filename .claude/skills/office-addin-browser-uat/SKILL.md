---
name: office-addin-browser-uat
description: >
  Aster-specific recipe for verifying the Office.js add-in inside Office for Web
  (PowerPoint / Excel / Word at *.cloud.microsoft) via a browser automation tool.
  Use when testing/verifying Aster in a real Office host: sideload verification,
  "打开 Aster" Task Pane checks, slide-number context card (CR-01), or confirming
  the github.io Pages deploy is what actually renders. Builds on the general
  `browser-driving` skill — read that first for universal rules (fresh-screenshot
  coordinates, canvas not in a11y tree, UI is not source-of-truth, cache vs bug).
  This skill only adds the Office/Aster specifics.
---

# Office Add-in Browser UAT — Aster specifics

> Prereq: read the general **`browser-driving`** skill. The universal pitfalls
> (stale click coordinates, canvas-unreadable ribbon, cached UI faking a deploy
> bug, hard-reload limits, blank-is-expected) live there. Below is only what is
> specific to Aster + Office for Web.

## What the user must do (you can't)
Be logged into M365 and have a doc open. You cannot log in for them. Once a PPT/
Excel/Word doc is open in the controlled tab, you can drive from there.

## Open-and-check recipe (PowerPoint example)
1. `resize_window` to editor size (e.g. 1440x900) **before** navigating.
2. `navigate` to the doc URL. Office shows a slow **SSO interstitial** (hidden
   auto-submitting `<form>`); wait 15-25s, screenshot-poll until the editor canvas appears.
3. Click the **「打开 Aster」** ribbon button (top-right, group label "Aster").
   Ribbon buttons by host:
   - PPT: 主题→大纲 / 选中 slide 配图
   - Excel: 自然语言→公式 / 公式解释·调修
   - Word: 多风格润色 / TL;DR
   (Ribbon is canvas → pixel-coordinate clicks only; re-screenshot before each click.)
4. `wait` ~6s (first pane load is slow); screenshot/`zoom` the right-side pane.

## Aster-specific facts
- Task Pane URL / manifest `SourceLocation`: `https://wynne-cwb.github.io/Aster/`.
- Opening that URL in a **plain tab is blank by design** — it gates on `Office.onReady()`. Only judge rendering inside an Office host.
- **Office for Web caches add-in content at Office's OWN infrastructure layer** — separate from the browser. If the pane shows the old spike build (title **「Aster Spike」** + random filler like `1HgTuA`/`bhewSJ`/`lsstWU`), that's the cache, **not** a deploy/code bug.
  - Verified powerless against it (do not waste turns retrying these): JS-clearing the github.io origin's Service Worker / Cache Storage / localStorage (the app uses none — all empty); `Cmd+Shift+R` hard reload; a full PowerPoint reload + reopening the pane. A plain-tab load of github.io already returns the NEW bundles (`cached:false`), proving the browser HTTP cache is NOT the culprit — it's Office's layer.
  - You also **cannot** open `chrome://settings/clearBrowserData` via the `navigate` tool (it force-prepends `https://` → broken URL). Browser automation cannot clear this.
  - **Real fix is the user's to do**, in order of preference: (1) open the doc in a clean browser / fresh profile / Edge that never sideloaded the spike — fastest, and covers the "Edge 也测" UAT requirement too; (2) manually clear browser cached files in Chrome settings; (3) remove + re-sideload the add-in (re-upload manifest). The local-file picker for re-sideload is an OS dialog you cannot drive.

## Verify the github.io deploy (source of record — do this before blaming deploy)
```bash
curl -s "https://wynne-cwb.github.io/Aster/?cb=$(date +%s)" | grep -io "<title>[^<]*</title>\|assets/[a-zA-Z0-9._-]*\.js"
# real app => <title>Aster</title> + main-*.js + fluent-*.js   |   spike => "Aster Spike"
gh run list --workflow=pages.yml --limit 5   # did "Deploy Aster" succeed, and when? (~10min Pages cache after)
git log origin/main..HEAD --oneline          # unpushed commits — but check WHAT they touch (code vs .planning/docs)
```
Pages builds `npm run build` → deploys `dist/` on push to main; `spike/` is NOT deployed.

## UAT pass/fail
- Deploy verified current but pane still shows spike → **blocked**, `blocked_by: other (Office add-in cache)`. Not a code Gap.
- Pane shows the contract copy below + new layout (selpill-row in InputBar top / chat-scroll / inputbar-wrap at bottom with tools row) + clean console + warm white bg (#FAFAF8) → **pass**.

### Expected pane copy (post-Phase-04.1 contract)

> **Updated 2026-05-29** — Phase 04.1 teal migration complete. ContextCard removed (D-02);
> empty-state copy updated (D-03); selpill replaces ContextCard (D-01).

| Slot | Correct zh-CN copy / behavior |
|---|---|
| Empty-state heading | 从你正在做的东西开始 |
| Empty-state body | 选中文档里的内容，告诉 Aster 你想做什么。 |
| Empty-state layout | Logo pulse animation (scale 1↔1.06, 4s) + h3 + p; **no suggestion chips** |
| Input placeholder | 输入消息… (active when provider configured) |
| Send button | teal solid (accent bg), right side of tools row |
| Context card | **Not present** — removed in D-02 (topbar removed entirely) |
| Selection pill (selpill) — no selection | Not rendered (selpill-row only shows when selection active) |
| Selection pill — PPT selection | teal pill (accent-soft bg) in selpill-row above textarea; DocumentIcon prefix; label = selection description |
| Selection pill — Excel selection | Same selpill format; label = selected range address |
| Selection pill — Word selection | Same selpill format; label = selected text summary |
| Tools row (bottom of InputBar) | gear icon (left) + paperclip (disabled, aria-disabled) + send button (right) |
| Settings panel | Slides in from right (translateX); provider-row list; no old card-style layout |
| Visual — light theme | Warm white bg #FAFAF8; no gradient header; no glass/backdrop-filter |
| Visual — dark theme | Dark bg #0E0E10; accent = light teal #4FC9B8 (not orange, not purple) |
