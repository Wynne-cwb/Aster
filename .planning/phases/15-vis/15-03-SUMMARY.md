---
phase: 15-vis
plan: "03"
subsystem: store, components, providers
tags: [file-upload, vision, attachments, inputbar, chat, nfr-09, lingui, typescript, vitest]

requires:
  - phase: 15-vis
    plan: "01"
    provides: VisionImage interface + analyzeImages() + attachments.test.ts Wave 0 scaffold

provides:
  - useAttachmentStore（src/store/attachments.ts）— 纯内存 Zustand slice，无 persist middleware（NFR-09）
  - AttachedImage interface（id / base64 / mimeType / fileName / sizeBytes）
  - InputBar 激活回形针：file input + onPaste handler + 缩略图 chip UI（D-08 / D-10）
  - chat.ts sendMessage 扩展：vision evidence 注入 finalPrompt，用户气泡显示 original prompt（NFR-09）

affects:
  - 15-04（UAT 验收）：FILE-06 功能完整交付，回形针 + 粘贴 + vision 注入全就位
  - InputBar 测试：paperclip 测试从「aria-disabled」更新为「已激活」（D-08 守门对齐）
  - Lingui catalog：4 个新字符串（上传图片 / 移除图片 / 文件解析即将开放 / 图片过大）

tech-stack:
  added: []
  patterns:
    - "纯内存 Zustand slice：create<State>((set) => {...}) 无 persist，NFR-09 守门"
    - "同步 DataTransfer API（clipboardData.items）优先于 navigator.clipboard（Pitfall 4 守则）"
    - "vision evidence 注入：augmented prompt 头部 [图片分析 evidence]\\n{content}\\n---\\n{prompt}"
    - "诚实降级：catch {} 只追加固定字符串，不读 err.message（T-15-13 守则）"
    - "D-10 多轮复用：发消息后不 clearImages，用户手动点 chip × 删除"

key-files:
  created:
    - src/store/attachments.ts
  modified:
    - src/store/attachments.test.ts
    - src/components/InputBar.tsx
    - src/components/InputBar.test.tsx
    - src/store/chat.ts
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po
    - src/i18n/locales/zh-CN/messages.ts

key-decisions:
  - "sendMessage vision 注入点：在 get().pushMessage 之前调 vision，保证 user 气泡 content = original prompt（NFR-09 / T-15-08）"
  - "ProviderRegistry.resolve('vision') stub 参数：vision case 不调 getDefaultLLM，传 () => throw 占位，与 Plan 02 adapter 模式一致（避免循环依赖）"
  - "InputBar.test.tsx 更新：paperclip 测试从「aria-disabled 断言」改为「aria-disabled 为 null + 按钮标签为上传图片」（D-08 守门对齐）"
  - "coverage.test.ts 守门：messages.po 变动必须在提交后再跑测试（测试内部 git diff + git checkout 机制）"

duration: 11min
completed: "2026-06-02"
---

# Phase 15 Plan 03: FILE-06 图片上传路径 Summary

**useAttachmentStore 内存 store + InputBar 回形针激活（file input + Ctrl+V paste + chip UI）+ chat.ts sendMessage vision evidence 注入**

## Performance

- **Duration:** 11 min
- **Started:** 2026-06-02T02:04:33Z
- **Completed:** 2026-06-02T02:15:40Z
- **Tasks:** 2
- **Files modified:** 8（1 新建 + 7 改动）

## Accomplishments

- `useAttachmentStore`（`src/store/attachments.ts`）上线：纯内存 Zustand slice，无 persist middleware，满足 NFR-09（base64 不进 localStorage）
- Wave 0 测试脚手架（attachments.test.ts）解除 skip，5 个断言全 PASS：addImages / clearImages / removeImage / 初始空数组 / NFR-09 localStorage.setItem spy
- InputBar 回形针从 `aria-disabled` 激活为可点击：
  - 链接隐藏 file input（`accept="image/png,image/jpeg,image/webp"` + `multiple`）
  - MIME 双重检查（accept 属性 + onChange 内 validMimes）
  - 5MB 单图大小上限（T-15-10 DoS 防御）
  - handlePaste：同步 `clipboardData.items` DataTransfer API（不用 navigator.clipboard，Pitfall 4 守则）
- 缩略图 chip 行：thumbnail img + fileName + × 删除按钮，D-10 多轮复用（发消息后保留，用户手动删）
- styles.css：追加 `.attachment-chips` / `.attachment-chip` / `.attachment-chip-remove` 等样式（teal 克制体系，CSS 变量驱动，无渐变无 backdrop-filter）
- chat.ts sendMessage 扩展：
  - 发消息前检查 `useAttachmentStore.getState().images`
  - 有图 → 一次性调 `AihubmixVisionClient.analyzeImages()`，结果注入 `finalPrompt` 头部
  - 用户气泡 `content: prompt`（original prompt，不含 evidence / base64）
  - catch {} 诚实降级「[注：图片分析失败...]」，不阻断发送（Pitfall 6 / T-15-13）
- Lingui：extract + compile，4 个新字符串加入 zh-CN catalog（上传图片 / 移除图片 / 文件解析即将开放 / 图片过大）

## Task Commits

1. **Task 1: useAttachmentStore 内存 store** - `8a2184b` (feat)
2. **Task 2: InputBar 激活 + styles.css chip + chat.ts vision 注入** - `713aee6` (feat)

## Files Created/Modified

- `src/store/attachments.ts` — 新建：AttachedImage interface + useAttachmentStore（create 无 persist）
- `src/store/attachments.test.ts` — 解除 Wave 0 describe.skip，补全 5 个完整断言
- `src/components/InputBar.tsx` — 激活回形针：fileInputRef + file input + handleFileSelect + handlePaste + chip JSX；import useAttachmentStore/AttachedImage
- `src/components/InputBar.test.tsx` — 更新 paperclip 测试：断言激活状态（标签「上传图片」，无 aria-disabled）
- `src/store/chat.ts` — sendMessage 扩展：import useAttachmentStore/AihubmixVisionClient/VisionConfig/ProviderRegistry；vision evidence 注入逻辑
- `src/styles.css` — 末尾追加 `.attachment-chips` 系列样式（teal 克制，CSS 变量驱动）
- `src/i18n/locales/zh-CN/messages.po` — extract 新增 4 条字符串
- `src/i18n/locales/zh-CN/messages.ts` — compile 更新

## Decisions Made

1. **sendMessage 注入点前移**：vision 调用在 `get().pushMessage(...)` 之前（不是之后），确保 pushMessage 传的 `content: prompt` 是 original prompt（NFR-09 / T-15-08 T-15-12）。

2. **ProviderRegistry.resolve('vision') stub 参数**：vision case 内部不调 getDefaultLLM（只需 aihubmix key），stub 传 `() => { throw new Error('getDefaultLLM not used for vision') }`，语义更清晰（相比 Plan 02 adapter 的 `() => useProviderStore.getState().providers[0]!`），运行期不会被执行。

3. **coverage.test.ts 机制理解**：该测试内部会 `git checkout -- messages.po` 还原文件（若 git diff 非空），因此 messages.po 必须在 Task 2 commit 时一并提交（否则每次测试运行都会还原），避免了死循环。

4. **attachment chips 位置**：放在 selpill-row 之后、textarea 之前（不是 textarea 之后）——与 Plan 描述一致，与 WeChat / Slack 图片 chip 在输入框上方的惯例匹配。

## getDefaultLLM 来源说明

chat.ts sendMessage 中，`ProviderRegistry.resolve('vision', stubFn)` 的 stubFn 永不被调用（vision case 只读 aihubmix storage key）。此模式与 Plan 02（PptAdapter/ExcelAdapter/WordAdapter）一致，避免在 chat store 引入 agentStore 循环依赖。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] InputBar.test.tsx paperclip 测试需更新为激活状态**
- **Found during:** Task 2 全量测试
- **Issue:** 原测试断言 `aria-disabled='true'`（旧禁用状态），Plan 03 激活后测试失败
- **Fix:** 更新为断言 `aria-disabled === null`（激活），标签为「上传图片」（D-08）
- **Files modified:** `src/components/InputBar.test.tsx`
- **Verification:** npm test -- --run 全 PASS（806 passed）
- **Committed in:** `713aee6`（Task 2 commit）

**Total deviations:** 1 auto-fixed (Rule 1 — 测试守门与激活实现对齐)
**Impact on plan:** 零功能影响，测试守门正确反映 D-08 激活状态。

## Known Stubs

无。FILE-06 功能完整实现：
- useAttachmentStore 完整（无 stub）
- InputBar 回形针激活、file input、paste handler 完整
- chat.ts sendMessage vision 注入完整（含失败降级）
- 缩略图 chip UI 完整

## Threat Flags

无新增安全面超出 Plan 已有 threat model：
- T-15-08（base64 不进 content）：pushMessage 传 `content: prompt`，finalPrompt 仅传 runAgent ✓
- T-15-09（MIME 双重检查）：file input accept + onChange validMimes.has(file.type) ✓
- T-15-10（5MB 大图拒绝）：file.size > MAX_IMAGE_SIZE → alert 提示 ✓
- T-15-11（缩略图 base64 仅本地渲染）：img src 含 base64 在 Task Pane 内，无网络传输 ✓
- T-15-12（vision 结果 prompt injection）：evidence 块前缀标记，runAgent 作为普通 string 处理 ✓
- T-15-13（apiKey 不进降级消息）：catch {} 不读 err，只追加固定字符串 ✓

## Self-Check: PASSED
