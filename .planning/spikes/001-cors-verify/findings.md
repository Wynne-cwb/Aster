# CORS 验证（Spike #1）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-1.md，项目进入 PRD 修订状态

## 场景

从生产 https Task Pane（GitHub Pages URL）直连 `api.deepseek.com` 与 `api.aihubmix.com`。
验证浏览器 fetch 是否获得 `Access-Control-Allow-Origin` 响应头。

## 测试步骤

1. sideload spike manifest 到 PPT for Web
2. 打开 Task Pane（spike/cors-test.html）
3. 输入 DeepSeek API Key（dev/test key，小额度）
4. 触发流式 chat completion 请求，观察 DevTools Network → 响应头
5. 触发 aihubmix 生图请求，观察响应头
6. 录屏 + 截图响应头（注意：截图前确认 Authorization header 不可见）

## 实测结果

<!-- 填写时间：Day 1-2 -->

DeepSeek CORS 状态：
- Access-Control-Allow-Origin: （待填）
- 流式 chat completion 是否成功：（待填）

aihubmix CORS 状态：
- Access-Control-Allow-Origin: （待填）
- 生图请求是否成功：（待填）

## 证据

- [ ] 录屏：`recording.mp4`（>100MB 走 GitHub Release）或 GIF
- [ ] DeepSeek 响应头截图：`deepseek-response-headers.png`
- [ ] aihubmix 响应头截图：`aihubmix-response-headers.png`

> ⚠ 安全提示：截图前确认 Authorization header 不在可见区域，或已 redact

## 决策

**结果：** PENDING

**PASS 条件：** DeepSeek + aihubmix 均返回 `Access-Control-Allow-Origin: *` 或匹配 Pages 源，
流式 chat 跑通，生图请求成功

**FAIL 行动：**（仅在 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-1.md`
- 启动 D-06 CORS fallback：Cloudflare Worker 代理路线
- 项目进入 PRD 修订状态，不进 Phase 1
