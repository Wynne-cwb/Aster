---
phase: 18-lib
plan: "02"
subsystem: agent-tool
tags: [search-stock-image, write-tool, reverse-path, lib-02, lib-03, nfr-09, insertImage-delete]
dependency_graph:
  requires: [pexels-client, stock-image-registry]
  provides: [search_and_insert_stock_image, stock-image-attribution-data]
  affects: [src/agent/tools/, src/store/chat.test.ts]
tech_stack:
  added: []
  patterns: [loop-write-tool, standard-reverse-descriptor, shared-helper-dry, per-host-registration, three-state-error]
key_files:
  created:
    - src/agent/tools/write/search-stock-image.ts
    - src/agent/tools/write/search-stock-image.test.ts
  modified:
    - src/agent/tools/index.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/tools-host.test.ts
    - src/agent/operationLog.integration.test.ts
    - src/store/chat.test.ts
    - src/agent/tools/write/ppt-image.ts
    - src/agent/tools/write/word-image.ts
    - src/adapters/PptAdapter.ts
  deleted:
    - src/lib/insertImage.ts
decisions:
  - "工具名 = search_and_insert_stock_image（PPT/Word 共享 name，per-host 注册不冲突）"
  - "选首张策略 = photos[0]（最简；alt 相关性智能选留给 AI 在 query 端把控，工具机械取第 0）"
  - "「换一张」= AI 重调工具递增 page（D-05 最简形态；工具无候选游标状态）"
  - "insertImage.ts 删除前 git grep 复核：零运行时 import/调用方，仅 4 处 stale 注释（全清理）"
  - "NFR-09 serialize 守门加为 chat.test.ts 路径 E（路径 D 已被 Phase 17 derivedText 占用，避免 clobber）"
  - "index.test.ts 工具计数守门更新：word 18→19、ppt 20→21（注册新工具的必然后果）"
metrics:
  completed: "2026-06-03T01:55:33Z"
  tasks_completed: 6
  files_modified: 11
---

# Phase 18 Plan 02: search_and_insert_stock_image 工具 + insertImage 删除 Summary

**一句话：** 新建 `search_and_insert_stock_image`（PPT+Word 双 ToolDef，loop 内自动检索 Pexels→选首张→fetch→裸 base64→直插→返 shape_id），走标准 write-tool reverse 路径（PPT delete_shape_by_id + postState / Word noop_inverse），data 携 LIB-03 署名（thumbnail_url 远程 URL，无 base64）；删除已无调用方的 insertImage.ts + 清理 4 处 stale 注释；undo/host/casing/NFR-09 守门全绿。

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | 新建 search-stock-image.ts（PPT+Word ToolDef + 共享 helper） | search-stock-image.ts |
| 2 | tools/index.ts 注册（PPT_TOOLS Set + ppt/word case；Excel 不注册） | index.ts |
| 3 | tools-host.test.ts per-host 守门（PPT/Word 含、Excel 不含） | tools-host.test.ts |
| 4 | operationLog.integration.test.ts Phase 18 inverse replay 守门 | operationLog.integration.test.ts |
| 5 | search-stock-image.test.ts 单测 + chat.test.ts NFR-09 路径 E | *.test.ts |
| 6 | 删除 insertImage.ts + 清理 4 处 stale 注释（D-02 收尾） | insertImage.ts(del) + 4 注释 |

## reverse 路径（照 Phase 16 范式）

- **PPT**：`reverse={tool:'delete_shape_by_id', args:{slide_index, shape_id}}`（Record snake_case，非位置参）+ `postState={kind:'ppt_shape_new', content:{slideIndex, shapeId}}`（camelCase）。execute 返回，loop-helpers 自动 appendOperation。**未手动 appendOperation、未调任何 helper。**
- **Word**：`reverse={tool:'noop_inverse', args:{reason:'Word 图片插入暂不支持自动撤销'}}`（无 postState，诚实标注）。
- integration test 两条守门：PPT→rolled_back、Word→skipped_error（toolName 字面量 'search_and_insert_stock_image' 出现在文件，满足 D-17 扫描 + adapter_inverse_signature 铁律）。

## insertImage.ts 删除复核结论

- 删前 `grep -rn insertImage src/`：**零运行时 import/调用方**，仅 4 处 stale 注释/JSDoc（ppt-image.ts/word-image.ts/operationLog.integration.test.ts/PptAdapter.ts）——与 team-lead 2026-06-02 复核一致。
- 删后 `grep -rn insertImage src/` = NONE（新工具头注释原引用「src/lib/insertImage.ts」已改为不点名的「旧 helper 路径已废弃删除」，避免 dangling 文件名 + 满足 git grep==0）。

## bundle size（先 build 再 size）

- 18-02 后 `npm run build && npm run size`：**main-*.js = 80.22 kB gzip / 82 kB 门**（margin ~1.78 KB）。
- search-stock-image.ts + pexels-client 静态进 main 仅 +~0.4KB vs 18-01 的 80.01 → **未触发 pexels-client 动态 import 降级**（plan 的应对未启用）。

## 自动化 gate（本 plan 范围）

- `npm run typecheck`（tsc --noEmit）：✓ EXIT 0。
- `npm run build`：✓ 无错误。
- 测试：search-stock-image / tools-host / operationLog.integration / index / dispatch / chat 共 112 passed / 0 failed。
