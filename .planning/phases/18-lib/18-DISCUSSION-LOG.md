# Phase 18: LIB — 公开图库检索（Pexels, BYO key） - Discussion Log

**Discussion date:** 2026-06-02
**Mode:** GSD discuss-phase（团队模式：discuss-18 teammate 经 team-lead 转达真人用户）
**Output:** 权威决策落于 `18-CONTEXT.md`；本文件 = 审计轨迹（问题 / 选项 / 用户拍板 / 理由）。

---

## 上下文加载（fresh context）

读取并对账：
- `CLAUDE.md`（无后台硬约束、bundle ≤82KB gzip、纯静态浏览器直连、teal 克制 UI、BYO key partitioned localStorage、中文沟通、GSD workflow enforcement、发布授权）。
- `.planning/ROADMAP.md` §Phase 18（Goal / LIB-01..03 / spike=Pexels CORS 最高风险 / 依赖 Phase 16 insert helper / 3 success criteria）。
- `.planning/REQUIREMENTS.md`（LIB-01/02/03 + Out of Scope：内置 key 否决 / Cloudflare Worker 仅 CORS 失败触发 / 图片不进 history；Future LIB-D1 Unsplash deferred）。
- `.planning/STATE.md`（Phase 16 已完成、v2.2 进度、open points MM-04 图库 CORS）。
- `.planning/research/SUMMARY.md`（Pexels 选型理由、双重 CORS 风险、insert helper 复用、内置 vs BYO 开放决策）。
- `.planning/phases/17-file/17-CONTEXT.md`（统一附件 store / BYO key Settings 范式 / 诚实结构化错误 / NFR 守门——保持一致）。
- `.planning/phases/16-img-ppt-word/16-CONTEXT.md`（插图基础设施 + insert helper + loop 内直插反转）。
- **codebase scout（file:line 实证）**：`src/lib/insertImage.ts`（为 Phase 18 保留的 helper）、`src/agent/tools/write/ppt-image.ts` + `word-image.ts`（生图 loop-tool 范式）、`src/adapters/{Ppt,Word}Adapter.ts` 插图方法、`src/providers/registry.ts`（`stock-image` stub + image-gen/vision case 样板）、`src/providers/types.ts`（TaskKind 已含 stock-image）、`src/lib/storage.ts`（STORAGE_KEYS + partitioned storage）、`src/components/Settings/SettingsPanel.tsx`（image-gen picker pref-section 范式）、`src/lib/sse.ts`（Bearer header 范式）。

### 预先拍板（team-lead 指令，直接 bake，未提问）
- Pexels CORS spike → **延后 Phase 19** 统一真机验证；discuss/plan 不阻塞于它（记入风险/延后区，本里程碑最高风险）。
- CORS 失败兜底 = **Cloudflare Worker 轻代理**（不上阿里云 VM，memory `project_no_backend_status`）；设计让「失败可平滑切 Worker」（base URL 可配），默认实现纯浏览器直连。
- 复用 Phase 16 插图能力插图（不另起插入路径）；**不叠水印**，署名在 **chat 内**（带链接）。
- BYO Pexels key 存 **partitioned localStorage**（沿用既有 provider key 范式）；无后台不妥协；bundle ≤82KB；优先 0 净新增运行时依赖（native fetch）；teal 克制 UI、中文。

---

## 灰区识别

按「需人类拍板 vs 可自决」二分。**真·灰区 3 个**（产品取向 / 质量取舍 / UX 落点），其余 11 项有合理默认或 codebase 可证，自决并记录。

发现一处**记录冲突**（核心灰区根因）：
- memory `project_image_insert_autonomous`：「生图/插图走 loop 内自动直插无确认卡……**Phase 18 图库同此**」（自动直插）。
- ROADMAP §18 success criteria：「返**缩略图网格 + 选中插入**」（手动选）。
- 两者直接打架 → 必须由真人拍板（team-lead 亦标此为「核心灰区，重点分析」）。

---

## 提问与拍板（批量一次发出，team-lead 转真人）

### Q1【核心】图库检索→插入的端到端流程？
**discuss-18 推荐：A（网格手动选）**——理由：生图≠图库（图库是「从 N 张差异大的真实照片里挑」，第一张常非所想）；贴合 ROADMAP 字面；insertImage helper 专为此（UI 按钮、脱离 loop）保留。但明确这是用户产品取向，并点出 memory 冲突。

- A) AI 检索 + 缩略图网格手动选插入（discuss 推荐）
- B) AI 自动检索 + 自动选首张直插（loop 内，照 Phase 16；「换一张」循环）
- C) 混合（自动插首选 + 网格可纠正）

**✅ 用户拍板：B（自动直插首张）** —— 与 discuss 推荐**相反**。理由：与 Phase 16 生图 + memory `project_image_insert_autonomous`（图库同此）完全一致的 agentic 体验；**memory 无需改动**。
- 落实：`search_stock_image` = **loop 内 write tool**，照抄 `generate_ppt_image` 范式（含 `timeoutMs` 覆盖默认 15s，因网络 fetch 图可能慢）；AI 检索 → 自动选首张（可依 query 选最匹配） → fetch full-res → 裸 base64 → 复用 Phase 16 插图路径直插 → 返回 shape_id 供 AI 自主排版。「换一张」= 沿用 Phase 16 regenerate 范式（取下一结果/重搜再插）。**不做**网格手动选；署名仍 chat 内只读（带链接、不叠水印）；可选只读结果缩略图卡（仿 Phase 16 ImagePreviewCard 只读，无选择交互）。Excel 仍诚实「不支持插图」。
- → 落 18-CONTEXT D-01 / D-02（reconcile）/ D-03 / D-05 / D-06 / D-07 / D-11。

### Q2【质量】Pexels 搜索关键词用中文还是 AI 转英文？
**discuss-18 推荐：A（AI 转英文）**——Pexels 英文召回远好于中文；类比 Phase 16 D-03 prompt 增强；memory `project_quality_over_cost`。

- A) AI 转英文搜（locale 仍 zh-CN）（推荐）
- B) 直接中文搜
- C) 中英双轨回退

**✅ 用户拍板：A（AI 转英文搜）** —— UI/locale 仍中文，检索词 AI 翻英文，质量优先。
- → 落 18-CONTEXT D-04。

### Q3【UX 落点】BYO Pexels API key 在 Settings 里怎么呈现？
**discuss-18 推荐：A（独立 Settings 字段）**——Pexels 非 LLM、无 model/baseURL，塞进 ProviderForm 别扭；独立字段最干净、最符合 teal 克制。

- A) 独立 Settings 字段（仿 image-gen picker pref-section，存 `aster:keys:pexels`）（推荐）
- B) 作为 Provider 列表项

**✅ 用户拍板：A（独立 Settings 字段）** —— 存 partitioned localStorage。
- → 落 18-CONTEXT D-08。

---

## 已默认决定（未提问，用户复核无异议，全采纳）

1. 复用 Phase 16 插图基础设施（**reconcile：Q1=B 下复用的是 adapter 插图方法 + 标准 write-tool reverse 路径，不是 `insertImage.ts` helper 的手动 appendOperation —— 见 D-02**）；PPT 当前 slide 居中、Word body 追加；Excel out-of-scope 诚实提示（D-01/D-02/D-11）。
2. 插入路径：Pexels 远程 URL → fetch full-res → 裸 base64（复用 doubao `fetchUrlToBase64`）→ adapter 插图；缩略图用远程 `<img src>`（不受 CORS 限制）（D-03/D-06）。
3. 署名：chat 内每张「照片来自 Pexels · 摄影师 [name]（链接）」，不叠水印（D-07，LIB-03）。
4. registry `stock-image` stub 填实；缺 key 抛 KeyInvalidError；baseURL `https://api.pexels.com/v1` 可配（Worker 兜底口）（D-09）。
5. 鉴权 gotcha：Pexels `Authorization: <裸 key>`（**不加 Bearer**）；apiKey 仅 header 不进 body/error（T-14-01）；0 净新增依赖 native fetch（不装 pexels/unsplash-js npm 包）（D-10）。
6. per_page 默认 10-15（无网格，够 AI 选首张+翻页）；诚实结构化错误（未配 key / 429 速率 200/h / 无结果 / CORS / 插入失败）（D-12/D-13）。
7. NFR-09 延续：插入图字节不进 persisted history；若 result 携 base64 扩展 serialize 守门（D-14）。
8. Unsplash 等其它图库不做（LIB-D1 deferred）；Pexels only（Deferred）。
9. bundle ≤82KB（native 零依赖近零增量，先 build 再 size）；teal 克制 UI（aster-design-system）；中文 + Lingui extract（D-15）。
10. `insertImage.ts` helper（Q1=A 遗产）建议删除或留置不动（D-02 / Claude discretion）。
11. PPT 新工具 snake_case + 入 `PPT_TOOLS` Set（Phase 14 D-10 casing 守门）（D-01）。

## 已 bake 进风险/延后区（不阻塞 plan）

- **Pexels 双重 CORS 面**（① API 调用 ② 选中图 full-res fetch→base64，`images.pexels.com` CDN 更易出问题）在 Office Web iframe 三浏览器真机 → **spike 延后 Phase 19**（本里程碑最高风险）。失败兜底 = **Cloudflare Worker 轻代理**（base URL 可配，只换 URL 不动逻辑即可平滑切；默认纯浏览器直连无后台）。

---

## Scope 守护

无 scope creep。讨论全程围绕 LIB-01/02/03「如何实现」，未引入新能力。否决/延后项（网格 UX、Unsplash、内置 key、多变体、图片进 history）均明确记录，未行动。

---

*Phase: 18-lib*
*Discussion completed: 2026-06-02*
*Next: `/gsd-plan-phase 18`（planner 读 18-CONTEXT.md；务必先读 🔴 PLANNER 必读 + D-01/D-02 reconcile）*
