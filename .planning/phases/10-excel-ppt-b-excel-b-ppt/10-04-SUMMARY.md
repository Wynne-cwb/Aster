---
phase: 10-excel-ppt-b-excel-b-ppt
plan: "04"
subsystem: PPT-adapter
tags: [ppt, write-tools, undo, inverse, wave-3a]
dependency_graph:
  requires:
    - 10-01 (skeleton + contract)
    - 10-02/10-03 (Excel 10 tools, all GREEN)
  provides:
    - PPT-01 set_shape_text_font (write + inverse)
    - PPT-03 add_shape (write + inverse, #2775 defense)
    - PPT-07 copy_slide (write + inverse, D-16 dual-locate)
  affects:
    - src/adapters/PptAdapter.ts (6 new methods)
    - src/agent/tools/write/ppt.ts (3 new ToolDefs)
    - src/agent/tools/index.ts (pptWriteTools 4→7)
    - src/agent/operationLog.integration.test.ts (mockPpt expanded)
    - src/agent/contract.test.ts (3 rows false→true)
    - .planning/phases/08-foundation-a-f/CONTRACT.md (3 rows planned→done)
tech_stack:
  added: []
  patterns:
    - "四 sync 范式 (Pattern D) for setShapeTextFont"
    - "Record<string, unknown> inverse 签名 (Pattern E)"
    - "addTextBox #2775 count-before/after guard (Pattern F)"
    - "capturedId+capturedIndex 双定位 inverse (D-16 Pattern G)"
key_files:
  created: []
  modified:
    - src/adapters/PptAdapter.ts
    - src/agent/tools/write/ppt.ts
    - src/agent/tools/index.ts
    - src/agent/operationLog.integration.test.ts
    - src/agent/contract.test.ts
    - .planning/phases/08-foundation-a-f/CONTRACT.md
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts
decisions:
  - "restoreShapeFont inverse 不做 TEXT_SHAPE_TYPES 守门（写入时已保证，幂等还原安全）"
  - "deleteSlideByIndex 双定位：优先 capturedId（UUID 不受位置变化），找不到降级 capturedIndex"
  - "addShape TextBox 路径用 addTextBox + count before/after 校验（#2775 防御，明确失败不静默）"
  - "mockPpt 扩展 shape 属性（id/font/delete + 两个 shape 覆盖 shape-01 + new-shape-uuid），不破坏旧 insertSlide 测试"
  - "PPT 工具数量更新：9→12（4 read + 7 write + 1 selection_detail）"
metrics:
  duration: "~25min"
  completed: "2026-05-31"
  tasks: 2
  files_changed: 8
---

# Phase 10 Plan 04: PPT Wave 3a Summary

Wave 3a 实现 PPT 3 个简单逆向工具（PPT-01/03/07），完成 ROADMAP SC#3（add_shape + undo），每工具完成 D-17 四步守门。

## What Was Built

**setShapeTextFont / restoreShapeFont（PPT-01）：**
- 四 sync 范式 + TEXT_SHAPE_TYPES 守门
- before-image 字段：bold/italic/underline/color/size/name（全部保留，允许 null）
- inverse 不重复做 TEXT_SHAPE_TYPES 守门（写入时已保证，幂等还原安全）

**addShape / deleteShapeById（PPT-03）：**
- TextBox 路径：addTextBox + count before/after 校验（T-10-11 #2775 防御）
  - countAfter < countBefore → throw HostApiError（明确失败，不静默数据丢失）
- 几何形状路径：addGeometricShape + TEXT_SHAPE_TYPES 守门写文字
- inverse deleteShapeById：按 shape_id 精确删除

**copySlide / deleteSlideByIndex（PPT-07）：**
- slide.copy() + PPT-05 排序（绕 Web 反序 bug #3618）
- 指纹捕获：capturedId + capturedIndex 双定位（D-16）
- inverse deleteSlideByIndex：优先 capturedId 定位（UUID，不受位置变化），找不到降级 capturedIndex

## Commits

| Hash | Description |
|------|-------------|
| 8c55a89 | feat(10-04): add 6 PptAdapter methods + extend mockPpt |
| 913c209 | feat(10-04): PPT-01/03/07 ToolDef + D-17 守门四步完成 |
| 950a0a8 | chore(10-04): update PPT tool count assertions 9→12 |

## RED/GREEN Status After Work

| Tool | Integration Gate | Status |
|------|-----------------|--------|
| PPT-01 set_shape_text_font | restore_shape_font | GREEN |
| PPT-03 add_shape | delete_shape_by_id | GREEN |
| PPT-07 copy_slide | delete_slide_by_index | GREEN |
| PPT-02 set_shape_text_alignment | restore_shape_alignment | RED (10-05) |
| PPT-04 rotate_shape | restore_shape_rotation | RED (10-05) |
| PPT-05 set_slide_background | restore_slide_background | RED (10-05) |
| PPT-06 delete_shape | noop_inverse | GREEN (noop+gate) |
| PPT-08 manage_slides | noop_inverse | GREEN (noop+gate) |

contract.test.ts 全绿（18 个 integrationTest:true 工具全部在 integration.test.ts 有对应守门）。

## D-17 Four-Step Gate Status

| 步骤 | PPT-01 | PPT-03 | PPT-07 |
|------|--------|--------|--------|
| 1. contract.test.ts integrationTest→true | done | done | done |
| 2. integration.test.ts GREEN (rolled_back) | done | done | done |
| 3. CONTRACT.md status→done | done | done | done |
| 4. noop+gate N/A（三工具均简单逆向） | N/A | N/A | N/A |

## Spike S7 Real-Machine Status

**S7: addTextBox 绕 Office.js #2775（选中形状静默删除 bug）**

- 代码路径已实现：addTextBox + countBefore/countAfter 校验
- Integration 守门 GREEN：undo 逻辑（deleteShapeById 反向逻辑）在 mock 环境下正确
- **真机是否真正绕过 #2775 = 待真机 UAT**

S7 结论：代码路径 + undo 逻辑已自验证（GREEN）；addTextBox 是否确实避免触发 #2775（即写入后 count 不减少）需在真实 PowerPoint for Web 环境验证。不可在此 claim "S7 验证通过"。

## Deviations from Plan

**[Rule 1 - Bug] mockPpt 扩展以支持新 inverse 方法**

- **Found during:** Task 1 验证
- **Issue:** 原 mockPpt shapes.items[0] 缺少 id 字段 → restoreShapeFont/deleteShapeById 的 find(sh.id === ...) 返回 undefined → HostApiError → skipped_error
- **Fix:** 扩展 mockPpt，shapes.items 包含两个 shape（id='shape-01' + id='new-shape-uuid'），各带 font/delete 属性；slide 带 id='slide-uuid-copy' + copy()
- **Files modified:** src/agent/operationLog.integration.test.ts
- **Commit:** 8c55a89

**[Rule 2 - Missing Test Coverage] 工具数量断言守门更新**

- **Found during:** Task 2 测试
- **Issue:** tools.test.ts + index.test.ts 的 PPT 工具数量断言仍是 9，添加 3 个工具后断言失败
- **Fix:** 更新断言 9→12，更新 PPT_WRITE_TOOLS 数组
- **Files modified:** src/agent/tools/index.test.ts, src/agent/tools/read/tools.test.ts
- **Commit:** 950a0a8

## Bundle Size

| Metric | Value |
|--------|-------|
| Initial main-*.js (gzip) | 74.58 KB |
| Limit | 82 KB |
| Status | PASS |

PptAdapter 在独立 lazy chunk（16.52 kB），不影响初始 bundle。

## Known Stubs

None — 3 个工具均完整接线，无 placeholder 或硬编码空值。

## Self-Check: PASSED

- src/adapters/PptAdapter.ts: 6 new methods present (setShapeTextFont/restoreShapeFont/addShape/deleteShapeById/copySlide/deleteSlideByIndex) ✓
- src/agent/tools/write/ppt.ts: set_shape_text_font/add_shape/copy_slide ToolDefs present ✓
- Commits 8c55a89, 913c209, 950a0a8 exist ✓
- contract.test.ts 18 integrationTest:true ✓
- integration.test.ts PPT-01/03/07 GREEN, PPT-02/04/05/06/08 expected-RED/GREEN ✓
- bundle 74.58 KB < 82 KB ✓
