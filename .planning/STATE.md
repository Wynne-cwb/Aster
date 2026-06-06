---
gsd_state_version: 1.0
milestone: v2.4
milestone_name: 扩疆域
status: verifying
stopped_at: Phase 25/26/27/28 ✅ 完成（里程碑 4/5）。Phase 28 Excel 3 工具核验代码层 PASS（EXCEL-11/12/13，HR-01/HR-02/MR-01/MR-02 review 闭合+守门，1122 测试绿，82.48KB/100KB；3 项真机语义入里程碑 UAT）。下一步 Phase 29 PPT 3 工具 + NFR-12 全里程碑 bundle 收口（末位，依赖已满足）。所有 commit 本地未 push（按发布约定，里程碑收尾再 push）。
last_updated: "2026-06-06T08:32:34.098Z"
last_activity: 2026-06-06
progress:
  total_phases: 5
  completed_phases: 4
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-05 — Milestone v2.4「扩疆域」started)

**Core value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 **AI 代理** 能力，能完成绝大部分文档工作；无后台、BYO Key。
**Current focus:** Phase 29 — ppt-tools-nfr12

## Current Position

Phase: 29 (ppt-tools-nfr12) — EXECUTING
Plan: 3 of 3
Status: Phase complete — ready for verification
Last activity: 2026-06-06

Progress: [██████████] 100%

### v2.4 Scope

| Phase | 内容 | 需求 |
|-------|------|------|
| **25 WPS spike-gate** | 调研报告 + 真机验证清单（Claude，WPS-01）。⏸️ 真机验证 WPS-02 **延后**（discuss D-01：用户无 Windows 环境）→ v2.4 只交 WPS-01 | WPS-01；WPS-02 ⏸️Deferred |
| **26 配置导入导出** | 明文 JSON 导出/导入 + 醒目警告（提前；独立于 C 工具，复用 v2.2 FILE 基建） | CFG-01~03 |
| **27 Word 工具补全** | 高亮/列表/批注/页眉页脚/edit_table（5 write tools） | WORD-06~10 |
| **28 Excel 工具补全** | 合并单元格/删除重复项/数据透视表（含 API 降级门控） | EXCEL-11~13 |
| **29 PPT 工具补全 + NFR-12 收口** | 插入表格/线条箭头/渐变填充（三工具均有 API 风险，可诚实降级）+ 末位承接 NFR-12 bundle gate 全里程碑收口 | PPT-09~11, NFR-12 |

> ⏸️ **WPS-02 真机层已延后**（Phase 25 discuss D-01，2026-06-05）：用户确认**当前无 Windows 环境** → Phase 25 在 v2.4 内**只交付 WPS-01**（调研报告 + 真机验证清单 + 初步 go/no-go 信号）。WPS-02 真机实测 + 最终裁定异步延后到用户有环境时/下个里程碑，**非 v2.4 收尾硬条件**。里程碑照常 ship 配置+C 工具两条线。

### v2.4 工程约束（贯穿所有 phase）

- **Bundle gate**: **≤100KB gzip CI gate**（2026-06-05 Phase 26 用户拍板从 82KB **永久上调**；仍 ≪ PRD 1MB）；解析库/Provider SDK/重模块**仍必须懒加载**（纪律不变）；动 bundle 前先 `npm run build` 再 `npm run size`
- **新 write 工具合约（C 线）**: inverse 收 Record 对象（非位置参）+ 新 PostStateSnapshot kind + humanLabel + `operationLog.integration.test` 守门 + 入 `*_TOOLS` Set（casing 归一化）
- **API 风险工具**: EXCEL-13 / PPT-09 / PPT-10 / PPT-11 — plan-phase 必先验 Office for Web 可用性；不可用则诚实降级（noop+gate）
- **配置导出安全**: 明文 JSON + 醒目警告；Key 落用户本地文件，不上传 Aster 服务器；Settings UI 遵循 teal 克制设计系统
- **Node 22**: 测试/构建必须用 Node 22（`export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`）

## Performance Metrics

**v2.3 基准（上里程碑）:** 5 phases / 10 plans / 81.3 KB bundle / 1075 tests / 13/13 需求交付。

## Accumulated Context

### Decisions

Recent decisions affecting current work:

**Decision Harvest 拍板（2026-06-05，gsd-team-lead，权威细节见各 phase `<N>-CONTEXT.md`）：**

- [P25 discuss D-01 关键]: 用户**当前无 Windows 环境** → Phase 25 在 v2.4 内**只交付 WPS-01**（调研报告+真机清单+初步信号）；WPS-02 真机层异步延后（ROADMAP/REQUIREMENTS/STATE 已对齐）。D-02 go 阈值=三宿主全绿（最保守）；D-03 桌面独有增益纳入裁定加分；D-04 调研只覆盖 WPS Win 桌面版；D-05 真机用线上 Pages manifest
- [P26 discuss]: D-01 入口=Settings 新开「配置备份与迁移」独立分区；D-02 字段集=锁定清单+生图默认模型偏好，内置 Provider+key 照常导出，不带引导已读/Pexels Worker baseURL；D-03「不可忽略」=常驻醒目警告文案（非强制勾选/阻断，便利优先；verifier 基线：常驻+醒目+措辞完整即 PASS）；D-04 导入=简单确认+完成 toast 摘要（不逐项预览），同 id 覆盖仍单独确认。⚠️ UI hint=yes → 需 gsd-ui-phase 先出 UI-SPEC（teal 无现成 warn token，需定警示色块）。⚠️ F-02 自动插入开关 key 已于 Phase 3 删除（别找）；F-05「复用 FILE 基建」=复用文件读取知识非附件 store 管线；F-07 导入须经 store setter 刷新 reactive；F-08 addProvider 强制 randomUUID 需评估按指定 id 写入
- [P27 discuss]: WORD-08 批注署名=加纯文本标记（Office for Web insertComment 强制署当前账号、无法改作者；建议「Aster 建议：」措辞留 plan）。⚠️ casing 更正：codebase **无 WORD_TOOLS Set**，既有 Word 工具一致 camelCase 且 UAT 通过 → 新 5 工具沿用 camelCase，无需建 set。最大风险 R1=bundle（gate 2026-06-05 已上调 100KB，余量充裕，R1 风险大幅缓解；仍守懒加载纪律）
- [P28 discuss]: NONE（纯技术，合约+EXCEL-13 降级已锁）。关键研究点 R1=`pivotTables.add` Office for Web 可用性，plan-phase 必验（go/降级分水岭）
- [P29 discuss]: PPT-09 表格降级=形状网格模拟；PPT-11 渐变降级=纯色+告知；PPT-10 线条箭头降级=诚实拒绝。三工具 web API 可用性 plan-phase 必验；NFR-12 末位全里程碑 bundle 收口，最大变量=Phase 26 配置 UI 累积增量
- [P26 bundle gate 2026-06-05 用户拍板]: **bundle 硬门 82KB → 100KB 永久上调**。起因：Phase 26 配置 UI 的 CFG-03 合规警告文案进 boot 主 chunk i18n catalog，+172B 撞 82KB 旧门（configBackup 已懒加载、不在 main）。用户选**永久放宽**给 C 工具+配置充裕余量，而非抠合规文案/临时搬门。已对齐：`.size-limit.json`(100KB) + REQUIREMENTS NFR-12 + ROADMAP(横切+27/28/29 SC) + memory `project_bundle_size_guard` + ci.yml 注释。**重模块懒加载纪律不变**；仍 ≪ PRD「初始 JS ≤1MB」。当前实测 82.17KB（PASS）。
- [v2.4 Roadmap 2026-06-05]: Phase 25 WPS spike-gate 首个；WPS-02 真机层可与 Phase 26–29 并行异步，spike 不通过里程碑仍干净 ship
- [v2.4 重排 2026-06-05]: 用户拍板配置导入导出提前至 Phase 26（独立于 C 工具线，提前交付"换机搬家"实用价值）；C 工具顺延 Word 27 / Excel 28 / PPT 29；NFR-12 bundle 收口随末位实现 phase 移至 Phase 29
- [v2.4 Roadmap 2026-06-05]: 配置导出明文 JSON + 醒目警告（用户拍板，便利优先；口令加密留 CFG-D1 按需）
- [Phase 24]: Node 22 必须（jsdom@29.1.1 要求 Node ≥20.19，v20.17.0 崩溃）
- [Phase 24]: 坐标真相源 `DEFAULT_CANVAS_PT.widthPt`=960；禁用 720×405
- [Phase ?]: removeDuplicatesRange 复用 restoreRangeValuesSnapshot inverse（不新建 reverse case）
- [Phase ?]: Phase 29 三工具全部 integrationTest:true，Wave 0 即 rolled_back（复用既有 delete_shape_by_id + restore_shape_property，不像 Phase 28 需等后续 wave）
- [Phase ?]: 方案 A 零新 adapter 方法：setShapeGradientTool 直接复用 setShapeProperty({ fillColor: firstColor })，0 新 PptAdapter 方法
- [Phase ?]: NFR-12 全里程碑收口：main-Bi3ptDtV.js gzip 82.48 KB / gate 100 KB / 余量 17.52 KB（PASS）

### Pending Todos

- **无 pending todos**（`builtin-model-dropdown` 已验证 v2.0 CARRY-02 交付，2026-06-05 归档至 `todos/completed/`，commit `3591f0a`）。

### Blockers/Concerns

- **WPS-02 真机层 ⏸️ 已延后**（discuss D-01，2026-06-05）：用户确认**当前无 Windows 环境** → v2.4 只交付 WPS-01（调研报告+真机清单），WPS-02 实测+裁定异步延后到有环境时/下个里程碑，不阻塞 v2.4 收尾。
- **PPT 三工具 API 风险**（PPT-09/10/11）：网页版 API 支持存疑，plan-phase 必先验，成功标准允许诚实降级。
- **EXCEL-13 数据透视表**：`Worksheet.pivotTables.add` Office for Web 复杂度高，plan-phase 必前验。
- **Bundle gate 已上调 100KB**（2026-06-05 用户拍板，原 82KB 过紧）：当前 82.17KB，余量充裕；重模块仍懒加载，动 bundle 仍先 build 再 size（陈旧 dist 给假绿）。

## Deferred Items

Items acknowledged and deferred at **v2.3 milestone close on 2026-06-05** (26 项，全部为陈旧簿记或已 UAT 覆盖，0 真正未完成）。详见 MILESTONES.md §v2.3。

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| v2.3 follow-up | WR-02: visual_check_slide slideIndex 入参被忽略 | 不阻塞，记录 | v2.3 close |
| v2.3 follow-up | WR-03: 多预览面板 identity 守卫 | 不阻塞，记录 | v2.3 close |
| v2.4 defer | CFG-D1: 口令加密导出（WebCrypto AES-GCM） | 按需，本里程碑不做 | v2.4 scope |
| v2.4 defer | WPS-D1: WPS 全量兼容适配 | 取决于 WPS-02 裁定，独立 milestone | v2.4 scope |
| stale todo | builtin-model-dropdown | ✅ 已归档 `todos/completed/`（2026-06-05，commit `3591f0a`）；v2.0 CARRY-02 交付 | v2.0 |
| Phase 29-ppt-tools-nfr12 P01 | 3min | 2 tasks | 3 files |
| Phase 29-ppt-tools-nfr12 P29-03 | 137 | 2 tasks | 2 files |

## Session Continuity

Last session: 2026-06-06T08:31:57.661Z
Stopped at: Phase 25/26/27/28 ✅ 完成（里程碑 4/5）。Phase 28 Excel 3 工具核验代码层 PASS（EXCEL-11/12/13，HR-01/HR-02/MR-01/MR-02 review 闭合+守门，1122 测试绿，82.48KB/100KB；3 项真机语义入里程碑 UAT）。下一步 Phase 29 PPT 3 工具 + NFR-12 全里程碑 bundle 收口（末位，依赖已满足）。所有 commit 本地未 push（按发布约定，里程碑收尾再 push）。
Resume file: None
