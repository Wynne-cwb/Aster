# Phase 14: MDL — AiHubMix Provider 重写 + model 修正 + PPT casing 根治 - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

v2.2「多模态四件套」的**地基**，纯底层、解锁所有下游 image/vision 工具。交付三件事：

1. **重写 `src/providers/aihubmix-image.ts`** — 按 model 分发三路 response 解析器（doubao `output[].url` / gpt-image-2 `output.b64_json[].bytesBase64` / gemini `candidates[].content.parts[].inlineData.data`），内部统一为 base64，两套鉴权（Bearer / `x-goog-api-key`），gemini 走 `/gemini/v1beta` 端点族并跳过巨大 `thoughtSignature`。
2. **修正 model 清单（registry/pricing）** — 区分 vision model 与三个生图 model；铺带 metadata 的生图 model 列表 + 默认。
3. **PPT 工具 snake/camel casing 中央归一化根治** — dispatch 层统一 args 归一化，移除散落双键容错，加守门用例。

**不在本阶段（下游 Phase 15–18 才做）：** 新的「生成图/插图」write tool、文件解析、图库检索、任何 Settings/picker UI、agent loop 改动。本阶段只「铺路」，不接路。

</domain>

<decisions>
## Implementation Decisions

### 生图 provider 返回契约（MDL-01）
- **D-01:** provider **永远只返回 base64**，不外泄任何 URL。返回形状 = `{ base64: string; mimeType: 'image/png' | 'image/jpeg' | string }`，`base64` 是**裸 base64**（不带 `data:...;base64,` 前缀）。
  - **理由：** Office.js 三宿主插图 API 全部「吃裸 base64」——Word `insertInlinePictureFromBase64`、PPT `setSelectedDataAsync(base64, {coercionType: Image})`（GA）/ `addImageFromBase64`（较新）、Excel 不支持插图。没有「吃 URL」的插图法。下游插图层直接喂 `base64`；预览要显示时自己拼 `data:${mimeType};base64,${base64}` 给 `<img>`。
- **D-02:** doubao 的签名 URL 是**一次性内部中转**：provider 拿到 URL 后**立刻 fetch 下载、转 base64、丢弃 URL**，绝不把 URL 存起来留到「用户预览后再确认插入」时用。
  - **理由：** doubao 签名 URL 带 TTL（会过期），延迟使用有过期风险；且 Office.js 反正用不了 URL。eager 转换在 provider 内部最安全。
- **D-03:** gpt-image-2 / gemini 已直接返回 base64，无需 fetch；gemini 解析时**跳过 `thoughtSignature`**（~1.5M 字符），只取 `inlineData.data`。
- **D-04（澄清）:** roadmap/spike 文案里的「统一 base64 data URL」是宽泛说法；本阶段落地为**裸 base64 + 独立 mimeType**（贴合 Office.js 真实需求，插图点零剥前缀）。

### model 清单结构 + vision id（MDL-02）
- **D-05:** 本阶段铺好**带 metadata 的三生图 model 列表**，每项含：`id` / `label` / 端点形态（predictions vs gemini streamGenerateContent）/ 鉴权方式（Bearer vs `x-goog-api-key`）/ 是否默认。**默认生图 model = `doubao-seedream-5.0-lite`**（最快，满足 P95≤10s）。
- **D-06:** **默认 vision model = `gpt-5.4`**（已 `/v1/models` 确认可用，2026-06-01）。
  - 推翻 registry 现 hardcode 的 `gpt-5.1`；也比 `todos.md` L28 写的 `gpt-5.2` 更新一代——按「质量 >> 成本」标准原则选更强的（BYO key 用户自付成本）。
- **D-07:** **生图 model 可用性以 spike 真打 + 本阶段 smoke 为准，不以 `/v1/models` 为准；vision id 才以 `/v1/models` 为准。**
  - **关键事实（2026-06-01 实测）：** `gpt-image-2`、`gemini-3.1-flash-image-preview` 在 `/v1/models` 清单里；但**默认的 `doubao-seedream-5.0-lite` 不在 `/v1/models` 清单里**——因为生图走 predictions 独立目录（`/v1/models/doubao/.../predictions`），与 `/chat` 的 `/v1/models` 不是同一 namespace。spike 011 真打它拿到 200 → 可用。下游/规划**不要因为它不在 `/v1/models` 就误判 doubao 不可用**。
- **D-08:** 数据结构设计成**供 Phase 16 Settings picker 读**（IMG-04「可切生图 model」），但**本阶段不做任何 picker UI**。

### PPT casing 中央归一化（MDL-03）
- **D-09:** **PPT 所有工具 schema 统一成 `snake_case`**（告诉 LLM 一种键名），符合 memory `project_ppt_officejs_gotchas`「新工具用 snake_case」。
- **D-10:** **dispatchTool（`src/agent/tools/index.ts`）入口加中央 `normalize`**：把任意 casing 的入参键折成 canonical `snake_case`，兜 LLM 仍传 camel 的漂移。execute 函数只读 `snake_case`。
- **D-11:** **删除 `ppt.ts` 里所有散落的双键容错**（`pickSlideIndex`/`pickShapeId`/`pickSourceIndex`/`pickTargetIndex` 及 `args.slideIndex ?? args.slide_index` 之类）。归一化只此一处。
- **D-12:** **守门用例**：`src/agent/tools/dispatch.test.ts` 对每个 PPT 工具喂 `snake_case` 与 `camelCase` 两种入参，都 assert 命中同一参数（防 v2.2 新增 PPT 生图工具重蹈 casing 覆辙 = `feedback_recurring_failure_add_gate`）。
- **D-13（范围）:** 范围限 **PPT**（MDL-03 本只要求 PPT）。中央 `normalize` 因为挂在 dispatchTool（三宿主唯一入口）天然对 Word/Excel 也生效，但**不主动重排 Word/Excel 的 schema**。

### 三路 smoke test 验证策略（criterion 4）
- **D-14:** **一次性真打 + fixture 单测**：执行期由 Claude 用 `.env.local` 的 `AIHUBMIX_API_KEY` **一次性真打三路生图**（doubao/gpt-image-2/gemini），验证三路解析器各自正确，**录制响应 fixture**。
- **D-15:** 提交 **fixture-based 单测当永久 CI 守门**；**CI 永不打真 API**（不花钱、不 flaky、不限速）。符合 memory `feedback_self_run_spikes` + `feedback_recurring_failure_add_gate`。
- **D-16:** fixture 不含密钥、不含完整 3MB base64 原文（截断/占位即可，只验解析路径命中正确字段）。

### Claude's Discretion
- **拆 `usage` token 计量**：旧 `ImageGenResult.usage` 直接删（NFR-08 token 门已废 + v2.0 已砍全部 cost 功能 = memory `project_quality_over_cost` / `project_aster_cost_removed`）。
- gemini 响应是 JSON 数组多 chunk，具体怎么遍历取第一个含 `inlineData` 的 part —— Claude 定。
- doubao fetch 转 base64 的实现（`fetch` → `blob` → `FileReader`/`arrayBuffer` → base64）—— Claude 定。
- 三路解析器的代码组织（一个 dispatch switch vs 三个 parser 函数）—— Claude 定。
- 中央 `normalize` 的实现位置/写法（dispatchTool 内联 vs 抽 helper）—— Claude 定。
- 错误映射沿用现有 `mapHttpError` / `NetworkError` / AsterError 体系。

### Folded Todos
- **`todos.md` L26–28「AIHubMix 的 Setting 设置不对 / model 清单」** — 其「**model 清单要对**」部分折入本阶段 = MDL-02（D-05/D-06/D-07）。其「**Settings 里能选多模态/生图 model（参考设计稿）**」的 picker UI 部分**不在本阶段**，留给 Phase 16（见 Deferred）。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Wire format 真相源（最重要）
- `.planning/spikes/011-image-gen-api-formats/findings.md` — **三个生图 model 的端点/鉴权/请求体/response 落点全部真机实测锁定**（doubao URL / gpt-image-2 b64_json / gemini inlineData + thoughtSignature 坑）。MDL-01 直接照此实现。

### 需求 + 路线
- `.planning/REQUIREMENTS.md` — MDL-01 / MDL-02 / MDL-03 完整需求文 + §Traceability（Phase 14 三需求 Pending）。
- `.planning/ROADMAP.md` §Phase 14 — Goal + 4 条 Success criteria（本 CONTEXT 的标准对照）。
- `.planning/research/SUMMARY.md` — v2.2 研究基线；为何「Provider 重写必须第一」、三套 wire format 单一解析器=静默失败、doubao 签名 URL TTL、最高风险三连。

### 重写/改动目标代码
- `src/providers/aihubmix-image.ts` — **完整重写目标**（现写旧 `gpt-image-1` + OpenAI `/images/generations`，要改三路 predictions/gemini）。
- `src/providers/registry.ts` — model 常量所在（现 `AIHUBMIX_VISION_MODEL='gpt-5.1'`、`AIHUBMIX_IMAGE_MODEL='gpt-image-2'`，要改 vision→`gpt-5.4` + 铺生图 model 列表）。
- `src/providers/aihubmix-vision.ts` — vision client（现 body 内 hardcode `model:'gpt-4o'`，要对齐 registry 的 `gpt-5.4`）。
- `src/providers/types.ts` — `ImageConfig` / `TaskKind` / client 接口（返回契约 D-01 落点）。

### PPT casing 归一化目标代码
- `src/agent/tools/index.ts` — `dispatchTool` = 三宿主唯一执行入口，**中央 normalize 落点**（D-10）。
- `src/agent/tools/write/ppt.ts` — **散落双键容错所在**（`pickSlideIndex`/`pickShapeId` 等，要删 = D-11）+ schema 统一 snake_case（D-09）。
- `src/agent/tools/dispatch.test.ts` — **casing 守门用例落点**（D-12）。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`mapHttpError` / `NetworkError`（`src/lib/sse.ts` + `src/errors`）**：现 image/vision client 已用，重写沿用——非 200 → `mapHttpError(status, body)`，网络异常 → `NetworkError`。错误最终经 `dispatchTool` sanitize 边界（`src/agent/tools/index.ts`）。
- **`ProviderRegistry.resolve(taskKind, getDefaultLLM)`（`registry.ts`）**：已有 `vision` / `image-gen` taskKind 路由 + 依赖注入避免循环依赖。本阶段只改其内置常量/model 列表，不改 resolve 形态。
- **`dispatchTool`（`index.ts`）**：唯一工具执行入口 + 15s 超时 + 严格 sanitize allowlist。中央 normalize 加在这里天然覆盖三宿主。
- **`.env.local` 的 `AIHUBMIX_API_KEY`**：smoke 真打 + `/v1/models` 验证用（已验证可拉到 237 个 model，HTTP 200）。

### Established Patterns
- **apiKey 仅放 Authorization/`x-goog-api-key` header，不进 body、不进 error.message**（T-01-04 安全约束）——重写必须保持。
- **PPT 工具 schema casing 混乱**：`ppt.ts` 内 `insertSlide`/`setShapeProperty` 用 snake（`slide_index`/`shape_id`），`setShapeTextFont`/`addShape`/`setShapeTextAlignment` 等用 camel（`slideIndex`/`shapeId`），靠 `pickSlideIndex(a)=a.slideIndex??a.slide_index` 兜底——MDL-03 根治对象。
- **生图不可流式**：图片一次性整块返回（base64/url），不像 LLM SSE 增量；UI 是「生成中…」loading 态（下游 Phase 16 关心，本阶段 provider 只返回最终 base64）。

### Integration Points
- 重写后的 image client 由 `ProviderRegistry.resolve('image-gen', ...)` 提供配置，供 Phase 16 IMG write tool 消费 `{ base64, mimeType }`。
- vision client 由 `resolve('vision', ...)` 提供，供 Phase 15 VIS read tool 消费。
- 中央 normalize 在 `dispatchTool` → 所有 host 的 tool execute 收到归一化后的 args。

</code_context>

<specifics>
## Specific Ideas

- **「Office.js 只能吃裸 base64、没有 URL 插图法」** —— Claude 高把握但 SUMMARY 列为 Phase 15 真机 spike 项；本阶段按 base64-only 设计（风险极低），Phase 15 真机最终确认。
- 默认生图选 `doubao-seedream-5.0-lite` 是因为它**最快**（spike：~449B URL 响应 + 数秒），转 base64 多一次 fetch 仍满足 P95≤10s；gpt-image-2 high ~90s+ 不适合当默认。
- vision 选 `gpt-5.4` 而非 todo 原写的 `gpt-5.2`：质量优先、当下确认可用、BYO key 自付成本。

</specifics>

<deferred>
## Deferred Ideas

- **Settings 里「多模态/生图 model 可选」picker UI（参考设计稿）** — `todos.md` L26–28 的 UI 部分。本阶段只铺数据结构，picker UI 归 **Phase 16（IMG-04「可切生图 model + 一键重新生成」）**。
- **doubao 签名 URL 是否可直接交给 Office.js（省 3MB base64）** — 本阶段定为 base64-only，不走 URL。若 Phase 15 真机 spike 证实 Office.js 能吃 URL 且对 P95/内存有明显收益，可在那时重评——但 doubao URL 的 TTL 风险仍在。
- **gemini `web_search` tool / `imageConfig` 高级参数暴露** — spike 011 提到 doubao `tools:[{type:web_search}]`、gemini `responseModalities` 等高级参数；本阶段不暴露，按需后续。
- **Word/Excel schema casing 主动统一** — 本阶段 normalize 已覆盖，但不主动重排 Word/Excel schema；若未来它们也出 casing 坑再单独处理。

### Reviewed Todos (not folded)
- `todos.md` L5 PPT slide optimizer skill 链接、L80/L140 `insert_image`/`add_image` 插图 tool、L166/L168 视觉/生图 tool —— 均为**下游 Phase 15/16 的 tool/UI**，非本地基阶段；本阶段只交付它们依赖的 provider + model 清单。

</deferred>

---

*Phase: 14-mdl-aihubmix-provider-model-casing*
*Context gathered: 2026-06-01*
