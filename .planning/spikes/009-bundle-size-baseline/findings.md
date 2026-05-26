# Bundle-size 基线（Spike #9）— PENDING

> 非 GATING：FAIL（>1MB）需识别原因，不止损

## 场景

Vite + React 19 + Fluent UI v9 + Zustand + react-markdown + remark-gfm 的初始 bundle 大小。
目标：gzipped ≤ 300KB（硬限 ≤ 1MB raw）。

## 测试步骤

1. 在 spike/ 创建 bundle-test/ 子目录，初始化最小 Vite + React 19 项目
2. 安装 @fluentui/react-components + zustand + react-markdown + remark-gfm
3. 仅引入用到的组件（Button, Input, Drawer — Pitfall 6 barrel import 警告）
4. 运行 vite build --mode production
5. 使用 npx vite-bundle-visualizer 或 rollup-plugin-visualizer 生成报告
6. 记录 index.js 原始大小 + gzip 大小

## 实测结果

index.js 原始大小：（待填）
gzip 大小：（待填）
主要体积占比：（待填，如 Fluent UI XX KB、React XX KB）

## 证据

- [ ] vite build 输出截图
- [ ] bundle visualizer 报告截图

> ⚠ 安全提示：bundle 测试不涉及 API Key；如截图中含路径，确认不含本地敏感目录名

## 决策

**结果：** PENDING

**PASS 条件（gzipped ≤ 300KB）：** Phase 1 bundle-size CI gate 以此为基线
**FAIL（>1MB raw）：** 识别罪魁祸首，在 Phase 1 实施 tree-shaking 修复
