# ⚠ 本目录是 Phase 0 验证代码，不是 v1 实现

所有 spike/ 下的代码在 Phase 0 结束后将被丢弃。Phase 1 从 Yo Office 重新起步，不复用此处任何代码。

## 目的

对 10 项最高风险做实证验证，决定 PRD 与架构是否可进入 Phase 1。

每项验证的证据归档在 `.planning/spikes/00X-{slug}/findings.md`。

## 安全约束

- spike 代码全部公开提交至 GitHub（Phase 0 决策 D-10）
- **绝不**在任何 HTML/JS 中 hardcode API Key —— 只能通过 UI 输入框读取（threat T-00-01-01）
- `.env`、`local.*`、`*.local` 等含 Key 的本地文件由 `.gitignore` 排除

## 生产 URL

- GitHub Pages：`https://wynne-cwb.github.io/Aster/`
- 部署 workflow：`.github/workflows/pages.yml`（main push 自动触发）
- manifest.xml SourceLocation 指向上述 URL
