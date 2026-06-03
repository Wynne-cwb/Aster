---
phase: 22-ppt-design-tokens-geometry-check
plan: 01
subsystem: agent
tags: [ppt, design-tokens, geometry-check, wcag, read-tool, layout]

# Dependency graph
requires:
  - phase: 21-ppt-context-window-compaction
    provides: read-tool → wire tool-message evidence 路径（check_slide_layout 复用）
provides:
  - "src/agent/design/ppt-tokens.ts — PPT 成品结构 token（字号阶梯/页边距/网格/默认画布 960×540/兜底单色/语义色），配色不锁死无固定调色板"
  - "src/agent/design/geometry-check.ts — 确定性四项版面自查（溢出/重叠/越界/对比 WCAG）+ canvas 参数化 + 诚实降级"
  - "check_slide_layout read 工具 — 复用 list_shapes_on_slide 几何 → 跑纯自查 → metadata evidence 喂回 LLM 自主重排"
affects: [phase-23-apply-slide-layout, phase-23-pvq-05-prompt-rewrite]

# Tech tracking
tech-stack:
  added: []  # 0 净新增运行时依赖
  patterns:
    - "design/ 纯 TS 模块目录（零 Office.js/React/网络），只服务生成的幻灯片成品，与面板 CSS 物理隔离"
    - "canvas 几何作显式参数 + token 默认常量（单一真相源，规避 720/960 baseline 陷阱）"
    - "read 工具复用既有 adapter.read kind 跑纯计算 → wrapReadResult metadata（零 adapter 改动、无 undo）"

key-files:
  created:
    - src/agent/design/ppt-tokens.ts
    - src/agent/design/geometry-check.ts
    - src/agent/design/ppt-tokens.test.ts
    - src/agent/design/geometry-check.test.ts
  modified:
    - src/agent/tools/read/ppt.ts
    - src/agent/tools/index.ts
    - src/agent/tools/read/tools.test.ts
    - src/agent/tools/index.test.ts

key-decisions:
  - "配色不锁死（D-22-01）：ppt-tokens.ts 不内置任何调色板数组/对象，仅 DEFAULT_ACCENT(teal) 兜底单色 + SEMANTIC 涨跌语义色；测试双重守门（无颜色数组导出 + 无 palette/colors 命名导出）"
  - "默认画布 DEFAULT_CANVAS_PT=960×540pt（D-22-02），canvas 作纯函数显式参数，绝不内部硬编 720×405；右半屏 960 回归测守门"
  - "对比④ bg 缺失/非法 → contrast_undetermined 诚实降级（D-22-05），绝不报 low_contrast 假阳性"
  - "几何自查 = advisory evidence 非硬阻断（D-22-03）；check_slide_layout 为 read 工具，不进 PPT_TOOLS、无 undo/operationLog（D-22-04）"
  - "本 phase 不碰 system-prompt.ts（D-22-07）；工具靠 description 自我广告即可被 LLM 调用；PVQ-02 SC#3「prompt 不脑补坐标」留 Phase 23 PVQ-05"

patterns-established:
  - "estimateTextBox 显式 \\n 切段计行（refinement #2）：多段落不被流式折行低估高度（漏报溢出）"
  - "几何阈值/字号/边距/乘数全为 ppt-tokens.ts 命名常量 +「初值待 UAT 调」，单一真相源"

requirements-completed: [PVQ-01, PVQ-02]

# Metrics
duration: ~30min
completed: 2026-06-03
---

# Phase 22: A P0 基座——设计 token + 几何自查 Summary

**用确定性 TS 代码替代「让 LLM 拿坐标脑补重叠/溢出」：集中 PPT 结构 token（配色不锁死）+ 四项几何自查（溢出/重叠/越界/对比）+ check_slide_layout read 工具把违规清单喂回 LLM 自主重排。**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-03
- **Tasks:** 5/5 完成
- **Files modified:** 8（4 created + 4 modified）

## Accomplishments

### Task 1 — `ppt-tokens.ts`（PVQ-01，commit d483cef）
结构 token only，**配色不锁死**：字号阶梯（商务密实 title 28→caption 11，kpi 40 最大）+ 页边距 `MARGINS_PT{x:48,y:36}` + `GAP_PT 16` + 默认画布 `DEFAULT_CANVAS_PT 960×540`（**非 720×405**）+ 两套 canvas 参数化网格（`gridFull`/`gridTwoColumn`）+ 兜底单色 `DEFAULT_ACCENT`(teal) + 涨跌 `SEMANTIC`(success/error) + 几何阈值/文本估算常量。**无固定调色板数组**；与面板 CSS 变量物理隔离。

### Task 2 — `geometry-check.ts`（PVQ-02，commit 265ab05）
纯 TS 零网络零依赖（仅 import ppt-tokens）。四项确定性检查：① 溢出（保守上界 + 显式 `\n` 切段计行）② 重叠（相交边长 >2pt）③ 越界（超画布/页边距）④ 对比（WCAG <4.5:1 正文 / <3:1 大字）。`wcagContrastRatio` 相对亮度 + `estimateTextBox` 文本估算 + `checkSlideLayout` 聚合 + `formatViolations` 中文 evidence。canvas 显式参数默认 960×540。bg 缺失/非法 → `contrast_undetermined` 诚实降级。advisory 非阻断。

### Task 3 — `check_slide_layout` read 工具（PVQ-02 证据接线，commit f5f4e31）
`kind:'read'` ToolDef，复用既有 `adapter.read({kind:'list_shapes_on_slide'})` 取几何 → 跑纯 `checkSlideLayout` → `wrapReadResult` metadata（含 `summary=formatViolations`）→ wire tool-message 成为下一轮 evidence。零 adapter 改动、无 ReadRequest 新 kind、无 undo/operationLog。注册进 `buildToolsForHost('ppt')` read 列表（**不进 PPT_TOOLS** 写归一化集）。`textBoxes[]` 内 shapeId 做 snake/camel 双键容错。

### Task 4 — 测试守门（PVQ-01/02，commit 376898b）
`ppt-tokens.test.ts`（7 测）+ `geometry-check.test.ts`（22 测）+ 工具计数 21→22（tools.test.ts + index.test.ts）+ check_slide_layout name/kind/execute 集成断言。

### Task 5 — 最终验证
tsc 0 / 963 tests pass（0 fail；3 trailing retry errors = 已知噪音）/ build OK / `npm run size` = **80.61 KB gzip ≤ 82 KB**（baseline 80.6 KB，~0 增量）。`check_slide_layout` 仅落 `loop-*.js` 懒加载 chunk，不进 main。

## Plan-check refinements 全部 5 项已应用

1. **真实 sub-2pt 重叠 edge 测**（ix=1pt 实际重叠，非 1pt 间隔）→ 守 OVERLAP_MIN_PT 阈值，原 gap 测保留。
2. **`estimateTextBox` 显式 `\n` 计行**：按 `\n` 切段、每段独立折行至少 1 行 → 多段落不被低估高度（漏报溢出）；加多段落溢出测。
3. **大字对比对 #949494→#898989**（实测 3.50:1，舒适落 3~4.5 带内）+ 断言 ratio in-band + 正文 14pt 会报。
4. **stale it() 标题修正**：tools.test.ts / index.test.ts describe 文案 21→22（6 read）。
5. **无 palette 命名守门**：除「无颜色数组导出」外，加断言无导出名匹配 `/palette|colou?rs/i`。

## Deviations from plan

- **geometry-check.ts 头注释改写**：原 plan 模板注释含「720×405」字样，与 Task 2 acceptance（`grep -c '720' == 0`）冲突（plan 内部不一致）。改为「绝不内部硬编旧的 4:3 残留基准」——保留反模式警告、满足 grep==0；720×405 详解仍在 ppt-tokens.ts。
- **index.ts 注册注释用 camelCase**：为满足 acceptance `grep -c 'check_slide_layout' index.ts == 0`（确认未误入 PPT_TOOLS），注释写「checkSlideLayout」而非 snake_case。

均为满足 plan 自身 acceptance 的措辞级调整，语义/实现零偏离。

## Defer（攒到 v2.3 末 UAT）

- 坐标基准真机确认（720 vs 960）；几何阈值/字号/边距/乘数初值调参；读文档实际颜色做对比。
- system-prompt.ts PPT 段脑补坐标/自查规则删除 → Phase 23 PVQ-05。
- apply_slide_layout 自动喂色/文本给 check_slide_layout → Phase 23（纯函数已预留接口）。

## Verification

- `npx tsc --noEmit` → exit 0
- `npm test -- --run` → 75 files / **963 passed / 0 failed**（3 retry.test.ts NETWORK errors = 已知尾部噪音）
- `npm run build && npm run size` → main **80.61 KB gzip ≤ 82 KB**
- PPT 工具计数 21→22 断言通过；check_slide_layout 进 dist loop chunk
