# Phase 15: VIS — 视觉看图 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 15-vis
**Areas discussed:** 看图怎么答 / 支持范围 / 半隐式触发呈现 / 失败 UX / （衍生）Phase 15-17 边界 / 上传体验

---

## 前置：路线图格式修复（非 gray area，阻塞修复）

`/gsd-discuss-phase 15` 初始报 phase not found。诊断为 SDK 解析器 `malformed_roadmap`：v2.2 段（14–19）当初由主 agent 内联生成，只有 `- [ ] **Phase N:**` 摘要清单格式，缺 `### Phase N:` 详情段 + 加粗 `**Goal**:`/`**Success Criteria**:` 标签。用户选「修全部 14–19」→ 重排为与归档 v2.1 相同的双格式，内容零删改，单独 commit。

---

## 看图怎么答（质量核心）

| Option | Description | Selected |
|--------|-------------|----------|
| 带 focus 参数 | 工具可选传「看图重点」，DeepSeek 把意图作为 focus 传给 vision 针对性答；不传则通用描述 | ✓（Claude 定） |
| 固定通用描述 | 工具永远让 vision 客观详述整张图 | |

**User's choice:** 用户交 Claude 定（"用户预期无法穷举，可能你来决定"），并给出核心场景：客户传图 → 基于图生成文档。
**Notes:** Claude 选「带 focus 参数」——基于「生成文档」需从图抽可写细节，focus 让 agent 精确问 vision。

## 支持范围（MVP 边界）

| Option | Description | Selected |
|--------|-------------|----------|
| 图片+图表·取第一张 | PPT 图片/图表 + Excel 图表 + Word inline picture；多选取第一张 | ✓ |
| 仅图片·不含图表 | 不碰 Excel 图表 | |
| 再加圈选区域截图 | 圈选区域截图当图看 | |

**User's choice:** 图片+图表·取第一张（推荐）
**Notes:** 圈选区域截图明确不做（spike 风险大）。

## 半隐式触发呈现

| Option | Description | Selected |
|--------|-------------|----------|
| 胶囊提示+按需看 | 选区胶囊明示「可让 AI 看这张图」+ agent 按需调 | |
| 不改胶囊·纯 agent 自决 | 胶囊不变，全靠 agent 判断 | ✓ |
| 胶囊加显式「看图」开关 | 用户点一下才纳入 | |

**User's choice:** 不改胶囊·纯 agent 自决
**Notes:** 用户同时点出关键认知误区——「看图不只是看文档里的图，还可能是用户自己上传的图」。这触发了 Phase 15/17 边界讨论（见下）。

## 失败 & 边界 UX

| Option | Description | Selected |
|--------|-------------|----------|
| 结构化错误+诚实引导 | 三类失败结构化错误，附件 fallback 标「开发中」不撒谎 | ✓ |
| 结构化错误·不提附件 | 失败只报错不引导附件 | |

**User's choice:** 结构化错误+诚实引导（推荐）

## （衍生）Phase 15 / Phase 17 边界 — 关键范围决策

由「半隐式触发」答中用户点出「上传的图」而起。Claude 澄清：原路线图 Phase 15=文档选中图、Phase 17 FILE-06=上传图；但 FILE-06 纯走 vision、零解析库依赖，可干净并入 Phase 15。

| Option | Description | Selected |
|--------|-------------|----------|
| 把图片上传并入 Phase 15 | Phase 15 = 所有看图（选中图 + 上传图）；FILE-06 前移；Phase 17 只留 docx/xlsx/pdf/pptx 解析 | ✓ |
| 保持路线图拆分 | Phase 15 只做选中图，上传等 Phase 17 | |
| 还没想清，帮我分析 | | |

**User's choice:** 把图片上传并入 Phase 15（推荐）
**Notes:** 触发 ROADMAP + REQUIREMENTS 同步改动（FILE-06 Phase 17→15，映射 15:3→4 / 17:8→7）。

## 上传体验

| 问题 | Options | Selected |
|------|---------|----------|
| 上传入口 | 📎 按钮 / 📎+拖拽 | 用户：已有回形针按钮、**加粘贴支持、不做拖拽** |
| 图片数量/格式 | 单张 / 多张 | **多张**（png/jpg/webp） |
| 生命周期 | 本会话内可多轮复用 / 单轮即弃 | **本会话内可多轮复用**（内存态，不持久化） |

**Notes:** 核实代码确认 InputBar.tsx:144-153 现有回形针为 `aria-disabled` 占位（「文件上传即将开放」），Phase 15 激活它（仅图片）。

## Claude's Discretion

- focus 参数 prompt 措辞、单图大小上限阈值、多图 content array 组织、内存态附件 store 结构、vision 结果注入形态、缩略图预览 UI、三宿主取图具体 Office.js API（spike 决定）。

## Deferred Ideas

- 拖拽上传（用户明确不做）、圈选区域截图、docx/xlsx/pdf/pptx 解析（Phase 17）、生图（16）、图库（18）、DeepSeek 原生多模态（VIS-D1）。
- `builtin-model-dropdown` todo（与 VIS 无关，不折入）。
