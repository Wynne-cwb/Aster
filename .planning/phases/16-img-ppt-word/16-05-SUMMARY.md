---
phase: 16-img-ppt-word
plan: "05"
subsystem: image-gen-ui
tags: [IMG-03, IMG-04, image-result-card, loop-insert, doubao-cors, tool-timeout, toast, product-pivot, NFR-09]

requires:
  - phase: 16-img-ppt-word
    plan: "02"
    provides: PptAdapter.addImageShape / WordAdapter.insertBodyImage + 裸 base64 spike 结论 + insertImage helper
  - phase: 16-img-ppt-word
    plan: "03"
    provides: generate_ppt/word_image ToolDef 存根 + per-host 注册 + AihubmixImageClient signal
  - phase: 16-img-ppt-word
    plan: "04"
    provides: Settings 生图 model picker + PREF_IMAGE_GEN_MODEL 持久化

provides:
  - generate_ppt_image / generate_word_image loop 内自动直插（返回 shape_id 供 AI 自主排版）
  - ImagePreviewCard 只读结果卡（缩略图 +「已插入到 X」标签，无操作按钮）
  - ChatStream ToolResultCard 集成只读卡（inserted:true 信号）
  - ToolDef.timeoutMs per-tool 超时覆盖机制（生图 120s）
  - 极简可复用 toast 系统（store/toast.ts + components/Toast.tsx）
  - doubao b64_json 内联（消除 CORS）+ watermark:false

affects: [18-lib]

tech-stack:
  added: []
  patterns:
    - "生图工具 loop 内直插：execute 生图后直接调 adapter.addImageShape/insertBodyImage，返回 shape_id + inserted:true + thumbnail；reverse 走标准 write-tool 路径（loop-helpers 自动 appendOperation，单一 undo 记录）"
    - "ToolDef.timeoutMs per-tool 超时覆盖：dispatchTool effectiveTimeout = def.timeoutMs ?? TOOL_TIMEOUT_MS；慢工具（生图 120s）覆盖默认 15s"
    - "doubao 生图用 response_format:'b64_json' 内联拿 base64（{output:[{bytesBase64}]}），不返回跨源 TOS 签名 URL（无后台浏览器直连下 URL 模式被 CORS 拦死）"
    - "只读结果卡范式：tool message 携带 inserted:true + thumbnail（内存态 base64），UI 只读展示；tool role 不进 serializeForStorage 白名单 → base64 不持久化（NFR-09 由白名单机制保证）"
    - "极简单条 toast：zustand store（showToast/clearToast，~2s 自动消失）+ 顶层挂载 Toast 组件（fixed 底部居中，teal 克制）"

key-files:
  created:
    - src/components/ImagePreviewCard.tsx
    - src/components/Toast.tsx
    - src/store/toast.ts
  modified:
    - src/agent/tools/write/ppt-image.ts
    - src/agent/tools/write/word-image.ts
    - src/agent/tools/index.ts
    - src/providers/aihubmix-image.ts
    - src/components/ChatStream.tsx
    - src/components/ChatBubble.tsx
    - src/components/InputBar.tsx
    - src/App.tsx
    - src/styles.css
    - src/lib/insertImage.ts

key-decisions:
  - "产品反转：IMG-03 由「预览后确认再插入」→ AI loop 内自动直插 + 只读缩略图展示（确认卡打断 AI 自主排版 loop，与 AI 自动化愿景 + 信任 agent 哲学冲突）"
  - "撤销走标准 write-tool reverse 路径（工具返回 reverse descriptor → loop-helpers 自动 appendOperation），不走 insertImage helper 的手动 appendOperation，避免 loop 内双重记录 / stepIndex 冲突"
  - "doubao 改 response_format:'b64_json' 内联拿 base64（消除 CORS）；mimeType 默认 image/jpeg（响应无 mimeType 字段）；watermark:false（用户去水印）"
  - "ToolDef 加可选 timeoutMs；生图工具 120s 覆盖默认 15s（doubao 2K ~21s、gpt-image-2 high ~90s+ 会被默认值误杀）"
  - "generate_*_image catch(err) 不再吞错：console.error（devtools）+ key-safe err.message 进 hint（错误类型 message 全是固定字面量、不含 key）"
  - "insertImage.ts helper 保留供 Phase 18 图库复用，当前无 loop 内调用方、不进 main bundle"
  - "重新生成/取消按钮取消，改对话式（用户说「换一张」/「用 gpt-image-2 重画」AI 重调工具）；卡内 model 下拉移除，model 仍可选（Settings picker IMG-04 + 工具 model_id 参数）"

requirements-completed:
  - IMG-03
  - IMG-04

metrics:
  duration: ~跨多轮真机 UAT（3 个 blocker fix + 1 次产品反转）
  tasks: 2 code tasks + 1 真机 UAT checkpoint（含 3 轮 blocker fix + 1 轮产品反转）
  files: 13（3 created / 10 modified）
  commits: 9（16-05 范围）
  tests: 830 passed / 66 files（尾部 3 retry errors 是已知噪音，非真失败）
  bundle: main 78.45 KB gzip（≤82KB 门内；main-Cw3bBvtU.js）
completed: 2026-06-02
---

# Phase 16 Plan 05: 生图 UI + loop 内自动直插 Summary

**打通生图全流程并经多轮真机 UAT 收尾：generate_ppt/word_image 改为 agent loop 内自动直接插入文档（返回 shape_id 供 AI 后续 move_shape/set_shape_property 自主排版），聊天保留只读缩略图结果卡。真机 UAT 全程暴露并修复 3 个阻塞性 bug（doubao CORS、吞错、15s 超时误杀），最终按用户拍板反转「预览确认」设计为「AI 自动直插」。**

## 完成内容

### 最终交付形态（产品反转后）

- **`generate_ppt_image`（IMG-01/IMG-03）loop 内自动直插**：execute 生图后直接调 `adapter.addImageShape`（居中默认位置 D-06）插入当前 slide（`slide_index` 可选参数，默认 1），返回 `data: { shape_id, slide_index, mimeType, prompt, thumbnail, inserted: true }`。`shape_id` 让 AI 后续用 `move_shape` / `set_shape_property` / `rotate_shape` 自主调整位置与大小完成版面。
- **`generate_word_image`（IMG-02/IMG-03）**：直接调 `adapter.insertBodyImage` 插入 body 末尾，返回 `thumbnail + inserted:true`。
- **`ImagePreviewCard` 只读结果卡**：仅展示已插入图片缩略图 +「已插入到 PPT / Word」标签，props 精简为 `{ base64, mimeType, host }`，无任何操作按钮。
- **ChatStream ToolResultCard 集成**：检测 `toolResult.data.inserted === true`，读 `thumbnail` 渲染只读卡（lazy chunk，守 ≤82KB main 预算）。
- **撤销接线**：PPT `delete_shape_by_id`（Record 对象 `{slide_index, shape_id}`）+ postState（camelCase）走标准 write-tool reverse 路径（loop-helpers 自动 appendOperation，单一 undo 记录，与 add_shape 一致）；Word `noop_inverse`（诚实，不支持自动撤销）。`operationLog.integration.test` 守门 36 passed。
- **IMG-04 model 可选保留**：Settings 生图 model picker（16-04）+ 工具 `model_id` 参数（对话式指定）。卡内 model 下拉随只读化移除。

## 真机 UAT 全程发现并修复的 3 个 Blocker（Deviations / Issues）

真机 UAT 是本 plan 的 human-verify checkpoint。用户在 Office for Web 实测，连续暴露 3 个仅真机可见的阻塞性 bug，逐个用 `.env.local` key curl 实锤根因后修复：

### Blocker a：doubao URL 模式触发 CORS（核心阻塞）

- **现象**：`generate_ppt_image` 返回 ok=false，但 Network 看到图片成功返回。
- **根因（curl 实锤）**：doubao 默认 `response_format:'url'` 返回火山 TOS 签名 URL（host `ark-acg-cn-beijing.tos-cn-beijing.volces.com`）。`aihubmix-image.ts` 的 `fetchUrlToBase64()` 从 github.io 源二次 fetch 该 URL 被 CORS 拦死（No `Access-Control-Allow-Origin`）。无后台浏览器直连架构下 URL 模式根本不可行。
- **修复**：doubao 改 `response_format:'b64_json'`——curl 实锤 HTTP 200，响应 `{ output: [{ bytesBase64 }] }`（output 是数组、每项仅 bytesBase64、无 mimeType 字段），解码确认 JPEG（magic `ffd8ffe0`），~129KB（2K 尺寸约 615KB base64）。直接 `return { base64: bytesBase64, mimeType: 'image/jpeg' }`，删除 `fetchUrlToBase64` helper（已无引用）。
- **跨 Phase 14 文件**：`src/providers/aihubmix-image.ts`（合理 deviation——doubao 是 16-05 默认生图 model，CORS 是 UAT 直接阻塞根因）。
- **Commit**：`0238617`

### Blocker b：generate_*_image 工具吞真错误

- **根因**：两工具 execute 的 `catch {}` 吞掉真错误（CORS 等），用户只见笼统句、无从诊断。
- **修复**：改 `catch (err)` → `console.error('[generate_*_image] 生图失败', err)`（仅 devtools，不进 chat history）+ `error.hint` 透传 `err.message`（key-safe：所有错误类型 NetworkError/mapHttpError/KeyInvalidError 的 message 都是固定中文字面量、不含 key，T-16-08 仍满足）。`error.message`（给用户的笼统句）不变。
- **Commit**：`c1a6093`

### Blocker c：dispatchTool 15s 通用超时误杀 21s 的 doubao 生图

- **根因（curl 实锤）**：`dispatchTool` 给每个工具套 15s `Promise.race` 超时（`TOOL_TIMEOUT_MS`）。doubao 2K 出图 ~21s（size 只接受 '2K'，固有耗时不可压）、gpt-image-2 high ~90s+。21s > 15s → race 超时先赢 → 误判 ok=false；但真 fetch 后台跑完（Network 看到成功），因是 race 超时非 controller abort，loop 没停还重试第二次。
- **修复**：`ToolDef` 加可选 `timeoutMs?: number`；`dispatchTool` 用 `effectiveTimeout = def.timeoutMs ?? TOOL_TIMEOUT_MS`；生图工具各加 `timeoutMs: 120_000`（覆盖 doubao 21s + gpt-image-2 high ~90s+ 余量）。超时 message 字面量不变。测试 +2 条（覆盖生效 + 短覆盖按自身值超时）。
- **跨 Phase 14 文件**：`src/agent/tools/index.ts`（dispatchTool 在共享层）。
- **Commit**：`7ff25fe`

### 附带改动

- **doubao `watermark: false`**（用户要求去水印——生成图插进用户自己的 PPT/Word，不应带豆包水印）。Commit `cb68cdd`。
- **复制成功 toast**（新增极简可复用 toast 系统）：用户要求「复制调试信息」成功后有 toast 反馈。新建 `src/store/toast.ts`（单条 toast zustand store，~2s 自动消失）+ `src/components/Toast.tsx`（fixed 底部居中，teal 克制：`--surface` 底 + teal `--accent` 左竖条 + CheckIcon + `--shadow-pop`，role=status aria-live=polite）+ App 顶层挂载 + InputBar `handleCopyDebug` 接入 `showToast(t\`已复制到剪贴板\`)`，移除原内联「已复制」反馈。Commit `5100fc4`。

## 产品反转（最终交付形态，用户拍板）

re-UAT 通过后，用户做了产品方向改动并拍板：**反转 D-02 解耦 + IMG-03「预览后确认」→ AI 自动直插 + 只读缩略图**。

- **理由**：确认卡打断了 AI 自主排版流程——PPT 已有 move_shape / set_shape_property 等工具，AI 插完图就能自己调位置完成版面；人工确认打断这个 loop，与「AI 自动化操作」愿景及既有「无授权 UX / 信任 agent」哲学冲突（见 memory `project_aster_privacy_simplified`）。
- **变化**：
  - 工具从「返回 preview_pending、不写文档、等确认卡」→「loop 内直接插入、返回 shape_id + inserted:true」。
  - UI 从「预览卡 + 确认/重新生成/取消三按钮 + 卡内 model 下拉」→「只读缩略图 +「已插入到 X」标签」。
  - 「重新生成/取消」按钮取消，改对话式（用户说「换一张」/「用 gpt-image-2 重画」→ AI 重调工具）。
  - model 仍可选（Settings picker IMG-04 + 工具 `model_id` 参数），仅卡内下拉移除。
- **Commits**：`93a8740`（工具直插 + reverse）、`58e2231`（UI 只读卡）。

## insertImage.ts helper 取舍

`src/lib/insertImage.ts`（16-02 交付）原由预览卡按钮调用。产品反转后工具走标准 write-tool reverse 路径，helper 不再被 loop 内调用。**决定保留**（供 Phase 18 Pexels 图库「选中插入」复用，届时由 UI 按钮触发非 loop 内），更新注释说明当前无调用方、不进 main bundle。若 Phase 18 决定也走工具路径可删除本文件。

## Spike 结论

- **doubao 2K 固有 ~21s**（curl 实测），size 参数仅接受 '2K'（'1K' / '1024x1024' 被 API 400 拒），不能靠改 size 压缩耗时；生图非流式、不受 chat P95≤10s 约束。
- **doubao b64_json 响应结构**：`{ output: [{ bytesBase64 }] }`，JPEG（magic ffd8ffe0），~129KB / 2K 约 615KB base64，无 mimeType 字段。
- **裸 base64 插图**（16-02 spike 复用）：`fill.setImage` / `insertInlinePictureFromBase64` 接受裸 base64（无 data: 前缀）。

## NFR-09 守门保持

thumbnail base64 进内存 tool message（供 UI 即时渲染只读缩略图），但 `serializeForStorage` 白名单只存 user/assistant 文字消息、`role === 'tool'` 整条丢弃 → thumbnail base64 **永不进 localStorage**。这由白名单机制保证（与组件本地 state 无关）。`chat.test.ts` NFR-09 路径 C 守门已更新为 thumbnail + inserted 结构。

## 验证

- `npm test -- --run`（全量）→ **830 passed / 66 files**（含 ppt-image/word-image inserted+reverse 断言、operationLog.integration 36 passed、chat NFR-09 路径 C、dispatchTool timeoutMs 覆盖 2 条、aihubmix-image doubao b64_json）；尾部 3 retry errors 是已知噪音（memory `project_i18n_extract_and_test_noise`），0 真失败。
- `npm run build` → tsc 0 error，vite build 成功。
- `npm run size` → main **78.45 KB** gzip（≤82KB 门内）。
- `npm run extract` → message count 134（toast 文案）；messages.po/.ts 已同步提交。
- **真机 re-UAT PASS**：AI 自主挪图排版、对话式重画、Word 直插、Excel 诚实拒绝、NFR-09（清空历史后不含 base64）全部通过。

## 后续 Plan 衔接

- **Phase 18 LIB**：`insertImage.ts` helper 保留供 Pexels 图库「选中插入」复用（UI 按钮触发路径）。若决定走工具路径，可删 helper 并复用生图工具的直插 + reverse 范式。
- **Phase 19 UAT + Release**：本 plan 已完成三宿主真机 UAT 关键路径；v2.2 整体 UAT 时复测。

## Self-Check: PASSED

- 创建文件全部存在：src/components/ImagePreviewCard.tsx、src/components/Toast.tsx、src/store/toast.ts、16-05-SUMMARY.md
- commits 全部存在：ea959ec / c94fc60 / 0238617 / c1a6093 / cb68cdd / 5100fc4 / 7ff25fe / 93a8740 / 58e2231
