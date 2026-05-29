# Aster Redesign — Canonical Design Reference

**Parked:** 2026-05-29
**Source:** 用户在 Claude design 做的整站重设计交付包（`Aster.zip` → `design_handoff_aster/`）
**Status:** Canonical 设计真相源，**待 Phase 4.5「UI 设计系统迁移」消费**。当前**未**落地——Phase 4 仍走现有 `src/styles.css` 系统。

> 这是**设计参考稿**（React+Babel 原型 + 完整 `aster.css` token + Lucide 图标 + 品牌资产），不是生产代码。落地 = 在现有 codebase（Vite+React 19+TS+自写 CSS）里像素级重建，不是直接打包 `src/` 发布。

---

## 包内文件

- `README.md` — **权威 handoff 文档**：9 个屏、token、状态机、组件优先级、落地建议、已知缺口。任何落地工作先读它。
- `src/aster.css` — 全部 token + 组件样式（~2000 行）。token 移植目标 = 提取 `.v-quiet` 块为 `tokens` 层。
- `src/proto-app.jsx` — 全部 React 组件参考（MessageBubble / WritebackCard / InputBar / Onboarding / Settings* / ChatStream / App）。
- `src/proto-state.jsx` — state schema / 默认 providers / ERROR_CATALOG / canned replies。
- `src/icons.jsx` — Lucide icon registry + AsterMark 品牌组件。
- `src/assets/aster-logo.png` — 品牌渐变星标（440×440 透明 PNG）。
- `src/icons/office-{ppt,excel,word}.svg` — Office 三件套官方图标（onboarding step 2 用）。
- `src/Aster Prototype.html` — 浏览器直开可跑的原型（Tweaks 面板可切 host / 模拟错误 / 重置 onboarding）。

---

## 对账结论（vs Aster v2.0 现状）

### ✅ 与 v2.0 已锁决策高度吻合（直接采纳）
- 内置 Provider name/baseURL 锁、model 改 **select 下拉** → **CARRY-02 / 04-CONTEXT D-06**
- DeepSeek 槽 `deepseek-v4-pro / deepseek-v4-flash` → **04-CONTEXT D-07**（一字不差）
- AIHubMix 双槽：图片识别 + 图片生成 → **04-CONTEXT D-09**（vision/image 拆分）
- `defaultProviderId` 锁 `deepseek` → **04-CONTEXT D-08**（主 LLM 是 DeepSeek）
- AI 自动写、**无接受/拒绝**、事后「已写入」卡 + 撤销 → **Phase 3 D-01** + **Phase 5** diff log/undo
- 多动作聚合卡 + 撤销全部 → **Phase 5** DiffLogPanel + undo all
- ErrorBubble + code 枚举 → `src/errors/index.ts` 8 类
- selpill + eye toggle、ContextRow 移除、齿轮移到输入框底部 → v1 选区胶囊 + CARRY-01
- Onboarding 2 步、无隐私步、「重看引导」 → **Phase 3 D-17**（PRIV 砍）
- 自写 CSS token + 内联 Lucide SVG + Noto Sans SC → 现有 UI 约定一致

### ⚠️ 冲突 / 缺口（迁移 phase 必须处理）
1. **视觉语言整体转向（已确认采纳，2026-05-29）**：单一克制 **teal `#009887`** + 暖白底 `#FAFAF8`，**无玻璃拟态、无紫靛蓝渐变**。**推翻**当前 `CLAUDE.md §UI 设计系统`（渐变 accent + 玻璃拟态）和记忆 `feedback_beauty_over_fluent`。→ 迁移 phase 执行时更新 CLAUDE.md + 改记忆 + 标 `01-UI-SPEC.md` 过时。**在那之前 CLAUDE.md 不动**，Phase 4 仍按现有系统建。
2. **设计包对「代理运行时 UX」是空白的**：覆盖了输出/静态面，但**没有** Phase 3/4 的 in-flight 面——AgentControlBar（pause/abort/step counter）、**步骤差异化文案（Phase 4 SC3）**、软着陆卡、**「Agent gave up」红卡（ERR-04）**、5 秒卡住入口、实时 read 折叠卡（Phase 4 D-01）。写回卡是「事后通知」模型。→ **决策（2026-05-29）：这些面在 Phase 4.5 迁移 phase 里按新 teal 语言由 Claude 补设计**（不回设计工具再出稿）。
3. **设计里带着 cost**（`cost:{tokens,yuan}`、token 标、Provider inputPrice/outputPrice）→ v2.0 **已整批砍**（Phase 3 拆 CostBadge/pricing）。落地时**丢掉 cost**。

---

## 路由（GSD 流程）

1. **Phase 4** — 照**现有**设计系统做完（read 后端 / 控制条 / 熔断 / 红卡 / model 下拉）。约束：UI 走「设计系统中性」（只用现有 CSS 变量/类，不做一次性硬编码样式），让迁移换 token 时自动跟着变。model 下拉结构可直接照新设计的 select 形态做（结构匹配，皮肤迁移时再换）。
2. **Phase 4.5「UI 设计系统迁移（Aster Redesign 落地）」**（`/gsd-insert-phase`，夹在 4 和 5 之间）— token 迁移到 teal 系统 + 重写 `styles.css` + 重皮所有现有组件 + 按新语言补设计 agent 运行时面 + 更新 CLAUDE.md/记忆/UI-SPEC + `/gsd-sketch-wrap-up` 固化成 project design skill 供 Phase 5/6 消费。
3. **Phase 5 / 6** — 大块新 UI（DiffLogPanel / 杀手场景 / empty-state chips / onboarding GIF）等迁移完，**直接在新 teal 系统上建，零返工**。设计包的写回卡/空状态/onboarding/suggestions chips 正好喂给它们。

---

*Consumed by: Phase 4.5 迁移 phase（discuss/plan/execute 引此为 canonical_ref）；Phase 5/6 UI-SPEC。*
