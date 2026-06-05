# Phase 25: WPS spike-gate（WPS Windows 桌面版可行性探路）- Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

> **GSD 命名说明：** 本项目 discuss 产物沿用 `NN-CONTEXT.md`（plan-phase 消费的权威决策文件）+ `NN-DISCUSSION-LOG.md`（审计轨迹），即 team-lead 口中的「DISCUSS.md」。下游 planner / researcher 读本文件。

> 🔴 **PLANNER 必读 — 本里程碑交付边界因用户 Q1 答案收窄。** 真人用户拍板 **Q1 = 「暂无 Windows 环境，真机延后」**，所以 **Phase 25 在 v2.4 里程碑内只交付 WPS-01（调研报告 + 真机验证清单）**；**WPS-02（真机 sideload + 三宿主 run() 实测 + 最终 go/no-go 裁定）整体延后**到用户有 Windows 环境时（异步补做 / 下个里程碑）。里程碑照常 ship C 工具 + 配置两条线，不被 WPS 阻塞。见 D-01。
>
> 🟡 **本 phase 是 SPIKE（调研 + 清单），不写运行时代码。** 没有 adapter / write tool / operationLog 守门 / bundle 增量这套实现合约——产物是**调研报告 markdown + 真机验证清单**。下游不是 executor 写功能，而是 **research TeamMate 跑调研**（WPS-01），real-machine 层是用户。

<domain>
## Phase Boundary

Phase 25 探「Aster 能不能跑在 WPS 上」——具体只验 **WPS Windows 桌面版**（中文职场装机量最大形态）。两层 spike：
- **调研层（WPS-01，Claude 出）** —— 一份 WPS Windows 桌面版 Office.js 兼容性调研报告 + 一份结构化真机验证清单。**本里程碑内交付。**
- **真机验证层（WPS-02，用户在 Windows+WPS 跑）** —— 真机 sideload Aster + 三宿主 `run()` 实测 + 最终 go/no-go 裁定。**因用户暂无 Windows 环境，整体延后（D-01）。**

**本里程碑（v2.4）做什么：**
- **WPS-01 全量交付**：调研报告（涵盖 WPS 加载项架构、Office.js manifest 支持程度、`PowerPoint.run`/`Excel.run`/`Word.run` 兼容性、sideload 机制、webview 内核、CORS/存储行为、已知限制、社区/官方证据）+ **初步 go/no-go 信号**（用 D-02「三宿主全绿才 go」框架判）+ **真机验证清单**（用户日后照单实测的具体项目，按 D-02 优先级 + D-03 增益项排好）。

**本里程碑不做（延后 / Out of Scope）：**
- **WPS-02 真机实测 + 最终裁定**（D-01 延后；用户暂无 Windows 环境）。
- **WPS 全量兼容适配**（= WPS-D1，独立 milestone，取决于 WPS-02 裁定；REQUIREMENTS Out of Scope）。
- **WPS 网页版 / 移动版**（D-04：调研报告严格只覆盖 Windows 桌面版，网页/移动版完全不提；里程碑 Out of Scope）。
- **Mac / iOS / Android 宿主**（v1 起永久范围外）。

</domain>

<decisions>
## Implementation Decisions

> Q1–Q4 经 discuss TeamMate 用 AskUserQuestion **直达真人用户**拍板（2026-06-05）。详见 25-DISCUSSION-LOG.md。
> **Q1 = 暂无环境真机延后**（收窄本里程碑交付边界，最关键）/ **Q2 = 三宿主全绿才 go**（最保守阈值）/ **Q3 = 桌面独有增益算加分纳入裁定** / **Q4 = 调研报告只覆盖 Windows 桌面版**。

### 本里程碑交付边界（Q1 = 暂无环境，真机延后）
- **D-01（Phase 25 在 v2.4 内只交付 WPS-01 调研报告 + 真机验证清单；WPS-02 真机层整体延后）:** 🔴 **planner 必读 — 改写 phase 成功标准。**
  - 用户当前**没有 Windows + WPS 桌面版环境**，无法本里程碑内真机实测。
  - **本里程碑内可达成**：ROADMAP §Phase 25 success criteria **#1（调研报告产出）/ #2（初步 go/no-go 信号 + 真机验证清单）/ #5（与 Phase 26–29 并行不阻塞）**。
  - **本里程碑内延后**：ROADMAP §Phase 25 success criteria **#3（真机 sideload + 三宿主 run() 实测）/ #4（最终 go/no-go 裁定 + go 时适配工作量估算）** → 等用户有 Windows 环境时异步补做 / 滚到下个里程碑。
  - **planner 据此规划**：phase 的可验收交付物 = (a) 调研报告 markdown；(b) 真机验证清单（结构化、可勾选、按 D-02/D-03 排优先级）。**不要把「真机跑通」「最终裁定」列为本里程碑的 phase 完成硬条件。**
  - **里程碑收尾**：spike 真机层缺位不阻塞——C 工具（Phase 27/28/29）+ 配置导入导出（Phase 26）两条线照常 ship；WPS 真机裁定作为 deferred / 异步项交接（team-lead 收尾时在 ROADMAP/REQUIREMENTS 标 WPS-02 延后状态）。
  - ⚠️ **与 STATE.md blocker 对齐**：STATE.md 已记「WPS-02 真机层需用户另备 Windows 环境，已设计为可异步不阻塞」——本决策把「可异步」坐实为「本里程碑内不做、延后」。

### go/no-go 阈值（Q2 = 三宿主全绿才 go，最保守）
- **D-02（「算 go」= PPT/Excel/Word 三宿主 run() 基础读写全跑通；任一宿主挂 → no-go 或仅部分 go）:**
  - go = 值得后续单独立一个 milestone（WPS-D1）做 WPS 完整适配的信心阈值。用户选**最保守**：三宿主全绿才判 go。
  - **这个阈值有两个下游用途**，researcher / planner 都要落到产物里：
    1. **调研报告的「初步 go/no-go 信号」判定框架** = 三宿主是否都有可行路径（调研层只能给「信号」，最终裁定待真机）。
    2. **真机验证清单的优先级**：三宿主基础 read tool（取选区/取文档）+ 基础 write tool（改文字/格式）+ undo all 的 `run()` 实测 = **全部列 P0 必测项**（缺一不可，因为任一宿主挂即影响 go）。
  - 否决了「任一宿主通即部分 go」（渐进）与「核心写操作通即 go」（务实）两个更宽松取向——用户要高信心。

### 桌面独有增益（Q3 = 算加分，纳入裁定）
- **D-03（调研 + 真机额外探「Office for Web 做不到、WPS 桌面版可能支持」的能力，作为 go 加分项并记录）:**
  - WPS 桌面版（非浏览器 webview 受限环境）**可能**支持一批 v2.x 因 Office for Web 平台天花板被迫诚实降级/放弃的能力。**重点候选探测清单**（researcher 调研 + 真机清单都要列）：
    - **PPT `copy_slide`** —— v2.1 已知限制：网页版微软接口不支持（诚实失败）。
    - **PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色** —— v2.x Out of Scope，网页版平台天花板（建不了 / 读不了）。
    - **PPT 取选中图片 Preview API** —— 未 GA（Office for Web）→ v2.2 用 fallback 引导上传。
    - **Word 页边距 / 纸张大小** —— 网页版平台天花板。
    - **v2.4 标 API 风险项**（若网页版降级、桌面版若支持则是增益）：EXCEL-13 数据透视表、PPT-09 插入表格、PPT-10 线条/箭头连接符、PPT-11 渐变填充。
  - 若 WPS 桌面能做这些 → 作为 **go 的加分理由**并写进报告 / 裁定（「迁 WPS 桌面 = 不止对等迁移，还能解锁网页版做不到的能力」= 扩能力面，提升 WPS-D1 的 ROI）。
  - **代价**：这条**增加调研 + 真机工作量**（要多探一批 API）——用户判定值得，researcher 不要省略这块。
  - 否决「只看现有工具对等」（更聚焦更快但放弃增益视角）。

### 调研报告范围（Q4 = 只覆盖 Windows 桌面版）
- **D-04（WPS-01 调研报告严格只覆盖 WPS Windows 桌面版，网页/移动版完全不提）:**
  - 最快出裁定信号；与里程碑「WPS 网页版/移动版 Out of Scope」一致。
  - researcher **不要**顺带写 WPS 网页版/移动版可行性（即使顺手查到也不纳入本报告）。WPS-D1 后续若 go，网页/移动评估再单独议。
  - 否决「桌面为主 + 简述网页/移动供未来参考」（略增工作量、本轮不要）。

### 真机验证用什么 manifest（Claude 自决，planner 可调整）
- **D-05（真机 sideload 用既有线上 Aster manifest，不另造测试构建）:** ⚠️ 标注：**这是 discuss TeamMate 的合理默认，非用户拍板**，planner/researcher 可在真机清单里调整。
  - 真机层测的应是用户日常会装的**线上版本**（GitHub Pages `wynne-cwb.github.io/Aster/` 部署的 XML manifest）——这才是真实可行性，而非 localhost dev 构建。
  - 真机验证清单写明：sideload 的是线上 manifest（指向 Pages 托管的 office.js 静态资源 + Aster bundle）。
  - 若调研发现 WPS sideload 机制与微软不同（如需 WPS 开放平台注册 / 不同 manifest 字段），researcher 在报告里给出 WPS 侧的 sideload 步骤，真机清单据此调整。

### Folded / Scope
- 本阶段交付 **WPS-01 全量**（调研报告 + 真机验证清单 + 初步 go/no-go 信号）。
- **WPS-02 延后**（D-01）——不在本里程碑 phase 完成条件内。
- 无折入其它 phase 需求。

</decisions>

<researchable_facts>
## 可研究的事实清单（留给 WPS-01 research TeamMate — 不问用户）

> 以下是 **WPS-01 调研报告本身要回答的问题**，是「可研究的事实」（社区/官方文档/实测可查），**不是需人类拍板的灰区**。discuss 阶段**不去做这些调研**；列在此处供后续 research TeamMate 直接接手。全部**严格限 WPS Windows 桌面版**（D-04）。

### 核心兼容性（决定三宿主 run() 可行性 = D-02 go 阈值的事实基础）
1. **WPS Windows 桌面版是否支持微软 Office.js Add-in 架构？** WPS 加载项体系 vs 微软 Office Add-in 模型；是否兼容 XML manifest（Aster 用 XML manifest，三 `<Host>`：Presentation/Workbook/Document）。
2. **`Office.onReady` / `Office.context.host` 宿主识别**在 WPS 三组件（金山演示 / 表格 / 文字）的行为；它们是否映射到 `PowerPoint` / `Excel` / `Word` host enum。
3. **`PowerPoint.run` / `Excel.run` / `Word.run` requirement set 支持矩阵**：Aster 实际用到的 API set 版本是否覆盖——**WordApi 1.4（批注 insertComment）、ExcelApi 1.8（pivotTables）/1.9（removeDuplicates/merge）、PowerPointApi 1.4（addLine）** 等（含 v2.4 新工具用到的 set）。
4. **WPS 是否走微软 CDN office.js loader**（`https://appsforoffice.microsoft.com/lib/1/hosted/office.js` 能否在 WPS webview 加载），还是 WPS 自带 runtime / 自有 JSAPI。

### 运行环境（决定 Aster 浏览器直连 + 存储 + 流式能否工作）
5. **WPS Task Pane webview 内核**（是否 Chromium？版本？）→ 影响 `fetch` / `ReadableStream` 流式 SSE / ES 特性（Aster LLM 调用依赖）。
6. **CORS / iframe CSP 在 WPS webview 的行为**：浏览器直连 DeepSeek / aihubmix / Pexels 的 `fetch` 是否被 WPS 拦（Aster 无后台硬约束依赖直连）。
7. **存储行为**：partitioned localStorage / `Office.context.partitionKey` 在 WPS 是否可用（Aster Key 存储依赖；RoamingSettings 本就 Outlook-only 不指望）。

### sideload + 已知坑 + 增益
8. **WPS sideload 机制**：如何在 WPS Windows 桌面版加载第三方 Office.js add-in（是否需 WPS 开放平台 / JSAPI 注册、manifest 放哪、有无权限弹窗）→ 产出真机清单里的 sideload 步骤（关联 D-05）。
9. **社区 / 官方证据**：是否有人成功在 WPS 跑微软 Office.js add-in；WPS 官方 JSAPI 文档与微软 Office.js 的差异 / 子集关系；已知 API 缺口与坑。
10. **桌面独有增益候选的支持情况**（D-03 清单逐项）：copy_slide / SmartArt / 读背景色 / 取选中图 Preview / Word 页边距纸张 / 透视表 / 插表格 / addLine / 渐变——WPS 桌面版 API 层面是否支持（调研给信号，真机最终验）。

### 报告产出物（researcher 必交）
- 上述 1–10 的发现综述 →
- **初步 go/no-go 信号**（用 D-02「三宿主全绿才 go」框架；调研层只能给「信号」，注明最终裁定待 WPS-02 真机）；
- **结构化真机验证清单**（见下「UAT 种子」，按 D-02 P0 + D-03 加分项排好，供用户日后照单实测）。

</researchable_facts>

<canonical_refs>
## Canonical References

**Downstream agents（WPS-01 researcher / report writer）MUST read these before researching or writing.**

### 需求 + 路线（标准对照）
- `.planning/REQUIREMENTS.md` — **WPS-01 / WPS-02**（L42-43）完整需求文；**D 类说明**（L38-40：目标平台 = WPS Windows 桌面版，两层 spike）；**Out of Scope**（L93-94, L100：WPS 全量适配 / 网页移动版 / Mac iOS Android 均排除）；**WPS-D1 deferred**（L83：go 则独立 milestone 全量适配）。
- `.planning/ROADMAP.md` §Phase 25（L107-117）— Goal / WPS-01..02 / 5 条 success criteria。
  - ⚠️ success criteria **#3（真机实测）/ #4（最终裁定 + 工作量估算）被 Q1 答案延后**（D-01）——本里程碑只达成 #1（报告）/ #2（信号 + 清单）/ #5（不阻塞并行）。
- `.planning/STATE.md` §v2.4 Scope（L35-53）+ §Blockers（L77）— WPS-02 真机层需用户备 Windows 环境（**已确认暂无 → 延后**）；v2.4 工程约束（Node 22 等）。

### Aster 待测面（researcher 需了解「要在 WPS 上跑通的是什么」）
- `manifest.xml`（项目根）— Aster 的 XML manifest（三 `<Host>`：Presentation/Workbook/Document + shared runtime + Pages 托管 URL）= WPS sideload 的对象（D-05）。researcher 核对 manifest 用到的 requirement set 声明。
- `src/adapters/PptAdapter.ts` / `ExcelAdapter.ts` / `WordAdapter.ts` — 三宿主 `*.run()` 调用面（read/write 方法）= D-02「三宿主 run() 实测」的具体 API 清单来源；真机清单的基础读写项从这里取代表性方法。
- `src/main.tsx` — `Office.onReady` + `Office.context.host` 宿主识别 + 主题读取（researchable fact #2 的实测落点）。
- `index.html` — office.js CDN script tag（researchable fact #4：WPS 能否加载该 CDN）。
- `src/lib/sse.ts` / `src/providers/*` — 浏览器直连 fetch + SSE 流式（researchable fact #5/#6 的依赖面）。
- `src/lib/storage.ts` — partitioned localStorage（researchable fact #7 的依赖面）。

### v2.x 已知平台天花板（D-03 桌面增益候选的来源 — researcher 逐项探 WPS 桌面是否突破）
- `.planning/REQUIREMENTS.md` Out of Scope 表（本里程碑 L97-99）+ 历史里程碑 known limitations：
  - PPT `copy_slide` 网页版不支持（v2.1 ROADMAP known limitation，`milestones/v2.1-*`）。
  - PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色 / 取选中图 Preview API（v2.2/v2.4 Out of Scope）。
  - Word 页边距 / 纸张大小（网页版天花板）。
  - v2.4 API 风险项 EXCEL-13 / PPT-09/10/11（`.planning/ROADMAP.md` §Phase 28/29 + REQUIREMENTS L30/34-36）。

### 项目硬约束 / 记忆
- memory `project_no_backend_status` — 无后台靠浏览器直连 + CORS GATING（researchable fact #6 直接相关：WPS webview 若拦 CORS = 重大风险面）。
- memory `project_ppt_officejs_gotchas` / `project_excel_adapter_gotchas` — 网页版写操作静默 no-op + 参数 casing 坑（WPS 真机若行为不同需重新摸；调研报告应提示真机要「写后回读验证」）。
- CLAUDE.md §Compatibility — v1.1 Windows Office Desktop 同 manifest 验证（WPS 桌面是另一个桌面宿主，可参照 Windows Desktop 验证思路）。

</canonical_refs>

<code_context>
## Existing Code Insights

> 本 phase 不写运行时代码，故无「复用资产 / 集成点」常规清单。以下是 researcher 理解「待测面」的要点。

### 待测面（要在 WPS 上验证能不能跑的 Aster 既有能力）
- **加载链**：WPS webview → 加载 office.js CDN → `Office.onReady` → 识别 host → 渲染 Aster Task Pane（React bundle from Pages）。任一环断 = 基础不通。
- **三宿主 `run()` 读写**（D-02 P0）：`PptAdapter` / `ExcelAdapter` / `WordAdapter` 的代表性 read（取选区/取文档）+ write（改文字/格式）+ undo all。
- **浏览器直连**：DeepSeek/aihubmix SSE 流式 + Pexels fetch（CORS 面）。
- **存储**：partitioned localStorage 存 Provider Key。
- **桌面增益探测面**（D-03 加分）：v2.x 网页版做不到的一批 API 在 WPS 桌面是否解锁。

### 约束（researcher / report 必须遵循）
- **严格只 WPS Windows 桌面版**（D-04）——网页/移动版不写。
- **三宿主全绿才 go**（D-02）——报告的信号判定 + 清单优先级都用这个框架。
- **桌面增益算加分**（D-03）——多探一批 API，不省略。
- **真机层延后**（D-01）——报告交「初步信号 + 清单」，不假装有真机结论。
- **Node 22**（若 researcher 要本地跑任何脚本/构建：`export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`）。

</code_context>

<specifics>
## Specific Ideas

- **本 phase 的本质**：一份「Aster 能不能搬到 WPS 桌面」的可行性侦察报告 + 一份用户日后照着打勾的真机验证清单。**不承诺适配**，只出（初步）裁定信号。
- **北极星问题**：「在 WPS Windows 桌面版里 sideload Aster 线上版，三宿主的 agent 改文档（含 undo）能不能跑通？另外，WPS 桌面能不能解锁一批 Office for Web 做不到的能力（copy_slide / 读背景色 / 透视表…）？」前者通 = go 的基础（D-02），后者通 = go 的加分（D-03）。
- **为何最保守阈值（D-02）**：WPS-D1 是一个完整 milestone 的投入，用户要高信心再投——任一宿主跑不通就别轻易承诺全量适配。
- **为何探增益（D-03）**：若 WPS 桌面能突破网页版天花板，迁 WPS 不止是「换个壳跑同样的东西」，而是「解锁 Aster 在 Office for Web 受限而做不到的功能」——这会显著抬高 WPS-D1 的 ROI，值得多花调研力气探。
- **延后不等于砍**（D-01）：WPS-02 真机层只是因为用户暂无 Windows 环境而异步化；调研报告 + 清单先就位，用户哪天有了 Windows + WPS，照单半天就能跑出最终裁定。

</specifics>

<deferred>
## Deferred Ideas / Risks

### 🔴 WPS-02 真机验证层（本里程碑延后，用户暂无 Windows 环境）
- **延后内容**：真机 sideload Aster 线上 manifest 到 WPS Windows 桌面版三宿主 + 三宿主 `run()` 实测 + 最终 go/no-go 裁定 + （go 时）适配工作量估算。
- **为何延后**：用户 Q1 = 暂无 Windows + WPS 环境（D-01）。
- **何时做**：用户有 Windows 环境时异步补做 / 滚到下个里程碑——照 WPS-01 交付的真机验证清单逐项打勾即可。
- **不阻塞**：里程碑照常 ship C 工具（27/28/29）+ 配置导入导出（26）。
- **交接**：team-lead 收尾时在 ROADMAP §Phase 25 success criteria #3/#4 + REQUIREMENTS Traceability（WPS-02）标「真机层延后」状态。

### WPS-D1（取决于 WPS-02 裁定，独立 milestone）
- 若 WPS-02 真机判 **go** → WPS 桌面版完整兼容适配（manifest / sideload / API 差异处理）作为独立 milestone（REQUIREMENTS L83 / STATE Deferred）。本里程碑不碰。

### 本阶段不做（D-04 范围外 / future）
- **WPS 网页版 / 移动版可行性**——调研报告不提（D-04）；WPS-D1 若 go 再单独议。
- **Mac / iOS / Android 宿主**——永久范围外。

### 风险（researcher 应在报告里点名，供用户真机时重点验）
- **CORS / webview 内核风险**（researchable fact #5/#6）：WPS webview 若不是新版 Chromium / 拦截直连 fetch → Aster 无后台直连模型可能在 WPS 内挂（这是 go/no-go 的高危面之一，类比 v2.2 Pexels CORS 风险）。
- **API set 覆盖风险**（researchable fact #3）：WPS 即便支持 Office.js，requirement set 版本可能落后微软，导致 Aster 用到的较新 API（WordApi 1.4 / ExcelApi 1.8+ / PowerPointApi 1.4）不可用。
- **sideload 机制差异**（researchable fact #8）：WPS 可能需自有开放平台注册流程，与微软 sideload 不同——影响真机清单步骤（D-05 默认用线上 manifest 可能要调整）。

</deferred>

---

*Phase: 25-wps-spike-gate*
*Context gathered: 2026-06-05*
*Decisions: Q1=暂无环境真机延后（收窄本里程碑交付边界为仅 WPS-01）/ Q2=三宿主全绿才 go（最保守阈值）/ Q3=桌面独有增益算加分纳入裁定 / Q4=调研报告只覆盖 WPS Windows 桌面版（真人用户经 AskUserQuestion 直达拍板）。详见 25-DISCUSSION-LOG.md*
