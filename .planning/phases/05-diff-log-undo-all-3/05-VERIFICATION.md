---
phase: 05-diff-log-undo-all-3
verified: 2026-05-30T00:00:00Z
status: passed
score: 7/7 must-have truth groups verified (human UAT)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: "UAT round-1: 4 SC fail (SC1a/SC1b/SC3/SC4)"
human_verification: []
requirements_verified:
  - AGENT-07
  - AGENT-09
  - AGENT-10
  - AGENT-11
  - TOOL-03
  - TOOL-04
  - CARRY-03
  - NFR-05
notes:
  - "三宿主真机 UAT 由用户在真实 Office for Web 逐项验收 PASS（SC1-SC6）；verifier 无法重跑真实 Office 宿主，采信用户记录。"
  - "Round-1 UAT 发现 4 类 gap（Word inverse 签名错配 / PPT 标题未写入 / 手改侦测失效 / DiffLogPanel 单步撤销串状态），经 6 个原子 commit 修复后 Round-2/3 复测全 PASS。"
  - "SC5 Settings 入口按用户要求移除（InputBar 已有等同复制能力，去重），不计为缺失。"
  - "测试 527 passed / 3 errors：errors 为 src/providers/retry.test.ts 预存在 flaky（单跑 9/9 PASS），本 phase 未改 src/providers/，确认非回归。"
  - "新增两道结构性守门（operationLog.integration.test.ts 真 adapter × replay；loop.test.ts 唯一 stepIndex 端到端），堵「单测绿真机挂」盲区复发。"
  - "手改侦测只实现 Word readWordParagraph；Excel/PPT 保守 undefined 路径（postState 形状与比对规则不匹配，加 read 方法会误判全部手改、打破 SC1c）。"
  - "线上 HEAD = d68303b，GitHub Pages 部署成功。"
---

# Phase 05: Diff Log + Undo All 跨 3 宿主 Verification Report

**Phase Goal:** 在 Phase 3 OperationLog 骨架上建成跨 PowerPoint/Excel/Word 三宿主的「本次改动汇总
+ 逆操作撤销」能力——OperationLog（Map<runId>）+ inverse op + replay engine + DiffLogPanel 汇总卡
（humanLabel 中文人话）+ per-step 任意顺序撤销 + undo all + 用户手动改防御（三态）+ copy step log
脱敏。为 Phase 6 大规模 destructive write tools 提供 undo 兜底。

## Must-Have 真相组（7/7 verified — 真机 UAT）

| # | 真相 | 结果 | 证据 |
|---|------|------|------|
| SC1 | 三宿主 inverse 闭环（Word append→撤 / PPT insert_slide→撤 / Excel set_range_values→撤） | ✅ PASS | 用户真机 Round-3：SC1a/SC1b/SC1c 三条均 PASS |
| SC2 | DiffLogPanel 汇总卡「本次改动 N 处」+ 中文 humanLabel + 折叠展开 | ✅ PASS | 用户真机 Round-1 即 PASS |
| SC3 | undo all + 手改防御：写 5 改 1 → 4 回滚 + 1 跳过 + 三态总结 modal | ✅ PASS | 用户真机 Round-2 PASS（readWordParagraph 修复后） |
| SC4 | per-step 任意顺序单步撤销，行变删除线，正确回滚 | ✅ PASS | 用户真机 Round-3 PASS（唯一 stepIndex 修复后 UI 正常） |
| SC5 | copy step log 入口可用且脱敏（Settings 入口按用户要求移除，主界面 InputBar 保留） | ✅ PASS | 用户真机 PASS；SC5 移除为 UX 去重决策 |
| SC6 | copy step log 含三角色 + humanLabel + 无 API Key（sk-*） | ✅ PASS | 用户真机 PASS |
| 门禁 | npm test 全 pass + build + size ≤82KB | ✅ PASS | 527 passed；build OK；80.26 KB ≤ 82 KB |

## 需求覆盖（PLAN frontmatter requirements）

| Req | 说明 | 状态 |
|-----|------|------|
| AGENT-07 | OperationLog 记录每步写操作 | ✅（Map<runId> + appendOperation，唯一 stepIndex） |
| AGENT-09 | 用户手动改防御（D-11） | ✅（readWordParagraph 真机生效，SC3 跳过手改） |
| AGENT-10 | inverse op 逆操作撤销 | ✅（三宿主 inverse 真机闭环） |
| AGENT-11 | per-step + undo all replay | ✅（replayUndoSingle/replayUndoAll 真机 PASS） |
| TOOL-03 | 三宿主 write tool inverse PoC | ✅（Word/PPT/Excel 各一，真机闭环） |
| TOOL-04 | postState 快照供手改对比 | ✅（write tools 透传 postState） |
| CARRY-03 | copy step log 双入口 → 收敛单入口（InputBar） | ✅（脱敏，无 sk-*） |
| NFR-05 | DiffLogPanel 懒加载不进 main chunk | ✅（DiffLogPanel-*.js / copyStepLog-*.js 独立 chunk） |

## Gap 修复审计（Round-1 → Round-3）

详见 `05-10-SUMMARY.md`。6 个原子 commit：`cf191d7`（Word 签名）/ `928668f`（readWordParagraph）/
`eb3c6a6`（SC5 移除）/ `f7f3493`（PPT 写标题）/ `668422c`（集成守门）/ `d68303b`（唯一 stepIndex）。

## 结论

Phase 5 目标达成：跨三宿主的 Diff Log + Undo All 全链路在真实 Office for Web 验证 PASS，
两道结构性守门到位。**status: passed**。可进 Phase 6（多宿主 write tools + killer scenarios），
undo 兜底已就位（满足「Phase 5 undo 必须先于 Phase 6 destructive write」硬约束）。
