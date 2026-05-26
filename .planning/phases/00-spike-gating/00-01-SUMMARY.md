---
phase: 00-spike-gating
plan: "01"
subsystem: infra
tags: [github-pages, github-actions, office-addin, manifest, cdn, hosting]

# Dependency graph
requires: []
provides:
  - "GitHub Pages 自动部署 workflow（main push → spike/ 发布到 https://wynne-cwb.github.io/Aster/）"
  - "spike/ 目录骨架（README 免责声明、Office.js CDN 验证页、三宿主 XML manifest 骨架、安全 .gitignore）"
  - "GATING #1 CORS 验证所需的真实生产 https origin"
  - "10 项 spike 共享的 manifest sideload 入口"
affects:
  - 00-02-evidence-scaffold
  - 00-03-cors-verify
  - 00-04-ppt-writeback
  - 00-05-storage-scope
  - 00-10-bundle-sideload
  - 00-11-manifest-finalize

# Tech tracking
tech-stack:
  added:
    - "GitHub Actions (actions/checkout@v4, configure-pages@v5, upload-pages-artifact@v3, deploy-pages@v4)"
    - "Office.js CDN loader (https://appsforoffice.microsoft.com/lib/1/hosted/office.js)"
    - "XML Office Add-in manifest（三宿主 + 共享 runtime）"
  patterns:
    - "spike/ 与 v1 代码物理隔离（D-08 丢弃式）"
    - "GitHub Pages 静态托管 + path: spike 限定发布范围"
    - "manifest hardcode 生产 URL（spike 期不引入构建期模板替换）"

key-files:
  created:
    - ".github/workflows/pages.yml"
    - "spike/README.md"
    - "spike/index.html"
    - "spike/manifest.xml"
    - "spike/.gitignore"
    - "spike/assets/icon-16.png"
    - "spike/assets/icon-32.png"
    - "spike/assets/icon-80.png"
  modified: []

key-decisions:
  - "GitHub Pages URL 形态锁定为 https://wynne-cwb.github.io/Aster/（基于 origin remote `git@github.com:Wynne-cwb/Aster.git` 推断；GitHub 用户名规范化为小写 wynne-cwb，仓库名保留原大小写 Aster）"
  - "workflow 使用 path: spike 仅发布 spike/ 子目录，避免把 .planning/ 与 prds/ 暴露到 Pages"
  - "manifest AppDomains 含 api.deepseek.com + api.aihubmix.com（Pitfall 15：仅为 v1.1 Desktop 导航安全；Web 版不依赖此 bypass CORS）"
  - "manifest 图标用 1×1 透明 PNG 占位，避免 sideload 时图标 404（Pitfall 14 cache-control 问题留到 Phase 1）"
  - "spike/.gitignore 排除 .env / local.* / *.local（threat T-00-01-01）以及 *.mp4 / *.mov（>100MB 走 Release attachments，D-10）"

patterns-established:
  - "Phase 0 spike 命名规范：spike/{topic}.html 顶层平铺，证据归档到 .planning/spikes/00X-{slug}/"
  - "GitHub Actions 最小权限：仅 pages:write + id-token:write，不声明 contents:write（threat T-00-01-02）"
  - "Office.js 一律从官方 CDN 加载，禁止用 npm @microsoft/office-js（已 deprecated）"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-05-26
---

# Phase 0 Plan 01: GitHub Pages 托管 + CI 自动部署 Summary

**spike/ 静态托管 pipeline 落地：`.github/workflows/pages.yml` 把 spike/ 子目录推到 `https://wynne-cwb.github.io/Aster/`，Office.js CDN 验证页 + 三宿主 XML manifest 骨架就绪，GATING #1 CORS 验证的真实 https origin 前置条件满足。**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-26T12:26:59Z
- **Completed:** 2026-05-26T12:29:28Z
- **Tasks:** 2
- **Files created:** 8

## Accomplishments

- **GitHub Actions 自动部署 workflow**：main push 自动触发，无 build step，actions 版本全部锁定（v4/v5/v3/v4，不用 @latest 避免漂移），最小权限（pages:write + id-token:write）
- **spike/ 骨架**：README 免责声明（D-08）+ Office.js CDN 加载页 + 三宿主 XML manifest（Presentation/Workbook/Document，共享 runtime，SourceLocation 指向生产 Pages URL）
- **Security baseline**：.gitignore 排除任何含 Key 的本地文件，1×1 透明 PNG 占位图标避免 manifest 引用 404，AppDomains 同时为 v1.1 Desktop 导航安全做好准备
- **GATING #1 前置依赖满足**：CORS 验证需要的真实 https origin 现在可由 GitHub Pages 提供

## Task Commits

每个 task 原子提交：

1. **Task 1：创建 GitHub Actions Pages 部署 workflow** — `a6768cf` (ci)
2. **Task 2：创建 spike/ 骨架（README + index.html + manifest.xml）** — `5639f1a` (feat)

_Plan metadata commit（SUMMARY.md）将在本 SUMMARY 写入后由 execute-plan.md 提交。_

## Files Created/Modified

- `.github/workflows/pages.yml` — GitHub Actions workflow，main push 自动部署 spike/ 到 GitHub Pages，固定 actions 版本，最小权限
- `spike/README.md` — Phase 0 免责声明 + 安全约束 + 生产 URL 说明（首行含警告 emoji + "Phase 0 验证代码，不是 v1 实现"）
- `spike/index.html` — Office.js CDN 加载验证页，`Office.onReady` 输出宿主名与平台
- `spike/manifest.xml` — 三宿主 XML manifest 骨架，SourceLocation = `https://wynne-cwb.github.io/Aster/`，Shared.Runtime.Url lifetime=long，AppDomains 含 deepseek + aihubmix
- `spike/.gitignore` — 排除 .env / *.local / *.mp4 / *.mov（threat T-00-01-01）
- `spike/assets/icon-{16,32,80}.png` — 1×1 透明 PNG 占位，避免 manifest 图标 URL 404

## Decisions Made

- **GitHub Pages URL 推断**：origin remote 为 `git@github.com:Wynne-cwb/Aster.git`，GitHub Pages URL 标准化为 `https://wynne-cwb.github.io/Aster/`（host 部分小写、repo 部分大小写敏感）。注意与 00-CONTEXT.md D-02 示例 `wb-chen.github.io/aster` 不同——以实际 origin 为准。
- **workflow path 限定**：用 `path: spike` 限定上传根，避免 GitHub Pages 把 `.planning/` 和 `prds/` 整目录暴露（即便它们已在仓库公开，单独发布到 Pages 会增加被搜索引擎索引到的概率）。
- **占位图标策略**：1×1 透明 PNG 是最小合法 PNG（70 字节），既能让 manifest XML schema 满足图标引用要求，也避免 sideload 时 404 黄色警告。真正的图标设计留到 Phase 1。
- **manifest 中 URL 硬编码**：spike 期接受 hardcode，不引入构建期模板替换。Phase 1 用 Yo Office 时会引入 webpack/vite 的 URL 注入机制。

## Deviations from Plan

None — plan executed exactly as written. 计划中"executor 必须运行 `git remote get-url origin` 推断 Pages URL 并替换所有 REPLACE 占位符"已照办。所有 acceptance_criteria 在 commit 前 grep 验证通过。

## Issues Encountered

- 工具链 quirk：本地 `grep -c` 在 0 匹配时返回非零退出码，被 RTK wrapper 转译为"错误"。改用 `rtk proxy grep -c` 直接验证，确认 manifest.xml 中 0 个 REPLACE 占位符、10 个 https:// URL，符合 acceptance criteria。不影响产出。

## User Setup Required

**GitHub 仓库需启用 Pages（一次性操作）：**

orchestrator 合并 worktree 分支到 main 之后，仓库 Owner 需要在 GitHub Web UI 完成以下一次性配置：

1. 打开 `https://github.com/Wynne-cwb/Aster/settings/pages`
2. **Source** 选择 `GitHub Actions`（不要选 "Deploy from a branch"）
3. 保存后，下一次 main push 会触发 `.github/workflows/pages.yml`，部署完成后 Pages URL 会显示在 Actions run 的 environment 输出
4. 验证：浏览器访问 `https://wynne-cwb.github.io/Aster/`，应返回 `<h1>Aster Phase 0 Spike</h1>` 并在 console 看到 Office.js script 加载（404 触发：404 不应出现）

**为什么这一步无法自动化：** GitHub Pages 启用是仓库设置变更，需要仓库管理员权限。`gh api repos/Wynne-cwb/Aster/pages -X POST -f build_type=workflow` 命令可以替代 UI 操作，但仍需仓库管理员个人 token，超出本 plan 范围。

## Threat Flags

无新增威胁面。本 plan 的 threat register（T-00-01-01 hardcode Key、T-00-01-02 workflow 权限过宽、T-00-01-03 manifest 公开）均在 mitigation 阶段处理完毕：
- T-00-01-01：spike/.gitignore 排除 Key 文件；spike HTML 不含任何 fetch/auth 代码（GATING #1 之前不会真实调 API）
- T-00-01-02：pages.yml 仅声明 `contents: read` + `pages: write` + `id-token: write`，无 `contents: write`
- T-00-01-03：accept（manifest 只含 URL，无 secret）

## Next Phase Readiness

**Ready for Wave 1 后续 / Wave 2：**
- **00-02-evidence-scaffold**：可以并行起，spike/ 目录已存在，证据归档目录 `.planning/spikes/` 由 02 plan 创建
- **00-03-cors-verify (GATING #1)**：依赖本 plan 的生产 https URL。一旦仓库 Pages 启用，CORS 验证页可放在 `spike/cors-test.html`，从 `https://wynne-cwb.github.io/Aster/cors-test.html` 触发对 DeepSeek/aihubmix 的真实跨域请求
- **00-11-manifest-finalize**：本 plan 的骨架将在 11 plan 中扩展为完整 manifest

**已知留待 Phase 1 处理（不阻塞 Phase 0）：**
- 占位图标 → 真实 brand 图标（Phase 1 设计阶段）
- INSTALL-05 Cache-Control（GitHub Pages 默认 10min，若 #10 sideload 暴露问题再评估迁 Cloudflare Pages，PITFALLS Pitfall 14）
- manifest 中的 URL 模板化（Phase 1 用 Yo Office + 构建期注入）

**留意事项：**
- worktree 合并到 main 时，确认 `.github/workflows/pages.yml` 与 `spike/` 都被合入。仅合 `.github/workflows/pages.yml` 而漏 `spike/` 会导致 workflow 启动后因 `path: spike` 不存在而失败。
- 仓库 Pages 设置必须由 owner 一次性启用（见 User Setup Required 节）。在此之前 workflow 会跑成功但 Pages URL 返回 404 直到 settings 切到 "GitHub Actions"。

## Self-Check: PASSED

**Files verified:**
- `.github/workflows/pages.yml` — FOUND
- `spike/README.md` — FOUND
- `spike/index.html` — FOUND
- `spike/manifest.xml` — FOUND
- `spike/.gitignore` — FOUND
- `spike/assets/icon-16.png` — FOUND (PNG 1x1)
- `spike/assets/icon-32.png` — FOUND (PNG 1x1)
- `spike/assets/icon-80.png` — FOUND (PNG 1x1)

**Commits verified:**
- `a6768cf` (Task 1: workflow) — FOUND in git log
- `5639f1a` (Task 2: spike skeleton) — FOUND in git log

**Acceptance criteria re-verified:**
- pages.yml: `branches: [main]` ✓, `deploy-pages@v4` ✓, `upload-pages-artifact@v3` ✓, `path: spike` ✓, `pages: write` ✓
- spike/README.md 首行含 "Phase 0 验证代码，不是 v1 实现" ✓
- spike/index.html 含 `appsforoffice.microsoft.com/lib/1/hosted/office.js` ✓
- spike/manifest.xml 三宿主 `xsi:type="Presentation"` / `"Workbook"` / `"Document"` 各 1 处 ✓
- spike/manifest.xml 中 0 个 REPLACE 占位符 ✓
- spike/manifest.xml 中 10 个 `https://` URL（>=3 要求）✓
- spike/.gitignore 存在 ✓

---
*Phase: 00-spike-gating*
*Plan: 01-hosting-ci*
*Completed: 2026-05-26*
