# Phase 30: WPS-02/03 真机验证探针 — Pattern Map

**映射日期：** 2026-06-08
**分析文件数：** 6 个探针新建文件（wps-probe/index.html, wps-probe/probe.js, wps-probe/ribbon.xml, wps-probe/jsplugins.xml, wps-probe/README.md）
**找到 analog 数：** 5 / 5（全部有对应语义来源）

> **注意（关键约束）：** 本 phase 产物是一个**独立 throwaway 探针工程**，不进 Aster `src/`，不 import 任何 Aster 模块。以下 analog 文件的关系是「**照语义实现，复制形状而非复制 import**」。planner 需将 Aster 代码中的 Office.js API 调用（`Excel.run` / `PowerPoint.run` / `Office.onReady` / `Office.context.*`）全部替换为 WPS JSAPI 的对等实现（`window.Application.*` / `OnAddinLoad` / `window.Application.ComponentType`）。

---

## 文件分类

| 探针新建文件 | 角色 | 数据流 | 最近 Aster Analog | 匹配质量 |
|---|---|---|---|---|
| `wps-probe/probe.js` (parseSSE 部分) | utility — SSE 解析 | streaming | `src/lib/sse.ts` `streamSSE` | 语义匹配（照抄最小版本；无 import） |
| `wps-probe/probe.js` (localStorage 部分) | utility — 存储探测 | request-response | `src/lib/storage.ts` `prefixedKey` 函数（L66-72） | 语义匹配（验证降级分支） |
| `wps-probe/probe.js` (OnAddinLoad / ComponentType 部分) | scaffold — 宿主识别 | event-driven | `src/main.tsx` `Office.onReady` + `createAdapter(info.host)`（L50-53） | 结构匹配（WPS 侧用 `OnAddinLoad` + `ComponentType` 替代） |
| `wps-probe/probe.js` (Excel JSAPI 探测部分) | probe check fn — read/write/undo | CRUD | `src/adapters/ExcelAdapter.ts` `getSelection`(L104-124) / `read`-list_worksheets(L248-262) / `setRangeValues`(L447-472) / `overwriteRange`(L493-506) | 语义匹配（JSAPI 调用链不同，语义对等） |
| `wps-probe/probe.js` (PPT JSAPI 探测部分) | probe check fn — read/write/undo | CRUD | `src/adapters/PptAdapter.ts` `getSelection`(L168-232) / `read`-list_slides(L370-399) / `read`-get_slide(L401-454) / `insertSlideAfter`(L720-768) / `deleteSlideByTitle`(L794-834) | 语义匹配（同上，WPS VBA 风格替代） |
| `wps-probe/index.html` (字体 link 部分) | config — font stack | — | `index.html` L7-14 (Inter + JetBrains Mono + Noto Sans SC 单条 Google Fonts URL) | 精确匹配（探针直接复用相同字体 URL） |

---

## Pattern Assignments

### 1. `probe.js` — parseSSE 最小版（DeepSeek SSE 直连探测）

**Analog：** `src/lib/sse.ts`

**关键对照点：** 探针的 `checkDeepSeekSSE()` 内嵌了 parseSSE 最小版（约 30 行），参照 Aster `streamSSE` 的核心帧解析路径。RESEARCH.md Pattern 6 已给出完整实现，以下摘录 Aster 侧需要「照语义抄」的三个关键片段：

**Aster 原版 — 帧分割与 [DONE] 检测**（`src/lib/sse.ts` L280-303）：
```typescript
// Aster 生产版本（探针抄简化版，不 import 此文件）
buf += decoder.decode(value, { stream: true });
const lines = buf.split('\n');
buf = lines.pop() ?? '';

for (const line of lines) {
  if (!line.startsWith('data:')) continue;
  const data = line.slice(5).trim();
  if (data === '[DONE]') { /* flush accum */ return; }
  if (!data) continue;
  try {
    const chunk = JSON.parse(data);
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) { yield { type: 'delta', content }; }
  } catch { /* 畸形 JSON 静默忽略 */ }
}
```

**Aster 原版 — fetch throw 分类**（`src/lib/sse.ts` L179-208，`classifyFetchThrow` 函数）：
- 探针用 try/catch 直接捕获 `fetch` throw，把错误信息写入报告（RESEARCH.md Pattern 6 L454-464）
- 重点：`err.name === 'AbortError'` 区分超时取消 vs CORS/CSP 拦截

**Aster 原版 — AbortController 超时**（`src/lib/sse.ts` L243-262）：
```typescript
// Aster 在 signal 参数传入；探针则在函数内自建 15s 超时
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 15000);
// fetch(..., { signal: controller.signal })
```

**探针实现要点（不复制 import，照语义）：**
- 不用 `streamSSE` generator，直接内联 for 循环（throwaway 工具够用）
- 不引入 `AsterError` 系列，直接把 `err.message` 写 `rawValues`
- 模型改用 `deepseek-v4-flash`（Aster 现在用 `deepseek-v4-pro`，探针用 flash 省钱）
- **禁止** `import { streamSSE } from '../src/lib/sse'`——违反 30-D-01 工程隔离约束

**RESEARCH.md 已解决：** Pattern 6（L370-465）给出了完整 `checkDeepSeekSSE()` 实现，planner 直接用。

---

### 2. `probe.js` — localStorage 持久性探测

**Analog：** `src/lib/storage.ts`

**关键对照点：** 探针验证「裸 `localStorage`（不带 partitionKey 前缀）跨会话是否持久」，同时坐实 `storage.ts` 降级分支在 WPS 中自动命中（WPS-06 信号）。

**Aster 原版 — `prefixedKey` 降级分支**（`src/lib/storage.ts` L66-72）：
```typescript
function prefixedKey(rawKey: string): string {
  const pk =
    typeof Office !== 'undefined' && Office?.context?.partitionKey
      ? (Office.context.partitionKey as string)
      : undefined;
  return pk ? `${pk}${rawKey}` : rawKey; // WPS 侧：Office 未定义 → pk = undefined → 直接 rawKey
}
```

**WPS 中的行为（探针要验证的）：**
- `typeof Office !== 'undefined'` → **false**（WPS 无 office.js，`Office` 全局不存在）
- 因此 `pk = undefined` → `prefixedKey()` 直接返回 `rawKey`（裸 localStorage 无前缀）
- 探针的 `checkLocalStorageRead()` 中的 `typeof Office !== 'undefined' && !!Office?.context?.partitionKey` 验证此信号，预期结果为 `false`（RESEARCH.md Pattern 8 L584-587）

**Aster 原版 — set/get 方法**（`src/lib/storage.ts` L79-106）：
- 探针抄最简版：直接 `localStorage.setItem / getItem`，不走 `storage.set/get`（因为探针不 import Aster 模块）
- 错误处理参照：`catch (e) { return { pass: false, value: String(e?.message ?? e) }; }`（比 Aster 的 `StorageQuotaError` 更轻）

**RESEARCH.md 已解决：** Pattern 8（L543-592）给出 `checkLocalStorageWrite()` + `checkLocalStorageRead()` 完整实现，planner 直接用。

---

### 3. `probe.js` — OnAddinLoad + ComponentType 宿主识别

**Analog：** `src/main.tsx`

**关键对照点：** WPS 侧宿主识别链 = `OnAddinLoad` + `window.Application.ComponentType`，语义对等于 Aster 的 `Office.onReady` + `Office.context.host` → `createAdapter(host)`。

**Aster 原版 — 宿主识别链**（`src/main.tsx` L50-53）：
```typescript
// Aster Office.js 版本（探针不引此文件，对照理解）
Office.onReady(async (info) => {
  const adapter = await createAdapter(info.host);
  // info.host: Office.HostType.PowerPoint / Excel / Word
});
```

**WPS 等价替换（探针实现）：**

```javascript
// probe.js 宿主识别（替代 Office.onReady + createAdapter）
// ribbon.xml: onLoad="OnAddinLoad"
function OnAddinLoad(ribbon) {
  ribbonUI = ribbon;
  // ComponentType: 1=文字(wps) / 2=表格(et) / 3=演示(wpp)
  // 对应 Office.HostType: Word / Excel / PowerPoint
  const type = Application.ComponentType;
  console.log('[Probe] ComponentType:', type);
}
```

**API 替换对照表：**
| Aster（Office.js） | WPS 探针（WPS JSAPI） |
|---|---|
| `Office.onReady(cb)` | `function OnAddinLoad(ribbon) {}` + `ribbon.xml onLoad="OnAddinLoad"` |
| `info.host === Office.HostType.PowerPoint` | `Application.ComponentType === 3` |
| `info.host === Office.HostType.Excel` | `Application.ComponentType === 2` |
| `info.host === Office.HostType.Word` | `Application.ComponentType === 1` |
| `Office.context.partitionKey` | 不存在（Office 对象不存在） |

**主题（data-theme）:** Aster `main.tsx` L85 读 `Office.context.officeTheme` 设 `data-theme`——探针是 throwaway 工具，不需要读宿主主题，跳过此步骤。

**RESEARCH.md 已解决：** Pattern 4（L260-300）给出完整 `OnAddinLoad` + `ShowTaskPane` + `OnGetEnabled` 实现。

---

### 4. `probe.js` — Excel（金山表格）JSAPI 探测

**Analog：** `src/adapters/ExcelAdapter.ts`

**核心语义映射（Office.js proxy 模型 → WPS async-IPC 逐属性 await）：**

| 探针探测项 | Aster ExcelAdapter 语义来源 | 文件:行号 |
|---|---|---|
| `read_selection`（选区地址） | `getSelection()` → `Excel.run` → `range.load('address')` + `ctx.sync()` | L104-124 |
| `read_A1`（读单元格值） | `read('get_range_values')` → `range.load('values')` + `ctx.sync()` | L267-305 |
| `list_sheets`（列工作表） | `read('list_worksheets')` → `ws.load('items/name')` + `ctx.sync()` | L248-262 |
| `write_B1`（写单元格）+ 回读 | `setRangeValues()` — two-sync：sync1 load before-image → sync2 write | L447-472 |
| `undo_B1`（快照还原） | `overwriteRange(args: Record<...>)` — args 对象签名（非位置参） | L493-506 |
| `D03_PivotTable_exists` | 无直接 analog（新增能力探测）；参照 ExcelAdapter 的 inverse 守门思路 | — |

**Aster 关键代码摘录：**

`getSelection`（L104-124）：
```typescript
async getSelection(): Promise<SelectionContext> {
  return await Excel.run(async (ctx) => {
    const range = ctx.workbook.getSelectedRange();
    range.load('address');
    await ctx.sync();
    if (!range.address) return { kind: 'none' };
    return { kind: 'excel', address: range.address };
  });
}
```

`setRangeValues` two-sync（L447-472）— **探针 write 后必须回读验证，参照此模式**：
```typescript
async setRangeValues(address, values) {
  return await Excel.run(async (ctx) => {
    const range = resolveRange(ctx, address);
    range.load(['values', 'address']);
    await ctx.sync(); // sync 1: 读 before-image
    const beforeImage = { address: range.address, values: range.values };
    range.values = values;
    await ctx.sync(); // sync 2: 写入
    return { beforeImage };
  });
}
```

`overwriteRange` — **inverse 方法使用 `Record<string, unknown>` 签名（项目记忆 adapter-inverse-signature 铁律）**（L493-506）：
```typescript
async overwriteRange(args: Record<string, unknown>): Promise<void> {
  const address = args.address as string;  // 从 Record 取字段，不用位置参
  const values = args.values as unknown[][];
  await Excel.run(async (ctx) => {
    const range = resolveRange(ctx, address);
    range.values = values;
    await ctx.sync(); // 单次 sync（逆操作，不抓 before-image）
  });
}
```

**WPS 替换注意事项（关键 landmine）：**
- WPS 无 `Excel.run(ctx => { ... ctx.sync() })` 批处理 proxy 模型
- WPS 是**逐属性 async-IPC**：每个 `Application.ActiveWorkbook.ActiveSheet.Range('B1')` 都要 `await`
- WPS 写入后 `b1.Value = WRITE_VAL`——写后立即 `await b1.Value` 回读，不依赖 sync2
- 快照还原：直接 `b1.Value = null`（探针简化版），对应 `overwriteRange` 语义

**RESEARCH.md 已解决：** Pattern 10（L639-763）给出完整 `checkExcelJSAPI()` 实现。

---

### 5. `probe.js` — PPT（金山演示）JSAPI 探测

**Analog：** `src/adapters/PptAdapter.ts`

**核心语义映射：**

| 探针探测项 | Aster PptAdapter 语义来源 | 文件:行号 |
|---|---|---|
| `read_slide_count`（取幻灯片数） | `read('list_slides')` → `slides.items.length` | L370-399 |
| `read_shape_text`（读形状文本） | `read('get_slide')` → `shape.textFrame.textRange.text` | L401-454 |
| `write_slide`（新建幻灯片 + 写标题） | `insertSlideAfter()` → `slides.add()` + `shapes.addTextBox(title)` | L720-768 |
| `undo_slide`（删除探针幻灯片） | `deleteSlideByTitle(args: Record<...>)` → `Slides.FindBySlideID2` + `.Delete()` | L794-834 |
| `D-03 copy_slide (3-1)` | 无直接 analog（探测 `Slide.Copy` / `Slide.Duplicate` 存在性） | — |
| `D-03 AddTable (3-6)` | 无直接 analog（探测 `Shapes.AddTable` 存在性；Aster 无此操作） | — |
| `D-03 AddLine (3-7)` | 无直接 analog（探测 `Shapes.AddLine`/`AddConnector` 存在性） | — |

**Aster 关键代码摘录：**

`getSelection` PPT 侧（L168-232）— 三 sync 范式原型：
```typescript
async getSelection(): Promise<SelectionContext> {
  return await PowerPoint.run(async (ctx) => {
    const selectedSlides = ctx.presentation.getSelectedSlides();
    selectedSlides.load('items');
    const allSlides = ctx.presentation.slides;
    allSlides.load('items');
    await ctx.sync(); // 批量 load

    // PPT-05 守则：按 .index 排序（绕 Web 反序 bug）
    const sorted = [...selectedSlides.items].sort((a, b) => a.index - b.index);
    return { kind: 'ppt', slideIndex: sorted[0].index + 1, slideCount: allSlides.items.length };
  });
}
```

`list_slides` read（L370-399）— 形状文本读取路径（WPS 探针照此语义）：
```typescript
// Aster 三 sync 流程（WPS 侧每个属性访问都要 await，概念相同）
slide.shapes.load('items/type,items/textFrame/textRange/text');
await ctx.sync();
// 取第一个文本形状首行作为 title
const title = (shape.textFrame.textRange.text ?? '').split('\n')[0].trim();
```

`insertSlideAfter`（L720-768）— write + 回读模式，探针 `write_slide` 对照：
```typescript
async insertSlideAfter(_afterIndex, title?) {
  return await PowerPoint.run(async (ctx) => {
    const slides = ctx.presentation.slides;
    slides.load('items');
    await ctx.sync(); // sync 1: 记录 before 数量

    slides.add(); // add 到末尾
    slides.load('items');
    await ctx.sync(); // sync 2: 重新 load（含新 slide）

    const sorted = [...slides.items].sort((a, b) => a.index - b.index);
    const newSlide = sorted[sorted.length - 1]; // 末尾 = 新插入
    if (titleText) {
      newSlide.shapes.addTextBox(titleText, { left: 40, top: 30, width: 600, height: 60 });
      await ctx.sync(); // sync 3: 写标题
    }
    return { insertedIndex: newSlide.index + 1, title: titleText };
  });
}
```

`deleteSlideByTitle`（L794-834）— **inverse 方法 `Record<string, unknown>` 签名铁律**：
```typescript
async deleteSlideByTitle(args: Record<string, unknown>): Promise<void> {
  const titleFingerprint = args.titleFingerprint as string; // Record 取字段
  // WPS 侧对应：FindBySlideID2(newSlideId).Delete()（探针用 SlideID 而非 title）
}
```

**WPS 替换注意事项（关键 landmine）：**
- Aster 用 `PowerPoint.run(ctx => { ctx.sync() })` 批处理；WPS 是**逐属性 `await`**
- Aster `slides.add()` → WPS `pres.Slides.AddSlide(Index)`（签名不同，WPS 需传入序号）
- Aster 按 `slide.index` 定位；WPS 探针用 `newSlide.SlideID` + `FindBySlideID2(id)` 定位（更稳）
- Aster 形状文本路径 `shape.textFrame.textRange.text`；WPS 同名属性链，但每层均需 `await`
- **PPT-05 守则**（绕 Web 反序 bug）在 WPS 侧未知是否存在，但探针按 Index 排序是防御性正确做法

**RESEARCH.md 已解决：** Pattern 11（L773-912）给出完整 `checkPptJSAPI()` 实现（含 D-03 四项判据）。

---

### 6. `wps-probe/index.html` — 字体 link（字体/CSS 渲染探测项）

**Analog：** `index.html`

**关键对照点：** 探针字体 link 必须与 Aster `index.html` 完全一致（相同 family names + weights + display=swap），因为「字体/CSS 渲染探测」验证的正是 Aster 真实字体栈在 WPS CEF 中是否正常加载（WPS-06 信号）。

**Aster 原版精确字体 URL**（`index.html` L9-14）：
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+SC:wght@400;500;700&display=swap"
/>
```

**字体检测目标值（`checkFontCSS()` 验证用）：**
- `document.fonts.check('12px Inter')` — 正文拉丁/数字字体
- `document.fonts.check('12px "Noto Sans SC"')` — 中文字体（WPS CEF 能否加载 Google Fonts 是关键）
- `document.fonts.check('12px "JetBrains Mono"')` — 等宽字体（时间戳/代号）

**Aster teal CSS 品牌色**（`CLAUDE.md` §UI 设计系统）：
- `--accent` = `#009887`（light 模式）
- `#009887` → `rgb(0, 152, 135)` — 探针 `getComputedStyle(testEl).backgroundColor` 验证此值
- 探针不需要完整 CSS 变量体系（throwaway 工具），只需验证 hex `#009887` 在 CEF 能正确渲染

**Office.js CDN tag 不引入：**
- Aster `index.html` L16：`<script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js">`
- 探针 `index.html`：**不引此 script**（WPS 不消费 office.js，引入会让 `Office.onReady` 永远不触发）

**RESEARCH.md 已解决：** Pattern 2（L165-227）给出了探针 `index.html` 完整实现，字体 link 已与 Aster 版本对齐。

---

## 共享模式（跨文件 Cross-cutting）

### 写后回读验证（assertWriteResult 模式）

**来源：** 项目记忆 `project_ppt_officejs_gotchas` + `25-WPS-01-REPORT §7`
**应用于：** 探针所有 write 操作（Excel `write_B1`、PPT `write_slide`）

**模式（来自 ExcelAdapter.ts L454-466）：**
```typescript
// 两步：先写，后立即读回比较（不依赖 WPS 返回值）
range.values = values;       // 写入
await ctx.sync();            // sync 2
// 探针版（WPS 无 ctx.sync）：
b1.Value = WRITE_VAL;        // 写入（WPS 直接赋值）
const readback = await b1.Value;  // 立即回读
writePass = String(readback) === String(WRITE_VAL);  // 断言
```

**应用规则：** 所有 WPS JSAPI 写操作（`Range.Value =`、`TextRange.Text =`）后立即 `await` 回读对比——不能假设写入成功（WPS「尽力执行」VBA 风格，不抛错不代表写成功）。

### inverse 方法 Record 签名（项目记忆铁律）

**来源：** 项目记忆 `project_adapter_inverse_signature` + `ExcelAdapter.overwriteRange`(L493) + `PptAdapter.deleteSlideByTitle`(L794)
**应用于：** 探针的 undo 探测函数语义理解（虽然探针不实现 replay engine，但理解 inverse 是快照还原而非 Ctrl+Z）

**核心：** Aster 所有 inverse 方法签名为 `method(args: Record<string, unknown>)`，从 Record 取字段（非位置参）。探针探测的「undo 可行性」 = 验证 WPS JSAPI 能否通过写回旧值做快照还原——这是 `operationLog` 反向引擎在 WPS 侧的唯一可行路径（WPS undoRecord 有 bug，已在 STATE.md UNDO 裁定中坐实）。

### 工程隔离约束（全探针共享的硬门）

**来源：** 30-D-01 硬约束 + `code_context` 段
**应用于：** `wps-probe/` 所有文件

| 约束 | 具体规则 |
|---|---|
| 不 import Aster 模块 | `probe.js` 和 `index.html` 不含任何 `../../src/` 路径的 import |
| 不引 office.js CDN | `index.html` 不含 `appsforoffice.microsoft.com` script tag |
| 不使用 `Office.*` 任何 API | 探针里出现 `Office.onReady` / `Excel.run` / `PowerPoint.run` 都是 bug |
| 不使用 `wps.PluginStorage` 持久化 | 只用 `localStorage`；`PluginStorage` 仅存 Task Pane ID（会话内） |

---

## 未找到 Analog 的项目

| 功能 | 角色 | 数据流 | 原因 |
|---|---|---|---|
| `checkCEFVersion()` — UA/特性探测 | probe check fn | request-response | Aster 无 CEF 版本检测逻辑（仅跑在 Office.js 环境）；RESEARCH.md Pattern 5 给出完整实现 |
| `checkImageDirect()` — 图片直连 | probe check fn | request-response | Aster 生图走 `dispatchTool` + agent loop，无独立直连探测函数；项目记忆 `project_browser_image_gen_gotchas` 给出 b64_json 规则；RESEARCH.md Pattern 7 给出完整实现 |
| `generateReport()` — 结果报告生成 | report generator | transform | Aster 无对等结果报告逻辑；RESEARCH.md Pattern 12 给出完整实现 |
| `ribbon.xml` / `jsplugins.xml` — WPS sideload 结构 | config | — | Aster 用 Office.js `manifest.xml`，与 WPS `ribbon.xml`/`jsplugins.xml` 是两套完全不同的机制；RESEARCH.md Pattern 1/3 给出完整模板 |

---

## 给 Planner 的关键说明

### API 替换对照（Office.js → WPS JSAPI）

| 探针功能 | Aster Office.js 写法 | WPS JSAPI 替换写法 |
|---|---|---|
| 宿主初始化 | `Office.onReady(info => {...})` | `function OnAddinLoad(ribbon) {...}` |
| 宿主类型 | `info.host === Office.HostType.Excel` | `Application.ComponentType === 2` |
| partitionKey | `Office.context.partitionKey` | 不存在（Office 对象不存在） |
| Excel run ctx | `Excel.run(async (ctx) => { ...; await ctx.sync() })` | `await app.ActiveWorkbook.*`（逐属性 await） |
| PPT run ctx | `PowerPoint.run(async (ctx) => { ...; await ctx.sync() })` | `await app.ActivePresentation.*`（逐属性 await） |
| 列 Slides | `ctx.presentation.slides.load('items'); await ctx.sync()` | `await pres.Slides.Count` → `await pres.Slides.Item(i)` |
| 新增 Slide | `slides.add()` | `await pres.Slides.AddSlide(Index)` |
| 删除 Slide（inverse） | `deleteSlideByTitle` 用 title 指纹定位 | `await pres.Slides.FindBySlideID2(id)` → `.Delete()` |

### RESEARCH.md Pattern 引用总表

| Planner 任务 | RESEARCH.md Pattern | 行号范围 |
|---|---|---|
| 写 ribbon.xml | Pattern 1 | L136-162 |
| 写 index.html | Pattern 2 | L165-227 |
| 写 jsplugins.xml | Pattern 3 | L229-259 |
| 写 OnAddinLoad + ShowTaskPane | Pattern 4 | L260-300 |
| 写 checkCEFVersion() | Pattern 5 | L304-359 |
| 写 checkDeepSeekSSE() | Pattern 6 | L362-465 |
| 写 checkImageDirect() | Pattern 7 | L467-534 |
| 写 checkLocalStorageWrite/Read() | Pattern 8 | L537-592 |
| 写 checkFontCSS() | Pattern 9 | L594-631 |
| 写 checkExcelJSAPI() | Pattern 10 | L633-763 |
| 写 checkPptJSAPI() | Pattern 11 | L766-912 |
| 写 generateReport() | Pattern 12 | L915-958 |

---

## Metadata

**Analog 搜索范围：** `src/lib/`、`src/adapters/`、`src/main.tsx`、`index.html`
**文件扫描数：** 5（sse.ts、storage.ts、main.tsx、ExcelAdapter.ts、PptAdapter.ts、index.html）
**映射日期：** 2026-06-08
