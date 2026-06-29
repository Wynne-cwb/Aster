---
phase: quick-260629-eg8
plan: 01
subsystem: wps-probe
tags: [wps, publish-mode, installer, phase-30]
requires:
  - "wpsjs 2.2.3 官方 publish.html 模板（/tmp/wpsjs-gen，预研已确认）"
  - "现有 public/wps-probe/ 探针资产（jsplugins.xml / ribbon.xml / index.html / probe.js）"
provides:
  - "public/wps-probe/publish.html — WPS publish 模式在线安装器（个人版 12.1.0.16910+ 唯一可用安装路径）"
  - "README 真实可用的三路径安装说明（A: oem.ini / B: publish 模式 / 安全说明+使用保留）"
affects:
  - "WPS 个人版用户的探针安装路径（解除 Phase 30 真机 go/no-go 安装阻碍）"
tech-stack:
  added: []
  patterns:
    - "字节级复制官方 wpsjs 模板 + 两处占位符替换（curList JSON + serverid），不手敲安装 JS"
key-files:
  created:
    - "public/wps-probe/publish.html"
  modified:
    - "public/wps-probe/README.md"
decisions:
  - "publish.html 为并行新增路径，不替换/不触碰现有 jsplugins.xml 在线 sideload 配置"
  - "curList 字段（online/multiUser 字符串值、URL 结尾斜杠）按预研锁定值注入，不改动"
metrics:
  duration: "~5 min"
  completed: "2026-06-29"
  tasks: 2
  files: 2
---

# Quick 260629-eg8: WPS publish.html 安装器 + README 安装章节更新 Summary

把 Phase 30 WPS 探针从「仅 jsplugins.xml 在线 sideload」扩展为「额外提供 wpsjs publish 模式在线安装器」——字节级复制官方 wpsjs 2.2.3 模板做两处占位符替换生成 publish.html，并把 README 旧的「联系 Claude 获取方案」占位替换为真实可用的 publish 模式三步安装路径，解除 WPS 个人版（12.1.0.16910+ 禁用 oem.ini/jsplugins）的探针安装阻碍。

## 完成的任务

| Task | 名称 | Commit | 文件 |
| ---- | ---- | ------ | ---- |
| 1 | 用官方模板 + 两处占位符替换生成 publish.html | f5aea88 | public/wps-probe/publish.html（新增） |
| 2 | README 路径 B 替换为真实 publish 模式安装步骤 | 5e73d33 | public/wps-probe/README.md（编辑） |

## 实现要点

- **publish.html（45095 字节）**：从 `/tmp/wpsjs-gen/node_modules/wpsjs/src/lib/res/publish.html`（官方 wpsjs 2.2.3 模板，45574 字节）字节级读取，node 脚本做两处 `.replace()`：
  - `PUBLISH_REPLACE_STRING` → curList JSON（et + wpp 两条 AsterProbe，online="true"、multiUser="false"、url 以 `/` 结尾，镜像现有 jsplugins.xml）
  - `SERVERID_REPLEASE_STRING` → `undefined`（单用户 multiUser=false）
  - 模板自包含安装 JS（与 WPS 本地服务 127.0.0.1:58890 通信）+ 内嵌 base64 favicon，未手敲一行 JS。
- **README**：用 Edit 工具精准替换旧路径 B 段落，新增 publish 模式 3 步安装 + 浏览器授权提示 + JsApiPlugin 冲突注意，并补个人版 12.1.0.16910 安全限制背景说明。路径 A、安全说明、使用、完整真机验证清单、页脚全部保持原样。

## 验证

- Task 1 自动化验证 PASS：AsterProbe x2（grep -o 计 2，et + wpp 两条 addonType 确认）、无 PUBLISH_REPLACE_STRING/SERVERID_REPLEASE_STRING 残留、github.io URL 就位。
- Task 2 自动化验证 PASS：无「联系 Claude 获取方案」旧占位、含 publish.html 链接、含 publish 模式说明、含 12.1.0.16910 版本号、路径 A 与安全说明章节完整保留。
- 边界核对：jsplugins.xml / index.html / probe.js / ribbon.xml 未被触碰（git status --short public/wps-probe/ 仅显示两个目标文件已提交，无其它改动）；src/ 与主应用零改动。

## Deviations from Plan

None - plan executed exactly as written.

## 部署状态（发布类改动 — 待显式最终步骤）

⚠️ **两个文件已写入 + 已本地 commit（f5aea88、5e73d33），但尚未 push — 线上 `https://wynne-cwb.github.io/Aster/wps-probe/publish.html` 仍未更新。** 本地 commit ≠ 线上更新。

待执行的显式 build + push 步骤（执行者按计划不做，留给 orchestrator/用户）：
1. `npm run build`（Vite 把 public/ 原样拷进 dist/）
2. 确认 `dist/wps-probe/publish.html` 已生成
3. commit + `git push origin main` → 触发 GitHub Pages 部署
4. 部署后实测 `https://wynne-cwb.github.io/Aster/wps-probe/publish.html` 返回 200

## Self-Check: PASSED

- FOUND: public/wps-probe/publish.html
- FOUND: public/wps-probe/README.md（含 publish.html）
- FOUND commit: f5aea88（Task 1 publish.html）
- FOUND commit: 5e73d33（Task 2 README）
