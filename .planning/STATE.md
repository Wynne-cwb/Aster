---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: 扩疆域
status: roadmap_created
stopped_at: "**v2.4「扩疆域」roadmap 已创建 + 用户重排（2026-06-05）。** 5 phases（25–29）/ 17 需求全映射。Phase 25 WPS spike-gate 首个（调研层 Claude + 真机层用户 Windows/WPS，可与后续并行异步）。**重排**：配置导入导出提前 Phase 26（独立于 C 工具线，提前交付'换机搬家'实用价值）；C 工具线顺延 Word 27 / Excel 28 / PPT 29；NFR-12 bundle 收口移至末位 Phase 29（全代码就位才收口）。下一步：`/gsd-plan-phase 25`。"
last_updated: "2026-06-05T09:30:00.000Z"
last_activity: 2026-06-05 -- v2.4 roadmap created (5 phases, 17 requirements mapped)
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05 — Milestone v2.4「扩疆域」started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** **v2.4「扩疆域」roadmap 已创建，Phase 25（WPS spike-gate）就绪待规划。**

## Current Position

Phase: 25 of 29 (WPS spike-gate) — Not started
Plan: —
Status: Roadmap created — ready to plan Phase 25
Last activity: 2026-06-05 — Roadmap created (ROADMAP.md + REQUIREMENTS.md traceability updated)

Progress: [░░░░░░░░░░] 0%

### v2.4 Scope

| Phase | 内容 | 需求 |
|-------|------|------|
| **25 WPS spike-gate** | 调研报告（Claude）+ 真机验证（用户 Windows/WPS）→ go/no-go | WPS-01, WPS-02 |
| **26 配置导入导出** | 明文 JSON 导出/导入 + 醒目警告（提前；独立于 C 工具，复用 v2.2 FILE 基建） | CFG-01~03 |
| **27 Word 工具补全** | 高亮/列表/批注/页眉页脚/edit_table（5 write tools） | WORD-06~10 |
| **28 Excel 工具补全** | 合并单元格/删除重复项/数据透视表（含 API 降级门控） | EXCEL-11~13 |
| **29 PPT 工具补全 + NFR-12 收口** | 插入表格/线条箭头/渐变填充（三工具均有 API 风险，可诚实降级）+ 末位承接 NFR-12 bundle gate 全里程碑收口 | PPT-09~11, NFR-12 |

> WPS-02 真机验证层需用户备 Windows 环境，可与 Phase 26–29 **并行异步**进行，不阻塞里程碑。spike 不通过则仅交付 配置+C 工具，里程碑仍干净 ship。

### v2.4 工程约束（贯穿所有 phase）

- **Bundle gate（很紧）**: ≤82KB gzip CI gate（v2.3 收于 81.3KB，余量 ~0.7KB）；新功能/重模块必须懒加载；动 bundle 前先 `npm run build` 再 `npm run size`
- **新 write 工具合约（C 线）**: inverse 收 Record 对象（非位置参）+ 新 PostStateSnapshot kind + humanLabel + `operationLog.integration.test` 守门 + 入 `*_TOOLS` Set（casing 归一化）
- **API 风险工具**: EXCEL-13 / PPT-09 / PPT-10 / PPT-11 — plan-phase 必先验 Office for Web 可用性；不可用则诚实降级（noop+gate）
- **配置导出安全**: 明文 JSON + 醒目警告；Key 落用户本地文件，不上传 Aster 服务器；Settings UI 遵循 teal 克制设计系统
- **Node 22**: 测试/构建必须用 Node 22（`export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`）

## Performance Metrics

**v2.3 基准（上里程碑）:** 5 phases / 10 plans / 81.3 KB bundle / 1075 tests / 13/13 需求交付。

## Accumulated Context

### Decisions

Recent decisions affecting current work:

- [v2.4 Roadmap 2026-06-05]: Phase 25 WPS spike-gate 首个；WPS-02 真机层可与 Phase 26–29 并行异步，spike 不通过里程碑仍干净 ship
- [v2.4 重排 2026-06-05]: 用户拍板配置导入导出提前至 Phase 26（独立于 C 工具线，提前交付"换机搬家"实用价值）；C 工具顺延 Word 27 / Excel 28 / PPT 29；NFR-12 bundle 收口随末位实现 phase 移至 Phase 29
- [v2.4 Roadmap 2026-06-05]: 配置导出明文 JSON + 醒目警告（用户拍板，便利优先；口令加密留 CFG-D1 按需）
- [Phase 24]: Node 22 必须（jsdom@29.1.1 要求 Node ≥20.19，v20.17.0 崩溃）
- [Phase 24]: 坐标真相源 `DEFAULT_CANVAS_PT.widthPt`=960；禁用 720×405

### Pending Todos

- **无 pending todos**（`builtin-model-dropdown` 已验证 v2.0 CARRY-02 交付，2026-06-05 归档至 `todos/completed/`，commit `3591f0a`）。

### Blockers/Concerns

- **WPS-02 真机层**：需用户另备 Windows + WPS 桌面版环境；已设计为可异步，不阻塞其他 phase。
- **PPT 三工具 API 风险**（PPT-09/10/11）：网页版 API 支持存疑，plan-phase 必先验，成功标准允许诚实降级。
- **EXCEL-13 数据透视表**：`Worksheet.pivotTables.add` Office for Web 复杂度高，plan-phase 必前验。
- **Bundle 余量极紧**（~0.7KB）：新增任何非懒加载代码需先 build 再 size，勿凭陈旧 dist 判断。

## Deferred Items

Items acknowledged and deferred at **v2.3 milestone close on 2026-06-05** (26 项，全部为陈旧簿记或已 UAT 覆盖，0 真正未完成）。详见 MILESTONES.md §v2.3。

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.3 follow-up | WR-02: visual_check_slide slideIndex 入参被忽略 | 不阻塞，记录 | v2.3 close |
| v2.3 follow-up | WR-03: 多预览面板 identity 守卫 | 不阻塞，记录 | v2.3 close |
| v2.4 defer | CFG-D1: 口令加密导出（WebCrypto AES-GCM） | 按需，本里程碑不做 | v2.4 scope |
| v2.4 defer | WPS-D1: WPS 全量兼容适配 | 取决于 WPS-02 裁定，独立 milestone | v2.4 scope |
| stale todo | builtin-model-dropdown | ✅ 已归档 `todos/completed/`（2026-06-05，commit `3591f0a`）；v2.0 CARRY-02 交付 | v2.0 |

## Session Continuity

Last session: 2026-06-05
Stopped at: v2.4 roadmap created — ROADMAP.md（Phase 25–29 detail + progress table）+ STATE.md + REQUIREMENTS.md traceability 已写入
Resume file: None
