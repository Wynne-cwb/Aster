---
phase: 24-a-p2-bundle
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/agent/design/slide-preview.ts
  - src/agent/tools/read/visual-check.ts
  - src/agent/tools/visual-check-config.ts
  - src/agent/tools/index.ts
  - src/components/SlidePreviewPanel.tsx
  - src/components/ChatStream.tsx
  - src/styles.css
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Phase 24 introduces the self-render preview panel (SlidePreviewPanel), the visual_check_slide tool, and the html2canvas-based screenshot pipeline. The NFR-09 base64 isolation contract is correctly honored — `pureBase64` is a local variable that never escapes into `ToolResult.data`. The coordinate base is correctly 960 throughout; no 720 stale references were found in the changed files. The dynamic-import / React.lazy bundle gating is correctly structured. Tests (9/9) pass.

Three quality issues require attention. The most impactful is a logic gap in the rendering path: the preview panel is silently suppressed when `apply_slide_layout` is part of a multi-tool run. The second is an unused required parameter (`slideIndex`) whose declared contract the implementation cannot fulfill. The third is a global getter registration race that can occur when multiple SlidePreviewPanel instances co-exist.

---

## Warnings

### WR-01: SlidePreviewPanel suppressed in multi-tool sequences — visual_check_slide always falls back to advisory

**File:** `src/components/ChatStream.tsx:511-517`

**Issue:** `MergedToolGroup` is rendered (instead of `ToolResultCard`) whenever two or more consecutive regular tool messages appear together. `MergedToolGroup` renders plain `ExpandedBody` rows — it has no `SlidePreviewPanel` rendering logic. As a result, when `apply_slide_layout` is grouped with any other tool (e.g. a preceding `list_slides` or `set_slide_background`), the preview panel never mounts. Because the panel never mounts, `_previewElementGetter()` returns `null`, and `visual_check_slide.execute` always returns the advisory string `"预览面板未打开，视觉自查跳过"` rather than a real screenshot analysis.

This means the entire PVQ-06 spike can silently evaluate as "not working" in UAT, when the actual failure is a rendering-path exclusion, not html2canvas fidelity.

**Fix:** Either (a) add `SlidePreviewPanel` rendering to `MergedToolGroup` for messages where `m.toolName === 'apply_slide_layout' && m.toolResult?.ok`, following the same pattern as `ToolResultCard` lines 291–295; or (b) exclude `apply_slide_layout` from the merge group via `isRegularTool` (like `soft-landing` is excluded), so it always gets its own `ToolResultCard`.

Option (b) is the minimal-risk fix:
```typescript
function isRegularTool(m: Message): boolean {
  return (
    m.role === 'tool' &&
    m.toolName !== 'soft-landing' &&
    m.toolName !== 'apply_slide_layout' &&   // add this
    m.toolResult?.error?.code !== 'CIRCUIT_OPEN'
  );
}
```

---

### WR-02: `slideIndex` parameter is declared required but ignored — tool contract is misleading

**File:** `src/agent/tools/read/visual-check.ts:38,62`

**Issue:** `slideIndex` is listed under `required: ['slideIndex']` in the tool schema and is destructured in `execute({ slideIndex }, _ctx)`, but the variable is never used. The implementation unconditionally captures whichever DOM element is registered in `_previewElementGetter` — always the last mounted `SlidePreviewPanel`, regardless of which slide the LLM intends to check. The LLM receives no feedback that it passed a slide index that was silently disregarded.

If the LLM calls `visual_check_slide({ slideIndex: 2 })` after a user has multiple panels in the chat (e.g. several `apply_slide_layout` calls), it will receive a screenshot of the most-recently-mounted panel, which may not correspond to slide index 2. The mismatch can produce confusing feedback.

**Fix:** Either (a) remove `slideIndex` from the schema and rename the parameter in `humanLabel` to `视觉自查当前预览` (since only the current panel can be checked), or (b) keep the parameter but add a note in the response data that clarifies which slide was captured:
```typescript
return {
  ok: true,
  data: { summary: content, note: '截图来自当前预览面板（最近一次 apply_slide_layout）' },
};
```
Option (a) is cleaner and avoids the false contract.

---

### WR-03: `SlidePreviewPanel` unmount resets global getter unconditionally — stale null if older panel unmounts after newer one

**File:** `src/components/SlidePreviewPanel.tsx:47-49`

**Issue:** The `useLayoutEffect` cleanup calls `registerPreviewElement(() => null)` on every unmount, regardless of whether this component instance is still the "active" registered panel. If the user produces two `apply_slide_layout` tool calls, two `SlidePreviewPanel` instances mount sequentially, each overwriting the global getter. If the older panel (A) later unmounts (e.g. during a hot reload, React Strict Mode double-invoke, or future virtualization), it unconditionally resets the getter to `null`, breaking panel B's registration even though B is still mounted.

In production today (no virtualization, no Strict Mode double-invoke concern in production builds) this is unlikely to trigger, but it is a latent correctness issue for the spike evaluation.

**Fix:** Tag each registration with an identity token and only clear on unmount if the current instance is still the registered owner:
```typescript
useLayoutEffect(() => {
  const getter = () => containerElRef.current;
  registerPreviewElement(getter);
  return () => {
    // Only clear if we are still the registered getter
    // visual-check.ts would need to expose a conditional unregister:
    // unregisterPreviewElement(getter)
  };
}, []);
```
Alternatively, keep a version counter in `visual-check.ts`:
```typescript
let _version = 0;
export function registerPreviewElement(getter: () => HTMLElement | null): void {
  _previewElementGetter = getter;
  _version++;
}
// cleanup: pass version at mount time, only reset if version unchanged
```

---

## Info

### IN-01: Dead CSS — `.slide-preview-panel__status` and `--error` modifier defined but never referenced in JSX

**File:** `src/styles.css:1707-1716`

**Issue:** Two CSS classes — `.slide-preview-panel__status` and `.slide-preview-panel__status--error` — are defined in the Phase 24 block, but no element in `SlidePreviewPanel.tsx` uses either class name. They add ~200 bytes of dead CSS and imply a status/error state that the component has no mechanism to enter.

**Fix:** Either implement a status display in `SlidePreviewPanel` (e.g. show an error message when `buildLayout` throws or shapes is empty), or remove the two unused CSS rules.

---

### IN-02: `slideIndex` unused variable — TypeScript `noUnusedLocals` silently waived by destructure syntax

**File:** `src/agent/tools/read/visual-check.ts:62`

**Issue:** `async execute({ slideIndex }, _ctx)` destructures `slideIndex` from args, but never references the variable in the function body. Depending on `tsconfig.json` `noUnusedLocals` / `noUnusedParameters` settings this may or may not produce a compile warning. Currently `tsc --noEmit` passes (confirmed by test run), suggesting `noUnusedParameters` is either off or the rule is bypassed by destructuring.

This is a secondary note to WR-02 — the root issue is the misleading contract, but the dead binding itself is a code smell.

**Fix:** As part of fixing WR-02, either consume `slideIndex` or replace the destructure with a wildcard:
```typescript
async execute(_args, _ctx): Promise<ToolResult> {
```

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
