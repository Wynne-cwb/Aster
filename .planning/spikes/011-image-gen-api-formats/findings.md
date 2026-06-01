# Spike 011 — v2.2 生图模型 API/response 格式实测

**Date:** 2026-06-01
**Context:** v2.2「多模态四件套」启动期，用户新增 `doubao-seedream-5.0-lite` 生图模型，提供三个 model 的 curl，实测拿 response 格式以驱动 MM-03（图片生成插入）/ MM-05（AiHubMix model 修正）需求与 adapter 设计。
**Key source:** `.env.local` 的 `AIHUBMIX_API_KEY`（真实付费调用；findings 不含 Key）。

## TL;DR

生图**不是单一 wire format**，至少三套，且两个 predictions 模型的 `output` 结构都不同。MM-03 需写**按模型分发的 response 解析器**，MM-05 需在 model 清单里登记每个模型的接口形态 + 鉴权方式。

| 模型 | 端点 | 鉴权 | 请求体 | 响应 image 落点 | 响应大小 | 速度 |
|------|------|------|--------|----------------|---------|------|
| `doubao-seedream-5.0-lite`（新增） | `POST /v1/models/doubao/doubao-seedream-5.0-lite/predictions` | `Authorization: Bearer` | `{input:{...}}` | `output[].url`（签名URL） | ~449 B | 快（数秒） |
| `gpt-image-2` | `POST /v1/models/openai/gpt-image-2/predictions` | `Authorization: Bearer` | `{input:{...}}` | `output.b64_json[].bytesBase64`（base64 PNG） | ~3.06 MB | 慢（high ~90s+） |
| `gemini-3.1-flash-image-preview` | `POST /gemini/v1beta/models/gemini-3.1-flash-image-preview:streamGenerateContent` | `x-goog-api-key` | Gemini `{contents,generationConfig}` | `candidates[].content.parts[].inlineData.data`（base64 jpeg） | ~3.1 MB | 中 |

Base host: `https://aihubmix.com`（注意 gemini 走 `/gemini/v1beta/...` 子路径，与 predictions 的 `/v1/...` 不同族）。

---

## ① doubao-seedream-5.0-lite（predictions，URL 模式）

**Request**
```jsonc
POST https://aihubmix.com/v1/models/doubao/doubao-seedream-5.0-lite/predictions
Headers: Content-Type: application/json; Authorization: Bearer <KEY>
{
  "input": {
    "prompt": "...",
    "size": "2K",
    "sequential_image_generation": "disabled",
    "stream": false,
    "response_format": "url",
    "tools": [{"type": "web_search"}],
    "watermark": true
  }
}
```

**Response（HTTP 200，~449 bytes）**
```jsonc
{ "output": [ { "url": "<签名URL ~425字符, host: ark-acg-cn-beijing.tos-cn-beijing.volces.com>" } ] }
```

- `output` 是**数组**，每项 `{url}`。
- `response_format:"url"` → 轻量；签名 URL（火山 TOS），有时效，需尽快 fetch 或直接交给 Office 插图。
- 独有可选项：`size:"2K"`、`sequential_image_generation`、`tools:[{type:"web_search"}]`、`watermark`。

## ② gpt-image-2（predictions，base64 模式）

**Request**
```jsonc
POST https://aihubmix.com/v1/models/openai/gpt-image-2/predictions
Headers: Content-Type: application/json; Authorization: Bearer <KEY>
{
  "input": {
    "prompt": "...",
    "size": "1024x1024",
    "n": 1,
    "quality": "high",
    "moderation": "low",
    "background": "auto"
  }
}
```

**Response（HTTP 200，~3.06 MB）**
```jsonc
{
  "output": {
    "b64_json": [ { "bytesBase64": "<base64 PNG>", "mimeType": "png" } ],
    "urls": []
  },
  "usage": {
    "input_tokens": 37,
    "input_tokens_details": { "image_tokens": 0, "text_tokens": 37 },
    "output_tokens": 7024,
    "output_tokens_details": { "image_tokens": 7024, "text_tokens": 0 },
    "total_tokens": 7061
  }
}
```

- ⚠️ `output` 是**对象**（`{b64_json:[...], urls:[]}`），跟 doubao 的 `output:[...]` 结构**不一致** —— 同为 `/predictions` 也不能共用一个解析器。
- 默认返回 base64（`urls:[]` 空）；high 质量约 90s+，3MB 内联。
- 带 `usage` token 计量（image_tokens 维度）。
- `quality`(high/...)、`moderation`(low)、`background`(auto)、`n` 为 OpenAI 风格参数。

## ③ gemini-3.1-flash-image-preview（Gemini streamGenerateContent）

**Request**
```jsonc
POST https://aihubmix.com/gemini/v1beta/models/gemini-3.1-flash-image-preview:streamGenerateContent
Headers: Content-Type: application/json; x-goog-api-key: <KEY>
{
  "contents": [ { "role": "user", "parts": [ { "text": "draw a tree" } ] } ],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"],
    "imageConfig": { "aspectRatio": "1:1", "imageSize": "1k" }
  }
}
```

**Response（HTTP 200，~3.1 MB，JSON 数组的多 chunk）**
```jsonc
[
  { "candidates": [ { "content": { "parts": [
        { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" },
          "thoughtSignature": "<~1.5M 字符 base64 思考签名>" }
      ], "role": "model" }, "index": 0 } ],
    "usageMetadata": { "promptTokenCount":4, "candidatesTokenCount":1535, "totalTokenCount":1539,
      "candidatesTokensDetails":[{"modality":"IMAGE","tokenCount":1120}] },
    "modelVersion": "gemini-3.1-flash-image-preview",
    "responseId": "...", "turnToken": "..." },
  { "candidates": [ { "content": { "parts": [ { "text": "" } ] },
      "finishReason": "STOP", "index": 0 } ], "usageMetadata": {...}, ... }
]
```

- 完全不同的端点族（`/gemini/v1beta`）+ 鉴权头（`x-goog-api-key`，非 Bearer）。
- 响应是 **JSON 数组**（多个 chunk）；图片在 `candidates[0].content.parts[].inlineData.data`（base64 `image/jpeg`）。
- 注意巨大的 `thoughtSignature`（~1.5M 字符），解析时要跳过，别误当图片数据。
- `imageConfig.aspectRatio`/`imageSize`("1k") 控尺寸；`responseModalities` 必须含 `IMAGE`。

---

## 实现启示（MM-03 / MM-05）

1. **三套 response 适配器**：`output[].url`（doubao）/ `output.b64_json[].bytesBase64`（gpt-image-2）/ `candidates[].content.parts[].inlineData.data`（gemini）。两个 predictions 模型 output 结构也不同，不能合并。
2. **两套鉴权**：Bearer（predictions）vs `x-goog-api-key`（gemini）—— gemini 是 aihubmix 内独立的 Provider 通道。
3. **base64 内联 3MB 很重**：doubao URL 模式最省内存/带宽。Office.js 插图（PPT `shapes.addImage`/Word `insertInlinePictureFromBase64`）通常吃 base64 → URL 模式需「fetch URL → 转 base64」再插，权衡 P95/内存 vs 直接 base64。
4. **现有 `src/providers/aihubmix-image.ts` 需重写**：旧文件写的是 `gpt-image-1` + 大概率 OpenAI `/images/generations` 形态；v2.2 改为 predictions/gemini 双形态 + 按模型分发解析。
5. **生图不可流式插入**：图片是一次性整块返回（base64/url），不像 LLM SSE 增量——UI 要「生成中…」loading 态而非逐字流。

## 待后续 phase 决策（不阻塞需求定义）
- 默认生图 model 选哪个（速度 doubao > gemini > gpt-image-2 high；质量待主观评测）。
- URL 模式 vs base64 模式的统一内部表示（建议内部统一成 base64 data URL 供 Office 插图，URL 模型多一步 fetch）。
- gemini `thoughtSignature` / `web_search` tool 等高级参数是否暴露。
