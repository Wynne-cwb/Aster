---
phase: 18-lib
plan: "03"
subsystem: frontend
tags: [settings, pexels-key, attribution, stock-image-card, teal-quiet, lib-01, lib-03, nfr-09]
dependency_graph:
  requires: [PEXELS_API_KEY, stock-image-attribution-data]
  provides: [pexels-key-settings-field, stock-image-result-card]
  affects: [src/components/]
tech_stack:
  added: []
  patterns: [pref-section, lazy-suspense-card, teal-css-vars, lingui-trans-macro]
key_files:
  created:
    - src/components/StockImageResultCard.tsx
  modified:
    - src/components/Settings/SettingsPanel.tsx
    - src/components/ChatStream.tsx
    - src/styles.css
    - src/i18n/locales/zh-CN/messages.po
    - src/components/Settings/SettingsPanel.test.tsx
    - src/lib/storage.test.ts
    - src/agent/tools/read/tools.test.ts
decisions:
  - "Pexels key 输入框用 .input 类（ProviderForm 的 API-key 字段同款单行 teal 输入），非 plan 建议的 .aster-settings__pref-input（后者是 textarea：min-height:80px+resize，不适合单行 key）"
  - "StockImageResultCard 与生图 ImagePreviewCard 互斥识别：图库 = data.thumbnail_url(URL)+photographer；生图 = data.thumbnail(base64)。两 derivation 在 ChatStream 并列，条件互不命中"
  - "署名样式复用 .img-result-card 体系 + 新增 .img-result-card__attribution（全 CSS 变量 --text-3/--accent/--accent-hover/--space-1/--fs-11，无硬编码）"
  - "外链 rel=noopener noreferrer（防 tabnabbing T-18-08）；不叠水印（署名只在 chat）"
  - "storage.test（9→11 键）+ read/tools.test（word 18→19/ppt 20→21 + PPT_WRITE_TOOLS 补 search_and_insert_stock_image）= 18-01/18-02 注册的必然计数后果，全量回归才暴露，折入本 plan 修复"
metrics:
  completed: "2026-06-03T02:07:56Z"
  tasks_completed: 4
  files_modified: 7
---

# Phase 18 Plan 03: Settings Pexels key 字段 + chat 署名卡 Summary

**一句话：** Settings 新增独立「图库 / Pexels API Key」密码态字段（BYO，存 PEXELS_API_KEY/清空走 remove）；chat 内新增 StockImageResultCard 只读署名卡（远程 URL 缩略图 + Pexels/摄影师可点链接，不叠水印，lazy 守 bundle）；teal 克制全 CSS 变量、全中文、extract 已同步；bundle 80.53KB/82KB。

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | SettingsPanel 新增 Pexels API Key pref-section（密码态） | SettingsPanel.tsx |
| 2 | 新建 StockImageResultCard.tsx + styles.css 署名样式 | StockImageResultCard.tsx, styles.css |
| 3 | ChatStream 识别图库结果并 lazy 渲染署名卡（与生图卡互斥） | ChatStream.tsx |
| 4 | i18n extract + SettingsPanel 存储 round-trip 测试 + bundle gate | messages.po, SettingsPanel.test.tsx |

## Settings 输入框最终形态

- `<input type="password" className="input" id="setting-pexels-key" autoComplete="off">`——单行密码态（遮蔽），无显隐切换 / 无「测试 Key」按钮（最简，teal 克制）。
- setPexelsApiKey：trim 后非空 → `storage.set(PEXELS_API_KEY)`；空 → `storage.remove(PEXELS_API_KEY)`。
- **偏差**：用 `.input`（ProviderForm API-key 同款单行类）而非 plan 建议的 `.aster-settings__pref-input`——后者是 textarea 样式（min-height:80px + resize:vertical），单行 key 用之会变成可拉伸多行框，体验差。`.input` 是 codebase 既有单行 teal 输入规范。

## StockImageResultCard 与生图卡互斥识别

- 图库：`d.inserted===true && typeof d.thumbnail_url==='string' && typeof d.photographer==='string'` → StockImageResultCard（远程 URL 缩略图）。
- 生图：`d.inserted===true && typeof d.thumbnail==='string'`（base64）→ ImagePreviewCard。
- 两 derivation 字段不重叠（图库无 thumbnail base64，生图无 thumbnail_url/photographer），条件天然互斥。

## i18n extract

- `npm run extract` → messages.po 净 +58/-30 行（zh-CN 源 148 条，0 missing）。新增宏：「图库 / Pexels API Key」「Pexels API Key」「粘贴 Pexels API Key」「用于从 Pexels 免费图库…」「照片来自」「已插入到 PPT」「已插入到 Word」。
- ⚠️ 执行坑：rtk hook 会把裸 `npx lingui extract` 误改写为 `npm ... lingui`（Missing script）→ 静默不生效；必须用 `npm run extract`。coverage.test.ts 内部 execSync('npx lingui extract') 在 node 层正常，最终 PASS。

## bundle size（先 build 再 size）

- 18-03 后 `npm run build && npm run size`：**main-*.js = 80.53 kB gzip / 82 kB 门**（margin ~1.47 KB）。
- StockImageResultCard 独立 lazy chunk（`StockImageResultCard-*.js`，不进 main）；Settings 字段在 SettingsPanel chunk；ChatStream stockResult derivation +~0.3KB 进 main（80.22→80.53）。**未触发任何懒加载降级。**

## 自动化 gate（本 plan 范围）

- `npm run typecheck`：✓ OK。`npm run build`：✓ 0 错误。
- 全量回归 `vitest run`：✓ 885 passed / 0 failed（含 SettingsPanel round-trip / ChatStream / i18n coverage / storage / read-tools 计数守门）。
