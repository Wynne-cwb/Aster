# Phase 29: PPT 工具补全 + NFR-12 收口 - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** 用户主导 discuss（team-lead 派发 discuss TeamMate）。两项真·产品取向已由用户拍板（PPT-09 / PPT-11 降级方向），其余为可研究技术事实，记录留给 plan-phase，不再问用户。

<domain>
## Phase Boundary

给 **PPT 宿主补 3 个高价值 write 工具**，让 agent 能在幻灯片做三类高频版面操作：**插入表格（PPT-09）/ 线条·箭头连接符（PPT-10）/ 形状渐变填充（PPT-11）**。三者**均带 Office for Web API 可用性风险**——plan-phase 必先验网页版可用性，**不可用即诚实降级（行为已锁，见 §Decisions）**。作为 v2.4 末位实现 phase，**承接 NFR-12bundle gate ≤82KB gzip 全里程碑收口**（技术验收，非灰区）。

**全部遵循既有 write 工具合约（HARD CONSTRAINT，非灰区）：**
- 工具参数 **snake_case**；新工具名入 `PPT_TOOLS` Set（`src/agent/tools/index.ts`）触发 dispatch 层 `normalizeToSnakeCase` casing 归一化；adapter 内部对易错键做 snake/camel 双键容错。
- inverse / read / snapshot 方法签名一律 `(args: Record<string, unknown>)`（非位置参，Phase 5 翻车点）。
- 新增 `PostStateSnapshot.kind`（operationLog.ts union）；中文 `humanLabel`。
- 过 `operationLog.integration.test.ts` 守门（真 `PptAdapter` 实例 + mock 宿主，非 mock adapter）。
- 入 `contract.test.ts` 的 `CONTRACT[]` 数组（CI 真相源，Phase 23 `apply_slide_layout` 已示范新工具入册流程）。
- 网页版写操作可能**静默 no-op** → 写后回读验证（shape count / fill 读回），读不到当场降级。

**In scope（PPT-09 + PPT-10 + PPT-11 + NFR-12）:**
- **PPT-09** `insert_table`（命名待 plan 定，建议 snake_case）：插入表格。原生可用宿主用原生建表对象；**网页版不支持原生建表 → 形状网格模拟**（用户拍板，D-29-01）。可撤销。
- **PPT-10** `add_line`（建议名）：`ShapeCollection.addLine`（PowerPointApi 1.4）添加线条/箭头连接符。网页版可用即插入并可撤销；**不可用 → 诚实拒绝**（无合理模拟路径，自决，D-29-03）。
- **PPT-11** `set_shape_gradient`（建议名）：给形状设渐变填充。原生支持渐变即设渐变；**网页版只支持 setSolidColor / 不支持渐变 → 降级为纯色**（取渐变首色/主色 + 明确告知，用户拍板，D-29-02）。可撤销。
- **NFR-12**：全里程碑（Phase 26 配置导入导出 + Phase 27 Word + Phase 28 Excel + 本 phase PPT）代码就位后，`npm run build && npm run size` → `main-*.js` ≤82KB gzip。baseline 81.3KB，**余量仅 ~0.7KB——极紧**；动 bundle 前先 build 再 size（陈旧 dist 假绿）。

**Out of scope（本 phase 不碰）:**
- ❌ Word / Excel 工具（Phase 27 / 28 已交付，不回头改）。
- ❌ WPS 适配（Phase 25 spike，独立线）。
- ❌ PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色主题色（平台天花板，永久 Out of Scope，REQUIREMENTS §Out of Scope）。
- ❌ 读文档实际渐变/填充做"和谐护栏"（web fill 读不稳，沿用 Phase 22 D-22-05 诚实降级姿态）。

**Requirements covered (4):** PPT-09, PPT-10, PPT-11, NFR-12

**工程性质:** PptAdapter 新增 3 写方法 + 对应 inverse；ppt.ts 新增 3 ToolDef；operationLog 扩 kind/接口/executeReverse case；contract.test.ts 加 3 行 + integration.test 加守门；末位 bundle 收口。**0 净新增运行时依赖目标**（三工具纯 Office.js 调用，无新解析库/SDK）。
</domain>

<decisions>
## Implementation Decisions

### 人类已拍板（用户主导 discuss，AskUserQuestion 2026-06-05）

#### D-29-01 PPT-09 表格降级 = **形状网格模拟**（用户拍板，LOCKED）
- **决策**：plan-phase 验证后若 Office for Web **不支持原生建表对象**（无可用 table-creation API），表格工具**用多个文本框/形状拼成表格外观插入**——给用户一个看得见的「类表格」结果，而非明确拒绝。
- **后果（用户已知接受）**：① 模拟产物**不是可编辑的真实 PPT 表格对象**（用户后续无法用 PPT 原生表格工具改它）；② 实现成本更高（要排 N×M 文本框 + 边框 + 复合 undo）；③ undo 是**复合操作**（删除全部创建的形状）——见 D-29-06。
- **原生优先**：原生建表可用的宿主（桌面版 / 若网页版某 API 实测可用）**仍用原生表格对象**；模拟仅作网页版 fallback。
- **plan-phase 须定**：模拟网格的单元格尺寸/字号/边框可复用 Phase 22 `ppt-tokens.ts`（`MARGINS_PT`/`FONT_LADDER_PT`/`GAP_PT`）与 `gridFull` 思路；复合 undo 可参照 Phase 23 `apply_slide_layout`（create 多形状 → reverse 删整体）范式。

#### D-29-02 PPT-11 渐变降级 = **降级为纯色**（用户拍板，LOCKED）
- **决策**：plan-phase 验证后若网页版 `ShapeFill` **不支持渐变、只支持 `setSolidColor`**，渐变工具**取渐变首色/主色用 setSolidColor 填充 + 明确告知**「平台不支持渐变，已用纯色 X 代替」——给部分价值，而非拒绝。
- **诚实边界**：降级后**必须明确告知用户是纯色代替**（不可静默假装成功上了渐变）——这是"诚实降级"非"伪造"的关键。
- **已知重叠（接受）**：纯色填充已可经现有 `set_shape_property`（`fill_color` → setSolidColor）实现；渐变工具降级路径与之功能重叠，属可接受的 graceful degradation。
- **原生优先**：原生支持渐变的宿主仍上真渐变。

#### D-29-03 PPT-10 线条/箭头降级 = **诚实拒绝**（Claude 自决，无产品取向）
- **理由**：`ShapeCollection.addLine` 是原子操作，**无合理的"模拟线条/箭头"路径**（用细矩形冒充线条观感差、箭头无法干净模拟）——REQUIREMENTS PPT-10 原文也**未**枚举模拟选项（只说"诚实降级"）。故网页版若不支持 addLine → 工具诚实返回「当前平台不支持添加线条/箭头」，不伪造、不拼凑。**此项无需问用户**（与 PPT-09/11 的"模拟/纯色 vs 拒绝"并列开放不同，PPT-10 只有一条诚实路径）。

### 可研究/可自决技术事实（不问用户，plan-phase 执行）

#### D-29-04 三工具 API 可用性 = **plan-phase 必验（researchable，运行时门控降级是安全网）**
- 三工具均标 ⚠️API 风险。具体前验点见 §Researchable Facts。**镜像 Phase 10 D-10/D-11 范式**：spike 不前置阻塞规划/执行——实现里做运行时 `Office.context.requirements.isSetSupported('PowerPointApi', 'x.y')` 门控 + try/catch 写后回读，**不支持/读不到就当场走已锁降级路径**（PPT-09→网格、PPT-10→拒绝、PPT-11→纯色）。降级路径本身就是安全网，**无需等 API 验证通过才动工**。
- Claude **自跑不了真机 Office for Web**（memory `feedback_self_run_spikes`）→ API 可用性最终 verdict 由真机 UAT 给出（见 §UAT 种子）；plan/execute 阶段先把"原生 happy-path + 运行时降级"两条路都实现到位。

#### D-29-05 合约接线 = **逐字对齐 contract.test.ts CI 真相源（HARD，不软化）**
- **`src/agent/contract.test.ts` 的 `CONTRACT[]` 数组是 CI 守门真相源**（注释明示「合约维护为 JS 常量」）。新增 3 行（`phase: 29`），**须扩 `PhaseNum` 联合类型加 `29`**（当前 `9|10|11|23`），**长度断言 `≥24` 须上调**（建议 `≥27`，3 个新工具）。Phase 23 `apply_slide_layout` 已示范这一全流程（扩 PhaseNum→23 + 加行 + integrationTest:true）。
- **D-17 硬卡**：`contract.test.ts` L118-141 `fs.readFileSync` 断言每个 `integrationTest:true` 工具的 `toolName` 字符串必出现在 `operationLog.integration.test.ts` 文件内——3 个新工具名都要在 integration.test 里有守门用例，否则 CI 直接挂。
- **`noop+gate` 工具 reverseTool 必须是 `noop_inverse`**（L91-95 断言）——本 phase 三工具均**可撤销（简单逆向）**，不走 noop+gate（除非某降级路径决定不可撤，plan 定）。
- CONTRACT.md（`.planning/phases/08-foundation-a-f/CONTRACT.md`）若仍被引用可同步加 3 行，但**CI 真相源是 contract.test.ts**（v2.2/v2.3 部分新工具如 generate_ppt_image 未入 CONTRACT.md，证明它非 CI 卡点）。

#### D-29-06 undo 设计（per-tool，简单逆向优先）
- **PPT-10 add_line**：线条是 shape → 正向捕获新 shape id → reverse 复用 `delete_shape_by_id` 范式（已存在，PptAdapter `deleteShapeById` + executeReverse case）。**可能零新 reverse 工具**。
- **PPT-11 渐变（及纯色降级）**：写前读 before-image（当前 fill）→ reverse 复用 `restore_shape_property` 范式（已存在 fill_type/fill_color 还原），或视渐变状态读回能力新增 `restore_shape_gradient`（plan 定；web fill 读回不稳 → 读不到 before-image 走 noop+gate 降级，镜像 Phase 10 D-11）。
- **PPT-09 表格**：① 原生表格对象 → 捕获新 shape id → `delete_shape_by_id`。② **形状网格模拟（复合）→ 捕获全部创建的 shape id 列表 → reverse 删除全部**（新 reverse 如 `delete_shapes_by_ids` 或先组合 group 再 `delete_shape_by_id`，plan 定；参照 Phase 23 apply_slide_layout 的 create→delete_slide_by_index 整体删除思路，但表格通常是当前 slide 上的局部形状群，删 slide 不合适 → 倾向"删多 shape"）。
- **新 PostStateSnapshot.kind**（operationLog.ts union 扩，如 `ppt_table` / `ppt_line` / `ppt_shape_gradient`，命名 plan 定）：`readTargetState` 对新 kind **返 `undefined`（保守视为一致）**——不盲加 read 比对（memory `project_adapter_inverse_signature`，盲加会误判全部手改）。

#### D-29-07 网页版静默 no-op 防御 = **写后回读验证**（memory `project_ppt_officejs_gotchas`）
- 三工具正向写后**必须回读验证生效**：addLine 后回读 shape count 增加；渐变/纯色后回读 fill（读不到则诚实降级，不假成功）；表格/网格后回读 shape 存在。读回失败 → 当场降级（拒绝 / 纯色 / 标记不可撤），不静默假成功。

#### D-29-08 NFR-12 bundle 收口策略（技术验收）
- **收口动作**：全 v2.4 功能代码就位（Phase 26+27+28+29）后跑 `npm run build && npm run size`，断言 `main-*.js` ≤82KB gzip。
- **落点**：三工具是 agent write 工具，PptAdapter 经 `createAdapter` 动态 import 懒加载（已验，`adapters/index.ts`）→ adapter 新方法落懒加载 chunk；ToolDef 在 agent 路径。plan 须**确认新增代码是否进初始 main chunk**，进了且超预算就懒加载。
- **累积风险**：余量仅 0.7KB，且本 phase 收口**叠加 Phase 26 配置导入导出 UI**（Settings 面板，最可能进初始 bundle 的增量）→ 收口须看**全里程碑累积值**，非仅 PPT 工具增量。若超 → 优先把配置导入导出的非热路径（JSON 解析/校验/下载逻辑）懒加载。
- **守则**：动 bundle 前先 build 再 size（memory `project_bundle_size_guard`，陈旧 dist 假绿）；质量 >> 包体积，但 bundle gate 仍硬守（memory `project_quality_over_cost`）。

### Claude's Discretion（planner/researcher 可定）
- 3 工具的**最终工具名**（建议 snake_case：`insert_table` / `add_line` / `set_shape_gradient`，须与既有命名风格一致且不撞 Word `insert_table`——注意 Word 已有 `insert_table`，**PPT 表格工具须用不撞名的 name**，如 `insert_ppt_table` 或 `add_table`，plan 定并对齐 host 隔离）。
- 表格工具参数结构（rows/cols/data 二维数组 / 表头）+ 网格模拟的单元格几何算法（复用 ppt-tokens）。
- add_line 参数（起止坐标 / 箭头头样式枚举 / 连接两形状 vs 自由坐标）。
- 渐变参数结构（线性/径向、stops 色标数组）+ 纯色降级取色逻辑（首色 vs 主色）。
- 新 reverse 工具名 + 新 PostStateSnapshot.kind 命名。
- 3 工具 humanLabel 中文文案 + 参数 description（≤50 字软目标）+ 降级告知文案（精确量化，memory `precision_over_brevity`）。
- 运行时 `isSetSupported` 的具体 PowerPointApi 版本号（PPT-10 标 1.4；表格/渐变 plan 查实际所需版本）。
- 是否新增 reverse 工具 vs 复用 `delete_shape_by_id`/`restore_shape_property`（D-29-06）。
- wave/plan 切分（建议：undo 基础设施骨架 → 3 工具各一 plan 或合并，参照 Phase 10 wave 范式）。

### Folded Todos
无折叠（无匹配 todo）。
</decisions>

<researchable_facts>
## Researchable Facts —— plan-phase 必验清单（API 前验点 + bundle 收口点）

> 这些是**技术事实**（非人类决策），由 research/plan 阶段查文档 + 设计运行时门控解决，UAT 真机定最终 verdict。

### 三工具 Office for Web API 可用性前验（⚠️必验）
1. **PPT-09 原生建表**：Office.js PowerPoint API 是否在 **Office for Web** 提供 table-creation API（如 `Slide.shapes.addTable` 或等价）？Phase 10 deferred `insert_table_ppt`（spike S3）当时记「PowerPointApi 1.8 Web 支持待验」。→ 查 PowerPointApi requirement set 表格能力 + 实际 web 可用性。**不可用 → 形状网格模拟（D-29-01）**。
2. **PPT-10 `ShapeCollection.addLine`（PowerPointApi 1.4）**：`isSetSupported('PowerPointApi','1.4')` 在 Office for Web 是否 true？addLine 是否实际生效（写后回读 shape count）？→ **不可用 → 诚实拒绝（D-29-03）**。
3. **PPT-11 `ShapeFill` 渐变**：Office.js PPT `ShapeFill` 是否暴露渐变设置 API（还是只有 `setSolidColor`）？web 上是否真生效？→ **不支持 → 降级纯色（D-29-02）**。
4. **运行时门控范式**：`Office.context.requirements.isSetSupported('PowerPointApi','x.y')` + try/catch 写后回读 → 读不到当场降级（镜像 Phase 10 D-10/D-11，运行时门控是安全网，不阻塞）。
5. **before-image 读回稳定性**：渐变/填充 before-image 在 web 是否读得回（PPT web `fill` 读不稳，Phase 10 spike S2 / memory `project_ppt_officejs_gotchas`）→ 读不到 → 该步降级 noop+gate（不可自动撤销，warn 不中断）。

### NFR-12 bundle 收口点
6. **新代码落点**：3 个 PPT ToolDef + PptAdapter 新方法是否进初始 `main-*.js`？（adapter 经 `createAdapter` 动态 import 懒加载已验；确认 ToolDef/agent 路径是否懒加载。）
7. **全里程碑累积**：Phase 26 配置导入导出 UI（Settings 面板）对初始 bundle 的增量是收口最大变量——收口须 `npm run build` 后看 `main-*.js` 实测 gzip 累积值（baseline 81.3KB，gate 82KB，余 0.7KB）。
8. **降级手段**：若超预算，优先懒加载配置导入导出的非热路径（JSON 校验/序列化/文件下载）+ 任何重模块；PPT 工具本身应 0 净新增（纯 Office.js 调用）。
</researchable_facts>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 源码（直接改 / 范式真相源）
- `src/adapters/PptAdapter.ts`（~3100 行，**核心改动文件**）— `PowerPoint.run` 闭包范式（proxy 不出闭包，错误包 `HostApiError`）；`getSelectedSlides()` 按 `.index` 排序（#3618）；既有 before-image+inverse 范式（`setShapeProperty`/`restoreShapeProperty` L889/L1033、`setShapeText`/`restoreShapeText`、`moveShape`/`restoreShapeGeometry`）；`deleteSlideByTitle`/`deleteShapeById` 定位范式；`TEXT_SHAPE_TYPES` 守卫、`addTextBox` #2775 deselect 用法。新增 3 写方法 + inverse（签名一律 Record）。
- `src/agent/tools/write/ppt.ts`（~800 行）— ToolDef 范式（snake_case args 解构 + `reverse: ReverseDescriptor` 字面量 Record args + `postState: PostStateSnapshot` + 中文 humanLabel + 写后回读）。直接参照 `set_shape_property`（L141）/ `add_shape`（L369）/ `apply_slide_layout`（L726，复合 create 范式）。新增 3 ToolDef。
- `src/agent/tools/index.ts` — `PPT_TOOLS` Set（L34-51，**加 3 个新工具名**触发 casing 归一化）；`normalizeToSnakeCase`（L55-62）；dispatch 归一化（L214-217）；`buildToolsForHost('ppt')` 注册新工具（host 隔离保证 PPT 工具不与 Word/Excel 互见）。
- `src/agent/operationLog.ts`（~617 行）— `PostStateSnapshot.kind` union（L34-50，**按需加 ppt_table/ppt_line/ppt_shape_gradient 等**）；`DocumentAdapterForReplay` 接口（L102-171，**加新 inverse 方法声明**，签名 `Record<string,unknown>`，L1020 注释明示非位置参）；`executeReverse` switch（L329-544，**加新 case，case 字符串 = reverse 工具名逐字**；`noop_inverse`/`delete_shape_by_id`/`restore_shape_property` 已存在可复用）；`readTargetState` 新 kind 保守返 undefined（D-29-06）。
- `src/agent/contract.test.ts`（**CI 守门真相源**，L33-64 CONTRACT 数组）— 加 3 行 `phase:29`；**扩 `PhaseNum` 加 `29`**（L18）；**长度断言 L145 `≥24`→建议 `≥27`**；D-17 `fs.readFileSync` 硬卡（L118-141）。Phase 23 `apply_slide_layout`（L63）= 新工具入册范式。
- `src/agent/operationLog.integration.test.ts` — **守门测试范式：真 `PptAdapter` 实例 + mock 宿主 + `replayUndoSingle` 断言 `rolled_back` 且 adapter 收 Record 对象**（非 mock adapter——抓不到 Record 签名错配）。3 个新工具各加一条；若某降级走 noop+gate 加「→ skipped_error」断言。
- `.size-limit.json` — gate 配置（`dist/assets/main-*.js` ≤82KB gzip）。`package.json`：`build`=`lingui compile --typescript && vite build`、`size`=`size-limit`、`test`=`tsc --noEmit && vitest run`。
- `src/adapters/index.ts` — `createAdapter` 动态 import 懒加载范式（PptAdapter 懒加载已验，NFR-12 收口参照）。

### Phase 范式（规划必读）
- `.planning/phases/10-excel-ppt-b-excel-b-ppt/10-CONTEXT.md` — **PPT write 工具 + undo 三分类 + spike 运行时门控降级（D-10/D-11）+ noop+gate（D-13）+ D-17 守门四步范式**的直接来源；Deferred 段已记 `add_line`(PPT-D1)/`insert_table_ppt`(PPT-D2/spike S3)/`set_shape_fill_advanced` 渐变(PPT-D1) → 本 phase 正是它们的兑现。
- `.planning/phases/22-ppt-design-tokens-geometry-check/22-CONTEXT.md` — `ppt-tokens.ts`（`DEFAULT_CANVAS_PT 960×540`、`MARGINS_PT`、`FONT_LADDER_PT`、`GAP_PT`、`gridFull`/`gridTwoColumn` 纯函数）+ `geometry-check.ts` —— **PPT-09 形状网格模拟可复用这些结构 token 算单元格几何 + 用 check_slide_layout 自查网格不溢出/重叠**。
- Phase 23 `apply_slide_layout`（contract.test.ts L63 + ppt.ts L726）— **复合 create（一次建多形状）+ reverse 整体删除**范式 → PPT-09 网格模拟 undo 设计直接参照。

### REQUIREMENTS / ROADMAP
- `.planning/REQUIREMENTS.md` PPT-09/10/11（三者均 ⚠️plan-phase 必验网页版可用性 + 降级措辞）+ NFR-12（bundle ≤82KB，余 0.7KB）+ §Out of Scope（SmartArt/动画/转场/主题/读背景色永久不做）。
- `.planning/ROADMAP.md` §Phase 29（5 条 SC，含「成功标准允许部分工具诚实降级——只要降级行为诚实」）+ Depends on 26/27/28（NFR-12 收口需全功能代码就位）。

### 项目记忆（约束）
- `project_adapter_inverse_signature` — inverse/read/snapshot 收 Record 对象；新 inverse 配 integration.test 守门用**真 PptAdapter 实例**；手改侦测 read 保守 undefined（D-29-05/06 依据）。
- `project_ppt_officejs_gotchas` — snake/camel 不一致静默失败（入 PPT_TOOLS + 双键容错）；web 写操作静默 no-op → 写后回读验证（D-29-07 依据）。
- `project_bundle_size_guard` — 先 build 再 size（陈旧 dist 假绿）；非热路径懒加载（D-29-08 依据）。
- `feedback_self_run_spikes` — Claude 自跑不了真机 Office for Web；API 可用性列 UAT，运行时降级是安全网（D-29-04 依据）。
- `feedback_recurring_failure_add_gate` — 结构性守门（contract.test + integration.test + 写后回读）。
- `project_quality_over_cost` — 质量 >> 包体积，但 undo 守门硬卡 + bundle gate 仍守。
- `precision_over_brevity` — 降级告知/违规文案精确量化（不为简短牺牲信息）。
- `image_insert_autonomous` — 新建形状返回 shape_id 让 AI 自主排版（add_line/表格新形状同此）。
- `i18n_extract_and_test_noise` — ROADMAP 标本 phase「UI hint: yes」：若触及任何 Lingui 宏（结果卡/标签 UI）须跑 `npm run extract`；「N failed」才是真失败（尾部 3 retry errors 是噪音）。**plan 须确认是否有 UI surface 改动**。
</canonical_refs>

<specifics>
## Specific Ideas

ROADMAP Phase 29 五条成功标准（反推 must_haves，planner 须逐条覆盖）：
1. **PPT-09**：plan 已验网页版表格支持；可用→插原生表格；不可用→**形状网格模拟**（D-29-01），不假装。可撤销。
2. **PPT-10**：plan 已验 `addLine` 网页版可用性；可用→加线条/箭头并可撤销；不可用→**诚实拒绝**（D-29-03）。
3. **PPT-11**：plan 已验 `ShapeFill` 渐变；可用→设渐变；不支持→**降级纯色 + 明确告知**（D-29-02）。可撤销。
4. 三工具过 `operationLog.integration.test` 守门（或记录诚实降级理由）；**允许"部分工具诚实降级"为成功**——只要降级诚实（明确错误 / 网格看得见 / 纯色+告知，不静默假成功）。
5. **NFR-12**：全 v2.4 代码（配置导入导出 + Word/Excel/PPT 工具补全）整体 build 后 `main-*.js` ≤82KB gzip（余 0.7KB，必要时懒加载）；先 build 再 size。

## UAT 种子（真机 Office for Web 三宿主，PPT 聚焦；API verdict 由真机定）
- **U-1 PPT-09 表格**：「在当前幻灯片插入 3×4 表格，填入季度数据」→ 原生可用宿主插真实表格；网页版降级**形状网格**（看得见的表格外观）；undo 后表格/网格整体消失。
- **U-2 PPT-10 线条/箭头**：「在两个形状间加一条带箭头的连接线」→ 网页版验 addLine 是否真生效（写后回读 shape count）；可用→插入 + undo 删除；不可用→**诚实拒绝**（明确消息，agent 不假装成功、换思路）。
- **U-3 PPT-11 渐变**：「给标题形状设 teal→深色渐变背景」→ 原生支持宿主上真渐变；网页版**降级纯色**（取首色）+ 明确告知「平台不支持渐变，已用纯色 X」；undo 还原原填充。
- **U-4 降级诚实性**：三工具在不支持平台**均不假装成功**（拒绝有明确消息 / 网格看得见 / 纯色有告知）；DiffLog 卡片显示正确；不可撤的降级显示「此步无法自动撤销」warn 不中断。
- **U-5 bundle gate**：全里程碑代码就位后本机 `npm run build && npm run size` → `main-*.js` gzip ≤82KB（绿）。

## Verification commands
- `npx tsc --noEmit`
- `npm test -- --run`（全套 green，含 contract.test 3 新行 + integration.test 3 新守门；「N failed」才是真失败）
- `npm run build && npm run size`（**先 build 再 size**；`main-*.js` gzip ≤82KB，全里程碑累积收口）
- 若触及 Lingui 宏 → `npm run extract`（plan 确认是否有 UI 改动）

## Risks
- **R-1 网页版静默 no-op**（PPT web 写常见）→ 全部写后回读验证，读不到当场降级（D-29-07）。
- **R-2 snake/camel 参数不一致静默失败** → 新工具 snake_case + 入 PPT_TOOLS 归一化 + 内部双键容错（D-29-05）。
- **R-3 bundle 余量仅 0.7KB + 叠加 Phase 26 配置 UI** → 累积收口最大风险；新代码懒加载、先 build 再 size（D-29-08）。
- **R-4 形状网格模拟 undo 是复合操作**（多 shape）→ 捕获全部 shape id 整体删除；inverse 复杂度上升（D-29-06）。
- **R-5 API 可用性需真机 verdict**（Claude 跑不了）→ 运行时门控降级是安全网，不阻塞 plan/execute；真机 UAT 定 verdict（D-29-04）。
- **R-6 PPT 表格工具名与 Word `insert_table` 撞名** → host 隔离 + 用不撞的工具名（如 `insert_ppt_table`/`add_table`），plan 定（Claude's Discretion）。
</specifics>

<deferred>
## Deferred Ideas
- **PPT 表格高保真编辑 / 真实表格对象在网页版**（若未来 PowerPointApi 出 web 建表 GA）→ 届时把 D-29-01 网格模拟升级为原生；本 phase 网格是 web fallback。
- **渐变高级控制**（多 stops、径向/角度精调）→ 本 phase 先做基础线性渐变 + 纯色降级；高级渐变按需。
- **读文档实际渐变/填充做和谐护栏** → 沿用 Phase 22 D-22-05 诚实降级（web fill 读不稳），不读实际 fill。
- **PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色** → 永久 Out of Scope（平台天花板）。
</deferred>

---

*Phase: 29-ppt-tools-nfr12*
*Context gathered: 2026-06-05 — 用户主导 discuss（discuss TeamMate）。2 项产品取向用户拍板（PPT-09 形状网格模拟 / PPT-11 降级纯色），PPT-10 诚实拒绝自决，其余技术事实留 plan-phase。*
