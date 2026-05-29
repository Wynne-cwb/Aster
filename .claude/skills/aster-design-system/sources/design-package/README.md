# Handoff: Aster — Office 任务窗格 AI 助手

## Overview

**Aster** 是一个嵌在 Microsoft Office（PowerPoint / Excel / Word）右侧 task pane 的 AI 助手。固定宽度 **350px**，主要功能：

- 用用户自带的 LLM Provider Key（BYO Key）跟模型对话
- 读取宿主文档当前选区作为上下文
- AI **自动写回**文档（无确认弹窗）后用「已写入」卡片告知用户，并提供「撤销」
- 多动作聚合显示
- 内置 DeepSeek + AIHubMix 两个 Provider，可新增自建 Provider

设计语言：克制（quiet variant），Inter + Noto Sans SC sans-serif 体系，单一品牌色 `#009887`。

---

## About the Design Files

`src/` 下的文件是**用 HTML + 内联 JSX（Babel standalone）做的设计参考稿**——展示视觉、布局、交互行为，不是可以直接发布的生产代码。

你的任务是**在目标 codebase 现有的环境里重新实现这套设计**——如果项目已经有了 React/Vue/SwiftUI/原生等技术栈，沿用它的组件库、状态管理、样式方案；如果项目还是空的，选最适合的 Office add-in 技术栈（典型：Office.js + React + TypeScript + Fluent UI 或自建 token 系统）来实现。

**不要直接把这份 HTML 打包成 Office add-in 发布**——它是参考，不是产物。

---

## Fidelity

**High-fidelity (hifi)** —— 所有颜色、字号、行距、圆角、间距、阴影、动效时长都是定稿值。在你的 codebase 里重建时**应像素级还原** Light theme 下的视觉，Dark theme 的色卡也已经定义在 `aster.css` 里。

例外：原型里 PowerPoint / Excel / Word 三个图标用了微软的官方 logo（`src/icons/office-*.svg`，由用户提供）。在真实产品里请直接引用 Office 资产或经过授权的图标包。

---

## Tech Snapshot of the Prototype

- 入口：`src/Aster Prototype.html`
- 渲染：React 18 (UMD) + Babel standalone 即时转译
- 状态：`useState` + `localStorage` 持久化（key = `aster.proto.state.v1`）
- Tweaks panel（`src/tweaks-panel.jsx`）是**调试工具**，不要带到生产；保留它是为了让你能在原型里切换 host / 模拟错误 / 重置 onboarding

---

## Screens / Views

下面 9 个屏（实际是 3 个状态层叠：`pane` 主面板 + `settings-overlay` 滑出 + `modal-scrim` 蒙层）。

### 1. Onboarding · Step 1 / 2 · 配置 LLM Provider

**Trigger**：`state.onboarded === false && state.view === "onboard-1"`，渲染 `.modal-scrim`

**Layout**：
- 全屏 dark scrim（`color-mix(in srgb, var(--text-black) 35%, transparent)`），居中一个 `.modal`（最大宽度 ~320px，圆角 `16px`，背景 `var(--surface)`，阴影 `var(--shadow-pop)`）。
- 顶部品牌行 `.modal-brand`：[Aster logo · 22px PNG] + 文字 "Aster" + 右侧灰色 step indicator "01 / 02"
- 标题 `.modal-title`：`fs-18 / 600 / var(--text)`
- 副标题 `.modal-sub`：`fs-13 / 400 / var(--text-2) / line-height 1.6`
- 表单 `.modal-body`：
  - **DeepSeek API Key · 必填**：标准 input，password 类型，mono 字体
  - **AIHubMix API Key · 选填**：标准 input + `.field-hint`「用于生图与视觉理解，未配置时相关按钮自动停用。」
- Foot：`.btn-ghost`「跳过」+ `.btn-primary`「下一步」

⚠️ **注意**：旧版本曾有「默认 LLM Provider」radio 选择器（DeepSeek / AIHubMix），已根据最新需求移除。默认 Provider 硬编码为 `"deepseek"`。

### 2. Onboarding · Step 2 · 三宿主能力卡

跟 Step 1 共用 modal 外层。body 里三张 `.host-card`：
- 36×36 透明容器装 **官方 SVG 图标**（PPT 橙、Excel 绿、Word 蓝）
- 标题 `PowerPoint / Excel / Word`，`fs-14 / 600`
- 三条要点（`<ul>`，`fs-12 / text-2 / 1.55 line-height`）
- 卡之间 `gap: 12px`，卡内 `padding: 14px`，圆角 `12px`，背景 `var(--surface)`

Foot：`.btn-ghost`「上一步」+ `.btn-primary`「开始使用」

### 3. Main · Empty State

**Trigger**：`state.onboarded && messages.length === 0`

**Layout**（垂直居中，不再 top-skewed）：
- `.empty-mark`：44×44 透明容器，里面是 Aster logo `<img>` 32px，pulse 动画 4s ease-in-out infinite
- `<h3>` 「从你正在做的东西开始」 · `fs-16 / 600 / var(--text)`
- `<p>` 「选中文档里的内容，告诉 Aster 你想做什么。也可以直接试试下面的入口。」 · `fs-13 / var(--text-2) / 1.6`
- `.suggestions`：3 个 ghost button，每个：
  - 左 icon（sparkles / image / type，14px stroke 1.5）
  - 中间 label `fs-13 / var(--text) / text-align left`
  - 右尾箭头 `arrowRight 13px / var(--text-3)`，hover 时向右平移 2px
  - gap: 10px, padding: 8px 12px, border `var(--border)`, radius `10px`, hover bg `var(--surface-2)`

### 4. Main · Chat State

**Layout**（top → bottom）：
```
[.pane-banner]?     ← 只在 keyMissing 时显示
[.chat-scroll]      ← 内含 .chat (gap 18px)
[.inputbar-wrap]    ← 内含 .inputbar
```

⚠️ **没有 ContextRow**——之前顶部有一条 "PPT · 第 3 张幻灯片 + 齿轮"，已根据最新需求**整条移除**。设置入口移到了输入框底部 tools 左下角。

#### 4a. ConfigBanner（API Key 未配时）
- 单行薄 banner：padding `5px 14px`，bg `color-mix(in srgb, var(--warning) 6%, transparent)`，文字 warning 色 `fs-11 / 500`
- 左侧 alertCircle 12px，右侧 inline `<a>` 「前往设置 →」点击进 settings

#### 4b. ChatStream → MessageBubble

**用户气泡（msg-user）**：
- 右对齐
- bg `var(--accent)` (#009887)，文字 `var(--accent-on)` (#FFFFFF)
- padding `9px 12px`，radius `12px`，右下角拉直到 `4px`（指向感）
- inner highlight：`box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent)` —— 体感更精致
- max-width `88%`

**AI 气泡（msg-ai）**：
- 左对齐
- bg `var(--bubble-ai-bg)` —— Light: `#EEEEF0`, Dark: `#1F1F23`
- 文字 `var(--text)`，左下角拉直 `4px`
- 细描边 `1px solid color-mix(in srgb, var(--border) 55%, transparent)`，dark 75%

**Markdown-lite**：bubble 内支持
- inline code（`` `code` ``）：bg `rgba(0,0,0,0.05)` (user 气泡内 `rgba(255,255,255,0.18)`)，mono，0.88em
- `<ul>`：margin `6px 0 0`，padding-left `18px`
- `<pre>`：mono code block，padding `9px 11px`，bg surface + border

**msg-time（时间戳）**：
- 永远显示在气泡下方（不再 hover 触发）
- mono 10px，`var(--text-3)`，opacity 0.7
- 格式 `MM-DD HH:MM`（白天的话也带日期）
- `white-space: nowrap`，否则会换行成两行

#### 4c. 写回卡（Writeback / Action Card）

⚠️ **架构注意**：AI 自动写文档，**不再有「接受 / 拒绝」按钮**。这张卡是事后通知。

**单动作**（`writeback = { target, lines }`）：
```
┌─────────────────────────────────────────┐
│ [✓ 已写入]  替换·第3张幻灯片·要点1-3  撤销 │
│  · 把功能藏得太深，用户根本找不到。      │
│  · 新人前 7 天活跃率只剩 34%。           │
│  ⌄ 展开剩余 1 项                        │
└─────────────────────────────────────────┘
```

**多动作**（`writeback = { actions: [{target, lines}, ...] }`）：
```
┌──────────────────────────────────────┐
│ [✓ 已写入]  5 项修改         撤销全部 │
├──────────────────────────────────────┤
│ ⌄ 替换 · 第 3 张 · 要点 1-3          │
│ ⌄ 替换 · 第 5 张 · 要点 1-2          │  ← 点击 chevron 展开/收起单条
│ ⌄ 配图 · 第 1 张                     │
│ ⌄ 配图 · 第 2 张                     │
│ ⌄ 插入 · 第 12 张 · TL;DR 总结       │
└──────────────────────────────────────┘
```

**视觉规格**：
- 卡 bg `var(--surface)`，border `1px solid var(--border)`，radius `var(--radius-3)`，margin-top `8px`
- `.wb-status` 胶囊：bg `color-mix(in srgb, var(--success) 14%, transparent)`，color `var(--success)`，radius 999px，padding `2px 8px`，`fs-11 / 600`
- `.wb-undo` 文字按钮：`fs-11 / var(--text-3)`，hover bg `rgba(0,0,0,0.06)`
- 单动作 body：`<ul>` 自渲染圆点（不要 `<li>` 自带 disc），每点是 3×3 圆点 `var(--text-3)`
- 单动作 max 2 lines，超过显示 `展开剩余 N 项` toggle，箭头 hover 转 180°
- 多动作每行 `.wb-action-head`：button，左 chevron 11px（展开时 rotate 180）+ target ellipsis；展开时下面 `.wb-action-body` ul，padding-left 26px
- **撤销态**：整卡加 `.is-undone` class，胶囊变中性灰，body 删除线，加底部 `.writeback-undone` 提示「已撤销，文档已回滚到上一状态」

#### 4d. ErrorBubble（替代 AI 气泡的错误态）
- 跟 `.bubble-ai` 同形状：bg `var(--bubble-ai-bg)`，radius `12px`，左下角 `4px`
- 左侧 3px `box-shadow: inset 3px 0 0 var(--error)` 当 accent stripe
- head 红色字（`var(--error)` 600 weight），含 alertTriangle 13px + mono `.code` 代号（`KEY_INVALID / QUOTA / ...`）
- body 正文 `var(--text)`，可选 `.cta` 链接（红色下划线）

错误目录见 `proto-state.jsx` `ERROR_CATALOG`：`KEY_INVALID, QUOTA, RATE_LIMIT, CONTEXT, NETWORK, FILTER, MODEL, IMAGE_QUOTA`（8 类）

#### 4e. InputBar

**Layout**（自上而下）：
1. `.selpill-row` (可选)：当 `state.pillVisible` 为真，单行胶囊「[doc icon] {host.desc} [eye/eyeOff]」，bg `var(--accent-soft)` (#009887 14%)
2. `<textarea>` rows=2，auto-grow 到 max 140px，placeholder 「输入消息…」/「AI 正在回答…」
3. `.tools`（底部一行）：
   - 左：齿轮按钮（28×28 tool-btn，gear 15px stroke 1.4）—— 进设置
   - 左：附件按钮（paperclip 15px，`aria-disabled` ghost 态，title「文件上传即将开放」）
   - 右：发送按钮 `.send-btn`（28×28 圆角 8px，bg accent，accent-on color）
     - streaming 时变 ▢ 停止键，bg 变 `var(--text)`
     - disabled（text 为空）时变 ghost：透明 bg + 灰图标

容器：`.inputbar-wrap` padding `8px 12px 12px` bg `var(--bg-pane)` border-top；`.inputbar` 内层 radius `12px`，bg `var(--surface)`，1px 描边

### 5. Settings · Browse

**Trigger**：`state.view === "settings-browse"`，渲染 `.settings-overlay.is-open`（绝对覆盖 pane，左 slide-in）

**Layout**：
- `.settings-head`：返回按钮（chevronLeft 16）+ 标题「设置」
- 滚动 body：
  - section label「Providers」
  - 3 个 `.provider-row`：
    - 左 `.pinfo`：name 加粗 + 「默认」橙底徽章（**仅内置 Provider 有，即 `p.builtIn`**）+「已配 Key」绿徽章 or「未配 Key」灰徽章；下一行 `.pmodel` mono 灰字显示模型 ID（多模型槽用 `·` 分隔，例：`gpt-5o · gpt-image-2`）
    - 右 `.pactions`：编辑（pencil 14）+ **「更多」仅非内置才显示**
  - `.row-add` 「+ 新建 Provider」：进 edit-new 流
  - section label「全局」
  - `.row-toggle`「选中内容自动附带」+ 右侧 switch（teal when on）
  - `.row-link`「重看引导」(refresh icon + chevronRight)
  - footer：版权一行 mono 灰字

### 6. Settings · Edit Provider

**Trigger**：`state.view === "settings-edit"`，`state.editingProviderId` 为 provider id 或 `"new"`

**Layout**：
- 跟 SettingsBrowse 同 header（标题改「编辑 Provider」/「新建 Provider」）
- body 字段（自上而下）：
  - **「内置 Provider · 名称与 Base URL 不可改」** 胶囊（`.builtin-note`），仅 `form.builtIn === true` 时显示，bg `var(--surface-2)`，灰字，white-space nowrap
  - **名称** input（builtIn 时 disabled，bg `var(--surface-2)` cursor not-allowed）
  - **Base URL** input mono（builtIn 时 disabled）
  - **模型 ID**：
    - 如果该 provider 有 `PROVIDER_MODEL_SLOTS` 配置：每个 slot 渲染一组「label + select + field-hint 描述」
      - DeepSeek 单槽：「模型 ID」下拉 `deepseek-v4-pro / deepseek-v4-flash`
      - AIHubMix 双槽：「图片识别模型」(`gpt-5o`) + 「图片生成模型」(`gpt-image-2`)
    - 否则单 input（自由填）
    - select 自定义：`appearance: none` 去掉原生箭头，右边 abs `<span.select-caret>` 装 chevronDown 14px
  - **API Key** input，password 默认，右侧 28×28 eye 切换按钮
- foot `.settings-foot`：「取消」secondary + 「保存」primary（builtIn 时 name 不可空）

### 7. PDF / 大文件 Prompt（设计稿里有，但当前 prototype 主流程未走通）

参考 `screens.jsx` 里 `PdfPrompt` 组件——modal 形态，含三个 `.prompt-option`（切片 / 截断 / 升级 Provider）。仅作未来扩展参考。

---

## Interactions & Behavior

### 状态机（顶层 view）
```
onboard-1 ─→ onboard-2 ─→ main ─→ settings-browse ⇄ settings-edit
   ↑__________________________| (从 Tweaks「重看引导」或 Settings「重看引导」回 onboard-1)
```

### 聊天流核心行为
- **Stream 模拟**：每 28ms 切 2 个字符增量更新 `msg.text`，全长后填入 list/pre/after/cost/writeback
- **Auto-stick-to-bottom**：滚动距离 < 80px 时新消息自动滚到底；用户主动上滚后停止粘
- **停止按钮**：streaming 时发送按钮变 ▢，点击 clear interval 并把当前消息 streaming 标志置 false
- **回车发送**：Enter 直接发，Shift+Enter 换行
- **输入禁用**：streaming 时 textarea disabled

### Writeback 撤销
- 单击「撤销」/「撤销全部」→ `onDecide(msgId, "undo")` → `state.messages` 里那条的 `writeback.decided = "undo"`
- 加 `.is-undone` 类，胶囊变中性灰，body 删除线，加底部「已撤销」提示
- 撤销态不再展示撤销按钮

### Writeback 展开
- 单动作 body 默认显示前 2 项 lines，多则有 toggle button「展开剩余 N 项 ⌄」
- 多动作每行独立 chevron 切展开（state 用 `Set<number>` 记录）

### Settings 进入 / 退出
- 设置滑入用 `.settings-overlay.is-open`（CSS transform / opacity transition）
- 编辑页保存 → 回 browse；取消 / 返回同
- 内置 Provider 编辑页：name + baseUrl input disabled，model 槽改值仍可保存

### Onboarding 跳过 / 完成
- Step 1 → 「跳过」直接 `onClose`（落到 main）；「下一步」存 key 后进 Step 2
- Step 2 → 「上一步」回 Step 1；「开始使用」`set({ onboarded: true, view: "main" })`

### ConfigBanner 出现条件
- `state.onboarded === true && 默认 provider 没有 key`

---

## State Management

完整 state shape（来自 `proto-state.jsx`）：

```ts
type State = {
  onboarded: boolean;
  view: "onboard-1" | "onboard-2" | "main" | "settings-browse" | "settings-edit";
  editingProviderId: string | "new" | null;
  providers: Provider[];
  defaultProviderId: string;       // 锁定 "deepseek"
  autoAttachSelection: boolean;
  writebackMode: "confirm" | "auto"; // 历史字段，新架构不再用
  pillVisible: boolean;
  pillOn: boolean;
  host: "ppt" | "xls" | "doc";
  messages: Message[];
};

type Provider = {
  id: string;
  name: string;
  model: string;          // 主模型（DeepSeek 单槽用）
  visionModel?: string;   // AIHubMix · 图片识别
  imageModel?: string;    // AIHubMix · 图片生成
  baseUrl: string;
  key: string;
  inputPrice: string;
  outputPrice: string;
  toolCalling: boolean;
  builtIn: boolean;       // 内置 Provider 不可改名 / baseUrl
};

type Message =
  | { id: string; role: "user"; text: string; ts: number }
  | { id: string; role: "ai"; text?: string; list?: string[]; pre?: string;
      after?: string; cost?: {tokens, yuan?}; writeback?: Writeback;
      streaming?: boolean; ts: number }
  | { id: string; role: "error"; err: {code, text, cta?, info?}; ts: number };

type Writeback =
  | { target: string; lines: string[]; decided: null | "undo" }                    // single
  | { actions: { target: string; lines: string[] }[]; decided: null | "undo" };    // multi
```

**Migration 逻辑**（`loadState` 里）：
- 内置 Provider（`builtIn === true`）的 `name` + `baseUrl` 每次 load 都强制对齐到 `DEFAULT_PROVIDERS` 里的当前值
- 内置 Provider 的模型槽值若不在 `PROVIDER_MODEL_SLOTS` 选项里，重置到 default
- 这样改产品默认值时旧用户能自动迁移，不必清缓存

---

## Design Tokens

### Colors（Light · `.v-quiet`）

```css
--bg:           #FAFAF8;   /* 页面 / pane 暖白底 */
--bg-pane:      #FAFAF8;
--surface:      #FFFFFF;   /* 卡片 / chat 区域底 */
--surface-2:    #F3F2EE;   /* 次级面 / hover 区 */
--surface-3:    #E9E7E0;
--border:       #E7E5DF;
--border-strong:#D0CDC4;

--text:         #131316;
--text-2:       #5E5C58;
--text-3:       #94918A;

--accent:       #009887;   /* 🔒 锁定 teal */
--accent-hover: #007A6E;
--accent-soft:  #D2EDE8;
--accent-on:    #FFFFFF;

--success:      #15803D;
--success-soft: #DCFCE7;
--warning:      #B45309;
--warning-soft: #FEF3C7;
--error:        #DC2626;
--error-soft:   #FEE2E2;
--info:         #0369A1;
--info-soft:    #E0F2FE;

--bubble-ai-bg: #EEEEF0;   /* 冷灰，跟 white chat 底分层 */
```

### Colors（Dark · `.v-quiet[data-theme="dark"]`）

```css
--bg:           #0E0E10;
--bg-pane:      #0E0E10;
--surface:      #181819;
--surface-2:    #1F1F21;
--surface-3:    #28282B;
--border:       #26262A;
--accent:       #4FC9B8;
--accent-hover: #6BDBC9;
--accent-soft:  rgba(79,201,184,0.18);
--accent-on:    #0E0E10;
--bubble-ai-bg: #1F1F23;
/* ...其余跟 light 同名变量见 aster.css */
```

### Typography

- **正文**：Inter + Noto Sans SC，weights 400 / 500 / 600 / 700
- **Mono**：JetBrains Mono 400 / 500（用于时间戳、模型 ID、URL、code、token 标）
- **Display**：变体里有 `--font-display`（editorial 套用 Noto Serif SC），quiet 套用同 `var(--font-body)` —— 实际只用一套字体
- **字号阶**：`--fs-11 / 12 / 13 / 14 / 15 / 16 / 18`（11-12 用作 meta / caption，13 为正文）

### Radius

`--radius-1: 4px` · `--radius-2: 8px` · `--radius-3: 12px` · `--radius-full: 999px`

### Spacing

4 · 6 · 8 · 10 · 12 · 14 · 18 · 24 · 32 px（无严格 scale，按需）

### Motion

- `--dur-fast: 120ms` · `--dur-base: 200ms` · `--dur-slow: 320ms`
- `--ease-out: cubic-bezier(.22, 1, .36, 1)` —— 默认
- `--ease-spring: cubic-bezier(.34, 1.56, .64, 1)` —— 用于齿轮 hover 旋转
- pulse animation：empty-mark logo `4s ease-in-out infinite scale(1)↔scale(1.06)`

### Shadows

```css
--shadow-card: 0 1px 2px rgba(0,0,0,0.04);
--shadow-pop:  0 24px 48px -16px rgba(0,0,0,0.16), 0 2px 8px rgba(0,0,0,0.06);
--shadow-input: inset 0 0 0 1px var(--border);
--ring-focus:   0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
```

---

## Assets

- `src/assets/aster-logo.png` — Aster 品牌渐变星标，440×440 透明 PNG（用户提供）。所有 `<AsterMark>` 调用都用它。
- `src/icons/office-ppt.svg`、`office-excel.svg`、`office-word.svg` — Microsoft Office 三件套官方图标（用户提供）。在 onboarding step 2 的 `.host-card .host-mark` 里渲染。
- 其它图标全部来自 [Lucide](https://lucide.dev)，定义在 `src/icons.jsx` 的 `icons` 对象里。`<Icon name="..." size={...} strokeWidth={1.5} />`，默认 stroke 1.5（refined），AsterMark 单独走品牌 PNG。

---

## Files in This Bundle

```
src/
├── Aster Prototype.html      # 入口，加载 React + Babel + 四个 jsx
├── aster.css                 # 全部样式 token + 组件样式（~2000 行）
├── icons.jsx                 # Lucide icon registry + AsterMark 品牌组件
├── proto-state.jsx           # 状态 schema、默认 providers、canned replies、ERROR_CATALOG、loadState/saveState
├── proto-app.jsx             # 全部 React 组件（MessageBubble / InputBar / Onboarding / Settings* / ChatStream / App）
├── tweaks-panel.jsx          # 调试面板（生产请删）
├── assets/
│   └── aster-logo.png
└── icons/
    ├── office-ppt.svg
    ├── office-excel.svg
    └── office-word.svg
```

---

## Implementation Notes / 建议落地路径

1. **建议技术栈**：Office Add-in 通用栈 = Office.js + React + TypeScript + Vite，样式可走 CSS Modules / Tailwind / Stitches，看 codebase 习惯。
2. **Token 移植**：把 `aster.css` 里 `.v-quiet` 块里的所有 CSS var 提取成一个 `tokens.ts`（或 Tailwind theme），不要硬编码颜色。
3. **拆组件优先级**（按可复用性）：
   - `<Bubble variant="user|ai|error">`
   - `<WritebackCard data={Writeback}>` —— 这是这套设计里最关键、最易复用的组件
   - `<InputBar>` —— 含 selpill / textarea / tools row
   - `<Modal>` —— onboarding 通用容器
   - `<Settings*>` —— 表格行 + 滑入 overlay
4. **Office.js 集成点**：原型里 `host` 是模拟的（`"ppt" | "xls" | "doc"`），实际产品要从 `Office.context.host` 读真值；`selectionPill` 描述要从对应 host 的 selection API 拉。
5. **Stream**：原型用 `setInterval` 模拟切片，实际接 LLM SSE 流即可，UI 行为（caret 闪烁、auto-stick）保持。
6. **Provider Key 存储**：原型存在 localStorage 里，实际产品建议走 `Office.context.roamingSettings` 或加密本机存储——原型里的隐私文案承诺过「Key 只保存在本机」。
7. **撤销实现**：原型只改 state、画删除线。生产要真的调宿主 API 做 undo / revert——可能要在写回时记 transaction ID。
8. **多动作的原子性**：原型把多动作打包成一张卡，撤销也是「撤销全部」。如果产品后面要单条撤销，把 `decided` 提到 action level。

---

## Open Items / Known Gaps

- **PdfPrompt（大文件切片提示）** 在 `screens.jsx` 里有视觉稿，但当前 `proto-app.jsx` 主流程未串。如果未来要支持 PDF 文件附件，照 `screens.jsx` 的 modal 形态实现。
- **附件上传** 已经有 `.attach-card` 样式但按钮 disabled，文案「文件上传即将开放」。Phase 3 功能。
- **多语言** 当前 UI copy 全中文。产品要多语言的话，所有可见字符串需要走 i18n。
- **Dark theme** 颜色 token 都齐了，但没经过完整 QA。上生产前请逐屏过一遍。
- **错误状态** 8 类都有视觉稿和文案，但只 `KEY_INVALID` 等几条接进了「下次回复模拟错误」tweak。生产要照 backend 真实 error code 表 wire 起来。

---

如有理解不到位的地方欢迎回到原型里点几下感受一下：`src/Aster Prototype.html` 用浏览器直接打开就能跑（不需要构建）。Tweaks 面板里的「塞入示例对话」、「塞入多动作示例」、「重看引导」三个按钮覆盖了主要状态。
