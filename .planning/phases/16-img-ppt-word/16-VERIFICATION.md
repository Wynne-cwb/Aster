---
phase: 16-img-ppt-word
verified: 2026-06-02T11:10:00Z
status: passed
human_verification_completed: 2026-06-02
human_verification_note: "真机 UAT（Office for Web，PowerPoint/Word/Excel）已于 2026-06-02 全部完成且 PASS——含 PPT 生图自动直插+撤销、AI 自主挪图排版（move_shape/set_shape_property，验证 shape_id 接线）、对话式重新生成（gpt-image-2）、Word body 级直插+noop 诚实标注、Excel 诚实拒绝、NFR-09 base64 不进 history。用户已确认收尾。"
score: 16/16 must-haves verified
overrides_applied: 0
requirements_verified: [IMG-01, IMG-02, IMG-03, IMG-04, IMG-05]
design_change: "IMG-03 / D-01/02/03 由「预览后确认再插入」反转为「AI loop 内自动直插 + 只读结果卡」（2026-06-02 真机 UAT 后用户拍板，理由：确认卡打断 AI 自主排版 loop，与 AI 自动化愿景及既有无授权 UX 哲学冲突）。已同步更新 ROADMAP Goal/Success Criteria 与 REQUIREMENTS.md IMG-03 文字。"
---

# Phase 16：IMG — 图片生成插入（PPT + Word）验证报告

**Phase Goal:** PPT/Word「生成一张图并插入」write tool，AI 在 loop 内自动插入（无人工确认打断，只读结果卡展示），model 可选；产出可复用 insert helper（供 Phase 18），图片 base64 不进 history。

**Verified:** 2026-06-02T11:10:00Z
**Status:** passed
**Re-verification:** No — 初始验证（真机 UAT PASS 后收尾）

## 验证方式

- **真机 UAT（Office for Web）**：用户 2026-06-02 在 PowerPoint / Word / Excel 三宿主实测全流程，PASS（结果见 16-05-SUMMARY.md）。
- **自动化测试**：`npm test` 830 passed / 66 files（尾部 3 个 retry.test.ts errors 为已知噪音，非真失败）；`operationLog.integration.test.ts` 36 passed（含 Phase 16 撤销守门）。
- **构建/预算**：`npm run build` tsc 0 error；main chunk 78.45 KB gzip（≤82KB 门内）。
- **代码 spot-check**：协调者逐 plan 核对 commit/文件/SUMMARY/ROADMAP 勾选。
- code-review 闸门：用户跳过（建议性，不阻塞）。

## Must-haves（对照交付代码 + 真机 UAT）

| # | Must-have | 证据 | 状态 |
|---|-----------|------|------|
| 1 | PPT 生成→自动插入当前 slide（D-02 反转后 loop 内直插） | `ppt-image.ts` execute 调 `adapter.addImageShape`（居中 D-06）；真机 UAT PASS | ✓ |
| 2 | PPT 插入返回 shape_id，AI 可继续自主排版 | `ppt-image.ts` 返回 `data.shape_id`；真机让 AI「移到右上角缩小」用 move_shape/set_shape_property 成功 | ✓ |
| 3 | PPT undo 可撤（deleteShapeById） | `reverse: delete_shape_by_id`（Record 对象）走标准 reverse 路径；operationLog 守门 PASS；真机撤销 PASS | ✓ |
| 4 | Word body 级生图插入（insertInlinePictureFromBase64） | `word-image.ts` 调 `adapter.insertBodyImage`（裸 base64，spike 确认 body 级规避 #3434）；真机 PASS | ✓ |
| 5 | Word undo 诚实标 noop | `reverse: noop_inverse`；DiffLog 标「不支持自动撤销」；真机 PASS | ✓ |
| 6 | 生图 model 可切（IMG-04） | Settings 生图 model picker（16-04，PREF_IMAGE_GEN_MODEL）+ 工具 `model_id` 参数；registry image-gen 读 storage 覆盖默认 doubao | ✓ |
| 7 | 重新生成路径（IMG-04） | 对话式（「换一张/用 gpt-image-2 重画」→ AI 重调工具直插）；真机 PASS | ✓ |
| 8 | Excel 诚实报「不支持插图」（IMG-05） | generate 工具仅注册到 ppt/word host（buildToolsForHost，tools-host.test 守门）；真机 Excel 诚实拒绝 | ✓ |
| 9 | 可复用 insert helper（供 Phase 18） | `src/lib/insertImage.ts` 保留（双 host 重载 + appendOperation）；当前 loop 内走标准 reverse 路径，helper 留给 Phase 18 图库 | ✓ |
| 10 | 图片 base64 不进 history（NFR-09 路径 C） | thumbnail base64 仅进内存态 tool message；serializeForStorage 白名单只存 user/assistant 文字，tool role 整条丢弃；chat.test 守门；真机清空+重载验证 | ✓ |
| 11 | 生成中 loading 态（D-08） | 生图非流式、一次性返回；工具进行中由 agent loop 指示；ctx.signal 真取消（取消按钮透传 fetch signal） | ✓ |
| 12 | apiKey 仅 header，不进 error.message/body（T-14-01/T-16-08） | aihubmix-image 三路 apiKey 仅注入 Authorization/x-goog-api-key；KeyInvalidError 路径字面量中文；工具错误 hint 透传的是固定字面量 NetworkError message | ✓ |
| 13 | 生图工具加入 PPT_TOOLS Set（Phase 14 casing 守门） | `tools/index.ts` PPT_TOOLS 含 generate_ppt_image；dispatch.test casing 守门 | ✓ |
| 14 | 零新增 npm 依赖 | 仅原生 fetch + 既有库；package.json 无新增 | ✓ |
| 15 | bundle ≤82KB gzip | main 78.45 KB（size-limit 门内） | ✓ |
| 16 | 测试脚手架 + 守门齐备（16-01） | ppt-image/word-image test、operationLog 守门、NFR-09 路径 C、tools-host 全部解 skip 并通过 | ✓ |

## 真机 UAT 暴露并已修复的问题（过程记录，详见 16-05-SUMMARY.md）

1. **doubao CORS（critical）**：`response_format:'url'` 返回火山 TOS 签名 URL → 浏览器跨源 fetch 被 CORS 拦死。修复：改 `b64_json` 内联（curl 实锤 HTTP 200，`{output:[{bytesBase64}]}`，JPEG）。跨 Phase 14 文件 `aihubmix-image.ts`。
2. **吞错（warning）**：`generate_*_image` 的 `catch{}` 吞真错误。修复：`catch(err)`+console.error+key-safe err.message 进 hint。
3. **15s 超时误杀（critical）**：`dispatchTool` 通用 15s 超时 < doubao 2K 的 21s。修复：ToolDef 加 `timeoutMs`，生图工具 120s 覆盖。跨 Phase 14 文件 `tools/index.ts`。
4. 附带：doubao `watermark:false`（去水印）；复制成功 toast。

## 结论

**PASS。** Phase 16 目标达成：PPT/Word 生图自动插入 write tool 已交付，AI 可在 loop 内自主排版（符合「AI 自动化操作」愿景），model 可选，insert helper 留给 Phase 18，base64 不进 history。IMG-01~05 全部交付并真机验证。设计较原计划反转（确认卡 → 自动直插），已在 ROADMAP/REQUIREMENTS 同步并记录理由。
