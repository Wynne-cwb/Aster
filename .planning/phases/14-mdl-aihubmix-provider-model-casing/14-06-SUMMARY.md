---
phase: 14-mdl-aihubmix-provider-model-casing
plan: 06
subsystem: providers
tags: [aihubmix, image-gen, fixture, real-api-call, d-14, d-15, d-16, MDL-01, MDL-02, MDL-03, wave-4, checkpoint]

# Dependency graph
requires:
  - "14-05 (AihubmixImageClient 三路解析器实现)"
  - "14-04 (dispatch.test.ts PPT casing 守门)"
provides:
  - "三路生图 API 真打验证（doubao/gpt-image-2/gemini 各 HTTP 200）（D-14）"
  - "真实 API 响应结构录制为截断 fixture（D-16）"
  - "Phase 14 全量测试通过（791/791，60 文件，0 失败）"
  - "bundle gate 通过（75.03 KB gzip ≤ 82 KB）"
affects:
  - "Phase 15 VIS（vision read tool，依赖 MDL-01 三路解析器 + fixture CI 守门）"
  - "Phase 16 IMG（图片生成插入，依赖 MDL-01 base64 返回契约）"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "一次性真打 + fixture 截断（D-14/D-15/D-16）：执行期真打录制，CI 永不打真 API"
    - "doubao 签名 URL 用 doubao 关键词占位符（保持测试 mock URL 分发正确）"
    - "gemini 真实 mimeType 验证：本次真打返回 image/png（非 jpeg），测试断言随 fixture 同步更新"

key-files:
  created: []
  modified:
    - src/providers/__fixtures__/doubao-response.json
    - src/providers/__fixtures__/gpt-image-2-response.json
    - src/providers/__fixtures__/gemini-response.json
    - src/providers/aihubmix-image.test.ts

key-decisions:
  - "三路真打 HTTP 200 全部成功（doubao/gpt-image-2/gemini）；Phase 14 解析器路径正确性在真实 API 下验证"
  - "gemini 此次真打返回 image/png（非 spike 011 记录的 image/jpeg）：API 响应 mimeType 可变；测试随 fixture 更新为 image/png（Rule 1 修复）"
  - "fixture 安全验证通过：无 apiKey/Bearer/sk- 字符串；全部文件 <10KB"

# Metrics
duration: 15min
completed: 2026-06-01T09:00:00Z
---

# Phase 14 Plan 06: 真打三路生图 API + Phase 14 全量验证 Summary

**三路真打 HTTP 200（doubao/gpt-image-2/gemini），fixture 更新为真实 API 响应结构；791/791 全量测试通过，bundle 75.03 KB，checkpoint 证据收集完毕**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-01T08:25:00Z
- **Completed:** 2026-06-01T08:35:00Z
- **Tasks:** 3 / 3 (全部完成 — Task 2 human-verify 已用户确认，Task 3 VALIDATION.md sign-off 完成)
- **Files modified:** 4

## Accomplishments

### Task 1: 三路真打 + Fixture 录制（D-14/D-15/D-16）

真打结果（全部 HTTP 200）：

| 路由 | HTTP 状态 | 关键字段验证 |
|------|----------|------------|
| doubao-seedream-5.0-lite | **200** | `output[].url` 结构确认（返回 TOS 签名 URL） |
| gpt-image-2 | **200** | `output.b64_json[].bytesBase64` 确认（mimeType='png'，规范化 → 'image/png'）|
| gemini-3.1-flash-image-preview | **200** | `inlineData.data` 确认（mimeType='image/png'，thoughtSignature 长度 ~1.5M 字符确认）|

Fixture 文件更新（D-16 截断）：

| 文件 | 大小 | 截断方式 |
|------|------|---------|
| doubao-response.json | 102 B | URL 替换为 `https://doubao-truncated-for-ci.example.com/image.png` |
| gpt-image-2-response.json | 134 B | bytesBase64 截断为 4 字符 `iVBO` |
| gemini-response.json | 925 B | inlineData.data 截断为 4 字符 `iVBO`，thoughtSignature 替换为 `<truncated-for-ci>` |

### 全量验证证据（Checkpoint Task 2 证据）

| 检查项 | 命令 | 结果 |
|--------|------|------|
| 全量测试（tsc + vitest） | `npm test` | **791/791 通过，60 文件，0 失败** |
| Bundle gate | `npm run build && npm run size` | **75.03 KB gzip ≤ 82 KB gate 通过** |
| MDL-03 PPT casing 守门 | `npx vitest run src/agent/tools/dispatch.test.ts` | **26/26 通过** |
| MDL-01 fixture 单测 | `npx vitest run src/providers/aihubmix-image.test.ts` | **5/5 通过** |
| MDL-02 registry 测试 | `npx vitest run src/providers/registry.test.ts` | **16/16 通过** |
| Fixture 安全检查 | `grep -rE "sk-\|Bearer\|x-goog" src/providers/__fixtures__/` | **clean（无泄露）** |
| Fixture 体积检查 | `wc -c src/providers/__fixtures__/*.json` | **doubao 102B, gpt-image-2 134B, gemini 925B**（全部 <10KB）|

## Task Commits

1. **Task 1: 真打三路生图 API，录制 fixture（D-14/D-15/D-16）** - `9721237` (feat)
2. **Task 2: human-verify checkpoint** — 用户确认通过（checkpoint，无 commit）
3. **Task 3: VALIDATION.md Nyquist sign-off** - `ff44140` (docs)

## Files Created/Modified

- `src/providers/__fixtures__/doubao-response.json` — 更新：真实 API 响应结构（URL 替换为含 doubao 关键词的占位符）
- `src/providers/__fixtures__/gpt-image-2-response.json` — 更新：真实 API 响应结构（bytesBase64 截断 4 字符）
- `src/providers/__fixtures__/gemini-response.json` — 更新：真实 API 响应结构（inlineData.data 截断 4 字符，thoughtSignature 截断）
- `src/providers/aihubmix-image.test.ts` — 更新：gemini 断言同步 fixture（/9j/→iVBO, jpeg→png）

## Decisions Made

- **gemini mimeType 实测为 image/png**：spike 011 记录为 `image/jpeg`，本次真打实测返回 `image/png`。API 响应的 mimeType 是动态的（取决于生成内容和模型版本），测试已随 fixture 真实值更新。解析器已通过 `normalizeMimeType` 正确处理两种值。
- **doubao fixture URL 保持含 doubao 关键词**：Plan 05 已修复此 bug（D-16 兼容性），本次真打继续沿用 `https://doubao-truncated-for-ci.example.com/image.png` 占位符（而非原始签名 URL）。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] gemini 测试断言与真实 fixture 不符**
- **Found during:** Task 1 — 真打后 fixture 的 mimeType 从 `image/jpeg` 变为 `image/png`，data 前缀也从 `/9j/` 变为 `iVBO`
- **Issue:** `aihubmix-image.test.ts` gemini 断言硬编码了 `/9j/` 和 `image/jpeg`（基于 spike 011 的历史记录），但真实 fixture 现在是 `iVBO` 和 `image/png`
- **Fix:** 更新断言为真实 fixture 值，并加注释说明（API 响应 mimeType 可变）
- **Files modified:** `src/providers/aihubmix-image.test.ts`
- **Commit:** 9721237

## Checkpoint Status

- **Task 1:** 完成 ✓（真打 HTTP 200 × 3，fixture 录制，测试通过，commit 9721237）
- **Task 2:** 完成 ✓（human-verify checkpoint，用户已确认通过）
- **Task 3:** 完成 ✓（VALIDATION.md Nyquist sign-off，commit ff44140）

**Plan 14-06: 全部 3 任务完成。Phase 14 交付达成。**

## Known Stubs

无 — fixture 为真实 API 响应录制（截断）；解析器实现完整；无占位逻辑。

## Threat Flags

无新安全面 — 本 plan 仅执行一次性真打脚本和更新 fixture，已通过安全验证：
- `grep -rE "sk-|Bearer|x-goog" src/providers/__fixtures__/` 返回 clean（T-14-01 fixture 无密钥）
- doubao 真打 URL（含 TOS 签名参数）在脚本内存中消费后丢弃（T-14-02 遵守）

## Self-Check (Final): PASSED

- FOUND: src/providers/__fixtures__/doubao-response.json (102 B)
- FOUND: src/providers/__fixtures__/gpt-image-2-response.json (134 B)
- FOUND: src/providers/__fixtures__/gemini-response.json (925 B)
- FOUND: src/providers/aihubmix-image.test.ts (updated)
- FOUND: commit 9721237
- aihubmix-image.test.ts: 5/5 PASS
- registry.test.ts: 16/16 PASS
- dispatch.test.ts: 26/26 PASS
- npm test: 791/791 PASS (60 files, 0 failed)
- npm run build && npm run size: 75.03 KB gzip ≤ 82 KB gate PASS
- grep fixture safety: clean
- fixture sizes: doubao 102B, gpt-image-2 134B, gemini 925B (all <10KB)

---
*Phase: 14-mdl-aihubmix-provider-model-casing*
*Completed: 2026-06-01 — 3/3 tasks done, Phase 14 全交付达成*
