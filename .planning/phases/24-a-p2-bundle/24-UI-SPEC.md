---
phase: 24
slug: a-p2-bundle
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-03
language: zh-CN
scope: SlidePreviewPanel（幻灯片自渲染预览面板）— 本 phase 唯一新 UI surface
---

# Phase 24 — UI 设计契约

> 本契约由 gsd-ui-researcher 生成，供 gsd-ui-checker / gsd-planner / gsd-executor 消费。
> 仅覆盖 SlidePreviewPanel 这一个新 UI surface；html2canvas 截图、vision 自查工具、bundle 守门均为非 UI 逻辑，不在范围内。

---

## 设计系统

| 属性 | 值 | 来源 |
|------|----|------|
| 工具（Tool） | 无（none） | CLAUDE.md §UI / Components：不用 shadcn / Fluent / AntD / MUI，自写 CSS |
| 组件库 | 无 | 同上 |
| 样式真相源 | `src/styles.css`（CSS 变量驱动，`[data-theme="light\|dark"]`） | Aster 设计系统 skill |
| 图标库 | 内联 SVG（`src/components/icons.tsx`，Lucide 风，ISC 许可） | Aster 设计系统 skill |
| 字体 | Inter + Noto Sans SC（`--font-body`）；JetBrains Mono（`--font-mono`，仅 mono 场景） | `src/styles.css :root` |
| 品牌色 | teal `#009887`（light）/ `#4FC9B8`（dark），由 `--accent` 引用 | `src/styles.css [data-theme]` |
| 底色 | 纯白 `#FFFFFF`（light）/ `#0E0E10`（dark），由 `--bg` 引用 | 真机 UAT 2026-05-29 拍板 |

### 硬规则（来自 CLAUDE.md + Aster 设计系统 skill，不可违反）

- 零多色渐变（`background: linear-gradient(...)` 禁止）
- 零玻璃拟态（`backdrop-filter` 数量 = 0）
- 零 emoji 作图标
- 零外部图标 CDN（iconfont.cn / 任何字体图标 CDN）
- 所有颜色走 CSS 变量，禁止散落硬编码 hex/px

---

## 束加载约束（Bundle Constraint）— 硬性，非设计建议

> 来源：CONTEXT.md HARD constraint #1 + RESEARCH.md NFR-11

**SlidePreviewPanel 必须 `React.lazy(() => import('./components/SlidePreviewPanel'))`。**

- 当前 main chunk：80.6KB gzip；门限：82KB；余量：~1.4KB。
- 面板组件静态 import 会将其拖入 main chunk，直接爆预算。
- 挂载模式：在 ChatStream.tsx 内用 `<Suspense fallback={null}>` 包裹，仅当最新 agent 消息包含 layout 结果时渲染（与 DiffLogPanel / ImagePreviewCard 的离散事件范式一致）。
- `html2canvas` 不在面板内 import；html2canvas 动态 import 仅在 `visual_check_slide` 工具的 `execute()` 函数内部，与面板完全解耦。

**执行者必须在每次涉及 bundle 的改动后运行 `npm run build && npm run size` 验证，不得用陈旧 dist。**

---

## 间距（Spacing）

> 来源：`src/styles.css :root`（已有 scale，直接复用）

| 变量 | 值 | 在面板中的用途 |
|------|----|---------------|
| `--space-1` | 4px | 面板内图标与文字间距；标签行内边距 |
| `--space-2` | 8px | 面板 chrome header 内 padding；状态行 gap |
| `--space-3` | 12px | 面板 chrome 与预览容器之间的 padding |
| `--space-4` | 16px | 面板外侧左右边距（继承父层 chat 流 padding） |

**例外：**

- 预览容器本身（`.slide-preview-container`）不设内 padding——形状的绝对定位 div 直接贴容器边，内容出血由 ShapeSpec 的 `rect` 坐标决定，padding 会破坏坐标映射保真度。
- 触摸目标最小高度（面板 header 按钮）：28px（与既有 `.btn-icon` 一致）。

---

## 排版（Typography）

> 来源：`src/styles.css :root --fs-*`（已有阶梯，直接复用）

### 面板 Chrome（Panel Header / Status Bar）

| 角色 | 变量 | 值 | 字重 | 行高 | 用途 |
|------|------|----|------|------|------|
| 面板标题 | `--fs-12` | 12px | 500 | 1.4 | `.slide-preview-panel__title`「幻灯片预览」文字 |
| 状态文字 | `--fs-11` | 11px | 400 | 1.4 | 渲染中 / 截图中等状态提示 |

**面板 chrome 只用 2 个字号（fs-12 / fs-11）、2 个字重（400 / 500）**——克制，不超。

### 被渲染的幻灯片内容

| 角色 | 来源 | 约束 |
|------|------|------|
| 形状内文字字号 | `ShapeSpec.font.size * scale`（pt → px 等比缩放） | 下限：`Math.max(size * scale, 9)`（防止缩放后过小不可辨） |
| 形状内文字字重 | `ShapeSpec.font.bold ? 700 : 400` | 仅两档，对应 ShapeSpec 数据 |
| 形状内文字字色 | `ShapeSpec.font.color`（AI 传入 hex） | 缺省回退：`#222222`（不用 `--text`，与面板 chrome 物理隔离） |

**重要：幻灯片内容的字体渲染走浏览器已加载的 Inter / Noto Sans SC（CSS 字体栈），与 PowerPoint 宿主字体（等线/Calibri 等）有字宽差异。这是已知保真度偏差，由 UAT 对比图人眼评估，代码层不修复。**

---

## 颜色（Color）

### 面板 Chrome 颜色（走 CSS 变量）

| 角色 | 变量 | light 值 | dark 值 | 用途 |
|------|------|----------|---------|------|
| 60% 主色 | `--bg` | `#FFFFFF` | `#0E0E10` | 面板整体背景（`background: var(--bg)`） |
| 30% 次级面 | `--surface-2` | `#F3F2EE` | `#1F1F21` | header 底色；hover 态 |
| 边框 | `--border` | `#E7E5DF` | `#26262A` | 面板外边框；header / 容器分隔线 |
| 标题文字 | `--text-2` | `#5E5C58` | `#A1A1AA` | 「幻灯片预览」标题；状态文字 |
| 次级文字 | `--text-3` | `#92908A` | `#6E6E76` | 状态提示（「渲染中…」） |
| 10% Accent | `--accent` | `#009887` | `#4FC9B8` | 仅：加载进度指示（spinner stroke）；截图成功后短暂 teal 闪烁边框（可选，见下） |
| 焦点环 | `--ring-focus` | 见 styles.css | 见 styles.css | 所有可聚焦控件（含 header 按钮） |
| 错误色 | `--error` | `#DC2626` | `#F87171` | 截图/vision 调用失败时状态文字 |

**Accent 保留使用场景（面板 chrome 内）：**
1. 加载 spinner 的 stroke 色（仅当 html2canvas 截图进行中）
2. 不作其他用途——面板不显示「成功」teal 边框闪烁（过于花哨，违反克制原则）

### 幻灯片内容颜色（与面板 chrome 物理隔离）

| 属性 | 来源 | 缺省值 |
|------|------|--------|
| 形状填充色（`fillColor`） | `ShapeSpec.fillColor`（AI 传入 hex） | `'transparent'`（无填充） |
| 文字色（`font.color`） | `ShapeSpec.font.color`（AI 传入 hex） | `'#222222'`（中性深色，不用 `--text`） |
| 线条色（`lineColor`） | `ShapeSpec.lineColor`（AI 传入 hex） | `'transparent'`（无描边） |
| 预览容器背景 | 硬编码 `#FFFFFF`（白底幻灯片） | 固定白底，html2canvas `backgroundColor: '#ffffff'` 同步 |

**绝对禁止：** 不得用面板的 `--accent` / `--bg` / `--surface` 等变量给幻灯片内容着色。两套颜色体系完全独立。

---

## 布局与尺寸（Layout & Dimensions）

### 容器约束

| 项目 | 值 | 来源 |
|------|----|------|
| Task pane 可用宽 | 固定约 350px（Office iframe 宿主定，不可控） | CLAUDE.md |
| 面板外侧 padding | 继承父容器（chat 流 `--space-4 = 16px` 左右） | styles.css 既有 |
| 预览容器可用宽 | 约 318px（350 - 2×16 = 318px），以 `width: 100%` 撑满 | 计算值 |
| 预览容器高度 | `width × (540 / 960)`，即 `width × 0.5625` | LOCKED-4：960×540pt 16:9 |
| 典型尺寸 | ~318px × ~179px（以 318px 为基准） | 计算值 |
| 坐标缩放因子 | `scale = containerWidthPx / 960` | LOCKED-4 |
| 典型 scale | ~0.331（318 / 960） | 计算值 |

### 面板 DOM 层级

```
.slide-preview-panel                    ← 外层包裹（flex column，margin-top: --space-2）
  .slide-preview-panel__header          ← chrome header（flex row，height: 28px）
    .slide-preview-panel__title         ← 「幻灯片预览」（fs-12，fw-500，--text-2）
    .slide-preview-panel__status        ← 状态文字（fs-11，fw-400，--text-3）
  .slide-preview-container              ← 16:9 渲染容器（position: relative；overflow: hidden）
    div[each shape]                     ← 绝对定位 div（ShapeSpec → inline style）
```

### 形状渲染规则

| ShapeType | CSS 处理 |
|-----------|---------|
| `TextBox` | `overflow: hidden; white-space: pre-wrap`（保留 `\n` 换行） |
| `Rectangle` | 无 border-radius |
| `RoundedRectangle` | `border-radius: Math.round(4 * scale)px`（最小 2px） |
| `Ellipse` | `border-radius: 50%` |
| 连接线（timeline connector） | 极细 div（height: `Math.max(lineWeight * scale, 1)px`） |

所有形状通用：`position: absolute; box-sizing: border-box; padding: {2 * scale}px; overflow: hidden`

### 响应式（350px 窄面板）

- 预览容器：`width: 100%; min-width: 0`——撑满可用宽，不设固定 px 宽（防止横向溢出）
- 面板 header：`flex-wrap: nowrap; overflow: hidden`——标题文字 `text-overflow: ellipsis`
- 整个面板：`flex-shrink: 0`（与 `.tool-group` 同，防止被 flex column 压扁——已踩坑教训）

---

## 交互状态（Interaction States）

### 面板整体状态机

| 状态 | 触发条件 | 视觉表现 |
|------|---------|---------|
| **隐藏（Hidden）** | 无 ShapeSpec 数据 / 用户本 session 无 layout 结果 | 不渲染（React.lazy + Suspense 不 mount） |
| **渲染就绪（Ready）** | apply_slide_layout 完成，ShapeSpec[] 到位 | 面板出现，预览容器显示形状 |
| **截图进行中（Capturing）** | visual_check_slide 工具被 AI 调用，html2canvas 运行中 | status 文字「截图自查中…」+ teal spinner（可选，仅 `--accent` stroke） |
| **截图完成（Done）** | analyzeImages 返回，evidence 文字产出 | status 文字消失，面板保持 Ready 态 |
| **截图失败（Error）** | html2canvas 或 analyzeImages 报错 | status 文字「自查失败」（`--error` 色，fs-11） |
| **预览面板未打开（Fallback）** | visual_check_slide execute() 取不到 previewElRef | 工具返回 advisory ToolResult（不崩溃），面板本身无变化 |

**面板不提供用户主动「刷新/重渲」按钮**——渲染是离散事件（每次 apply_slide_layout 后），由 agent loop 驱动。

### 唯一可选的用户操作

本 phase 是 spike 雏形，面板保持克制：

- **无手动截图按钮**（截图由 AI 工具 `visual_check_slide` 触发，on-demand 默认）
- 面板右上角预留 1 个 `.btn-icon` 图标按钮位，用于「关闭面板」（XIcon，28×28px）——**可选实现**；若 UAT 反馈面板干扰可改 offscreen，届时关闭按钮成为必须

**如果实现关闭按钮：**

```
图标：XIcon（src/components/icons.tsx，strokeWidth 1.5，currentColor）
尺寸：28×28px（.btn-icon 既有类）
颜色：color: var(--text-3)；hover: var(--text)，background: var(--surface-2)
焦点：box-shadow: var(--ring-focus)
aria-label="关闭预览"
```

---

## 文案契约（Copywriting）

> 所有文案走 `@lingui/macro`（`<Trans>` 宏），改动后必须 `npm run extract`，否则 `coverage.test.ts` 报红。

| 元素 | 文案 | 变量名建议（Lingui message ID） |
|------|------|-------------------------------|
| 面板标题 | 幻灯片预览 | `slide_preview_panel_title` |
| 截图自查进行中 | 截图自查中… | `slide_preview_status_capturing` |
| 截图自查失败 | 自查失败 | `slide_preview_status_error` |
| 空状态（无 shapes） | （不渲染面板，无文案需要） | — |
| 关闭按钮 aria-label | 关闭预览 | `slide_preview_close_label` |
| 预览面板未打开 fallback（ToolResult advisory 文字） | 预览面板未打开，视觉自查跳过（仅依据几何自查结果） | 此文案在 tool 层（非 UI 层），不走 Lingui |

**文案风格：** 极简、中文、无感叹号、无 emoji。状态文字用省略号（…）而非「loading」或英文。

---

## 无障碍（Accessibility）

| 项目 | 规格 |
|------|------|
| 预览容器 role | `role="img"` + `aria-label="幻灯片预览"`（容器内的绝对定位 div 对屏幕阅读器是装饰性布局，不需逐个 aria） |
| 面板标题 | `<h3>` 或 `<span role="heading" aria-level="3">` |
| 关闭按钮（若实现） | `<button aria-label="关闭预览">` + `type="button"` |
| 焦点管理 | 面板出现时不强制抢焦点（避免打断用户输入） |
| 减少动效 | `@media (prefers-reduced-motion: reduce)` 已在 `src/styles.css` 全局处理，面板无需额外处理 |
| 截图元素 | html2canvas 截图的 `.slide-preview-container` 容器不需要额外 aria——截图是工具层行为，对用户不可见 |

---

## 新 CSS 类名约定

> 以下是本 phase 新增的 CSS 类名，写进 `src/styles.css`。不与既有类名冲突，沿用 BEM-like 命名。

```css
/* Phase 24 SlidePreviewPanel — 幻灯片自渲染预览面板 */

.slide-preview-panel {
  /* 外层包裹：flex column，嵌在 chat 流中作离散事件卡 */
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-2);
  background: var(--bg);
  overflow: hidden;
  flex-shrink: 0;           /* 防止被 flex column 压扁，与 .tool-group 同 */
  min-width: 0;             /* 350px 窄面板兜底 */
}

.slide-preview-panel__header {
  /* chrome header：标题 + 状态 + 可选关闭按钮 */
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  height: 28px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  flex-shrink: 0;
}

.slide-preview-panel__title {
  font-size: var(--fs-12);
  font-weight: 500;
  color: var(--text-2);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.slide-preview-panel__status {
  font-size: var(--fs-11);
  color: var(--text-3);
  white-space: nowrap;
  flex-shrink: 0;
}

.slide-preview-panel__status--error {
  color: var(--error);
}

.slide-preview-container {
  /* 16:9 渲染容器：position relative，子 div 绝对定位 */
  position: relative;
  width: 100%;
  /* height 由 JS 计算：containerWidth × (540 / 960)，写 inline style */
  background: #ffffff;       /* 固定白底：幻灯片底色，与主题 token 无关 */
  overflow: hidden;
}
```

**注：** `.slide-preview-container` 的 `height` 通过 React 的 `style` prop 动态写入（`width * 540 / 960`），不在 CSS 中固定，因为容器宽度是运行时决定的。

---

## 注册安全（Registry Safety）

| Registry | 使用的 blocks | 安全状态 |
|----------|--------------|---------|
| shadcn 官方 | 无（本 phase 不使用 shadcn） | 不适用 |
| 第三方 registry | 无 | 不适用 |

本 phase 唯一新依赖 `html2canvas@1.4.1` 已在 RESEARCH.md Q1 完成 tarball 安全审查：
- `eval()` 调用数 = 0（实测 grep 确认）
- 含一个 TypeScript 编译产物的 `Function(A)` 调用（`__extends` 继承辅助，非动态代码执行）
- Office for Web task pane CSP 允许（MicrosoftAjax.js 依赖 eval，实际 CSP 宽松）
- 锁版本 `html2canvas@1.4.1`（2022-01 最后稳定版，极稳定）

---

## 预填来源溯源

| 字段 | 来源 | 决策类型 |
|------|------|---------|
| 坐标基准 960×540pt | CONTEXT.md LOCKED-4 | LOCKED |
| 默认 visible 面板 | CONTEXT.md LOCKED-3c | LOCKED |
| React.lazy 懒加载 | CONTEXT.md HARD constraint #1 + NFR-11 | 硬约束 |
| 颜色物理隔离（chrome vs 幻灯片内容） | CONTEXT.md 配色不锁死段 | LOCKED |
| on-demand 截图触发 | CONTEXT.md LOCKED-3b | LOCKED |
| 面板 chrome CSS 变量 | `src/styles.css` + Aster 设计系统 skill | 设计系统直接复用 |
| 按钮类名（`.btn-icon`）| `src/styles.css L1133` | 既有，直接复用 |
| flex-shrink: 0 | `src/styles.css .tool-group`（已踩坑） | 既有范式 |
| font-size 阶梯 | `src/styles.css :root --fs-*` | 既有，直接复用 |
| 文案语言（中文，无 emoji，极简） | CLAUDE.md §Language | 项目规范 |
| Lingui 文案宏 | CONTEXT.md HARD constraint #5 | 硬约束 |
| 字体下限 9px | RESEARCH.md Pattern 2（`Math.max(size * scale, 9)`） | Claude 自定 |
| 形状内文字缺省色 `#222222` | Claude 自定（不用 `--text`，物理隔离） | Claude 自定 |
| 预览容器白底 `#ffffff` | Claude 自定（幻灯片底色规范） | Claude 自定 |
| html2canvas 安全审查 | RESEARCH.md Q1（tarball 实测） | RESEARCH 已验证 |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
