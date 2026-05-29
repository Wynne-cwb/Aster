---
name: aster-design-system
description: Aster 的 teal 克制（quiet）视觉系统——已落地并真机 UAT PASS 的设计决策、CSS token、组件样式范式与反模式。在为 Aster 构建/修改任何 Task Pane UI（Phase 5/6 及之后）时自动加载，确保新 UI 与既有 teal 系统零返工对齐。
---

<context>
## Project: Aster

Aster 是一个嵌在 Microsoft Office（PowerPoint / Excel / Word）右侧 task pane 的 AI 代理助手。固定宽度 **350px**，BYO Key、无后台、纯静态。视觉语言 = **teal 克制（quiet variant）**：单一品牌色 teal `#009887`、纯白底、**无多色渐变、无玻璃拟态（backdrop-filter = 0）**。

这套设计系统不是来自 `/gsd-sketch` 草图实验，而是从 **Phase 04.1「aster-redesign 迁移」** 固化而来——一套已经在三宿主真机 UAT PASS（2026-05-29）、已落地到 `src/styles.css` 的成熟系统。设计真相源是用户在 Claude design 做的交付包，已重建进现有 codebase（Vite + React 19 + TS + 自写 CSS）。

设计 wrapped: 2026-05-29（Phase 04.1 Plan 07 Task 5）。
</context>

<critical_rule>
## 真相分层（务必分清，否则会还原错版本）

| 层 | 文件 | 角色 |
|----|------|------|
| **线上实现（最高权威）** | `src/styles.css` · `src/components/*.tsx` | **像素级真相**。已落地、已 UAT。含 UAT 后的偏差修正。新 UI 复用这里的类名/变量。 |
| **冻结设计参考** | `sources/design-package/README.md` · `INDEX.md` · `aster.css` | 9 屏完整规格、交互行为、组件优先级、落地建议。**解释「为什么这么设计」**。Parked，不再变。 |
| **本 skill 的 reference/** | `references/*.md` | 上两层的**蒸馏**：决策 + 关键 CSS 片段 + 反模式 + 指向上两层的指针。 |

⚠️ **设计稿 ≠ 线上，以线上为准**。最典型：README 写暖白底 `#FAFAF8`，但真机 UAT 后用户拍板改**纯白 `#FFFFFF`**（`src/styles.css` `[data-theme="light"]` 块）。凡设计稿与 `src/styles.css` 冲突，**一律以 `src/styles.css` 为准**，偏差清单见 `references/design-tokens.md`。
</critical_rule>

<design_direction>
## Overall Direction（一句话定调）

**克制（quiet）+ 单一 teal 品牌色 + 双主题随宿主**。所有颜色走 CSS 变量，`[data-theme="light|dark"]` 两套，由 `main.tsx` 读 `Office.context.officeTheme` 在 `#root` 设值。

- **品牌色**：teal `#009887`（light）/ `#4FC9B8`（dark），唯一 accent，不引第二个彩色。
- **底色**：纯白 `#FFFFFF`（light，UAT 定）/ `#0E0E10`（dark）。
- **字体**：Inter（拉丁/数字）+ Noto Sans SC（中文）走 `--font-body`；JetBrains Mono 走 `--font-mono`（时间戳、模型 ID、code、URL）。
- **禁忌**：❌ 多色渐变 ❌ backdrop-filter / 玻璃拟态 ❌ emoji ❌ 栅格图标 ❌ 外部图标 CDN ❌ Fluent UI / shadcn / AntD / MUI 等组件库。
- **气质**：薄边框 + 极克制阴影 + 圆角 4/8/12/16 + 120–320ms 缓动。诚实禁用（`aria-disabled` + `opacity:0.38`，不造假「即将开放」）。
</design_direction>

<findings_index>
## 设计域（6 个 reference 文件）

| 域 | Reference | 一句话 | 主要消费方 |
|----|-----------|--------|-----------|
| Tokens & 主题 | [references/design-tokens.md](references/design-tokens.md) | teal 色板 + 双主题机制 + 字体/圆角/间距/动效/阴影 + **设计稿↔线上偏差清单** | 全部 |
| 聊天与气泡 | [references/chat-and-bubbles.md](references/chat-and-bubbles.md) | user/ai/error 气泡 + markdown-lite + 时间戳 + 空状态 + 滚动粘底 | Phase 6 |
| 写回与工具卡 | [references/writeback-and-tool-cards.md](references/writeback-and-tool-cards.md) | 写回卡 / 多动作合并卡 / 折叠范式 / soft-landing（**最可复用**） | Phase 5 |
| 输入与代理控制 | [references/input-and-agent-controls.md](references/input-and-agent-controls.md) | InputBar + 选区胶囊 + AgentControlBar（quiet pill） | Phase 5/6 |
| 设置与引导 | [references/settings-and-onboarding.md](references/settings-and-onboarding.md) | 设置滑出层 + Provider 行/表单 + Onboarding modal + 宿主卡 | Phase 6 |
| 图标与品牌 | [references/icons-and-brand.md](references/icons-and-brand.md) | 内联 Lucide SVG 图标库 + 约定 + 品牌/Office 资产 | 全部 |

## How to use（构建 UI 时）

1. 先看 `references/design-tokens.md` 确认变量名与偏差清单——**永远复用现有 `--accent`/`--surface`/`--text` 等变量，不新造硬编码 hex/px**。
2. 找最接近的现成组件类（`.bubble-*` / `.tool-group` / `.inputbar` / `.agent-bar` / `.provider-row` / `.modal` / `.btn-*` …）复用或扩展，别从零造。
3. 看不准视觉/交互时，回 `sources/design-package/README.md`（9 屏完整规格）或浏览器直开原型 `.planning/design/aster-redesign/src/Aster Prototype.html`。
4. 任何新 token 先查是否已有变量；任何新组件先查 reference 里有没有同形态范式。

## Source Files

- `sources/design-package/README.md` — 权威 handoff（9 屏 + 行为 + token + 落地建议 + 已知缺口）
- `sources/design-package/INDEX.md` — 对账结论（设计包 vs Aster v2.0 决策）
- `sources/design-package/aster.css` — 完整 token + 组件 CSS（~2000 行，含 dark 全色卡）
- 浏览器可直开原型：`.planning/design/aster-redesign/src/Aster Prototype.html`
</findings_index>

<metadata>
## Origin

固化自 Phase 04.1（aster-redesign-migration-ui-teal），非 /gsd-sketch 草图。
- 设计真相源：`.planning/design/aster-redesign/`
- 线上实现：`src/styles.css`（~1200 行）+ `src/components/`
- UAT：三宿主真机 PASS 2026-05-29
- 处理范围：整套 teal 设计系统（单一内聚系统，整体收录，无逐项 include/exclude）
</metadata>
