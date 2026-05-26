---
plan_number: "11"
title: "Wave 5 收尾 — MANIFEST.md 终稿 + REL-05 regression 起点固化"
phase: 0
wave: 5
depends_on: ["07", "08", "09", "10"]
files_modified:
  - .planning/spikes/MANIFEST.md
  - .planning/phases/00-spike-gating/00-PHASE-REPORT.md
autonomous: true
requirements: []
estimated_duration: "1 hour"
must_haves:
  goal: "Phase 0 所有 spike 结论归档完毕；MANIFEST.md 终稿可被 Phase 7 REL-05 直接使用"
  truths:
    - ".planning/spikes/MANIFEST.md 所有 10 行条目状态均非 PENDING（每项为 PASS 或 FAIL）"
    - ".planning/spikes/MANIFEST.md GATING 决策记录区域已填写整体结论（PROCEED 或 ABORT）"
    - ".planning/phases/00-spike-gating/00-PHASE-REPORT.md 存在，包含 Phase 0 完整摘要"
    - "00-PHASE-REPORT.md 包含 10 项 spike 结论表格 + Phase 1 前置条件确认"
    - "00-PHASE-REPORT.md 包含 Phase 7 REL-05 regression 重跑说明（如何使用 MANIFEST.md）"
threat_model:
  threats:
    - id: T-00-11-01
      description: "MANIFEST.md 遗漏 PENDING 条目被误认为已完成"
      mitigation: "收尾任务明确要求：所有 10 行状态均非 PENDING；用 grep 验证"
---

<objective>
Wave 5 收尾：将 Phase 0 所有 spike 结论整合到 MANIFEST.md 终稿，
并创建 00-PHASE-REPORT.md 作为 Phase 0 的完整摘要文档。

Purpose: MANIFEST.md 是 Phase 7 REL-05 regression 的直接对照物——v1.0 发布前需要
对照此清单重跑全部 10 项 spike 验证，确认上线版本未在任何已知风险点回退。

Output:
- `.planning/spikes/MANIFEST.md`（终稿：10 项全部有 PASS/FAIL 结论）
- `.planning/phases/00-spike-gating/00-PHASE-REPORT.md`（Phase 0 完整摘要）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/spikes/MANIFEST.md
@.planning/spikes/GATING-REPORT.md

决策出处：
- CONTEXT.md §D-09（MANIFEST.md 格式和 Phase 7 REL-05 用途）
- ROADMAP.md §Phase 7（REL-05：Phase 0 spike 作为 regression 重跑）
- CONTEXT.md §D-10（全部 commit 公开）
</context>

<tasks>

<task type="auto">
  <name>Task 1：更新 MANIFEST.md 终稿（汇总 10 项 spike 最终状态）</name>
  <files>.planning/spikes/MANIFEST.md</files>
  <read_first>
    - .planning/spikes/MANIFEST.md（当前状态，检查哪些条目仍为 PENDING）
    - .planning/spikes/001-cors-verify/findings.md（首行）
    - .planning/spikes/002-ppt-writeback/findings.md（首行）
    - .planning/spikes/003-storage-scope/findings.md（首行）
    - .planning/spikes/004-deepseek-multimodal/findings.md（首行）
    - .planning/spikes/005-api-mixing/findings.md（首行）
    - .planning/spikes/006-getselectedslides-order/findings.md（首行）
    - .planning/spikes/007-pdfjs-production-build/findings.md（首行）
    - .planning/spikes/008-pptx-text-extraction/findings.md（首行）
    - .planning/spikes/009-bundle-size-baseline/findings.md（首行）
    - .planning/spikes/010-sideload-checklist/findings.md（首行）
    - .planning/spikes/GATING-REPORT.md（整体 GATING 决策）
  </read_first>
  <action>
从每个 findings.md 的第一行提取实际结论（PASS/FAIL），更新 MANIFEST.md 的状态列。

**读取规则**：
- 第一行格式为 `# {名称} — PASS` → 状态设为 `✅ PASS`
- 第一行格式为 `# {名称} — FAIL` → 状态设为 `❌ FAIL`
- 若仍为 PENDING → 在行末加注 `（待补充）` 并在 Phase Report 中说明

**更新 MANIFEST.md 中的 Spike 清单表格**：
将每行的 `PENDING` 替换为实际结论：
- `✅ PASS`（通过）
- `❌ FAIL`（失败，fallback 已记录）

**更新 MANIFEST.md 的 GATING 决策记录区域**（从 GATING-REPORT.md 提取）：

```markdown
## GATING 决策记录

| GATING | 结果 | 决策文件 |
|--------|------|----------|
| #1 CORS | {PASS/FAIL} | [详情](001-cors-verify/findings.md) |
| #2 PPT 写回 | {PASS/FAIL} | [详情](002-ppt-writeback/findings.md) |
| #3 存储 scope | {PASS/FAIL} | [详情](003-storage-scope/findings.md) |

**整体 GATING 结论：** {PROCEED / ABORT}

---

**Phase 0 完成时间：** {今天日期}
**下一阶段：** {Phase 1（PROCEED）/ PRD 修订（ABORT）}
**REL-05 regression 说明：** 在 v1.0 发布前（Phase 7），对照此表格重跑所有 10 项 spike 验证一次，
将结果更新到各 findings.md 对应章节，并更新此 MANIFEST 的状态列为新结论。
```
  </action>
  <acceptance_criteria>
    - MANIFEST.md 中无剩余 PENDING 条目：`! grep -q 'PENDING' .planning/spikes/MANIFEST.md`（命令退出码 0 即通过）；或：`grep -c 'PENDING' .planning/spikes/MANIFEST.md` 返回 0
    - MANIFEST.md 含 PASS 或 FAIL 条目：`grep -c '✅ PASS\|❌ FAIL' .planning/spikes/MANIFEST.md` 返回 ≥ 1
    - GATING 决策记录已填写：`grep -c 'PROCEED\|ABORT' .planning/spikes/MANIFEST.md` 返回 ≥ 1
    - Phase 0 完成时间已填写：`grep -c 'Phase 0 完成时间' .planning/spikes/MANIFEST.md` 返回 ≥ 1
    - REL-05 regression 说明存在：`grep -c 'REL-05\|regression' .planning/spikes/MANIFEST.md` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'PENDING' .planning/spikes/MANIFEST.md | grep -q '^0$' && echo 'OK: no PENDING entries'</automated>
  </verify>
  <done>MANIFEST.md 终稿：10 项全部有 PASS/FAIL 结论，GATING 决策记录已填，REL-05 regression 说明已添加</done>
</task>

<task type="auto">
  <name>Task 2：创建 Phase 0 完整摘要 00-PHASE-REPORT.md</name>
  <files>.planning/phases/00-spike-gating/00-PHASE-REPORT.md</files>
  <read_first>
    - .planning/spikes/MANIFEST.md（终稿，10 项结论）
    - .planning/spikes/GATING-REPORT.md（GATING 决策）
    - .planning/ROADMAP.md §Phase 0（success criteria 原始描述）
    - .planning/phases/00-spike-gating/00-CONTEXT.md（锁定决策 D-01~D-12）
  </read_first>
  <action>
创建 `.planning/phases/00-spike-gating/00-PHASE-REPORT.md`：

```markdown
# Phase 0 完整报告 — Spike & 风险验证

**完成时间：** {今天日期}
**时间盒：** ≤ 1 周（实际：{X 天}）
**总体结论：** {PROCEED TO PHASE 1 / ABORT — PRD 修订}

---

## 10 项 Spike 汇总

| # | 名称 | GATING | 结论 | Phase 影响 |
|---|------|--------|------|-----------|
| 1 | CORS 验证 | ✅ | {PASS/FAIL} | {影响描述} |
| 2 | PPT 写回 | ✅ | {PASS/FAIL} | {影响描述} |
| 3 | 存储 scope | ✅ | {PASS/FAIL} | {影响描述} |
| 4 | DeepSeek 多模态 | — | {PASS/FAIL} | {PRD Q6/R2 结论} |
| 5 | API 混用挂死 | — | {PASS/FAIL} | {Phase 4 PPT adapter workaround} |
| 6 | getSelectedSlides 反序 | — | {PASS/FAIL} | {Phase 4 workaround} |
| 7 | pdf.js 生产构建 | — | {PASS/FAIL} | {Phase 3 parser 实现方式} |
| 8 | pptx 文本提取 | — | {PASS/FAIL} | {Phase 3 pptx 支持决策} |
| 9 | Bundle-size 基线 | — | {PASS/FAIL} | {Phase 1 CI gate 基线值} |
| 10 | Sideload checklist | — | {PASS/FAIL} | {Phase 7 sideload 文档优先级} |

---

## GATING 决策

{从 GATING-REPORT.md 摘录三项结论和整体决策}

---

## Phase 1 前置条件确认

以下条件在 PROCEED 时全部满足：

- [ ] GATING #1 CORS：两个 Provider 均允许 browser-origin fetch
- [ ] GATING #2 PPT 写回：主路径或 Plan B 端到端可用
- [ ] GATING #3 存储 scope：三宿主 partitioned localStorage 行为符合预期

PRD 已修正项：
- [ ] PRD F5：RoamingSettings → partitioned localStorage
- [ ] PRD AC6：切 MS 账号行为描述更新为实测行为

---

## Phase 1 设计建议（基于 Spike 结论）

{根据各 spike 结论填写 Phase 1 建议，例如：}

- **pdf.js worker 加载**：使用 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` 模式（Spike #7）
- **pptx 解析**：jszip + DOMParser，无第三方库（Spike #8）
- **PPT API 混用**：单 adapter 只用 PowerPoint.run（Spike #5）
- **getSelectedSlides**：结果按 slide.index 排序（Spike #6）
- **bundle-size CI gate 基线**：{Spike #9 实测值}（raw ≤1MB）
- **DeepSeek 多模态路由**：{Spike #4 结论决定 Phase 2 ProviderRegistry 设计}

---

## Phase 7 REL-05 Regression 使用说明

Phase 7 执行 REL-05 时，请：

1. 打开 `.planning/spikes/MANIFEST.md`
2. 对照 10 行条目，在 v1.0 代码库上重跑每项验证
3. 将新结论填入各 `findings.md` 的"Phase 7 Regression 结果"章节
4. 更新 MANIFEST.md 状态列（PASS/FAIL v1.0）
5. 全部通过 → REL-05 完成；任一 FAIL → 视为 v1.0 回退，修复后再跑

**关键验证场景（最重要的 3 项回归）：**
1. CORS 验证（Spike #1）：生产 Task Pane → DeepSeek + aihubmix 直连
2. PPT 写回（Spike #2）：insertSlidesFromBase64 或 Plan B 端到端
3. 存储 scope（Spike #3）：partitioned localStorage 跨文档共享

---

## 锁定决策归档（D-01 ~ D-12）

{摘录 CONTEXT.md 中每个决策的一行摘要，确认哪些已在 spike 中验证，哪些推迟到后续阶段}

| 决策 | 内容 | spike 验证状态 |
|------|------|--------------|
| D-01 | GitHub Pages 托管 | ✅ Spike #1 前置（Plan 01）|
| D-02 | 仓库 root URL 形态 | ✅ Plan 01 配置 |
| D-03 | main push 自动部署 | ✅ Plan 01 CI |
| D-04 | 严格 gate-first 顺序 | ✅ Wave 结构体现 |
| D-05 | GATING 失败止损 | ✅ Wave 3 checkpoint |
| D-06 | CORS fail → CF Worker | 待定（仅 CORS fail 时生效）|
| D-07 | fallback 连带调整 | 待定（仅 CORS fail 时生效）|
| D-08 | spike 代码丢弃式 | ✅ 所有 spike 在 spike/ 目录 |
| D-09 | 证据归档格式 | ✅ Plan 02 创建结构 |
| D-10 | 全部 commit 公开 | ✅ 所有 spike commit 到 main |
| D-11 | DeepSeek 多模态三步法 | ✅ Spike #4（Plan 07）|
| D-12 | vision routing 推迟 Phase 2 | ✅ findings.md 已记录 |
```
  </action>
  <acceptance_criteria>
    - 文件存在：`ls .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 返回 0
    - 含 10 项 spike 汇总表格：`grep -c '| 1 \|| 2 \|| 3 \|| 4 \|' .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 返回 ≥ 4
    - 含 REL-05 regression 说明：`grep -c 'REL-05\|regression' .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 返回 ≥ 1
    - 含 Phase 1 前置条件确认：`grep -c 'Phase 1 前置' .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 返回 ≥ 1
    - 含决策归档表格（D-01 ~ D-12）：`grep -c 'D-01\|D-12' .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 返回 ≥ 2
  </acceptance_criteria>
  <verify>
    <automated>ls .planning/phases/00-spike-gating/00-PHASE-REPORT.md && grep -c 'REL-05' .planning/phases/00-spike-gating/00-PHASE-REPORT.md</automated>
  </verify>
  <done>00-PHASE-REPORT.md 创建：10 项 spike 汇总表 + GATING 决策 + Phase 1 前置条件 + Phase 1 设计建议 + REL-05 regression 说明 + D-01~D-12 决策归档</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| MANIFEST.md + PHASE-REPORT → public GitHub repo | 摘要文档全部公开，不含 Key |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-11-01 | Repudiation | MANIFEST.md 终稿 | mitigate | 每行条目有 findings.md 链接，结论可追溯；添加完成时间戳 |
| T-00-11-02 | Information Disclosure | PHASE-REPORT | accept | 只含结论和建议，无 Key 或敏感信息 |
</threat_model>

<verification>
整体验证（Wave 5 完成后）：
1. `grep -v '^#\|^$\|---' .planning/spikes/MANIFEST.md | grep -c 'PENDING'` 返回 0
2. `ls .planning/phases/00-spike-gating/00-PHASE-REPORT.md` 存在
3. `grep -c 'PROCEED\|ABORT' .planning/spikes/MANIFEST.md` 返回 ≥ 1
4. Phase 0 所有 10 个 findings.md 首行均非 PENDING
</verification>

<success_criteria>
- MANIFEST.md 终稿：10 行条目全部 PASS/FAIL，GATING 决策记录完整，REL-05 说明已添加
- 00-PHASE-REPORT.md 存在，10 项汇总 + Phase 1 建议 + D-01~D-12 归档
- 全部 spike 代码 + 证据 + MANIFEST 已 commit 到 main（D-10）
- Phase 0 可向 Phase 1 移交（PROCEED 情形）或进入 PRD 修订（ABORT 情形）
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-11-SUMMARY.md`，包含：
- Phase 0 完成状态（PROCEED / ABORT）
- 10 项 spike 最终 PASS/FAIL 计数
- MANIFEST.md 终稿路径
- 00-PHASE-REPORT.md 路径
- 下一步行动（Phase 1 启动 / PRD 修订）
</output>
