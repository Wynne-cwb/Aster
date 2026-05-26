PENDING — 待 D-11 Step 2 实测后由用户填写最终 PASS / FAIL（详见下方"决策"章节）

# DeepSeek-V4 多模态验证（Spike #4）

> 非 GATING：FAIL 时锁定 aihubmix 为唯一视觉路径，不止损
> D-11 三步法：(1) 读官方文档 (2) 实际发请求 (3) fail 锁 aihubmix

---

## 场景

对 `deepseek-v4-pro` 发送含 `image_url` content block 的请求，判断官方 API 是否原生多模态。

测试步骤：
1. 读 DeepSeek API 文档 + change log（15 分钟）— Task 1 已完成
2. 构造请求：POST https://api.deepseek.com/chat/completions
   - model: deepseek-v4-pro
   - messages: [{role: user, content: [{type: text, text: "描述这张图片"}, {type: image_url, image_url: {url: "data:image/png;base64,..."}}]}]
3. 观察响应：200 + 合理描述 = PASS；4xx = FAIL

---

## API 文档确认（Step 1）— 完成于 2026-05-26

> 方法：直接抓 https://api-docs.deepseek.com/ 与 https://api-docs.deepseek.com/updates 与 V4 release news 与 pricing 表与 Anthropic API guide。

**官方文档调研结论：DeepSeek 官方文档完全没有提及 `deepseek-v4-pro` / `deepseek-v4-flash` 原生支持图片/多模态输入；并且 Anthropic API 兼容性表格明确写 `type="image"` Not Supported。**

### 证据 1 — Change Log（https://api-docs.deepseek.com/updates）

V4 条目原文：
> The DeepSeek API now supports V4-Pro and V4-Flash, available via both the OpenAI ChatCompletions interface and the Anthropic interface. To access the new models, the base_url remains unchanged, and the model parameter should be set to `deepseek-v4-pro` or `deepseek-v4-flash`.
>
> The model's accuracy in outputting JSON format has been enhanced. In our internal test set, the JSON parsing rate increased from 78% to 85%. By introducing appropriate regular expressions, the JSON parsing rate was further improved to 97%.

完整 change log 中 **没有出现 vision / multimodal / image / 图像 / 视觉 / 多模态 任何关键词**。grep 0 命中。

### 证据 2 — V4 Preview Release News（https://api-docs.deepseek.com/news/news260424）

发布说明只描述以下能力：
- DeepSeek-V4-Pro：Agentic Coding SOTA、World Knowledge、Reasoning（Math / STEM / Coding）
- DeepSeek-V4-Flash：性能贴近 Pro、Agent 任务对齐
- DSA Sparse Attention（结构创新）
- 1M context、Thinking / Non-Thinking 双模式
- 集成 Claude Code / OpenClaw / OpenCode

**完整 release notes 中 vision / multimodal / image 0 命中**。文档完全不提多模态。

### 证据 3 — Models & Pricing 表（https://api-docs.deepseek.com/quick_start/pricing）

`deepseek-v4-flash` 与 `deepseek-v4-pro` 的 FEATURES 一栏仅列：
- Json Output ✓
- Tool Calls ✓
- Chat Prefix Completion (Beta) ✓
- FIM Completion (Beta)（仅 non-thinking）

**FEATURES 行没有 Vision / Multimodal / Image。** 模型变体只列了 flash 与 pro 两个，**没有 vision 单独变体**（对比 OpenAI 的 gpt-4o-vision、Anthropic 的 claude-3-haiku-vision）。

### 证据 4 — Anthropic API Compatibility Guide（https://api-docs.deepseek.com/guides/anthropic_api）— **决定性证据**

官方 Anthropic API 兼容性表明确写：

| Field | Variant | Sub-Field | Support Status |
|-------|---------|-----------|----------------|
| content | string | — | Fully Supported |
| content | array, type="text" | text | Fully Supported |
| content | **array, type="image"** | — | **Not Supported** |
| content | **array, type="document"** | — | **Not Supported** |
| content | array, type="thinking" | — | Supported |
| content | array, type="tool_use" | — | Fully Supported |

**结论：DeepSeek 自己的 API 兼容性文档第一次明确表态 — 不支持 image content block。** Anthropic 形态 `type="image"` 即 OpenAI 形态 `type="image_url"` 的同源能力（两者都是视觉多模态 content type）。

### 文档调研结论汇总

- 官方文档**未明确说明** `deepseek-v4-pro` 支持 `image_url`（OpenAI ChatCompletions 形态）
- 官方文档**明确说明**通过 Anthropic 形态调用时 `type="image"` Not Supported（证据 4）
- 模型变体只有 `deepseek-v4-pro` + `deepseek-v4-flash`，**没有 vision 单独变体**
- CLAUDE.md 早先笔记标注的 "LOW confidence on multimodal at base v4 model IDs" 已被官方证据 4 证实为 Not Supported（Anthropic 形态确认；OpenAI 形态需 Step 2 实测确认）

**Q6/R2 预期结论（待 Step 2 验证）：FAIL — 锁定 aihubmix 为 v1 唯一多模态路径。**

> Step 2 实测仍然要做的意义：万一 DeepSeek OpenAI 兼容端点（与 Anthropic 端点不同行为）静默接受 image_url 字段（比如忽略图像内容只读文字 prompt），或者真有未在文档披露的多模态支持。Step 2 是为了把"未明示"转成实证 PASS/FAIL。但**预期 FAIL**。

---

## 实测结果（Step 2，待用户运行 spike/multimodal-test.html 后填写）

> ⚠ 由 executor 在 Phase 0 Wave 4 checkpoint 中由用户运行 spike/multimodal-test.html 填写。Executor 不持有 dev key，无法在 CI 中自动跑。

请求：POST https://api.deepseek.com/chat/completions
- model: `deepseek-v4-pro`
- content: `[{type: "text", text: "..."}, {type: "image_url", image_url: {url: "data:image/png;base64,..."}}]`
- stream: false
- max_tokens: 50

响应状态：（待填，200 / 4xx）
响应内容摘要：（待填 — 模型描述图像内容 → PASS；返回 invalid content type / image_url not supported 类错误 → FAIL）

发送时间：（待填）

---

## 证据

- [x] Step 1 API 文档调研（本文件 §"API 文档确认"四项证据）
- [ ] Step 2 请求/响应 JSON 截图（mask Authorization header）— 待用户运行 spike/multimodal-test.html 后补
- [ ] Step 2 spike/multimodal-test.html 运行截屏（DevTools Network tab + Response body）— 待用户运行后补

> ⚠ 安全提示：截图前 mask Authorization header；不要把真实 API Key 提交到证据中

---

## 决策

**结果：** PENDING（Step 1 已完成，预期 FAIL；待 Step 2 实测落定）

**Step 1 文档证据强烈倾向 FAIL：** Anthropic API 兼容表明确 image Not Supported；OpenAI 兼容端点文档对图像保持沉默；无 vision 模型变体。

**最终决策映射：**

- **PASS（Step 2 返回 200 + 合理图像描述）：** PRD Q6/R2 关闭。`deepseek-v4-pro` 原生支持 OpenAI 形态 `image_url` 输入，Phase 2 ProviderRegistry 可考虑将文本 LLM 与视觉 LLM 统一到同一 Provider。**但 D-12 默认 vision routing 决策仍推迟到 Phase 2**——只是把"是否可选"从未知变成已知可选。
- **FAIL（Step 2 返回 4xx 或忽略图像）：** 锁定 aihubmix vision 为 v1 唯一多模态路径。Phase 3 文件上传图片 → aihubmix vision（已知 fallback，CLAUDE.md §AiHubMix 已定）。**非 GATING，不止损。** Phase 2 ProviderRegistry 接口仍保留 `resolve('vision')` 抽象但 v1 只注册 aihubmix。

---

## 附：参考链接

- DeepSeek API Docs root: https://api-docs.deepseek.com/
- DeepSeek API Change Log: https://api-docs.deepseek.com/updates
- DeepSeek V4 Preview Release: https://api-docs.deepseek.com/news/news260424
- DeepSeek Models & Pricing: https://api-docs.deepseek.com/quick_start/pricing
- DeepSeek Anthropic API Compatibility: https://api-docs.deepseek.com/guides/anthropic_api（**证据 4**）
