---
phase: 15-vis
plan: "04"
subsystem: store, test
tags: [nfr-09, test, serialize-guard, bundle-gate, vitest, typescript]

requires:
  - phase: 15-vis
    plan: "03"
    provides: useAttachmentStore 内存 store + chat.ts sendMessage vision 注入（两条 base64 路径均已就位）

provides:
  - chat.test.ts NFR-09 serialize-test 守门（2 个新 it() 断言）
  - bundle size 验证：77.84 KB gzip ≤ 82 KB CI gate

affects:
  - Phase 15-05（UAT）：NFR-09 结构性守门就位，base64 不进历史的机制有测试覆盖

tech-stack:
  added: []
  patterns:
    - "NFR-09 serialize-test：saveHistory mock → mockedStorage.set.mock.calls[0] → payload.messages 断言 role + content"
    - "路径 A（tool role 完全被白名单过滤）：every(m.role !== 'tool') + allContent.not.toContain('base64')"
    - "路径 B（user message = original prompt）：content 不含 base64/data:image，精确 toBe 原始 prompt 字符串"

key-files:
  created: []
  modified:
    - src/store/chat.test.ts

key-decisions:
  - "两个 NFR-09 守门用不同 docKey（vis-test / upload-test）以确保 mockedStorage.set.mock.calls[0] 独立取到各自 payload（beforeEach vi.clearAllMocks() 保证 call 索引为 0）"
  - "路径 A base64 泄漏检测：同时断言 not.toContain('base64') / not.toContain('data:image') / not.toContain('A'.repeat(100))——三重确认 fakeBase64 payload 无论以任何形式都不出现在序列化结果中"
  - "Task 2 为纯验证任务，不修改代码文件，无需独立提交；验证结果内联在 SUMMARY 中"

metrics:
  duration: "8min"
  completed: "2026-06-02"
  tasks: 2
  files_modified: 1
---

# Phase 15 Plan 04: NFR-09 结构性守门 + Bundle Gate Summary

**chat.test.ts 追加两个 NFR-09 serialize-test 守门断言，覆盖 vision tool result 和上传图两条 base64 路径；bundle 77.84 KB gzip 通过 82 KB CI gate**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-02T02:20:04Z
- **Completed:** 2026-06-02T02:28:00Z
- **Tasks:** 2
- **Files modified:** 1（chat.test.ts 追加 71 行）

## Accomplishments

### Task 1 — NFR-09 serialize-test 守门（chat.test.ts）

在 `src/store/chat.test.ts` 现有白名单测试（L204-224）之后追加两个 it() 断言：

**断言 1 — 路径 A（vision tool result，文档选中图）：**
- 模拟 tool role 消息含 `base64_raw: 'data:image/png;base64,AAA...'`（500 字节）
- `saveHistory('aster:chat:vis-test')` 后断言：
  - `payload.messages.every(m => m.role !== 'tool')` → true（tool role 完全被白名单过滤）
  - `allContent` 不含 `'base64'` / `'data:image'` / `'A'.repeat(100)`（base64 payload 三重检查）

**断言 2 — 路径 B（上传图，FILE-06）：**
- 模拟 user message.content = 原始 prompt（`'基于这张图写一份销售报告'`）
- 验证 sendMessage 中 vision evidence 只传给 runAgent，不写进 pushMessage 的 content
- `saveHistory('aster:chat:upload-test')` 后断言：
  - `allContent` 不含 `'base64'` / `'data:image'`
  - `userMsg.content` 精确等于原始 prompt 字符串（toBe 守门）

**测试结果：** 14 个测试全 PASS（原 12 个 + 新增 2 个 NFR-09 守门）。

### Task 2 — bundle size 验证 + 全量测试 gate

- `npm run build`：构建成功，main-ZuvHOzR0.js gzip **77.96 KB**
- `npm run size`：**77.84 KB gzip ≤ 82 KB** CI gate 通过（size-limit 工具实测）
- `npm test -- --run`：**808 个测试全 PASS**（3 个 retry.test.ts trailing errors 为已知框架噪音）
- `npx tsc --noEmit`：TypeScript 严格编译干净
- `npm run extract`：Lingui catalog 130 条，0 Missing，无 coverage 报错

## Task Commits

1. **Task 1: NFR-09 serialize-test 守门** - `1bc82de` (test)
2. **Task 2: 纯验证（无代码改动）** - 验证结果内联于本 SUMMARY，无独立提交

## NFR-09 守门用例统计

| 用例 | 路径 | 核心断言 |
|------|------|---------|
| serializeForStorage 白名单（已有）| 通用白名单 | tool/error role 被过滤，user content ≤2000 字符 |
| NFR-09 路径 A（新增）| vision tool result | tool role 完全不在结果中；allContent 无 base64 |
| NFR-09 路径 B（新增）| 上传图 FILE-06 | user content = original prompt；allContent 无 base64 |

## Bundle Size 实测

| 构建产物 | gzip 大小 | CI Gate |
|---------|----------|---------|
| `main-ZuvHOzR0.js` | 77.96 KB（Vite 报告） | ≤82 KB |
| **size-limit 实测** | **77.84 KB** | **PASS** |

Phase 15 总计无新增 npm 依赖，bundle 在 Phase 03 完成后保持稳定（77.84 KB vs Phase 03 预期范围内）。

## Deviations from Plan

无。Plan 中给出的两个断言代码模板直接采用，测试一次通过，无需调整。

## Known Stubs

无。两个 NFR-09 守门断言均为完整实现：
- 路径 A：tool role 白名单过滤机制由 serializeForStorage 现有实现保证
- 路径 B：user content = original prompt 由 chat.ts sendMessage L207 `content: prompt`（不含 evidence）保证

## Threat Flags

无新增安全面超出 Plan 15-04 threat model：
- T-15-14（serializeForStorage 未来改动破坏 NFR-09）：已由新增两个 it() 守门覆盖，CI 阻断有效 ✓
- T-15-15（bundle 内嵌 base64 资产泄漏）：Phase 15 零新增静态资源，bundle size 77.84 KB ✓

## Self-Check: PASSED
