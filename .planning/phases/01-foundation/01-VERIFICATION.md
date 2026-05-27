---
phase: 01-foundation
verified: 2026-05-27T10:00:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "在三个宿主里都能从 Task Pane 顶部上下文卡看到当前选中内容的正确描述（PPT：第 N 张 slide）"
    status: failed
    reason: "CR-01 off-by-one BLOCKER：PptAdapter.ts:54 产出 1-based slideIndex（firstSelected.index + 1），但 ContextCard.tsx:27 又对其再加 1（sel.slideIndex + 1）。选中第 1 张 slide 时上下文卡显示「第 2 张 slide」，永久偏大 1。DocumentAdapter.ts:19 类型注释写 '0-based index' 与实现矛盾，三处语义不一致。现有测试用凭空构造的 mock 数据，未走 adapter 真实转换路径，无法捕获此回归。这是 ROADMAP SC3 端到端证明 adapter 真实可用的唯一可见验收点，显示错误等于该验收点失效。"
    artifacts:
      - path: "src/components/ContextCard.tsx"
        issue: "第 27 行 `sel.slideIndex + 1` 对已为 1-based 的 slideIndex 再次 +1"
      - path: "src/adapters/DocumentAdapter.ts"
        issue: "第 19 行注释写 '0-based index'，与 PptAdapter 实际产出 1-based 矛盾"
      - path: "src/adapters/DocumentAdapter.test.ts"
        issue: "测试用凭空构造数据 `{ kind: 'ppt', slideIndex: 1 }` 未走 adapter 转换，无法捕获此 bug"
    missing:
      - "将 ContextCard.tsx:27 从 `sel.slideIndex + 1` 改为 `sel.slideIndex`（slideIndex 已是 1-based）"
      - "将 DocumentAdapter.ts:19 注释从 '0-based index' 更正为 '1-based 序号（直接对应「第 N 张」）'"
      - "补一个端到端测试：mock getSelectedSlides().items 返回 index:0，断言 getSelection() 得 slideIndex===1，再断言 formatSelection 输出「第 1 张 slide」"
human_verification:
  - test: "在 PPT for Web / Excel for Web / Word for Web 三宿主 sideload manifest，打开 Task Pane，验证 350px 三段布局可见，console 无 error（ROADMAP SC1 / AC1）"
    expected: "三宿主均能打开 Aster Task Pane，顶部上下文卡 + 中部空态聊天 + 底部禁用输入栏全部可见"
    why_human: "需要真实 Office for Web 环境，且 CR-01 修复后才有意义——建议 fix 后同步完成真机验证"
  - test: "每个宿主 ribbon 可见 2 个 Aster 按钮（共 6 个），点击后 Task Pane 自动打开（ROADMAP SC2）"
    expected: "PPT: 主题→大纲 / 选中 slide 配图；Excel: 自然语言→公式 / 公式解释·调修；Word: 多风格润色 / TL;DR"
    why_human: "manifest ShowTaskpane 行为需真机验证，不可静态 grep"
  - test: "CR-01 修复后，在 PPT for Web 选中第 1/2/5 张 slide，上下文卡显示「第 1 张 slide」/「第 2 张 slide」/「第 5 张 slide」（ROADMAP SC3）"
    expected: "显示值与实际 slide 序号完全匹配，无偏移"
    why_human: "需要真实 Office runtime 才能触发 PowerPoint.run + getSelectedSlides"
  - test: "GitHub Pages 部署后，https://wynne-cwb.github.io/Aster/ 可访问 Task Pane HTML（ROADMAP SC5 / INSTALL-06）"
    expected: "HTTPS 可达，CSP 正常，图标可加载，sideload 不报错"
    why_human: "部署状态需浏览器实际访问确认"
---

# Phase 1：Foundation 与跨宿主骨架 验证报告

**Phase Goal：** 一次性把项目骨架与跨宿主底座搭满——脚手架 + manifest + Task Pane shell + 三宿主 adapter 骨架（带工作的 `getSelection()`）+ 类型化错误 + bundle-size CI 守卫 + i18n + Vitest + 生产托管。本阶段必须可被 Phase 2-6 直接消费。
**Verified：** 2026-05-27T10:00:00Z
**Status：** gaps_found — 1 个 BLOCKER（CR-01 off-by-one）
**Re-verification：** No（初次验证）

---

## Goal Achievement

### Observable Truths（基于 ROADMAP Success Criteria）

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 三宿主均能打开 Task Pane、看到 350px 宿主感知三段布局，console 无 error（SC1 / AC1） | ? UNCERTAIN | 布局代码 VERIFIED（App.tsx `flexDirection: column`，minWidth 350px，三组件均存在），真机 sideload 未能在此会话中完成——需人工验证 |
| 2 | 每宿主 ribbon 2 个 Aster 按钮（共 6），点击后打开 Task Pane（SC2 / FOUND-10） | ? UNCERTAIN | manifest 含恰好 6 个 `<Control xsi:type="Button">`，6 个标签字符串正确，ShowTaskpane action 存在；按钮实际点击行为需真机验证 |
| 3 | 三宿主上下文卡显示当前选中内容描述（PPT 第 N 张 slide / Excel 区域地址 / Word 选中字数），证明 adapter 真实可用（SC3） | ✗ FAILED | **BLOCKER CR-01**：ContextCard.tsx:27 `sel.slideIndex + 1` 对已为 1-based 的 slideIndex 再次 +1，选中第 1 张 slide 显示「第 2 张 slide」。DocumentAdapter.ts:19 注释与实现矛盾（写 0-based，实现输出 1-based）。测试未覆盖真实 adapter 转换路径。 |
| 4 | bundle-size CI 守卫在执行（>1MB 让构建失败，当前基线 <1MB）（SC4 / FOUND-07 / NFR-01） | ✓ VERIFIED | `.size-limit.json` 阈值 1 MB；`ci.yml` 在 PR 与 push 时跑 `npm run size`；`npm run size` 实测 138.65 kB（≤ 1MB）✓；CI job 退出码非零时 PR 标红 |
| 5 | GitHub Pages 生产托管（HTTPS + CSP + 图标），README 含 sideload 步骤草稿（SC5 / INSTALL-06） | ? UNCERTAIN | `pages.yml` 部署 `dist/` 到 GitHub Pages 配置正确；README 含完整 sideload 步骤草稿；HTTPS + 图标 URL 配置正确。实际部署状态需浏览器访问确认 |

**Score：** 1/5 truths 完全 VERIFIED（SC4），3/5 UNCERTAIN（需人工），1/5 FAILED（CR-01）
**Effective Score：** 4/5 automated checks pass（CR-01 是唯一 BLOCKER）

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | 正式依赖栈 + scripts | ✓ VERIFIED | 含 vite-plugin-office-addin、Lingui、Vitest、size-limit；browserslist Edge≥120/Chrome≥120；scripts 含 test/size/extract |
| `vite.config.ts` | Vite 接线：office-addin + lingui + base /Aster/ + 多入口 | ✓ VERIFIED | base: '/Aster/'；officeAddin() + lingui()；rollupOptions.input 含 main+commands；manualChunks 三块 |
| `tsconfig.json` | TS strict + office-js types | ✓ VERIFIED | `"strict": true`；`types: ["office-js", "vite/client"]` |
| `lingui.config.ts` | Lingui zh-CN scaffold | ✓ VERIFIED | locales: ['zh-CN']；sourceLocale: 'zh-CN' |
| `index.html` | Task Pane 入口 + CDN Office.js | ✓ VERIFIED | CDN script 先于 main.tsx module；lang="zh-CN"；title="Aster" |
| `src/adapters/DocumentAdapter.ts` | 接口 + 3 discriminated unions | ✓ VERIFIED | interface DocumentAdapter 含 4 方法；SelectionContext 4 变体；InsertableContent 7 变体；AdapterCapabilities；纯类型 |
| `src/errors/index.ts` | 类型化错误层级（基类 + 6 子类） | ✓ VERIFIED | AsterError 基类；Provider 层 4（KeyInvalid/Quota/ContextTooLong/Network）；Adapter 层 2（HostApi/UnsupportedOperation） |
| `src/adapters/PptAdapter.ts` | PPT getSelection + onSelectionChanged 真实实现 | ⚠️ PARTIAL | getSelection 使用 PowerPoint.run 真实实现，按 .index 排序（PPT-05），slideIndex 为 1-based（+1 正确）；**但 ContextCard 消费时再次 +1（CR-01 BLOCKER）** |
| `src/adapters/ExcelAdapter.ts` | Excel getSelection + onSelectionChanged 真实实现 | ✓ VERIFIED | Excel.run 读 getSelectedRange().address；onSelectionChanged 用 worksheet.onSelectionChanged.add |
| `src/adapters/WordAdapter.ts` | Word getSelection + onSelectionChanged 真实实现 | ✓ VERIFIED | Word.run 读 selection.text.length；onSelectionChanged 用 addHandlerAsync |
| `src/adapters/index.ts` | host→adapter 工厂 | ✓ VERIFIED | createAdapter(Office.HostType) switch；三宿主分流；default 抛 UnsupportedOperationError；re-export 类型 |
| `manifest.xml` | 三宿主 + 6 ribbon + shared runtime long + 3 必修项 | ✓ VERIFIED | 6 个 Control Button；3 个 Host（Presentation/Workbook/Document）；3 处 lifetime="long"；Version 1.0.0.0；base 三件套；6 个 Supertip 引 LongString |
| `src/main.tsx` | Office.onReady host 分流 + Context 注入 | ✓ VERIFIED | createAdapter(info.host)；FluentProvider + I18nProvider + AdapterContext.Provider |
| `src/App.tsx` | 350px flex-column 三段 shell | ✓ VERIFIED | minWidth 350px；flexDirection column；ContextCard/ChatStream/InputBar 三段 |
| `src/components/ContextCard.tsx` | selection-changed 实时上下文卡 | ✗ STUB/BUGGY | onSelectionChanged 订阅存在，格式化逻辑存在，但 CR-01 off-by-one 导致 PPT 显示值永久错误 |
| `src/components/InputBar.tsx` | 禁用输入栏 + Provider 下拉 + 上传图标 | ✓ VERIFIED | disabled 属性全部存在；Dropdown/Textarea/Button/ArrowUploadRegular 全到位 |
| `src/components/ChatStream.tsx` | 空态聊天区 | ✓ VERIFIED | 含「开始使用 Aster」文案；Fluent v9 tokens；Lingui Trans 包裹 |
| `.size-limit.json` | 1MB gzip 阈值守卫 | ✓ VERIFIED | limit "1 MB"；path "dist/assets/*.js"；gzip true |
| `.github/workflows/ci.yml` | PR 触发 bundle size 守卫 | ✓ VERIFIED | `npm run size` 步骤存在；PR + push 均触发 |
| `.github/workflows/pages.yml` | dist/ 部署到 GitHub Pages | ✓ VERIFIED | path: dist；actions/deploy-pages；HTTPS |
| `README.md` | sideload 步骤草稿 | ✓ VERIFIED | 含完整 sideload 步骤、支持宿主/浏览器说明、隐私/无后台说明 |
| `vitest.config.ts` | Vitest 配置 | ✓ VERIFIED | environment jsdom；globals true；include src/**/*.test.ts |
| `src/adapters/adapters.test.ts` | adapter smoke test | ✓ VERIFIED | 4 类测试：工厂分流/UNSUPPORTED/capabilities/insert 桩；57 tests pass |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `index.html` | `src/main.tsx` | module script entry | ✓ WIRED | `<script type="module" src="/src/main.tsx">` |
| `src/main.tsx` | `src/adapters/index.ts` | `createAdapter(info.host)` | ✓ WIRED | import createAdapter + 调用 createAdapter(info.host) |
| `src/adapters/index.ts` | PptAdapter/ExcelAdapter/WordAdapter | switch on HostType | ✓ WIRED | `new PptAdapter()` / `new ExcelAdapter()` / `new WordAdapter()` |
| `src/components/ContextCard.tsx` | `DocumentAdapter.onSelectionChanged` | useEffect 订阅 + cleanup 解绑 | ✓ WIRED（逻辑正确）| unsub 模式存在；但 PPT 显示值因 CR-01 偏移 1 |
| `vite.config.ts` | GitHub Pages `/Aster/` | base 配置 | ✓ WIRED | `base: '/Aster/'` |
| `.github/workflows/ci.yml` | `npm run size` | size-limit gate | ✓ WIRED | 步骤存在且 PR 触发 |
| `src/App.tsx` | Lingui i18n | Trans macro | ✓ WIRED | `<Trans>` 包裹文案（子组件） |

---

### Data-Flow Trace（Level 4）

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ContextCard.tsx` | `ctx` (string) | `adapter.getSelection()` → Office.js PowerPoint.run/Excel.run/Word.run | 是（真实 Office API 调用） | ⚠️ HOLLOW（PPT）— PPT 数据来源真实，但 formatSelection 在 PPT case 将 slideIndex 再 +1，导致显示值错误 |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `npm run size` 返回 < 1MB | `npm run size` | 138.65 kB gzipped | ✓ PASS |
| `npm run test` 57 tests pass | `npx vitest run` | PASS (57) FAIL (0) | ✓ PASS |
| `npm run build` 产出 dist/ | 前置已有 dist/ | dist/assets/ 含 .js + .png | ✓ PASS |
| PPT slide 上下文显示正确 | 需真机 | 无法在 CI 环境验证 | ? SKIP |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|----------|
| INSTALL-01 | 01-04 | 单一 XML manifest 含 3 个 Host + shared runtime long | ✓ SATISFIED | manifest.xml 3 Host；3 处 lifetime="long" |
| INSTALL-02 | 01-04 | 每个 Host 内部独立声明 Requirements | ✓ SATISFIED | 每个 Host block 含独立 Runtimes 声明 |
| INSTALL-03 | 01-04 | Edge/Chrome sideload 三宿主均能打开 Task Pane | ? NEEDS HUMAN | 代码配置正确；真机 sideload 未验证 |
| INSTALL-04 | 01-01 | Office.js 从 CDN 加载 | ✓ SATISFIED | index.html + commands.html 均含 CDN script |
| INSTALL-05 | 01-06 | Manifest 图标 host 配置 Cache-Control | ⚠️ PARTIAL | GitHub Pages 不支持自定义 Cache-Control；pages.yml 注释明确承认此限制并判定 sideload 不受影响。属于已记录的已知折中，非回归。 |
| INSTALL-06 | 01-06 | 生产托管 + HTTPS + CSP + sideload 文档 | ? NEEDS HUMAN | pages.yml 配置正确；README 含步骤；实际部署需浏览器确认 |
| FOUND-01 | 01-01 | Yo Office → Vite 7 脚手架 | ✓ SATISFIED | vite.config.ts 含 vite-plugin-office-addin；vite 7 在 package.json |
| FOUND-02 | 01-01 | React 19 + TS 5.7 strict + browserslist Edge≥120/Chrome≥120 | ✓ SATISFIED | package.json browserslist 含 Edge≥120/Chrome≥120；tsconfig strict true |
| FOUND-03 | 01-05 | Office.onReady 读 host，实例化 adapter，通过 React Context 暴露 | ✓ SATISFIED | main.tsx createAdapter(info.host) + AdapterContext.Provider |
| FOUND-04 | 01-02 | DocumentAdapter 接口 + SelectionContext + InsertableContent + AdapterCapabilities | ✓ SATISFIED | DocumentAdapter.ts 含全部 union（4+7+1）+ 接口 |
| FOUND-05 | 01-03 | 三宿主 adapter 骨架，至少 getSelection() 真实数据 | ⚠️ PARTIAL | getSelection 真实实现存在；但 PPT 因 CR-01 消费端显示错误，SC3 验收点失效 |
| FOUND-06 | 01-02 | 类型化错误类层级（Provider 4 + Adapter 2） | ✓ SATISFIED | errors/index.ts 含 AsterError + 6 子类，code 字符串正确 |
| FOUND-07 | 01-06 | CI bundle-size 守卫 >1MB 失败 | ✓ SATISFIED | .size-limit.json + ci.yml `npm run size` 步骤 |
| FOUND-08 | 01-01 | Lingui 5 zh-CN i18n 脚手架 | ✓ SATISFIED | lingui.config.ts zh-CN only；src/i18n/index.ts loadAndActivate；messages.ts 占位 |
| FOUND-09 | 01-03 | Vitest 配置 + adapter smoke test | ✓ SATISFIED | vitest.config.ts + adapters.test.ts；57 tests pass |
| FOUND-10 | 01-04 | 6 个 Ribbon 按钮占位，点击打开 Task Pane | ? NEEDS HUMAN | manifest 6 按钮配置正确；ShowTaskpane 行为需真机验证 |
| PANE-01 | 01-05 | Task Pane 350px 三段布局（顶部上下文卡 + 中部聊天 + 底部输入） | ✓ SATISFIED（代码层）| App.tsx flex-column；ContextCard/ChatStream/InputBar 三段；Fluent v9 tokens |
| NFR-01 | 01-06 | 初始 JS bundle ≤ 1MB | ✓ SATISFIED | `npm run size` 实测 138.65 kB |
| NFR-04 | 01-02 | MVP 只用 Office.js Web/Windows 共支持 API 子集 | ✓ SATISFIED | 使用 PowerPoint.run/Excel.run/Word.run + Common API，均为 Web/Desktop 共支持 |
| NFR-05 | 01-03 | 跨宿主 API 不一致通过 DocumentAdapter 抽象层吸收 | ✓ SATISFIED | 三 adapter 各自封装宿主事件 API（PPT: addHandlerAsync / Excel: onSelectionChanged.add / Word: addHandlerAsync），对外签名一致 |
| NFR-06 | 01-05 | MVP 在 Edge/Chrome 最新两版均正常工作 | ? NEEDS HUMAN | browserslist 配置正确；实际浏览器兼容性需真机验证 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/ContextCard.tsx` | 27 | `sel.slideIndex + 1`（slideIndex 已为 1-based，二次 +1） | 🛑 Blocker | PPT 上下文卡显示值永久偏移 1，ROADMAP SC3 端到端验收点失效 |
| `src/adapters/DocumentAdapter.ts` | 19 | 注释 '0-based index' 与 PptAdapter 实现（1-based）矛盾 | 🛑 Blocker | 与 CR-01 同源，是 bug 的根因——契约文档语义不一致 |
| `src/adapters/ExcelAdapter.ts` | 64-65 | `.catch(() => { })` 静默吞噬事件注册失败 | ⚠️ Warning | 无 console.warn，注册失败后 selection 监听静默失效 |
| `src/adapters/WordAdapter.ts` | 26-30 | `selection.load('text')` 把完整正文拉进内存 | ⚠️ Warning | 注释声称"仅读元数据"，实现读取了完整正文（WR-03） |
| `src/errors/index.ts` | 100-108 | `hostError?: unknown` 整体挂载原始 Office 错误对象 | ⚠️ Warning | 序列化时可能携带敏感 debugInfo（WR-04） |
| `src/adapters/ExcelAdapter.ts` | 53-79 | 注册/解绑竞态（handlerResult 在异步中赋值，同步返回 unsub） | ⚠️ Warning | 快速卸载时漏解绑（WR-01） |

---

### Human Verification Required

#### 1. 三宿主 Task Pane sideload（SC1 / AC1）

**Test：** 在 Edge 和 Chrome 最新版中，sideload manifest.xml 后分别打开 PPT for Web / Excel for Web / Word for Web
**Expected：** 每个宿主均能打开 Aster Task Pane；顶部上下文卡 + 中部空态聊天（「开始使用 Aster」）+ 底部禁用输入栏全部可见；浏览器 console 无 error
**Why Human：** 需要真实 Office for Web 环境；建议在 CR-01 修复后同步完成

#### 2. Ribbon 6 按钮点击行为（SC2 / FOUND-10）

**Test：** 三宿主各点击 2 个 Aster ribbon 按钮（共 6 次）
**Expected：** 每次点击均自动打开 Task Pane；按钮标签为「主题→大纲」/「选中 slide 配图」/「自然语言→公式」/「公式解释·调修」/「多风格润色」/「TL;DR」
**Why Human：** ShowTaskpane 行为需真机 Office 运行时触发

#### 3. PPT 上下文卡正确性（SC3）—— CR-01 修复后才有意义

**Test：** CR-01 修复后，在 PPT for Web 依次选中第 1/3/最后一张 slide，观察上下文卡显示
**Expected：** 显示「第 1 张 slide」/「第 3 张 slide」/「第 N 张 slide」，与实际序号完全匹配
**Why Human：** 需要 PowerPoint.run 真实 Office runtime

#### 4. GitHub Pages 生产访问（SC5 / INSTALL-06）

**Test：** 浏览器访问 https://wynne-cwb.github.io/Aster/
**Expected：** HTTPS 可达，页面加载；manifest.xml 图标 URL 可访问；sideload 后 Task Pane 可打开
**Why Human：** 部署状态需浏览器确认

---

### Gaps Summary

Phase 1 在代码结构、契约设计、CI 守卫、bundle 体积方面均交付到位。57 个测试全部通过，bundle 138.65 kB 远低于 1MB 上限，六个 manifest ribbon 按钮、三宿主 shared runtime、错误类层级全部正确。

**唯一 BLOCKER（CR-01）** 影响 ROADMAP SC3——这是 Phase 1 "adapter 真实可用" 的端到端证据点。三处代码对 `slideIndex` 的 1-based / 0-based 语义理解不一致：

1. `DocumentAdapter.ts:19` 注释写 "0-based index"
2. `PptAdapter.ts:54` 实现产出 `firstSelected.index + 1`（已为 1-based）
3. `ContextCard.tsx:27` 消费时再次 `sel.slideIndex + 1`（误当 0-based 处理）

结果：第 1 张 slide 显示「第 2 张 slide」，永久偏大 1。修复只需两行代码（ContextCard 去掉多余的 +1；DocumentAdapter.ts 注释改为 1-based）并补一个端到端测试。修复后建议同步做真机 sideload 验证，完成 SC1/SC2/SC3/SC5 的人工验收。

INSTALL-05（图标 Cache-Control: public, max-age=3600）是已知平台限制：GitHub Pages 不支持自定义 Cache-Control 响应头。pages.yml 注释已如实记录此约束并判定 sideload 不受影响。这是可接受的已知折中，非新增回归。

---

_Verified: 2026-05-27T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
