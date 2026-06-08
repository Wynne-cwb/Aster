# Architecture Research

**Domain:** Office Add-in → WPS JSAPI Add-in 跨平台接缝设计（v2.5 WPS 滩头堡）
**Researched:** 2026-06-08
**Confidence:** HIGH（接缝设计基于 WPS-01 已验结论 + 活代码 + wpsjs 社区实证；WPS JSAPI 细节 MEDIUM，需真机坐实）

---

## 核心问题（先给结论，再给论据）

### Q1：一仓库一 Vite 构建 vs 两个入口 vs 独立 wpsjs 项目？

**推荐：选项 (b) — 一仓库、两个 Vite 入口点，共享 `src/`**

**理由：**
- `wpsjs` CLI 工具链（`wpsjs build`/`publish`）生成自己的打包产物（`.7z` 包 + `publish.html`），与 Vite 的 GitHub Pages 输出完全不同。两套构建目标在同一 Vite config 里共存会让 `wpsjs.config.js` 与 `vite.config.ts` 互相干扰。
- 但"独立 wpsjs 子项目" 不等于独立仓库。最优布局是单仓 monorepo-lite：`packages/wps-addin/` 子目录跑 `wpsjs` CLI，`src/` 层由两个入口共享——Office.js 入口（`src/main.tsx`，现有）和 WPS 入口（`src/main-wps.tsx`，新建）。
- 这样 `src/agent/`、`src/lib/sse.ts`、`src/store/`、`src/components/`、`src/providers/` 等 **完全复用**，adapter 层各自拉不同实现。
- 纯静态约束（≤1MB）不受影响：WPS 构建是 `.7z` 包，独立预算；Office.js 入口不 import 任何 WPS adapter。

**被否决：**
- 选项 (a) 单 Vite 构建运行时切换：`Office.onReady` 与 `wps.WpsApplication()` 是完全不同的初始化链，二者无法在同一 `index.html` 里兼容共存（WPS 不加载 office.js CDN，Office for Web 没有 `window.Application`）。运行时切换不是一个"开关"，是两条不同的引导链。
- 选项 (c) 独立仓库共享 npm package：过早抽包，增加发布摩擦，MVP 阶段不值得。

---

### Q2：`DocumentAdapter` 接口是否对 WPS 成立？

**结论：接口契约本身成立，但实现层全量重写。**

`DocumentAdapter` 接口（`getSelection` / `onSelectionChanged` / `capabilities` / `insert` / `read`）是业务语义的抽象，与底层 API 形状无关。新增 `WpsPptAdapter` / `WpsExcelAdapter` / `WpsWordAdapter` 实现同一接口——agent loop / tool dispatch / operationLog / DiffLog 全部不需要感知"这是 WPS 还是 Office"，因为它们只和 `DocumentAdapter` 接口交互。

**注意：一个重要语义差异——WPS API 大多是同步 VBA 风格**：
- Office.js 的 `*.run(ctx => { range.load(); return ctx.sync(); })` 是异步 Promise 链，`load`/`sync` 是核心范式。
- WPS JSAPI 是同步属性直接访问（`Application.ActivePresentation.Slides.Count`），无 `run()`/`sync()` 概念。

**这不破坏接口**，因为 `DocumentAdapter` 所有方法签名都是 `Promise<T>`——WPS adapter 实现可以内部同步执行后直接 `return Promise.resolve(result)`，外层调用方感知不到区别。

**undo 语义变化：** Office.js adapter 的 undo 通过快照（记录写前状态 + inverse 方法反写）实现。WPS VBA 风格可选地直接调 `Application.CommandBars.ExecuteMso("Undo")`（程序化撤销），或继续沿用同一快照 inverse 合约——**推荐沿用快照 inverse 合约**，保持 operationLog 守门不动，避免依赖 WPS 撤销栈实现细节（真机验证后确认）。

**isSetSupported 门控：** 现有 adapter 中有 `isSetSupported('WordApi','1.6')` 等门控调用。WPS adapter 中这些调用改为**直接返回 `false`（降级路径）或条件性 `true`（真机验证 WPS JSAPI 是否支持该能力后填值）**。门控调用点不多，改起来是机械性的。

---

### Q3：宿主识别入口设计

**WPS 侧替代方案（替代 `Office.onReady` + `Office.context.host`）：**

```typescript
// src/main-wps.tsx — WPS 专属入口
async function wpsOnReady(): Promise<void> {
  // wps.WpsApplication() 是同步调用；在 ribbon.js 的 OnAddinLoad 回调触发后可用
  // Application 是 window.Application（全局，WPS 注入）
  const app = window.Application;
  const componentType: number = app.ComponentType;
  // componentType: 1 = WPS文字(word), 2 = WPS表格(excel/ET), 3 = WPS演示(ppt/WPP)

  const adapter = await createWpsAdapter(componentType);
  // ... 其余与 main.tsx 相同：hydrate stores, loadHistory, render React
}

// OnAddinLoad 在 ribbon.xml 的 onLoad="OnAddinLoad" 中声明，WPS 加载时调用
function OnAddinLoad(ribbon: unknown) {
  void wpsOnReady();
}
```

**关键点：**
- `window.Application` 是 WPS 注入的全局对象，加载项 webview 内直接可用（无需 CDN 脚本）
- `Application.ComponentType` 是 WPS 官方推荐的宿主类型判别字段（1/2/3，见 WPS 社区文档）
- 双入口用 TypeScript 严格类型隔离：`main.tsx` 引用 `Office.*`，`main-wps.tsx` 引用 `window.Application`；两者不交叉 import，bundle 不混入对方宿主 API 类型

**Office for Web vs WPS 的环境判断（防错）：**
```typescript
// 用于跑 fallback 测试/开发时区分环境（不进生产主路径）
function isWpsEnvironment(): boolean {
  return typeof window !== 'undefined' &&
    typeof (window as any).Application !== 'undefined' &&
    typeof (window as any).wps !== 'undefined';
}
```

---

## Standard Architecture

### System Overview（接缝全景）

```
┌─────────────────────────────────────────────────────────────────┐
│         复用层（宿主无关，两套构建共享 src/）                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │ React 19 │ │ Zustand  │ │ sse.ts   │ │ Providers          │  │
│  │ UI/teal  │ │ stores   │ │ (fetch)  │ │ (DeepSeek/AiHub)   │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │           agent/loop.ts + tool dispatch                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │           DocumentAdapter 接口契约（0-import 纯类型）       │    │
│  └──────────────────────────────────────────────────────────┘    │
├──────────────────────────┬──────────────────────────────────────┤
│  Office.js 实现层         │  WPS JSAPI 实现层（v2.5 新建）         │
│  ┌────────┐ ┌────────┐   │  ┌────────┐ ┌────────┐ ┌────────┐    │
│  │ PptA.  │ │ExcelA. │   │  │WpsPptA.│ │WpsExA. │ │WpsWrdA.│    │
│  │*.run() │ │*.run() │   │  │VBA风格 │ │VBA风格 │ │VBA风格 │    │
│  └────────┘ └────────┘   │  └────────┘ └────────┘ └────────┘    │
│  ┌────────┐              │                                        │
│  │ WordA. │              │                                        │
│  │*.run() │              │                                        │
│  └────────┘              │                                        │
├──────────────────────────┴──────────────────────────────────────┤
│  入口/外壳层（两套，不共享）                                         │
│  ┌───────────────────────┐  ┌─────────────────────────────────┐  │
│  │ Office.js 入口         │  │ WPS 加载项外壳                   │  │
│  │ manifest.xml           │  │ ribbon.xml                      │  │
│  │ index.html (CDN office)│  │ index-wps.html (无 office.js)   │  │
│  │ src/main.tsx           │  │ src/main-wps.tsx                │  │
│  │ Office.onReady         │  │ OnAddinLoad / window.Application│  │
│  │ GitHub Pages 静态托管   │  │ wpsjs publish (.7z)            │  │
│  └───────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| 组件 | 职责 | 归属层 |
|------|------|--------|
| `src/main.tsx` | Office.js 入口：Office.onReady → createAdapter(host) → render | Office.js 入口（不动） |
| `src/main-wps.tsx` | WPS 入口：OnAddinLoad → Application.ComponentType → createWpsAdapter | WPS 外壳（新建） |
| `src/adapters/DocumentAdapter.ts` | 纯类型接口契约，0-import | 复用层（不动） |
| `src/adapters/index.ts` | Office.js adapter 工厂（createAdapter） | Office.js 实现层（不动） |
| `src/adapters/wps/index.ts` | WPS adapter 工厂（createWpsAdapter） | WPS 实现层（新建） |
| `src/adapters/wps/WpsPptAdapter.ts` | WPS 演示 read/write/inverse（VBA 风格） | WPS 实现层（新建） |
| `src/adapters/wps/WpsExcelAdapter.ts` | WPS 表格 read/write/inverse（VBA 风格） | WPS 实现层（新建） |
| `src/adapters/wps/WpsWordAdapter.ts` | WPS 文字 read/write/inverse（VBA 风格） | WPS 实现层（新建） |
| `src/agent/loop.ts` | multi-step agent runner，max_steps=20 | 复用层（不动） |
| `src/lib/sse.ts` | fetch + ReadableStream SSE 解析 | 复用层（不动） |
| `src/lib/storage.ts` | partitioned localStorage（partitionKey=undefined 降级已有） | 复用层（仅存储 key 名微调） |
| `ribbon.xml` | WPS ribbon 入口 UI（取代 Office manifest Ribbon） | WPS 外壳（新建） |
| `jsplugins.xml` | WPS 加载项注册（取代 manifest.xml） | WPS 外壳（新建） |

---

## Recommended Project Structure

```
Aster/                           # 主仓库
├── src/                         # 复用层（Office.js 和 WPS 共享）
│   ├── main.tsx                 # Office.js 入口（不动）
│   ├── main-wps.tsx             # WPS 入口（新建）★
│   ├── adapters/
│   │   ├── DocumentAdapter.ts   # 接口契约（不动）
│   │   ├── index.ts             # Office.js 工厂（不动）
│   │   ├── PptAdapter.ts        # Office.js PPT（不动）
│   │   ├── ExcelAdapter.ts      # Office.js Excel（不动）
│   │   ├── WordAdapter.ts       # Office.js Word（不动）
│   │   └── wps/                 # WPS 实现层（新建）★
│   │       ├── index.ts         # WPS 工厂 createWpsAdapter
│   │       ├── WpsPptAdapter.ts # 单宿主滩头堡（v2.5 Phase-2）
│   │       ├── WpsExcelAdapter.ts
│   │       └── WpsWordAdapter.ts
│   ├── agent/                   # 复用（不动）
│   ├── lib/sse.ts               # 复用（不动）
│   ├── lib/storage.ts           # 复用（partitionKey undefined 路径已有）
│   └── store/                   # 复用（不动）
├── public/
│   ├── manifest.xml             # Office.js 清单（不动）
│   └── wps/                     # WPS 加载项资产（新建）★
│       ├── ribbon.xml           # WPS ribbon UI
│       ├── jsplugins.xml        # WPS 加载项注册
│       └── index-wps.html       # WPS webview 入口（无 office.js CDN）
├── packages/wps-addin/          # wpsjs CLI 工作目录（新建）★
│   ├── wpsjs.config.js          # wpsjs 工具链配置
│   └── publish/                 # wpsjs build 产物
└── vite.config.ts               # 现有 Vite 配置（加入 WPS 入口）
```

### Structure Rationale

- **`src/adapters/wps/`：** 与 Office.js adapter 同父目录，但物理隔离。`createWpsAdapter` 工厂独立，不干扰 `createAdapter`（Office.js）的懒加载逻辑。
- **`public/wps/`：** WPS 加载项资产放 `public/` 子目录，Vite 直接复制，不参与 bundle。
- **`packages/wps-addin/`：** `wpsjs` CLI 的工作目录，`wpsjs build` 在此生成 `.7z` 和 `publish.html`，与 Vite GitHub Pages 输出完全分离，bundle 预算互不影响。

---

## Architectural Patterns

### Pattern 1：接缝隔离（Seam Isolation）

**What：** `DocumentAdapter` 接口是唯一的跨层接缝。agent loop / tool dispatch / DiffLog / operationLog 只见接口，不见实现。Office.js adapter 和 WPS adapter 是接口的两个平行实现族。

**When to use：** 接缝上方所有代码（agent loop, UI, tools, stores）写 WPS 适配时完全不动。接缝下方（adapter impl + 外壳）按宿主完全重写。

**Trade-offs：** 接口稳定是关键前提。若新能力要求在接口上加新方法（如 WPS 专有 `copySlide()`），需先在 `DocumentAdapter` 接口加声明、在 Office.js adapter 给 stub、再在 WPS adapter 实现——成本低但要有纪律。

```typescript
// src/adapters/wps/WpsPptAdapter.ts — 接缝下方，VBA 风格
export class WpsPptAdapter implements DocumentAdapter {
  async getSelection(): Promise<SelectionContext> {
    // 同步 WPS API → 包装成 Promise
    const app = window.Application;
    const pres = app.ActivePresentation;
    if (!pres) return { kind: 'none' };
    const slideIndex: number = pres.SlideShowWindow?.View?.CurrentShowPosition
      ?? app.ActiveWindow?.Selection?.SlideRange?.SlideIndex
      ?? 1;
    return {
      kind: 'ppt',
      slideIndex,
      slideCount: pres.Slides.Count,
    };
  }

  async read(query: ReadableQuery): Promise<ReadableResult> {
    // 每个 kind 映射到 WPS VBA 风格调用
    switch (query.kind) {
      case 'list_slides': {
        const slides = window.Application.ActivePresentation.Slides;
        // ... 同步读取后 return { ok: true, data: [...] }
      }
      // ...
    }
  }

  // inverse 方法签名与 Office.js adapter 保持一致：收 Record 对象（Phase 5 教训）
  async inverseSetShapeText(args: Record<string, unknown>): Promise<void> {
    // WPS VBA 风格写回
  }
}
```

### Pattern 2：双入口懒隔离（Dual-entry Lazy Isolation）

**What：** Vite 配置加入第二个 `input` 入口 `index-wps.html`（WPS 版）。WPS 入口不 import `Office.*` 类型，Office.js 入口不 import `window.Application` 相关类型。两者共享 `src/agent/`、`src/lib/`、`src/store/`、`src/components/`。

**When to use：** 需要同时维护 Office.js 和 WPS 两条交付线。

**Trade-offs：** Vite multi-entry 打包会生成两套 chunk；共享代码进公共 chunk，adapter 实现各自懒加载。WPS 入口的 `index-wps.html` 不引 `appsforoffice.microsoft.com` CDN 脚本——这是硬性要求，否则 WPS webview 会尝试加载该脚本（能下载但 `Office.onReady` 永远不触发，引起混淆）。

```typescript
// vite.config.ts — 加入 WPS 入口
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',          // Office.js 入口（现有）
        wps:  'public/wps/index-wps.html', // WPS 入口（新建）
      },
    },
  },
});
```

### Pattern 3：storage.ts 无需改动（partitionKey=undefined 已有降级）

**What：** `src/lib/storage.ts` 的 `prefixedKey()` 已经处理 `partitionKey === undefined` 的情况，直接返回裸 `rawKey`。WPS CEF 环境中 `typeof Office === 'undefined'`，会走 `undefined` 降级路径，使用标准 `localStorage`。

**When to use：** WPS adapter 的 store hydrate 逻辑（`hydrateFromStorage`、`loadPrefs`、`loadHistory`）直接复用，无需修改。

**Trade-offs：** [需真机坐实] WPS CEF `localStorage` 是否跨会话持久（WPS-01 §5 清单 1-4），若不持久需改用 `wps.FileSystem` 落文件——但 `storage.ts` 的调用方接口不变，只需替换 `localStorage` 底层实现。

---

## 接缝明细：什么在接缝上方，什么在接缝下方

### 接缝上方（agent loop / tool dispatch / UI）：完全不动

| 模块 | 复用状态 | 说明 |
|------|----------|------|
| `src/agent/loop.ts` | 不动 | 只调 `adapter.read()` / `dispatchTool()` |
| `src/agent/tools/` | 不动 | tool 定义是宿主语义，不是 API 绑定 |
| `src/agent/dispatch.ts` | 不动 | 调 adapter 接口方法 |
| `src/store/operationLog.ts` | 不动 | 记录 inverse 调用合约（Record 对象签名） |
| `src/components/` (UI) | 不动 | React + teal CSS 全复用 |
| `src/lib/sse.ts` | 不动 | fetch/SSE 是纯 Web API，CEF 同 |
| `src/providers/` | 不动 | DeepSeek/AiHubMix 直连，无宿主依赖 |
| `src/store/chat.ts` 等 | 不动 | Zustand store 无宿主依赖 |

### 接缝下方（adapter impl + 外壳）：全量重写

| 模块 | 重写内容 |
|------|---------|
| `src/adapters/wps/WpsPptAdapter.ts` | 所有 read/write/inverse 方法改 WPS VBA 风格 API |
| `src/adapters/wps/WpsExcelAdapter.ts` | 同上 |
| `src/adapters/wps/WpsWordAdapter.ts` | 同上 |
| `src/main-wps.tsx` | OnAddinLoad → Application.ComponentType → createWpsAdapter |
| `public/wps/ribbon.xml` | WPS ribbon UI XML，替代 manifest.xml Ribbon 节 |
| `public/wps/jsplugins.xml` | WPS 加载项注册（type=wps/et/wpp 三条记录） |
| `public/wps/index-wps.html` | WPS webview 入口（无 office.js CDN script tag） |
| `packages/wps-addin/` | wpsjs CLI 工作目录，打包发布 |
| 测试（integration） | WPS adapter 的 operationLog.integration.test 需新建 WPS 版本 |

---

## Data Flow

### Request Flow（WPS 侧，接缝后）

```
用户在 WPS 输入 → Task Pane webview → React UI（复用）
    ↓
agentStore.runAgent()（复用）
    ↓
agent/loop.ts while runner（复用）
    ↓
dispatchTool() → WpsPptAdapter.read(query)（新实现）
                  WpsPptAdapter.write(op)（新实现）
    ↓
window.Application.ActivePresentation.Slides...（WPS VBA JSAPI，同步）
    ↓
Promise.resolve(result) → tool result 回灌 messages（复用）
    ↓
SSE 流式输出（fetch → ReadableStream，CEF 复用）
```

### 宿主识别流程（WPS 入口）

```
WPS 启动 → 读 jsplugins.xml → 打开 index-wps.html → 加载 main-wps.tsx
    ↓
ribbon.xml onLoad="OnAddinLoad" 触发
    ↓
OnAddinLoad() → window.Application.ComponentType 读值
    ↓
1 → createWpsAdapter('word')  → WpsWordAdapter
2 → createWpsAdapter('excel') → WpsExcelAdapter
3 → createWpsAdapter('ppt')   → WpsPptAdapter
    ↓
AdapterContext.Provider value={adapter} → App render（复用）
```

### Key Data Flows

1. **API Key 存储（WPS）：** `storage.ts` 的 `prefixedKey()` 在 `typeof Office === 'undefined'` 时走裸 `rawKey`，命中 CEF `localStorage`（前提真机 1-4 绿灯）。Key 仍不离开用户浏览器（CEF），无后台约束不变。
2. **LLM SSE 直连（WPS CEF）：** `src/lib/sse.ts` 用原生 `fetch + ReadableStream`，CEF=Chromium 原生支持两者。DeepSeek/AiHubMix 端点在 Office for Web 已坐实 CORS 放行；WPS CEF 容器 CSP 是最高优先真机项（清单 1-2），若容器注入 `connect-src` 限制则整个无后台直连模型在 WPS 内挂。
3. **图片插入（WPS 侧）：** `generate_ppt_image` 工具仍从 `aihubmix-image.ts` 拿 base64，再调 WPS VBA 风格 `Shapes.AddPicture()`（类比 Office.js `addImageShape`）。WPS 插图 API 签名不同但语义一致，adapter 内部封装。

---

## Build Order（证据优先分阶段）

### Phase 1（验证探针）— WPS-02 真机验证硬门

**目标：** 用最小代码量跑完 §5 清单，得出 go/no-go，**不写任何生产 adapter 代码。**

**产物：** 一个 `wpsjs create` 最小 spike 加载项（独立目录，不进 Aster 主仓 `src/`），内含：

```
spike-wps-probe/
├── ribbon.xml      # 一个按钮 "运行探针"
├── index.html      # 加载 probe.js
└── probe.js        # 跑清单 §5 所有检测
```

`probe.js` 探针内容（照 WPS-01 §5 清单）：
1. `navigator.userAgent` → 记录 CEF/Chromium 版本
2. `fetch('https://api.deepseek.com/chat/completions', {stream:true})` → 验 SSE 直连 + CORS
3. `fetch('https://api.aihubmix.com/v1/...')` → 验图片直连
4. `localStorage.setItem` + 关 WPS 重开 + `getItem` → 验持久化
5. Google Fonts CSS 请求 → 验字体加载
6. `window.Application.ComponentType` → 验三宿主识别值
7. `Application.ActivePresentation.Slides` read → 验 PPT 读
8. `Application.ActivePresentation.Slides.Add()` + 写标题 → 验 PPT 写
9. 删页恢复 → 验 PPT undo 可行性

**此 Phase 不进主仓 `src/`，不改 Vite config，不改任何现有文件。**

**依赖：** 用户在 Windows WPS 专业版环境跑（Claude 在 Mac 无法代跑）。

**输出：** 每条清单项 绿/红 + 记录，→ go/no-go 裁定。

**若 go/no-go 中途挂：** CORS（清单 1-2）失败 → 无后台直连模型在 WPS 内不可行 → 整个 WPS milestone 转方向或挂起。这是唯一阻止后续所有工作的单点。

---

### Phase 2（单宿主滩头堡）— 真机探针全绿后才开工

**目标：** 把一个宿主（PPT/Excel/Word 三选一，讨论后定）的 read + write + undo 跑通在 WPS 真机，端到端 agent loop 有一个 killer scenario 成功。

**依赖顺序（串行）：**

```
Phase 2a — WPS 加载项外壳搭建
    ├── 新建 src/main-wps.tsx（OnAddinLoad + ComponentType 宿主识别）
    ├── 新建 public/wps/index-wps.html（无 office.js CDN，引 main-wps 产物）
    ├── 新建 public/wps/ribbon.xml（一个 Tab + 一个 "打开面板" 按钮）
    ├── 新建 public/wps/jsplugins.xml（三宿主注册条目）
    └── Vite config 加入 wps 入口（multi-input）
        → 验证：WPS 能加载 Task Pane，React UI 显示，主题/字体正常

Phase 2b — 选定宿主 adapter 实现（以 PPT 为例）
    ├── 新建 src/adapters/wps/index.ts（createWpsAdapter 工厂）
    ├── 新建 src/adapters/wps/WpsPptAdapter.ts
    │   ├── getSelection() → Application.ActivePresentation 同步读
    │   ├── read('list_slides') / read('get_slide') / read('list_shapes')
    │   ├── write tools：setShapeText / insertSlideAfter / deleteSlideByIndex
    │   └── inverse（快照合约，Record 对象签名，operationLog 守门）
    └── 验证：agent loop 可读 PPT 结构 + 写一张 slide + undo 成功

Phase 2c — 复用层 CEF 坐实
    ├── storage.ts 验证 Key 存活跨会话（partitionKey=undefined 路径）
    ├── SSE 直连验证（从 Task Pane 发一个 DeepSeek 请求）
    └── 完整 killer scenario：「在 WPS PPT 里根据主题生成3张幻灯片」端到端

Phase 2d — 收口
    ├── operationLog.integration.test（WPS adapter 版本）
    ├── bundle gate 验证（WPS 入口自己的 bundle 预算，独立于 Office.js 的 100KB 门）
    └── wpsjs publish 流程验证（用户能安装）
```

**Phase 2b 宿主选择建议：PPT（金山演示）**
- WPS-01 §4 标注的 D-03 增益项中，PPT 解锁最多（copy_slide / 读背景色 / 插表格 / 渐变），ROI 最高
- Excel/Word 的 VBA 风格 API 同样成熟，但 PPT 的"copy_slide"是 Office for Web 的已知痛点，WPS 真机坐实后即是立即可交付的差异化价值
- 讨论 Phase（gsd-discuss-phase）最终定

---

## Anti-Patterns

### Anti-Pattern 1：在 index.html 做运行时宿主切换（runtime dispatch 选 Office vs WPS）

**What people do：** 在同一个 `index.html` 里用 `if (typeof window.Application !== 'undefined')` 决定走 WPS 路径还是 Office.js 路径。

**Why it's wrong：** `Office.onReady` 和 `OnAddinLoad` 是两套初始化链，引导时序不同。更严重的是，Office.js 的 CDN script tag 在 WPS webview 里会被加载（CEF 能 fetch 该文件），但 `Office.onReady` 永远不触发，引起竞态和 timeout。两个入口必须物理分离，不能共用同一个 HTML 文件。

**Do this instead：** 两个独立的入口文件（`index.html` 和 `index-wps.html`），Vite multi-input。

### Anti-Pattern 2：在 WPS adapter 里模仿 `*.run()` + `load/sync` 范式

**What people do：** 为了"统一代码风格"，在 WPS adapter 里包一层伪 `run()` wrapper，让代码看起来像 Office.js。

**Why it's wrong：** WPS API 是同步的，强行模仿 `load`/`sync` 异步范式会引入无意义的 `await` 和 `Promise` 包装，增加调试难度。WPS adapter 应该直接写同步调用，`async` 只用于满足接口签名。

**Do this instead：** WPS adapter 方法体内同步读 `window.Application.*`，方法签名 `async` 是接口要求，`return Promise.resolve(result)` 即可。

### Anti-Pattern 3：在 WPS adapter 中调用 isSetSupported

**What people do：** 把 Office.js adapter 的 `if (Office.isSetSupported('PowerPointApi', '1.5'))` 门控照搬进 WPS adapter。

**Why it's wrong：** `Office.isSetSupported` 在 WPS 环境中 `Office` 未定义，直接 crash。WPS 没有 requirement set 概念。

**Do this instead：** WPS adapter 中用 WPS 自身的能力探测（`try { window.Application.xxx; } catch (e) { /* fallback */ }`），或真机验证后直接写 `true`/`false` 静态判断。

### Anti-Pattern 4：用 `wps.PluginStorage` 存 API Key

**What people do：** 把 API Key 存进 `window.Application.PluginStorage.setItem()`。

**Why it's wrong：** WPS 官方文档明确：`PluginStorage` 不持久化，关闭加载项即失效。Key 每次重开 WPS 都会丢失。

**Do this instead：** 使用 CEF `localStorage`（storage.ts 现有降级路径），或 WPS `FileSystem` 对象落本地文件（若 localStorage 真机验证不持久）。

---

## Integration Points

### External Services

| 服务 | WPS 侧集成方式 | 风险点 |
|------|--------------|--------|
| DeepSeek API | CEF fetch + ReadableStream（`sse.ts` 复用） | WPS 容器 CSP 是高危面（清单 1-2 必验） |
| AiHubMix 视觉/生图 | 同上，base64 响应 | 同上 + 图片 URL CORS |
| Google Fonts | CEF `<link>` 加载（`index-wps.html`） | CEF 可能有字体缓存策略差异 |
| Pexels 图库 | CEF fetch（`Authorization` header） | 同 CORS 风险 |

### Internal Boundaries

| 边界 | 通信方式 | 注意事项 |
|------|---------|---------|
| `agent/loop.ts` ↔ WPS adapter | `DocumentAdapter` 接口（Promise 签名） | 接口不变，接缝上方零改动 |
| `main-wps.tsx` ↔ `ribbon.xml` | `OnAddinLoad` 回调（WPS 注入） | `onLoad="OnAddinLoad"` 在 `customUI` 根节点声明 |
| `storage.ts` ↔ CEF localStorage | 原生 `localStorage` API | `partitionKey=undefined` 路径已有，不需改 storage.ts |
| WPS adapter ↔ `operationLog` | `inverse` Record 对象签名合约 | Phase 5 教训：inverse 必须收 Record 对象而非位置参 |

---

## Scaling Considerations（此项目非用户规模，而是功能规模）

| 扩展维度 | 当前（v2.5 滩头堡） | 后续（WPS-D1 全量） |
|---------|------------------|------------------|
| 宿主覆盖 | 单宿主（PPT 或 Excel 或 Word） | 三宿主全量 adapter |
| WPS JSAPI 覆盖 | 核心 read/write/undo（~10 方法） | 对齐 Office.js 全套（~50+ 方法） |
| D-03 增益 | 不做（先对等迁移） | copy_slide / 读背景色 / 页边距等 |
| wpsjs 发布 | publish 模式（本地安装） | AppStore/企业 MDM 分发 |

---

## Sources

- WPS-01 调研报告（`.planning/phases/25-wps-spike-gate/25-WPS-01-REPORT.md`）— 接缝设计的基础，HIGH confidence
- `src/adapters/DocumentAdapter.ts`（实际代码，接口定义）
- `src/adapters/index.ts`（createAdapter 工厂，懒加载模式参考）
- `src/main.tsx`（Office.onReady 入口，WPS 入口的设计参考对象）
- `src/lib/storage.ts`（partitionKey=undefined 降级路径，line 66-72）
- [WPS JSAPI ComponentType / Application.Name（WPS 社区文档，看云）](https://www.kancloud.cn/pwedu/wps-js-macros/2259310) — MEDIUM confidence（通过 WebSearch 聚合结论确认）
- [jsplugins.xml 三宿主配置（金山致远集成文档）](https://open.seeyoncloud.com/v5devCTP/1842/1851/1852.html) — MEDIUM confidence
- [lnxsun/opencode-wps ribbon.xml 实例（GitHub）](https://github.com/lnxsun/opencode-wps) — MEDIUM confidence（实际 WPS 加载项代码验证 ribbon.xml 格式）
- [herman-hang/wps jsplugins.xml 三宿主示例（GitHub）](https://github.com/herman-hang/wps/blob/main/jsplugins.xml) — MEDIUM confidence
- [tankwyn/WPS-Zotero ribbon.xml（GitHub）](https://github.com/tankwyn/WPS-Zotero/blob/main/ribbon.xml) — MEDIUM confidence（ribbon customUI 格式验证）
- [WPS 加载项开发说明（wpscdn 官方文档）](https://qn.cache.wpscdn.cn/encs/doc/office_v8/topics/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91/WPS%20%E5%8A%A0%E8%BD%BD%E9%A1%B9%E5%BC%80%E5%8F%91%E8%AF%B4%E6%98%8E.html) — HIGH confidence

**[需真机坐实 — LOW confidence until WPS-02 green]：** CEF 版本 / CORS/CSP 策略 / localStorage 持久性 / WPS JSAPI 具体方法签名。

---
*Architecture research for: Aster v2.5 WPS 滩头堡 接缝设计*
*Researched: 2026-06-08*
