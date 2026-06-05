# Phase 29 Discussion Log —— 审计轨迹 + 灰区二分分析

**Phase:** 29-ppt-tools-nfr12（PPT 工具补全 PPT-09/10/11 + NFR-12 bundle 收口）
**Date:** 2026-06-05
**Mode:** 用户主导 discuss（team-lead 派发 discuss TeamMate，执行一个有边界的 gsd-discuss-phase step）
**Discusser:** discuss TeamMate（aster-v2.4 团队）

---

## 1. 输入上下文（已读）

| 文件 | 读取目的 | 关键结论 |
|------|---------|---------|
| `.planning/REQUIREMENTS.md` | PPT-09/10/11 + NFR-12 全文 | 三工具均 ⚠️plan-phase 必验网页版可用性；PPT-09「形状网格模拟 **或** 明确拒绝」并列留开；PPT-11「降级纯色 **或** 拒绝」并列留开；PPT-10 仅「诚实降级」未枚举模拟。NFR-12 余量 0.7KB。 |
| `.planning/ROADMAP.md` §Phase 29 | phase 边界 + SC + 依赖 | 5 条 SC；Depends on 26/27/28（NFR-12 全代码就位才收口）；SC#4 明示「允许部分工具诚实降级为成功」。 |
| `.planning/phases/10-.../10-CONTEXT.md` | PPT write 工具 + undo 范式 | undo 三分类 + spike 运行时门控降级(D-10/11) + noop+gate(D-13) + D-17 守门四步；Deferred 已记 add_line/insert_table_ppt/渐变 → 本 phase 兑现。 |
| `.planning/phases/22-.../22-CONTEXT.md` | 设计 token 范式 | `ppt-tokens.ts`(960×540 canvas/MARGINS/FONT_LADDER/grid 纯函数) + geometry-check → PPT-09 网格模拟可复用。 |

## 2. Codebase scout（已探，精确路径见 29-CONTEXT.md §Canonical References）

- **PptAdapter** `src/adapters/PptAdapter.ts`（~3100 行）：PowerPoint.run 闭包 + before-image/inverse 范式 + HostApiError + getSelectedSlides 按 index 排序 + #2775 deselect。
- **PPT write ToolDef** `src/agent/tools/write/ppt.ts`（~800 行）：snake_case args + reverse Record + postState + humanLabel。
- **PPT_TOOLS Set + casing 归一化** `src/agent/tools/index.ts` L34-62：`normalizeToSnakeCase` 仅对 PPT_TOOLS 内工具触发（dispatch L214-217）。
- **operationLog** `src/agent/operationLog.ts`：PostStateSnapshot.kind union(L34-50) + DocumentAdapterForReplay 接口(L102-171，Record 签名) + executeReverse switch(L329-544，case=reverse 名逐字)。
- **CI 守门真相源** `src/agent/contract.test.ts`：`CONTRACT[]`(L33-64) 是 JS 常量真相源；`PhaseNum=9|10|11|23`；D-17 `fs.readFileSync` 硬卡(L118-141)；长度断言 ≥24(L145)。Phase 23 `apply_slide_layout`(L63) = 新工具入册范式。
- **integration 守门** `src/agent/operationLog.integration.test.ts`：真 PptAdapter + mock 宿主。
- **bundle gate** `.size-limit.json`(`main-*.js` ≤82KB gzip)；`package.json`：build=lingui compile+vite build / size=size-limit / test=tsc+vitest。
- **懒加载范式** `src/adapters/index.ts` `createAdapter` 动态 import。

## 3. 灰区二分分析（核心交付）

### 方法
对 phase 每个开放点，二分为 **(A) 需人类拍板**（产品/UX 价值取向，无法从代码/默认推导）vs **(B) 可研究/可自决技术事实**（API 可用性、降级机制、bundle 手段、合约接线）。team-lead 指令明示：合约 + 降级行为大部分已定，**不硬造问题**；仅真·产品取向才问真人。

### 二分结果

| 开放点 | 分类 | 裁决 | 理由 |
|--------|------|------|------|
| **PPT-09 网页版不支持原生建表时：形状网格模拟 vs 明确拒绝** | **(A) 人类拍板** | ✅ 已问 → **形状网格模拟** | REQUIREMENTS 原文「如用形状网格模拟**或**明确拒绝」二者并列、刻意留开；两路实现范围差异大（网格=复合多形状+复合undo）；是"给用户看得见的假表格 vs 诚实说不"的真产品价值取向，无法从代码推导。team-lead 也点名此项可能值得问。 |
| **PPT-11 不支持渐变时：降级纯色 vs 明确拒绝** | **(A) 人类拍板** | ✅ 已问 → **降级纯色** | REQUIREMENTS 原文「诚实降级为纯色**或**拒绝」并列留开；"已锁的诚实降级原则"对两路都成立（纯色+告知 与 拒绝 都诚实），故原则不能替决；且纯色降级与现有 set_shape_property 功能重叠 → 是否值得做是真取向。与 PPT-09 合并一次问（合并一次原则）。 |
| **PPT-10 不支持 addLine 时降级方式** | **(B) 自决** | 诚实拒绝（D-29-03） | addLine 原子操作，**无合理模拟路径**（细矩形冒充线条观感差、箭头无法干净模拟）；REQUIREMENTS PPT-10 **未**枚举模拟选项（只说"诚实降级"）→ 唯一连贯路径=拒绝。无产品取向，不问。 |
| **三工具 Office for Web API 可用性** | **(B) 研究/UAT** | plan 必验 + 运行时门控 + UAT verdict（D-29-04） | 技术事实，查文档 + isSetSupported + 写后回读 + 真机 UAT；Claude 自跑不了真机（memory feedback_self_run_spikes）；运行时降级是安全网，不阻塞。 |
| **降级判定机制**（isSetSupported / try-catch / 写后回读） | **(B) 自决** | 镜像 Phase 10 D-10/D-11 运行时门控降级 | 已有范式，纯技术。 |
| **合约接线**（snake_case / PPT_TOOLS / Record inverse / kind / humanLabel / contract.test + integration.test 守门 / PhaseNum 扩 29 / 长度断言上调） | **(B) HARD 约束** | 逐字对齐 contract.test.ts CI 真相源（D-29-05） | team-lead 明示 HARD CONSTRAINT，非灰区；Phase 23 已示范全流程。 |
| **per-tool undo 设计** | **(B) 自决** | 复用 delete_shape_by_id/restore_shape_property，网格模拟参照 apply_slide_layout 复合删除（D-29-06） | 纯技术，有现成范式。 |
| **NFR-12 bundle 收口** | **(B) 技术验收** | build→size→≤82KB，重模块懒加载，看全里程碑累积（D-29-08） | team-lead 明示技术验收非灰区。 |
| **工具命名 / 参数结构 / 文案 / 阈值** | **(B) Claude's Discretion** | planner/researcher 定 | 实现细节。注意 PPT 表格名勿撞 Word `insert_table`（R-6）。 |

### 结论
- **2 项需人类拍板**（PPT-09、PPT-11 降级取向）—— 均为 REQUIREMENTS 刻意并列留开的真产品取向，**已合并一次 AskUserQuestion 问真人**，未替选默认。
- 其余全部 (B)，记录留 plan-phase / UAT，**未硬造问题**。

## 4. AskUserQuestion 记录（2026-06-05）

**Q1（header「P29-表格降级」）：** PPT-09 网页版不支持原生建表时的降级方向？
- 选项：① 形状网格模拟 ② 明确拒绝
- **用户选：① 形状网格模拟** → 锁 D-29-01。

**Q2（header「P29-渐变降级」）：** PPT-11 网页版不支持渐变时的降级方向？
- 选项：① 降级为纯色 ② 明确拒绝
- **用户选：① 降级为纯色** → 锁 D-29-02。

两题均单选、neutral 呈现（未标 Recommended，遵循 team-lead「不替选默认」）。

## 5. 产物
- `29-CONTEXT.md`（权威决策 + 可研究事实清单 + canonical refs + UAT 种子 + 风险）
- `29-DISCUSSION-LOG.md`（本文件，审计轨迹 + 二分分析）
- **未 git commit**（遵循 team-lead 指令）。

## 6. 推荐下一步
`gsd-plan-phase`（Phase 29）—— research 先验三工具 Office for Web API 可用性（§Researchable Facts 1-3），按已锁降级方向（网格/拒绝/纯色）+ 合约接线规划；末位收口 NFR-12 全里程碑 bundle。

---
*Discuss step complete. 用户拍板 2 项产品取向，技术事实留 plan。停止。*
