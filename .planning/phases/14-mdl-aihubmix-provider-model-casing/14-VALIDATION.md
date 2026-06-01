---
phase: 14
slug: mdl-aihubmix-provider-model-casing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `14-RESEARCH.md` §Validation Architecture (D-14/D-15/D-16 fixture 守门策略).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.0.0 + jsdom (已安装，无需新依赖) |
| **Config file** | `vitest.config.ts`（项目根，environment: 'jsdom', globals: true） |
| **Quick run command** | `npx vitest run src/providers/ src/agent/tools/` |
| **Full suite command** | `npm test`（`tsc --noEmit && vitest run`） |
| **Estimated runtime** | ~5s（quick）/ ~30s（full） |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/providers/ src/agent/tools/`（仅 provider + tool 目录，~5s）
- **After every plan wave:** Run `npm test`（全量 tsc + vitest，~30s）
- **Before `/gsd-verify-work`:** Full suite green **AND** `npm run build && npm run size`（bundle ≤82KB gzip）
- **Max feedback latency:** ~5 seconds

> **CI 永不打真 API**（D-15）：所有 MDL-01 三路解析器测试基于录制的 fixture（D-14 执行期一次性真打录制），CI 不花钱、不 flaky、不限速。

---

## Per-Task Verification Map

> Plan/task IDs assigned during planning (step 8). Rows below are requirement-granularity; the planner maps each to concrete task IDs + `<automated>` verify commands.

| Behavior | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| doubao 解析器从 `output[0].url` 取 URL → fetch → base64 → 返回 `{ base64, mimeType }` | 1 | MDL-01 | — | — | unit (fixture) | `npx vitest run src/providers/aihubmix-image.test.ts` | ❌ W0 | ⬜ pending |
| gpt-image-2 解析器从 `output.b64_json[0].bytesBase64` 取 base64（注意 `output` 是对象非数组）；mimeType `'png'→'image/png'` 规范化 | 1 | MDL-01 | — | — | unit (fixture) | 同上 | ❌ W0 | ⬜ pending |
| gemini 解析器遍历 chunks/parts 找 `inlineData`，跳过 `thoughtSignature`（~1.5M 字符） | 1 | MDL-01 | — | — | unit (fixture) | 同上 | ❌ W0 | ⬜ pending |
| 三路返回值都是裸 base64（无 `data:` 前缀）+ 独立 mimeType | 1 | MDL-01 | — | — | unit (fixture) | 同上 | ❌ W0 | ⬜ pending |
| apiKey 不出现在 error.message，不进 request body | 1 | MDL-01 | T-14-01 | apiKey 仅注入 Authorization / x-goog-api-key header；error message 用固定字面量 | unit | 同上 | ❌ W0 | ⬜ pending |
| doubao 签名 URL 在 provider 内立即转 base64 后丢弃，不进任何持久化 | 1 | MDL-01 | T-14-02 | URL 不存储、不返回、不入聊天历史（D-02） | unit (fixture) | 同上 | ❌ W0 | ⬜ pending |
| `resolve('vision')` → `model:'gpt-5.4'`；`resolve('image-gen')` → `model:'doubao-seedream-5.0-lite'` | 1 | MDL-02 | — | — | unit | `npx vitest run src/providers/registry.test.ts` | ✅ 改断言 | ⬜ pending |
| `IMAGE_GEN_MODELS` 列表含三个 model，`isDefault` 恰好一个为 true（doubao），每项带 metadata（端点形态/鉴权方式） | 1 | MDL-02 | — | — | unit | `npx vitest run src/providers/registry.test.ts` | ✅ 加用例 | ⬜ pending |
| PPT 工具 camelCase 入参经 dispatchTool normalize → execute 收到 snake_case args | 2 | MDL-03 | — | — | unit | `npx vitest run src/agent/tools/dispatch.test.ts` | ✅ 加 describe | ⬜ pending |
| PPT 工具 snake_case 入参经 normalize 后不变（幂等） | 2 | MDL-03 | — | — | unit | 同上 | ✅ 加用例 | ⬜ pending |
| Word/Excel 工具 args 经 dispatchTool 不被 PPT normalize 影响（camelCase 保持原样） | 2 | MDL-03 | — | — | unit | 同上 | ✅ 加用例 | ⬜ pending |
| initial main-*.js ≤ 82KB gzip（0 净新增运行时依赖） | gate | NFR | — | — | build check | `npm run build && npm run size` | ✅ CI gate | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

执行前必须新建（fixture 在执行期一次性真打后录制 = D-14）：

- [ ] `src/providers/__fixtures__/doubao-response.json` — `{ "output": [{ "url": "<truncated-for-ci>" }] }`
- [ ] `src/providers/__fixtures__/gpt-image-2-response.json` — `{ "output": { "b64_json": [{ "bytesBase64": "<截断4字符>", "mimeType": "png" }] } }`
- [ ] `src/providers/__fixtures__/gemini-response.json` — 多 chunk JSON 数组，含 inlineData（4 字符占位）+ thoughtSignature（截断）
- [ ] `src/providers/aihubmix-image.test.ts` — 三路解析器单测（MDL-01），mock `fetch` 按 URL 返回对应 fixture
- [ ] `src/providers/registry.test.ts` — 更新 vision/image-gen model 断言 + 新增 IMAGE_GEN_MODELS 列表用例（MDL-02）
- [ ] `src/agent/tools/dispatch.test.ts` — 新增 PPT casing 守门 describe 块（MDL-03）

> **D-16 fixture 截断原则：** base64 字段保留 4 字符（够验路径命中），不存完整 ~3MB 图片；`url` 字段用占位符 `<truncated-for-ci>`（fetch 被 mock，URL 内容不重要）；fixture 不含任何密钥。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 三路真打验证（doubao/gpt-image-2/gemini 各真请求一次，确认 200 + 字段落点） | MDL-01 (criterion 1) | 真打需 `.env.local` 的 `AIHUBMIX_API_KEY`，CI 不打真 API（D-15）；产物是录制的 fixture | 执行期由 executor 用 `.env.local` 一次性真打三路 → 录制 fixture → 之后全靠 fixture 单测 |
| doubao TOS 签名 URL 从 Office Task Pane origin 的 CORS 行为 | MDL-01 (open Q) | spike 011 用 Node.js curl 取 URL，未从浏览器 Task Pane origin 验证 fetch CORS | 执行期 smoke 一并验；若 CORS 拦截 → error hint 提示切换 gpt-image-2/gemini，**不需架构变更** |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 fixture/test files above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner wires per-task commands)

**Approval:** pending
