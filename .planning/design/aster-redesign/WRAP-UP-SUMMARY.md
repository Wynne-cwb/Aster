# Design Wrap-Up Summary

**Date:** 2026-05-29
**命令:** `/gsd-sketch-wrap-up`（改造用法：本项目无 /gsd-sketch 草图，固化的是已落地的 teal 设计系统）
**来源:** Phase 04.1（aster-redesign-migration-ui-teal）Plan 07 Task 5
**Skill 输出:** `./.claude/skills/aster-design-system/`
**设计真相源:** `.planning/design/aster-redesign/`（README.md 权威 handoff + INDEX.md 对账 + src/aster.css token）
**线上实现:** `src/styles.css`（~1200 行）+ `src/components/`，三宿主真机 UAT PASS（2026-05-29）

## 特殊性说明

`/gsd-sketch-wrap-up` 标准用法是打包 `/gsd-sketch` 产生的 HTML 草图实验。本项目从未跑过 `/gsd-sketch`，没有草图原料。但 STATE.md 与 INDEX.md（设计路由 §48）预留了既定任务：用此命令**把已落地 + 已 UAT 的 teal 克制设计系统固化成 project skill，供 Phase 5/6 零返工消费**。因此本次为单一内聚系统整体收录，无逐项 include/exclude curation。

## 处理结果

| 项 | 值 |
|----|----|
| 收录 | 1 套完整设计系统（teal 克制，整体） |
| 设计域 | 6 个（→ 6 个 reference 文件） |
| Skill 名 | `aster-design-system`（用户定；不用 `sketch-findings-` 前缀，因无草图来源） |
| 冻结快照 | README.md + INDEX.md + aster.css → `sources/design-package/` |
| 活文件引用 | `src/styles.css` / `src/components/*` 按路径引用（不复制，防漂移） |

## 设计域 → Reference

| 域 | Reference | Key Decision |
|----|-----------|--------------|
| Tokens & 主题 | `references/design-tokens.md` | 单一 teal `#009887` + 纯白底 + `[data-theme]` 双主题 + 设计稿↔线上偏差清单 |
| 聊天与气泡 | `references/chat-and-bubbles.md` | user(teal 实底)/ai(冷灰)/error 三气泡 + 单角拉直指向感 + 时间戳常驻 |
| 写回与工具卡 | `references/writeback-and-tool-cards.md` | 自动写+事后通知+撤销（无接受/拒绝）+ ≥2 合并卡 + wb-action 折叠范式 |
| 输入与代理控制 | `references/input-and-agent-controls.md` | InputBar 三段 + 选区胶囊 + 发送三态 + AgentControlBar quiet pill |
| 设置与引导 | `references/settings-and-onboarding.md` | 滑出层 + 三层 sticky footer 表单 + 内置 Provider 锁 + 2 步 onboarding |
| 图标与品牌 | `references/icons-and-brand.md` | 内联 Lucide SVG（currentColor/1.5）+ 22 图标库 + AsterMark PNG |

## Design Direction（一句话）

克制（quiet）+ 单一 teal 品牌色 + 双主题随 Office 宿主，全 CSS 变量驱动。无多色渐变、无 backdrop-filter/玻璃拟态、无 emoji/栅格图标/外部图标 CDN、无 Fluent/shadcn/AntD/MUI 组件库。

## Key Decisions（固化要点）

- **色**：teal `#009887`(light)/`#4FC9B8`(dark) 唯一 accent；纯白底 `#FFFFFF`（UAT 推翻设计稿暖白 #FAFAF8）。
- **字**：Inter + Noto Sans SC（`--font-body`）/ JetBrains Mono（`--font-mono`）。
- **形**：圆角 4/8/12/16/full；薄边 + 极克制阴影；气泡单角拉直作指向感。
- **动**：120/200/320ms + ease-out 默认；`prefers-reduced-motion` 全局降级。
- **交互架构**：AI 自动写文档，无确认弹窗，事后「已写入」卡 + 撤销（Phase 5 落地 per-step/undo-all）。
- **诚实禁用**：未实现功能 `aria-disabled` + opacity，不造假。

## UAT 偏差（设计稿 → 线上，已记入 design-tokens.md）

纯白底覆盖暖白 · 气泡间距 16px · 时间戳常驻 · 空 turn 不渲染 · 工具卡 ≥2 合并 + `flex-shrink:0` 防压扁 · 表单 footer gap 16px · 系统 prompt 注入当前时间。

## 消费路由

- **Phase 5**（Diff Log + Undo All）→ `writeback-and-tool-cards.md`（最重）+ `input-and-agent-controls.md`
- **Phase 6**（Write tools + killer scenarios + onboarding）→ `chat-and-bubbles.md` + `settings-and-onboarding.md`
- **全程** → `design-tokens.md` + `icons-and-brand.md`

Skill 已挂 CLAUDE.md 自动加载路由行，构建 UI 时自动注入。
