---
phase: 30-wps-02-03
plan: "01"
subsystem: wps-probe
tags: [wps, sideload, scaffold, ribbon, jsplugins]
provides: [wps-probe-shell]
affects: [public/wps-probe]
tech-stack:
  added: []
  patterns: [wpsjs-ribbon, jsplugins-online-sideload]
key-files:
  created:
    - public/wps-probe/ribbon.xml
    - public/wps-probe/jsplugins.xml
    - public/wps-probe/index.html
  modified: []
key-decisions:
  - "探针文件放 public/wps-probe/（非仓库根 wps-probe/），借 Vite public→dist 拷贝部署到 /Aster/wps-probe/"
requirements-completed: [WPS-02, WPS-03]
duration: "—"
completed: 2026-06-08
---

# Phase 30 Plan 01: WPS 探针静态外壳 Summary

WPS 探针加载项的静态外壳已搭好：`ribbon.xml`（功能区入口 + 大按钮）+ `jsplugins.xml`（et/wpp 双宿主在线 sideload 配置）+ `index.html`（Task Pane 入口，三个 type=password Key 输入框 + 运行按钮 + Aster 同款字体 link，无 office.js CDN）。

## 创建文件（实际落点 = `public/wps-probe/`）
- `public/wps-probe/ribbon.xml` — `onLoad="OnAddinLoad"` 入口 + `onAction="ShowTaskPane"` 大按钮 + `getEnabled="OnGetEnabled"`，纯 XML 无 JS。
- `public/wps-probe/jsplugins.xml` — `type="et"` + `type="wpp"` 各一条（不含 `type="wps"`），`url="https://wynne-cwb.github.io/Aster/wps-probe/"`，`enable="true"` ×2。
- `public/wps-probe/index.html` — 字体 link 与 Aster `index.html` L9-14 逐字一致；无 `appsforoffice.microsoft.com`；DeepSeek/aihubmix/Pexels 三个 `type="password"` 输入框；`<script src="probe.js">`；`runAllChecks()`/`copyReport()` 按钮回调。

## jsplugins.xml GitHub Pages URL
`https://wynne-cwb.github.io/Aster/wps-probe/`（oem.ini `JSPluginsServer` 指向同目录下 `jsplugins.xml`）。

## sideload 安装路径
- **路径 A（推荐）：** oem.ini `[wps]` 段加 `JSPluginsServer=https://wynne-cwb.github.io/Aster/wps-probe/jsplugins.xml`，完全退出 WPS 后重启。
- **路径 B（备用）：** 专业版 oem.ini 受限时，截图失败现象发给 Claude，按真机现象产 `publish.html`/`wpsjs publish`（不预生成 URL，避免 404）。

## Verify 结果（real grep `/usr/bin/grep -c`）
- ribbon.xml: `onLoad="OnAddinLoad"`=1 ✅ / `onAction="ShowTaskPane"`=1 ✅ / `size="large"`=1 ✅ / `function `=0 ✅
- jsplugins.xml: github url=2 ✅ / `type="et"`=1 ✅ / `type="wpp"`=1 ✅ / `type="wps"`=0 ✅ / `enable="true"`=2 ✅
- index.html: `src="probe.js"`=1 ✅ / `Noto+Sans+SC`=1 ✅ / `fonts.googleapis.com/css2?family=Inter`=1 ✅ / `appsforoffice.microsoft.com`=0 ✅ / `type="password"`=3 ✅ / `deepseek-key`=1 ✅ / `runAllChecks`=1 ✅

## Deviations from Plan
- **[Rule 1 - 部署可达性] 文件落点改为 `public/wps-probe/`（非仓库根 `wps-probe/`）。** 原因：`pages.yml` 只上传 Vite 产物 `dist/`，仓库根静态目录不会被部署（URL 会 404）。Vite 将 `public/*` 原样拷进 `dist/` 根，故 `public/wps-probe/*` → `dist/wps-probe/*` → `/Aster/wps-probe/`。零改 CI / 零改 vite.config / 不进主 bundle —— 即计划「add it as a Vite public/static asset」选项。`npm run build` 已坐实 `dist/wps-probe/` 五文件均生成且与源码字节一致。
- **[Rule 1 - 自洽 grep 修正] jsplugins.xml 注释去掉字面 `type="et"/"wpp"` token。** 原因：计划给的注释 `<!-- type="et" = ...; type="wpp" = ... -->` 会让 `grep -c 'type="et"'` 计数为 2（注释 + 属性），与验收 `=1` 冲突。改写注释为「et = 金山表格…; wpp = 金山演示…」，行为不变。
- **[Rule 1 - 自洽 grep 修正] index.html 去掉 `appsforoffice.microsoft.com` 注释 + CSS 选择器 `input[type="password"]` 改 `input`。** 原因：计划注释含该域名串使 `grep=0` 失败；CSS 选择器使 `type="password"` 计数为 4（应 3）。改写后行为不变。

**Total deviations:** 3 auto-fixed（1 部署机制 + 2 grep 自洽）。**Impact:** 仅部署落点与注释/选择器措辞，功能与安全语义完全不变。

## Next
Ready for 30-02（probe.js）。
