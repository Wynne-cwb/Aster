---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: 登陆 WPS（滩头堡）
status: Phase 30 探针已部署上线 — 待用户 Windows WPS 真机 go/no-go
stopped_at: "Phase 30 探针 + 真机清单全部就绪，Lead 验证通过（含修复 Excel B1 快照还原防清空用户数据），已 push origin/main @6100b9b，Pages 部署完成。探针线上实测可达：https://wynne-cwb.github.io/Aster/wps-probe/（4 URL 全 200，probe.js 为 B1 修复版）。下一步=用户照 30-REAL-MACHINE-CHECKLIST.md 在 Windows WPS 真机跑 → 复制结果报告回贴 → Claude 出 go/no-go 裁定 + 首宿主数据。"
last_updated: "2026-06-08T09:35:00.000Z"
last_activity: 2026-06-08 -- Phase 30 探针已部署上线（push @6100b9b + Pages deploy + URL 实测 200），待用户真机 go/no-go
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 3
  completed_plans: 3
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08 — v2.5「登陆 WPS（滩头堡）」started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** **v2.5「登陆 WPS（滩头堡）」进行中**。证据优先分阶段：**Phase 30 = 真机验证硬门（go/no-go）**，两条 make-or-break 串行（① CEF/React19 → ② DeepSeek SSE 直连不被 WPS CSP/CORS 拦截），任一挂 → no-go，里程碑停在 Phase 30。通过则建单宿主滩头堡（Phases 31–33：wpsjs 外壳 + 复用层坐实 + 单宿主 adapter + killer scenario）。三宿主完整移植 = 后续独立 milestone（WPS-D1）。

## Current Position

Phase: 30（WPS-02/03 真机验证探针——硬门）
Plan: 3 plans 全 execute 完成 + Lead 修复（Excel B1 快照还原）+ 已 push 部署上线
Status: 探针已部署上线·待真机 go/no-go —— 线上实测可达，go/no-go 裁定需用户在 Windows WPS 真机跑探针后回贴报告
Last activity: 2026-06-08 -- Phase 30 探针部署上线（push @6100b9b + Pages deploy + URL 200 实测）

Progress: [░░░░░░░░░░] 0%（4 phases，0 完成；Phase 30 三 plan 已执行，go/no-go 裁定待真机）

### v2.5 Phase 概览

| Phase | 名称 | 需求 | 状态 |
|-------|------|------|------|
| 30 | WPS-02/03 真机验证探针（**硬门**） | WPS-02, WPS-03 | 探针已部署上线·待用户真机 go/no-go（3/3 plan + B1 修复，已 push @6100b9b） |
| 31 | wpsjs 外壳 + 宿主识别 + 复用层 CEF 坐实 | WPS-04, WPS-05, WPS-06 | Not started（条件：Phase 30 = go） |
| 32 | 单宿主 adapter read/write + operationLog 移植 | WPS-07, WPS-08 | Not started（条件：go；首宿主待裁定） |
| 33 | killer scenario 端到端 + 诚实收口 | WPS-09, WPS-10 | Not started（条件：go） |

### v2.4 交付回顾（上里程碑 baseline；详见 MILESTONES.md §v2.4 / milestones/v2.4-ROADMAP.md）

| Phase | 交付 | 状态 |
|-------|------|------|
| 25 WPS spike-gate | WPS-01 调研报告 + 真机清单 | ✅（WPS-02 真机层 ⏸️ 延后） |
| 26 配置导入导出 | 明文 JSON 导出/导入 + 醒目警告 + 同 id 覆盖确认（CFG-01~03） | ✅ 北极星真机坐实 |
| 27 Word 工具补全 | 高亮/列表/批注/页眉页脚/表格单元格 5 write tool（WORD-06~10） | ✅ |
| 28 Excel 工具补全 | 合并/删重(全列语义)/透视表 3 write tool（EXCEL-11~13） | ✅ HR-01/02 真机过 |
| 29 PPT 工具补全 + NFR-12 | 插表(原生 addTable)/线条/渐变降级 3 write tool + bundle 收口（PPT-09~11, NFR-12） | ✅ 原生表格真机生效 |

## Performance Metrics

**v2.5 基准（本里程碑）:** WPS 滩头堡产物为独立加载项工程（`wpsjs` 项目 / WPS JSAPI adapter），与 Office.js 主工程 bundle/test 基准**不直接可比**——新基准随 Phase 30-31 完成后确定。如 no-go，里程碑无新代码产物。
**v2.4 基准（上里程碑）:** 5 phases / 12 plans / 本机 82.48KB（线上 80.03KB）bundle ≤100KB gate / 1137 tests green / 16/17 需求交付（WPS-02 真机层延后）。
**v2.3 基准:** 5 phases / 10 plans / 81.3 KB bundle / 1075 tests / 13/13 需求交付。

## Accumulated Context

### Decisions

里程碑级决策全量见 PROJECT.md「Key Decisions」+ MILESTONES.md §v2.4。v2.5 关键前置约束：

- **WPS = 平行铁轨**（v2.4 WPS-01 结论）：现有 `office.js`/`*.run` 代码不能 sideload 即用，上 WPS = 新外壳/宿主识别/adapter 按 WPS JSAPI 重写，非增量补全。
- **证据优先分阶段**：Phase 30 = 硬门，未绿不写任何适配代码；Phases 31–33 全部以「验证 = go」为前提。
- **真机分工**：Claude 在 Mac 开发探针代码 + 写验证清单；WPS 真机步骤只能用户在 Windows WPS 桌面专业版上跑（同 Office for Web 真机 UAT 分工）。
- **首宿主开放决策**：Excel vs PPT 待 Phase 30 真机数据 + discuss-phase 裁定，Phase 32 开工前锁定。裁定原则：若 Phase 30 探测中 PPT `Shapes.AddTable`/`AddLine`/`copy_slide` ≥2 项通过，倾向 PPT；否则倾向 Excel（JSAPI 15 核心操作全有文档路径）。
- **UNDO 裁定**（FEATURES 多源确认）：WPS JSAPI 写操作不进原生 Ctrl+Z 撤销栈，`Application.Undo()` 未暴露，`undoRecord` 批 API 已知 bug（2025-11-25 WPS 官方 bbs 承认）。Aster `operationLog` 反向引擎必须完整移植，inverse 收 Record 对象签名（Phase 5 教训沿用）。
- **no-go 路径**：若 make-or-break 挂（CEF 版本过旧 or WPS 容器拦直连），里程碑干净收口在 Phase 30，不写任何 adapter 代码；Cloudflare Worker 仅作显式 fail 决策项（同 v2.2 M-1 处置方式，不静默上后台）。
- [P26 bundle gate 2026-06-05]: **bundle 硬门 ≤100KB**（2026-06-05 永久上调自 82KB）；重模块懒加载纪律不变；WPS 入口 bundle 独立核算。
- [Node 22]: 测试/构建必须用 Node 22（jsdom@29.1.1 要求 Node ≥20.19）。

### Pending Todos

- **WR-02**（low）— `visual_check_slide` 的 `slideIndex` 入参 required 但实现忽略；`todos/pending/wr-02-visual-check-slideindex.md`（含 IN-02 + wrapReadResult 顺带项）
- **WR-03**（low）— `SlidePreviewPanel` 卸载无条件重置全局 getter，缺 identity 守卫；`todos/pending/wr-03-preview-getter-identity-guard.md`
- 两者同源（Phase 24 review），当前不阻塞，下次动 PPT 视觉自查时一起修。

### Blockers/Concerns

- **Phase 30 真机验证 = 唯一当前阻断项**：探针已部署上线（push @6100b9b + Pages deploy，URL 实测 200 可 sideload），但两条 make-or-break 结果仍未知（CEF 版本 / WPS 容器 CSP），直到用户在 Windows WPS 真机跑完探针、回贴结果报告才能解除。**球在用户侧**：照 `.planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md` 跑。
- **首宿主决策挂起**：Excel vs PPT 开放，Phase 30 数据到来前不可提前承诺。

## Deferred Items

### 前瞻性 deferred（非陈旧，留后续里程碑）

| Category | Item | Status |
|----------|------|--------|
| WPS 后续 | WPS-D1 三宿主完整移植（~50+ 方法，三宿主对齐） | 待 v2.5 单宿主滩头堡坐实后独立 milestone |
| WPS 后续 | WPS-D2 WPS 网页版/移动版形态评估 | 后续评估 |
| 配置增强 | CFG-D1 口令加密导出 / CFG-D2 字符串载体 / CFG-D3 选择性导出 | 按需 |
| v2.3 follow-up | WR-02 visual_check_slide slideIndex 忽略 / WR-03 多预览面板 identity 守卫 | 活跃 todo，下次动 PPT 视觉自查时修 |
| C 工具 | 三宿主剩余 ~25 候选 write tool | 后续 milestone triage |

## Session Continuity

Last session: 2026-06-08（team-lead — Phase 30 discuss→plan→execute→fix→deploy 全自动跑完）
Stopped at: Phase 30 探针已部署上线（@6100b9b，Pages deploy，URL 实测 200）。球在用户侧：照 30-REAL-MACHINE-CHECKLIST.md 在 Windows WPS 真机跑 → 复制结果报告回贴 → Claude 出 go/no-go 裁定 + 首宿主（Excel vs PPT）数据。go → Phases 31-33；no-go → 里程碑干净收口在 30。
Resume file: .planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md
