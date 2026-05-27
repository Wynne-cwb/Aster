# Phase 1: Foundation 与跨宿主骨架 - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 19 个新建/修改文件
**Analogs found:** 13 有 spike analog / 19 总数

> **本阶段特殊性:** Greenfield 脚手架——尚无 `src/`。但 Phase 0 在 `spike/` 沉淀了大量**已真机验证**的资产。下表每个 analog 不是"照搬",而是提取已验证的配置/结构作为**起点 + 约束来源**。提升路径见 CONTEXT D-01..D-05。
>
> **三条全局硬约束(适用所有相关文件,见 Shared Patterns):**
> 1. **manifest 3 必修项**(D-03 / spike #010)——validate 通过 ≠ 运行时接受
> 2. **pdf.js worker 用 `new URL(..., import.meta.url)`,禁 `?url`**(spike #007 Pitfall 7)——本阶段不接 pdf.js,但凡涉及 Vite worker 资产必守
> 3. **Office.js 走 CDN script 标签,不进 bundle**(INSTALL-04)——npm `@microsoft/office-js` 已 deprecated

---

## File Classification

| 新建/修改文件 | 角色 | 数据流 | 最近 Analog | 匹配质量 |
|---------------|------|--------|-------------|----------|
| `package.json`(repo 根) | config | — | `spike/bundle-test/package.json` | exact(提升 + 加接线依赖) |
| `vite.config.ts`(repo 根) | config | — | `spike/bundle-test/vite.config.ts` | role-match(需加 vite-plugin-office-addin) |
| `tsconfig.json`(repo 根) | config | — | `spike/bundle-test/tsconfig.json` | exact |
| `index.html`(repo 根 = Task Pane 入口) | config/entry | — | `spike/bundle-test/index.html` | exact |
| `commands.html`(repo 根) | route/entry | event-driven | `spike/commands.html` | role-match(需加 6 个 associate handler) |
| `manifest.xml`(repo 根) | config | — | `spike/manifest.xml` | exact(扩 6 按钮 + 改 ProviderName/Id) |
| `src/main.tsx`(入口) | provider/entry | request-response | `spike/bundle-test/src/main.tsx` | role-match(扩 Office.onReady host 分流) |
| `src/App.tsx`(Shell 三段布局) | component | request-response | `spike/bundle-test/src/main.tsx`(App 函数) | partial(布局重写,沿用 Fluent 用法) |
| `src/components/ContextCard.tsx` | component | event-driven | 无(新 selection-changed 模式) | no-analog |
| `src/components/ChatStream.tsx`(空态) | component | request-response | `spike/bundle-test/src/main.tsx`(messages 渲染) | partial |
| `src/components/InputBar.tsx`(禁用) | component | request-response | `spike/bundle-test/src/main.tsx`(Input+Button) | partial |
| `src/adapters/DocumentAdapter.ts`(接口) | model/contract | — | 无(新契约) | no-analog |
| `src/adapters/PptAdapter.ts` | adapter | event-driven | 无(PowerPoint.run 新) | no-analog |
| `src/adapters/ExcelAdapter.ts` | adapter | event-driven | 无(Excel.run 新) | no-analog |
| `src/adapters/WordAdapter.ts` | adapter | event-driven | 无(Word.run 新) | no-analog |
| `src/adapters/index.ts`(host→adapter 工厂) | factory | — | 无 | no-analog |
| `src/errors/index.ts`(错误类层级) | model | — | 无(REQUIREMENTS 已枚举成员) | no-analog |
| `src/i18n/`(Lingui scaffold + lingui.config) | config | — | 无(spike package.json 已锁 `@lingui/react@^5`) | partial |
| `.github/workflows/ci.yml`(size-limit + build) | config/CI | — | `.github/workflows/pages.yml` | role-match |
| `.size-limit.json`(或 package.json 内 size-limit 段) | config | — | 无(D-15 新增) | no-analog |

---

## Pattern Assignments

### `package.json`(repo 根) — config

**Analog:** `spike/bundle-test/package.json`(D-01 直接提升)

**已验证依赖栈**(lines 13-30)——实测 ~135KB gzip,直接搬:
```json
"dependencies": {
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@fluentui/react-components": "^9.73.0",
  "zustand": "^5.0.0",
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "@lingui/react": "^5.0.0"
},
"devDependencies": {
  "@types/office-js": "latest",
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "typescript": "^5.7.0",
  "vite": "^7.0.0",
  "@vitejs/plugin-react": "^4.0.0",
  "vite-bundle-visualizer": "latest"
}
```

**本阶段必须新增的接线/工具依赖**(spike base 未带):
- `vite-plugin-office-addin`(D-05,HTTPS dev + manifest serve)
- `@lingui/macro` + `@lingui/cli` + `@lingui/vite-plugin`(D-17,scaffold)
- `vitest`(测试框架,phase boundary)
- `size-limit` + `@size-limit/preset-app`(D-15,bundle 守卫)

**改动:** `name` 改 `aster`(去掉 `-bundle-test`);`private: true` 保留;`description` 重写为正式描述(spike 的 description 明确写"Phase 1 不复用",别照抄)。`scripts` 增 `test`(vitest)、`size`(size-limit)、`extract`(lingui extract)。

---

### `vite.config.ts`(repo 根) — config

**Analog:** `spike/bundle-test/vite.config.ts`

**起点结构**(lines 1-21):
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: {
          fluent: ['@fluentui/react-components'],
          markdown: ['react-markdown', 'remark-gfm'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
```

**本阶段必须加的接线**:
- 加 `vite-plugin-office-addin` 到 `plugins`(D-05)——它管 HTTPS dev 证书与 manifest 处理
- 加 `@lingui/vite-plugin`(D-17)
- 多入口:Task Pane(`index.html`)+ `commands.html` 都要 build 出来 → `rollupOptions.input` 配两个 HTML 入口
- `base` 设为 `/Aster/`(GitHub Pages 子路径托管,见 manifest 里所有 URL 是 `wynne-cwb.github.io/Aster/...`)

**约束(Pitfall 7,本阶段不接 pdf.js 但写进守则):** 任何 worker/静态资产用 `new URL('...', import.meta.url).href`,**禁** `?url` 导入(见 Shared Patterns)。若后续加 `optimizeDeps`,参考 `spike/pdfjs-vite-test/README.md` §五。

---

### `tsconfig.json`(repo 根) — config

**Analog:** `spike/bundle-test/tsconfig.json`(exact,直接搬)

**完整可用配置**(lines 1-21):
```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,                        // ← CONTEXT 要求 TS strict
    "noFallthroughCasesInSwitch": true,
    "types": ["office-js", "vite/client"]  // ← Office.* 全局类型来源
  },
  "include": ["src", "vite.config.ts"]
}
```

**改动:** `include` 可加 `"*.config.ts"`(lingui.config / vitest.config)。strict 已开,保持。`types: ["office-js", ...]` 是 `Office.onReady`/`PowerPoint.run`/`Excel.run`/`Word.run` 类型的唯一来源,**不可删**。

---

### `index.html`(repo 根,Task Pane 入口) — config/entry

**Analog:** `spike/bundle-test/index.html`(exact)

**完整结构**(lines 1-14)——CDN Office.js + module entry 模式:
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aster</title>
  <!-- Office.js 必须从 CDN 加载,不进 bundle（INSTALL-04） -->
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**约束:** CDN script 标签**先于** module entry,保证 `Office` 全局在 `main.tsx` 执行时可用。title 改 `Aster`。

---

### `commands.html`(repo 根) — route/entry, event-driven

**Analog:** `spike/commands.html`

**起点结构**(lines 1-18)——spike 版是空 handler(Phase 0 全是 ShowTaskpane):
```html
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
<script>
  Office.onReady(function () {
    // Phase 0 无 function command，留空。
  });
</script>
```

**本阶段必须扩展(D-11 / FOUND-10):** 6 个 ribbon 按钮通过 `Office.actions.associate` 注册,点击统一打开 Task Pane(不执行业务逻辑)。新结构改为引一个 TS module:
```html
<script type="module" src="/src/commands.ts"></script>
```
`src/commands.ts` 内为每个按钮 id 注册:
```typescript
Office.onReady(() => {
  Office.actions.associate('openTaskpane', (event) => {
    // 统一打开 Task Pane（Phase 1 不分功能，全部开同一个 pane）
    event.completed();
  });
});
```
> 注:manifest 里 6 个 `<Control>` 在 Phase 0 用的是 `xsi:type="ShowTaskpane"` 直接开 pane(无需 associate)。本阶段若保持 ShowTaskpane,commands.html 可继续空;若改 `ExecuteFunction` 走 associate,则按上式注册。**规划时择一并与 manifest `<Action>` 类型对齐**。

---

### `manifest.xml`(repo 根) — config

**Analog:** `spike/manifest.xml`(D-02,已 PPT 真机 sideload 成功)

**三宿主 + shared runtime 已焊好**(lines 24-28 base hosts;每 Host 内 lines 41-43 / 73-75 / 105-107):
```xml
<Hosts>
  <Host Name="Presentation"/>
  <Host Name="Workbook"/>
  <Host Name="Document"/>
</Hosts>
<!-- 每个 VersionOverrides Host 内： -->
<Runtimes>
  <Runtime resid="Shared.Runtime.Url" lifetime="long"/>   <!-- long lifetime shared runtime -->
</Runtimes>
```

**★ 3 必修项已焊入(D-03 / spike #010 findings),改 manifest 时一个不能丢:**
1. `<Version>1.0.0.0</Version>`(line 10)—— 必须 ≥ 1.0,`0.0.1` 被 validate 拒
2. base 段三件套(lines 15-17)——VersionOverrides 内的 icon 不顶用:
```xml
<IconUrl DefaultValue="https://wynne-cwb.github.io/Aster/assets/icon-32.png"/>
<HighResolutionIconUrl DefaultValue="https://wynne-cwb.github.io/Aster/assets/icon-80.png"/>
<SupportUrl DefaultValue="https://github.com/Wynne-cwb/Aster"/>
```
3. Supertip 的 `<Description>` 必须引 **LongString**(lines 58/90/122 引 `TaskpaneButton.Tooltip`,该 id 定义在 `<bt:LongStrings>` line 156)——引 ShortString 时 validate 不报错,但运行时报 `AddinManifestError: resid not found`

**Control 占位模式**(lines 56-64,每宿主一个,本阶段每宿主扩到 2 个):
```xml
<Control xsi:type="Button" id="PPT.ShowTaskpane">
  <Label resid="TaskpaneButton.Label"/>
  <Supertip><Title resid="TaskpaneButton.Label"/><Description resid="TaskpaneButton.Tooltip"/></Supertip>
  <Icon><bt:Image size="16" resid="Icon.16x16"/>...</Icon>
  <Action xsi:type="ShowTaskpane">
    <TaskpaneId>ButtonId1</TaskpaneId>
    <SourceLocation resid="Taskpane.Url"/>
  </Action>
</Control>
```

**本阶段扩展(D-09):** 每宿主从 1 个按钮扩到 **2 个**(共 6 个),Label 改 PRD 候选功能名:
- PPT: 主题→大纲 / 选中 slide 配图
- Excel: 自然语言→公式 / 公式解释·调修
- Word: 多风格润色 / TL;DR

每个新 Label 在 `<bt:ShortStrings>` 加 string,Supertip Description 在 `<bt:LongStrings>` 加(守第 3 条)。6 按钮共用同一 Aster 图标组(D-10,lines 139-141)。

**改动:** `<Id>` 换成正式 GUID(spike 用全 0 占位);`<ProviderName>` / `<DisplayName>` / base `<Description>` 去掉 "Spike" 字样。`<AppDomains>`(lines 19-22)的 deepseek/aihubmix 域名 Phase 1 可保留(Phase 2 才用,无害)。

---

### `src/main.tsx`(入口) — provider/entry, request-response

**Analog:** `spike/bundle-test/src/main.tsx`

**Office.onReady → render 模式**(lines 77-85)——已验证,沿用:
```typescript
Office.onReady(() => {
  const container = document.getElementById('root');
  if (!container) {
    throw new Error('未找到 #root 容器');
  }
  const root = createRoot(container);
  root.render(<App />);
});
```

**FluentProvider 包裹模式**(lines 44-45):
```typescript
<FluentProvider theme={webLightTheme}>
  ...
</FluentProvider>
```

**本阶段必须扩展(FOUND-03 / code_context Integration Points)——三宿主分流总入口:**
```typescript
Office.onReady((info) => {
  const adapter = createAdapter(info.host); // host → PptAdapter/ExcelAdapter/WordAdapter
  root.render(
    <FluentProvider theme={hostTheme}>      {/* 主题改用 host-aware，见 UI-SPEC Color */}
      <AdapterContext.Provider value={adapter}>
        <App />
      </AdapterContext.Provider>
    </FluentProvider>
  );
});
```
> UI-SPEC 要求主题 host-aware(light/dark/HC 由 Fluent token 驱动),不再硬编 `webLightTheme`——读 `Office.context.officeTheme` 选 `webLightTheme`/`webDarkTheme`。

---

### `src/App.tsx`(Shell 三段布局) — component, request-response

**Analog:** `spike/bundle-test/src/main.tsx` 的 `App` 函数(lines 33-75)——提取 Fluent 组件用法,布局重写

**复用模式 1 — 具体 import(非 barrel,避 Pitfall 6)**(lines 3-13):
```typescript
import {
  FluentProvider, webLightTheme, Button, Input, Text, Spinner,
} from '@fluentui/react-components';
```
> UI-SPEC §Component Inventory 列了本阶段实际要的:`Card`、`Text`、`Textarea`/`Input`、`Dropdown`、`Button`、`Tooltip`。全走具体 import。

**复用模式 2 — Input + Button 行**(lines 50-60,InputBar 起点):
```typescript
<div style={{ display: 'flex', gap: '8px' }}>
  <Input value={input} onChange={(_e, d) => setInput(d.value)} placeholder="输入测试消息" style={{ flex: 1 }} />
  <Button appearance="primary" onClick={handleSend}>发送</Button>
</div>
```

**本阶段重写为 350px flex-column 三段(D-06 / PANE-01 / UI-SPEC §Spacing):**
- 容器 `min-width: 350px`,`display: flex; flex-direction: column`
- 顶部 ContextCard:content-height(auto)
- 中部 ChatStream:`flex: 1`(占剩余)
- 底部 InputBar:content-height(auto)
- **所有间距/字号/颜色用 Fluent v9 token**(UI-SPEC 硬规则),禁硬编 px/hex。布局结构用 `style` 内联 flex 可以,但 spacing 引 `tokens.spacingVerticalM` 等。

**禁用占位(D-07/D-08):** Provider `Dropdown`、上传 `Button`(icon)、`Send` Button、底部 `Textarea` 全 `disabled`;文案见 UI-SPEC §Copywriting(全部 Lingui macro 包裹)。

---

### `src/components/ChatStream.tsx`(空态) — component

**Analog:** `spike/bundle-test/src/main.tsx` messages 渲染段(lines 61-69,partial)

Phase 1 **无消息**,只渲染空态块(UI-SPEC §Copywriting):
- heading「开始使用 Aster」`fontSizeBase400` semibold(spike line 47 已示范 `<Text size={600} weight="semibold">` 用法)
- body「配置 Provider 后即可开始对话」`fontSizeBase300` regular,neutral-foreground-3,居中
- `react-markdown`(spike line 67 已验证可用)Phase 1 暂不渲染消息,但依赖保留备 Phase 2

---

### `src/components/InputBar.tsx`(禁用) — component

**Analog:** `spike/bundle-test/src/main.tsx`(lines 50-60)

沿用 Input+Button 行结构,全部 `disabled`。加:Provider `Dropdown`(placeholder「Provider（即将开放）」)、上传 icon `Button` + `Tooltip`(「文件上传即将开放」)、Send `Button` `appearance="primary"` disabled(品牌色槽保留,见 UI-SPEC §Color accent 第 1 条)。文案 Lingui macro 包裹。

---

### `src/components/ContextCard.tsx` — component, event-driven

**Analog:** 无(新 selection-changed 模式)。规划用 RESEARCH/UI-SPEC + 下方 adapter 契约。

**模式(D-12/D-13/D-14):** `useEffect` 调 `adapter.onSelectionChanged(cb)` 订阅,返回的解绑函数在 cleanup 调用:
```typescript
const adapter = useContext(AdapterContext);
const [ctx, setCtx] = useState<string>('未选中内容'); // D-16 占位
useEffect(() => {
  const unsubscribe = adapter.onSelectionChanged(async () => {
    const sel = await adapter.getSelection();
    setCtx(formatSelection(sel)); // PPT「第 N 张 slide」/Excel「选中区域 A1:C10」/Word「选中 N 字」
  });
  return unsubscribe; // 解绑（NFR-05：宿主差异关在 adapter 内）
}, [adapter]);
```
用 Fluent `Card` + `Text`(UI-SPEC §Component Inventory)。selection 更新时品牌色 pulse(UI-SPEC §Color accent 第 2 条)。

---

### `src/adapters/DocumentAdapter.ts`(接口契约) — model/contract

**Analog:** 无(Phase 2-6 所有宿主操作的契约,本阶段首次定义)

**契约定义(FOUND-03 / D-13,REQUIREMENTS 已枚举成员):**
```typescript
export interface DocumentAdapter {
  getSelection(): Promise<SelectionInfo>;          // Phase 1 真实实现
  onSelectionChanged(cb: () => void): () => void;  // 返回解绑函数（D-13）
  capabilities(): HostCapabilities;                // Phase 1 桩
  // 其余宿主操作方法 Phase 2-6 扩展，此处可先桩
}
```
> 成员清单以 REQUIREMENTS.md(FOUND 段已枚举 union/方法)为准。`getSelection()` + `onSelectionChanged()` Phase 1 真实可用,其余桩。

---

### `src/adapters/{Ppt,Excel,Word}Adapter.ts` — adapter, event-driven

**Analog:** 无(`PowerPoint.run`/`Excel.run`/`Word.run` 首次使用)。规划须查 context7 拉 Office.js 各宿主 selection 事件 API。

**各宿主实现要点(D-14 决定 getSelection 返回值):**
- **PptAdapter:** `PowerPoint.run` 读 selected slides → 返回「第 N 张 slide」;selection 事件用 `Office.context.document.addHandlerAsync(Office.EventType.DocumentSelectionChanged, ...)` 或宿主专用 API
- **ExcelAdapter:** `Excel.run` 读 `getSelectedRange().address` → 「选中区域 A1:C10」;`worksheet.onSelectionChanged` 事件
- **WordAdapter:** `Word.run` 读 selection text 长度 → 「选中 N 字」;`document.onSelectionChanged` 事件
- **共性约束(NFR-05):** 三宿主事件 API 差异全部封在各自 adapter 内,`onSelectionChanged` 对外签名一致(返回解绑函数)。无选中时 `getSelection()` 不抛错,返回空态标记(D-16)。

---

### `src/adapters/index.ts`(host→adapter 工厂) — factory

**Analog:** 无

`createAdapter(host: Office.HostType): DocumentAdapter`——按 `Office.onReady` 给的 `info.host`(`PowerPoint`/`Excel`/`Word`)实例化对应 adapter。被 `main.tsx` 调用(见上)。

---

### `src/errors/index.ts`(错误类层级) — model

**Analog:** 无(REQUIREMENTS 已枚举成员)

类型化错误类层级,基类 + 分类子类。**成员清单以 REQUIREMENTS.md 枚举为准**(规划须读)。模式:`class AsterError extends Error` 基类带 `code`/`category`,子类按错误域(网络/宿主 API/解析/配置)细分。Phase 1 定义层级,Phase 2+ 实际抛。

---

### `src/i18n/`(Lingui scaffold) — config

**Analog:** partial——`spike/bundle-test/package.json` 已锁 `@lingui/react@^5`(line 20),但无配置文件。

**本阶段建(D-17 / FOUND-08):**
- `lingui.config.{js,ts}`:locales `['zh-CN']`,`compileNamespace`,catalogs 指向 `src/`
- Vite 插件接线(`@lingui/vite-plugin`,见 vite.config 段)
- 用 SWC 插件(D-17 提 "Vite SWC 插件")——注意 spike base 用的是 `@vitejs/plugin-react`(非 SWC 版),规划须确认是换成 `@vitejs/plugin-react-swc` 还是用 `@lingui/swc-plugin`,二者择一
- Phase 1 全部 UI 字符串用 `<Trans>` / `t` macro 包裹,只 ship zh-CN

---

### `.github/workflows/ci.yml`(size-limit + build 守卫) — config/CI

**Analog:** `.github/workflows/pages.yml`(role-match——同仓库 Actions 风格)

**复用模式(lines 1-9 触发 + 权限块):**
```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
```

**本阶段新增 job(D-15 / FOUND-07 / NFR-01):** PR 触发,`npm ci` → `npm run build` → `npm run size`(size-limit),gzip 超 1MB 标红失败。注意:
- 现有 `pages.yml` 部署的是 `spike/` 目录(line 33 `path: spike`)。本阶段正式产物在 repo 根 build 出 `dist/`——**需新增/改造一个 deploy job 把 `dist/` 推 GitHub Pages**(code_context 确认生产托管 `https://wynne-cwb.github.io/Aster/`)。规划须决定:改 `pages.yml` 还是新建 workflow,且 `spike/` 历史证据不可删(D-04)。
- size-limit 与 deploy 可同 workflow 不同 job,或拆两个文件。

---

### `.size-limit.json` / package.json size-limit 段 — config

**Analog:** 无(D-15 新增)

阈值守 1MB gzip(spike 基线 ~135KB,留足余量)。`limit: "1 MB"`,`path: "dist/assets/*.js"`。用 `@size-limit/preset-app`。

---

## Shared Patterns

### 1. manifest 3 必修项(运行时硬约束)
**Source:** `spike/manifest.xml` lines 10/15-17/154-157;`.planning/spikes/010-sideload-checklist/findings.md` lines 33-37
**Apply to:** `manifest.xml`(及任何改 manifest 的动作)
- `<Version>` ≥ 1.0(line 10)
- base 段 `<IconUrl>`+`<HighResolutionIconUrl>`+`<SupportUrl>`(lines 15-17)
- Supertip `<Description>` 引 LongString(lines 156 定义,58/90/122 引用)
> **教训:** `office-addin-manifest validate` 通过只是必要条件,第 3 条 validate 抓不到,运行时才报 `AddinManifestError: resid not found`。

### 2. Vite worker / 静态资产用 `new URL(..., import.meta.url)`,禁 `?url`
**Source:** `spike/pdfjs-vite-test/README.md` lines 24-37(Pitfall 7)
**Apply to:** `vite.config.ts` 及任何引 worker/wasm/静态资产的代码
```typescript
// 正确：
xxx.workerSrc = new URL('pkg/build/worker.min.mjs', import.meta.url).href;
// 错误（dev OK，build 后 worker 找不到）：
// import workerUrl from 'pkg/build/worker.js?url';
```
> 本阶段不接 pdf.js(Phase 3),但凡用到 worker 资产必守此模式。FAIL fallback 见 README §五。

### 3. Office.js 走 CDN script,不进 bundle
**Source:** `spike/bundle-test/index.html` lines 7-8;CLAUDE.md;INSTALL-04
**Apply to:** `index.html`、`commands.html`
```html
<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
```
> npm `@microsoft/office-js` 已 deprecated。CDN 平台感知(PPT/Excel/Word 分别拉宿主代码)。CDN script 先于 module entry。

### 4. Fluent v9 具体 import(非 barrel)
**Source:** `spike/bundle-test/src/main.tsx` lines 3-13 + 注释 line 32(避 Pitfall 6 barrel 体积陷阱)
**Apply to:** 所有 `src/components/*` 与 `App.tsx`
```typescript
import { Card, Text, Button, Input } from '@fluentui/react-components';
```
> UI-SPEC §Design System 也强制:tree-shaken specific imports,no barrel。

### 5. Office.onReady 后再 render + host 分流
**Source:** `spike/bundle-test/src/main.tsx` lines 77-85;code_context Integration Points(FOUND-03)
**Apply to:** `src/main.tsx`
> `Office.onReady((info) => { createAdapter(info.host) → Context → render })` 是三宿主分流总入口。

### 6. 字符串全部 Lingui macro 包裹,zh-CN only
**Source:** UI-SPEC §Typography/Copywriting;CONTEXT D-17 / FOUND-08
**Apply to:** `App.tsx` 及所有 `src/components/*`
> 所有可见文案用 `<Trans>`/`t` macro。文案表见 UI-SPEC §Copywriting Contract。

### 7. 所有 spacing/字号/颜色用 Fluent v9 token,禁硬编
**Source:** UI-SPEC §Spacing/Typography/Color(token-first 硬规则)
**Apply to:** `App.tsx`、`ContextCard.tsx`、`ChatStream.tsx`、`InputBar.tsx`
> 引 `tokens.spacingVerticalM` / `fontSizeBase300` / `colorNeutralBackground1` 等,硬编 px/hex 会破坏 host light/dark/HC 主题。350px 是布局尺寸(非 token),设为容器 min-width。

---

## No Analog Found

下列文件无 spike analog,规划须依据 REQUIREMENTS.md / UI-SPEC.md / RESEARCH(及 context7 拉 Office.js API):

| 文件 | 角色 | 数据流 | 原因 |
|------|------|--------|------|
| `src/adapters/DocumentAdapter.ts` | contract | — | 首次定义跨宿主契约;成员以 REQUIREMENTS 枚举为准 |
| `src/adapters/{Ppt,Excel,Word}Adapter.ts` | adapter | event-driven | `PowerPoint/Excel/Word.run` + selection 事件 API 首次使用,须查 context7 |
| `src/adapters/index.ts` | factory | — | host→adapter 工厂首次建 |
| `src/components/ContextCard.tsx` | component | event-driven | selection-changed 监听 + 实时刷新,无既有模式 |
| `src/errors/index.ts` | model | — | 错误类层级首次建;成员以 REQUIREMENTS 枚举为准 |
| `.size-limit.json` | config | — | D-15 新增 bundle 守卫 |
| `lingui.config.*` | config | — | Lingui 配置首次建(spike 仅锁了 `@lingui/react` 依赖,无配置) |

---

## Metadata

**Analog search scope:** `spike/`(bundle-test、manifest.xml、commands.html、pdfjs-vite-test)、`.github/workflows/`、`.planning/spikes/010` findings
**Files scanned:** spike/bundle-test/{package.json, vite.config.ts, tsconfig.json, src/main.tsx, index.html}、spike/manifest.xml、spike/commands.html、spike/pdfjs-vite-test/README.md、.github/workflows/pages.yml、spike #010 findings
**Greenfield 确认:** repo 根无 `src/`、无 `package.json`(仅 CLAUDE.md);所有正式代码本阶段首建
**Pattern extraction date:** 2026-05-27
