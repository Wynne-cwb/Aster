# Phase 1: Foundation 与跨宿主骨架 - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

一次性搭满 Aster 的跨宿主底座,产物必须能被 Phase 2-6 直接消费:

- 脚手架(Vite 7 + React 19 + TS 5.7 strict)
- 单一 XML manifest(3 个 `<Host>`:Presentation/Workbook/Document + shared runtime long lifetime)
- Task Pane shell(350px 三段布局)
- `DocumentAdapter` 接口 + 三宿主 adapter 骨架(`getSelection()` 真实可用,`capabilities()` 桩)
- 类型化错误类层级
- bundle-size CI 守卫(>1MB 失败)
- Lingui i18n 脚手架(zh-CN only)
- Vitest 测试框架
- 生产托管(GitHub Pages)
- 6 个 ribbon 按钮占位(点击仅开 Task Pane)

**不在本阶段:** Provider/LLM 调用(Phase 2)、Key 存储与 Onboarding(Phase 2)、文件上传与解析器(Phase 3)、任何宿主业务功能(Phase 4-6)。
</domain>

<decisions>
## Implementation Decisions

### 脚手架与项目结构
- **D-01:** 正式项目基座 = 提升已验证的 `spike/bundle-test`(React19+TS+Fluent UI v9+Zustand+react-markdown,实测 ~135KB gzip),**跳过 Yo Office**。理由:Yo Office 的两块价值(依赖栈 + manifest 脚手架)Phase 0 都已具备,跑 Yo 反而要 eject 回 Vite 并重装已验证的栈。
- **D-02:** manifest 起点 = 复用 `spike/manifest.xml`——已在 PPT for Web 真机 sideload 成功,且 3 个运行时必修项已焊入(见 D-03)。不用 Yo 生成的 manifest。
- **D-03:** manifest 必须保留 spike #010 验证的 3 个必修项(`office-addin-manifest validate` 通过 ≠ Office 运行时接受):①`<Version>` ≥ 1.0;②base 段必须有 `<SupportUrl>` + `<IconUrl>` + `<HighResolutionIconUrl>`(VersionOverrides 内的 icon 不顶用);③Supertip 的 `<Description>` 必须引 **LongString**(引 ShortString validate 不报错但运行时报 `AddinManifestError: resid not found`)。
- **D-04:** 正式代码落 **repo 根目录**(`package.json` + `src/` + `manifest.xml` 在顶层),单一项目扁平结构,不建 `app/` 子目录。`spike/` 原样保留为历史证据——Phase 7 REL-05 回归直接引用,不可删。
- **D-05:** 必做接线工作:`vite-plugin-office-addin`(spike base 未带),与脚手架路径选择无关。

### Task Pane Shell
- **D-06:** Shell = **全视觉三段骨架带禁用占位**。PANE-01 的完整布局(顶部上下文卡 + 中部聊天流 + 底部输入框 + 上传图标 + Provider 下拉)全部画出来,使 AC1 的 350px 三段观感一步到位;Phase 2/3 只填逻辑不改布局。
- **D-07:** Provider 下拉与文件上传图标在 Phase 1 **置灰/禁用**(可见但不可用),等 Phase 2/3 接入逻辑。
- **D-08:** 聊天区显示**空态提示文案**(如"配置 Provider 后开始对话"),底部输入框可见但**禁用**——诚实表达当前能力边界,避免让人误以为坏了。

### Ribbon 占位
- **D-09:** 6 个 ribbon 按钮标签 = **PRD 候选功能名**(非通用占位名)。每宿主从 3 个杀手场景里先占 2 个旗舰场景作为占位,Phase 4-6 UX 定稿。建议占位集(可在规划时微调):
  - PPT:主题→大纲 / 选中 slide 配图
  - Excel:自然语言→公式 / 公式解释·调修
  - Word:多风格润色 / TL;DR
- **D-10:** 6 个按钮共用 **spike 已有的 Aster 图标组**(已配 `Cache-Control`,满足 INSTALL-05),不为每功能单独做图标。
- **D-11:** 6 个按钮通过 `Office.actions.associate` 注册,Phase 1 点击行为统一 = 打开 Task Pane,不执行业务逻辑(FOUND-10)。

### 上下文卡选区感知
- **D-12:** 上下文卡 = **实时监听宿主 selection-changed 事件**(非打开/手动刷新)。选中一变卡片即刷新——这也是 Phase 2 聊天附带选区上下文所需的能力。
- **D-13:** 订阅抽象进 `DocumentAdapter` 接口:新增 `onSelectionChanged(callback): () => void`(返回解绑函数),PPT/Excel/Word 各自用宿主事件 API 实现;React 层用 `useEffect` 订阅/解绑。宿主差异关在 adapter 内,符合 NFR-05。
- **D-14:** 上下文卡按 ROADMAP SC3 显示:PPT = 第 N 张 slide;Excel = 选中区域地址;Word = 选中文本字数。

### Claude's Discretion(用户授权按推荐默认处理)
- **D-15:** bundle-size 守卫工具 = `size-limit`,gzip 阈值守 1MB(spike 基线 ~135KB),跑在 GitHub Actions,PR 超限标红失败(FOUND-07/NFR-01)。
- **D-16:** `getSelection()` 无选中时:上下文卡显示"未选中内容"占位,不抛错。
- **D-17:** i18n:Lingui 5 + Vite SWC 插件 scaffold;Phase 1 全部 UI 字符串用 Lingui macro 包裹,只 ship zh-CN(FOUND-08)。
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spike 已验证资产(Phase 1 直接复用)
- `spike/manifest.xml` — 已 sideload 成功的 manifest,3 个运行时必修项已焊入;Phase 1 manifest 起点(见 D-02/D-03)
- `spike/bundle-test/` — 已实测 ~135KB gzip 的 Vite+React19+Fluent UI v9+Zustand+react-markdown 基座;正式项目基座(见 D-01)
- `spike/pdfjs-vite-test/README.md` — pdf.js worker 正确模式(`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`,**禁** `?url` 导入);Phase 1 真实 Vite build 时若涉及 worker 配置须遵循(pdf.js 本体 Phase 3 才接入)

### Spike findings(关键约束与教训)
- `.planning/spikes/010-sideload-checklist/findings.md` — manifest 3 必修项的完整来由 + 免费个人账号 sideload 路径(开始 → 加载项 → 更多设置 → 上传我的加载项)
- `.planning/spikes/007-pdfjs-production-build/findings.md` — pdfjs worker prod-build 闭环点(Phase 1 真实 build 验证 `dist/assets/` 下有独立 worker 文件)
- `.planning/spikes/MANIFEST.md` — Phase 0 10 项 spike 总览(GATING 全 PASS,#4 DeepSeek 多模态 FAIL → 锁 aihubmix;#5 API 混用规避规则)

### 需求与目标(Phase 1 的"SPEC")
- `.planning/ROADMAP.md` — Phase 1 Success Criteria(AC1 等 5 条)+ 依赖与执行顺序
- `.planning/REQUIREMENTS.md` — INSTALL-01..06 / FOUND-01..10 / PANE-01 / NFR-01,04,05,06(21 条,技术选型与 union/错误类成员均已枚举)
- `.planning/PROJECT.md` — Core Value、约束、Key Decisions、Open Questions(Q5 ribbon 选型推迟 UX)
- `prds/2026-05-26-aster-office-addin/PRD.md` — F1-F8 / N1-N5 / ribbon 候选功能名出处
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `spike/bundle-test/`:已验证的依赖栈与 Vite 配置 —— 作为正式 `package.json` + Vite 配置的起点。
- `spike/manifest.xml`:已 sideload 成功、3 必修项已修的 manifest —— 作为正式 manifest 起点。
- `spike/assets/`(图标):已配 `Cache-Control` 的 Aster 图标 —— 6 个 ribbon 占位按钮直接复用。
- `spike/commands.html`:command 函数页参考结构(ribbon handler 注册模式)。

### Established Patterns
- 无既有 `src/` —— Phase 1 是全新脚手架(greenfield),无遗留模式约束。
- Office.js 走 CDN(`https://appsforoffice.microsoft.com/lib/1/hosted/office.js`),不进 bundle(INSTALL-04)。

### Integration Points
- `Office.onReady()` 读 `info.host` → 实例化对应 `DocumentAdapter` → 经 React Context 暴露(FOUND-03)——这是三宿主分流的总入口。
- `DocumentAdapter` 接口是 Phase 2-6 所有宿主操作的契约;Phase 1 定义接口 + `getSelection()`/`onSelectionChanged()` 真实实现,其余方法桩。
- 生产托管 GitHub Pages(`https://wynne-cwb.github.io/Aster/`),CI 走 GitHub Actions(spike 阶段已建)。
</code_context>

<specifics>
## Specific Ideas

- 用户明确认可"省事但不偷工"路线:复用已验证的 spike 产物作为起点,但该补的接线(vite-plugin-office-addin)、该守的约束(manifest 3 必修项、bundle 阈值)一个不省。
</specifics>

<deferred>
## Deferred Ideas

- **ribbon 每宿主 3 场景里最终上哪 2 个** —— Phase 4-6 UX 定稿(PROJECT.md Q5)。Phase 1 占位集只是默认旗舰场景,不是定稿。
- **每功能独立 ribbon 图标** —— Phase 4-6 功能定稿后再做;Phase 1 统一用 spike 图标组。
- **完整 cross-host × cross-browser sideload 矩阵** —— Phase 7 REL-04 验收(Phase 0 仅验 PPT 1/6 组合)。

### Reviewed Todos (not folded)
None — 无 pending todo 匹配本阶段。
</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-05-27*
