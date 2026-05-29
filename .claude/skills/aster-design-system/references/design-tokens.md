# Design Tokens & 主题

## Design Decisions

**单一品牌色 teal + 双主题随宿主 + 全变量驱动**。这是整套系统的地基，所有组件颜色/间距/圆角都引用这里的变量，**禁止散落硬编码 hex/px**。

- **品牌色 teal `#009887`**（light）/ `#4FC9B8`（dark）——唯一 accent。来源是 `aster.css` 的 `.v-quiet.acc-teal` 块（不是 `.v-quiet` 基础块，那块 accent 是橙色 `#E64A19`，**不用**）。
- **主题机制**：`main.tsx` 在 `Office.onReady` 里读 `Office.context.officeTheme`，在 `#root` 设 `data-theme="light|dark"`。CSS token 选择器用 `[data-theme="light"]` / `[data-theme="dark"]`，**不用** `.v-quiet` 父类前缀（codebase 的 `#root` 上没有这个类）。两套主题必须同时设计、同时顾到。
- **scale token 主题无关**，放 `:root`（字体、圆角、字号、间距、动效曲线）；**语义 token 分主题**，放两个 `[data-theme]` 块（颜色、阴影、focus ring）。

## 🔴 设计稿 ↔ 线上 偏差清单（最重要，务必先读）

`sources/design-package/README.md` 与 `aster.css` 是设计稿；`src/styles.css` 是线上真相。两者有意偏差，**一律以线上 `src/styles.css` 为准**：

| Token / 项 | 设计稿（README/aster.css） | 线上（src/styles.css） | 原因 |
|---|---|---|---|
| `--bg` / `--bg-pane` / `--surface`（light） | 暖白 `#FAFAF8`（bg）+ `#FFFFFF`（surface） | **全部纯白 `#FFFFFF`** | 真机 UAT 用户偏好纯白，2026-05-29 拍板 |
| `--text-3`（light） | `#94918A` | `#92908A` | 落地微调 |
| `--border-strong`（light） | `#D0CDC4` | `#CDCAC2` | 落地微调 |
| `--error`（dark） | 同 light `#DC2626` | `#F87171`（dark 提亮）+ `--error-soft` `rgba(248,113,113,0.14)` | dark 下红色需提亮才够对比 |
| `--text`（dark） | README 未列全 | `#F4F4F5` | 落地补全 |
| `--text-disabled` | 设计稿无此变量 | light `#BFBDB6` / dark `#4A4A4F` | 落地新增（诚实禁用态用） |
| `--radius-4: 16px` | README 只列 1/2/3/full | 线上加了 `--radius-4: 16px`（modal 用） | 落地新增 |
| 字号阶 | README 列到 `--fs-15` | 线上只有 11/12/13/14/16/18（**无 fs-15**） | 落地精简 |
| 间距 | README「无严格 scale」4·6·8·10·12·14·18·24·32 | 线上规整为 `--space-1..6` = 4/8/12/16/20/24 | 落地规整为 scale |

> 还有命名债：设计稿叫 `.aster-shell` 的，线上叫 `.pane`；类名以线上为准（见各组件 reference）。

## CSS Patterns（线上 `src/styles.css` 实测，可直接复用）

### scale token（`:root`，主题无关）
```css
:root {
  --font-body: "Inter", "Noto Sans SC", -apple-system, BlinkMacSystemFont,
    "PingFang SC", "Microsoft YaHei", sans-serif;
  --font-mono: "JetBrains Mono", "SF Mono", ui-monospace, "Cascadia Code", monospace;

  --radius-1: 4px;  --radius-2: 8px;  --radius-3: 12px;  --radius-4: 16px;  --radius-full: 999px;

  --fs-11: 11px; --fs-12: 12px; --fs-13: 13px; --fs-14: 14px; --fs-16: 16px; --fs-18: 18px;

  --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px; --space-5: 20px; --space-6: 24px;

  --dur-fast: 120ms; --dur-base: 200ms; --dur-slow: 320ms;
  --ease-out:    cubic-bezier(0.22, 1, 0.36, 1);     /* 默认 */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* 齿轮 hover 旋转等 */
}
```

### 语义 token — Light（线上真相，纯白底）
```css
[data-theme="light"] {
  --bg: #ffffff;  --bg-pane: #ffffff;  --surface: #ffffff;
  --surface-2: #f3f2ee;  --surface-3: #e9e7e0;
  --border: #e7e5df;  --border-strong: #cdcac2;

  --text: #131316;  --text-2: #5e5c58;  --text-3: #92908a;  --text-disabled: #bfbdb6;

  --accent: #009887;  --accent-hover: #007a6e;  --accent-soft: #d2ede8;  --accent-on: #ffffff;

  --bubble-ai-bg: #eeeef0;
  --error: #dc2626;   --error-soft: #fee2e2;
  --success: #15803d; --success-soft: #dcfce7;
  --warning: #b45309; --warning-soft: #fef3c7;
  --info: #0369a1;    --info-soft: #e0f2fe;

  --shadow-card: 0 1px 2px rgba(15,15,17,0.04), 0 1px 1px rgba(15,15,17,0.02);
  --shadow-pop:  0 18px 40px -16px rgba(15,15,17,0.18), 0 2px 6px rgba(15,15,17,0.06);
  --shadow-input: inset 0 0 0 1px var(--border);
  --ring-focus:  0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
```

### 语义 token — Dark（线上真相）
```css
[data-theme="dark"] {
  --bg: #0e0e10;  --bg-pane: #0e0e10;  --surface: #181819;
  --surface-2: #1f1f21;  --surface-3: #28282b;
  --border: #26262a;  --border-strong: #3a3a3f;

  --text: #f4f4f5;  --text-2: #a1a1aa;  --text-3: #6e6e76;  --text-disabled: #4a4a4f;

  --accent: #4fc9b8;  --accent-hover: #6bdbc9;  --accent-soft: rgba(79,201,184,0.18);  --accent-on: #0e0e10;

  --bubble-ai-bg: #1f1f23;
  --error: #f87171;  --error-soft: rgba(248,113,113,0.14);
  --shadow-card: 0 1px 2px rgba(0,0,0,0.4);
  --shadow-pop:  0 24px 48px -16px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.3);
  --shadow-input: inset 0 0 0 1px var(--border);
  --ring-focus:  0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}
```
> dark 块只覆盖与 light 不同的语义色；`--success/--warning/--info` 等若 dark 未重定义会继承——上生产前 dark 需逐屏 QA（README「Known Gaps」已标）。

### 通用基础约定
```css
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; overflow: hidden; }
body { font-family: var(--font-body); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }

/* 全局降级动效 */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; animation: none !important; }
}
```

### Focus ring（统一）
所有可聚焦控件用 `box-shadow: var(--ring-focus)`（= `0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`，双环：先底色再 teal），配 `outline: none`。

## What to Avoid

- ❌ **硬编码颜色/间距**——先查有没有现成变量；teal 永远用 `--accent`，不要直接写 `#009887`。
- ❌ **用 `.v-quiet` 基础块的橙色 accent**——teal 在 `.acc-teal` 块；codebase `#root` 也不带 `.v-quiet` 类。
- ❌ **多色渐变 / backdrop-filter / 玻璃拟态**——整套系统 backdrop-filter 数量 = 0，这是硬规则。
- ❌ **照搬设计稿 `#FAFAF8` 暖白底**——线上是纯白 `#FFFFFF`，已被 UAT 推翻。
- ❌ 引用不存在的 `--fs-15`、设计稿那种「无 scale」的随意间距——线上已规整为 `--space-1..6`。

## Origin

- 线上真相：`src/styles.css` `:root` + `[data-theme="light"]` + `[data-theme="dark"]` 三块。
- 设计稿：`sources/design-package/README.md` §Design Tokens + `aster.css` `.v-quiet` / `.v-quiet.acc-teal` 块。
- 关键决策：[2026-05-29] 纯白底覆盖暖白（真机 UAT 用户偏好）；teal 取自 `.acc-teal` 块。
