---
phase: 01-foundation
reviewed: 2026-05-27T00:00:00Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .github/workflows/ci.yml
  - .github/workflows/pages.yml
  - .size-limit.json
  - README.md
  - commands.html
  - index.html
  - lingui.config.ts
  - manifest.xml
  - package.json
  - src/App.tsx
  - src/adapters/DocumentAdapter.test.ts
  - src/adapters/DocumentAdapter.ts
  - src/adapters/ExcelAdapter.ts
  - src/adapters/PptAdapter.ts
  - src/adapters/WordAdapter.ts
  - src/adapters/adapters.test.ts
  - src/adapters/index.ts
  - src/commands.ts
  - src/components/ChatStream.tsx
  - src/components/ContextCard.tsx
  - src/components/InputBar.tsx
  - src/context/AdapterContext.ts
  - src/errors/index.test.ts
  - src/errors/index.ts
  - src/i18n/index.ts
  - src/main.tsx
  - tsconfig.json
  - vite.config.ts
  - vitest.config.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 1：代码审查报告

**审查时间：** 2026-05-27
**审查深度：** standard
**审查文件数：** 28
**状态：** issues_found（发现问题）

## 摘要

本次审查覆盖 Phase 1 基础底座：三宿主 adapter 契约与骨架、错误类层级、Task Pane 视觉壳、manifest、CI size 守卫。整体结构清晰、契约设计合理、安全意识（不读正文、错误不嵌 Key）到位。

但发现 **1 个 BLOCKER**：PPT slide 序号存在重复 +1 的 off-by-one 缺陷——`PptAdapter` 已产出 1-based 序号，`ContextCard` 又加了 1，导致上下文卡显示的 slide 序号始终偏大 1。该缺陷直接命中 ROADMAP SC3（"上下文卡证明 adapter 真实可用"）的验收点，且现有测试因 mock 数据不真实而未能捕获。此外多处 WARNING 涉及事件解绑竞态、错误吞噬、契约文档与实现不一致等健壮性问题。

## Critical Issues（必须修复）

### CR-01：PPT slide 序号重复 +1（off-by-one），上下文卡显示错误

**File:** `src/components/ContextCard.tsx:27`（配合 `src/adapters/PptAdapter.ts:51-55` 与 `src/adapters/DocumentAdapter.ts:19`）

**Issue:**
`PptAdapter.getSelection()` 已经把 slideIndex 转成 1-based 并写明注释：

```ts
// PptAdapter.ts:51-55
// slideIndex 为 1-based（「第 N 张」对应 index 为 0-based）
return {
  kind: 'ppt',
  slideIndex: firstSelected.index + 1,   // 已经 +1，产出 1-based
  slideCount: totalCount,
};
```

但 `ContextCard.formatSelection()` 又对它加了 1：

```ts
// ContextCard.tsx:27
case 'ppt':
  return t`第 ${sel.slideIndex + 1} 张 slide`;   // 第二次 +1
```

结果：选中第 1 张 slide 时，上下文卡显示「第 2 张 slide」——永久偏大 1。这正是 Phase 1 唯一的"adapter 真实可用"端到端证据（ROADMAP SC3），显示错误等于核心验收点失效。

更深层的问题是**契约文档与实现矛盾**：`DocumentAdapter.ts:19` 的类型注释写 `slideIndex` 是 "当前 slide 的 0-based index"，但 adapter 实际产出 1-based，消费方 `ContextCard` 又当 0-based 处理。三处对同一字段的语义理解不一致，是这个 bug 的根因。

现有测试无法捕获：`DocumentAdapter.test.ts:21` 用 `{ kind: 'ppt', slideIndex: 1, slideCount: 5 }` 这种凭空构造的数据，没有走 adapter 真实转换，也没断言 `ContextCard` 的显示输出。

**Fix:**
统一约定 `slideIndex` 为 1-based（与 adapter 现状一致），修正消费方并对齐类型文档：

```ts
// ContextCard.tsx — slideIndex 已是 1-based，直接用，不要再 +1
case 'ppt':
  return t`第 ${sel.slideIndex} 张 slide`;
```

```ts
// DocumentAdapter.ts:19 — 修正注释，消除契约歧义
/** 当前 slide 的 1-based 序号（直接对应「第 N 张」） */
slideIndex: number;
```

并补一个真正驱动转换的测试（mock `getSelectedSlides().items` 返回 `index: 0`，断言 `getSelection()` 得到 `slideIndex === 1`，再断言 `formatSelection` 输出「第 1 张 slide」），否则同类回归无人看守。

## Warnings（应修复）

### WR-01：ExcelAdapter.onSelectionChanged 存在注册/解绑竞态，可能漏解绑导致事件泄漏

**File:** `src/adapters/ExcelAdapter.ts:53-79`

**Issue:**
注册通过异步 `Excel.run` 完成，`handlerResult` 在 `await ctx.sync()` 之后才被赋值。`onSelectionChanged` 同步返回 unsub 函数。如果组件在注册的 `Excel.run` 完成前就卸载（快速切换/Task Pane 立即隐藏），unsub 运行时 `handlerResult` 仍为 `null`，于是直接跳过解绑——但随后异步注册可能成功，handler 永久驻留，违背 T-01-07/T-01-13 的"卸载即解绑"目标。这是典型的注册-解绑竞态。

**Fix:**
用一个"已请求解绑"标志，在注册回调里检查；若已请求卸载则立即 remove：

```ts
onSelectionChanged(callback: () => void): () => void {
  let handlerResult: OfficeExtension.EventHandlerResult<Excel.SelectionChangedEventArgs> | null = null;
  let unsubscribed = false;

  Excel.run(async (ctx) => {
    const worksheet = ctx.workbook.worksheets.getActiveWorksheet();
    handlerResult = worksheet.onSelectionChanged.add(async () => { callback(); });
    await ctx.sync();
    if (unsubscribed) {
      // 注册期间已请求解绑，立即移除
      await Excel.run(async (c) => { handlerResult!.remove(); await c.sync(); });
    }
  }).catch(() => {});

  return () => {
    unsubscribed = true;
    if (handlerResult !== null) {
      const result = handlerResult;
      Excel.run(async (ctx) => { result.remove(); await ctx.sync(); }).catch(() => {});
    }
  };
}
```

### WR-02：Excel/PPT 事件注册失败被完全静默吞噬，无任何可观测信号

**File:** `src/adapters/ExcelAdapter.ts:64-66`（同类问题见 `:73-76`）

**Issue:**
`.catch(() => { /* 静默 */ })` 把注册失败彻底吞掉。若宿主未就绪或 API 抛错，selection 监听静默失效，上下文卡永远不刷新，开发期与真机调试都没有任何线索。Phase 1 的核心交付正是"证明 adapter 真实可用"，监听静默失效会让这个验收点在无声中失败。

**Fix:**
至少保留一条可观测信号（不暴露给最终用户、不含敏感数据）：

```ts
}).catch((err) => {
  // 注册失败：不抛出（宿主可能未就绪），但保留调试信号
  console.warn('[Aster] Excel onSelectionChanged 注册失败', err);
});
```

PPT/Word 的解绑 catch 同理建议加 `console.warn`，便于真机定位。

### WR-03：WordAdapter.getSelection 把整段选中文本 load 进内存，与"仅读元数据"安全约束相悖

**File:** `src/adapters/WordAdapter.ts:26-30`

**Issue:**
注释（文件头 + 行 30）声称"不留存文本内容本身，仅读字符数"，但实现是 `selection.load('text')` → 把**完整选中正文**拉进内存，再取 `.text.length`。虽然没有持久化，但敏感正文确实进入了 JS 堆，与 T-01-06"仅读元数据"的承诺不符，也与 PPT/Excel 适配器只读 `index`/`address` 的做法不一致。一旦后续有人在此函数加日志或错误上报，整段正文就可能外泄。

**Fix:**
优先使用不返回正文的计数 API。Word API 可直接 load range 的字符数相关属性，或退一步在拿到 length 后立即不引用 text。最小改动是显式不持有 text 引用并加注释说明这是已知折中；更稳妥的是改用不拉全文的属性：

```ts
const selection = ctx.document.getSelection();
selection.load('text');           // 注意：这会把正文读入内存
await ctx.sync();
const charCount = selection.text.length;  // 仅用长度，立即丢弃引用
// selection.text 不得进入日志/错误上报（见 errors/HostApiError）
```

若 Word API 在目标版本支持仅读 length 的属性，应优先采用以彻底避免正文入内存。请在 Phase 2 前确认并在注释中如实标注当前为"读全文取长度"的折中。

### WR-04：HostApiError 把原始 Office 错误对象整体挂在 hostError 上，可能间接携带敏感内容

**File:** `src/errors/index.ts:100-108`（被 `ExcelAdapter.ts:44`、`WordAdapter.ts:42`、`PptAdapter.ts:60` 引用）

**Issue:**
`HostApiError.hostError` 存的是 `unknown` 原始错误。Word 适配器在 `Word.run` 中 load 了正文，若 sync 阶段抛错，Office 错误对象的 `debugInfo`/message 有可能回带与选区相关的内容。注释说"不对用户暴露"，但对象仍存活在错误链里，任何上层 `JSON.stringify(err)` 或错误上报都会序列化它，与 T-01-04"message 禁止嵌入凭证/敏感原文"的精神冲突。

**Fix:**
封装时只摘取安全字段（name/code/message 的白名单），不要整体持有原始对象；或在文档中明确 `hostError` 仅限 dev 构建保留、生产构建剥离：

```ts
constructor(message: string, hostError?: unknown) {
  super(message, 'HOST_API', 'adapter');
  // 仅保留安全的诊断字段，避免序列化时回带正文/凭证
  this.hostError = hostError instanceof Error
    ? { name: hostError.name, message: hostError.message }
    : undefined;
}
```

### WR-05：WordAdapter 用 Office.context.document 全局单例注册事件，无法支持多 adapter 实例且解绑依赖对象引用相等

**File:** `src/adapters/WordAdapter.ts:56-68`（同类 `PptAdapter.ts:70-82`）

**Issue:**
两点风险：
1. `removeHandlerAsync(EventType, { handler })` 依赖传入的 `handler` 与注册时是同一函数引用。当前在闭包内 `const handler = () => callback()` 保证了引用一致，没问题——但这层耦合很脆弱：任何重构（比如把 `() => callback()` 直接传入）都会让解绑静默失败。
2. 注册在全局 `Office.context.document` 上，若同一宿主存在两个 adapter 实例（理论上不会，但工厂未做单例保证），多次 add/remove 会相互干扰。

`addHandlerAsync`/`removeHandlerAsync` 的回调被完全忽略，注册/解绑失败同样无声（与 WR-02 同源）。

**Fix:**
保留 handler 引用稳定（已做），并补 callback 检查失败：

```ts
Office.context.document.addHandlerAsync(
  Office.EventType.DocumentSelectionChanged,
  handler,
  (res) => {
    if (res.status === Office.AsyncResultStatus.Failed) {
      console.warn('[Aster] Word selection handler 注册失败', res.error.message);
    }
  },
);
```

并在 `createAdapter` 处或文档中明确"每宿主单实例"的前提，避免多实例下的全局 handler 串扰。

### WR-06：resolveHostTheme 的亮度阈值用了魔法数 128，且 4/3 位 hex 缩写未处理会静默降级

**File:** `src/main.tsx:31-44`

**Issue:**
两点：
1. 阈值 `128` 是裸魔法数（应抽常量并注明这是 0-255 中点）。
2. `if (hex.length === 6)` 只处理 6 位 hex。若 Office 返回 `#fff`（3 位）或带 alpha 的 8 位，则跳过判断、静默降级为 light，可能在深色宿主下错误显示亮色主题。Office 一般返回 6 位，但代码对此无防御，也无日志。

**Fix:**

```ts
const LUMINANCE_MIDPOINT = 128; // sRGB 0-255 中点

// 归一化 3 位缩写为 6 位
let hex = bg.replace('#', '');
if (hex.length === 3) {
  hex = hex.split('').map((c) => c + c).join('');
}
if (hex.length >= 6) {
  const r = parseInt(hex.slice(0, 2), 16);
  // ...
  return luminance < LUMINANCE_MIDPOINT ? webDarkTheme : webLightTheme;
}
```

另建议监听后续主题变化（Office.context.officeTheme 变更事件），Phase 1 仅初始读一次可接受，但应在注释中标注此局限。

## Info（建议优化）

### IN-01：ContextCard 的 t 类型签名是手写的，与 useLingui 真实类型重复且易漂移

**File:** `src/components/ContextCard.tsx:23`

**Issue:**
`formatSelection(sel, t: (s: TemplateStringsArray, ...args: unknown[]) => string)` 手写了 `t` 的类型。Lingui 已导出 `t` 的类型，手写签名一旦 Lingui 升级签名变化就会编译不报错但语义漂移。

**Fix:** 从 `@lingui/react/macro` 推导 `t` 的类型（`Parameters`/`ReturnType` 或直接复用导出的类型），避免手写。

### IN-02：default 分支的 exhaustive never 检查永远走不到，属冗余但无害

**File:** `src/components/ContextCard.tsx:37-42`

**Issue:**
switch 已覆盖全部 4 个 `kind`，`default` 里的 `never` 检查是编译期保险，运行时不可达。这是有意为之的防御性写法，可保留；仅记录说明它是 dead-at-runtime 代码，避免后续误删该保险。

**Fix:** 无需改动。如需更纯净，可在注释明确"运行时不可达，仅作新增 kind 的编译期守卫"。

### IN-03：commands.ts 注册的 'openTaskpane' handler 在 Phase 1 是 dead code

**File:** `src/commands.ts:20-24`

**Issue:**
注释明确说明 Phase 1 全走 ShowTaskpane，此 `associate('openTaskpane', ...)` 不被任何按钮触发，是 Phase 4-6 的预留。属于有意保留的扩展点，文档充分。

**Fix:** 无需改动，文档已到位。建议在 Phase 4-6 真正接入前不要再扩散更多预留死代码。

### IN-04：i18n messages 依赖 lingui compile 产物，仓库内若缺 locales 编译产物会导致 import 失败

**File:** `src/i18n/index.ts:2`

**Issue:**
`import { messages } from './locales/zh-CN/messages'` 依赖 `npm run compile` 生成的产物。若该文件未提交且 CI/构建未先跑 `lingui compile`，build 会因模块缺失而失败。`ci.yml` 与 `pages.yml` 的 build 步骤只跑 `npm run build`，未见 `compile` 前置步骤。

**Fix:** 确认 `src/i18n/locales/zh-CN/messages.*` 已提交，或在 `build` 脚本前加 `lingui compile`（如 `"build": "lingui compile && vite build"`），保证 CI 干净检出后可构建。

---

_Reviewed: 2026-05-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
