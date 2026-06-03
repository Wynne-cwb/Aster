---
phase: 24
slug: a-p2-bundle
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> 本 phase = spike + 新 UI + 分支路径（铺开/降级）。核心可自动化（坐标映射纯函数、html2canvas mock、NFR-09 守门、bundle gate、989 回归）；唯一不可自动化 = 保真度对比图人眼判定（LOCKED-1，留最终统一 UAT，**绝不写成自动 pass/fail 断言**）。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest（已有，`package.json` scripts）|
| **Config file** | vitest.config.ts（项目已有）|
| **Quick run command** | `npx vitest run slide-preview visual-check` |
| **Full suite command** | `tsc --noEmit && vitest run` |
| **Bundle gate command** | `npm run build && npm run size`（**先 build 再 size**，陈旧 dist 给假绿，memory `project_bundle_size_guard`）|
| **Estimated runtime** | 全套 ~30s；bundle gate ~30-60s（含 vite build）|

---

## Sampling Rate

- **After every task commit:** `npx vitest run slide-preview visual-check ppt`
- **After every plan wave:** `tsc --noEmit && vitest run`
- **Before `/gsd-verify-work`:** 全套 green **AND** `npm run build && npm run size`（main-*.js ≤82KB gzip）
- **Max feedback latency:** ~60 秒（含 bundle gate）

---

## Per-Task Verification Map

> Task ID 是占位（planner 最终编号为准）；每条 Requirement → 可自动化命令的映射。

| Behavior | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|----------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 渲染器坐标映射（scale=容器宽/960，960 基准非 720） | 0/1 | PVQ-06 | — | N/A（纯函数）| unit | `npx vitest run slide-preview` | ❌ W0 | ⬜ pending |
| visual_check_slide：html2canvas 被调用（mock，不真跑 canvas）| 0/2 | PVQ-06 | — | N/A | unit | `npx vitest run visual-check` | ❌ W0 | ⬜ pending |
| visual_check_slide：ToolResult.data **无 base64**（NFR-09 守门）| 0/2 | PVQ-06 | T-24-02 | base64 局部变量、只回文字 evidence | unit | `npx vitest run visual-check` | ❌ W0 | ⬜ pending |
| visual_check_slide：vision 文字 evidence 拼入 `ToolResult.data.summary` | 0/2 | PVQ-06 | — | N/A | unit | `npx vitest run visual-check` | ❌ W0 | ⬜ pending |
| API key 不进 error.message（复用 vision client）| 2 | PVQ-06 | T-24-01 | key 仅 Authorization header（T-01-04 既有）| unit/复用 | `npx vitest run visual-check` | ❌ W0 | ⬜ pending |
| SlidePreviewPanel 渲染不崩溃（轻量 smoke，可选）| 3 | PVQ-06 | — | N/A | unit | `npx vitest run slide-preview` | ❌ W0 | ⬜ pending |
| html2canvas + 预览面板 **不进 main chunk**（bundle gate）| 4 | NFR-11 | T-24-03 | 锁版本、懒加载 | CI gate | `npm run build && npm run size` | ✅ `.size-limit.json` | ⬜ pending |
| 既有 989 tests 全绿（含 operationLog.integration undo gate）| 每 wave | NFR-11 | — | N/A | regression | `tsc --noEmit && vitest run` | ✅ | ⬜ pending |
| Lingui catalog 同步（新 UI 文案）| 3 | PVQ-06 | — | N/A | gate | `npm run extract`（→ coverage.test.ts 绿）| ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/agent/design/slide-preview.test.ts` — 坐标映射纯函数单测（REQ PVQ-06）：喂已知 ShapeSpec[]@960×540，断言输出 div 的 left/top/width/height/fontSize 按 scale 正确缩放；断言用 960 基准（防 720 回归）。
- [ ] `src/agent/tools/read/visual-check.test.ts` — vision 自查工具单测（REQ PVQ-06）：mock html2canvas + mock AihubmixVisionClient.analyzeImages；断言 (a) html2canvas 被调用、(b) ToolResult.data **不含** base64 字段（NFR-09 守门）、(c) vision 文字进 `data.summary`、(d) 工具 `kind:'read'`、不在 PPT_TOOLS。
- [ ] `html2canvas@1.4.1` 安装为 dependency（锁版本；仅动态 import 使用）。
- [ ] SlidePreviewPanel smoke test（可选，轻量 `@testing-library/react` render 不崩溃）。

---

## Manual-Only Verifications（人眼 UAT — 攒最终统一 UAT 包，不可自动化）

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| **保真度对比图判定**（自渲染预览 vs PowerPoint 真机截图）| PVQ-06 | LOCKED-1：verdict = 人眼判断，结构上无法自动化；**绝不写成自动 pass/fail 测试** | ① executor 让自渲染预览渲染目标 layout、html2canvas 截 PNG（工具自动产出）；② 用户在 Office for Web PPT 真机对**同一 layout** 截 PowerPoint 端图；③ 两图并排，人眼判溢出/重叠/留白/对比四项是否「粗粒度可辨认一致」→ 给「够用，铺开」或「不足，降级」结论（攒 v2.3 末统一 UAT 由用户定）|
| 铺开路径 Office for Web PPT 真机端到端 | PVQ-06 | 真机宿主行为（CSP / iframe / vision fetch）只能真机验 | sideload → 触发 visual_check_slide → 确认 vision 文字 evidence 正常返回、拼回下一轮、无 CSP 拦截（参考 v2.2 vision 已验 CORS/CSP）|
| 3 个可调项最终值（保真度门槛 / auto-vs-on-demand / visible-vs-offscreen）| PVQ-06 | LOCKED-3：本 phase 设默认（粗粒度可辨认 / on-demand / visible），UAT 调 | UAT 时观察并记录，由用户拍最终值 |
| 坐标基准 960 真机确认（承接 D-22-02 DEFER）| PVQ-06 | 真机 Office.js Shape pt 空间 | 对比图若整体偏移成比例 → 可能基准不符，只改 `DEFAULT_CANVAS_PT` 单常量 |

---

## Validation Sign-Off

- [ ] 所有自动化任务有 `<automated>` verify 或 Wave 0 依赖
- [ ] 采样连续性：无连续 3 个任务缺自动化 verify
- [ ] Wave 0 覆盖所有 MISSING 引用（slide-preview.test / visual-check.test）
- [ ] 无 watch-mode flag
- [ ] Feedback latency < 60s
- [ ] bundle gate 命令含「先 build 再 size」
- [ ] 保真度人眼判定**未**被写成自动断言（LOCKED-1 守护）
- [ ] `nyquist_compliant: true` set in frontmatter（planner/executor 收口时翻）

**Approval:** pending
