# Phase 29: PPT 工具补全 + NFR-12 收口 - Pattern Map

**Mapped:** 2026-06-06
**Files analyzed:** 7（6 改既有 + 0 新建；网格模拟为远端 fallback，默认走原生）
**Analogs found:** 7 / 7（全部 exact / role-match，均来自同一 codebase）

> 全部为「在既有文件内增量」，本 phase **0 新建文件**。三工具新方法精确对照 PptAdapter 既有
> before-image+inverse / set-diff 新 shape 定位 / 写后回读 / isSetSupported 门控 四大范式；
> 合约接线照搬 Phase 28（Excel 工具补全，最近一次走完同样四处对齐 + D-17 守门流程）。

---

## File Classification

| 改动文件 | 改动性质 | Role | Data Flow | 最接近 Analog | Match Quality |
|---------|---------|------|-----------|---------------|---------------|
| `src/adapters/PptAdapter.ts` | 在既有文件内增量（新增 3 写方法 + 0-1 inverse） | adapter (host API) | request-response（写后回读） | 同文件 `setShapeProperty`(L889) / `addShape`(L1584) / `deleteShapeById`(L1809) / `setSlideBackground`(L2572) | exact |
| `src/agent/tools/write/ppt.ts` | 在既有文件内增量（新增 3 ToolDef） | tool def | request-response | 同文件 `setShapeProperty`(L141) / `addShapeTool`(L369) / `applySlideLayoutTool`(L726) | exact |
| `src/agent/tools/index.ts` | 在既有文件内增量（PPT_TOOLS +3 名 + pptWriteTools +3 + import） | route/registry | dispatch | 同文件 `PPT_TOOLS`(L34) / `buildToolsForHost('ppt')`(L319) | exact |
| `src/agent/operationLog.ts` | 在既有文件内增量（kind union +3；接口/case 大概率 0 新增） | model/replay engine | event-driven（undo replay） | 同文件 `PostStateSnapshot.kind`(L34) / `executeReverse`(L348) / `readTargetState`(L240) | exact |
| `src/agent/contract.test.ts` | 在既有文件内增量（CONTRACT +3 行 + PhaseNum +29） | test (CI 真相源) | — | 同文件 Phase 28 三行(L70-72) / Phase 23 `apply_slide_layout`(L63) | exact |
| `src/agent/operationLog.integration.test.ts` | 在既有文件内增量（+3 守门用例 + 可能扩 mockPpt） | test (守门) | — | 同文件 `add_shape→delete_shape_by_id`(L1245) / Phase 28 `create_pivot_table`(L1840) | exact |
| `src/agent/design/ppt-tokens.ts` / `geometry-check.ts` | **只读复用，不改**（仅网格模拟 fallback 启用时） | utility (纯函数 token) | transform | n/a（已有模块，import 复用） | exact |

> ⚠️ 路径勘误：CONTEXT/prompt 写的 `src/lib/ppt-tokens.ts` / `src/lib/geometry-check.ts` 实际位于
> **`src/agent/design/ppt-tokens.ts`** 与 **`src/agent/design/geometry-check.ts`**（Phase 22/23 产物）。
> ToolDef 既有 import 见 `ppt.ts` L26-29。

---

## Pattern Assignments

### 1. `src/adapters/PptAdapter.ts`（adapter, request-response）— 新增 3 写方法 + inverse

每个新方法都遵循同文件四条铁律（A-06 闭包 / bounds check / HostApiError 包装 / 写后回读）。逐工具映射如下。

#### 1a. PPT-09 表格 `insertTable` — Analog: `addShape`(L1584)

**复用范式：set-diff 定位新 shape id（office-js #5022 工作区）+ 写后回读 count+1。**

裸建 → sync → reload 集合 → set-diff 取稳定 proxy（`addShape` L1615-1665 已固化）：
```typescript
// PptAdapter.ts:1615-1665（直接镜像，把 addTextBox/addGeometricShape 换成 addTable(rows,cols)）
slide.shapes.load('items/id');
await ctx.sync();
const beforeIds = new Set((slide.shapes.items as Array<{id:string}>).map(s => s.id));
const beforeCount = slide.shapes.items.length;
// ── 仅「裸创建」(office-js #5022 正解)：绝不碰 add-return proxy 的 id / 属性 ──
slide.shapes.addGeometricShape(shapeType, { left, top, width, height }); // ← 换成 slide.shapes.addTable(rows, cols)
await ctx.sync();                          // sync 3：提交裸创建
slide.shapes.load('items/id,items/type');
await ctx.sync();                          // sync 4：reload 定位
const afterShapes = slide.shapes.items as Array<{ id: string; type: string }>;
if (afterShapes.length < beforeCount + 1) {     // 写后回读：count 未增 → 诚实失败
  throw new HostApiError('PPT addShape: 插入后 shape 数量未增加（创建未落地）', undefined);
}
const created = afterShapes.filter(s => !beforeIds.has(s.id));
const newShapeId = created[created.length - 1].id as string;
```
- **填值差异**：表格建后用稳定 proxy `getTable().getCellOrNullObject(r,c).text = v` 逐格填（RESEARCH §Pitfall 4：空格用 `""`，不用 undefined；不用 TableAddOptions.values 路径）。若同 run 填值崩 → 拆独立 `PowerPoint.run`（镜像 `addImageShape` L1704 的「两次独立 run」回读范式，L1714 建 / L1772 回读）。
- **返回**：`{ newShapeId }`（同 `addShape` L1682）。
- **undo**：复用 `delete_shape_by_id`，0 新 inverse（表格是单 shape）。
- **门控**：`isSetSupported('PowerPointApi','1.8')`，范式见 `setSlideBackground` L2592-2598（容错 `typeof Office !== 'undefined'`）。

#### 1b. PPT-10 线条 `addLine` — Analog: `addShape`(L1584)

同 1a 的 set-diff 范式，裸建调 `slide.shapes.addLine(connectorType, { left, top, width, height })`（d.ts L184173/184184，1.4 web Supported）。`options.left/top` = 起点，`width/height` = 终点相对偏移。
- **可选**：reload 后在稳定 proxy 上设 `shape.lineFormat.color/weight/dashStyle`（ShapeLineFormat 1.4；写 line 属性范式见 `setShapeProperty` L987-996）。
- **箭头诚实降级**：PowerPoint 命名空间无 arrowhead API（HIGH 负面）→ 不设箭头，ToolDef 层告知。
- **undo**：复用 `delete_shape_by_id`，0 新 inverse。门控 `isSetSupported('PowerPointApi','1.4')`。

#### 1c. PPT-11 渐变降级纯色 — Analog: `setShapeProperty`(L889) + `restoreShapeProperty`(L1033)

**直接复用 `setShapeProperty` 的 fillColor 路径**（ShapeFill 无渐变写 API，HIGH 负面 → 纯色唯一路径）。before-image 读取（L959-973）：
```typescript
// PptAdapter.ts:959-973 — 写前 before-image（fill + line + 几何），供 restore_shape_property 还原
shape.fill.load(['type', 'foregroundColor']);
shape.lineFormat.load(['color', 'weight', 'visible']);
await ctx.sync();
const beforeImage = {
  fillType: shape.fill.type as string,
  fillColor: shape.fill.foregroundColor as string | null,
  lineColor: shape.lineFormat.color as string | null,
  lineWeight: shape.lineFormat.weight as number | null,
  lineVisible: shape.lineFormat.visible as boolean,
  width: shape.width as number,
  height: shape.height as number,
};
// 写入纯色（L984-985）
shape.fill.setSolidColor(props.fillColor);
```
inverse 还原（`restoreShapeProperty` L1083-1105，Pitfall 2：`NoFill` 用 `clear()`，非写 null 颜色）：
```typescript
// PptAdapter.ts:1083-1088
if (fill_type === 'NoFill') {
  shape.fill.clear();
} else if (fill_color !== null) {
  shape.fill.setSolidColor(fill_color);
}
```
- **取色**：渐变 stops 首色（discretion，ToolDef 层 `pickFirstStopColor`）。
- **undo**：复用 `restore_shape_property`，0 新 inverse。
- **方案 A（推荐）**：渐变工具不写新 adapter 方法，ToolDef 直接调既有 `setShapeProperty(slide_index, shape_id, { fillColor: firstColor })`。

**共同约束（三方法都遵循）：**
- inverse / read 方法签名一律 `(args: Record<string, unknown>)`（`restoreShapeProperty` L1033 / `deleteShapeById` L1809；memory `project_adapter_inverse_signature`，Phase 5 位置参翻车点）。
- 闭包错误包装范式（`setShapeProperty` L1007-1010）：`catch (err) { if (err instanceof HostApiError) throw err; throw new HostApiError('PPT xxx 失败', err); }`。
- 内部对易错键做 snake/camel 双键容错（memory `project_ppt_officejs_gotchas`）。

---

### 2. `src/agent/tools/write/ppt.ts`（tool def, request-response）— 新增 3 ToolDef

**Analog（简单逆向 + 写后回读 + 诚实降级）：`setShapeTextAlignmentTool`(L439)。**
这是最贴近本 phase「写后回读 → effective 门控 → 不生效走 notEffectiveResult / before 不可读走 noop_inverse」的范式：
```typescript
// ppt.ts:467-477 — effective 门控 + noop+gate 降级（PPT-09/10/11 共用骨架）
const { beforeAlignment, effective } = await (ctx.adapter as PptAdapter).setShapeTextAlignment(slide_index, shape_id, alignment);
if (!effective) return notEffectiveResult('文字对齐');          // 网页版静默 no-op → ok:false，不带 reverse/postState
const reverse: ReverseDescriptor = beforeAlignment === null
  ? { tool: 'noop_inverse', args: { reason: '原段落对齐为混合/未知值，此步不可自动撤销' } }  // before 读不回 → noop+gate
  : { tool: 'restore_shape_alignment', args: { slide_index, shape_id, before_alignment: beforeAlignment } };
const postState: PostStateSnapshot = { kind: 'ppt_shape_alignment', content: { slide_index, shape_id } };
return { ok: true, data: { slide_index, shape_id, alignment }, reverse, postState };
```

`notEffectiveResult` helper（ppt.ts L84-94，直接复用，**不要新写**）：
```typescript
function notEffectiveResult(what: string): ToolResult {
  return { ok: false, error: { code: 'UNSUPPORTED',
    message: `此操作（${what}）在网页版 PowerPoint 未生效（可能仅桌面版 PowerPoint 支持）`,
    recoverable: false, hint: `请勿重复尝试该操作；...` } };
}
```

**PPT-09/10 新建 shape ToolDef — Analog: `addShapeTool`(L411-427)。** reverse 字面量 Record + delete_shape_by_id：
```typescript
// ppt.ts:417-426 — 新建 shape → delete_shape_by_id reverse + 返回 new_shape_id（image_insert_autonomous：返回 id 让 AI 排版）
const { newShapeId } = await (ctx.adapter as PptAdapter).addShape(slide_index, shape_type, position, text);
const reverse: ReverseDescriptor = { tool: 'delete_shape_by_id', args: { slide_index, shape_id: newShapeId } };
const postState: PostStateSnapshot = { kind: 'ppt_shape_new', content: { slide_index, shape_id: newShapeId } };
return { ok: true, data: { slide_index, new_shape_id: newShapeId }, reverse, postState };
```

**PPT-11 渐变 ToolDef — Analog: `setShapeProperty`(L141) ToolDef（before-image 完整 Record reverse）：**
```typescript
// ppt.ts:188-201 — before-image 整体作为 restore_shape_property 的 Record args（非位置参）
const reverse: ReverseDescriptor = {
  tool: 'restore_shape_property',
  args: { slide_index, shape_id, fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor,
          line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight,
          line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height },
};
```
- **降级告知（PPT-11 / PPT-10 箭头）**：`data` 含精确量化文案「平台不支持渐变，已用纯色 #RRGGBB 代替」/「平台支持线条但不支持箭头样式」（memory `precision_over_brevity`；ROADMAP SC#4 诚实降级判据）。
- **humanLabel**：纯中文模板字符串（**非 Lingui 宏**），同 `addShapeTool` L400-410 / `setShapeProperty` L163-169。沿用此即可避开 `npm run extract`（RESEARCH Wave 0 Gaps：本 phase 大概率无 UI surface）。
- **`timeoutMs`**：若表格建+填值整体可能 >15s（同 `applySlideLayoutTool` L735 `timeoutMs: 45_000`），按需设 def.timeoutMs；生图类已有 120s 先例（memory `browser_image_gen_gotchas`）。
- **工具名不撞 Word `insert_table`**（contract.test L39）→ 建议 `insert_ppt_table`（RESEARCH 锚定名）。

---

### 3. `src/agent/tools/index.ts`（route/registry, dispatch）— PPT_TOOLS Set + 注册

**3 个新工具名必须加进 `PPT_TOOLS` Set（L34-51）**，否则 LLM camelCase 参数不归一化 → 静默丢参 no-op（memory `project_ppt_officejs_gotchas`，PPT 专属坑，Word/Excel 无此 Set）。归一化在 dispatch L214-218：
```typescript
// tools/index.ts:215-218
const normalizedArgs = PPT_TOOLS.has(call.name)
  ? normalizeToSnakeCase(call.arguments)
  : call.arguments;
return await Promise.race([def.execute(normalizedArgs as never, ctx), timeout]);
```
注册点 `buildToolsForHost('ppt')` 的 `pptWriteTools` 数组（L320-331，含 `assertWriteToolRegisterable` 守门）：
```typescript
// tools/index.ts:320-331 — 在 applySlideLayoutTool 后追加 3 个新 ToolDef（host 隔离：仅 'ppt' 分支注册）
const pptWriteTools = [
  insertSlide, setShapeProperty, moveShape, setShapeText,
  setShapeTextFontTool, addShapeTool, copySlideTool,
  setShapeTextAlignmentTool, deleteShapeTool, rotateShapeTool,
  manageSlidesTool, setSlideBackgroundTool,
  generatePptImageTool, searchAndInsertStockImagePptTool,
  applySlideLayoutTool, // ← 在此后追加 3 个新工具
  batchWrite,
] as ToolDef[];
```
同步在 L14 的 `import { ... } from './write/ppt'` 加 3 个新 ToolDef 名。

---

### 4. `src/agent/operationLog.ts`（model/replay engine, event-driven）— kind union + 保守 read

**`PostStateSnapshot.kind` union（L34-54）加 3 个**（命名 plan 定，建议 `ppt_table` / `ppt_line` / `ppt_shape_gradient`），照搬 Phase 28 注释风格（L49-52）：
```typescript
// operationLog.ts:49-52（Phase 28 范式 — 在此后追加 Phase 29 段）
| 'excel_merge'   // merge_cells 快照式（unmerge + values 覆写 undo）
| 'excel_pivot'   // create_pivot_table 简单逆向（delete undo）
// Phase 29 新增：ppt_table / ppt_line / ppt_shape_gradient（readTargetState 走保守 default → undefined）
```
**`readTargetState`（L240）与 `isTargetStateConsistent`（L309）：新 kind 不加 case，走 `default: return undefined`**（L293-294 / L339-340）。这使新 kind 被 `isTargetStateConsistent` 的 `if (current === undefined) return true`（L314）保守视为一致 → **不误判手改**（memory `project_adapter_inverse_signature`：盲加 read 比对会误判全部手改跳过 undo；同 `ppt_shape`/`ppt_layout` 的显式安全侧）。

**`executeReverse`（L348）switch：大概率 0 新 case** —
- PPT-09 表格 + PPT-10 线条 → `case 'delete_shape_by_id'`（已存在 L477-480，复用）。
- PPT-11 渐变纯色 → `case 'restore_shape_property'`（已存在 L371-376，复用）。
- 若某降级走 noop+gate → `case 'noop_inverse'`（已存在 L585-588）。

**`DocumentAdapterForReplay` 接口（L108-190）：大概率 0 新方法声明** — `deleteShapeById`(L167) / `restoreShapeProperty`(L122) 均已声明。

---

### 5. `src/agent/contract.test.ts`（test, CI 真相源）— 四处对齐

**Analog: Phase 28 三行（L70-72）+ Phase 23 `apply_slide_layout`（L63）。** D-29-05 四处逐字对齐：
```typescript
// 1. contract.test.ts:18 — PhaseNum 联合类型加 29
type PhaseNum = 9 | 10 | 11 | 23 | 27 | 28 | 29;

// 2. CONTRACT 数组（L73 末尾）加 3 行 — reverseTool 全复用现有（照 Phase 28 L70-72 行格式）
// ─── Phase 29 PPT 工具补全 ───
{ toolName: 'insert_ppt_table', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_shape_by_id', phase: 29, integrationTest: true },
{ toolName: 'add_line', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_shape_by_id', phase: 29, integrationTest: true },
{ toolName: 'set_shape_gradient', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_shape_property', phase: 29, integrationTest: true },
```
- **长度断言（L153-154，当前 `≥24`）**：现有 31 行 + 3 = 34，`≥24` 仍通过。CONTEXT 建议上调 `≥27`（可选，非必需）。
- **D-17 fs.readFileSync 硬卡（L127-150）**：每个 `integrationTest:true` 的 `toolName` 字面量必出现在 `operationLog.integration.test.ts` 文件内（L143-149 断言），否则 CI 挂 → 见 §6 守门用例。
- **noop+gate 守门（L100-104）**：本 phase 三工具均简单逆向，`reverseTool` 非 `noop_inverse`，不触发此断言（除非某降级路径决定不可撤，plan 定）。

---

### 6. `src/agent/operationLog.integration.test.ts`（test, 守门）— +3 守门用例

**Analog（最贴近，rolled_back）：`add_shape → delete_shape_by_id`（L1245-1260）。** 真 PptAdapter 实例 + mock 宿主（非 mock adapter，才抓得到 Record 签名错配）：
```typescript
// operationLog.integration.test.ts:1245-1260（PPT-09/10 各加一条同构用例）
it('D-29: insert_ppt_table → delete_shape_by_id → rolled_back', async () => {
  mockPpt('');                        // mock PowerPoint 全局
  mockOfficeSupportsAll();            // mock isSetSupported（PowerPointApi 1.8 门控，Pitfall 6 防 TypeError）
  const adapter = new PptAdapter();   // ⚠️ 真 PptAdapter 实例
  const entry: OperationLogEntry = {
    runId: 'r29', stepIndex: 0, toolName: 'insert_ppt_table',
    args: { slideIndex: 1, rows: 3, cols: 4 },
    humanLabel: '在第 1 张幻灯片插入 3×4 表格',
    reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    postState: { kind: 'ppt_table', content: { slide_index: 1, shape_id: 'new-shape-uuid' } },
    timestamp: 0,
  };
  const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
  expect(detail.status).toBe('rolled_back');
});
```
**Analog（最近一次「工具补全」phase 全套，含降级路径）：Phase 28 `create_pivot_table`（L1840-1876）** — 一条 rolled_back（adapter 实现）+ 一条 noop_inverse → skipped_error（API 不可用降级）。PPT-11 降级路径 / PPT-10 箭头若标不可撤可照此加 skipped_error 断言。

**mock 工厂复用：**
- `mockPpt(slideTextboxText)`（L176-259）：返回 del fn；`new-shape-uuid` shape 供 `deleteShapeById` 定位（L213/L216）。**新工具需扩 `slide.shapes` mock 加 `addTable` / `addLine` vi.fn**（参照 `addGeometricShape` mock L241-248 返回 `{ load, id, type, ... }`）。
- `mockOfficeSupportsAll()`（L389-393）：所有版本返 true，供门控前向用例。`afterEach`（L377-385）已 `delete global.Office/PowerPoint`。
- **D-17 满足**：3 个新工具名（`insert_ppt_table` / `add_line` / `set_shape_gradient`）字面量必现于本文件（contract.test fs.readFileSync 硬卡）。

---

## Shared Patterns（跨三工具 / 跨文件横切）

### 写后回读验证（D-29-07）
**Source:** `PptAdapter.ts:2634-2639`（`setSlideBackground` 写后回读 fill.type）+ `addShape:1650-1656`（回读 count+1）+ `ppt.ts:84-94`（`notEffectiveResult`）。
**Apply to:** 三工具全部。addTable/addLine 后回读 shape count +1；setSolidColor 后回读 fill.type；回读失败 → `notEffectiveResult()`（ok:false，不带 reverse/postState，不报 ✅，熔断记 failure）。

### inverse Record 签名（HARD）
**Source:** `PptAdapter.ts:1033`（`restoreShapeProperty(args: Record<string, unknown>)`）/ `:1809`（`deleteShapeById`）。
**Apply to:** 任何新 inverse/read 方法（本 phase 大概率 0 新增，全复用）。**严禁位置参**（Phase 5 翻车点 → 真机撤销全挂；memory `project_adapter_inverse_signature`）。

### office-js #5022 set-diff 新 shape 定位
**Source:** `PptAdapter.ts:1615-1665`（`addShape`）+ `:1735-1755`（`addImageShape`）。
**Apply to:** PPT-09 表格 + PPT-10 线条。裸建 → sync → reload 集合 → set-diff 取稳定 proxy；**绝不碰 add-return proxy 的 id/属性**（真机网页版 InvalidParam getItem(id)）。同 run 填值崩 → 拆独立 `PowerPoint.run`（`addImageShape` 两次 run 范式）。

### isSetSupported 运行时门控 + 容错
**Source:** `PptAdapter.ts:2592-2598`（`setSlideBackground`，容错 `typeof Office !== 'undefined'`）。
**Apply to:** PPT-09（`'1.8'`）/ PPT-10（`'1.4'`）。不支持 → 走已锁降级路径（PPT-09→网格 fallback / PPT-10→诚实拒绝）。PPT-11 无 API 可门控，直接纯色。

### HostApiError 字面量错误包装（不泄漏 err.message）
**Source:** `PptAdapter.ts:1007-1010`（`catch (err) { if (err instanceof HostApiError) throw err; throw new HostApiError('PPT xxx 失败', err); }`）。
**Apply to:** 三方法全部闭包外层 catch（RESEARCH Security Domain T-16-05：错误用字面量，不 interpolate err.message 防 Key 泄漏）。

### PPT_TOOLS casing 归一化
**Source:** `tools/index.ts:34-51`（Set）+ `:215-218`（dispatch）。
**Apply to:** 3 个新工具名必入 Set，否则 camelCase 参数静默丢参 no-op（memory `project_ppt_officejs_gotchas`）。

### 诚实降级文案（精确量化）
**Source:** `ppt.ts:88-92`（`notEffectiveResult` message）+ `setShapeTextAlignmentTool:471-473`（noop_inverse reason 文案）。
**Apply to:** PPT-11 纯色告知 / PPT-10 箭头告知，data 含量化文案（memory `precision_over_brevity`；ROADMAP SC#4）。

---

## NFR-12 bundle 收口（技术验收）

**真相源勘误（RESEARCH）：** CONTEXT 通篇「≤82KB / 余 0.7KB」**已过时**。当前 gate = **100KB**（`.size-limit.json` `limit:"100 KB"` gzip），实测基线 **82.47KB / 余 17.53KB**（已含 Phase 26+27+28 全部代码）。
**落点：** PptAdapter 经 `createAdapter` 动态 import 懒加载（adapter 新方法不进 main）；3 ToolDef 进 main（增量 ~1.5-2.5KB gzip）→ 收口后 ~84-85KB，远低于 100KB。**无需懒加载改造。**
**守则：** 先 `npm run build` 再 `npm run size`（memory `project_bundle_size_guard`，陈旧 dist 假绿）。phase gate acceptance_criteria 必含此两步顺序。

---

## No Analog Found

无。本 phase 所有改动文件均在 codebase 内有 exact / role-match 既有 analog（同文件既有方法或 Phase 23/28 最近同类流程）。三工具新 adapter 方法是既有 `addShape` / `setShapeProperty` 范式的直接复刻，非新模式。

---

## Metadata

**Analog search scope:** `src/adapters/PptAdapter.ts`、`src/agent/tools/write/ppt.ts`、`src/agent/tools/index.ts`、`src/agent/operationLog.ts`、`src/agent/contract.test.ts`、`src/agent/operationLog.integration.test.ts`、`src/agent/design/ppt-tokens.ts`、`node_modules/@types/office-js/index.d.ts`（签名核实）
**Files scanned:** 8
**Pattern extraction date:** 2026-06-06
