# Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 14-mdl-aihubmix-provider-model-casing
**Areas discussed:** 生图返回契约, PPT casing 归一化方案, 三路 smoke test 策略, model 清单结构 + vision id

---

## 生图返回契约（MDL-01）

用户先就「豆包链接是加密 + 有有效期，怎么处理 / Office.js 插图怎么做」提问，澄清后重定问题。

确定前提（澄清后）：Office.js 三宿主插图 API 全部吃裸 base64（无 URL 插图法）→ doubao 签名 URL 必须 provider 内部 fetch 转完即弃、不外泄。剩余决策缩为「base64 用什么形式返回」。

| Option | Description | Selected |
|--------|-------------|----------|
| raw base64 + mimeType | 返回 `{ base64, mimeType }`，裸 base64（无 data: 前缀），Office.js 直接吃；预览自拼 data:URL | ✓ |
| data URL 字符串 | 返回 `data:image/png;base64,...` 整串，预览方便但每个插图点要剥前缀 | |
| 你定（Claude's Discretion） | 按 codebase 习惯定 | |

**User's choice:** raw base64 + mimeType（推荐）
**Notes:** 原始第一版选项含「保留 sourceUrl」，经澄清 Office.js 用不了 URL + URL 有 TTL，该选项被判定无意义并移除。

---

## PPT casing 归一化方案（MDL-03）

现状：`ppt.ts` 部分工具 schema 用 snake_case、部分 camelCase，靠散落 `pickSlideIndex`/`??` 双键兜底。

| Option | Description | Selected |
|--------|-------------|----------|
| 统一 snake + 中央 norm | PPT schema 全统一 snake_case + dispatchTool 入口 normalize + execute 只读 snake + 删兜底 + dispatch.test 双断言守门 | ✓ |
| 只加 dispatch 兜底 | 只在 dispatch 加双向 normalize，schema 不动（改动最小但没真根治） | |
| 扩到三宿主 | 同推荐 + 主动重排 Word/Excel schema（最彻底但工作量大） | |

**User's choice:** 统一 snake + 中央 norm（推荐）
**Notes:** 范围限 PPT（MDL-03 本只要求 PPT）；中央 normalize 因挂 dispatchTool 天然对三宿主生效，但不主动改 Word/Excel schema。

---

## 三路 smoke test 策略（criterion 4）

| Option | Description | Selected |
|--------|-------------|----------|
| 一次性真打 + fixture 单测 | Claude 用 .env.local 一次性真打三路、录 fixture → 提交 fixture 单测当 CI 守门；CI 不打真 API | ✓ |
| 提交 live smoke test | 提交真打 API 的 live 测试（CI 花钱/flaky/限速） | |
| 两者都要 | fixture 单测进 CI + gated live smoke（默认 skip） | |

**User's choice:** 一次性真打 + fixture 单测（推荐）
**Notes:** 符合 memory `feedback_self_run_spikes` + `feedback_recurring_failure_add_gate`。

---

## model 清单结构 + vision id（MDL-02）

| Option | Description | Selected |
|--------|-------------|----------|
| 铺列表 + 现在验 vision | 铺带 metadata 三生图 model 列表 + 默认 doubao；vision id 现在用 .env.local 跑 /v1/models 确认；供 Phase 16 picker 读，不做 UI | ✓ |
| 只改常量 | 只改 registry 常量，不铺列表（下游反复改 registry） | |
| 铺列表但不现在验 | 铺列表但 vision id 先写死 gpt-5.2、留给 executor 验 | |

**User's choice:** 铺列表 + 现在验 vision（推荐）
**Notes:** Claude 当场跑 `/v1/models`（HTTP 200，237 个 model）。

### 后续追问：默认 vision model 选哪个

`/v1/models` 验证结果：`gpt-5.2`✅、`gpt-5.4`✅、`gpt-5.5`✅ 均可用。生图侧 `gpt-image-2`✅、`gemini-3.1-flash-image-preview`✅ 在清单；默认 `doubao-seedream-5.0-lite` 不在清单（走 predictions 独立目录，spike 011 真打可用）。

| Option | Description | Selected |
|--------|-------------|----------|
| gpt-5.2（todo 写的） | 按 todo L28 原定，稳妥 | |
| gpt-5.4（更新） | 更新一代，符合 quality>>成本 | ✓ |
| gpt-5.5（最新） | 最新，质量优先最激进 | |

**User's choice:** gpt-5.4（更新）
**Notes:** 推翻 registry 现 hardcode 的 gpt-5.1 与 todo 的 gpt-5.2。

---

## Claude's Discretion

- 拆旧 `ImageGenResult.usage`（NFR-08 token 门已废 + v2.0 砍 cost）
- gemini 多 chunk 遍历取图、doubao fetch→base64 实现、三路解析器代码组织、中央 normalize 实现位置
- 错误映射沿用现有 `mapHttpError`/`NetworkError`/AsterError 体系

## Deferred Ideas

- Settings model picker UI（todo L26–28 的 UI 部分）→ Phase 16 IMG-04
- doubao URL 直插 Office.js（省 3MB）→ Phase 15 真机 spike 重评（TTL 风险仍在）
- gemini web_search / imageConfig 高级参数暴露 → 按需后续
- Word/Excel schema 主动统一 casing → 出坑再说
