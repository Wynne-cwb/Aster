---
phase: 15
slug: vis
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
validated: 2026-06-02
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 15-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest（项目现有） |
| **Config file** | vite.config.ts（vitest 配置内嵌） |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run --coverage` |
| **Estimated runtime** | ~15–30 秒 |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run --coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 秒

---

## Per-Task Verification Map

> 任务 ID 在规划阶段（gsd-planner）分配后由 planner 回填。下表为研究阶段的 Req→Test 草图，planner 须把每个 Req 落到具体 task ID + Wave。

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| VIS-01 | get_shape_image read tool 调 adapter.read + wrapReadResult | unit | `npm test -- --run src/agent/tools/read/vision.test.ts` | ✅ | ✅ green |
| VIS-01 | PptAdapter case 'get_shape_image' 正确路径（mock Office API） | unit | `npm test -- --run src/adapters/PptAdapter.read.test.ts` | ✅（扩展） | ✅ green |
| VIS-01 | ExcelAdapter case 'get_shape_image' 正确路径 | unit | `npm test -- --run src/adapters/ExcelAdapter.read.test.ts` | ✅（扩展） | ✅ green |
| VIS-01 | WordAdapter case 'get_shape_image' 正确路径 | unit | `npm test -- --run src/adapters/WordAdapter.read.test.ts` | ✅（扩展） | ✅ green |
| VIS-02 | AihubmixVisionClient 多图 content array 格式 + focus 参数 | unit | `npm test -- --run src/providers/aihubmix-vision.test.ts` | ✅ | ✅ green |
| VIS-02 | ProviderRegistry.resolve('vision') KeyInvalidError | unit | 已有 registry 测试（扩展） | ✅（扩展） | ✅ green |
| VIS-02 | dispatchTool / buildToolsForHost 含 get_shape_image | unit | `npm test -- --run src/agent/tools/tools.test.ts` | ✅（扩展） | ✅ green |
| FILE-06 | useAttachmentStore 内存 slice，无 persist | unit | `npm test -- --run src/store/attachments.test.ts` | ✅ | ✅ green |
| FILE-06 | sendMessage 有附件时调 vision + augmented prompt | unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展） | ✅ green |
| NFR-09 | serializeForStorage 不存 base64（vision tool result） | unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展） | ✅ green |
| NFR-09 | serializeForStorage 不存附件 store base64 | unit | `npm test -- --run src/store/chat.test.ts` | ✅（扩展） | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/agent/tools/read/vision.test.ts` — stubs for VIS-01 get_shape_image ToolDef
- [x] `src/providers/aihubmix-vision.test.ts` — stubs for VIS-02 多图 + focus 扩展
- [x] `src/store/attachments.test.ts` — stubs for FILE-06 内存态附件 store（无 persist）
- [x] PPT/Excel/Word Adapter 扩展 `get_shape_image` case（现有 adapter 测试文件追加）
- [x] `src/store/chat.test.ts` 扩展 NFR-09 serialize-test 守门（现有文件追加，断言任何附带多模态/附件 base64 在序列化时被剥离）

*Existing vitest infrastructure covers framework; 新增 3 个测试文件 + 3 处扩展为 Wave 0 stub 范围。*

---

## Manual-Only Verifications

> 取图 API 与 iframe 粘贴属真机 spike，无法在 vitest（jsdom/mock）下验证真实 Office 宿主行为。失败均有 fallback（引导回形针上传），不阻塞其余工作流。

| Behavior | Requirement | Why Manual | 真机结果（2026-06-02 Office for Web / Edge） |
|----------|-------------|------------|-------------------|
| PPT 取选中图片/图表 shape base64（`shape.getImageAsBase64`，Preview API 未 GA） | VIS-01 | Preview API，Office for Web 行为未知 | ❌ 取图不可用（Preview API 未 GA）→ ✅ fallback 验证通过：agent 识别 type=Image、引导回形针上传，上传据图作答成功。**预期内已知宿主限制，非缺陷** |
| Excel 取激活图表 base64（`chart.getImage()` + `getActiveChartOrNullObject()`） | VIS-01 | getImage GA 但激活图表路径需真机验 | ✅ PASS — 单击激活图表后取图成功，据图作答 |
| Word 取选中 inline picture base64（`InlinePicture.getBase64ImageSrc()`，WordApi 1.1） | VIS-01 | 文档声明 Web 可用，需真机确认 | ✅ PASS — 选中内嵌图取图成功，据图作答 |
| Office for Web Task Pane iframe 内 Ctrl+V 粘贴图片触发 `paste` 事件 | FILE-06 | navigator.clipboard.read 被 Permissions Policy 阻断，须用同步 `paste` 事件 clipboardData.items；真机验是否触发 | ✅ PASS — Ctrl+V 触发 paste 事件，缩略图 chip 正常出现，据图作答 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (取图/粘贴 spike 例外，列入 Manual-Only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (3 新测试文件 + 3 扩展)
- [x] No watch-mode flags (`--run` 强制单次)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter (规划完成、per-task map 回填后)

**Approval:** ✅ 2026-06-02 真机 UAT（Office for Web / Edge）通过 — 核心看图能力 PASS，PPT 取图为已知宿主限制（fallback 兜底）
