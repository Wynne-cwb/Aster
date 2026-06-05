---
phase: 25-wps-spike-gate
verified: 2026-06-05T11:15:40Z
status: passed
score: 3/3 v2.4-deliverable success criteria verified (SC#1/#2/#5); SC#3/#4 = N/A-Deferred (D-01)
verdict: PASS-with-notes
re_verification:
  # No prior VERIFICATION.md — initial verification
deferred: # SC#3/#4 explicitly deferred per Phase 25 discuss D-01 — NOT v2.4 PASS conditions
  - truth: "用户在 Windows + WPS 桌面版完成真机 sideload + 三宿主 run() API 实测，记录跑通/跑挂清单（SC#3）"
    addressed_in: "WPS-02 真机层（异步 / 下个里程碑，用户有 Windows 环境时）"
    evidence: "Phase 25 discuss D-01：用户确认当前无 Windows 环境 → 真机层整体延后；ROADMAP §Phase 25 SC#3 标 ⏸️ Deferred/Async；CONTEXT.md L40/L115"
  - truth: "最终 go/no-go 裁定已明确：go 时附适配工作量估算；no-go 时里程碑照常 ship（SC#4）"
    addressed_in: "WPS-02 真机层（异步 / 下个里程碑）"
    evidence: "D-01：最终裁定待真机坐实；ROADMAP §Phase 25 SC#4 标 ⏸️ Deferred/Async；报告 §1.3 明示只给信号不给裁定"
notes: # 咨询性提醒（非阻塞 gate）
  - "外部引用（社区/官方 URL）未由 verifier 独立重新抓取核对内容；但报告对 Aster 自家代码的全部行号引用经逐项核实精确命中（office.js CDN/main.tsx/storage.ts/三 adapter requirement set gate/manifest 三宿主），且证据按四级诚实分级——可信度高。建议用户日后顺手对 §附引用清单做轻量抽查。"
  - "team-lead 收尾：ROADMAP §Phase 25 SC#3/#4 已标 ⏸️ Deferred/Async（commit 11ed244 已落）；请同步确认 REQUIREMENTS Traceability 中 WPS-02 状态为 Deferred/Async、WPS-01 标 v2.4 已交付。"
---

# Phase 25: WPS spike-gate 验证报告

**Phase Goal:** 团队拿到 WPS Windows 桌面版 Office.js 兼容性的完整调研报告 + 真机验证清单（WPS-01），具备日后真机裁定的全部前置依据
**Verified:** 2026-06-05T11:15:40Z
**Status:** passed（总裁定 = **PASS-with-notes**）
**Re-verification:** No — initial verification
**Phase 性质:** spike / 调研型 — 交付物 = 调研报告 markdown + 真机验证清单，**不写运行时代码**（CONTEXT.md L10）

---

## Goal Achievement

### 核验口径（goal-backward）

本 phase 唯一交付物 = `25-WPS-01-REPORT.md`（37KB，7 节 + 引用附录）。无 PLAN.md / SUMMARY.md（spike 无实现合约）。must-haves 来源 = ROADMAP §Phase 25 Success Criteria（5 条），其中 **SC#3/#4 经 D-01 延后**，不作为 v2.4 PASS 条件。verifier 从「报告应交付什么」反推、逐项落到报告实际内容核对，并对报告里**可验证的代码锚点**做交叉核实以评估诚实性。

### Observable Truths（v2.4 交付层）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC#1 | 调研报告产出：涵盖 WPS 加载项架构 / Office.js manifest 支持 / 三宿主 `*.run` 兼容性 / sideload 机制 / 已知限制 / 社区·官方证据 + D-03 候选逐项 | ✓ VERIFIED | §2 Fact①（架构+manifest）、Fact③+§3 矩阵（三宿主 `*.run`）、Fact⑧（sideload）、§7（已知限制专节）、Fact⑨+§附录（社区/官方证据）、§4（D-03 候选 9 项逐项表）全部到位 |
| SC#2 | 给出初步 go/no-go 信号（D-02 三宿主全绿阈值框架）+ 真机验证清单（P0=三宿主基础 run()） | ✓ VERIFIED | §1.2 用 D-02 框架判定表 + §1.3 双信号（NO-GO sideload口径 / GO-with-rewrite WPS-D1口径）；§5 分段清单（第0段证伪 / 第1段底层运行时 / 第2段三宿主 read+write+undo 标 P0 / 第3段 D-03 加分），每条可勾选 |
| SC#5 | WPS-02 真机层与 Phase 26–29 解耦异步（设计上满足） | ✓ VERIFIED | 报告 §1.4 + §7 + D-01 明确真机层为延后/异步；§5 清单独立可单跑、不阻塞；ROADMAP §Phase 25 SC#5 + 里程碑 C 工具/配置两线照常 ship |

**Score:** 3/3 v2.4 交付层 SC 全绿。

### Deferred Items（N/A-Deferred — 不计入 v2.4 PASS/FAIL）

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| SC#3 | 用户真机 sideload + 三宿主 run() 实测，记录跑通/跑挂清单 | WPS-02 真机层（异步） | D-01：用户暂无 Windows 环境 → 整体延后；ROADMAP 标 ⏸️ Deferred/Async |
| SC#4 | 最终 go/no-go 裁定 + go 时工作量估算 | WPS-02 真机层（异步） | D-01；报告 §1.3 明示「只给信号不给裁定」 |

> 报告**未假装有真机结论**（D-01 honored）——§1.3 / §7 / 文末三处显式声明最终裁定待 WPS-02。这是延后边界被正确尊重的直接证据，**不据此判 FAIL**。

### 11 项 researchable facts 覆盖核对

| # | researchable fact | 报告落点 | 证据分级 | 覆盖 |
|---|-------------------|----------|----------|------|
| ① | WPS 是否支持 MS Office.js 架构 / XML manifest | §2 Fact① + §3 矩阵 | 官方明确+社区实测 / HIGH | ✓ |
| ② | `Office.onReady` / `Office.context.host` 宿主识别行为 | §2 Fact② | 推断为主 / HIGH（标需真机坐实具体表现） | ✓ |
| ③ | `*.run` requirement set 支持矩阵（含 Aster 实际用到的 set） | §2 Fact③ + §3 矩阵 | 官方明确 / HIGH | ✓ |
| ④ | WPS 是否走微软 CDN office.js loader | §2 Fact④ | 官方+推断 / MEDIUM-HIGH | ✓ |
| ⑤ | webview 内核（Chromium？版本？） | §2 Fact⑤ + §3 矩阵 | 内核 HIGH / 版本 未知-需真机 | ✓ |
| ⑥ | CORS / CSP 在 WPS webview 行为 | §2 Fact⑥ + §7 高危面 | 推断+需真机 / MEDIUM | ✓ |
| ⑦ | partitioned localStorage / partitionKey 可用性 | §2 Fact⑦ | 推断+需真机 / MEDIUM | ✓ |
| ⑧ | WPS sideload 机制 | §2 Fact⑧ | 官方+社区 / HIGH | ✓ |
| ⑨ | 社区/官方证据（有人跑通过吗？） | §2 Fact⑨ + §附录 | 社区实证 / HIGH | ✓ |
| ⑩ | D-03 桌面增益候选逐项支持 | §2 Fact⑩ + §4 专节 9 项表 | VBA 模型 MEDIUM / 逐 API 需真机 | ✓ |
| ⑪ | 报告产出物（综述+信号+清单） | §1 信号 + §5 清单 + §6 工作量 | — | ✓ |

**11/11 逐项覆盖**，每项均带证据分级 + 置信度 + 引用。

### 报告诚实性评估（spike 报告核心质量）

| 诚实性维度 | 判定 | 依据 |
|-----------|------|------|
| 证据四级分级机制 | ✓ 优秀 | 【官方明确】/【社区实测】/【推断】/【未知-需真机】逐 Fact 应用，置信度 HIGH/MEDIUM/LOW 标注 |
| 不把猜测当事实 | ✓ 优秀 | `Office.onReady 不触发`、`CORS 大概率可用` 等均明标「推断 / 需真机」；D-03 增益明标「能力存在信号 ≠ 已验可用」 |
| 矛盾证据处理 | ✓ 优秀（加分项） | §2 Fact⑨ + §7 主动点名「一次检索出现『WPS 兼容 Office JSAPI』零散表述」→ 判为疑串台、**未采信**、留真机证伪。surface 而非掩埋反向数据，反向印证严谨 |
| 不假装有真机结论 | ✓ | D-01 honored，三处显式声明裁定待 WPS-02 |
| 双信号论证充分性 | ✓ | NO-GO（sideload-as-is）/ GO-with-rewrite（WPS-D1）分离为「问题 A vs 问题 B」，§3 矩阵清晰切分「微软加载项契约层=全红」vs「底层 Web 运行时层=绿/黄」，非空泛断言；10+ 一手/社区来源支撑 |
| 自家代码引用准确性 | ✓ 精确命中 | 见下表交叉核实 |

#### 报告对 Aster 代码的可验证锚点（verifier 交叉核实）

| 报告声明 | 实际代码 | 命中 |
|----------|----------|------|
| index.html 有 office.js CDN script tag | `index.html:16` `<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js">` | ✓ |
| main.tsx：`Office.onReady → info.host → createAdapter` 总入口链 | `src/main.tsx:50-53`（`Office.onReady(async (info)=> { ... createAdapter(info.host) }`）+ L34 读 `officeTheme` | ✓ |
| storage.ts 已有 `partitionKey===undefined` 降级分支（注释明示 Windows WebView） | `src/lib/storage.ts` `prefixedKey()`：`pk ? prefix+rawKey : rawKey`，注释明写「partitionKey 不存在时（Windows WebView…）直接返回 rawKey」 | ✓（报告引 L60-69，实际命中） |
| WordApi 1.6 gate @WordAdapter.ts:494 | `src/adapters/WordAdapter.ts:494` `isSetSupported('WordApi','1.6')` | ✓ 精确 |
| ExcelApi 1.9 gate @ExcelAdapter.ts:1336（门控 replaceAll） | `src/adapters/ExcelAdapter.ts:1336` 注释 `isSetSupported('ExcelApi','1.9') 门控 replaceAll` | ✓ 精确 |
| PowerPointApi 1.10 gate @PptAdapter.ts:2595 | `src/adapters/PptAdapter.ts:2595` `isSetSupported('PowerPointApi','1.10')` | ✓ 精确 |
| manifest 三 `<Host>`（Presentation/Workbook/Document）+ shared runtime + Pages URL | `manifest.xml:29-31` 三 Host + `SourceLocation=https://wynne-cwb.github.io/Aster/` | ✓ |
| v2.4 新工具将用 WordApi 1.4 / ExcelApi 1.8 / PowerPointApi 1.4 | 与 REQUIREMENTS WORD-08(1.4)/EXCEL-13(1.8)/PPT-10(1.4) 一致；insertComment/pivotTables 尚未实现（=未来工具，措辞「将用到」正确）；PowerPointApi 1.4 已在 PptAdapter 在用 | ✓ |
| 复用资产 sse.ts | `src/lib/sse.ts` 存在（14.7KB） | ✓ |

> **结论：报告对自家代码零捏造、行号逐项精确命中。** 这显著提升对其外部研究部分的可信度——一个连自家代码行号都核对到位的 researcher，对外部来源的分级也更可信。

### 真机清单可操作性核查（SC#2 子项）

| 检查点 | 判定 | 依据 |
|--------|------|------|
| 可勾选 | ✓ | §5 全程 `- [ ]` checkbox，编号化（0-1/0-2/1-1…3-9） |
| 覆盖 P0 三宿主基础 run() | ✓ | §5 第 2 段 2-P/2-E/2-W 各 read+write+undo，明标 P0 + D-02 判定门 |
| 覆盖 D-03 增益探测 | ✓ | §5 第 3 段 3-1..3-9 逐项（copy_slide/读背景/取图/页边距/透视表/插表格/addLine/渐变/SmartArt） |
| 覆盖 sideload 步骤（D-05） | ✓（已据 D-05 授权调整） | 调研发现 WPS 不消费 MS manifest → §5 第 0 段保留「证伪 MS manifest 进不去」+ 主体改 WPS 原生 `wpsjs` 路径；D-05 明文授权「机制不同则 researcher 给 WPS 侧步骤」 |
| 环境前置写明 | ✓ | §5 头部：WPS 专业版/企业版 + Node(`wpsjs`) + DevTools(ALT+F12) |

> D-05 默认（用线上 GitHub Pages MS manifest sideload）被调研发现推翻——报告依 D-05 明文授权（「若 sideload 机制与微软不同，researcher 给 WPS 侧步骤」）正确改写清单，**不是偏离而是 D-05 预留的分支被触发**。

### 关键链路验证（goal → 交付物）

| From | To | Via | Status |
|------|-----|-----|--------|
| 北极星问题（能否 sideload 即用三宿主跑通） | §1 初步信号 | D-02 框架 → 🔴 NO-GO（sideload-as-is，架构性而非版本落后） | ✓ WIRED |
| D-02 三宿主全绿阈值 | §5 第 2 段 P0 清单 | 三宿主 read/write/undo 各列 P0 + 判定门「全绿→go 基础；任一挂→no-go」 | ✓ WIRED |
| D-03 增益视角 | §4 评估表 + §5 第 3 段 | 9 候选逐项「能力信号 + 置信度 + 需真机」→ 加分理由 | ✓ WIRED |
| D-04 只覆盖桌面版 | 全文 | 报告头部 + 各 Fact 均限 WPS Windows 桌面版，零网页/移动版内容 | ✓ WIRED |
| D-01 真机层延后 | §1.3/§7/文末 | 三处显式「只给信号不给裁定」 | ✓ WIRED |

### Anti-Patterns Found

无。文档型交付物，无 TODO/占位/空实现/伪造数据。报告反而主动暴露不确定性（§7「无真机不可定项」专列）与单一存疑来源，是诚实性正向信号。

### Human Verification Required

无（v2.4 交付层）。

> 说明：本 phase 的「真机验证」=延后的 WPS-02 层（SC#3/#4），属 N/A-Deferred、**非 v2.4 完成条件**，故不计入本阶段 human-verification gate。报告本身的质量（覆盖/信号/清单/诚实性）已由 verifier 全量可验并通过。外部引用独立抓取核对见 frontmatter `notes`（咨询性，非阻塞）。

### Gaps Summary

**无阻塞性缺口。** v2.4 交付层 3 条 SC（#1/#2/#5）全绿；11 项 researchable facts 逐项覆盖且诚实分级；报告对自家代码 9 处锚点引用全部精确命中、零捏造；双信号（NO-GO sideload-as-is / GO-with-rewrite WPS-D1）论证充分、10+ 来源支撑、内部一致；真机清单可勾选、覆盖 P0 三宿主 + D-03 增益 + 依 D-05 授权调整后的 WPS sideload 路径。SC#3/#4 正确延后（D-01），报告未越界假装有真机结论。

**两点咨询性提醒（不阻塞，见 frontmatter notes）：**
1. 外部社区/官方 URL 未由 verifier 离线独立重抓核对内容——但自家代码锚点全中 + 四级分级，可信度高；建议用户日后轻量抽查 §附引用清单。
2. team-lead 收尾确认 REQUIREMENTS Traceability 中 WPS-02 = Deferred/Async、WPS-01 = v2.4 已交付（ROADMAP 侧 commit 11ed244 已标）。

---

## 总裁定：PASS-with-notes

Phase 25 v2.4 交付层目标**已达成**：WPS-01 调研报告 + 真机验证清单 + 双 go/no-go 信号产出完整、诚实、可操作。WPS-02 真机层正确延后（D-01），不阻塞里程碑。**可视为 Phase 25 完成，推进 Phase 26（配置导入导出）。**

---

_Verified: 2026-06-05T11:15:40Z_
_Verifier: Claude (gsd-verifier)_
