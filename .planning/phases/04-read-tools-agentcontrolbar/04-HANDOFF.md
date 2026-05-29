# Phase 4 — 会话交接（HANDOFF）

**写于：** 2026-05-29（旧 session 关闭前）
**下一步执行环境：** Claude App（有 Claude in Chrome，可驱动用户真实 M365 浏览器）

---

## 一句话现状

Phase 4「Read Tools 全套 + AgentControlBar 步骤文案」**只差最后一步：Plan 09 三宿主真机 UAT**。Plan + Execute(Wave 1-4) + 自动化 Verify 全部完成且实证可信赖，代码已部署线上。真机 UAT 此前因「自动化工具连不上用户真浏览器」阻塞，改由用户在 Claude App 里用 Claude in Chrome 手动/半自动跑。

---

## 已完成（可信赖，勿重做）

- **Plan**：9 plan / 5 wave，plan-checker 两轮验证 PASSED（12/12 维度）。
- **Execute Wave 1-4（Plan 01-08）**：全部 commit 在本地 main 且已 push origin。门禁实证（executor + verifier 双复跑一致）：
  - `npm run test` → 440 passed / **1 failed**
  - `npm run build` → exit 0
  - `npm run size` → **79.1 KB ≤ 80 KB**
  - 净新增运行时依赖 = 0
- **自动化 Verify**：6 条 SC 中可自动验的部分全过；SC4(size cap/包装/防注入)、SC5(circuit breaker A-10 灵魂) 完全单测 PASS；SC1/2/3/6 代码+单测层全绿，真机部分待 UAT。9 条 requirement(AGENT-12/ERR-03/ERR-04/TOOL-01/02/05/06/07/CARRY-02) 全部对到实现+绿测。

### 两处需知道的事
1. **唯一失败 = `src/agent/loop.test.ts` AGENT-02 max_steps soft-landing** —— 已用「Phase 4 首 commit 的父提交复现相同失败 + 该文件无 Phase 4 commit 触碰」双重佐证，**确属 Phase 3 预存在，与本 phase 无关**。不要当成 Phase 4 回归。
2. **两处计划外编排 commit（已审查无回归）**：
   - `ad6d42b` —— bundle 救火：`createAdapter()` 改按宿主 dynamic import（动了 `src/main.tsx` 引导路径），主 chunk 从 80.67KB 降回 79.1KB。三 adapter 拆为各自 lazy chunk，线上 HTTP 200 可取。**真机 bootstrap 行为属 Plan 09 UAT 范畴。**
   - `a2e5e2b` —— 修 ChatStream.giveup.test.tsx mock 接口 + 丢弃一份会破坏 i18n 的重构、保留 lingui 版本。

---

## 部署状态

- **已 push**：origin/main 至 `9335dd6`，GitHub Pages workflow run `26619575238` = success。
- **线上 = 新版本（哈希实证）**：线上 https://wynne-cwb.github.io/Aster/ 的 index.html 引用 `assets/main-D3SPZ_tW.js`，与本地 HEAD 构建逐字符匹配；三 adapter 懒加载 chunk 全 200。
- **唯一未 push commit = `f59b954`**（本文档同批的 04-UAT-EVIDENCE.md runbook，纯 planning 文档，**不影响线上**，无需为它部署）。
- **结论：直接在线上测即可，无需再 push 任何代码。**

---

## 剩下唯一要做的：Plan 09 真机 UAT（manual / Claude in Chrome）

**操作手册全文在：** `.planning/phases/04-read-tools-agentcontrolbar/04-UAT-EVIDENCE.md`（status: awaiting_user_uat，每条 SC 一行待回填 PASS/FAIL/N-A + 截图）。

要在 PPT/Excel/Word 三宿主真机逐条跑：
- **SC1** PPT 复合 demo（read 链路，中文人话折叠卡；insert_slide 是 Phase 6，走到 read 后停住=预期不算 FAIL）
- **SC2** 三宿主 read：Word 段落计数 / Excel used range 概况+前20行(两卡都要出现) + **A-24 大区域**(>10K cells 拒绝 full mode 走 summary) / PPT slide 标题(按顺序)
- **SC3** 三态文案(读/思考/写不同措辞)+ 5 秒无更新安抚行
- **SC5** 熔断红卡(构造连续 write_locked ≥3 次同 code → CIRCUIT_OPEN + 红卡「重新试试」**无撤销按钮**)。真机难构造可标 **N/A**（A-10 单测已覆盖），别伪造。
- **SC6** model 下拉：内置 DeepSeek/AiHubMix = select、自定义 = input

**跑完收尾流程：**
1. 把每条 PASS/FAIL/N-A + 截图回填 `04-UAT-EVIDENCE.md`。
2. 全 PASS（SC5 可 N/A）→ 建 `04-09-SUMMARY.md` → 走 verify / phase.complete。
3. **⚠ 已知 STATE/ROADMAP quirk（手工核对）**：phase.complete 可能误判，需手工把 STATE「8 of 9 → 9 of 9 complete」、ROADMAP Phase 4 复选框勾上、并核对 next_phase 指向正确。
4. 任一 SC FAIL → 别硬收尾，走 `/gsd-plan-phase 04 --gaps` 补。

---

## 如何在 Claude App 接上

新 session 一句话即可恢复全部上下文：

> 「继续 Aster 项目 Phase 4 收尾。读 `.planning/phases/04-read-tools-agentcontrolbar/04-HANDOFF.md` 和 `04-UAT-EVIDENCE.md`，剩下的是 Plan 09 三宿主真机 UAT —— 用 Claude in Chrome 连我已登录 M365、已 sideload Aster 的浏览器，照 04-UAT-EVIDENCE.md 的 runbook 逐条跑 SC1/2/3/5/6，如实回填证据，全 PASS(SC5 可 N/A) 后建 SUMMARY + phase.complete（手工核对 STATE 8/9→9/9 + ROADMAP Phase 4 勾选）。」
