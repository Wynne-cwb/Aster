---
phase: 10-excel-ppt-b-excel-b-ppt
reviewed: 2026-05-31T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/agent/operationLog.ts
  - src/agent/operationLog.integration.test.ts
  - src/adapters/ExcelAdapter.ts
  - src/adapters/PptAdapter.ts
  - src/agent/tools/write/excel.ts
  - src/agent/tools/write/ppt.ts
  - src/agent/tools/index.ts
  - src/agent/tools/index.test.ts
  - src/agent/tools/read/tools.test.ts
  - src/agent/contract.test.ts
findings:
  critical: 3
  warning: 8
  info: 3
  total: 14
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-31
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 10 implements Excel and PPT agent write-tools with undo (inverse/snapshot) support. The architecture is sound — Record-arg inverse signatures, two-sync patterns, noop+gate routing, and spike runtime-degrade paths are all structurally correct. However, three correctness bugs were found that will cause wrong behavior in production: a column-address overflow bug for indices >= 26, a silent null write on auto-filter undo when `address` was never given, and a missing `deleteSlideByIndex` inverse case in `executeReverse` that will always throw "unknown reverse tool" even though the adapter method is implemented. Several warnings cover logic gaps in the conditional-format serialization, the `restoreWorksheetSnapshot rename` path, and the `excelFindAndReplace` snapshot/replace loop that are observable edge-case failures.

---

## Critical Issues

### CR-01: `setColumnRowSize` / `restoreColumnRowSize` — column address overflows for index >= 26

**File:** `src/adapters/ExcelAdapter.ts:689`

**Issue:** Column address is computed as `String.fromCharCode(65 + idx)`. `charCodeAt(65+26)` = `[`, not `AA`. Any column index >= 26 (column AA onward) silently produces an invalid range string like `[:[ ` which Excel rejects at runtime with an opaque `ItemNotFound` or `InvalidArgument` error. The adapter method then rethrows as `HostApiError`, losing all context. The inverse method `restoreColumnRowSize` (line 748) has the identical bug.

**Fix:**
```typescript
function colLetter(idx: number): string {
  let s = '';
  let n = idx + 1; // 1-based
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
// Usage:
const col = sheet.getRange(`${colLetter(idx)}:${colLetter(idx)}`);
```
Apply identically in `restoreColumnRowSize`.

---

### CR-02: `restoreAutoFilter` — silent no-op when `hadFilter=true` but `address` is missing

**File:** `src/adapters/ExcelAdapter.ts:814`

**Issue:** `restoreAutoFilter` only calls `sheet.autoFilter.apply(sheet.getRange(address), 0)` when `hadFilter && address`. The `address` field is typed `string | undefined`. If the reverse descriptor was constructed without an `address` (e.g., `{ hadFilter: true }` — which is possible because the ToolDef stores `hadFilter` and `filterAddress` from the adapter return but a stale snapshot could arrive without it), the branch silently calls `sheet.autoFilter.remove()` instead of re-applying the filter — opposite of intent. There is no error or warning; the undo claims success (`rolled_back`) while doing the wrong thing.

**Fix:** Throw a `HostApiError` when `hadFilter` is true but `address` is absent:
```typescript
async restoreAutoFilter(args: Record<string, unknown>): Promise<void> {
  const hadFilter = args.hadFilter as boolean;
  const address = args.address as string | undefined;
  if (hadFilter && !address) {
    throw new HostApiError('restoreAutoFilter: hadFilter=true 但 address 缺失，无法还原筛选框', undefined);
  }
  // ... rest unchanged
}
```

---

### CR-03: `executeReverse` — `delete_slide_by_index` case is missing; always throws "未知 reverse tool"

**File:** `src/agent/operationLog.ts:443`

**Issue:** `executeReverse` handles every Phase 10 reverse tool with an explicit `case`, but `delete_slide_by_index` is absent from the switch. The `PptAdapter.deleteSlideByIndex` method is fully implemented (line 2075 of PptAdapter.ts), the `DocumentAdapterForReplay` interface declares it (line 156 of operationLog.ts), and the integration test for `copy_slide` asserts `rolled_back`. However when `replayUndoStep` calls `executeReverse` with `reverse.tool === 'delete_slide_by_index'` it falls through to `default: throw new Error('未知 reverse tool: delete_slide_by_index')` — the undo will always be `skipped_error` in production.

**Fix:** Add the missing case immediately after `restore_slide_background`:
```typescript
case 'delete_slide_by_index':
  if (!adapter.deleteSlideByIndex) throw new Error(`adapter 未实现 deleteSlideByIndex（tool=${reverse.tool}）`);
  await adapter.deleteSlideByIndex(reverse.args);
  break;
```

---

## Warnings

### WR-01: `addConditionalFormat` serializes `cellValue.format` as a proxy reference, not a plain value

**File:** `src/adapters/ExcelAdapter.ts:860`

**Issue:** The before-image serialization stores `entry.cellValue = { rule: cf.cellValue.rule, format: cf.cellValue.format }`. Both `cf.cellValue.rule` and `cf.cellValue.format` are Office.js proxy sub-objects. They are read **before any `load`** on their sub-properties, so their values are proxy stubs, not plain JS objects. When JSON-serialized into `reverse.args.beforeFormats` they will serialize as `{}` or throw. The `restoreConditionalFormat` inverse then tries to assign `cf.cellValue.rule = cellValue.rule` (line 929) but reconstructs from an empty object — the restore silently produces a default-rule conditional format instead of the original.

**Fix:** Load the necessary fields before reading them:
```typescript
// sync 1 must also load rule/format sub-properties
range.conditionalFormats.load('items/type,items/cellValue/rule,items/cellValue/format/fill/color,items/cellValue/format/font/color');
await ctx.sync();
// Then serialize after sync
```
Alternatively, serialize only the scalar fields that are reliably available:
```typescript
entry.cellValue = {
  rule: {
    formula1: cf.cellValue?.rule?.formula1 ?? '',
    operator: cf.cellValue?.rule?.operator ?? '',
  },
  fillColor: cf.cellValue?.format?.fill?.color ?? null,
  fontColor: cf.cellValue?.format?.font?.color ?? null,
};
```

---

### WR-02: `restoreWorksheetSnapshot` (rename path) uses `getItem` without `isNullObject` guard — throws if sheet was already manually deleted

**File:** `src/adapters/ExcelAdapter.ts:1371`

**Issue:** The `rename` undo path calls `ctx.workbook.worksheets.getItem(newName)` (line 1371) then immediately does `sheet.name = oldName; await ctx.sync()`. If the sheet named `newName` was already deleted or renamed by the user between the original operation and the undo, `getItem` throws `ItemNotFound` at sync time. The replay engine catches this as `skipped_error`, but the error message is opaque (`Excel restoreWorksheetSnapshot 失败`), and more importantly the pattern is inconsistent with the `add` path which correctly uses `getItemOrNullObject`.

**Fix:**
```typescript
} else if (operation === 'rename') {
  const newName = args.newName as string;
  const oldName = args.oldName as string;
  await Excel.run(async (ctx) => {
    const sheet = ctx.workbook.worksheets.getItemOrNullObject(newName);
    sheet.load('isNullObject');
    await ctx.sync();
    if (sheet.isNullObject) return; // 已被用户手动改名/删除 → 静默跳过
    sheet.name = oldName;
    await ctx.sync();
  });
}
```

---

### WR-03: `excelFindAndReplace` — snapshot is taken from **before** replace but the variable `snapshot` is declared in the outer scope and can be `null` when `tooLarge=false`

**File:** `src/adapters/ExcelAdapter.ts:1224`

**Issue:** There is a scoping bug in the function. `snapshot` and `tooLarge` are declared in the outer scope (lines 1224-1226) with initial values, but the **entire Excel.run** call is wrapped in a `return await Excel.run(...)` (line 1229). If the Excel.run completes normally it returns the result directly. However, `snapshot` and `snapshotAddress` that are set inside the Excel.run closure (lines 1240-1249) update the **inner-scope** `snapshot` / `snapshotAddress`, not the outer ones — because the closure captures and reassigns the local variables. This works correctly because the function `return`s from inside the closure. But the outer-scope `let snapshot: ... = null` and the outer `let tooLarge = false` are never actually read — any error path from `try { return await Excel.run(...) }` goes to the `catch` at line 1275, but at that point `snapshot` and `tooLarge` were never assigned by the closure. The `catch` block rethrows, so the outer variables are dead code, which is confusing but not a runtime bug. The real issue: if the `replaceAll` `count` load fails (line 1270), the entire closure throws, the outer catch rethrows as `HostApiError`, and the snapshot taken prior is lost with no partial result available to the tool. The user's data was already mutated but the tool reports failure.

**Fix:** This is an inherent race condition with the Office.js two-phase approach. At minimum add a comment documenting the partial-mutate-on-error risk, and consider separating the snapshot phase from the replace phase into two `Excel.run` calls so a failure on count-load doesn't lose the already-replaced cells' snapshot.

---

### WR-04: `setColumnRowSize` loads `format/columnWidth` and `format/rowHeight` but the load path syntax may not work for nested format props

**File:** `src/adapters/ExcelAdapter.ts:692`

**Issue:** `col.load(['format/columnWidth'])` and `row.load(['format/rowHeight'])` use path syntax with slashes. This is the correct Office.js batch-load notation. However, `columnWidth` and `rowHeight` are properties of `Excel.RangeFormat` (not of `Range` itself). When loading `range.format.columnWidth` via `range.load('format/columnWidth')`, the proxy chain must include the intermediate object. The correct approach per Office.js docs is `range.format.load('columnWidth')` (loading on the sub-object). The slash-path syntax on a range load may silently return `undefined` for `r.format.columnWidth` after sync, causing `beforeSizes` to record `0` for all columns/rows — the restore would then set every column to zero width (effectively hiding them), which is a destructive data-corruption on undo.

**Fix:**
```typescript
const ranges = indices.map((idx) => {
  if (target === 'column') {
    const col = sheet.getRange(`${colLetter(idx)}:${colLetter(idx)}`);
    col.format.load('columnWidth');   // load on sub-object, not path syntax
    return col;
  } else {
    const row = sheet.getRange(`${idx + 1}:${idx + 1}`);
    row.format.load('rowHeight');
    return row;
  }
});
```

---

### WR-05: `copySlide` — `targetIndex` positioning is unreliable; `sorted[targetIndex - 1]` picks the **pre-existing** slide at that position, not the newly copied one

**File:** `src/adapters/PptAdapter.ts:1535`

**Issue:** After `slide.copy()` and `slides.load('items'); await ctx.sync()`, the code picks `sorted[targetIndex - 1]` when `targetIndex` is specified (line 1535). But `slide.copy()` appends to the end per the Office.js API (no positioning parameter). So `sorted[targetIndex - 1]` returns the **pre-existing** slide at that position, not the newly inserted copy. The `capturedId` recorded will be wrong — it will be the ID of an existing slide, not the new one. Undo via `deleteSlideByIndex` will then delete the **wrong** slide. The end result is data loss on undo.

**Fix:** Always take `sorted[sorted.length - 1]` (the newly appended slide) regardless of `targetIndex`, since `copy()` cannot insert at a specific position. If future Office.js APIs support positioned copy, add a separate implementation path.

---

### WR-06: `isTargetStateConsistent` — Phase 10 `postState` kinds always return `true` (no actual consistency check); `skipped_manual` detection is completely disabled for all new tools

**File:** `src/agent/operationLog.ts:247`

**Issue:** The `readTargetState` switch has a `default: return undefined` branch which maps to "consistent" in `isTargetStateConsistent`. All 15 new Phase 10 `postState` kinds (`excel_range_format`, `excel_snapshot`, `excel_worksheet`, `excel_filter`, `excel_conditional_format`, `excel_table`, `excel_freeze`, `excel_chart_title`, `excel_column_row`, `ppt_shape_font`, `ppt_shape_alignment`, `ppt_shape_rotation`, `ppt_slide_background`, `ppt_shape_new`, `ppt_slide_copy`) fall into the `default` case. This is documented as intentional ("保守路径"), but the consequence is that the D-11 manual-change detection (`skipped_manual`) is entirely disabled for all Phase 10 tools. If a user manually edits an Excel range format, then runs undo, the engine will happily overwrite their manual change without warning — the protection only exists for Word paragraphs, Excel range values, and PPT slide titles. This is a functional regression from the stated D-11 intent.

**Fix:** At minimum add `readExcelRange` integration for `excel_range_format` / `excel_column_row` kinds, reusing the existing adapter method. Document explicitly which kinds will never have D-11 protection (noop+gate ops are fine; simple-reverse ops should be protected where possible).

---

### WR-07: `deleteSlideByIndex` double-loads `slides.items` — second `load` overwrites already-loaded data unnecessarily; `slides.load?.('items/id,items/index')` call may silently no-op

**File:** `src/adapters/PptAdapter.ts:2087`

**Issue:** The method calls `slides.load('items')` in sync 1 (line 2083), then immediately calls `(slides as unknown as { load: ... }).load?.('items/id,items/index')` in sync 2 (line 2087) using an optional-call `?.`. The first sync already loads `items`; the second load is intended to also load the `id` and `index` sub-properties, but the `?.` means if the cast's type doesn't have `.load` at runtime, it silently skips — leaving `id` and `index` as uninitialized proxy stubs. In practice `PowerPoint.SlideCollection` does have `.load`, so the call executes, but the cast pattern is fragile and inconsistent with every other method in the file (which calls `slides.load('items')` in the first sync, then uses `slide.load(...)` on individual items). If the second `load` silently does nothing, `s.id` and `s.index` will both be undefined after sync 2, and `items.find(s => s.id === capturedId)` will always return `undefined`, sending every undo to `skipped_error`.

**Fix:** Use the standard pattern:
```typescript
slides.load('items/id,items/index'); // single load before first sync
await ctx.sync();
// No second load needed
```

---

### WR-08: `contract.test.ts` D-17 path resolution uses `path.resolve(__dirname, '../agent/operationLog.integration.test.ts')` — `__dirname` inside `src/agent/tools/` resolves to the wrong path

**File:** `src/agent/contract.test.ts:128`

**Issue:** The file is at `src/agent/contract.test.ts`. `__dirname` in a Vite/Vitest context is `src/agent/`. The path `path.resolve(__dirname, '../agent/operationLog.integration.test.ts')` resolves to `src/agent/../agent/operationLog.integration.test.ts` = `src/agent/operationLog.integration.test.ts` — which does happen to be correct **only** because `contract.test.ts` is in `src/agent/` not in `src/agent/tools/`. But the comment on line 127 says `__dirname` (and the path `'../agent/...'`) could imply it was originally written for a different file location. If `contract.test.ts` is ever moved (e.g., to `src/agent/tools/`), the relative path would break silently: `fs.readFileSync` would throw `ENOENT`, crashing the entire test suite rather than giving a useful assertion failure. This is a fragility issue rather than a current bug, but the D-17 gate is critical.

**Fix:** Use `import.meta.url` (ESM-compatible) or anchor to the project root with `path.resolve(__dirname, '../../src/agent/operationLog.integration.test.ts')` relative to a known root, or better: resolve relative to the test file itself with a clearer comment.

---

## Info

### IN-01: `setColumnRowSize` — column-index letters are computed twice (write + restore) with the same bug

**File:** `src/adapters/ExcelAdapter.ts:689,748`

**Issue:** The column-letter computation from charCode is duplicated in `setColumnRowSize` and `restoreColumnRowSize`. This is dead-code duplication that creates a single point of failure — fixing one without the other (as happened here) would silently leave the inverse broken.

**Fix:** Extract to a private static helper `ExcelAdapter.columnLetter(idx: number): string` so both methods share a single implementation.

---

### IN-02: `addConditionalFormat` — `colorScale` and `dataBar` types added but their `criteria`/`barDirection` are not loaded or serialized

**File:** `src/adapters/ExcelAdapter.ts:862`

**Issue:** The before-image serialization for `ColorScale` stores `{ criteria: cf.colorScale.criteria }` and for `DataBar` stores `{ barDirection, negativeFormat, positiveFormat }`. None of these sub-properties are included in the `conditionalFormats.load('items')` call (line 847). After sync, these proxy properties will be uninitialized stubs. The serialization records the proxy object reference — which will serialize to `{}` in JSON. The `restoreConditionalFormat` inverse then reconstructs `colorScale` and `dataBar` with no criteria, producing blank rules.

**Fix:** Expand the load path or simply omit `colorScale`/`dataBar` from the before-image (since the restore path also ignores their fields — the restore at line 930 just calls `add(colorScale)` with no criteria anyway).

---

### IN-03: `excelFindAndReplace` outer-scope `snapshot` / `tooLarge` variables (lines 1224-1226) are dead code

**File:** `src/adapters/ExcelAdapter.ts:1224`

**Issue:** The outer `let snapshot`, `let snapshotAddress`, `let tooLarge` declarations (lines 1224-1226) and the `try { return await Excel.run(...) } catch { ... }` structure means the outer variables are never read — the function either returns from inside the `Excel.run` closure or rethrows from the catch. The three outer `let` declarations are confusing dead code that implies they are used in an early-return or multi-branch path.

**Fix:** Remove the outer `let` declarations and move the variables inside the `Excel.run` callback, matching the pattern used in `sortRange`.

---

_Reviewed: 2026-05-31_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
