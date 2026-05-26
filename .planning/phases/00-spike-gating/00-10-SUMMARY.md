---
phase: 0
plan: "10"
subsystem: spike-gating
tags: [bundle-size, sideload, vite, fluent-ui, manifest, phase-0]
dependency-graph:
  requires: ["00-01 (GitHub Pages URL)", "00-02 (spike/manifest.xml)"]
  provides: ["Phase 1 bundle-size CI gate 起点 baseline", "Phase 7 REL-05 sideload regression 起点"]
  affects: ["CLAUDE.md Tech Stack 估算修正候选", "Phase 1 起点 npm install 配方"]
tech-stack:
  added:
    - vite@^7 (build)
    - vite-bundle-visualizer (analyze)
    - "@vitejs/plugin-react@^4 (build)"
    - "@fluentui/react-components@^9 (UI; 显式去掉 @fluentui/tokens 显式依赖——react-components 已携带)"
    - "@lingui/react@^5 (i18n runtime; PO 文件 Phase 1 加)"
  patterns:
    - "Office.js 从 CDN script tag 加载（非 npm @microsoft/office-js）—— 零 bundle 体积"
    - "Fluent UI v9 具体组件 import（非 barrel），规避 Pitfall 6"
    - "manualChunks 拆分 fluent / markdown 用于体积归因"
key-files:
  created:
    - spike/bundle-test/package.json
    - spike/bundle-test/vite.config.ts
    - spike/bundle-test/tsconfig.json
    - spike/bundle-test/index.html
    - spike/bundle-test/src/main.tsx
    - spike/bundle-test/.gitignore
    - spike/bundle-test/README.md
  modified:
    - .planning/spikes/009-bundle-size-baseline/findings.md
decisions:
  - "@fluentui/tokens 不需要显式依赖：v9 react-components 已携带 tokens；npm 上 @fluentui/tokens@9.x 不存在（最高 1.0.0-alpha.23）"
  - "Phase 1 CI gate 建议基线：raw 主入口 ≤ 600KB / raw 总 JS ≤ 800KB / 任意 chunk gzip ≤ 200KB"
  - "react-markdown + remark-gfm gzip 46KB > Fluent UI v9（5 组件）gzip 31KB，CLAUDE.md 估算待修正"
metrics:
  duration: "Task 1 在 worktree 内 ~15 分钟（含 npm install ~2 分钟、build ~40 秒）"
  completed: "2026-05-26"
---

# Phase 0 Plan 10：Bundle-size 基线 + 三宿主 Sideload Checklist Summary

**一句话总结：** Spike #9 在 worktree 内 build 出 raw ~450KB / gzip ~135KB 的开发基线（远低于 1MB 硬限 / 300KB 参考线），并发现 react-markdown 比 Fluent UI v9 更重的反直觉事实；Spike #10 三宿主 sideload 测试需用户在真实浏览器执行，已提供完整 checklist + 操作指南，等待 checkpoint。

## 状态

| Task | 类型 | 状态 | 提交 |
|---|---|---|---|
| Task 1 — 创建 bundle-test Vite 项目 | auto | ✅ 完成 | `202c2a5` |
| Task 2 — Bundle 构建测量 + 三宿主 sideload 实测 | checkpoint:human-verify | ⏸ 等待用户在本地浏览器手动执行 | — |

## Spike #9 — Bundle-size 基线（worktree 跑通数据）

**栈：** Vite 7.3.3 + React 19 + Fluent UI v9.74.0 + Zustand 5 + react-markdown 9 + remark-gfm 4 + @lingui/react 5 + Office.js CDN（非 bundle）

**npm install：** 288 个包，无错误（去掉 `@fluentui/tokens` 显式依赖后通过）

**`npm run build` 输出：**

| Chunk | Raw | Raw (KB) | Gzip (gzip -9) | Gzip (KB) |
|---|---|---|---|---|
| `index-ndkwTGUX.js`（app + React + ReactDOM + Zustand） | 179,175 B | 175 | 56,385 B | 55 |
| `fluent-CuCWLq0T.js`（Fluent UI v9 — 5 components） | 113,528 B | 111 | 31,520 B | 31 |
| `markdown-wsTzB8PF.js`（react-markdown + remark-gfm） | 156,864 B | 153 | 47,202 B | 46 |
| `react-l0sNRNKZ.js`（空，已被 inline） | 1 B | 0 | 21 B | 0 |
| `index.html` | 656 B | 0.6 | 437 B | 0.4 |
| **JS 合计** | **~450,000 B** | **~440** | **~135,000 B** | **~132** |

**对照目标：**

- 硬限 raw ≤ 1MB：**通过**（440 KB / 1024 KB = 43%）
- 参考线 gzip ~300KB：**通过**（132 KB / 300 KB = 44%）

**主要体积占比（gzip）：**

| 占比 | 块 |
|---|---|
| 42% | index（app + React + ReactDOM + Zustand + Lingui runtime） |
| 35% | react-markdown + remark-gfm |
| 23% | Fluent UI v9（5 个组件 + provider） |

### Phase 1 finding — CLAUDE.md 估算待修正

CLAUDE.md Tech Stack 的 component-by-component 估算表：

> React 19 + ReactDOM | ~45 KB
> Fluent UI v9 (only used components) | ~120 KB
> Griffel + tokens | ~15 KB
> Zustand | ~1.2 KB
> react-markdown + remark-gfm | ~40 KB

实测：5 组件的 Fluent v9 只占 **31 KB gzip**（远低于 120KB 估算）；react-markdown + remark-gfm 占 **46 KB gzip**（略高于 40KB 估算）。

**直接结论：**

1. Fluent UI v9 tree-shaking 比 CLAUDE.md 假设的更激进——只装 5 组件时 ~31KB
2. react-markdown 是相对最大的"开销/价值比偏低"项—— Phase 1 可考虑：
   - 流式输出期间纯文本渲染，stream 完成后再 lazy-mount markdown
   - 评估更小渲染器（`marked` 8KB + `dompurify` 22KB ≈ 30KB）

### Phase 1 CI gate 建议基线

基于 worktree 实测 + 给 Phase 1 留出 ~3-5x 增长空间（chat history、设置面板、Onboarding、错误边界等会逐步加入）：

| 阈值 | 值 |
|---|---|
| Raw 主入口 chunk | ≤ 600 KB |
| Raw 总 JS（所有 chunks） | ≤ 800 KB |
| 任意单 chunk gzip | ≤ 200 KB |
| 总 gzip | ≤ 350 KB（与 CLAUDE.md 300KB 估算对齐） |

## Spike #10 — 三宿主 Sideload Checklist（待用户执行）

**Plan 02 已交付的 `spike/manifest.xml`** 三宿主结构（PowerPoint / Excel / Word）+ SourceLocation 指向 `https://wynne-cwb.github.io/Aster/`，所以 Task 2 sideload 测试可以直接复用——不需要再生成 manifest。

用户需在 Task 2 checkpoint 阶段执行下列 checklist（详见 [`.planning/spikes/010-sideload-checklist/findings.md`](../../spikes/010-sideload-checklist/findings.md)）：

| # | 宿主 | 浏览器 | Profile | 预期 |
|---|---|---|---|---|
| 1 | PowerPoint for Web | Edge | InPrivate | Ribbon 出现"打开 Aster"，点击后 Task Pane 加载 GitHub Pages 内容 |
| 2 | PowerPoint for Web | Chrome | 隐身 | 同上 |
| 3 | Excel for Web | Edge | InPrivate | 同上 |
| 4 | Excel for Web | Chrome | 隐身 | 同上 |
| 5 | Word for Web | Edge | InPrivate | 同上 |
| 6 | Word for Web | Chrome | 隐身 | 同上 |

**Sideload 路径（Office for Web 通用）：**

1. 浏览器开 InPrivate / 隐身窗口（每个组合独立）
2. 登录 Microsoft 账号
3. 打开宿主（在 office.com 或 office365.com 新建对应类型文档）
4. 菜单：插入 → 获取加载项 → 上传我的加载项 → 浏览 → 选 `spike/manifest.xml`
5. 确认 ribbon 上"Aster"分组 + "打开 Aster"按钮出现
6. 点击 → Task Pane 加载 `https://wynne-cwb.github.io/Aster/` 内容（含 Office.onReady 后显示 host 名）
7. 截图保存到 `.planning/spikes/010-sideload-checklist/`

**PASS 条件：** ≥ 4/6 组合成功（至少 PPT + Excel + Word × Edge 通过）

**用户返回 checkpoint 时填写：**

- 6 个组合的实际结果（PASS / FAIL + 失败原因）
- 更新 010 findings.md 表格 + 首行 PASS/FAIL
- 更新 `.planning/spikes/MANIFEST.md` Spike #9 与 #10 状态（非 PENDING）
- 用户也可在本地跑 `cd spike/bundle-test && npm run build` 复测 + `npm run analyze` 出 visualizer 截图，刷新 009 findings.md 首行为 PASS

## 任务清单

### Task 1 — 创建 bundle-test Vite 项目（commit `202c2a5`）

实施步骤：

1. 创建 `spike/bundle-test/` 子目录 + `src/`
2. 写 `package.json`：
   - dependencies：react 19、react-dom 19、@fluentui/react-components ^9.73、zustand ^5、react-markdown ^9、remark-gfm ^4、@lingui/react ^5
   - devDependencies：@types/office-js、@types/react ^19、@types/react-dom ^19、typescript ^5.7、vite ^7、@vitejs/plugin-react ^4、vite-bundle-visualizer
3. 写 `vite.config.ts`：React plugin + manualChunks 拆 fluent / markdown / react
4. 写 `tsconfig.json`：TS 5.7 strict + react-jsx + office-js types
5. 写 `index.html`：CDN 加载 Office.js + `<div id="root">` + `/src/main.tsx`
6. 写 `src/main.tsx`：FluentProvider + 5 个具体 import 的 Fluent 组件 + Zustand chat store + react-markdown
7. 写 `.gitignore`：node_modules / dist / package-lock / stats.html
8. 写 `README.md`：用法 + 严禁加入的包清单
9. `npm install`：288 包成功
10. `npm run build`：4 chunks（含 1 个空 react chunk）成功
11. 更新 009 findings.md 测试步骤 + worktree 跑通的开发基线数字

验证：

- 8 项 acceptance criteria 全部 pass：
  - `package.json` 存在 ✓
  - 不含 `@microsoft/office-js` ✓（grep -c = 0）
  - 含 `@fluentui/react-components` ✓
  - 不含 OpenAI / Anthropic / ai-sdk ✓
  - `vite.config.ts` 存在 ✓
  - main.tsx 具体 import Fluent 组件 ✓
  - main.tsx 含 zustand ✓
  - main.tsx 含 react-markdown ✓

### Task 2 — 手动 bundle 测量 + 三宿主 sideload（checkpoint, 等待用户）

待用户在本地执行。指南已在上文「Spike #10」部分给出。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] 删除 `@fluentui/tokens@^9.0.0` 显式依赖**

- **Found during：** Task 1（npm install）
- **Issue：** plan package.json 模板 写了 `"@fluentui/tokens": "^9.0.0"`，但 npm 上 `@fluentui/tokens` 没有 9.x 版本（最高稳定 `1.0.0-alpha.23`）。`npm install` 抛 `ETARGET No matching version found for @fluentui/tokens@^9.0.0`。
- **Fix：** 删除 `package.json` 与 `vite.config.ts` 中的 `@fluentui/tokens` 显式引用。`@fluentui/react-components` 已携带 tokens；webLightTheme 可直接 import，bundle 验证不受影响。
- **Files modified：** `spike/bundle-test/package.json`、`spike/bundle-test/vite.config.ts`
- **Commit：** 包含在 `202c2a5`
- **CLAUDE.md 链接修正建议：** Tech Stack 表里 `@fluentui/tokens` 写 9.x 是过时的；实际 Microsoft 已经把 tokens 单独包切到 1.x alpha 线，但因为 react-components 携带，应用层不需要直接装

**2. [非 deviation；plan 与 user prompt 合并] 加入 `@lingui/react` 依赖**

- **背景：** plan package.json 模板没有 `@lingui/react`，但 user prompt 的 success_criteria 列出 `@lingui/react`。
- **决策：** 装上 `^5.0.0`（CLAUDE.md Tech Stack 锁定 Lingui 5）。Lingui runtime 也是 Phase 1 起就要在 main bundle 里，所以加入 baseline 测量更接近真实 Phase 1 起点。
- **影响：** 已计入 worktree 实测 gzip ~135KB；仍远低于目标。

### Architectural Changes

None.

## 偏离 Plan 之外的关键决定

1. **CI gate 数字推荐**（plan 没要求，但 worktree 跑了 build 自然得出基线）：见上文 "Phase 1 CI gate 建议基线" 表
2. **markdown 比 Fluent 重的反直觉发现**：纳入 SUMMARY 与 findings.md，等 Phase 1 实施时验证 lazy-load 收益
3. **React chunk 为空 1B**：manualChunks 把 `react`/`react-dom` 拆出但应用直接 import 它们时 rollup 把模块内联进调用方 chunk—— 非 bug，是 rollup 默认行为；下次若需精确分离 React 可以用 `splitVendorChunkPlugin` 或显式 dynamic import 模式

## Threat Flags

None — 本 plan 不新增网络端点 / auth path / 文件访问 surface。manifest.xml 已存在且无变更。

## Known Stubs

None — bundle-test 是独立 spike 项目，不喂数据给 v1 UI；所有 UI 状态来自 Zustand store（用户输入实时驱动），不存在 hardcoded 空数据。

## 自检（Self-Check）

- `spike/bundle-test/package.json` 存在 ✓
- `spike/bundle-test/vite.config.ts` 存在 ✓
- `spike/bundle-test/index.html` 存在 ✓
- `spike/bundle-test/src/main.tsx` 存在 ✓
- `spike/bundle-test/.gitignore` 存在（含 node_modules / dist）✓
- `node_modules` / `dist` 不在 git 跟踪范围（`git check-ignore` 确认）✓
- `npm install` 跑通（288 包）✓
- `npm run build` 跑通（4 chunks，~450KB raw / ~135KB gzip）✓
- `.planning/spikes/009-bundle-size-baseline/findings.md` 更新 ✓
- Commit `202c2a5` 已记录 ✓
- 不修改 `.planning/STATE.md` / `.planning/ROADMAP.md` ✓
- Task 2 是 checkpoint，按 plan 设计等待用户手动执行三宿主 sideload ✓

## Self-Check: PASSED
