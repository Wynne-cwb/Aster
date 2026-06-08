---
gsd_state_version: 1.0
milestone: v2.5
milestone_name: 登陆 WPS（滩头堡）
status: defining requirements — v2.5「登陆 WPS（滩头堡）」started（/gsd-new-milestone，2026-06-08）
stopped_at: "v2.5「登陆 WPS（滩头堡）」起步：PROJECT.md + STATE.md 已更新。前提变化——用户已装 WPS Windows 桌面专业版，WPS-02 真机验证解锁。证据优先分阶段（WPS-02 真机验证硬门 → 通过则建单宿主滩头堡）。下一步：定义 REQUIREMENTS.md + roadmap（phase 从 30 续接）。"
last_updated: "2026-06-08T06:00:00.000Z"
last_activity: 2026-06-08 -- v2.5 启动（new-milestone）：更新 PROJECT/STATE，待定义 requirements + roadmap
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-08 — v2.5「登陆 WPS（滩头堡）」started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** **v2.5「登陆 WPS（滩头堡）」进行中**。用户已装 WPS Windows 桌面专业版 → WPS-02 真机验证解锁。证据优先分阶段：WPS-02 真机验证（硬门，照 `25-WPS-01-REPORT.md` §5 清单）→ 通过则建单宿主滩头堡（`wpsjs` 外壳 + 1 宿主 read/write/undo + 复用层 CEF 内坐实）。三宿主完整移植 = 后续独立 milestone（WPS-D1）。

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements — v2.5 started。phase 编号将从 30 续接（不 reset）。WPS = 平行铁轨非增量补全（现有 office.js/`*.run` 不能 sideload 即用）；真机验证只能用户在 Windows WPS 上跑（Claude 在 Mac 开发）。
Last activity: 2026-06-08 — Milestone v2.5 started（new-milestone）

Progress: [░░░░░░░░░░] 0%（v2.5 定义需求中）

### v2.4 交付回顾（上里程碑 baseline；详见 MILESTONES.md §v2.4 / milestones/v2.4-ROADMAP.md）

| Phase | 交付 | 状态 |
|-------|------|------|
| 25 WPS spike-gate | WPS-01 调研报告 + 真机清单 | ✅（WPS-02 真机层 ⏸️ 延后） |
| 26 配置导入导出 | 明文 JSON 导出/导入 + 醒目警告 + 同 id 覆盖确认（CFG-01~03） | ✅ 北极星真机坐实 |
| 27 Word 工具补全 | 高亮/列表/批注/页眉页脚/表格单元格 5 write tool（WORD-06~10） | ✅ |
| 28 Excel 工具补全 | 合并/删重(全列语义)/透视表 3 write tool（EXCEL-11~13） | ✅ HR-01/02 真机过 |
| 29 PPT 工具补全 + NFR-12 | 插表(原生 addTable)/线条/渐变降级 3 write tool + bundle 收口（PPT-09~11, NFR-12） | ✅ 原生表格真机生效 |

## Performance Metrics

**v2.5 基准（本里程碑）:** 待定（roadmap 后填）。⚠️ 本里程碑 WPS 滩头堡产物大概率是**独立加载项工程**（`wpsjs` 项目 / WPS JSAPI adapter），与 Office.js 主工程的 bundle/test 基准**不直接可比**——新基准随 roadmap 确定。
**v2.4 基准（上里程碑）:** 5 phases / 12 plans / 本机 82.48KB（线上 80.03KB）bundle ≤100KB gate / 1137 tests green / 16/17 需求交付（WPS-02 真机层延后）。
**v2.3 基准:** 5 phases / 10 plans / 81.3 KB bundle / 1075 tests / 13/13 需求交付。

## Accumulated Context

### Decisions

里程碑级决策全量见 PROJECT.md「Key Decisions」+ MILESTONES.md §v2.4。v2.4 关键拍板留底：

- [P26 bundle gate 2026-06-05]: **bundle 硬门 82KB → 100KB 永久上调**（CFG-03 合规警告进 boot i18n catalog 撞旧门 → 用户选永久放宽给 C 工具+配置余量）。已对齐 `.size-limit.json` + REQUIREMENTS NFR-12 + ROADMAP + memory `project_bundle_size_guard` + ci.yml。重模块懒加载纪律不变；仍 ≪ PRD「初始 JS ≤1MB」。线上实测 80.03KB（PASS）。
- [P25 D-01 2026-06-05]: 用户**当前无 Windows 环境** → Phase 25 只交付 WPS-01；WPS-02 真机层异步延后（go 阈值=三宿主全绿；初步信号「WPS ≠ 装插件即用」，上 WPS = 独立 milestone 级移植）。
- [v2.4 工具合约]: 新 write 工具 inverse 收 **Record 对象** + 新 PostStateSnapshot kind + 中文 humanLabel + `operationLog.integration.test` 守门 + 入 `*_TOOLS` Set；Word 既有 camelCase 无需新建 set；PPT setShapeGradientTool 复用 setShapeProperty（0 新 adapter 方法）。
- [Node 22]: 测试/构建必须用 Node 22（jsdom@29.1.1 要求 Node ≥20.19）。

### Pending Todos

- **WR-02**（low）— `visual_check_slide` 的 `slideIndex` 入参 required 但实现忽略；`todos/pending/wr-02-visual-check-slideindex.md`（含 IN-02 + wrapReadResult 顺带项）
- **WR-03**（low）— `SlidePreviewPanel` 卸载无条件重置全局 getter，缺 identity 守卫；`todos/pending/wr-03-preview-getter-identity-guard.md`
- 两者同源（Phase 24 review，同 `visual-check.ts`），可合并一个 quick task；当前不阻塞，下个 milestone 动 PPT 视觉自查时一起修。

### Blockers/Concerns

- **WPS-02 真机层 ⏸️ 异步挂起**（非阻塞，设计内延后）：用户有 Windows+WPS 环境时照 `25-WPS-01-REPORT.md` §真机清单自测 → go/no-go 裁定；go 则 WPS 完整适配=独立 milestone（WPS-D1）。
- v2.4 期间的 API 风险项（EXCEL-13 透视表 / PPT-09/10/11）**已在真机 UAT 全部坐实**（透视表能建、PPT-09 原生表格生效、PPT-10/11 诚实降级）——不再是 blocker。

## Deferred Items

### v2.4 收官 artifact audit acknowledged（2026-06-08，25 项，0 真正未完成）

开档前 `audit-open` 扫出 25 个 open items，逐项核实**全为已 ship 旧里程碑（v2.0–v2.3）陈旧簿记或已被后续 UAT 覆盖，v2.4 自身 0 个 open item**。用户 Acknowledge all 放行（第 6 次复发同一 stale-bookkeeping 模式，详见 MILESTONES.md §v2.4）。

| Category | 数量 | 核实结论 | Deferred At |
|----------|------|----------|-------------|
| debug_sessions | 2 | `ppt-list-slides-host-fail` / `reasoning-content-roundtrip`，均 2026-05-29 fix-applied 已部署、状态位未翻 | v2.4 close |
| quick_tasks | 16 | 全部 260527–260604（v2.0–v2.3 era）已完成有 commit，status 字段缺失的扫描器怪癖；0 个来自 v2.4 | v2.4 close |
| uat_gaps | 7 | 04/07/19/24 = 0 open scenario；09/10（v2.1）已被 Phase 13 里程碑 UAT 覆盖 | v2.4 close |

> ⚠️ **第 6 次复发**：同一批陈旧 artifact 每次 milestone close 都被 `audit-open` 重新扫出（v2.3 close 时 26 项）。结构性守门（清旧 quick/ + per-phase UAT 文件，或扫描器认 status）至今未兑现——见 memory `feedback_recurring_failure_add_gate`。建议下里程碑前跑 `/gsd-cleanup` 一次性清掉。

### 前瞻性 deferred（非陈旧，留后续里程碑）

| Category | Item | Status |
|----------|------|--------|
| WPS 后续 | WPS-02 真机验证层 + spike-gate 最终裁定 | 用户有环境时自测；go 则 WPS-D1 独立 milestone |
| 配置增强 | CFG-D1 口令加密导出 / CFG-D2 字符串载体 / CFG-D3 选择性导出 | 按需 |
| v2.3 follow-up | WR-02 visual_check_slide slideIndex 忽略 / WR-03 多预览面板 identity 守卫 | **已提升为活跃 todo** → `todos/pending/wr-02-*.md` / `wr-03-*.md`（2026-06-08） |
| C 工具 | 三宿主剩余 ~25 候选 write tool | 后续 milestone triage |

## Session Continuity

Last session: 2026-06-08（/gsd-complete-milestone 收官归档）
Stopped at: ✅ v2.4「扩疆域」收官归档完成。tag `v2.4` + milestones/ 存档 + MILESTONES §v2.4 重写。16/17 需求交付（WPS-02 ⏸️ 延后），三宿主真机 UAT 全 PASS（12/12 区块，0 阻塞 bug），线上 `41e4d70`。下一步 = `/gsd-new-milestone` 起新里程碑（先 `/clear`）。
Resume file: None
