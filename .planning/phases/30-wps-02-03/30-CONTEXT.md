# Phase 30: WPS-02/03 真机验证探针（硬门 go/no-go）- Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

> **GSD 命名说明：** 本项目 discuss 产物 = `30-CONTEXT.md`（plan-phase / researcher 消费的权威决策文件）+ `30-DISCUSSION-LOG.md`（审计轨迹）。下游 planner / researcher 读本文件。
>
> 🟡 **本 phase 性质 = 验证探针，不是 Aster 功能实现。** 产物 = ① Claude 在 Mac 写的一个**独立极简 `wpsjs` 探针加载项**（不进 Aster 主仓 `src/`）；② 一份**真机验证清单**（用户照单在 Windows WPS 上跑）；③ 用户跑完后产出的 **go/no-go 裁定报告 + 首宿主数据 + 工作量细化**。**真机步骤只能用户在 Windows WPS 桌面专业版上跑**（Claude 无法代跑——同 Office for Web 真机 UAT 分工）。
>
> 🔴 **两条 make-or-break 串行硬门（始终硬卡，与下方任何范围/门槛决策无关）：** ① CEF 内核版本 / React 19 可行性（`navigator.userAgent` + 特性探测）→ ② 直连 `api.deepseek.com` 拿 SSE 不被 WPS 容器 CSP/CORS 拦截。**第一条挂 → 后续无意义即停；第二条挂 → 无后台 Core Value 在 WPS 失效，里程碑 no-go。任一挂 → Phases 31–33 全部取消，里程碑干净收口在 Phase 30，不写任何适配代码。**

<domain>
## Phase Boundary

Phase 30 = 整个 v2.5 里程碑的**硬门**。在 Windows WPS 桌面专业版真机上，用一个最小探针跑完 go/no-go 验证，拿到里程碑的进行/停工裁定 + 首宿主（Excel vs PPT）数据 + Phase 31–33 适配工作量细化。

**本 phase 交付（Claude 在 Mac 做）：**
- 一个**独立极简 `wpsjs` 探针加载项**（不进 Aster 主仓 `src/`，独立工程/目录），承载真机验证逻辑。
- 一份**真机验证清单**（结构化、可勾选），用户照单在 Windows WPS 上跑。
- 探针执行后**自动产出可复制的结果报告**（见 30-D-03），用户回贴给 Claude → 由此产出 go/no-go 最终裁定 + 首宿主数据 + 工作量细化。

**本 phase 不做（范围外 / 延后）：**
- 任何 Aster 主仓 `src/` 适配代码（adapter / 外壳 / 宿主识别 / operationLog 移植）——**全部以 Phase 30 = go 为前提，属 Phase 31–33**。
- 首宿主（Excel vs PPT）最终锁定——**这是 gated-on-real-machine 决策，故意留到 Phase 30 真机数据回来后 + Phase 32 开工前 discuss 裁定**（见 deferred）。
- WPS 网页版 / 移动版 / Mac 版（永久范围外 / WPS-D2）。
- 三宿主完整移植（= WPS-D1 独立 milestone）。

</domain>

<decisions>
## Implementation Decisions

> 4 条经 discuss TeamMate 用 AskUserQuestion **直达真人用户**拍板（2026-06-08）。详见 30-DISCUSSION-LOG.md。
> 编号用 `30-D-NN` 前缀，避免与 Phase 25 的 D-01..D-05 混淆。

### 探针范围（30-D-01 = 精简·首宿主聚焦）
- **30-D-01：探针只跑「go/no-go 核心 + 首宿主数据」精简集，不跑完整 §5 全清单。** 🔴 planner/researcher 必读——直接界定真机清单的条目集。
  - **必跑（精简集）：**
    1. **两条 make-or-break 串行**（始终硬门，见顶部）：CEF 版本/React19 特性探测 → DeepSeek SSE 直连不被拦。
    2. **底层运行时**（25-WPS-01-REPORT §5 第 1 段）：localStorage 跨会话持久（关 WPS 重开仍在）、字体/teal CSS 渲染、图片直连（见 30-D-04 纳入）。
    3. **首宿主候选两宿主（Excel + PPT）的基础 read / write / undo**（25 §5 第 2 段的 2-E* + 2-P* 两组）——write 含**写后回读 `assertWriteResult` 验证不静默 no-op**；undo 验证坐实 `operationLog` 反向引擎为唯一路径。
    4. **仅「决定 Excel 还是 PPT」所需的少数 D-03 增益探测**：PPT `copy_slide`（25 §5 3-1）/ `Shapes.AddTable`（3-6）/ `Shapes.AddLine`（3-7）+ Excel `PivotTable.Add`（3-5）。这几项是首宿主裁定原则的判据（见 deferred「首宿主决策」），必须探。
  - **延后（不在本探针）：** 金山文字（Word）的 read/write/undo（25 §5 第 2 段 2-W* 组）；其余 D-03 增益（25 §5 3-2 读背景色 / 3-3 取选中图 / 3-4 Word PageSetup / 3-8 渐变 / 3-9 SmartArt/动画/转场/套主题）。
  - **理由：** 用户亲手跑真机每一步，工作量真实。精简集最快拿裁定，且与单宿主滩头堡策略 + 首宿主候选 go 门槛（30-D-02）天然配套。延后的项不是砍——首宿主锁定后，Phase 32/33 或后续按需补探。
  - **否决：** 「完整 §5（三宿主 + 全套 D-03，~25 步）」（信息最全但手动步骤最多、与单宿主策略不匹配）；「中间档（三宿主基础读写撤销 + 关键增益）」（多跑 Word 一组，但 Word 非首选、不卡 go，本探针不必跑）。

### go 门槛 / 宿主覆盖（30-D-02 = 首宿主候选(Excel+PPT)绿即可推进）
- **30-D-02：make-or-break 两条生死线过了之后，「算 go」的 JSAPI 宿主覆盖门槛 = 两生死线绿 + Excel/PPT 中至少一个的基础 read/write/undo 绿。** 🔴 **这是对 Phase 25 `25-D-02`「三宿主(PPT/Excel/Word)全绿才 go」的有意修订——planner 必读，勿被旧 25-D-02 绊住。**
  - **修订理由（关键）：** Phase 25 的 `25-D-02`「三宿主全绿才 go」是在**「要不要立项做三宿主全量移植 WPS-D1」**的语境下定的最保守高信心阈值。但 v2.5 里程碑**已经决定先做单宿主滩头堡**（Word 明确非首选宿主）。因此 Phase 30 的 go 门槛应与**单宿主**策略对齐：只要首宿主候选（Excel 或 PPT）能跑基础读写撤销 + 两生死线绿，就有信心推进 Phase 31–33 的单宿主滩头堡。要求三宿主全绿与单宿主策略自相矛盾，故修订。
  - **两生死线始终是独立硬门**：无论宿主覆盖门槛多宽，CEF 版本 / SSE 直连任一挂 = 整体 no-go（不可用宿主绿来抵消）。
  - **下游用途：** ① 探针/清单只需覆盖 Excel + PPT 两宿主（与 30-D-01 一致）；② go/no-go 裁定报告的判定框架 = 「两生死线绿 AND (Excel 基础读写撤销绿 OR PPT 基础读写撤销绿)」。
  - **否决：** 「三宿主全绿才 go（沿用 25-D-02）」（与单宿主策略冲突、要求探针多跑 Word）；「最低：任一宿主绿即 go」（门槛过低，未锁定首宿主候选范围）。

### 探针形态 / 易用性（30-D-03 = 自动按钮 UI）
- **30-D-03：探针做成 Task Pane 内的「自动跑」按钮 UI——点一下自动执行所有能自动化的检查，逐项显示通过/失败，并生成一份一键复制的结果报告。**
  - **能自动化的项**（按钮跑 + 结果入报告）：`navigator.userAgent` / 特性探测、DeepSeek SSE fetch、图片直连 fetch、localStorage 写入、字体/CSS 渲染探测、Excel/PPT JSAPI read/write（含写后回读）/undo、D-03 关键增益调用。
  - **本质必须手动的项**（探针配**清晰图文步骤**，不强塞进按钮）：① localStorage **跨会话持久**（需关 WPS 重开后再点一次按钮读回）；② 确认 DeepSeek SSE **不被 CSP/CORS 拦**时建议同时看 DevTools Network/Console 面板坐实（按钮能拿到流即算通过，但 Network 面板是补充证据）。
  - **结果报告**：单段可复制文本（含每项 pass/fail + 关键原始值如 userAgent 全文、CEF/Chromium 版本号、SSE 首 token 片段、各 JSAPI 调用返回/报错）。用户复制回贴 → Claude 据此产出裁定报告。
  - **理由：** 用户在 Windows 上亲手跑，WPS DevTools 调试体验痛苦（ALT+F12 / CEF F12）。按钮 UI 让用户摩擦最小（Claude 在 Mac 多花开发力气换取）。
  - **否决：** 「纯 console 代码片段清单」（开发省事，但用户手动逐段粘贴、折腾 DevTools，真机摩擦大）。
  - **注（探针 UI 视觉）：** 探针是**一次性 throwaway 验证工具**，**不要求**对齐 Aster teal 设计系统——朴素可用即可（但「字体/teal CSS 渲染探测」这一**检查项**仍要验真正的 Aster 字体栈 Inter/Noto Sans SC/JetBrains Mono + teal CSS 在 CEF 是否正常，这是 WPS-06 复用层的前置信号）。

### 真机 API Key 后勤（30-D-04 = DeepSeek + 图片 key 都备）
- **30-D-04：用户会在那台 Windows 机器上备好 DeepSeek API key + aihubmix/Pexels 图片 key。**
  - **DeepSeek key = 第二条 make-or-break 的硬前提**（SSE 直连测试必须用真 key 才能跑；无 key = 该测试无法执行）。
  - **图片 key（aihubmix + Pexels）= 顺带验**：探针清单 §1-3 的图片直连（aihubmix b64_json + Pexels 缩略图检索）一并跑，多拿一面 WPS CEF 容器 CORS 数据（复用 v2.2 经验）。
  - **图片直连定位 = 非阻塞 bonus**：图片面**不计入 go/no-go 硬门**（硬门只看 DeepSeek SSE 文本流）；图片若被拦只作记录 + Phase 31+ 处置参考，不阻断里程碑。
  - **真机清单须含一步**：「开跑前在探针/Settings 填入 DeepSeek key（必填）+ aihubmix/Pexels key（选填，验图片面用）」。
  - **分工提醒**：项目记忆 `feedback_self_run_spikes` 说 Claude 自跑的 spike 可用 `.env.local` 提供 key——但**本探针的 SSE/图片直连测试是用户在 Windows 真机上亲自跑的**，key 由用户在那台机器上提供，不是 Claude 的 `.env.local`。

### Claude's Discretion（planner/researcher 可自决）
- 探针工程的具体脚手架细节（`wpsjs create` 模板、`ribbon.xml` 最小按钮、`jsplugins.xml` vs `publish.html` sideload 路径、Vite 是否参与、目录命名）——属可研究的标准流程，researcher/planner 落地。
- 探针结果报告的精确文本格式/字段排版。
- 每条 JSAPI 探测的确切调用写法（`wps.WpsApplication()` / `Application.ActivePresentation.*` / `ComponentType` 等）——属可研究事实（见下）。

### Folded Todos
- 无折入。两个匹配到的 pending todo（WR-02 / WR-03）经评估**与本 phase 无关**（PPT 视觉自查 follow-up，仅命中通用关键词 `phase`/`tbd`），未折入——见 deferred「Reviewed Todos」。

</decisions>

<researchable_facts>
## 可研究的事实清单（留给 plan-phase researcher — 不问用户）

> 以下是探针实现 + 真机清单落地需要的**可研究事实**（WPS 官方文档 / 社区实测 / Aster 代码可查），**不是需人类拍板的灰区**。discuss 阶段不做这些调研；列此供 researcher 直接接手。全部严格限 WPS Windows 桌面专业版。

### 探针工程脚手架（Phase 31 也复用）
1. **`wpsjs` CLI 最小探针工程**：`npm i -g wpsjs` → `wpsjs create` 生成的目录结构、`ribbon.xml`（最小一个按钮 onClick）、`taskpane`/`index.html` 入口、`main.js` 加载流程。Mac 能否 `wpsjs build`（真机加载只能 Windows）。
2. **WPS sideload 真机路径**：`wpsjs publish` + `publish.html` 安装页 vs `jsplugins.xml` 动态模式 vs `oem.ini`（注意 v12.1.0.16910+ 个人版安全收紧——用户是专业版，需真机确认是否适用）。探针走 GitHub Pages 在线 sideload（与 Aster CI/CD 同一套）的可行步骤。
3. **WPS 加载项 DevTools 打开方式**（ALT+F12 / CEF F12 / `ShowDevTools`）——真机清单要写明用户如何看 Network/Console。
4. **最低 WPS 版本要求**（专业版/企业版 JSAPI 加载项门槛；社区数据偏旧，以现行专业版真机为准）。

### 每条探测的确切 JSAPI / Web API 写法（探针逻辑核心）
5. **CEF 版本探测**：`navigator.userAgent` 解析 Chromium 版本号；`ReadableStream`/`fetch`/ES2020+ 特性探测写法；React 19 最低 Chromium 版本要求（≥80 为 roadmap 阈值，需核对 React 19 实际下限）。
6. **DeepSeek SSE 直连写法**：`POST https://api.deepseek.com/chat/completions`（`stream:true`，OpenAI-compat SSE），探针里如何拿首 token + 判定 `text/event-stream` 未被拦（参照 Aster `src/lib/sse.ts` 的 `parseSSE` 逻辑，探针可抄简化版）。
7. **图片直连写法**：aihubmix `images/generations`（b64_json 内联，参照 v2.2 `project_browser_image_gen_gotchas`：签名 URL 会被 CORS 拦要 b64）+ Pexels 检索 fetch。
8. **Excel（金山表格）JSAPI**：`Application.ActiveWorkbook` 取选区地址 / 读区域值 / 列工作表（read）；写单元格值/公式 + 格式（write）；区域值快照还原（undo）；`PivotTable.Add` 签名是否存在（D-03 判据，25 §5 3-5）。对照 `src/adapters/ExcelAdapter.ts` 取代表性方法语义。
9. **PPT（金山演示）JSAPI**：`Application.ActivePresentation.Slides` 取页/取选中页/读形状文本（read）；新增页 + 写标题/改形状文字填充（write）；删页/还原（undo）；`copy_slide`（Slides 复制/`FindBySlideID2`，3-1）/ `Shapes.AddTable`（3-6）/ `Shapes.AddLine`/`AddConnector`（3-7）是否存在（D-03 判据）。⚠️ 25-WPS-01-REPORT §4 标注 `Shapes.AddTable`/`AddLine` **不在官方 Shapes 文档**——researcher 重点查、真机最终验。对照 `src/adapters/PptAdapter.ts`。
10. **宿主识别**：`OnAddinLoad` + `window.Application.ComponentType`（1=文字/2=表格/3=演示）的确切读法（替代 `Office.onReady`/`Office.context.host`，参照 `src/main.tsx` 现有识别链）。
11. **写后回读 / 静默 no-op 检测**：WPS JSAPI 写操作是否静默失败（25-WPS-01-REPORT §7 高危面，类比 Aster 网页版 `project_ppt_officejs_gotchas` 写后回读教训）——探针 write 项必须写后立即回读对比，纳入清单判定。
12. **localStorage 持久性**：CEF `localStorage.setItem` 跨会话（关 WPS 重开）是否持久；`Office.context.partitionKey` 在 WPS 不存在 → Aster `storage.ts` 的 `partitionKey===undefined` 降级分支是否自动命中（25-WPS-01-REPORT Fact ⑦）。

### researcher 必交（喂给 planner）
- 上述 1–12 的落地写法 → 探针每个按钮检查项的实现 + 真机清单每条的「怎么跑 / 预期 / 怎么算通过」。

</researchable_facts>

<canonical_refs>
## Canonical References

**Downstream agents（Phase 30 researcher / planner）MUST read these before researching or planning.**

### 本里程碑需求 + 路线
- `.planning/REQUIREMENTS.md` — **WPS-02 / WPS-03**（L16-17）完整需求文（两条 make-or-break 串行硬门 + 目标宿主 read/write/undo + go/no-go 裁定 + 首宿主数据）；Out of Scope 表（L68-76：不静默上后台绕 CORS、三宿主完整移植 = WPS-D1 等）。
- `.planning/ROADMAP.md` §Phase 30（L120-131）— Goal / 5 条 success criteria / Note（两条 make-or-break 串行、探针不进 src/、真机只能用户跑）；§Phase 31-33（L133-167，了解 go 后的下游，但本 phase 不做）；§Phase 32 Note（L156，首宿主 Excel vs PPT 裁定原则）。
- `.planning/STATE.md` §Current Position + §Blockers（L83-84：Phase 30 真机验证 = 唯一当前阻断项；首宿主决策挂起）+ §Decisions（L66-72：WPS=平行铁轨 / 证据优先 / 真机分工 / UNDO 裁定 / no-go 路径 / Node 22）。

### 🔴 真机清单 + 探测的源头（必读，本 phase 一切的基座）
- `.planning/phases/25-wps-spike-gate/25-WPS-01-REPORT.md` — **§5 真机验证清单（段 0/1/2/3）= 探针清单的 source-of-truth**；§3 兼容性矩阵（🔴微软契约层 vs 🟢🟡底层 Web 运行时层的分界）；§4 D-03 增益逐项置信度阶梯（首宿主判据）；§7 高危面 + 无真机不可定项（写后回读 / CSP/CORS / CEF 版本 / localStorage 持久）。
- `.planning/phases/25-wps-spike-gate/25-CONTEXT.md` — Phase 25 锁定决策 `25-D-01..D-05`（尤其 `25-D-02` 三宿主全绿原阈值——**本 phase `30-D-02` 已修订，见 decisions** ；`25-D-03` 桌面增益算加分；`25-D-05` sideload 用线上路径，因 WPS 不消费 MS manifest 已改 wpsjs 原生）。
- `.planning/research/v2.5/SUMMARY.md` — v2.5 研究执行摘要 + §开放决策（首宿主 Excel vs PPT 裁定原则）+ Research Flags（Phase 30 探针脚本需逐条对照官方 API 落地）+ Gaps（全部只能真机解答）。

### Aster 既有代码（探针「精简抄写」的参照面 — 探针不直接 import src/，但要照其语义实现）
- `src/lib/sse.ts` — `parseSSE` SSE 解析逻辑（探针 DeepSeek SSE 直连测试抄简化版）。
- `src/lib/storage.ts` — `partitionKey===undefined` 降级分支（探针 localStorage 持久性测试 + WPS-06 复用层信号）。
- `src/main.tsx` — `Office.onReady` + `Office.context.host` 宿主识别链（WPS 侧用 `OnAddinLoad` + `ComponentType` 替代，researchable fact #10）。
- `src/adapters/ExcelAdapter.ts` / `PptAdapter.ts` — 首宿主候选两宿主的代表性 read/write/inverse 方法语义来源（探针 JSAPI read/write/undo 探测对照）。
- `index.html` — Aster 字体栈（Inter/Noto Sans SC/JetBrains Mono Google Fonts 单条 URL）+ office.js CDN tag（探针**不引** office.js；字体渲染探测要验这套字体）。

### 项目硬约束 / 记忆
- memory `project_no_backend_status` — 无后台靠浏览器直连 + CORS GATING（第二条 make-or-break 直接相关：WPS 容器若拦 connect-src = 产品死亡级）。
- memory `project_browser_image_gen_gotchas` — 浏览器直连生图：签名 URL 被 CORS 拦要 b64_json 内联（探针图片直连测试用 b64）。
- memory `project_ppt_officejs_gotchas` / `project_excel_adapter_gotchas` — 网页版写操作静默 no-op + 参数 casing 坑（WPS 真机若行为不同需重新摸；探针 write 项必须写后回读）。
- memory `feedback_self_run_spikes` — Claude 自跑 spike 可用 `.env.local` 提供 key；**但本探针真机测试是用户在 Windows 上亲自跑，key 由用户在那台机器上提供**（见 30-D-04）。
- memory `project_wps_milestone_v25` — v2.5 滩头堡策略 + 证据优先分阶段 + Phase 30 硬门 no-go 即停。
- `CLAUDE.md` §Constraints — 无后台硬约束（Core Value）；§Compatibility v1.1 Windows Desktop 同 manifest 验证（WPS 桌面是另一桌面宿主，可参照验证思路）。

</canonical_refs>

<code_context>
## Existing Code Insights

> 本 phase 产物 = 独立 `wpsjs` 探针工程（**不进 `src/`、不 import Aster 模块**）。以下是探针「照语义实现」要参照的既有面，非常规复用清单。

### 探针要参照（抄简化版，不直接依赖）
- **`src/lib/sse.ts`**：SSE 解析（`data: {...}` 分帧 + `[DONE]` 检测）→ 探针 DeepSeek 直连测试抄一段最小 `parseSSE`，验首 token 能否拿到。
- **`src/lib/storage.ts`**：`partitionKey===undefined` 时回退裸 `localStorage` → 探针 localStorage 持久性测试直接验裸 `localStorage` 跨会话；同时坐实复用层降级分支（WPS-06 信号）。
- **`src/adapters/{Excel,Ppt}Adapter.ts`**：取首宿主候选的代表性 read/write/inverse 方法名 + 参数语义 → 映射到 WPS JSAPI 等价调用，作为探针 §2 读写撤销探测项。

### 探针 sideload / 外壳（全新写，无既有可复用）
- WPS 不认 `manifest.xml`（项目根那份是微软的）→ 探针用 `wpsjs` 自有 `ribbon.xml` + `jsplugins.xml`/`publish.html`。Phase 31 正式外壳会复用本探针的脚手架经验。

### 约束（researcher / planner 必守）
- **探针不进 `src/`、不进主 bundle、不动 Aster 主工程**（独立工程隔离，与 Office.js 主线零交叉）。
- **真机步骤只能用户跑**——探针交付物必须「Claude 在 Mac 写好 → 用户在 Windows 一键跑 → 复制结果回贴」自洽闭环（30-D-03 按钮 UI 是为此服务）。
- **Node 22**（探针若本地构建：`export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`）。
- 探针 UI 是 throwaway，不强制 teal 设计系统（但「字体/CSS 渲染」探测项仍要验真 Aster 字体栈 + teal CSS）。

</code_context>

<specifics>
## Specific Ideas

- **本 phase 的本质**：一个「把生死线先摆出来打」的最小验证探针。**早失败、零浪费**——两条 make-or-break 串行压在最前，任一挂立即 no-go、里程碑干净收口，不写任何适配代码。
- **北极星问题**：「在 WPS Windows 桌面专业版里，浏览器内核够新能跑 React19/流式吗？能直连 DeepSeek 不被拦吗？首宿主候选（Excel/PPT）的基础读写撤销 + operationLog 撤销能做吗？」全绿 → go，建单宿主滩头堡。
- **首宿主裁定靠真机数据，不靠今天猜**：探针专门多探 PPT copy_slide/AddTable/AddLine + Excel PivotTable 这几项，正是为了让真机数据来裁 Excel vs PPT（裁定原则见 deferred），不在 discuss 阶段拍脑袋。
- **精简范围 + 首宿主门槛 + 按钮 UI + 双 key 四者一致**：都服务于「用户真机摩擦最小、最快拿到对齐单宿主策略的裁定」这一目标。
- **`30-D-02` 修订了 `25-D-02`**：旧的「三宿主全绿才 go」是为「立项三宿主全量移植」定的；v2.5 已锁单宿主滩头堡，go 门槛随之对齐到「首宿主候选绿即可」。planner 不要被旧 25-D-02 绊住。

</specifics>

<deferred>
## Deferred Ideas / Gated-on-Real-Machine

### 🔒 GATED — 首宿主（Excel vs PPT）最终锁定（待 Phase 30 真机数据 + Phase 32 开工前 discuss 裁定）
- **不在 Phase 30 discuss 拍板**——这是 milestone 级开放决策，**只能由 Phase 30 探针返回的真机数据决定**，文档无法推断。
- **裁定原则（供 Phase 32 前 discuss）**：若 Phase 30 真机探测中 PPT `copy_slide`(3-1) / `Shapes.AddTable`(3-6) / `Shapes.AddLine`(3-7) **≥2 项通过** → 倾向 PPT（D-03 增益差异化价值最大）；否则倾向 Excel（FEATURES 研究：15 核心操作全有文档化 JSAPI DIRECT 路径，`Range.Value` snapshot inverse 最简单，风险最低）。Excel PivotTable.Add 签名(3-5)是 Excel 侧唯一未知。
- Phase 30 探针**已按 30-D-01 专门纳入这 4 项增益探测**，就是为产出裁定判据。

### 🔒 GATED — 以下只能 Phase 30 真机解答，文档无法预定（探针就是为它们而建）
- CEF 实际 Chromium 版本（make-or-break #1）。
- WPS 容器 CSP/CORS 实际策略（make-or-break #2，单点 go/no-go 阻断器）。
- CEF localStorage 跨会话持久性。
- WPS JSAPI 写操作是否静默 no-op；各 JSAPI 方法（PivotTable.Add / Shapes.AddTable 等）真机是否存在/签名。

### 延后探测项（30-D-01 精简集砍掉的，非永久砍）
- 金山文字（Word）read/write/undo（25 §5 第 2 段 2-W* 组）——Word 非首选宿主、不卡 go；首宿主锁定后按需在 Phase 32/33 或后续补探。
- 其余 D-03 增益：PPT 读背景色(3-2) / 取选中图(3-3) / 渐变(3-8) / SmartArt·动画·转场·套主题(3-9) / Word PageSetup(3-4)——首宿主锁定 + 滩头堡跑通后，作为 WPS-D1 ROI 加分项再探。

### 图片直连（非阻塞 bonus，30-D-04）
- aihubmix b64_json + Pexels 检索的 CORS 直连**会在探针里跑并记录**，但**不计入 go/no-go 硬门**；若被 WPS 容器拦只作 Phase 31+ 处置参考。

### Reviewed Todos（评估后未折入）
- **WR-02**（`visual_check_slide` 的 `slideIndex` 入参忽略）— 与 Phase 30 无关（PPT 视觉自查 follow-up，仅命中通用关键词）。仍在 `todos/pending/`，下次动 PPT 视觉自查时修。
- **WR-03**（`SlidePreviewPanel` 卸载缺 identity 守卫）— 同上，与本 phase 无关，保留在 pending。

### 后续里程碑（不碰）
- **WPS-D1** 三宿主完整移植（go + 滩头堡坐实后独立 milestone）；**WPS-D2** WPS 网页/移动版形态评估。
- **no-go 路径**：若两条 make-or-break 任一挂 → 里程碑干净收口在 Phase 30，Phases 31–33 取消，不写任何 adapter 代码；Cloudflare Worker 仅作显式 fail 决策项（同 v2.2 M-1，不静默上后台）。

</deferred>

---

*Phase: 30-wps-02-03*
*Context gathered: 2026-06-08*
*Decisions（真人用户经 AskUserQuestion 直达拍板）: 30-D-01=探针精简·首宿主聚焦 / 30-D-02=首宿主候选(Excel+PPT)绿即可推进（修订 Phase 25 的 25-D-02 三宿主全绿阈值）/ 30-D-03=自动按钮 UI（本质手动项配图文）/ 30-D-04=DeepSeek+aihubmix/Pexels key 都备（图片直连非阻塞 bonus）。详见 30-DISCUSSION-LOG.md*
