---
plan_number: "06"
title: "Wave 3 — GATING 检查点：审阅三项结论，决定 proceed/abort"
phase: 0
wave: 3
depends_on: ["03", "04", "05"]
files_modified:
  - .planning/spikes/GATING-REPORT.md
autonomous: false
requirements: []
estimated_duration: "1 hour"
must_haves:
  goal: "三项 GATING 证据已审阅，GATING-REPORT.md 已写，proceed/abort 决策已明确"
  truths:
    - ".planning/spikes/GATING-REPORT.md 存在"
    - "GATING-REPORT.md 包含三项 GATING（#1 CORS / #2 PPT 写回 / #3 存储 scope）各自的 PASS/FAIL 结论"
    - "GATING-REPORT.md 包含整体决策：PROCEED（进入 Wave 4）或 ABORT（修订 PRD）"
    - "若任一 GATING 为 FAIL，对应的 GATING-FAILED-{N}.md 已存在"
    - ".planning/spikes/MANIFEST.md GATING 决策记录区域已填写"
threat_model:
  threats:
    - id: T-00-06-01
      description: "GATING 结论记录不明确导致后续误判"
      mitigation: "GATING-REPORT.md 格式固定：每项结论必须是明确的 PASS 或 FAIL，整体决策必须是 PROCEED 或 ABORT"
---

<objective>
Wave 3 检查点：人工审阅 GATING #1/#2/#3 证据，生成 GATING-REPORT.md，决定是否进入 Wave 4。

Purpose: D-04/D-05 规定三项 GATING 全 PASS 才启动 Wave 4（Day 3-5 非 gating 7 项）。
任一 FAIL = 当天止损 + 写 GATING-FAILED-{N}.md + 项目进入 PRD 修订状态，不进 Phase 1。

此 plan 是 Wave 3 的唯一 plan，使用 checkpoint 让 execute-phase 在此暂停等用户确认。

Output:
- `.planning/spikes/GATING-REPORT.md`（三项 GATING 汇总 + 整体决策）
- 若任一 FAIL：对应的 `GATING-FAILED-{N}.md`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/spikes/MANIFEST.md
@.planning/spikes/001-cors-verify/findings.md
@.planning/spikes/002-ppt-writeback/findings.md
@.planning/spikes/003-storage-scope/findings.md

决策出处：
- CONTEXT.md §D-04（顺序：GATING 先行）§D-05（GATING 失败止损规则）
- CONTEXT.md §D-06（CORS fail → Cloudflare Worker fallback）
- ROADMAP.md §Phase 0 Success Criteria #1-3（GATING 验收内容）
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1：审阅三项 GATING 证据并输入决策</name>
  <what-built>
    Wave 2 已完成三项 GATING spike：
    - GATING #1 CORS：见 .planning/spikes/001-cors-verify/findings.md
    - GATING #2 PPT 写回：见 .planning/spikes/002-ppt-writeback/findings.md
    - GATING #3 存储 scope：见 .planning/spikes/003-storage-scope/findings.md
  </what-built>
  <how-to-verify>
1. 阅读以下三个 findings.md 的首行和"决策"章节：
   - `.planning/spikes/001-cors-verify/findings.md`
   - `.planning/spikes/002-ppt-writeback/findings.md`
   - `.planning/spikes/003-storage-scope/findings.md`

2. 对照 ROADMAP.md Phase 0 Success Criteria #1-3，判断每项是否满足验收条件

3. 根据结论，决定：
   - 三项全 PASS → 准备输入 "PROCEED"
   - 任一 FAIL → 准备输入 "ABORT: GATING #{N} FAIL — [简述原因]"
  </how-to-verify>
  <resume-signal>
输入以下之一：
- "PROCEED" — 三项 GATING 全部通过，启动 Wave 4
- "ABORT: GATING #1 FAIL — [原因]" — CORS 失败
- "ABORT: GATING #2 FAIL — [原因]" — PPT 写回失败
- "ABORT: GATING #3 FAIL — [原因]" — 存储 scope 失败
  </resume-signal>
</task>

<task type="auto">
  <name>Task 2：写 GATING-REPORT.md（根据 Task 1 用户决策）</name>
  <files>.planning/spikes/GATING-REPORT.md</files>
  <read_first>
    - .planning/spikes/001-cors-verify/findings.md（提取首行结论和关键数据）
    - .planning/spikes/002-ppt-writeback/findings.md（提取首行结论）
    - .planning/spikes/003-storage-scope/findings.md（提取首行结论）
    - .planning/spikes/MANIFEST.md（更新 GATING 决策记录区域）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-05（GATING 止损规则）§D-06（CORS fallback）
  </read_first>
  <action>
根据 Task 1 用户输入的决策，创建 `.planning/spikes/GATING-REPORT.md`：

**若用户输入 "PROCEED"，创建：**
```markdown
# Aster Phase 0 — GATING 报告

**日期：** {今天日期}
**整体决策：** ✅ PROCEED — 三项 GATING 全部通过，启动 Wave 4（非 gating 7 项）

---

## GATING #1 — CORS 验证

**结论：** ✅ PASS

**关键证据：**
- DeepSeek `Access-Control-Allow-Origin`：{从 findings.md 摘录实测值}
- aihubmix `Access-Control-Allow-Origin`：{从 findings.md 摘录实测值}
- 流式 chat completion：{PASS/描述}
- 生图请求：{PASS/描述}

**PRD 影响：** 无 — "无后台"架构可行，无需 D-06 Cloudflare Worker fallback

---

## GATING #2 — PPT for Web 写回

**结论：** ✅ PASS（或 PARTIAL — Plan B 确认可用）

**关键证据：**
- insertSlidesFromBase64（Edge）：{从 findings.md 摘录}
- insertSlidesFromBase64（Chrome）：{从 findings.md 摘录}
- 选中 slide 插图：{从 findings.md 摘录}
- slide 文字替换：{从 findings.md 摘录}
- Plan B setSelectedDataAsync(html)：{从 findings.md 摘录}

**PRD 影响：** {如有降级，描述 Phase 4 PPT-01/02/03 的实现路径调整}

---

## GATING #3 — 存储 scope

**结论：** ✅ PASS

**关键证据：**
- PPT 宿主：文档 A → 文档 B 读取：{从 findings.md 摘录}
- Excel 宿主：{从 findings.md 摘录}
- Word 宿主：{从 findings.md 摘录}
- 跨浏览器（Edge → Chrome）：{从 findings.md 摘录，预期隔离}
- Office.context.partitionKey 实测值：{从 findings.md 摘录}

**PRD 影响：** PRD F5 存储 API 已修正为 partitioned localStorage；PRD AC6 描述更新为：
"换浏览器或清除浏览器数据 → Key 丢失；同一浏览器内 MS 账号切换 → Key 保留"

---

## 下一步

三项 GATING 全 PASS → 进入 Wave 4（Day 3-5）：

| Plan | Spike | 说明 |
|------|-------|------|
| 00-07 | #4 DeepSeek 多模态 | 非 GATING，FAIL 时锁定 aihubmix |
| 00-08 | #5+#6 API 混用 + getSelectedSlides 反序 | 非 GATING，记录 workaround |
| 00-09 | #7+#8 pdf.js 生产构建 + pptx 文本提取 | 非 GATING |
| 00-10 | #9+#10 bundle-size + sideload | 非 GATING |
```

**若用户输入 "ABORT: GATING #{N} FAIL"，创建：**
```markdown
# Aster Phase 0 — GATING 报告

**日期：** {今天日期}
**整体决策：** ❌ ABORT — GATING #{N} 失败，项目进入 PRD 修订状态

Wave 4 不启动。下一步：修订 PRD，评估 fallback 路径，再决策是否重跑 spike。

---

## GATING #{N} — {名称}

**结论：** ❌ FAIL

**失败描述：** {从用户输入提取原因}

**影响范围：** {描述 PRD 哪些假设需要重新评估}

**已知 fallback（若适用）：**
{对 GATING #1 CORS fail：D-06 Cloudflare Worker 代理路线}
{对 GATING #2 PPT fail：Plan B setSelectedDataAsync / 降级场景数}
{对 GATING #3 storage fail：待评估}

---

## 其余 GATING 项状态

{列出其他两项的结论，如已通过则标注}

---

## 后续行动

1. 写 GATING-FAILED-{N}.md（详细现象 / 已尝试 / Plan B / PRD scope 影响）
2. 项目进入 PRD 修订状态
3. **不进 Phase 1**，直到 PRD 修订完成并获得批准
```

**同时更新 .planning/spikes/MANIFEST.md 的 GATING 决策记录区域**：
- 根据实际结论填写三行结果（PASS/FAIL）
- 整体结论填写 PROCEED 或 ABORT

**若为 ABORT，同时创建 GATING-FAILED-{N}.md**（模板）：
```markdown
# GATING #{N} 失败决策备忘 — {日期}

## 现象

{具体描述失败现象，包括浏览器版本、错误信息等}

## 已尝试

{记录在 spike 中尝试过的方法}

## Plan B 评估

{对应的已知 fallback 路径描述}

## PRD scope 影响

{列出 PRD 哪些功能假设需要修订}

## 结论

项目进入 PRD 修订状态。不进 Phase 1。
修订完成后需要：□ 重新评估架构  □ 可能重跑本 spike  □ 更新 MANIFEST
```
  </action>
  <acceptance_criteria>
    - 文件存在：`ls .planning/spikes/GATING-REPORT.md` 返回 0
    - 含整体决策：`grep -c 'PROCEED\|ABORT' .planning/spikes/GATING-REPORT.md` 返回 ≥ 1
    - 含三项 GATING 各自结论：`grep -c 'GATING #1\|GATING #2\|GATING #3' .planning/spikes/GATING-REPORT.md` 返回 ≥ 3
    - MANIFEST.md GATING 记录区已更新（非 "—"）：`grep -v '^#' .planning/spikes/MANIFEST.md | grep -c 'PASS\|FAIL\|PROCEED\|ABORT'` 返回 ≥ 1
    - 若 ABORT：对应 GATING-FAILED-{N}.md 存在：`ls .planning/spikes/GATING-FAILED-*.md 2>/dev/null | wc -l` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>ls .planning/spikes/GATING-REPORT.md && grep -c 'PROCEED\|ABORT' .planning/spikes/GATING-REPORT.md</automated>
  </verify>
  <done>GATING-REPORT.md 存在，含三项各自结论和整体 PROCEED/ABORT 决策；MANIFEST.md 已更新；如 ABORT 则 GATING-FAILED-{N}.md 已创建</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User decision → Wave 4 unlock | 整体 GATING 决策只由用户人工审阅后输入 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-06-01 | Repudiation | GATING-REPORT.md | mitigate | 报告包含日期 + 来源 findings.md 引用，决策可审计 |
| T-00-06-02 | Tampering | Wave 4 启动条件 | mitigate | Wave 4 plans 的 depends_on 列出 "06"；Wave 3 checkpoint 不 approve 则 Wave 4 不执行 |
</threat_model>

<verification>
整体验证（Wave 3 完成后）：
1. `ls .planning/spikes/GATING-REPORT.md` 存在
2. `grep 'PROCEED\|ABORT' .planning/spikes/GATING-REPORT.md` 有输出
3. 若 PROCEED：`grep 'PROCEED' .planning/spikes/GATING-REPORT.md` 有输出，Wave 4 可启动
4. 若 ABORT：`ls .planning/spikes/GATING-FAILED-*.md` 有文件
</verification>

<success_criteria>
- GATING-REPORT.md 存在，三项 GATING 各有明确 PASS/FAIL
- MANIFEST.md GATING 决策区已填写
- PROCEED 情形：Wave 4 plans（00-07 至 00-10）可启动执行
- ABORT 情形：GATING-FAILED-{N}.md 已创建，项目进入 PRD 修订状态
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-06-SUMMARY.md`，包含：
- 整体 GATING 决策（PROCEED / ABORT）
- 三项 GATING 各自结论摘要
- 下一步行动（Wave 4 启动路径或 PRD 修订路径）
</output>
