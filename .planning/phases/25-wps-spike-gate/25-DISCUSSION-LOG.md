# Phase 25: WPS spike-gate — Discussion Log（审计轨迹）

**Discuss step:** user-led `gsd-discuss-phase`（discuss TeamMate, team `aster-v2.4`）
**Date:** 2026-06-05
**Outcome:** 4 项需人类拍板的灰区 → 真人用户经 AskUserQuestion 直达拍板（全部回答，0 跳过）。无硬造问题。

---

## 1. 灰区二分（triage）

读取上下文：`.planning/REQUIREMENTS.md`（WPS-01/02 + Out of Scope + WPS-D1）、`.planning/ROADMAP.md` §Phase 25、`.planning/STATE.md`（v2.4 scope + blockers）、参考体例 `.planning/phases/18-lib/18-CONTEXT.md`。

### 已锁定（不重复问）
- 目标平台 = WPS Windows 桌面版 only（用户先前选定）。
- 两层 spike：调研层（WPS-01，后续 research TeamMate 跑）+ 真机层（WPS-02，用户跑）。
- 本里程碑只出可行性 go/no-go 裁定，不承诺全量适配；go 则 WPS-D1 独立 milestone。
- WPS-02 真机层可与 Phase 26–29 并行异步，spike 不通过里程碑照常 ship。

### 可研究的事实（不问用户 → 记录留给 WPS-01 researcher）
WPS 是否支持 Office.js manifest、`PowerPoint.run`/`Excel.run`/`Word.run` 兼容程度、sideload 机制、webview 内核、CORS/存储行为、已知限制、社区证据——**这些正是 WPS-01 调研报告本身的内容**。discuss 阶段不做调研。已整理成 11 项「可研究的事实清单」写入 25-CONTEXT.md `<researchable_facts>`。

### 需人类拍板（→ AskUserQuestion 直问真人，1 次调用 4 问）
判定标准：只有用户知道的事实（环境/排期）或产品风险取向（阈值/范围/价值判断），研究替代不了。命中 4 项，均为 team-lead 灰区提示中点名的项，无硬造。

---

## 2. 提问与回答（AskUserQuestion，2026-06-05）

### Q1 — P25-真机环境：WPS-02 真机环境与排期
- **为何问**：真机 sideload 需用户自有 Windows + WPS 桌面版——这是只有用户知道的事实，且决定 Phase 25 本里程碑能否出完整裁定 vs 只交报告+清单。team-lead 判定「几乎必然要问」。
- **选项**：① 现在就有，里程碑内可跑 / ② 需准备，后期才跑 / ③ 暂无环境，真机延后。
- **用户选 ③「暂无环境，真机延后」。**
- **后果**：Phase 25 在 v2.4 内**只交付 WPS-01（调研报告 + 真机验证清单）**；WPS-02（真机实测 + 最终裁定）整体延后到用户有环境时/下个里程碑。→ **D-01**（改写 phase 成功标准：ROADMAP §25 criteria #3/#4 延后，#1/#2/#5 本里程碑达成）。

### Q2 — P25-裁定门槛：go/no-go 阈值
- **为何问**：产品风险容忍度，研究替代不了；同时决定真机验证清单优先级。
- **选项**：① 三宿主全绿才 go（最保守）/ ② 任一宿主通即部分 go（渐进）/ ③ 核心写操作通即 go（务实）。
- **用户选 ①「三宿主全绿才 go」（最保守，最高信心）。**
- **后果**：调研报告「初步 go/no-go 信号」用三宿主全绿框架判；真机清单把三宿主基础 read/write/undo 全列 P0 必测。→ **D-02**。

### Q3 — P25-桌面增益：桌面独有能力是否算加分
- **为何问**：产品价值判断（WPS 桌面可能突破网页版天花板）——研究替代不了「是否值得多花调研力气探」。
- **选项**：① 算加分，纳入裁定 / ② 只看现有工具对等。
- **用户选 ①「算加分，纳入裁定」。**
- **后果**：调研 + 真机额外探 v2.x 因网页版天花板放弃的能力（copy_slide / SmartArt / 读背景色 / 取选中图 Preview / Word 页边距纸张 / 透视表 / 插表格 / addLine / 渐变）；WPS 桌面若支持 = go 加分理由，记录入报告。增加调研工作量，用户判定值得。→ **D-03**。

### Q4 — P25-调研范围：报告是否顺带网页/移动版
- **为何问**：调研报告范围/深度（team-lead 点名的灰区）；影响 WPS-01 deliverable 大小。
- **选项**：① 只覆盖 Windows 桌面版 / ② 桌面为主 + 简述网页移动。
- **用户选 ①「只覆盖 Windows 桌面版」。**
- **后果**：WPS-01 报告严格聚焦桌面版，网页/移动完全不提（最快出信号，与 Out of Scope 一致）。→ **D-04**。

---

## 3. discuss TeamMate 自决（非用户拍板，标注可调整）

- **D-05（真机 sideload 用线上 Aster manifest，不另造测试构建）**：合理默认——真机层测用户日常会装的线上版本（GitHub Pages 部署的 XML manifest）才是真实可行性。明确标注为 Claude 自决，planner/researcher 可在真机清单调整（尤其若调研发现 WPS sideload 机制与微软不同）。

---

## 4. 产物

- `25-CONTEXT.md` — 权威决策（D-01..D-05）+ 11 项可研究事实清单 + canonical refs + 待测面 + 风险/延后区 + UAT（真机清单）种子。
- `25-DISCUSSION-LOG.md` — 本文件（审计轨迹）。

**未 git commit**（team-lead 收尾统一 commit）。

---

## 5. 给 team-lead 的交接提示（收尾时处理）

- **ROADMAP §Phase 25 success criteria #3/#4 需标「WPS-02 真机层延后」**（D-01）——本里程碑这两条不作为 phase 完成硬条件。
- **REQUIREMENTS Traceability：WPS-02 状态宜从 Pending → Deferred/Async**（真机层延后），WPS-01 仍本里程碑交付。
- **STATE.md blocker「WPS-02 需用户备 Windows 环境」可更新为「已确认暂无 → 本里程碑只交 WPS-01，真机层异步延后」。**

---

*Phase: 25-wps-spike-gate*
*Discussion logged: 2026-06-05*
