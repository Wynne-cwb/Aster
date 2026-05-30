---
phase: "05"
plan: "10"
subsystem: "uat-three-host"
tags: ["uat", "checkpoint", "human-verify", "gap-fix", "diff-log", "undo", "inverse-op"]
dependency_graph:
  requires:
    - "05-01..05-09: OperationLog + inverse ops + DiffLogPanel + copy step log 全部代码层完成"
  provides:
    - "三宿主真机 UAT PASS 记录（SC1-SC6）"
    - "05-VERIFICATION.md: Phase 5 完整验证报告"
  affects:
    - "src/adapters/WordAdapter.ts: deleteParagraphByContent 收对象参数 + readWordParagraph 新增"
    - "src/adapters/PptAdapter.ts: insertSlideAfter 真正写标题 + deleteSlideByTitle 跳过空形状"
    - "src/components/Settings/SettingsPanel.tsx: 移除「复制本次操作记录」按钮"
    - "src/agent/loop-helpers.ts: write op 唯一 stepIndex"
tech_stack:
  added: []
status: complete
human_uat: pass
gates:
  test: "527 passed (44 files)；3 errors = retry.test.ts 预存在 flaky（单跑 9/9 PASS，非本 phase 回归）"
  build: "ok"
  size: "80.26 KB gzip ≤ 82 KB"
deployed_head: d68303b
deploy_url: "https://wynne-cwb.github.io/Aster/"
---

# Phase 05 Plan 10 — 三宿主真机 UAT（最终 checkpoint）

## 概述

Wave 6 最终 checkpoint：在真实 Office for Web（PowerPoint / Excel / Word）验收 Phase 5
全部 6 个 SC。这是 `autonomous: false` 的人工验收环节——自动化门禁由 Claude 跑，真机
inverse 闭环 / undo all / copy step log 由用户在真机逐项验收。

**结果：经两轮 UAT + 一轮 UI 修复，全部 6 个 SC PASS。**

## UAT 过程（3 轮）

### Round 1 — 发现 4 类 gap
| SC | 结果 | 根因 |
|----|------|------|
| SC1a Word inverse | ✗ 撤销「宿主 API 报错」 | WordAdapter.deleteParagraphByContent 位置签名 `(text: string)` 收到 replay 传来的对象 `{text}` → normalizeText 对对象调 .replace 抛 TypeError |
| SC1b PPT inverse | ✗ 标题没设上 + 撤销失败 | insertSlideAfter 忽略 `_title`（旧 PoC 未写入），新 slide 无标题 → deleteSlideByTitle 指纹对不上 |
| SC1c Excel inverse | ✓ PASS | overwriteRange 本就是对象签名 |
| SC2 汇总卡 humanLabel | ✓ PASS | |
| SC3 undo all + 手改防御 | ✗ | 同 SC1a（Word 步骤全挂）+ 三宿主都没实现 readXxx → 手改侦测失效 |
| SC4 per-step 任意顺序 | ✗ | 同 SC1a |
| SC5 Settings 入口 | ✓（用户要求移除，去重） | InputBar 已有复制能力 |
| SC6 copy step log 脱敏 | ✓ PASS | |

### Round 2 — gap 修复后复测
SC1a / SC1b / SC1c / SC3 / SC5 全 PASS；SC4 暴露 UI 串状态 bug：撤销第 1 步，第 2/3 步也显示「已撤销」。

### Round 3 — UI 修复后复测
SC1a / SC4 UI 正常（单步只标单行）→ **全部 6 个 SC PASS**。

## Gap 修复（6 个原子 commit）

| commit | 类型 | 修复 |
|--------|------|------|
| `cf191d7` | BUG-1 | WordAdapter.deleteParagraphByContent 改收 `args: Record<string, unknown>`（解签名错配，SC1a/SC4/SC3 根因） |
| `928668f` | BUG-3 | WordAdapter.readWordParagraph 实现 → D-11 手改侦测真机生效（SC3「跳过手改」） |
| `eb3c6a6` | UX-1 | 移除 SettingsPanel「复制本次操作记录」按钮 + lingui clean（SC5 去重，110→108） |
| `f7f3493` | BUG-2 | PptAdapter.insertSlideAfter 用 addTextBox 真正写标题 + deleteSlideByTitle 改「第一个非空文本形状」匹配（SC1b） |
| `668422c` | GATE | replay engine × 真 adapter 集成测试（堵签名错配复发） |
| `d68303b` | UI-BUG | loop-helpers write op 唯一 stepIndex（解 DiffLogPanel 单步撤销串状态，SC1a/SC4 UI） |

## 关键决策

- **手改侦测只实现 Word readWordParagraph**：不给 Excel/PPT 加 readExcelRange/readPptSlideTitle——
  其 postState 形状（excel = `{address,values}` 对象 vs 读回 values 数组）与
  `isTargetStateConsistent` 比对规则不匹配，加了会误判全部手改、打破已 PASS 的 SC1c。保守
  undefined 路径（read 方法不存在 → 视为一致）是 SC1c/SC1b 能跑的正确行为。
- **PPT 标题用 addTextBox 而非 title placeholder**：新建空白 slide 的 placeholder 在 Web 端
  不保证可写；addTextBox 是可靠路径。⚠ addTextBox 在 Web 端生效已经 Round-2 真机 SC1b PASS 验证。
- **stepIndex 语义修正**：从「agent loop step」改为「write op 唯一递增序号」——DiffLogPanel 用它当
  React key + per-step state 键，必须按 op 唯一（同一轮常连调多个 write tool）。

## 结构性守门（防复发）

按 `feedback_recurring_failure_add_gate`，针对「单测全绿但真机挂」的两个盲区各加守门：
1. `src/agent/operationLog.integration.test.ts`：用真 WordAdapter/ExcelAdapter/PptAdapter 实例
   （非 mock）跑 replay engine，断言 reverse.args 对象签名被正确消费 + SC3 端到端（4 回滚 + 1 跳过手改）。
2. `src/agent/loop.test.ts`：一轮发 3 个 append_paragraph，断言 stepIndex `[0,1,2]` 唯一（旧代码 `[1,1,1]`）。

## 门禁

- `npm test`：44 文件 / 527 用例全 pass（3 errors = retry.test.ts 预存在 flaky，单跑 9/9）
- `npm run build`：OK（DiffLogPanel/copyStepLog 懒加载未进 main chunk）
- `npm run size`：80.26 KB gzip ≤ 82 KB
- 部署：`d68303b` 已 push，GitHub Pages 部署成功

## Self-Check: PASSED
