# Project Research Summary

**Project:** Aster（中文职场用户的 Office 内嵌 AI 代理）— v2.5「登陆 WPS（滩头堡）」
**Domain:** 把现有 Office.js Add-in 移植到 WPS Windows 桌面专业版（CEF 加载项 + WPS JSAPI）
**Researched:** 2026-06-08
**Confidence:** MEDIUM（架构接缝 HIGH；JSAPI 细节 MEDIUM；CEF 运行时行为 LOW until WPS-02 green）

> 本 SUMMARY 综合 4 份 v2.5 研究（`STACK.md` / `FEATURES.md` / `ARCHITECTURE.md` / `PITFALLS.md`），并以上个里程碑 `25-WPS-01-REPORT.md` 的架构层结论为基座，只往下钻实现层。

## Executive Summary

Aster 移植到 WPS Windows 桌面专业版的本质是两件事：① 在 WPS 的 **CEF 容器**内重新验证「无后台直连 DeepSeek/aihubmix SSE」这条 Core Value 链是否成立；② 把 Office.js 的 adapter 层（`*.run` + load/sync）替换为 **WPS VBA 风格 JSAPI**（`window.Application.*`）。WPS 不消费微软 manifest，`Office.onReady` 永远不触发——这是平行铁轨重建，不是增量兼容（WPS-01 架构性结论，已坐实）。

移植架构结论清晰且乐观：**`DocumentAdapter` 接口契约完全成立**，接缝**上方**（agent loop / React UI / SSE 客户端 / Zustand / operationLog / inverse-Record 合约）全部不动；接缝**下方**（`wpsjs` 外壳 + 三个 `WpsXxxAdapter`）按 WPS JSAPI 重写。复用层（React 19 / 原生 fetch+ReadableStream / `storage.ts` 的 `partitionKey===undefined` 降级分支）在 CEF 里**大概率原样跑**——但「大概率」必须由真机坐实。

整个里程碑采用**证据优先分阶段**：先用最小探针在 Windows WPS 真机跑完 WPS-02 清单（拿 go/no-go），**任一 make-or-break 项挂 → 立即停工，不写任何适配代码**；通过才建单宿主滩头堡。三宿主完整移植是后续独立里程碑（WPS-D1）。

## Key Findings

### Recommended Stack

详见 `STACK.md`。`wpsjs`（npm，2026-06 latest `^2.2.x`）是唯一官方 CLI，提供 `create/build/publish/debug`。Aster 核心层（React/SSE/store/设计系统）**直接复用**；差异集中在加载项外壳 + 宿主识别 + 三 adapter。**Mac 可跑 `wpsjs build`，但 `debug`/真机加载只能在 Windows**——探针走 GitHub Pages 在线 sideload（`jsplugins.xml`/`oem.ini` 指向 Pages URL），与 Aster 现有 CI/CD 同一套，零额外基础设施。

**Core technologies:**
- **`wpsjs` CLI** `^2.2.x`：WPS 加载项脚手架 + 打包 + 发布 — 唯一官方工具链
- **`wps-jsapi`（社区 types）+ 手写 `declare namespace wps`**：无官方 `@types/wps`，社区包版本可能滞后，需对照官方文档补缺
- **Vite 多入口**（`main.tsx` Office.js + 新增 `main-wps.tsx` WPS）：一套仓库、两个外壳、共享 `src/`；WPS `index-wps.html` **不引 office.js CDN**
- **最低 WPS 版本**：专业版/企业版 ≥ WPS2019 10255 或现行 12.x 专业版（用户装机已确认专业版；个人版 oem.ini 安全限制不适用专业版，但需真机确认）

### Expected Features

详见 `FEATURES.md`。WPS JSAPI 是 **async-IPC 逐属性**模型（无 Office.js 批 load/sync）——每次属性访问一次 await IPC 往返，写密集操作（如批量写 50 单元格）比 Office.js batch 慢；adapter 方法变成顺序 async 链。

**Must have（滩头堡 table stakes）:**
- 单宿主 read（取选区 / 读结构 / 读值文本）— WPS JSAPI 有 DIRECT 路径
- 单宿主 write + **完整 inverse（operationLog 移植）** — 见下方 UNDO 裁定
- agent loop + 1 个 killer scenario 在 WPS 真机端到端跑通
- 复用层 CEF 坐实（Key 存活 + SSE 直连 + 字体无降级）

**UNDO 裁定（关键，FEATURES 多源确认）:** WPS JSAPI 写操作**不进**原生 Ctrl+Z 撤销栈，`Application.Undo()` **未暴露**，`undoRecord` 批 API 是已知 bug（2025-11-25 WPS 官方 bbs 承认）。→ **Aster `operationLog` 反向引擎必须完整移植**，不能靠宿主原生撤销；inverse 收 Record 对象签名（Phase 5 教训沿用）。

**Should have（差异化，取决于首宿主）:**
- D-03 桌面独有增益（网页版做不到的）——置信度阶梯：Word PageSetup 页边距（HIGH，文档化）> Excel PivotTable（MEDIUM，集合有文档、Add 签名需真机）> PPT 渐变填充（MEDIUM）> PPT copy_slide（LOW，无直接 API）> PPT AddTable/AddLine/AddConnector（LOW，**不在官方 Shapes 文档**）

**Defer（后续 WPS-D1）:**
- 三宿主完整对齐（本里程碑只建单宿主滩头堡）
- SmartArt / 动画 / 转场 / 套主题

### Architecture Approach

详见 `ARCHITECTURE.md`。**构建策略 = 单仓库、两个 Vite 入口、共享 `src/`**，`wpsjs` 打包目录与 Pages 输出隔离、bundle 预算独立核算（方案 a 运行时切换被否——两套初始化链无法共存于同一 HTML；方案 c 独立仓库过早抽包）。

**Major components:**
1. **wpsjs 外壳** — `ribbon.xml`（`onLoad=OnAddinLoad`）+ `jsplugins.xml` + `index-wps.html`（无 office.js）+ Vite 入口
2. **宿主识别入口（`main-wps.tsx`）** — `OnAddinLoad` 替代 `Office.onReady`；读 `window.Application.ComponentType`（1=文字 / 2=表格 / 3=演示）→ `createWpsAdapter(type)`；其余 hydrate stores / loadHistory / render React 全复用
3. **`WpsXxxAdapter`（接缝下方）** — 实现现有 `DocumentAdapter` 接口；方法体直接访问 `window.Application.*`（同步 VBA 风格），签名 `async` 仅为满足接口；接缝上方零改动
4. **复用层（零改动）** — `sse.ts` / `fetch` / `ReadableStream` CEF 原生支持；`storage.ts` partitionKey 降级分支自动命中（CEF localStorage 跨会话持久性 = [需真机]）

### Critical Pitfalls

Top 风险（详见 `PITFALLS.md`），按 make-or-break 排序：

1. **CEF 容器 CSP/CORS 拦直连 fetch（产品死亡级，最高优先）** — 若 WPS 加载项容器注入 `connect-src` 限制，无后台直连 DeepSeek/aihubmix SSE 全挂、Core Value 在 WPS 上失效 → 里程碑 no-go。**唯一证明 = WPS-02 §1 第 1-2 项（fetch DeepSeek SSE + 看 Network/CSP）**，必须是验证序列**第二步**。
2. **CEF 内核版本过旧 → ReadableStream/React 19 不可用（次高优先）** — WPS 未披露 CEF 版本，若 < Chromium 80，SSE 核心 + React 19 崩。**唯一证明 = WPS-02 §1 第 1-1 项（`navigator.userAgent` + 特性探测）**，必须是验证序列**第一步**；不达标则后续验证无意义。
3. **JSAPI 写操作静默失败（no-op 不抛错）** — VBA「尽力执行」风格，写失败不报错直接 no-op（类比 Aster Office-for-Web「写后回读」教训）→ 所有 WPS adapter write 方法跟随 `assertWriteResult()` 立即回读对比，纳入 adapter base class。
4. **宿主识别白屏 / param casing** — `ComponentType` 读错 → adapter 路由错；沿用 v2.x snake/camel 容错纪律。
5. **过早承诺三宿主 / 「看起来可复用其实不行」** — 探针未绿前不写 adapter；复用层「大概率」全部标 [需真机]。

## Implications for Roadmap

研究建议 **4 个 Phase**（编号从 30 续接），严格分阶段、make-or-break 前置：

### Phase 30: WPS-02 真机验证探针（硬门）
**Rationale:** 整个里程碑的 go/no-go 闸门；两条产品死亡级风险（CEF 版本 / CORS）必须在写任何适配代码前坐实。
**Delivers:** 极简 `wpsjs` 探针加载项（**不进 Aster 主仓 `src/`**）+ 真机跑完 `25-WPS-01-REPORT.md` §5 全部清单（§1 底层运行时 → §2 目标宿主 read/write/undo → §3 D-03 增益探测）+ go/no-go 裁定报告 + 工作量细化 + **首宿主数据**。
**Avoids:** Pitfall 1/2（前两步串行：userAgent → DeepSeek SSE，任一挂即停工）。
**Note:** 真机步骤**只能用户在 Windows WPS 上跑**（Claude 在 Mac 开发探针 + 写清单，无法代跑）。

### Phase 31: wpsjs 外壳 + 复用层 CEF 坐实（go 后才开工）
**Rationale:** 先证明「React UI + 直连 + 存储」在 CEF 内真机活着，再投入 adapter。
**Delivers:** `src/main-wps.tsx` + `ribbon.xml` + `jsplugins.xml` + `index-wps.html`（无 office.js CDN）+ Vite 多入口；Task Pane 加载、React 渲染、`ComponentType` 宿主路由成立；Key 存活 + SSE 直连真机坐实。
**Uses:** `wpsjs` CLI、Vite 多入口（STACK）。
**Implements:** Architecture 组件 1 + 2 + 4。

### Phase 32: 单宿主 adapter + operationLog 移植（go 后）
**Rationale:** 接缝下方的核心工作；UNDO 必须移植 operationLog（不能靠原生撤销）。
**Delivers:** 选定宿主（**Excel vs PPT — 见下方开放决策**）的 read/write/inverse（WPS JSAPI，`assertWriteResult` 写后回读）+ 1 个 killer scenario 在 WPS 真机端到端跑通。
**Implements:** Architecture 组件 3 + UNDO 裁定。

### Phase 33: 收口 + 守门 + wpsjs publish
**Rationale:** 诚实收口，非目标宿主不裸奔。
**Delivers:** 非目标宿主 adapter throw stub 守门 + WPS 版 operationLog.integration.test + bundle 预算（WPS 外壳独立核算）+ `wpsjs publish` 安装流程固化 + 真机 UAT packet。

### Phase Ordering Rationale
- **依赖序**：验证（30）→ 外壳/复用层（31）→ adapter（32）→ 收口（33）；每段以前段真机绿灯为前提。
- **风险前置**：两条产品死亡级风险压在 Phase 30 前两步，最大化「早失败、零浪费」。
- **首宿主数据驱动**：Phase 30 §3 探测结果决定 Phase 32 选哪个宿主（见开放决策）。

### Research Flags
深度研究（plan-phase 需再钻）:
- **Phase 30:** 探针清单的精确探测脚本（每条 JSAPI 调用的确切写法）需对照官方 API 文档逐条落地。
- **Phase 32:** 选定宿主的 WPS JSAPI 逐方法签名（尤其 PivotTable.Add / PPT AddTable 是否存在）——部分要等 Phase 30 真机数据。

标准模式（可跳过 research-phase）:
- **Phase 31:** wpsjs 外壳 + Vite 多入口是文档化标准流程。

## ⚠️ 开放决策：第一宿主（Excel vs PPT）— 留待 WPS-02 数据 + discuss-phase 裁定

研究结论**明确冲突**，不 paper over：
- **FEATURES 推荐 Excel**：15 个核心操作全有文档化 JSAPI DIRECT 路径，风险最低；`Range.Value` snapshot 是最简单 inverse；唯一未知是 `PivotTable.Add` 签名。
- **ARCHITECTURE 倾向 PPT**：D-03 增益最多（copy_slide / AddTable / 渐变全是 Office-for-Web 已知痛点），差异化价值最大。
- **PPT 的风险**：`Shapes.AddTable`/`AddLine`/`AddConnector` **不在官方 Shapes 文档**——若 JSAPI 无这些方法，v2.4 两个新 PPT 工具在 WPS 上死亡，PPT 滩头堡打脸。
- **建议裁定原则（供 discuss-phase）**：让真机数据决定——若 WPS-02 §3 探测中 AddTable(3-6) / AddLine(3-7) / copy_slide(3-1) ≥2 项通过，选 PPT；否则选 Excel。

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | wpsjs 工具链核心事实 HIGH；Mac 开发体验 MEDIUM；wps-jsapi 类型覆盖 MEDIUM |
| Features | MEDIUM | API 路径有官方文档；关键行为（写后是否 no-op、PivotTable/AddTable 签名）需真机 |
| Architecture | HIGH | 接缝设计基于 Aster 实际代码；DocumentAdapter 接口成立 |
| Pitfalls | MEDIUM | 架构性事实 HIGH；CEF 运行时行为 LOW until 真机 |

**Overall confidence:** MEDIUM

### Gaps to Address
全部只能由 WPS-02 真机解答，文档无法推断：
- **CEF 实际 Chromium 版本** → Phase 30 §1 第 1-1 项
- **WPS 容器 CSP/CORS 策略** → Phase 30 §1 第 1-2 项（单点 go/no-go 阻断器）
- **CEF localStorage 跨会话持久性** → Phase 30 §1 第 1-4 项
- **PPT `Shapes.AddTable` 是否存在 / PivotTable.Add 签名** → Phase 30 §3 + 首宿主决策
- **Word 中文 locale 样式名** → 若选 Word（当前非首选）

## Sources

### Primary (HIGH confidence)
- `25-WPS-01-REPORT.md`（上里程碑调研，架构层基座 + §5 真机清单 + 一手来源）
- open.wps.cn / solution.wps.cn/docs/client/api（WPS 官方加载项 + JSAPI 文档）
- Aster 实际代码（`src/main.tsx` / `src/adapters/` / `src/lib/storage.ts` / `src/lib/sse.ts`）

### Secondary (MEDIUM confidence)
- bbs.wps.cn（undoRecord bug 官方承认 2025-11-25 / PivotTable 讨论）
- CSDN / 知乎 wpsjs 项目结构 + 部署实证

### Tertiary (LOW confidence)
- 社区博客 CEF 版本零散报告（需真机 userAgent 坐实）

---
*Research completed: 2026-06-08*
*Ready for roadmap: yes（含 1 个开放决策：首宿主 Excel vs PPT，留 WPS-02 数据 + discuss-phase）*
