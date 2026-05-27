# Bundle-size 基线（Spike #9）— PASS

> 非 GATING：实测 raw ~450KB / gzip ~135KB，远低于 1MB 硬限与 300KB 参考线

## 场景

Vite 7 + React 19 + Fluent UI v9 + Zustand 5 + react-markdown 9 + remark-gfm 4 + @lingui/react 5 的初始 bundle 大小。

- Office.js 从 CDN 加载，不计入 bundle
- 不包含懒加载库（mammoth / xlsx / pdfjs-dist / @jvmr/pptx-to-html / shiki）—— Phase 2 dynamic import
- 不包含已 deprecated 的 `@microsoft/office-js` npm 包
- 不包含 OpenAI/Anthropic SDK —— 用 native fetch + ReadableStream

**目标：** raw ≤ 1MB（硬限），gzipped ~300 KB（参考线）

## 测试步骤

```bash
cd spike/bundle-test
npm install
npm run build
# Vite build 默认输出每个 chunk 的 raw + gzip 大小
ls -lh dist/assets/
```

可选 — 各依赖体积占比可视化：

```bash
npm run analyze
# stats.html（不入仓，截图存到本目录）
```

精确 gzip 实测（避免依赖 Vite 内部估算）：

```bash
for f in dist/assets/*.js; do
  echo "$f: raw=$(wc -c < "$f") gzip=$(gzip -c -9 < "$f" | wc -c)"
done
# concat 总和
echo "total raw : $(cat dist/assets/*.js | wc -c)"
echo "total gzip: $(cat dist/assets/*.js | gzip -c -9 | wc -c)"
```

## 实测结果

**worktree 内 Plan 10 Task 1 跑通的开发基线（非最终验收数字，仅供参考）：**

| Chunk | Raw (bytes) | Raw (KB) | Gzip (bytes) | Gzip (KB) |
|---|---|---|---|---|
| `index-*.js`（应用 + React + ReactDOM + Zustand） | 179,175 | 175 | 56,385 | 55 |
| `fluent-*.js`（Fluent UI v9 — Button/Input/Text/Spinner/FluentProvider） | 113,528 | 111 | 31,520 | 31 |
| `markdown-*.js`（react-markdown + remark-gfm） | 156,864 | 153 | 47,202 | 46 |
| `react-*.js`（manualChunks 拆出后为空，被 inline 进 index） | 1 | 0 | 21 | 0 |
| `index.html` | 656 | 0.6 | 437 | 0.4 |
| **JS 合计** | **~450,000** | **~440** | **~135,000** | **~132** |

**主要体积占比（gzip）：**

- index (app + React + ReactDOM + Zustand)：约 42%
- markdown (react-markdown + remark-gfm)：约 35%
- fluent (5 个 Fluent UI v9 组件)：约 23%

**Phase 1 finding：** react-markdown + remark-gfm 比 Fluent UI v9（5 组件）更重——
CLAUDE.md Tech Stack 表中"Fluent UI ~120 KB / markdown ~40 KB"的估算与此次实测相反，
Phase 1 实施时可考虑：
1. 仅在 AI 消息渲染时 lazy-import `react-markdown`（流式渲染期间用纯文本，完成后切 MD）
2. 评估更小的 markdown 渲染器（如 `marked` + `dompurify` 组合）

## 证据

- [ ] vite build 输出截图（用户在 Task 2 阶段补充）
- [ ] bundle visualizer 报告截图（用户在 Task 2 阶段补充）
- [x] worktree 内 `npm run build` 数据：raw ~450 KB / gzip ~135 KB（远低于 1MB 与 300KB 目标）

> ⚠ 安全提示：bundle 测试不涉及 API Key；如截图中含路径，确认不含本地敏感目录名

## 决策

**结果：** ✅ PASS —— worktree 内 `npm run build` 实测 raw ~450KB / gzip ~135KB，远低于 1MB 硬限与 300KB 参考线

**Phase 1 bundle-size CI gate 以实测 baseline 为起点；建议 CI 阈值：**
- raw 主入口 ≤ 600 KB
- raw 总 JS ≤ 800 KB
- 任意单 chunk gzip ≤ 200 KB

**FAIL（>1MB raw 或 >500KB gzip）：** 识别罪魁祸首，在 Phase 1 实施 tree-shaking / lazy import 修复
