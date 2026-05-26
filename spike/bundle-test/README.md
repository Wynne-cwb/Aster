# Spike #9 — Bundle-size 基线测试

> Phase 0 验证代码。Phase 1 不复用。

## 目的

测量 Aster 推荐栈最小组合的初始 bundle 大小：

- Vite 7（构建工具）
- React 19 + ReactDOM 19
- @fluentui/react-components v9（只 import Button/Input/Text/Spinner/FluentProvider）
- Zustand 5（状态）
- react-markdown 9 + remark-gfm 4（AI 回复 MD 渲染）
- @lingui/react 5（i18n 运行时，PO 内容 Phase 1 加）
- Office.js 从 CDN，**不计入 bundle**

目标：raw ≤ 1MB，gzipped ~300KB。

## 严禁加入的包（与 PITFALLS.md / CLAUDE.md 一致）

- `@microsoft/office-js`（npm 已 deprecated，必须 CDN）
- `mammoth`、`xlsx`、`pdfjs-dist`、`@jvmr/pptx-to-html`、`jszip`（Phase 2 lazy chunks，不进初始 bundle）
- `shiki`（仅在 AI 回复含 code block 时 lazy load）
- `openai` / `@anthropic-ai/sdk` / `ai` / `@ai-sdk/*`（直接 fetch + ReadableStream）
- `@fluentui/react` v8（不同库，不要混淆）
- `@fluentui/react-icons`（4MB tree-shake 陷阱，按需 dynamic import）

## 运行

```bash
cd spike/bundle-test
npm install
npm run build
# Vite build 输出会列出每个 chunk 的 raw 与 gzip 大小
ls -lh dist/assets/
```

可选 — 生成可视化报告（HTML，体积较大，不入仓）：

```bash
npm run analyze
# 产出 stats.html，浏览器打开查看各依赖体积占比
```

## 结果归档

构建输出截图 + 关键数字写入：

- `.planning/spikes/009-bundle-size-baseline/findings.md`
- `.planning/phases/00-spike-gating/00-10-SUMMARY.md`
