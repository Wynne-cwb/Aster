# CORS 验证（Spike #1）— PASS

> ✅ **GATING**：PASS — 无后台直连架构成立，不触发 GATING-FAILED-1.md

## 场景

从生产 https Task Pane（GitHub Pages URL）直连 `api.deepseek.com` 与 `api.aihubmix.com`。
验证浏览器 fetch 能否跨域成功直连两个 Provider。

## 测试步骤

1. sideload spike manifest 到 PPT for Web ✓
2. 打开 Task Pane（spike/cors-test.html）✓
3. 输入 DeepSeek / aihubmix dev key（仅 UI 输入）✓
4. 触发流式 chat completion + 生图请求，观察是否跨域成功 ✓
5. 同时在独立 Chrome 标签页（同源 GitHub Pages）交叉验证 ✓

## 实测结果

**测试上下文：** 独立 Chrome 标签页 + PowerPoint for Web Task Pane（同源 `https://wynne-cwb.github.io`），两处结果一致。

**DeepSeek CORS 状态：PASS**
- fetch 成功 resolve，HTTP 200
- SSE 流式 chat completion 跑通至 `[DONE]`
- 跨域响应被浏览器放行（能读取状态码 + 流式 body）

**aihubmix CORS 状态：PASS**
- fetch 成功 resolve
- 生图请求成功返回图片（修正 size 为 `1024x1024` 后；首次 `256x256` 返回 HTTP 400 是应用层参数错误，非 CORS——浏览器仍放行了该 400 响应体）

**关键认知（影响后续所有 Provider 调用代码）：**
- CORS 成功的真实信号 = `fetch()` 成功 resolve（拿到状态码 + 能读 body），**不是**读 `Access-Control-Allow-Origin` 响应头
- 浏览器**从不**把 `Access-Control-Allow-Origin` 暴露给 JS（fetch 规范，ACAO 不在可读 safelist）——`response.headers.get('Access-Control-Allow-Origin')` 永远返回 null，与 CORS 是否成功无关
- CORS 真失败的表现是 `fetch()` 抛 `TypeError: Failed to fetch`，根本拿不到状态码

## 证据

- [x] 实测确认：独立 Chrome + PPT Task Pane 两处 DeepSeek 流式 + aihubmix 生图均成功
- [ ] 正式录屏 / 响应头截图：本次 session 未归档（live 确认通过）。REL-05 regression 重跑时建议补录屏存档。

> ⚠ 安全提示：测试用 dev key，截图前确认 Authorization header 不可见

## 决策

**结果：** ✅ PASS

**依据：** DeepSeek 流式 chat + aihubmix 生图均跨域成功；浏览器放行两个 Provider 的跨域请求。Aster "零后台、浏览器直连 Provider" 的核心架构成立，**不需要 D-06 Cloudflare Worker fallback**。

**对后续的影响：**
- Phase 2 Provider 客户端无需代理层，直接 `fetch` 直连
- D-06 Cloudflare Worker fallback 路线封存（未触发，留作未来 Provider 若改 CORS 策略时的预案）
- 不需要对 PROJECT.md Core Value "无后台" 做任何缩减
