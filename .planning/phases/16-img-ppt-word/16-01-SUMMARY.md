---
phase: 16-img-ppt-word
plan: "01"
subsystem: testing
tags: [vitest, tdd, wave-0, ppt-image, word-image, IMG-01, IMG-02, IMG-03, IMG-05]

requires:
  - phase: 14-mdl-provider
    provides: AihubmixImageClient.generate 三路解析器 + ProviderRegistry.resolve image-gen 路由
  - phase: 15-vis
    provides: NFR-09 序列化守门（tool role 过滤），路径 A/B 先有

provides:
  - ppt-image.test.ts Wave 0 describe.skip 脚手架（generate_ppt_image tool 3 用例）
  - word-image.test.ts Wave 0 describe.skip 脚手架（generate_word_image tool 2 用例）
  - ppt-image.ts Wave 0 存根（供 tsc 解析，Plan 16-03 填充实现）
  - word-image.ts Wave 0 存根（供 tsc 解析，Plan 16-03 填充实现）
  - operationLog.integration.test.ts Phase 16 守门用例（generate_ppt/word_image inverse replay）
  - chat.test.ts NFR-09 路径 C（image preview_pending base64 不持久化）
  - tools-host.test.ts IMG-05 Excel host 守门（Excel 不含 generate_ppt/word_image）

affects: [16-02, 16-03, 16-04, 16-05]

tech-stack:
  added: []
  patterns:
    - "Wave 0 存根模式：stub ts 文件（throws not-implemented）+ describe.skip test 文件，tsc 能 resolve，vitest 跳过"
    - "Per-host 注册守门（tools-host.test.ts）：Excel case 空守门当前 GREEN，PPT/Word it.skip 等实现注册"
    - "Integration test 复用 mockPpt（'new-shape-uuid'）而非新 shape ID，与 D-17 analog 保持一致"

key-files:
  created:
    - src/agent/tools/write/ppt-image.test.ts
    - src/agent/tools/write/ppt-image.ts
    - src/agent/tools/write/word-image.test.ts
    - src/agent/tools/write/word-image.ts
    - src/agent/tools/tools-host.test.ts
  modified:
    - src/agent/operationLog.integration.test.ts
    - src/store/chat.test.ts

key-decisions:
  - "Wave 0 先建存根 ts 文件（ppt-image.ts / word-image.ts），让 tsc + Vitest 能 resolve 测试文件——避免 Module Not Found 编译错误"
  - "generate_ppt_image integration 守门用 'new-shape-uuid'（mockPpt 已注册），不新建 'img-shape-uuid'（避免修改公共 mock）"
  - "tools-host.test.ts PPT/Word 含 generate_* 守门用 it.skip（Plan 16-03 注册工具后解除），Excel 守门直接 GREEN"

requirements-completed:
  - IMG-01
  - IMG-02
  - IMG-03
  - IMG-05

duration: 11min
completed: 2026-06-02
---

# Phase 16 Plan 01: Wave 0 测试脚手架 Summary

**建立 Phase 16 全套 Wave 0 测试脚手架：5 个文件（新建存根 + 测试），覆盖 IMG-01/02/03/05 守门用例，816 个测试全量绿**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-02T07:50:45Z
- **Completed:** 2026-06-02T08:01:51Z
- **Tasks:** 2 of 2
- **Files modified:** 7

## Accomplishments

- 新建 `ppt-image.test.ts` + `word-image.test.ts`（describe.skip 脚手架，3+2 用例）：验证 preview_pending / reverse undefined / PERMISSION_DENIED 三大行为
- 新建 `ppt-image.ts` + `word-image.ts` Wave 0 存根，让 tsc strict 能 resolve 测试文件引用
- `operationLog.integration.test.ts` 追加 2 条 Phase 16 守门用例（IMG-01 → rolled_back，IMG-02 → skipped_error）
- `chat.test.ts` 追加 NFR-09 路径 C（image preview_pending base64 不写 localStorage）
- 新建 `tools-host.test.ts`（IMG-05 Excel 守门 2 条 GREEN，PPT/Word 2 条 it.skip 等 16-03）

## Task Commits

1. **Task 1: 新建 ppt-image.test.ts + word-image.test.ts 工具单测脚手架** - `b14b6f7` (test)
2. **Task 2: 扩展 operationLog.integration.test.ts + chat.test.ts + 新建 tools-host.test.ts** - `c3a0126` (test)

## Files Created/Modified

- `src/agent/tools/write/ppt-image.test.ts` — generate_ppt_image 工具 Wave 0 describe.skip 测试脚手架（3 用例）
- `src/agent/tools/write/ppt-image.ts` — Wave 0 存根（export generatePptImageTool，execute 抛 not-implemented）
- `src/agent/tools/write/word-image.test.ts` — generate_word_image 工具 Wave 0 describe.skip 测试脚手架（2 用例）
- `src/agent/tools/write/word-image.ts` — Wave 0 存根（export generateWordImageTool，execute 抛 not-implemented）
- `src/agent/tools/tools-host.test.ts` — IMG-05 per-host 注册守门（Excel 不含生图工具）
- `src/agent/operationLog.integration.test.ts` — 追加 Phase 16 generate_ppt_image / generate_word_image inverse replay 守门
- `src/store/chat.test.ts` — 追加 NFR-09 路径 C（image preview_pending 路径 base64 不持久化）

## Decisions Made

- **Wave 0 存根模式**：先建 stub ts 文件（export 工具但 execute 抛 `not-implemented`），让 tsc 能 resolve 测试文件引用，避免严格模式 Module Not Found 错误。Plan 16-03 填充完整 execute 实现后解除 describe.skip。
- **Integration 守门 shape_id 选择**：复用 mockPpt 已注册的 `'new-shape-uuid'`（而非 `'img-shape-uuid'`），避免 `deleteShapeById` 找不到 shape 而从 `rolled_back` 变成 `skipped_error`。
- **it.skip vs describe.skip**：PPT/Word 含 generate_* 的 tools-host 守门用 `it.skip`（具体用例），其余工具单测整体 `describe.skip`，语义更精确。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Wave 0 存根文件（ppt-image.ts / word-image.ts）在计划外新建**

- **Found during:** Task 1（新建 ppt-image.test.ts）
- **Issue:** 计划只说建测试文件 + describe.skip；但 tsc strict + Vitest Vite resolver 对 `describe.skip` 内部的动态 `import()` 也会做 Module Not Found 检查，即使用 `@ts-ignore` 也无法绕过 Vite transform 阶段。
- **Fix:** 新建最小存根实现文件（`ppt-image.ts` / `word-image.ts`），export `ToolDef` 结构但 execute 抛 `not-implemented`，让所有解析能通过。存根同时作为 Plan 16-03 实现文件的接口声明占位。
- **Files modified:** src/agent/tools/write/ppt-image.ts (new), src/agent/tools/write/word-image.ts (new)
- **Verification:** `npm test -- --run ppt-image.test.ts` 退出 0，3 个 skipped
- **Committed in:** b14b6f7（Task 1 commit）

**2. [Rule 1 - Bug] integration 守门 shape_id 从 img-shape-uuid 改为 new-shape-uuid**

- **Found during:** Task 2（追加 operationLog integration 守门）
- **Issue:** 计划 action 中写 `shape_id: 'img-shape-uuid'`，但 `mockPpt` 函数只注册了 `'new-shape-uuid'`（用于 D-17 `add_shape` 守门），`deleteShapeById` 找不到 `img-shape-uuid` 会抛 HostApiError → `skipped_error`，守门期望的 `rolled_back` 永远无法到达。
- **Fix:** 将 integration 守门中的 `shape_id` 改为 `'new-shape-uuid'`（mockPpt 已有），与 D-17 `add_shape` 守门共用同一 mock shape，语义不变（验证 deleteShapeById Record 签名被正确消费）。
- **Files modified:** src/agent/operationLog.integration.test.ts
- **Verification:** 守门用例 `expect(detail.status).toBe('rolled_back')` 通过
- **Committed in:** c3a0126（Task 2 commit）

---

**Total deviations:** 2 auto-fixed (2 Rule 1 - Bug)
**Impact on plan:** 两个偏差均为必要修正（tsc/Vitest 解析约束、mock 数据约束），不影响计划语义目标。无范围扩展。

## Issues Encountered

tsc strict + Vite resolver 对 `describe.skip` 内部的动态 `import('./ppt-image')` 不豁免 Module Not Found 检查（与 Phase 15 `attachments.test.ts` 情况不同——那个文件在 Wave 2 时已经存在了）。解决方案是创建存根文件，同时也是 Plan 16-03 的接口预声明。

## Known Stubs

| 文件 | 位置 | 内容 | 原因 |
|------|------|------|------|
| src/agent/tools/write/ppt-image.ts | execute 函数体 | `throw new Error('未实现')` | Wave 0 存根，Plan 16-03 填充完整实现 |
| src/agent/tools/write/word-image.ts | execute 函数体 | `throw new Error('未实现')` | Wave 0 存根，Plan 16-03 填充完整实现 |

两个存根均有意为之（Wave 0 TDD 范式），不影响本 Plan 目标（只交付测试脚手架）。Plan 16-03 实现后 execute 将被填充，describe.skip 解除，测试转绿。

## Next Phase Readiness

- Wave 0 测试脚手架就绪，Plan 16-02（insertImage helper + adapter 方法）可直接开始
- Plan 16-03（ppt-image.ts / word-image.ts 完整实现）完成后，去掉 describe.skip + it.skip 即可验证全部 Wave 0 守门
- 16-VALIDATION.md `wave_0_complete` 应翻为 `true`（在 STATE 更新后手工标注）

---
*Phase: 16-img-ppt-word*
*Completed: 2026-06-02*
