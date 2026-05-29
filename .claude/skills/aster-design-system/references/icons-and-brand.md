# 图标 与 品牌（Icons & Brand）

全部图标 = **内联 SVG（Lucide 风手写 path）**，写在 `src/components/icons.tsx`。品牌星标 = PNG，Office 三件套 = 官方 SVG（仅原型/onboarding 参考用，生产注意版权）。

> 实现：`src/components/icons.tsx`（~240 行，逐个 export 的 React 组件）。设计稿 registry：`.planning/design/aster-redesign/src/icons.jsx`（Lucide 对象 + AsterMark）。

## Design Decisions

- **内联 SVG，不用 emoji、不用栅格图、不接外部图标 CDN（iconfont.cn 等）**——纯静态 + 隐私 + 开源合规硬规则。
- **Lucide 风格**：`stroke="currentColor"`（颜色由 CSS `color` 控）、`fill="none"`、圆角线帽（`strokeLinecap/Linejoin="round"`）、统一 `24×24` viewBox。
- **strokeWidth**：线上 `base` 用 **1.5**（注意：文件顶注释一处写 1.75，实际 `base` 常量 = 1.5，以常量为准）。
- **ISC 许可、免署名**（Lucide）——可放心用。
- **尺寸由 CSS / props 控**：SVG 本身不写死 px，外层用 `width/height` 或 font-size 配 currentColor。
- **品牌星标 AsterMark = PNG**（`aster-logo.png`，渐变星标，440×440 透明）——唯一例外不走 stroke 体系，单独走品牌 PNG。空状态脉冲 logo、modal-brand、Ribbon 都用它。
- **Office host 图标**：设计稿 onboarding Step 2 用微软官方 `office-{ppt,excel,word}.svg`（用户提供）。**线上生产用 Lucide 风 `.host-icon`（teal currentColor）规避版权**；官方 SVG 仅原型参考。

## 线上图标库（`src/components/icons.tsx` 实际 export）

每个都是零 props（或 size 可覆盖）的 `ReactElement`，靠 currentColor 控色：

```
SettingsIcon  UploadIcon  SendIcon  ChevronIcon  StopIcon  InsertIcon
RetryIcon  XIcon  AlertIcon  PlusIcon  TrashIcon  CheckIcon  EyeIcon
EyeOffIcon  PauseIcon  PlayIcon  GearIcon  PaperclipIcon  ChevronDownIcon
ChevronLeftIcon  AlertCircleIcon  DocumentIcon
```

用途映射（与组件对应）：
- `SettingsIcon`/`GearIcon` → InputBar 工具行进设置
- `SendIcon`/`StopIcon` → 发送按钮三态
- `PaperclipIcon` → 附件（诚实禁用）
- `EyeIcon`/`EyeOffIcon` → 选区胶囊 attach toggle + API Key 显隐
- `ChevronDownIcon`/`ChevronLeftIcon`/`ChevronIcon` → 折叠卡展开 / 设置返回 / select-caret
- `PauseIcon`/`PlayIcon` → AgentControlBar
- `AlertIcon`/`AlertCircleIcon` → 错误气泡 head / ConfigBanner
- `CheckIcon` → 写回「已写入」
- `RetryIcon`/`InsertIcon`/`TrashIcon`/`PlusIcon`/`XIcon`/`DocumentIcon`/`UploadIcon` → 对应动作

## 实现范式（`base` 常量 + 组件）

```tsx
const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export function SettingsIcon(): ReactElement {
  return (
    <svg {...base}>
      <line x1="4" y1="8" x2="20" y2="8" />
      <circle cx="9" cy="8" r="2.4" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.4" />
    </svg>
  );
}
```

**加新图标**：去 [lucide.dev](https://lucide.dev) 找造型 → 复制 path → 写成新 export 函数套 `{...base}` → 别引整包、别用 `<i class>` 字体图标。

## What to Avoid

- ❌ emoji 当图标 / 栅格 png 图标 / iconfont.cn Symbol JS 或字体 CDN（违反纯静态 + 隐私 + 合规）。
- ❌ `npm i lucide-react` 引整包——手写 path 内联，省 bundle。
- ❌ SVG 里写死 `stroke="#009887"`——用 `currentColor`，让 CSS `color` 控（teal 走 `--accent`）。
- ❌ 生产用微软官方 Office logo——用 Lucide 风 host-icon 规避版权；官方 SVG 仅原型。
- ❌ strokeWidth 各处不一——统一走 `base`（1.5）。

## Origin

- 线上：`src/components/icons.tsx`（22 个 export + `base` 常量）；用法散见各组件。
- 设计稿：`.planning/design/aster-redesign/src/icons.jsx`（Lucide registry + AsterMark）+ `sources/design-package/README.md` §Assets。
- 品牌资产：`.planning/design/aster-redesign/src/assets/aster-logo.png`（AsterMark）+ `src/icons/office-*.svg`（原型用）。
