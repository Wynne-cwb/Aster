# Aster Phase 0 — GATING 审阅报告

**日期：** 2026-05-27
**审阅人：** Wynne（用户实测）+ Claude（编排 / 证据整理）
**Wave：** 3（Plan 00-06 GATING checkpoint）
**整体决策：** ✅ **PROCEED** —— 进入 Phase 1，无需 PRD 修订

---

## 决策摘要

三项 GATING 全部 PASS。Aster 的核心架构假设——**零后台、浏览器直连 Provider、Office 原生写回、Key 存浏览器本地**——全部得到生产环境实证支持。按 D-04/D-05，项目可推进到 Phase 1。

| GATING | 结果 | 核心证据 |
|--------|------|----------|
| #1 CORS | ✅ PASS | 生产 https（GitHub Pages）+ PPT Task Pane 下，DeepSeek 流式 chat + aihubmix 生图均跨域成功 |
| #2 PPT 写回 | ✅ PASS（带 caveat） | insertSlidesFromBase64 + 文字替换肉眼确认成功；插图经 fallback 可行 |
| #3 存储 scope | ✅ PASS | partitioned localStorage 浏览器本地存取行为符合 PRD F5/AC6 |

---

## GATING #1 — CORS ✅ PASS

**问题：** 浏览器能否从生产 https origin 跨域直连 DeepSeek + aihubmix？（这是"无后台"架构的生死线）

**结论：** 能。两个 Provider 的跨域请求均被浏览器放行，独立 Chrome 标签页 + PPT Task Pane 两处一致。

**关键认知（写进了 findings，影响所有 Provider 调用代码）：** CORS 成功信号是 `fetch()` 成功 resolve，**不是**读 `Access-Control-Allow-Origin` 头（浏览器从不把该头暴露给 JS）。spike 测试页最初因为这个误判逻辑显示"CORS 失败"，实际是 PASS。

**影响：** Phase 2 Provider 客户端直接 fetch 直连，无需代理；**D-06 Cloudflare Worker fallback 封存未触发**；PROJECT.md Core Value "无后台" 无需缩减。

详情：[001-cors-verify/findings.md](001-cors-verify/findings.md)

---

## GATING #2 — PPT 写回 ✅ PASS（带 caveat）

**问题：** PPT for Web 能否端到端写回（插 slide / 插图 / 改文字）？

**结论：** 能。三场景均可行：
- ① insertSlidesFromBase64 插新 slide：✅ 肉眼确认
- ② 选中 slide 插图：✅ 经 `setSelectedDataAsync(Image)` fallback 可行（选中整页时）
- ③ 替换文字：✅ 肉眼确认

**3 条 caveat（留给 Phase 4 实现，非 GATING 阻塞）：**
1. `slide.shapes.addImage` 是 preview API，PPT for Web 未 GA → 插图只能用 fallback
2. 插图 fallback 只能插**活跃 slide** + 要求选中整页（非文字框）；选中文字框会失败"无法写入到当前所选内容"
3. **`setSelectedDataAsync(Html)` 在 PPT 不支持（错误 5007）→ PRD R1 写的 PPT Plan B 作废**。但主路径 insertSlidesFromBase64 成功，PPT-01 不依赖此 fallback

**为何 caveat 不构成 GATING FAIL：** GATING #2 的本质是"PPT 写回是否端到端可行"，答案是 yes（插 slide + 改文字干净通过，插图经 fallback 通过）。caveat 是 Phase 4 的实现约束，不是架构级阻塞。

详情：[002-ppt-writeback/findings.md](002-ppt-writeback/findings.md)

---

## GATING #3 — 存储 scope ✅ PASS

**问题：** partitioned localStorage 能否在浏览器本地稳定存取 API Key？

**结论：** 能。用户实测确认行为符合 PRD F5/AC6 假设。

**待补（不阻塞）：** 三宿主 partitionKey 实测值 + Excel/Word 跨文档 + 跨浏览器隔离的正式截图，留待 Phase 7 REL-04/REL-05 完整归档。

**影响：** Phase 2 Key 管理直接用 partitioned localStorage；PRD F5 的 RoamingSettings→localStorage 修正得到实证支持。

详情：[003-storage-scope/findings.md](003-storage-scope/findings.md)

---

## 顺带产出：Manifest sideload 真实发现（Phase 1 直接受益）

GATING 测试过程中调通 sideload，积累 3 条 manifest 必修项（Phase 1 写正式 manifest 直接套用）：
1. `<Version>` 必须 ≥ 1.0（0.0.1 被拒）
2. base 段必须有 `<SupportUrl>` + `<IconUrl>` + `<HighResolutionIconUrl>`（VersionOverrides 里的图标不顶用）
3. Supertip 的 `<Description>` 必须引 **LongString**（引 ShortString 会在 Office 运行时报 `resid not found`，官方 validate 抓不到）

另外确认：**免费个人 Microsoft 账号**可通过 开始→加载项→更多设置→上传我的加载项 sideload（不需 M365 工作账号）。

---

## 下一步

- **GATING 收口完成**（本报告）。
- 非 GATING 项 #4-#10 待用户实测（spike 代码已就绪）。
- 全部 spike 收口后 → Wave 5（00-11）写 MANIFEST 终稿 + PHASE-REPORT → Phase 0 verify → Phase 1。
- **CLAUDE.md 待修**：`@fluentui/tokens@^9` 不存在（最高 1.0.0-alpha.23），tokens 由 `@fluentui/react-components` 携带（spike #9 发现）。
- **00-CONTEXT D-02 待修**：实际 Pages URL 是 `https://wynne-cwb.github.io/Aster/`（非占位符 `wb-chen.github.io/aster`）。
