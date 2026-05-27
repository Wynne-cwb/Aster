# Phase 0 — Spike & 风险验证 PHASE REPORT

**Milestone:** v1.0 发布
**时间盒:** 2026-05-26 ~ 2026-05-27（≤ 1 周硬时间盒，实际 ~2 天）
**整体决策:** ✅ **PROCEED — 进入 Phase 1，无需 PRD 修订**

---

## 一句话结论

Aster 的核心架构假设——**零后台 / 浏览器直连 Provider / Office 原生写回 / Key 存浏览器本地**——全部经生产环境实证成立。10 项最高风险全部验证收口，无任一 GATING 失败，项目绿灯进 Phase 1。

---

## 10 项 Spike 结论表

| # | Spike | GATING | 结果 | 一句话结论 |
|---|-------|--------|------|-----------|
| 1 | CORS 直连 | ✅ | **PASS** | 浏览器从生产 https 跨域直连 DeepSeek + aihubmix 成功，无后台架构成立 |
| 2 | PPT 写回 | ✅ | **PASS**（caveat） | 插 slide + 改文字干净通过；插图经 fallback 可行（活跃 slide + 整页选区） |
| 3 | 存储 scope | ✅ | **PASS** | partitioned localStorage 浏览器本地稳定存取，符合 PRD F5/AC6 |
| 4 | DeepSeek 多模态 | 非 | **FAIL**（不止损） | HTTP 400 拒绝 image_url，双端确认不支持 → 锁 aihubmix 为 v1 唯一视觉路径 |
| 5 | API 混用 #5022 | 非 | **INCONCLUSIVE** | 重现不出（Html coercion 不支持挡掉序列）；规避规则"不混用 Common+Host API"成立 |
| 6 | getSelectedSlides 反序 #3618 | 非 | **PASS** | bug 实锤（原始 [1,0] 非升序），sort-by-index workaround 有效 |
| 7 | pdfjs 解析 | 非 | **PARTIAL** | CDN 版真实 PDF 抽文成功；生产构建 worker 验证推迟 Phase 1/3 真实 build |
| 8 | pptx 文本提取 | 非 | **PASS** | jszip + DOMParser 33 行核心逻辑提取 `<a:t>` 文本跑通 |
| 9 | bundle 基线 | 非 | **PASS** | 实测 gzip ~135KB，远低于 1MB 硬限与 300KB 参考线 |
| 10 | sideload checklist | 非 | **PARTIAL** | PPT 端到端 sideload 成功 + 免费账号可用 + 3 个 manifest 必修项；6 组合矩阵推迟 P7 |

详细证据：每项见 `.planning/spikes/00X-{slug}/findings.md`；GATING 决议见 `.planning/spikes/GATING-REPORT.md`。

---

## 影响下游阶段的关键发现

### 架构级（核心价值确认）
- **CORS 直连成立** → Phase 2 Provider 客户端直接 `fetch`，无代理层；D-06 Cloudflare Worker fallback 封存未触发；PROJECT.md "无后台" 无需缩减。
- **CORS 判定认知**：成功信号 = `fetch()` resolve（拿到状态码+读 body），**不是**读 `Access-Control-Allow-Origin` 头（浏览器不暴露给 JS）。写进所有 Provider 调用代码。

### Phase 2（Provider / Key）
- **DeepSeek 不支持图像** → ProviderRegistry `resolve('vision')` v1 只注册 aihubmix；D-12 默认 routing 决策简化（无需在 vision 上选 DeepSeek）。
- **Key 存 partitioned localStorage** 实证成立。

### Phase 3（文件解析）
- pdfjs（PDF 抽文）+ pptx（jszip+DOMParser）方案成立，均懒加载不进初始 bundle。
- pdfjs 生产构建 worker：用 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`，禁 `?url` 反模式（Pitfall #7，Phase 1/3 真实 build 时闭环）。

### Phase 4（PPT 参考实现）— 3 条 caveat
1. `slide.shapes.addImage` 是 preview API 未 GA → 插图只能用 `setSelectedDataAsync(Image)` fallback（活跃 slide + 整页选区）。
2. **`setSelectedDataAsync(Html)` 在 PPT 不支持（错误 5007）→ PRD R1 的 Html Plan B 作废**；主路径 insertSlidesFromBase64 成立，不依赖它。
3. `getSelectedSlides()` 后**必须** sort-by-index（#3618）；不混用 Common+Host API（#5022 规避规则）。

### Phase 1（Foundation）— manifest 3 必修项（直接套用）
1. `<Version>` ≥ 1.0
2. base 段必须有 `<SupportUrl>` + `<IconUrl>` + `<HighResolutionIconUrl>`
3. Supertip `<Description>` 必须引 LongString（validate 抓不到，运行时才报）

---

## Phase 1 前置条件确认

- [x] 生产 https 托管就绪（GitHub Pages，公开仓库，CI 自动部署）
- [x] CORS 直连路径确认（无需代理）
- [x] PPT 写回可行（含 caveat，Phase 4 按约束实现）
- [x] 存储方案确认（partitioned localStorage）
- [x] bundle 预算有余量（baseline ~135KB gzip，CI gate 阈值已建议）
- [x] manifest sideload 流程 + 必修项已知
- [x] 解析库选型成立（pdfjs / jszip）
- [x] vision 路径锁定（aihubmix）

**结论：Phase 1（Foundation 与跨宿主骨架）所有前置条件满足，可启动。**

---

## Phase 7 REL-05 regression 重跑说明

本 Phase 0 的 10 项验收清单是 v1.0 发布前的 regression 基线。Phase 7 REL-05 重跑方法：

1. **入口：** `.planning/spikes/MANIFEST.md` —— 10 行清单 + 每项 findings 链接。
2. **重跑范围：** 全部 10 项在 v1.0 实际代码（非 spike 代码）上重验一次，确认未在任何已知风险点回退。
3. **特别补全（Phase 0 未完成、标记 PARTIAL 的）：**
   - #7 pdfjs：用真实 Vite 生产 build 验证 worker 独立文件 + 不 404（Pitfall #7 闭环）
   - #10 sideload：补齐 Excel/Word + 第二浏览器的完整 6 组合矩阵（并入 REL-04 AC1-AC8）
   - #3 存储：补齐三宿主 partitionKey 实测值 + 跨浏览器隔离截图
   - #5 API 混用：若 Phase 4 实际遇到挂死，用 setSelectedDataAsync(Text) 重测
4. **PASS 判据：** 10 项均 PASS（PARTIAL 项在真实代码上转 PASS），无回退。

---

## 待办（已分流，不阻塞 Phase 1）

- **CLAUDE.md 修正**：Tech Stack 表 `@fluentui/tokens@^9` 行——npm 无 9.x（最高 1.0.0-alpha.23），tokens 由 `@fluentui/react-components` 携带，应用层不直接装。
- **00-CONTEXT D-02 修正**：实际 Pages URL `https://wynne-cwb.github.io/Aster/`（非占位符 `wb-chen.github.io/aster`）。
- **Phase 1 markdown 渲染评估**：实测 react-markdown+remark-gfm（gzip 46KB）比 Fluent UI v9（5 组件 31KB）更重，与 CLAUDE.md 估算相反——考虑流式期间用纯文本、完成后 lazy-import MD 渲染。
