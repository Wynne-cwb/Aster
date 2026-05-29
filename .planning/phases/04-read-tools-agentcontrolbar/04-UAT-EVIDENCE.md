---
status: blocked
blocked_on: user (需真机 — M365 登录 + 三宿主文档 + DeepSeek API Key + push 部署)
phase: 04-read-tools-agentcontrolbar
plan: 09
source: [04-09-PLAN.md]
started: "2026-05-29"
updated: "2026-05-29"
---

# Phase 4 真机 UAT 证据 — BLOCKED ON USER（需真机）

> **执行状态说明（executor，用户不在场）**
> Plan 04-09 是 `autonomous: false` checkpoint，分两部分：
> 1. **Task 1（部分可自跑）**——代码门禁已自跑验证通过（见下「门禁结果」）；但 **push 触发 GitHub Pages 部署未执行**（团队约定：真机 UAT 未过之前不 push；用户 `push_before_deploy_claims` 记忆 = 不擅自 push）。
> 2. **Task 2（不可自跑）**——三宿主真机 UAT，需用户在场（M365 登录、三宿主真实文档、DeepSeek Key、真宿主 Office.js 行为 + 折叠卡渲染 + 时序 UI）。**未执行，未伪造结果。**
>
> 因此 Phase 4 **未标记 complete**。Wave 1-4（Plan 01-08，8/9 plan）全部自跑完成并通过门禁；Plan 09 停在此 checkpoint，等用户在场后：push 部署 → 三宿主真机跑 SC1/2/3/5/6 → 回填本文件证据。

## 门禁结果（executor 自跑，2026-05-29）

| 门禁 | 命令 | 结果 |
|------|------|------|
| 单测 + tsc | `npm run test -- --run` | 440 passed / 1 failed —— 唯一失败 = `src/agent/loop.test.ts` AGENT-02 soft-landing，**Phase 3 预存在**（Phase 4 起始前即失败，本 phase 未触碰 soft-landing 行为，无新增失败） |
| 构建 | `npm run build` | exit 0，通过 |
| Bundle 预算 | `npm run size` | **79.09 KB gzipped ≤ 80 KB gate**（通过）。注：Plan 07/08 一度推到 80.67 KB 超限，已由 `perf(04): lazy-load host adapters`（commit `ad6d42b`）把三宿主 adapter 改 dynamic import 拆 lazy chunk 回收，main chunk 降回 79.09 KB |
| 净新增依赖 | — | 0（符合硬约束） |

## 待真机验收 SC（全部 pending — 需用户在场）

| SC | 宿主 | 验证内容 | 状态 | 证据 |
|----|------|----------|------|------|
| SC1 | PPT | 复合 demo：list_slides→get_slide read 链路，折叠卡中文人话 | ⏳ pending（需真机） | — |
| SC2-Word | Word | 「数几段 + 读第 3 段」get_paragraph_count + get_paragraph_at 折叠卡 | ⏳ pending（需真机） | — |
| SC2-Excel | Excel | used range 概况 + 前 20 行；**A-24 >10K cells 读前拒绝不爆 tab** | ⏳ pending（需真机） | — |
| SC2-PPT | PPT | 列出全部 slide 标题（list_slides，顺序正确无反序） | ⏳ pending（需真机） | — |
| SC3 | 任一 | AgentControlBar 三态差异化文案 + 5 秒安抚行 | ⏳ pending（需真机） | — |
| SC5 | 任一 | circuit 熔断「Agent gave up」红卡 + 重新试试，无撤销本次 | ⏳ pending（需真机） | — |
| SC6 | 任一 | 内置 Provider model = select / 自定义 = input | ⏳ pending（需真机） | — |

## 用户在场后的续跑步骤

1. 确认本地 Phase 4 commit（见 STATE「Current Position」）→ `git push origin main` 触发 GitHub Pages 部署，记录 commit hash + 部署状态。
2. 按 `.claude/skills/office-addin-browser-uat/SKILL.md`，三宿主各 sideload 已部署版本，跑上表 SC1/2/3/5/6。
3. 每条标 PASS / issue，回填本文件（步数 + 截图/录屏路径）。
4. 全 PASS → 创建 `04-09-SUMMARY.md` + 走 phase 完成流程（verify + phase.complete）；有 issue → `/gsd-plan-phase 04 --gaps`。
