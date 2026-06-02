---
phase: 15-vis
verified: 2026-06-02T04:17:51Z
status: passed
human_verification_completed: 2026-06-02
human_verification_note: "下列 4 项人工验证项已于 2026-06-02 真机 UAT（Office for Web / Edge）全部完成且 PASS（结果见 15-05-SUMMARY.md / 15-VALIDATION.md）；保留为版本迭代后的回归检查点。用户已确认收尾。"
score: 14/14 must-haves verified
overrides_applied: 0
human_verification:
  - test: "PPT 宿主：选中图片 shape → agent 调 get_shape_image → 返回 HOST_API_FAILED 引导文案，用户改用回形针上传图 → 据图作答成功"
    expected: "PPT getImageAsBase64 不可用时，agent 输出引导文案「当前无法读取选中图（宿主限制），可点回形针上传这张图」；上传路径可完整端到端作答"
    why_human: "PPT Preview API 不可用是已知宿主限制（真机 2026-06-02 UAT 已完成），但整条 fallback 链路（PPT 取图失败 → 文案 → 用户上传 → 据图作答）属端到端 UX 流程，无法在 vitest jsdom 中验证 Office.js 宿主行为"
  - test: "Excel 宿主：单击激活图表 → 提问「分析这个图表」→ agent 据图作答（文字 evidence）"
    expected: "getActiveChartOrNullObject() 取图成功，vision 返回文字描述，agent 据此给出分析"
    why_human: "ExcelApi 图表激活路径需真实 Office for Web 宿主；vitest mock 无法验证 getImage() 真实 base64 路径"
  - test: "Word 宿主：选中内嵌图 → 提问「描述这张图」→ agent 据图作答"
    expected: "getBase64ImageSrc() 取图成功（WordApi 1.1），vision 返回文字描述"
    why_human: "WordApi 真机路径已在 2026-06-02 UAT 验证 PASS，但每次版本迭代后需人工回归确认 sync 两次路径仍正常"
  - test: "Ctrl+V 粘贴图片：在 Task Pane 内粘贴截图 → 缩略图 chip 出现 → 发送 → 据图作答"
    expected: "paste 事件触发（clipboardData.items），缩略图出现，发送后清空 chip，agent 回答中体现图片内容"
    why_human: "Office for Web iframe Permissions Policy 行为只能真机验证；clipboard API 在 jsdom 中是 stub"
---

# Phase 15：VIS 视觉看图 验证报告

**Phase Goal:** 所有「看图」能力——agent 既能「看」当前文档里**选中**的图片/图表（`get_shape_image` read tool，带可选 focus 参数），也能「看」用户**上传/粘贴**的图片（FILE-06）；两路都走已就位的 aihubmix-vision、返回**文本**作 evidence，图片 base64 不进主 LLM 消息层。

**Verified:** 2026-06-02T04:17:51Z
**Status:** human_needed
**Re-verification:** No — 初始验证

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | AihubmixVisionClient.analyzeImages 支持多张图片 content array | VERIFIED | `src/providers/aihubmix-vision.ts` L44-85：接受 `VisionImage[]`，构建 text+image_url blocks；测试 `aihubmix-vision.test.ts` 5 个用例全绿 |
| 2 | analyze() 向后兼容（内部调 analyzeImages） | VERIFIED | `aihubmix-vision.ts` L92-99：`analyze()` 委托给 `analyzeImages([{base64, mimeType}], ...)`；测试 `it('单图调用内部委托给 analyzeImages')` PASS |
| 3 | DocumentAdapter.ReadableQuery 包含 get_shape_image kind | VERIFIED | `src/adapters/DocumentAdapter.ts` L181：`\| { kind: 'get_shape_image'; focus?: string }` 已加入 union type |
| 4 | get_shape_image read tool 存在，kind='read'，可选 focus 参数 | VERIFIED | `src/agent/tools/read/vision.ts`：`getShapeImage.kind = 'read'`，`parameters.required = []`，`focus` 属可选 string；`vision.test.ts` 5 个用例绿 |
| 5 | 三宿主 adapter.read() 均处理 get_shape_image case | VERIFIED | `PptAdapter.ts` L564、`ExcelAdapter.ts` L310、`WordAdapter.ts` L1698：三个 case 均实现 |
| 6 | PPT case 用 getSelectedShapes()+getImageAsBase64()（Preview API）；失败返回 HOST_API_FAILED 引导上传 | VERIFIED | `PptAdapter.ts` L564-645：完整实现；真机 UAT 2026-06-02 确认 fallback 路径正确触发（VALIDATION.md 真机结果栏） |
| 7 | Excel case 用 getActiveChartOrNullObject()+getImage()；未激活图表返回 NOT_FOUND | VERIFIED | `ExcelAdapter.ts` L304-356：`getActiveChartOrNullObject()` + `isNullObject` 判断 + `getImage()` + vision 调用，完整实现 |
| 8 | Word case 用 getBase64ImageSrc()（两次 sync）；无图返回 NOT_FOUND | VERIFIED | `WordAdapter.ts` L1698-1746：两次 `ctx.sync()`（sync 1 load items，sync 2 触发 ClientResult），空选区返回 NOT_FOUND |
| 9 | get_shape_image 已注册到三宿主 buildToolsForHost + PPT_TOOLS set | VERIFIED | `tools/index.ts` L41（PPT_TOOLS），L259（word），L276（excel），L293（ppt）：4 处注册确认 |
| 10 | 三宿主 adapter 内 base64 被 vision 消费，ToolResult.data 只含 vision_result 纯文本 | VERIFIED | PPT L628：`data: { vision_result: content }`；Excel L348：同；Word L1738：同；base64 不出 case 边界 |
| 11 | useAttachmentStore 为纯内存态，无 persist middleware | VERIFIED | `src/store/attachments.ts`：`create<AttachmentState>(...)` 直调，无 `persist()`；NFR-09 测试 `localStorage.setItem not called` PASS |
| 12 | InputBar 回形针激活：file input accept 限图片，onChange+paste 处理，缩略图 chip | VERIFIED | `InputBar.tsx` L251-268：按钮 `onClick={() => fileInputRef.current?.click()}`；L265 `accept="image/png,image/jpeg,image/webp"`；L169-181 paste handler；L194-216 chip 渲染 |
| 13 | sendMessage 有附件时一次性调 analyzeImages，base64 不进 Message.content | VERIFIED | `chat.ts` L176-213：`images.length > 0` 分支，`pushMessage({ content: prompt })`（原始 prompt，不含 base64），vision 结果进 `finalPrompt` 不进 message |
| 14 | NFR-09 守门：chat.test.ts 两个 serialize-test 断言 base64 不进历史 | VERIFIED | `chat.test.ts` L298-366：路径 A（tool role 含 base64_raw 被过滤）、路径 B（user message.content 纯 prompt）；32 个 Phase 15 相关测试全绿 |

**Score:** 14/14 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/providers/aihubmix-vision.ts` | VisionImage 接口 + analyzeImages 多图方法 | VERIFIED | 101 行，exports VisionImage/VisionResult/AihubmixVisionClient；analyzeImages L44 完整实现 |
| `src/adapters/DocumentAdapter.ts` | ReadableQuery 新增 get_shape_image kind | VERIFIED | L181 union 末尾 `\| { kind: 'get_shape_image'; focus?: string }` |
| `src/providers/aihubmix-vision.test.ts` | VIS-02 多图测试 | VERIFIED | 91 行，5 用例：多图 content array 格式、apiKey 安全、stream:false、网络失败、向后兼容 |
| `src/store/attachments.test.ts` | FILE-06 内存态 store 测试 | VERIFIED | 55 行，5 用例含 NFR-09 localStorage spy |
| `src/agent/tools/read/vision.ts` | getShapeImage ToolDef（第 12 个 read tool） | VERIFIED | 46 行，kind='read'，focus 可选，execute 调 adapter.read+wrapReadResult |
| `src/agent/tools/read/vision.test.ts` | VIS-01 工具定义测试 | VERIFIED | 存在，5 个用例绿 |
| `src/adapters/PptAdapter.ts` | case 'get_shape_image'（SPIKE + fallback） | VERIFIED | L564-647；SPIKE 注释含真机结果；HOST_API_FAILED fallback |
| `src/adapters/ExcelAdapter.ts` | case 'get_shape_image'（getActiveChartOrNullObject） | VERIFIED | L310-356；getActiveChartOrNullObject + getImage + analyzeImages |
| `src/adapters/WordAdapter.ts` | case 'get_shape_image'（getBase64ImageSrc 两次 sync） | VERIFIED | L1698-1746；两次 ctx.sync 正确实现 Pitfall 3 守门 |
| `src/agent/tools/index.ts` | PPT_TOOLS + buildToolsForHost 三宿主注册 | VERIFIED | L41 PPT_TOOLS，L259/276/293 三宿主 case 均含 getShapeImage |
| `src/store/attachments.ts` | 内存态附件 store（AttachedImage[]，无 persist） | VERIFIED | 47 行，无 persist middleware，exports useAttachmentStore/AttachedImage |
| `src/components/InputBar.tsx` | 激活回形针 + file input + paste handler + 缩略图 chip | VERIFIED | L109-181 上传/paste 逻辑；L194-216 chip UI；L251-268 激活按钮 |
| `src/store/chat.ts` | sendMessage 扩展：vision 注入 + augmented prompt | VERIFIED | L175-213；visionPreparing 状态、analyzeImages 调用、finalPrompt 注入、clearImages |
| `src/store/chat.test.ts` | NFR-09 serialize-test 守门（2 个新 it 断言） | VERIFIED | L298-366；路径 A（tool base64 被过滤）+ 路径 B（user content 无 base64） |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `vision.ts` getShapeImage | `DocumentAdapter.ts` ReadableQuery | `ctx.adapter.read({ kind: 'get_shape_image', focus })` | WIRED | L40 直接调用，ReadableQuery union 包含此 kind |
| `PptAdapter.ts` get_shape_image case | `AihubmixVisionClient.analyzeImages` | vision client 实例调用 | WIRED | L620：`new AihubmixVisionClient().analyzeImages(...)` |
| `ExcelAdapter.ts` get_shape_image case | `AihubmixVisionClient.analyzeImages` | vision client 实例调用 | WIRED | L341：同 |
| `WordAdapter.ts` get_shape_image case | `AihubmixVisionClient.analyzeImages` | vision client 实例调用 | WIRED | L1731：同 |
| `tools/index.ts` | `PPT_TOOLS` set | Set 成员追加 | WIRED | L41 `'get_shape_image'` 在 PPT_TOOLS |
| `InputBar.tsx` | `useAttachmentStore.addImages` | 回形针 onChange + paste handler | WIRED | L153 `useAttachmentStore.getState().addImages(results)` |
| `chat.ts` sendMessage | `AihubmixVisionClient.analyzeImages` | 发送前 vision 注入 | WIRED | L196 `await new AihubmixVisionClient().analyzeImages(...)` |
| `chat.ts` sendMessage | `useAttachmentStore` | `getState().clearImages()` | WIRED | L211 发送后清空附件 |
| `chat.ts` sendMessage | `agentStore.setVisionPreparing` | visionPreparing 指示 | WIRED | L186/L210 set/clear |
| `ChatStream.tsx` | `agentStore.visionPreparing` | 「看图中」气泡 | WIRED | L281/L458 消费 visionPreparing |
| `chat.test.ts` | `chat.ts serializeForStorage` | saveHistory + localStorage mock | WIRED | L318/L355 验证序列化边界 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `PptAdapter.ts` get_shape_image | `base64` | `shape.getImageAsBase64()` Preview API | SPIKE：真机 Web 不可用 → fallback HOST_API_FAILED | FLOWING（fallback 路径） |
| `ExcelAdapter.ts` get_shape_image | `base64` | `chartOrNull.getImage().value` ExcelApi 1.2 | 真机 2026-06-02 UAT PASS | FLOWING |
| `WordAdapter.ts` get_shape_image | `base64` | `pic.getBase64ImageSrc().value` WordApi 1.1 | 真机 2026-06-02 UAT PASS | FLOWING |
| `chat.ts` sendMessage（FILE-06 路径） | `images` | `useAttachmentStore.getState().images` | 内存 store，用户上传/粘贴填充 | FLOWING |
| `chat.ts` sendMessage → `finalPrompt` | `content` | `AihubmixVisionClient.analyzeImages()` 返回文本 | 真机 UAT PASS（据图作答成功） | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| vision.test.ts 5 个用例 | `npm test -- --run src/agent/tools/read/vision.test.ts` | 5 passed | PASS |
| aihubmix-vision.test.ts 5 个用例 | `npm test -- --run src/providers/aihubmix-vision.test.ts` | 5 passed | PASS |
| attachments.test.ts 5 个用例 | `npm test -- --run src/store/attachments.test.ts` | 5 passed | PASS |
| chat.test.ts NFR-09 serialize-test | `npm test -- --run src/store/chat.test.ts` | 17 passed（含 2 个 NFR-09 守门） | PASS |
| 全套 811 个测试 | `npm test -- --run` | 811 passed，3 errors（已知 retry.test.ts 噪音） | PASS |
| Office for Web 真机 UAT（Excel 取图） | 真机，非命令行可验 | 2026-06-02 PASS | SKIP（见 Human Verification） |
| Office for Web 真机 UAT（Word 取图） | 真机，非命令行可验 | 2026-06-02 PASS | SKIP（见 Human Verification） |
| PPT fallback 引导路径 | 真机，非命令行可验 | 2026-06-02 PASS | SKIP（见 Human Verification） |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| VIS-01 | 15-01, 15-02, 15-05 | 选中图取图：get_shape_image read tool，三宿主 adapter，focus 参数 | SATISFIED | vision.ts ToolDef + 三 adapter case + buildToolsForHost 注册；真机 Excel/Word PASS，PPT fallback PASS |
| VIS-02 | 15-01, 15-02, 15-05 | aihubmix-vision 客户端多图支持，analyzeImages() | SATISFIED | VisionImage 接口 + analyzeImages 实现 + 向后兼容 analyze()；5 个测试绿 |
| FILE-06 | 15-01, 15-03, 15-05 | 用户上传/粘贴图片，内存态 store，回形针 + Ctrl+V | SATISFIED | attachments.ts store + InputBar 激活 + paste handler + chip UI；真机 Ctrl+V 粘贴 PASS |
| NFR-09 | 15-01, 15-03, 15-04 | base64 不进主 LLM 消息层，不进聊天历史持久化 | SATISFIED | serializeForStorage 白名单天然过滤 tool role；2 个 NFR-09 守门测试（路径 A/B）绿；attachments store 无 persist |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| 无 | — | 无 blocker 级反模式 | — | — |

**注：** PptAdapter.ts 中 `as unknown as {...}` 转型是已知必要 workaround（Office Preview API 无 @types/office-js 类型，代码注释已说明）。非反模式，属已知技术债。

---

### Human Verification Required

#### 1. PPT fallback 完整链路 UAT（已完成但需版本回归）

**Test:** 在 PPT 文档选中一张图片 shape → 提问「分析这张图」→ 确认 agent 返回引导文案「当前无法读取选中图（宿主限制），可点回形针上传这张图」→ 点回形针上传同一图 → 提问 → 据图作答成功

**Expected:** fallback 引导文案出现（而非崩溃/静默）；上传后能正常分析

**Why human:** PPT getImageAsBase64 是 Preview API，只在真机 Office for Web 可验行为；vitest 中 Office.js 为 mock 无法复现宿主 API 不存在的运行时错误

**先前结果（2026-06-02）:** PASS — 已于真机验证

---

#### 2. Excel 激活图表取图端到端

**Test:** 打开 Excel，插入图表 → 单击图表激活 → 提问「这个图表显示了什么数据」→ 确认 agent 据图作答（返回具体数据描述而非错误）

**Expected:** getActiveChartOrNullObject 返回非 null object，getImage 取 JPEG base64，vision 返回文字，agent 作答含图表内容

**Why human:** ExcelApi 图表激活路径（单击激活→ getActiveChartOrNullObject 非 null）需真机 Office for Web 验证；mock 测试覆盖逻辑但不覆盖宿主 API 真实行为

**先前结果（2026-06-02）:** PASS — 已于真机验证

---

#### 3. Word 内嵌图取图端到端

**Test:** 打开 Word，插入图片 → 单击选中图片 → 提问「描述这张图」→ 确认 agent 据图作答

**Expected:** getBase64ImageSrc 成功（两次 sync 正确执行），返回具体图片描述

**Why human:** WordApi 两次 sync 路径需真机验证；getBase64ImageSrc ClientResult 行为只在真机宿主中可验

**先前结果（2026-06-02）:** PASS — 已于真机验证

---

#### 4. Ctrl+V 粘贴图片端到端

**Test:** 截图后 Ctrl+V 粘贴到 InputBar 的 textarea → 确认缩略图 chip 出现 → 发送任意消息 → 确认 chip 自动清除，且 agent 回答体现图片内容

**Expected:** paste 事件触发（clipboardData.items 取图）；chip 显示；发送后清空；vision 据图作答

**Why human:** Office for Web Task Pane iframe 的 Permissions Policy 行为（clipboard API / paste 事件触发）只能在真机 Office for Web + Edge/Chrome 中验证

**先前结果（2026-06-02）:** PASS — 已于真机验证

---

### Gaps Summary

无 blocker 级 gap。所有 14 个 must-have truths 均 VERIFIED。

人工验证项均已于 2026-06-02 真机 UAT（Office for Web / Edge）完成，结果全 PASS。此处列出是作为持续回归检查点——每次代码改动后，如涉及 adapter read 路径或 InputBar paste 逻辑，建议重新执行相应真机验证。

---

_Verified: 2026-06-02T04:17:51Z_
_Verifier: Claude (gsd-verifier)_
