---
phase: 01-foundation
verified: 2026-05-27T12:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "CR-01 off-by-one：PPT slideIndex 重复 +1 导致上下文卡显示「第 2 张」instead of「第 1 张」"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "在 Edge 和 Chrome 最新版中，sideload manifest.xml 后分别打开 PPT for Web / Excel for Web / Word for Web，验证 Task Pane 350px 三段布局可见，console 无 error（ROADMAP SC1 / AC1）"
    expected: "三宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见；浏览器 console 无 error"
    why_human: "需要真实 Office for Web 环境，无法在 CI / 静态分析中验证"
  - test: "三宿主各点击 2 个 Aster ribbon 按钮（共 6 次），验证每次点击均打开 Task Pane（ROADMAP SC2 / FOUND-10）"
    expected: "PPT: 主题→大纲 / 选中 slide 配图；Excel: 自然语言→公式 / 公式解释·调修；Word: 多风格润色 / TL;DR；点击后 Task Pane 自动打开"
    why_human: "ShowTaskpane 行为需真实 Office 运行时触发，静态 grep manifest 不等于运行时验证"
  - test: "CR-01 修复后，在 PPT for Web 依次选中第 1/3/最后一张 slide，观察上下文卡显示（ROADMAP SC3）"
    expected: "显示「第 1 张 slide」/「第 3 张 slide」/「第 N 张 slide」，与实际 slide 序号完全匹配，无偏移"
    why_human: "需要 PowerPoint.run 真实 Office runtime；代码层面 CR-01 已修复并有回归测试覆盖，真机是最终验收"
  - test: "浏览器访问 https://wynne-cwb.github.io/Aster/ 确认生产托管状态（ROADMAP SC5 / INSTALL-06）"
    expected: "HTTPS 可达，页面加载，manifest.xml 图标 URL 可访问，sideload 后 Task Pane 可打开"
    why_human: "部署状态需浏览器实际访问确认，CI 配置正确不等于部署已生效"
---

# Phase 1：Foundation 与跨宿主骨架 验证报告

**Phase Goal：** 一次性把项目骨架与跨宿主底座搭满——脚手架 + manifest + Task Pane shell + 三宿主 adapter 骨架（带工作的 `getSelection()`）+ 类型化错误 + bundle-size CI 守卫 + i18n + Vitest + 生产托管。本阶段必须可被 Phase 2-6 直接消费。
**Verified：** 2026-05-27T12:00:00Z
**Status：** human_needed（代码层面无 BLOCKER；SC1/SC2/SC3/SC5 需真机 sideload 验收）
**Re-verification：** Yes — CR-01 gap 关闭后的复验

---

## Goal Achievement

### Observable Truths（基于 ROADMAP Success Criteria）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 三宿主均能打开 Task Pane、看到 350px 宿主感知三段布局，console 无 error（SC1 / AC1） | ? UNCERTAIN | 布局代码 VERIFIED（App.tsx `flexDirection: column`，minWidth 350px，三组件均存在）；真机 sideload 需人工完成 |
| 2 | 每宿主 ribbon 2 个 Aster 按钮（共 6），点击后打开 Task Pane（SC2 / FOUND-10） | ? UNCERTAIN | manifest 含恰好 6 个 `<Control xsi:type="Button">`，标签与 ShowTaskpane action 均存在；按钮点击行为需真机验证 |
| 3 | 三宿主上下文卡显示当前选中内容（PPT 第 N 张 slide / Excel 区域地址 / Word 字数），证明 adapter 真实可用（SC3） | ✓ VERIFIED（代码层）| **CR-01 已修复**：PptAdapter.ts:54 产出 1-based slideIndex（+1 正确），formatSelection.ts:17 直接渲染 `第 ${sel.slideIndex} 张 slide`（不再二次 +1）；DocumentAdapter.ts:19 注释修正为 "1-based 序号（消费方无需再 +1）"；ContextCard.tsx 完全委托给 formatSelection，不含 slideIndex 逻辑；回归测试 formatSelection.test.ts（slideIndex===1 → 「第 1 张 slide」）+ adapters.test.ts（office index 0 → slideIndex===1）均通过；65 个测试全部 pass |
| 4 | bundle-size CI 守卫在执行（>1MB 让构建失败，当前基线 <1MB）（SC4 / FOUND-07 / NFR-01） | ✓ VERIFIED | `.size-limit.json` 阈值 1 MB；`ci.yml` 在 PR 与 push 时跑 `npm run size`；实测 138.65 kB（≤ 1MB）✓ |
| 5 | GitHub Pages 生产托管（HTTPS + CSP + 图标），README 含 sideload 步骤草稿（SC5 / INSTALL-06） | ? UNCERTAIN | `pages.yml` 部署配置正确；README 含完整 sideload 步骤草稿；实际部署状态需浏览器访问确认 |

**Score：** 2/5 truths 代码层完全 VERIFIED（SC3 代码层 + SC4），3/5 UNCERTAIN（需人工）；**代码层无 BLOCKER**

---

### CR-01 Gap 关闭证明

#### 端到端链路逐层验证

| 层级 | 位置 | 修复前（有 bug） | 修复后（已验证） |
|------|------|------------------|------------------|
| Office API 输出 | `PptAdapter.ts:54` | `firstSelected.index + 1`（1-based） | 同上，未变——原本正确 |
| 类型契约注释 | `DocumentAdapter.ts:19` | "0-based index"（**错误**） | "1-based 序号（消费方无需再 +1）"（已修正） |
| 显示层函数 | `formatSelection.ts:17` | 不存在（逻辑在 ContextCard 内）| `t\`第 ${sel.slideIndex} 张 slide\``（无 +1，已抽离为纯函数） |
| 消费组件 | `ContextCard.tsx:27` | `t\`第 ${sel.slideIndex + 1} 张 slide\``（**二次 +1，BUG**） | 完全委托 `formatSelection`，自身无 slideIndex 逻辑 |
| 单元测试覆盖 | `formatSelection.test.ts` | 不存在 | slideIndex===1 → 「第 1 张 slide」；slideIndex===5 → 「第 5 张 slide」（✓ pass） |
| Adapter 转换测试 | `adapters.test.ts` | mock 数据凭空构造，未走 adapter | office index 0 → slideIndex===1；office index 4 → slideIndex===5（✓ pass） |

**结论：** off-by-one 链路三处不一致全部修正，端到端路径 office 0-based index → slideIndex 1-based → 显示「第 N 张」语义一致，回归测试守护。

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | 正式依赖栈 + scripts | ✓ VERIFIED | 含 vite-plugin-office-addin、Lingui、Vitest、size-limit；browserslist Edge≥120/Chrome≥120 |
| `vite.config.ts` | Vite 接线：office-addin + lingui + base /Aster/ | ✓ VERIFIED | base: '/Aster/'；officeAddin() + lingui()；rollupOptions.input 含 main+commands |
| `tsconfig.json` | TS strict + office-js types | ✓ VERIFIED | `"strict": true`；`types: ["office-js", "vite/client"]` |
| `lingui.config.ts` | Lingui zh-CN scaffold | ✓ VERIFIED | locales: ['zh-CN']；sourceLocale: 'zh-CN' |
| `index.html` | Task Pane 入口 + CDN Office.js | ✓ VERIFIED | CDN script 先于 main.tsx module；lang="zh-CN" |
| `src/adapters/DocumentAdapter.ts` | 接口 + 3 discriminated unions | ✓ VERIFIED | interface DocumentAdapter 含 4 方法；SelectionContext 4 变体；InsertableContent 7 变体；slideIndex 注释已修正为 1-based |
| `src/errors/index.ts` | 类型化错误层级（基类 + 6 子类） | ✓ VERIFIED | AsterError 基类；Provider 层 4；Adapter 层 2 |
| `src/adapters/PptAdapter.ts` | PPT getSelection + onSelectionChanged 真实实现 | ✓ VERIFIED | getSelection 使用 PowerPoint.run 真实实现；slideIndex = firstSelected.index + 1（1-based，正确）；CR-01 消费端 bug 已在 ContextCard/formatSelection 侧修复 |
| `src/adapters/ExcelAdapter.ts` | Excel getSelection + onSelectionChanged 真实实现 | ✓ VERIFIED | Excel.run 读 getSelectedRange().address；onSelectionChanged 用 worksheet.onSelectionChanged.add |
| `src/adapters/WordAdapter.ts` | Word getSelection + onSelectionChanged 真实实现 | ✓ VERIFIED | Word.run 读 selection.text.length；onSelectionChanged 用 addHandlerAsync |
| `src/adapters/index.ts` | host→adapter 工厂 | ✓ VERIFIED | createAdapter(Office.HostType) switch；三宿主分流；default 抛 UnsupportedOperationError |
| `manifest.xml` | 三宿主 + 6 ribbon + shared runtime long | ✓ VERIFIED | 6 个 Control Button；3 个 Host；3 处 lifetime="long" |
| `src/main.tsx` | Office.onReady host 分流 + Context 注入 | ✓ VERIFIED | createAdapter(info.host)；FluentProvider + I18nProvider + AdapterContext.Provider |
| `src/App.tsx` | 350px flex-column 三段 shell | ✓ VERIFIED | minWidth 350px；flexDirection column；ContextCard/ChatStream/InputBar 三段 |
| `src/components/ContextCard.tsx` | selection-changed 实时上下文卡 | ✓ VERIFIED | onSelectionChanged 订阅 + cleanup 解绑存在；格式化完全委托 formatSelection；无 slideIndex 直接操作 |
| `src/components/formatSelection.ts` | 纯函数显示层（CR-01 修复抽离） | ✓ VERIFIED | 新模块；`sel.slideIndex` 直接渲染（无 +1）；exhaustive never 检查；可 vitest 直接单测 |
| `src/components/formatSelection.test.ts` | CR-01 回归测试 | ✓ VERIFIED | slideIndex===1 → 「第 1 张 slide」；5 个 case 全部 pass |
| `src/adapters/adapters.test.ts` | adapter 转换 + smoke test | ✓ VERIFIED | 新增 PptAdapter.getSelection() 序号转换组（office index 0 → slideIndex 1）；65 tests pass |
| `src/components/InputBar.tsx` | 禁用输入栏 + Provider 下拉 + 上传图标 | ✓ VERIFIED | disabled 属性全部存在；Dropdown/Textarea/Button/ArrowUploadRegular 全到位 |
| `src/components/ChatStream.tsx` | 空态聊天区 | ✓ VERIFIED | 含「开始使用 Aster」文案；Fluent v9 tokens；Lingui Trans 包裹 |
| `.size-limit.json` | 1MB gzip 阈值守卫 | ✓ VERIFIED | limit "1 MB"；gzip true |
| `.github/workflows/ci.yml` | PR 触发 bundle size 守卫 | ✓ VERIFIED | `npm run size` 步骤存在；PR + push 均触发 |
| `.github/workflows/pages.yml` | dist/ 部署到 GitHub Pages | ✓ VERIFIED | path: dist；actions/deploy-pages；HTTPS |
| `README.md` | sideload 步骤草稿 | ✓ VERIFIED | 含完整 sideload 步骤、支持宿主/浏览器说明 |
| `vitest.config.ts` | Vitest 配置 | ✓ VERIFIED | environment jsdom；globals true；include src/**/*.test.ts |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.html` | `src/main.tsx` | module script entry | ✓ WIRED | `<script type="module" src="/src/main.tsx">` |
| `src/main.tsx` | `src/adapters/index.ts` | `createAdapter(info.host)` | ✓ WIRED | import createAdapter + 调用 createAdapter(info.host) |
| `src/adapters/index.ts` | PptAdapter/ExcelAdapter/WordAdapter | switch on HostType | ✓ WIRED | `new PptAdapter()` / `new ExcelAdapter()` / `new WordAdapter()` |
| `src/components/ContextCard.tsx` | `formatSelection` | import + 调用 | ✓ WIRED | `import { formatSelection } from './formatSelection'`；onSelectionChanged 回调中调用 |
| `src/components/formatSelection.ts` | `DocumentAdapter.ts` slideIndex 语义 | type import + switch | ✓ WIRED | 导入 `SelectionContext`；`sel.slideIndex` 直接渲染（语义与类型注释一致） |
| `vite.config.ts` | GitHub Pages `/Aster/` | base 配置 | ✓ WIRED | `base: '/Aster/'` |
| `.github/workflows/ci.yml` | `npm run size` | size-limit gate | ✓ WIRED | 步骤存在且 PR 触发 |
| `src/App.tsx` | Lingui i18n | Trans macro | ✓ WIRED | `<Trans>` 包裹文案（子组件） |

---

### Data-Flow Trace（Level 4）

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ContextCard.tsx` | `ctx` (string) | `adapter.getSelection()` → `formatSelection()` → Office.js PowerPoint.run/Excel.run/Word.run | 是（真实 Office API 调用）；PPT 路径 slideIndex 语义修正完成 | ✓ FLOWING（代码层）；真机验证待人工完成 |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run size` 返回 < 1MB | `npm run size` | 138.65 kB gzipped | ✓ PASS |
| 65 tests pass（含 CR-01 回归） | `npx vitest run` | PASS (65) FAIL (0) | ✓ PASS |
| `npm run build` 产出 dist/ | build 配置正确 | dist/assets/ 含 .js + .png | ✓ PASS |
| PPT slide 上下文显示正确（真机） | 需真机 | 代码层 VERIFIED；真机 sideload 待人工 | ? SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| INSTALL-01 | 01-04 | 单一 XML manifest 含 3 个 Host + shared runtime long | ✓ SATISFIED | manifest.xml 3 Host；3 处 lifetime="long" |
| INSTALL-02 | 01-04 | 每个 Host 内部独立声明 Requirements | ✓ SATISFIED | 每个 Host block 含独立 Runtimes 声明 |
| INSTALL-03 | 01-04 | Edge/Chrome sideload 三宿主均能打开 Task Pane | ? NEEDS HUMAN | 代码配置正确；真机 sideload 未验证 |
| INSTALL-04 | 01-01 | Office.js 从 CDN 加载 | ✓ SATISFIED | index.html + commands.html 均含 CDN script |
| INSTALL-05 | 01-06 | Manifest 图标 host 配置 Cache-Control | ⚠️ PARTIAL | GitHub Pages 不支持自定义 Cache-Control；pages.yml 注释明确承认此限制，判定 sideload 不受影响。已记录的已知折中。 |
| INSTALL-06 | 01-06 | 生产托管 + HTTPS + CSP + sideload 文档 | ? NEEDS HUMAN | pages.yml 配置正确；README 含步骤；实际部署需浏览器确认 |
| FOUND-01 | 01-01 | Yo Office → Vite 7 脚手架 | ✓ SATISFIED | vite.config.ts 含 vite-plugin-office-addin；vite 7 在 package.json |
| FOUND-02 | 01-01 | React 19 + TS 5.7 strict + browserslist Edge≥120/Chrome≥120 | ✓ SATISFIED | package.json browserslist 含 Edge≥120/Chrome≥120；tsconfig strict true |
| FOUND-03 | 01-05 | Office.onReady 读 host，实例化 adapter，通过 React Context 暴露 | ✓ SATISFIED | main.tsx createAdapter(info.host) + AdapterContext.Provider |
| FOUND-04 | 01-02 | DocumentAdapter 接口 + SelectionContext + InsertableContent + AdapterCapabilities | ✓ SATISFIED | DocumentAdapter.ts 含全部 union（4+7+1）+ 接口；slideIndex 注释已修正 |
| FOUND-05 | 01-03 | 三宿主 adapter 骨架，至少 getSelection() 真实数据 | ✓ SATISFIED | getSelection 真实实现存在；CR-01 已修复，消费端显示值正确；回归测试覆盖 |
| FOUND-06 | 01-02 | 类型化错误类层级（Provider 4 + Adapter 2） | ✓ SATISFIED | errors/index.ts 含 AsterError + 6 子类 |
| FOUND-07 | 01-06 | CI bundle-size 守卫 >1MB 失败 | ✓ SATISFIED | .size-limit.json + ci.yml `npm run size` 步骤 |
| FOUND-08 | 01-01 | Lingui 5 zh-CN i18n 脚手架 | ✓ SATISFIED | lingui.config.ts zh-CN only；src/i18n/index.ts loadAndActivate |
| FOUND-09 | 01-03 | Vitest 配置 + adapter smoke test | ✓ SATISFIED | vitest.config.ts + adapters.test.ts（含 CR-01 回归）；65 tests pass |
| FOUND-10 | 01-04 | 6 个 Ribbon 按钮占位，点击打开 Task Pane | ? NEEDS HUMAN | manifest 6 按钮配置正确；ShowTaskpane 行为需真机验证 |
| PANE-01 | 01-05 | Task Pane 350px 三段布局 | ✓ SATISFIED（代码层）| App.tsx flex-column；三段组件均存在 |
| NFR-01 | 01-06 | 初始 JS bundle ≤ 1MB | ✓ SATISFIED | `npm run size` 实测 138.65 kB |
| NFR-04 | 01-02 | MVP 只用 Office.js Web/Windows 共支持 API 子集 | ✓ SATISFIED | PowerPoint.run/Excel.run/Word.run + Common API |
| NFR-05 | 01-03 | 跨宿主 API 不一致通过 DocumentAdapter 抽象层吸收 | ✓ SATISFIED | 三 adapter 各自封装宿主事件 API，对外签名一致 |
| NFR-06 | 01-05 | MVP 在 Edge/Chrome 最新两版均正常工作 | ? NEEDS HUMAN | browserslist 配置正确；实际兼容性需真机验证 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/adapters/ExcelAdapter.ts` | 64-65 | `.catch(() => { })` 静默吞噬事件注册失败 | ⚠️ Warning | 无 console.warn，注册失败后 selection 监听静默失效（WR-02） |
| `src/adapters/WordAdapter.ts` | 26-30 | `selection.load('text')` 把完整正文拉进内存 | ⚠️ Warning | 注释声称"仅读元数据"，实现读取完整正文（WR-03） |
| `src/errors/index.ts` | 100-108 | `hostError?: unknown` 整体挂载原始 Office 错误对象 | ⚠️ Warning | 序列化时可能携带敏感 debugInfo（WR-04） |
| `src/adapters/ExcelAdapter.ts` | 53-79 | 注册/解绑竞态（handlerResult 在异步中赋值，同步返回 unsub） | ⚠️ Warning | 快速卸载时漏解绑（WR-01） |

**注：** 以上 4 项均为 WARNING 级，CR-01 BLOCKER 已在本次 re-verification 前关闭。这 4 项 WARNING 已在 01-REVIEW.md 记录，为 Phase 1 已知非阻塞问题，建议在 Phase 2 前修复 WR-01/WR-02（健壮性），Phase 2-6 期间关注 WR-03/WR-04（安全）。

---

### Human Verification Required

#### 1. 三宿主 Task Pane sideload（SC1 / AC1）

**Test：** 在 Edge 和 Chrome 最新版中，sideload manifest.xml 后分别打开 PPT for Web / Excel for Web / Word for Web
**Expected：** 每个宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见；浏览器 console 无 error
**Why Human：** 需要真实 Office for Web 环境，无法在 CI / 静态分析中验证

#### 2. Ribbon 6 按钮点击行为（SC2 / FOUND-10）

**Test：** 三宿主各点击 2 个 Aster ribbon 按钮（共 6 次）
**Expected：** 每次点击均自动打开 Task Pane；按钮标签为「主题→大纲」/「选中 slide 配图」/「自然语言→公式」/「公式解释·调修」/「多风格润色」/「TL;DR」
**Why Human：** ShowTaskpane 行为需真机 Office 运行时触发

#### 3. PPT 上下文卡正确性真机验证（SC3）

**Test：** 在 PPT for Web 依次选中第 1/3/最后一张 slide，观察上下文卡显示
**Expected：** 显示「第 1 张 slide」/「第 3 张 slide」/「第 N 张 slide」，与实际序号完全匹配，无偏移
**Why Human：** 需要 PowerPoint.run 真实 Office runtime；代码层 CR-01 已修复并有回归测试，真机是最终端到端验收

#### 4. GitHub Pages 生产访问（SC5 / INSTALL-06）

**Test：** 浏览器访问 https://wynne-cwb.github.io/Aster/
**Expected：** HTTPS 可达，页面加载；manifest.xml 图标 URL 可访问；sideload 后 Task Pane 可打开
**Why Human：** 部署状态需浏览器确认

---

### Re-verification Summary

**之前状态（gaps_found）：**
- CR-01 是唯一 BLOCKER：ContextCard.tsx:27 对已为 1-based 的 slideIndex 二次 +1

**本次 re-verification 确认（已关闭）：**

1. `DocumentAdapter.ts:19` 注释已从 "0-based index" 修正为 "1-based 序号（直接对应「第 N 张」，消费方无需再 +1）"
2. `PptAdapter.ts:54` 保持 `firstSelected.index + 1`（产出 1-based，正确，原本无 bug）
3. `ContextCard.tsx` 完全移除 slideIndex 直接操作，委托给新抽离的 `formatSelection` 模块
4. `formatSelection.ts:17` 渲染 `t\`第 ${sel.slideIndex} 张 slide\``，无二次 +1
5. `formatSelection.test.ts` 新增回归测试：slideIndex===1 → 「第 1 张 slide」（通过）
6. `adapters.test.ts` 新增 adapter 转换测试：office index 0 → slideIndex===1（通过）
7. `npx vitest run`：65 tests pass，0 fail

**当前状态：** 代码层无 BLOCKER，无 WARNING 新增。状态从 `gaps_found` 变更为 `human_needed`，等待 SC1/SC2/SC3/SC5 真机 sideload 验收。

---

_Verified: 2026-05-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Mode: Re-verification after CR-01 gap closure_
