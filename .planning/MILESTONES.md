# Milestones

## v2.1 从能用到好用 (Shipped: 2026-06-01)

**Delivered:** 在 v2.0「Office 智能代理」基座上，把 Aster 从「能用」推到「好用」——agent 更懂三宿主（per-host domain prompt + 用户偏好注入）、能改更多（Word 5 / Excel 10 / PPT 8 共 23 个 write tool 全补）、改得更快更准（批量操作 + Word 选区精度）、体验更顺（UI 打磨套件）、记得住历史（聊天记录持久化）。三宿主 Office for Web 真机端到端 UAT 全 PASS，已上线 GitHub Pages（线上 `2c0201e`，origin/main 同步，CI+Deploy 双 success）。

**Stats:**
- Phases: 6（8, 9, 10, 11, 12, 13）
- Plans: 27（8:5\* · 9:7 · 10:5 · 11:5 · 12:5；Phase 13 = UAT/Release 无独立 plan）
- Commits（v2.1 区间 `f9fdcc4..HEAD`）: 162（含 v2.0 收官 + v2.1 setup 数个 doc commit）
- Files changed: 171（+42.2K / −3.6K，含 .planning 文档）· src LOC: ~29.9K（ts/tsx，v2.0 ~20.7K → +~9K）
- Tests: 773 passed / 0 failed · Bundle: 75.03 KB gzip ≤ 82 KB CI gate · 0 净新增运行时依赖
- Timeline: 2026-05-30（milestone start）→ 2026-06-01（ship）
- Tag: `v2.1`（同 commit 补标 v2.0 @ `f9fdcc4`）

\*Phase 8 磁盘 4 个 SUMMARY；08-05（Settings 偏好 UI + Spike S6）交付折叠进偏好链路与配套 quick task，无独立 SUMMARY——偏好功能已真机 UAT 验证。

**Key accomplishments:**

1. **A 能力变聪明** — PPT/Excel/Word 三宿主各一套深化 domain system prompt（PPT 断言式标题 + ≤5 点/页 + verify-after-create；Excel 先 get_used_range_summary + 分块 + pipeline；Word 先取大纲保论点只改语言）；用户偏好注入（Settings 自定义 → 自动注入每轮 prompt），带 prompt-injection 防御（sanitizePrefs String.includes 防回溯 + 原始/sanitize 分离 + ≤500 字符 + 命中注入词静默过滤）（PROMPT-01, PREF-01/02）
2. **B-Word 精准写 + 选区精度** — 5 write tool（字符格式/段落格式/套样式 locale-safe/查替换快照 undo/插表格）+ WSEL-01 `selection_detail` 返 paragraphIndex + uniqueLocalId，多个相同文本时精确定位正确那一段（WORD-01~05, WSEL-01）
3. **B-Excel + B-PPT 工具全补** — Excel 10 工具（数字格式/列宽行高/排序/筛选/查替换/条件格式/建表/冻结/工作表/图表标题）+ PPT 8 工具（字体/对齐/形状增删/旋转/背景/幻灯片管理）；13 完整 inverse + noop+gate 分类 + 3 spike 门控降级；D-17 23/23 守门通过（EXCEL-01~10, PPT-01~08）
4. **C 批量操作** — `batch_write` 单 `Excel.run`/`Word.run` 闭包 + 单 `context.sync()` + fail-fast（第 i 步失败立即停报告）+ `batch_reverse` 逆序整批 undo + DiffLogPanel「批量改动 N 处」可展开卡；守门当场抓出双重逆序 bug 并修（BATCH-01/02）
5. **F 持久化 + E UI 打磨** — 聊天记录 localStorage 持久化（白名单字段 + 每条 ≤2000 字符 + QuotaExceeded 丢最旧）+ 一键清空 + 20 轮上下文截断（整 run 删防孤立 tool）+ docKey 分文档（pathname 防 token 泄露）；UI-01 safeUrlTransform XSS 防御 + UI-02 思考气泡 + UI-03 DiffLog 边界跟随 loop + UI-04 表格边框 + UI-05 读卡降权 + UI-06 骨架屏（HIST-01~04, UI-01~06）
6. **三宿主真机 UAT 全 PASS + 上线** — Excel/Word 全套 + PPT（选区/字体/对齐/背景/旋转/加形状/删除）+ 界面 + 偏好/持久化，Chrome × Edge 真机端到端验证；多轮 PPT 真机迭代修复 spike「假成功」+ snake/camel 键名 bug + 写后回读「假失败」误判；已部署 GitHub Pages，773 tests green / 0 净新增依赖 / 75.03 KB

**项目原则确立（v2.1）:** AI 生成质量 >> token 成本 & 包体积——NFR-07 由 `<3000 字符硬 CI gate` 降为软提醒、NFR-08 去掉 toolDefs ≤15KB token 门；undo 守门 / bundle gate / P95 仍硬卡（见 memory `project_quality_over_cost`）。

**Requirements outcome:** **42/42 全部交付**（code-level 验证 + 三宿主真机 UAT 全 PASS）。收官修正 REQUIREMENTS 溯源表 stale 记账：UI-04（表格边框，12-03 已交付）+ UI-06（骨架屏，12-02 `c2840dc` 已交付）从 Pending/未勾 → Complete。

**Known limitation（非 bug，→ v2.2/桌面版）:** PPT `copy_slide` 网页版 `Slide.copy()` 微软接口天生不支持 → 诚实失败（桌面版可用）。

**Deferred / 拆出:**
- **v2.2 多模态四件套**（MM-01..05）：视觉看图 / 文件上传解析 / 图片生成插入 / 公开图库检索 + AiHubMix model 修正——独立 milestone
- **B 工具 defer → v2.2**：EXCEL merge/remove_dup/pivot、WORD 高亮/列表/批注/edit_table/页眉页脚、PPT add_line/渐变填充/insert_table/add_image、WSEL 绝对字符偏移
- **技术债根治 → v2.2**：PPT 工具 snake/camel 不一致（已双键容错兜住，根治 = dispatch 层中央归一化）

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 20 项均为陈旧簿记或已被 Phase 13 里程碑 UAT 覆盖，0 真正未完成——2 debug sessions（均 fix-applied + 已部署）+ 12 quick tasks（均完成有 commit，status 字段缺失的扫描器怪癖）+ 5 uat_gap 文件（04/07 属 v2.0 已发布；09/10 partial 场景已被 Phase 13 里程碑 UAT 实测覆盖）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 v2.0 交付）。

---

## v2.0 Office 智能代理 (Shipped: 2026-05-30)

**Delivered:** Aster 从「单步 AI 提效工具」重写为「Office 内嵌智能代理」——在当前打开的单个 Office 文档内由 LLM 自主多步执行任务，用户全程可观察 / 暂停 / 兜底回滚；v2.0 是 Aster 首次公开发布（线上 `f9fdcc4`，GitHub Pages，Chrome × 三宿主 sideload）。

**Stats:**
- Phases: 6（3, 4, 04.1, 5, 6, 7）
- Plans: 53 · Commits（v2 区间 `9bdaa06..HEAD`）: 295（115 feat/fix/refactor）
- Files changed: 303（+58.4K / −2.7K）· src LOC: ~20.7K（ts/tsx）
- Bundle: 73.42 KB gzip ≪ 1MB（CI gate ≤82 KB）· 0 净新增运行时依赖
- Timeline: 2026-05-28（vision pivot）→ 2026-05-30（ship）
- Tag: `v2.0`

**Key accomplishments:**

1. **Multi-step agent loop 地基** — 手写 `src/agent/loop.ts`（≤80 行 while runner + Zustand + AbortController，不引 XState）+ max_steps=20 fail-safe + 软着陆；统一 `AbortReason = 'visibility'|'user'|'max_steps'|'circuit'` 入口（AGENT-01/02/13）
2. **Context-aware read tools 全套** — 三宿主 `adapter.read()` + 11 个离散 read tool + prompt-injection 包装 `{result_type, content, source}` + 50K token / 10K cell size cap + TOOL-07 eslint rule 禁 Office.js proxy 出闭包（TOOL-01/02/05/06/07）
3. **Diff Log + Undo All 跨三宿主** — `OperationLog` + 自写 inverse op（禁用 Office native undo）+ DiffLogPanel humanLabel 汇总卡 + per-step/undo-all + before-image 手改防御 + sessionStorage F5 兜底（AGENT-07/09/10/11, TOOL-03/04）
4. **多宿主 write tools + 差异化护城河** — PPT/Excel/Word write tools 全套，含 `set_shape_property`/`move_shape`（Copilot Agent Mode 不暴露的 shape 精细化能力）；TS 强制 reverse + humanLabel 缺失编译失败（AGENT-08）
5. **错误恢复协议** — 结构化 `{code, message, recoverable, hint}` + `sanitizeFromAsterError` 唯一脱敏边界（不读 stack/路径/Key）+ (tool×code) sliding-window circuit breaker + 「Agent gave up」红卡（ERR-01/02/03/04）
6. **4 killer scenario as agent flows + teal 克制设计 + 首发** — PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化，Chrome × 三宿主真机端到端 UAT 全 PASS；Phase 04.1 完成 teal 克制设计系统迁移（无渐变/无 backdrop-filter）；README 重写为代理定位 + sideload 发布

**Requirements outcome:** 31 项中 **30 项交付**（code-level 验证 + 三宿主真机 UAT 全 PASS）。

**Descoped (→ v2.1):**
- **ONB-01** Onboarding GIF/动画 — Phase 6 决策 D-18/D-19 把 Onboarding 收成单步、删 `Step2Guide.tsx`，GIF 承载位移除；心智锚定由 empty-state killer-scenario chips（ONB-03）+ 全程中文 humanLabel step 摘要（ONB-02）承担。FUT-13。**→ 2026-05-30 Cancelled：不进任何后续 milestone（用户决定不做），不补回。**
- **FUT-16 图片生成插入（`insert_image_on_slide`）** — v2.0 TOOL-03 名义含此项，Phase 6 Out-of-scope 列为 stretch **未实现**；aihubmix 生图客户端（`aihubmix-image.ts`）在基座但未接 agent。TOOL-03 其余 13 write tool 全部交付。
- **FUT-14 视觉 / 看图（multimodal vision）** & **FUT-15 文件上传与解析** — 收官时发现这两块在 v2.0 既无需求也不在原 FUT 列表（视觉：`aihubmix-vision.ts` 客户端在基座但未接 agent；文件上传：仅禁用态回形针图标）。收官补记为 v2.1 候选（见 PROJECT.md Active），避免归档时丢失。

**Known deferred items at close（artifact audit acknowledged，详见 STATE.md §Deferred Items）:** 12 项均为陈旧簿记，0 真正未完成——2 debug sessions（Phase 4 PPT host-fail / reasoning-content roundtrip，均 fix-applied + 已部署）+ 6 quick tasks（均完成有 commit，状态字段缺失）+ 3 uat_gap 文件（04/07，`open_scenario_count: 0`，UAT 实际全 PASS）+ 1 todo（builtin-model-dropdown，已由 CARRY-02 交付）。

> **过程修订记录：** REQUIREMENTS.md traceability 表中 7 项需求（AGENT-02/08/13, ERR-01/02, CARRY-01, NFR-02）虽标 Pending 实为已交付（GSD `phase.complete` 复发的 stale-checkbox quirk，见记忆 `project_gsd_tooling_quirks`）；收官时已逐项 code-level 核验修正为 Complete。

---
