# Phase 5: Diff Log + Undo All 跨 3 宿主 - Research

**Researched:** 2026-05-29
**Domain:** Office.js inverse op 模型 + OperationLog replay engine + DiffLogPanel UI + TS/lint enforce
**Confidence:** HIGH（绝大多数基于已读代码直接验证 + SP-4/SP-5 真机 PASS 结论；仅少数比对规范化细节标 ASSUMED）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**DiffLogPanel 形态**
- D-01: 聊天流末尾追加可展开「本次改动 N 处」汇总卡（非常驻底部面板，非抽屉），复用 role='tool' 折叠卡视觉
- D-02: 汇总卡只在 run 完成后出现；进行中靠现有 live role='tool' 卡
- D-03: 汇总卡只列写操作（有 reverse descriptor 的步）；读操作不进汇总卡
- D-04: 展开后每步一行：humanLabel + 「撤销该步」按钮；底部「撤销本次所有操作」secondary 灰按钮 + 二次确认

**撤销粒度与顺序**
- D-05: 单步「撤销该步」= 任意步独立可撤（不限 LIFO）；每个 write tool reverse 必须「精确定位」目标，不是「最后一个」
  - Word append_paragraph 现有 reverse {tool:'delete_last_paragraph'} 必须改为精确定位
  - Excel set_range_values reverse = before-image 覆写（天然任意顺序）
  - PPT insert_slide reverse = 删指定 slide（按记录时的 index/id 定位，不依赖 getSelectedSlides 顺序）
- D-06: 对 index 漂移鲁棒，倾向内容指纹/稳定对象 id 而非纯数值 index
- D-07: undo all = 当前 runId 的 OperationLog 逆序 replay
- D-08: 多轮 run 旧卡保留，各自 undo all 只负责自己那一轮

**手动改防御**
- D-09: 回放前 adapter.read() 抓当前 state，「只比目标对象内容」，周边变化容忍
- D-10: 不一致 → 跳过该步，标「未回滚（你已手动修改）」
- D-11: reverse 操作自身报错 → 跳过标红，继续撤剩下（最大努力回滚，不遇错即停）
- D-12: undo all 结束明确总结「已回滚 X 步，跳过 Y 步（手动改），Z 步未能回滚（宿主报错）」

**存储兜底范围（SC5/SC7 已调整）**
- D-13: 原 SC5 sessionStorage 刷新恢复整条移除。OperationLog + DiffLogPanel = 纯内存，刷新即丢。不做 sessionStorage 同步/mount-check/对话框
- D-14: SC7 localStorage quota guard 瘦身：只给 storage.ts setItem 加 try/catch + 超配额抛 AsterError 业务异常。不做 80% LRU 清除

**TS/lint 强制**
- D-15: 本 phase flip 开 humanLabel + reverse 的 TS/lint 强制（Phase 3 D-13 埋的 eslint rule 正式 enforce）
- D-16: OperationLog 重构为 Map<runId, entries[]>（Phase 3 注释已建议）

**inverse op 真实回放**
- D-17: 三宿主各验 1 个 write tool 的 inverse 闭环 PoC
- D-18: inverse 一律走 Office.js API path（SP-4/SP-5 PASS），禁 snapshot fallback，禁 Office.js native undo

**CARRY-03 copy step log**
- D-19: 全量三角色（user/assistant/tool）+ tool name + humanLabel + result
- D-20: 默认 Markdown 格式；JSON 为备选
- D-21: 自动脱敏 API Key / Provider id，URL 保留
- D-22: 主界面 + Settings 双入口

### Claude's Discretion

- OperationLog Map<runId> 重构的具体数据结构 / Zustand selectors
- 每宿主稳定目标定位的具体手段（内容指纹 vs 对象 id）
- 汇总卡视觉细节（teal token / 间距 / 折叠交互）—— 走 aster-design-system skill
- copy step log 的 Markdown 模板 + JSON 切换 UI
- undo all 二次确认对话框文案
- humanLabel/reverse eslint rule enforce 的具体写法

### Deferred Ideas (OUT OF SCOPE)

- SC5 sessionStorage F5 恢复（D-13 已移除，归 v2.1+）
- 全套 PPT/Excel/Word write tools（Phase 6）
- Killer scenario empty-state chip / Ribbon 降级（Phase 6）
- getSelectedSlides 多 slide 反向排序真机验证（用自有 OperationLog 逆序绕过）
- Resume from checkpoint（FUT-03）
- Per-action consent（FUT-04，永不做）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-07 | DiffLogPanel 展示 N 步卡片，每条用 humanLabel 中文人话 | D-01..04；复用 ChatStream role='tool' 折叠卡视觉；run 完成后 agentStore.endRun 时触发渲染 |
| AGENT-09 | DiffLogPanel per-step 撤销 + 整体「撤销本次所有操作」二次确认 | D-05..08；replay engine + 比对逻辑；逆序 Map entries |
| AGENT-10 | Undo all = OperationLog 逆序 replay reverse descriptor；禁 Office.js native undo | D-18；三宿主 API path 已 SP-4/SP-5 验证 |
| AGENT-11 | Undo all 前 adapter.read() 比对 post-state；不一致跳过提示 | D-09..12；比对规范化防 false-skip |
| TOOL-03 (PoC) | Word append_paragraph / PPT insert_slide / Excel set_range_values 各 1 个 write tool inverse 闭环真机验证 | D-17；三宿主精确定位路径见 §Architecture Patterns |
| TOOL-04 | 每个 write tool 必须返 reverse: InverseDescriptor；TS 强制 | D-15；eslint rule flip + ToolResult.reverse 已在类型层；缺 reverse 不让注册 |
| CARRY-03 | copy step log schema-aware（三角色 + 脱敏）主界面 + Settings 双入口 | D-19..22；chatStore.messages + operationLog 联合 dump；navigator.clipboard.writeText |
| NFR-05 | CI bundle-size gate 维持 ≤82KB gzip | DiffLogPanel + undo 逻辑进主 chunk；无新运行时依赖；vitest 单元测试无体积代价 |
</phase_requirements>

---

## Summary

Phase 5 的核心工程挑战是把 Phase 3 埋的 OperationLog 骨架（全局数组 + ReverseDescriptor 类型）升级为真实可回放的 replay engine，并在三宿主各验证 1 个 write tool 的 inverse 闭环 PoC。

技术基础极其扎实：SP-4 真机验证了 Word `paragraph.delete()` / Excel `range.values` before-image 覆写 / PPT slides 读取全部可达；SP-5 验证了 PPT `slide.delete()` 在 Web 端真删（3→2）。三宿主 inverse API path 无需 snapshot fallback。这意味着 Phase 5 没有架构层的不确定性——工作是「实现」而非「探索」。

关键工程点在三处：(1) Word 精确定位——现有 reverse `delete_last_paragraph` 必须改为按内容指纹定位目标段；(2) 比对规范化——防止 Office.js 格式归一化（换行符/尾部空白）触发 false-skip；(3) OperationLog 从全局数组重构为 `Map<runId, entries[]>` 并在 agentStore 中暴露 Zustand selector 供 DiffLogPanel 消费。

DiffLogPanel 是在 ChatStream 聊天流末尾追加的 run 完成后汇总卡，复用现有 `aster-tool-card` / `wb-action-head` CSS 类，teal token 体系已就位，UI 新增量极小。bundle 预算极紧（当前 80.54KB ≤ 82KB CI gate），DiffLogPanel + undo 逻辑进主 chunk 估算约 +3-5KB gzip，需要谨慎。

**Primary recommendation:** 按 Word → Excel → PPT 顺序实现三宿主 PoC，每宿主一个 plan，逆序 replay 引擎独立一个 plan，DiffLogPanel UI 独立一个 plan，storage quota guard + lint enforce + CARRY-03 copy step log 各一个 plan。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| OperationLog Map<runId> 数据结构 | `src/agent/operationLog.ts` | agentStore (selector) | 纯内存状态，agent 层管理，store 只持引用 |
| Replay engine / undo 逻辑 | `src/agent/operationLog.ts` + adapter | agentStore.undoStep/undoAll | 纯函数 replay，每步调 adapter 写方法 |
| inverse write 方法 | `src/adapters/{Word,Ppt,Excel}Adapter.ts` | — | A-06：proxy 不出 *.run 闭包，inverse 方法各自开闭 run |
| DiffLogPanel UI 渲染 | `src/components/DiffLogPanel.tsx` (new) | ChatStream.tsx (插入点) | run 完成后追加在聊天流末尾 |
| humanLabel/reverse TS enforce | `src/agent/tools/index.ts` ToolDef type + eslint rule | tools/write/*.ts | 编译期强制，不可绕过 |
| storage quota guard | `src/lib/storage.ts` storage.set() | AsterError 体系 | 薄包装，业务异常上报 |
| copy step log | `src/lib/copyStepLog.ts` (new) | ChatStream + Settings 入口 | 纯函数：messages[] + operationLog 联合 → Markdown/JSON 字符串 |
| 三宿主 PoC write tools | `src/agent/tools/write/{word,ppt,excel}.ts` | adapters | 本 phase 新增 3 个 write tool |

---

## Standard Stack

### Core（全部已存在，无新依赖）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19 | DiffLogPanel UI | 已有 [VERIFIED: codebase] |
| Zustand 5 | ^5.x | agentStore + undo action | 已有 [VERIFIED: codebase] |
| TypeScript strict | ^5.7 | 编译期 reverse 强制 | 已有 [VERIFIED: codebase] |
| Office.js CDN | lib/1 | Word/PPT/Excel inverse API | 已有 [VERIFIED: codebase] |
| Lingui | ^5.x | DiffLogPanel 中文字串 | 已有 [VERIFIED: codebase] |

### 无新运行时依赖（[VERIFIED: CONTEXT.md D-02 / NFR-02]）

所有 Phase 5 功能均用现有栈实现，不新增任何 npm 包。

**Installation:** 无

---

## Architecture Patterns

### System Architecture Diagram

```
[run 完成后]
agentStore.endRun()
        │
        ▼
operationLog.getWriteOpsByRun(runId)   ← Map<runId, OperationLogEntry[]>
        │ 过滤 kind='write'（有 reverse 的）
        ▼
DiffLogPanel 追加到 ChatStream 末尾
  ├── 汇总头「本次改动 N 处」（折叠）
  └── 展开后每步一行
        ├── humanLabel 人话
        └── 「撤销该步」按钮 / 「撤销本次所有」灰按钮

[用户点撤销]
        │
        ▼
agentStore.undoStep(runId, entryIndex) 或 undoAll(runId)
        │
        ├── 逆序遍历 entries（undoAll）
        │
        └── 每步：adapter.read(postStateQuery)   ← 比对前读
                    │
                    ├── normalize(current) vs normalize(entry.postState)
                    │   ├── 一致 → 执行 entry.reverse（adapter 对应 inverse 方法）
                    │   └── 不一致 → 标「未回滚（手动改）」跳过
                    │
                    └── reverse 执行报错 → 标「未能回滚（宿主报错）」继续
```

### Recommended Project Structure（新增 / 改动文件）

```
src/
├── agent/
│   ├── operationLog.ts       # 重构：全局数组 → Map<runId, entries[]> + replay engine
│   ├── agentStore.ts         # 扩展：undoStep / undoAll / setUndoResult action
│   ├── tools/
│   │   └── write/
│   │       ├── word.ts       # 改：append_paragraph reverse 改精确定位
│   │       ├── ppt.ts        # 新：insert_slide + inverse delete_slide
│   │       └── excel.ts      # 新：set_range_values + before-image inverse
├── adapters/
│   ├── WordAdapter.ts        # 新增：deleteParagraphByContent() inverse 方法
│   ├── PptAdapter.ts         # 新增：deleteSlideByIndex() inverse 方法
│   └── ExcelAdapter.ts       # 新增：setRangeValues() write + inverse 方法
├── components/
│   ├── DiffLogPanel.tsx      # 新：汇总卡 UI（追加在 ChatStream 末尾）
│   └── ChatStream.tsx        # 改：run 完成后末尾插入 DiffLogPanel
├── lib/
│   ├── storage.ts            # 改：storage.set() 加 try/catch quota guard
│   └── copyStepLog.ts        # 新：copy step log 纯函数（Markdown/JSON）
└── styles.css                # 改：DiffLogPanel 样式（复用现有 token）
```

---

## Pattern 1: OperationLog Map<runId> 重构

**What:** 从全局数组升级为 `Map<runId, OperationLogEntry[]>`，新增 `postState` 字段记录写操作后的目标对象快照（供比对用），新增 replay engine。

**When to use:** 所有 write tool 完成时 appendOperation；run 完成后 DiffLogPanel 取用；undo 时 replay。

```typescript
// src/agent/operationLog.ts（重构后骨架）
// [VERIFIED: Phase 3 operationLog.ts + CONTEXT.md D-16]

export interface ReverseDescriptor {
  tool: string;
  args: Record<string, unknown>;
}

/** postState = 操作完成后的目标对象内容快照（供比对检测手动改） */
export interface PostStateSnapshot {
  kind: 'word_paragraph' | 'excel_range' | 'ppt_slide';
  content: unknown;  // text string / values 2D array / slide title string
}

export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  postState: PostStateSnapshot;   // Phase 5 新增（Phase 3 骨架无此字段）
  timestamp: number;
}

// Map<runId, entries[]>（D-16）
const operationLogMap = new Map<string, OperationLogEntry[]>();

export function appendOperation(entry: OperationLogEntry): void {
  const list = operationLogMap.get(entry.runId) ?? [];
  list.push(entry);
  operationLogMap.set(entry.runId, list);
}

export function getWriteOpsByRun(runId: string): OperationLogEntry[] {
  return operationLogMap.get(runId) ?? [];
}

export function clearRun(runId: string): void {
  operationLogMap.delete(runId);
}

/** 仅测试用 */
export function __resetOperationLogForTest(): void {
  operationLogMap.clear();
}
```

**关键决策：postState 的内容粒度（Claude's Discretion 确认项）**

每宿主 postState 只记录「要反操作的那个目标本身」的内容，不记录整个文档快照（A-11 防止撑爆内存）：

| 宿主 | postState.content | 抓取时机 |
|------|-------------------|----------|
| Word append_paragraph | 新段落文本 `string`（= write tool 的 text 参数） | execute 返回后（已知，无需额外 read） |
| Excel set_range_values | `{ address: string; values: unknown[][] }` | before-image 覆写的 after-image = write 的 values 参数 |
| PPT insert_slide | `{ index: number; title: string }` | insert 后 read_slide 抓 title（或记录插入的 slideIndex） |

---

## Pattern 2: 三宿主精确定位 Inverse 路径

### Word: 精确删段（append_paragraph → delete by content fingerprint）

**问题：** 现有 reverse `{tool:'delete_last_paragraph'}` 在任意顺序撤销时不可靠——若后续又 append 了更多段落，`delete_last_paragraph` 会删错段落。

**解决方案：** 将 reverse descriptor 改为 `{tool:'delete_paragraph_by_content', args:{text}}`，用段落文本内容做指纹定位。比对时从尾到头 find 第一个 text 匹配的段落，然后 `paragraph.delete()`。

**index 漂移鲁棒性：** [VERIFIED: SP-4 findings.md] SP-4 验证了 `paragraph.delete()` 在 `Word.run` 闭包内可跨 await 安全使用。用文本内容定位（不依赖数值 index），天然对插删操作漂移免疫。唯一风险：重复文本段落。对于一次 agent run 内 append 的段落（LLM 生成内容通常不重复），此风险极低。

```typescript
// src/adapters/WordAdapter.ts — 新增 inverse 方法
// [VERIFIED: SP-4 findings.md — paragraph.delete() proxy 跨 await 安全]

async deleteParagraphByContent(text: string): Promise<void> {
  await Word.run(async (ctx) => {
    const paras = ctx.document.body.paragraphs;
    paras.load('items/text');
    await ctx.sync();

    // 从尾到头找第一个内容匹配的段落（倒序 = 优先撤最近追加的）
    const normalized = normalizeText(text);
    for (let i = paras.items.length - 1; i >= 0; i--) {
      if (normalizeText(paras.items[i].text) === normalized) {
        paras.items[i].delete();
        await ctx.sync();
        return;
      }
    }
    // 找不到：文档已手动改，上层比对逻辑会跳过此步
    throw new HostApiError('Word deleteParagraphByContent: 目标段落已不存在');
  });
}

/** 规范化：去尾部空白 + 统一换行（Office.js 可能注入 \r\n） */
function normalizeText(s: string): string {
  return s.replace(/\r\n/g, '\n').trimEnd();
}
```

**write tool reverse descriptor 更新：**

```typescript
// src/agent/tools/write/word.ts — execute() 中 reverse 字段改为：
const reverse: ReverseDescriptor = {
  tool: 'delete_paragraph_by_content',
  args: { text },   // 精确传入写入的文本
};
```

**比对逻辑（D-09 只比目标对象）：**

回放前调 `adapter.read({kind:'get_paragraph_count'})` 抓总数，再从尾到头找 postState.content 文本。若找不到（手动改/删）→ skip 标注。避免比整个文档（防 false-skip）。

---

### Excel: Before-image 覆写（set_range_values → overwrite with stored values）

**天然任意顺序：** Excel before-image 用 address + values 定位，address 不随插删变化（Excel cell 地址是稳定的），before-image 覆写是幂等操作。[VERIFIED: SP-4 findings.md — Excel range.load(['values','address']) + range.values = stored 真机 PASS]

```typescript
// src/adapters/ExcelAdapter.ts — 新增方法

/** write + 同时抓 before-image（供 inverse 用） */
async setRangeValues(address: string, values: unknown[][]): Promise<{
  beforeImage: { address: string; values: unknown[][] };
}> {
  return await Excel.run(async (ctx) => {
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    // sync 1: 先抓 before-image
    range.load(['values', 'address']);
    await ctx.sync();
    const beforeImage = { address: range.address, values: range.values as unknown[][] };
    // sync 2: 覆写
    range.values = values as (string | number | boolean)[][];
    await ctx.sync();
    return { beforeImage };
  });
}

/** inverse: 用 before-image 覆写（SP-4 模式） */
async overwriteRange(address: string, values: unknown[][]): Promise<void> {
  await Excel.run(async (ctx) => {
    const range = ctx.workbook.worksheets.getActiveWorksheet().getRange(address);
    range.values = values as (string | number | boolean)[][];
    await ctx.sync();
  });
}
```

**write tool + reverse descriptor：**

```typescript
// src/agent/tools/write/excel.ts — 新增 set_range_values write tool
export const setRangeValues: ToolDef<SetRangeValuesArgs> = {
  name: 'set_range_values',
  kind: 'write',
  // ...
  async execute({ address, values }, ctx): Promise<ToolResult> {
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeValues(address, values);
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values },
    };
    // postState = 写入后的 values（即 values 参数本身）
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { address, values },
    };
    return { ok: true, data: { address, rowCount: values.length }, reverse, postState };
  },
};
```

**比对逻辑（D-09）：** 回放前调 `adapter.read({kind:'get_range_values', address})` 读当前值，与 `entry.postState.content.values` 做 cell-by-cell 比对（字符串化）。规范化：数字 0 vs "" vs null 统一为 "" 比较（Office.js 对空单元格返回值可能是 null / 0 / ""）。[ASSUMED: Office.js 对空单元格的确切返回值，建议在 Wave 0 测试中验证]

---

### PPT: insert_slide → slide.delete() by index

**SP-5 已验证：** `slide.delete()` 在 PPT for Web 真删（3→2）[VERIFIED: SP-5 findings.md]。

**index 漂移风险：** 若 agent 在 insert_slide 后又 insert_slide，则记录的 insertedIndex 会发生漂移（第一张 insert 后第二张 insert 时 index 已加 1，若先 undo 第二张，第一张的 index 仍然正确；但若先 undo 第一张，后续 slides 的 index 都左移了）。

**解决方案（D-06 内容指纹）：** 记录 slide 插入后的 title（第一个文本形状的首行）作为稳定指纹，reverse 时先 `list_slides` 找 title 匹配的 slide，取其当时的 index 再 delete。

**[ASSUMED: PPT slide title 稳定指纹假设]** — 若 agent 多次插入相同 title 的 slide，指纹定位可能模糊。对于 Phase 5 PoC（单次 insert），此风险可接受；Phase 6 大规模铺开时可引入 slide id 作为更强稳定标识符（SP-5 中 getSelectedSlides 返回了 id=256#703088496 格式，但该 id 是否在 slides.items 上直接可读需真机验证）。

```typescript
// src/adapters/PptAdapter.ts — 新增方法

/** 新增 slide（返回插入后的 slideIndex 与 title 供 inverse 用） */
async insertSlideAfter(afterIndex: number, layout?: number): Promise<{
  insertedIndex: number;
  title: string;
}> {
  return await PowerPoint.run(async (ctx) => {
    const slides = ctx.presentation.slides;
    slides.load('items');
    await ctx.sync();
    // 在 afterIndex 位置之后添加新 slide（使用 addSlide）
    ctx.presentation.slides.add();
    await ctx.sync();
    // 重新加载获取新 slide 的 index（最后一张）
    slides.load('items');
    await ctx.sync();
    const newSlide = slides.items[slides.items.length - 1];
    // 读 title（第一个文本形状首行）
    // ... (参照 PptAdapter.list_slides 的 TEXT_SHAPE_TYPES 过滤逻辑)
    return { insertedIndex: newSlide.index + 1, title: '' }; // title 抓取见实现
  });
}

/** inverse: 按 title 指纹找 slide 并删除 */
async deleteSlideByTitle(titleFingerprint: string): Promise<void> {
  await PowerPoint.run(async (ctx) => {
    const slides = ctx.presentation.slides;
    slides.load('items');
    await ctx.sync();

    // 找 title 匹配的 slide（PPT-05 守则：按 .index 排序后遍历）
    const sorted = [...slides.items].sort((a, b) => a.index - b.index);

    // 批量 load shape texts
    for (const slide of sorted) {
      slide.shapes.load('items/type');
    }
    await ctx.sync();
    for (const slide of sorted) {
      for (const shape of slide.shapes.items) {
        if (TEXT_SHAPE_TYPES.has(shape.type)) {
          shape.textFrame.textRange.load('text');
        }
      }
    }
    await ctx.sync();

    // SP-5 策略：按 OperationLog 自有逆序遍历，不依赖 getSelectedSlides 顺序
    for (let i = sorted.length - 1; i >= 0; i--) {
      const slide = sorted[i];
      const slideTitle = extractFirstTitle(slide);
      if (normalizeText(slideTitle) === normalizeText(titleFingerprint)) {
        slide.delete();
        await ctx.sync();
        return;
      }
    }
    throw new HostApiError('PPT deleteSlideByTitle: 目标 slide 已不存在');
  });
}
```

**比对逻辑（D-09）：** 回放前调 `adapter.read({kind:'list_slides'})` 确认目标 title 的 slide 是否还存在，并且 title 与 postState.content.title 一致。不一致 → skip 标注。

---

## Pattern 3: Replay Engine（undo all / per-step undo）

**数据流：**

```typescript
// src/agent/operationLog.ts — replay engine（新增）

export type UndoResult = {
  total: number;
  rolledBack: number;
  skippedManualChange: number;
  skippedHostError: number;
  details: Array<{
    stepIndex: number;
    humanLabel: string;
    status: 'rolled_back' | 'skipped_manual' | 'skipped_error';
    errorHint?: string;
  }>;
};

export async function replayUndoAll(
  runId: string,
  adapter: DocumentAdapter,
): Promise<UndoResult> {
  const entries = getWriteOpsByRun(runId);
  const reversed = [...entries].reverse();  // D-07 逆序

  const result: UndoResult = {
    total: reversed.length,
    rolledBack: 0,
    skippedManualChange: 0,
    skippedHostError: 0,
    details: [],
  };

  for (const entry of reversed) {
    const stepResult = await replayUndoStep(entry, adapter);
    result.details.push({ stepIndex: entry.stepIndex, humanLabel: entry.humanLabel, ...stepResult });
    if (stepResult.status === 'rolled_back') result.rolledBack++;
    else if (stepResult.status === 'skipped_manual') result.skippedManualChange++;
    else result.skippedHostError++;
    // D-11: 自身报错也继续（不 throw，不停止）
  }

  return result;
}

async function replayUndoStep(
  entry: OperationLogEntry,
  adapter: DocumentAdapter,
): Promise<{ status: 'rolled_back' | 'skipped_manual' | 'skipped_error'; errorHint?: string }> {
  // D-09/D-10: 先 read 当前 state，与 postState 比对
  try {
    const currentState = await readTargetState(entry.postState, adapter);
    if (!isTargetStateConsistent(currentState, entry.postState)) {
      return { status: 'skipped_manual' };  // 用户手动改过
    }
  } catch {
    // read 失败也视为可能已手改，保守 skip（防止误撤）
    return { status: 'skipped_manual' };
  }

  // 执行 reverse 操作
  try {
    await executeReverse(entry.reverse, adapter);
    return { status: 'rolled_back' };
  } catch {
    // D-11: 报错标红继续
    return { status: 'skipped_error', errorHint: '宿主 API 报错，无法回滚此步' };
  }
}
```

**[VERIFIED: CONTEXT.md D-11]** 「继续撤剩下」模式由此处 try/catch 不 rethrow 实现。

---

## Pattern 4: DiffLogPanel UI

**接入方式：** 在 ChatStream.tsx 末尾，当 `agentStatus === 'idle'` 且该 runId 的 write ops > 0 时，追加 `<DiffLogPanel runId={runId} />` 节点。每个 run 对应一张卡，多轮 run 产生多张卡（D-08 旧卡保留）。

```typescript
// src/components/DiffLogPanel.tsx — 结构草图

function DiffLogPanel({ runId }: { runId: string }) {
  const entries = getWriteOpsByRun(runId);  // 纯内存读
  const writeEntries = entries.filter(e => e.reverse);  // D-03: 只写操作

  const [undoResult, setUndoResult] = useState<UndoResult | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);  // D-04: 二次确认状态

  // 复用现有 CSS token：aster-tool-card / wb-action-head / btn btn-ghost btn-sm
  return (
    <div className="diff-log-panel aster-tool-card">
      <button className="wb-action-head" onClick={() => setExpanded(v => !v)}>
        <ChevronDownIcon ... />
        <span>本次改动 {writeEntries.length} 处</span>
      </button>
      {expanded && (
        <ul className="diff-log-panel__steps">
          {writeEntries.map((entry, i) => (
            <li key={i}>
              <span>{entry.humanLabel}</span>
              <button className="btn btn-ghost btn-sm"
                onClick={() => handleUndoStep(runId, i)}>
                撤销该步
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* 底部：撤销所有 + 二次确认（D-04） */}
      {expanded && !undoResult && (
        confirming
          ? <ConfirmDialog onConfirm={handleUndoAll} onCancel={() => setConfirming(false)} />
          : <button className="btn btn-ghost" onClick={() => setConfirming(true)}>
              撤销本次所有操作
            </button>
      )}
      {undoResult && <UndoSummary result={undoResult} />}  {/* D-12 明确总结 */}
    </div>
  );
}
```

**[VERIFIED: ChatStream.tsx — aster-tool-card / wb-action-head 已有 CSS 类，可直接复用]**

---

## Pattern 5: humanLabel + reverse TS/lint enforce（D-15）

Phase 3 D-13 已埋 eslint rule，但 Phase 3 处于软 enforce 模式（未真正阻断）。Phase 5 flip 开。

**ToolDef 类型层已有约束 [VERIFIED: src/agent/tools/index.ts]：**

```typescript
export interface ToolDef<TArgs = unknown> {
  humanLabel: (args: TArgs) => string;  // 已在类型强制
  execute: (args: TArgs, ctx: ToolExecContext) => Promise<ToolResult>;
  // ...
}
```

`ToolResult.reverse?: ReverseDescriptor` 是可选字段——这是 Phase 3 的「软」约束。Phase 5 需要把 write tool 的 reverse 变成必填（通过注册时校验或类型细化）。

**推荐方案（Claude's Discretion 落地）：**

```typescript
// 在 buildToolsForHost 注册时，对 kind='write' 的 tool 做运行期检查
// （TS 类型细化难以表达「write kind 必须有 reverse」，用 runtime assert 作守门）
function assertWriteToolHasReverse(tool: ToolDef): void {
  if (tool.kind === 'write') {
    // write tool 的 execute 必须返回含 reverse 的 ToolResult
    // 在测试中注入 mock args 验证 execute 返回 reverse 字段
    // Phase 5 验收：所有 write/*.ts 的测试 assert result.reverse !== undefined
  }
}
```

**ESLint rule flip（Phase 3 的 eslint-plugin-aster / D-13）：**

Phase 3 在 eslint rule 上加了注释「暂不 enforce」。Phase 5 flip = 移除该豁免注释 / 改 rule 配置为 error 级别（非 warn）。

```bash
# 验证 flip 后所有 write tool 均满足
npx eslint src/agent/tools/write/ --rule 'aster/require-human-label: error'
```

[ASSUMED: Phase 3 eslint rule 的具体文件位置 — 需在 plan read_first 时确认 `.eslintrc` 或 `eslint.config.js` 中的 rule 配置]

---

## Pattern 6: storage.ts Quota Guard（D-14）

```typescript
// src/lib/storage.ts — storage.set() 包 try/catch

export class StorageQuotaError extends AsterError {
  public readonly recoverable = false;
  public readonly hint = '浏览器存储空间已满，请清理浏览器数据后重试';
  constructor() {
    super('localStorage 空间已满，无法保存配置', 'STORAGE_QUOTA', 'adapter');
  }
}

export const storage = {
  set(rawKey: string, value: unknown): void {
    try {
      localStorage.setItem(prefixedKey(rawKey), JSON.stringify(value));
    } catch (err) {
      // QuotaExceededError（DOMException code 22）
      if (err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22)) {
        throw new StorageQuotaError();
      }
      throw err;  // 其他 localStorage 错误（如隐私模式拒绝）原样抛
    }
  },
  // ...
};
```

**[VERIFIED: CONTEXT.md D-14]** 不做 LRU 清除；Phase 5 localStorage 只存 Provider/Key/flag 小数据，无大数据可清。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PPT slide.delete() | 自写 XML 删除或 snapshot fallback | `PowerPoint.run → slide.delete()` | SP-5 真机验证 PASS [VERIFIED] |
| Word paragraph.delete() | 自写 body.insertParagraph 覆盖 | `Word.run → paragraph.delete()` | SP-4 真机验证 PASS [VERIFIED] |
| Excel before-image | 另存整 sheet JSON | `range.load('values')` 精确抓目标 range | SP-4 真机验证 PASS [VERIFIED] |
| 比对规范化 | 自写复杂 diff 库 | `string.replace(/\r\n/g,'\n').trimEnd()` | Office.js 只有换行符/尾部空白差异 |
| clipboard | 手写 execCommand('copy') | `navigator.clipboard.writeText()` | Office for Web 支持 Clipboard API [ASSUMED: 真机需测一次] |

**Key insight:** 三宿主 inverse 全部 API path 已验证，不需要任何 snapshot 或 XML 处理方案。

---

## Common Pitfalls

### Pitfall 1: Word delete_last_paragraph 在任意顺序撤销时删错段（A-09 变体）

**What goes wrong:** 用户先 undo step 3（append 了段落 C），此时文档末尾变成段落 B，再 undo step 2，`delete_last_paragraph` 反而删了段落 B 而非段落 A。
**Why it happens:** Phase 3 骨架的 reverse `delete_last_paragraph` 是位置依赖，不是内容依赖。
**How to avoid:** 改为 `delete_paragraph_by_content`（内容指纹定位）。本 phase D-05 已锁定。
**Warning signs:** 测试「先 undo step 3 再 undo step 2」，验证文档段落数变化和剩余内容符合预期。

---

### Pitfall 2: Office.js 格式归一化导致 false-skip

**What goes wrong:** Word 写入 `"段落文本"` 后 read 回来是 `"段落文本\r\n"`（或 `"段落文本 "`），与 postState 存储的 `"段落文本"` 不匹配，触发 false-skip，用户看到「你已手动修改」但实际没改。
**Why it happens:** Office.js 对段落文本可能追加换行符或尾部空白。Excel 对空单元格返回 null/0/"" 不一致。
**How to avoid:** 比对前做规范化（`normalizeText` / Excel cell 值规范化）。D-10 已强调「增量内容做合理规范化后再比」。
**Warning signs:** unit test 构造「写入后立即 read，不手动修改」，assert 比对结果为一致（不触发 skip）。

---

### Pitfall 3: DiffLogPanel 订阅全局 operationLog 导致所有 runId 混渲

**What goes wrong:** DiffLogPanel 没有 runId 隔离，订阅全局数组，新 run 开始后旧 run 的卡片也更新。
**Why it happens:** 从 Phase 3 全局数组直接消费而未 runId 过滤。
**How to avoid:** Map<runId> 重构后，DiffLogPanel props 接收 runId，只调 `getWriteOpsByRun(runId)`。D-08 多轮旧卡保留通过 runId 隔离天然实现。
**Warning signs:** 多轮 run 时观察每张汇总卡的操作数是否独立。

---

### Pitfall 4: PPT slide.delete() 后 index 失效导致下一张 slide 的 undo 用错 index

**What goes wrong:** delete slide 3，剩余 slide 的 index 变化，之前记录的其他 slide 的 insertedIndex 失效。
**Why it happens:** PPT slide index 是动态的（删除后后续 slide 左移）。
**How to avoid:** 不依赖数值 index 定位，改用 title 指纹（D-06）。undo all 逆序遍历自有 OperationLog（SP-5 策略），不调 getSelectedSlides。
**Warning signs:** 多步 insert_slide 的 undo all 验证每张 slide 是否按正确顺序删除。

---

### Pitfall 5: CARRY-03 copy step log 把 API Key 暴露到剪贴板

**What goes wrong:** copy step log dump 了 providerStore 的 apiKey 字段（或 Provider id 含 Key 信息）。
**Why it happens:** 直接 JSON.stringify messages[] 不经脱敏。
**How to avoid:** D-21 明确「API Key、Provider id 不输出」。copyStepLog 函数在序列化前 redact（正则匹配 sk-/Bearer 等 pattern）。

---

### Pitfall 6: DiffLogPanel 主 chunk 体积超出 82KB CI gate

**What goes wrong:** DiffLogPanel + undo engine + write tools 合并进主 chunk 超过 82KB gzip 阈值，CI 阻断 merge。
**Why it happens:** 当前 bundle 80.54KB，仅余 1.46KB 余量（极紧）。
**How to avoid:** DiffLogPanel 可考虑 dynamic import（run 完成后才需要）；undo engine 逻辑尽量紧凑（目标 <3KB gzip）；write tool PoC 代码量小；不引新 runtime 依赖。
**Warning signs:** `npm run build && npm run size` 在每个 plan commit 后检查 main bundle。

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（已有 src/agent/tools/write/word.test.ts 等） |
| Config file | vite.config.ts（vitest 配置已内嵌） |
| Quick run command | `npx vitest run src/agent/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-10 | OperationLog Map<runId> CRUD 正确 | unit | `npx vitest run src/agent/operationLog.test.ts` | ❌ Wave 0 |
| AGENT-10 | replayUndoAll 逆序遍历 | unit | `npx vitest run src/agent/operationLog.test.ts` | ❌ Wave 0 |
| AGENT-11 | 手动改不一致 → skip_manual | unit | `npx vitest run src/agent/operationLog.test.ts` | ❌ Wave 0 |
| AGENT-11 | 规范化比对防 false-skip | unit | `npx vitest run src/agent/operationLog.test.ts` | ❌ Wave 0 |
| AGENT-11 | reverse 报错 → continue（D-11） | unit | `npx vitest run src/agent/operationLog.test.ts` | ❌ Wave 0 |
| TOOL-03 Word | delete_paragraph_by_content 精确定位 | unit (mock) | `npx vitest run src/adapters/WordAdapter.test.ts` | ❌ Wave 0 |
| TOOL-03 Excel | before-image 覆写 + 规范化比对 | unit (mock) | `npx vitest run src/adapters/ExcelAdapter.test.ts` | ❌ Wave 0 |
| TOOL-04 | write tool execute 必须返 reverse 非 undefined | unit | `npx vitest run src/agent/tools/write/` | ✅（已有 word.test.ts，需扩展 assert reverse） |
| NFR-05 | bundle ≤ 82KB gzip | size check | `npm run build && npm run size` | ✅ CI gate 已有 |
| TOOL-03 Word | Word inverse 三宿主真机闭环 | 真机 UAT | 手动（office-addin-browser-uat skill） | — |
| TOOL-03 PPT | PPT inverse 真机闭环 | 真机 UAT | 手动 | — |
| TOOL-03 Excel | Excel inverse 真机闭环 | 真机 UAT | 手动 | — |
| CARRY-03 | copy step log 脱敏（无 Key） | unit | `npx vitest run src/lib/copyStepLog.test.ts` | ❌ Wave 0 |
| D-14 | storage quota guard 抛 StorageQuotaError | unit | `npx vitest run src/lib/storage.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npx vitest run src/agent/ src/lib/ src/adapters/`（相关模块）
- **Per wave merge:** `npx vitest run`（全套）
- **Phase gate:** 全套 green + bundle ≤ 82KB + 三宿主真机 UAT 录像证据

### Wave 0 Gaps

- [ ] `src/agent/operationLog.test.ts` — 覆盖 Map<runId> CRUD + replayUndoAll + skip_manual + continue-on-error
- [ ] `src/lib/copyStepLog.test.ts` — 覆盖三角色 dump + 脱敏 Key
- [ ] `src/lib/storage.test.ts` — 覆盖 QuotaExceededError → StorageQuotaError 转换
- [ ] `src/adapters/WordAdapter.test.ts` 扩展 — deleteParagraphByContent + 规范化
- [ ] `src/adapters/ExcelAdapter.test.ts` 扩展 — setRangeValues before-image 抓取 + overwriteRange
- [ ] `src/agent/tools/write/word.test.ts` 扩展 — assert reverse.tool === 'delete_paragraph_by_content'（当前 test 还 assert 旧 'delete_last_paragraph'，需同步改）

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | OperationLog 纯内存，无 session |
| V4 Access Control | no | — |
| V5 Input Validation | yes | copyStepLog 脱敏 + reverse descriptor args 不含 Key |
| V6 Cryptography | no | — |

### Known Threat Patterns for Phase 5 Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| copy step log 泄露 API Key | 信息泄露 | D-21：脱敏正则 + unit test 验证（CARRY-03） |
| inverse args 含用户输入 | Tampering | ReverseDescriptor.args 源自 write tool 内部（非 LLM 直接写入），风险极低 |
| localStorage quota exhaustion | DoS | D-14：StorageQuotaError + 业务提示，不裸抛 DOMException |

---

## Environment Availability

**Step 2.6: SKIPPED — Phase 5 无新外部依赖（纯代码/配置变更，复用已有 Office.js CDN 和浏览器 API）**

三宿主真机 UAT 依赖 Office for Web（Edge/Chrome），遵循 `office-addin-browser-uat` skill 流程。

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PPT slide title 可用于稳定指纹定位目标 slide（对 PoC 场景：单次 insert，title 唯一） | Pattern 2 PPT | 低（PoC 场景控制，Phase 6 再引 slide.id） |
| A2 | Excel 对空单元格返回值在 before-image vs after-image 比对时需规范化（null/0/"" 等价） | Pattern 2 Excel | 中（false-skip 触发但不数据损坏）→ Wave 0 unit test 覆盖 |
| A3 | navigator.clipboard.writeText 在 Office for Web 可用（CARRY-03 copy step log 使用） | Pattern 6 / CARRY-03 | 中（降级：prompt 提示用户手动复制）→ 真机验一次 |
| A4 | Phase 3 eslint rule 文件位置（需在 plan read_first 确认 `.eslintrc` / `eslint.config.js` 具体配置） | Pattern 5 lint flip | 低（flip 方式不同，效果相同） |

**If this table is empty:** 所有 claims 均已 verified 或 cited。此表有 4 条 ASSUMED，需在对应 plan 中确认。

---

## Open Questions

1. **PPT slide id 稳定性（Claude's Discretion）**
   - What we know: SP-5 输出了 id=`256#703088496` 格式的 slide id（通过 getSelectedSlides 获得）；PptAdapter.list_slides 未 load slide.id 字段
   - What's unclear: `slides.items[i].id` 是否可直接 load（`slides.load('items/id')`）；id 在 delete/insert 后是否保持稳定
   - Recommendation: Phase 5 PoC 先用 title 指纹，Wave 1 末尾做一个小 spike 验证 slide.id loadability；若 id 可 load 且稳定，Phase 6 升级为 id 定位

2. **DiffLogPanel 在 ChatStream 中的挂载时机**
   - What we know: ChatStream.tsx 消费 useMessages()；agentStore.endRun() 在 loop 结束时调用；DiffLogPanel 需要 runId
   - What's unclear: 具体从哪里获取「已完成的 runId 列表」（agentStore 现在 endRun 后 currentRunId=null，无历史记录）
   - Recommendation: agentStore 加 `completedRunIds: string[]`（endRun 时 push），DiffLogPanel 按 completedRunIds 遍历渲染；或者 chatStore messages 中的 agentRunId 字段可重建 runId 集合

3. **write tool execute 返 postState 的接口扩展**
   - What we know: ToolResult 当前类型 `{ ok, data?, error?, reverse? }` — 无 postState 字段
   - What's unclear: 是把 postState 加进 ToolResult，还是在 operationLog.appendOperation 时让 loop.ts 外部传入
   - Recommendation: 把 `postState?: PostStateSnapshot` 加进 ToolResult，由 write tool execute 返回，loop.ts 透传给 appendOperation；这样 operationLog.ts 不需要知道各宿主 read API

---

## Code Examples

### Word append_paragraph reverse descriptor 改造

```typescript
// src/agent/tools/write/word.ts — execute() 改动（精确定位）
// [VERIFIED: SP-4 findings.md + CONTEXT.md D-05]

async execute({ text }, ctx): Promise<ToolResult> {
  await (ctx.adapter as WordAdapter).appendParagraph(text);
  const reverse: ReverseDescriptor = {
    tool: 'delete_paragraph_by_content',
    args: { text },  // 精确文本指纹
  };
  const postState: PostStateSnapshot = {
    kind: 'word_paragraph',
    content: text,   // postState = 写入的文本本身（已知，无需额外 read）
  };
  return { ok: true, data: { written: text.length }, reverse, postState };
}
```

### Excel set_range_values before-image 抓取

```typescript
// src/agent/tools/write/excel.ts — execute()
// [VERIFIED: SP-4 findings.md — range.load(['values','address']) 真机 PASS]

async execute({ address, values }, ctx): Promise<ToolResult> {
  const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeValues(address, values);
  const reverse: ReverseDescriptor = {
    tool: 'overwrite_range',
    args: { address: beforeImage.address, values: beforeImage.values },
  };
  const postState: PostStateSnapshot = {
    kind: 'excel_range',
    content: { address, values },
  };
  return { ok: true, data: { address, rowCount: values.length }, reverse, postState };
}
```

### Quota Guard unit test pattern

```typescript
// src/lib/storage.test.ts — 覆盖 D-14
// [VERIFIED: CONTEXT.md D-14 + src/lib/storage.ts 当前裸调用]

it('setItem QuotaExceededError → StorageQuotaError', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('QuotaExceededError', 'QuotaExceededError');
  });
  expect(() => storage.set('test-key', 'value')).toThrow(StorageQuotaError);
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 3: `delete_last_paragraph` reverse | Phase 5: `delete_paragraph_by_content` 精确定位 | Phase 5 D-05 | 支持任意顺序单步撤销 |
| Phase 3: 全局数组 operationLog | Phase 5: Map<runId, entries[]> | Phase 5 D-16 | 多轮 run 独立，旧卡保留 |
| Phase 3: storage.set() 裸调用 | Phase 5: try/catch + StorageQuotaError | Phase 5 D-14 | 配额异常业务化，不裸 throw |
| Phase 3: eslint rule 软 enforce（warn） | Phase 5: eslint rule 硬 enforce（error） | Phase 5 D-15 | write tool 缺 reverse 编译/lint 阻断 |

**Deprecated/outdated:**
- `delete_last_paragraph` reverse tool：Phase 5 改为 `delete_paragraph_by_content`，旧名可保留为 fallback 但不应被新 write tool 使用
- sessionStorage undo 恢复（原 SC5）：D-13 永久移除

---

## Sources

### Primary (HIGH confidence)

- `src/agent/operationLog.ts` — Phase 3 骨架（直接读）
- `src/agent/tools/index.ts` — ToolDef / ToolResult / dispatchTool（直接读）
- `src/agent/tools/write/word.ts` — append_paragraph + 现有 reverse（直接读）
- `src/agent/agentStore.ts` — Zustand agent 状态机（直接读）
- `src/components/ChatStream.tsx` — role='tool' 折叠卡渲染（直接读）
- `src/lib/storage.ts` — 当前裸 setItem（直接读）
- `src/adapters/WordAdapter.ts` / `PptAdapter.ts` / `ExcelAdapter.ts` — Phase 4 read 全套（直接读）
- `.planning/spikes/SP-4-reverse-ops/findings.md` — 三宿主 inverse API path 真机 PASS（直接读）
- `.planning/spikes/SP-5-ppt-slide-delete/findings.md` — PPT slide.delete() 真删 PASS（直接读）
- `.planning/phases/05-diff-log-undo-all-3/05-CONTEXT.md` — D-01..D-22 全部 locked decisions（直接读）
- `.planning/REQUIREMENTS.md` — AGENT-07/09/10/11 / TOOL-03/04 / CARRY-03 / NFR-05（直接读）

### Secondary (MEDIUM confidence)

- `.planning/research/PITFALLS.md` — A-09 undo 不撤用户手改 / A-11 diff log localStorage / A-13 humanLabel / A-15 刷新恢复（直接读）
- `.planning/research/ARCHITECTURE.md` — AP-3 禁 Office.js native undo + inverse op 模型（直接读）

### Tertiary (LOW confidence)

- 无

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 全部现有库，无新依赖
- Architecture: HIGH — SP-4/SP-5 真机验证，API path 明确
- Pitfalls: HIGH — 基于已读代码 + spike findings 直接推导
- Assumptions: 4 条 ASSUMED（A1-A4），已标注

**Research date:** 2026-05-29
**Valid until:** 2026-06-29（Office.js API 稳定，30 天有效）
