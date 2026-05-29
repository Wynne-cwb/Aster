# Phase 5: Diff Log + Undo All 跨 3 宿主 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 5-diff-log-undo-all-3
**Areas discussed:** 差异面板形态, 撤销粒度与顺序, 手动改防御严格度, 刷新/存储兜底范围（用户追加）

---

## 差异面板形态

| Option | Description | Selected |
|--------|-------------|----------|
| 末尾汇总卡 | run 完成后聊天流末尾追加可展开「本次改动 N 处」汇总卡，复用现有卡片视觉 | ✓ |
| 常驻底部面板 | 独立 DiffLogPanel 钉在 Task Pane 底部，与 live tool 卡有重复 | |
| live 卡加按钮 | 给现有 role='tool' 卡直接加撤销按钮，不另起面板 | |

| Option | Description | Selected |
|--------|-------------|----------|
| 只列写操作 | 只列有 reverse 的写操作，读操作不进卡 | ✓ |
| 读写全列 | 完整轨迹都进汇总卡 | |

**User's choice:** 末尾汇总卡 + 只列写操作
**Notes:** ChatStream 现已实时渲染 role='tool' humanLabel 折叠卡；run 中靠它，run 完成后追加汇总卡作为 undo surface，不和 live 卡打架。

---

## 撤销粒度与顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 点中间步=连撤到该步 | 点第 3 步 = 第 3/4/5 步逆序一起撤（LIFO 安全） | |
| 仅末步可单撤(LIFO) | 只有最近一步可撤，严格 LIFO | |
| 任意步独立可撤 | reverse 升级为精确定位 + before-image 校验，任意顺序单撤 | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| 当前 runId + 旧卡保留 | undo all 只撤当前轮，旧轮汇总卡保留可见 | ✓ |
| 跨轮累计全撤 | undo all 撤本次会话所有轮 | |
| 新 run 即清旧记录 | 新一轮开始清掉上轮 diff log | |

**User's choice:** 任意步独立可撤 + 当前 runId（旧卡保留）
**Notes:** 用户选了更强的任意顺序，而非省事的 LIFO。代价：append_paragraph 的 reverse 必须从 delete_last_paragraph 改为精确定位，且对 index 漂移鲁棒（倾向内容指纹/对象 id）。

---

## 手动改防御严格度

| Option | Description | Selected |
|--------|-------------|----------|
| 只比目标对象内容 | 严格比「要反操作的那个目标」本身，周边无关变化容忍 | ✓ |
| 任何不一致即跳过 | read 回来有任何差异即跳过（最保守，易被格式归一化误伤） | |
| 只要能定位就撤 | 只要目标还在就撤，不深比内容（与 A-09 冲突） | |

| Option | Description | Selected |
|--------|-------------|----------|
| 继续撤剩下的 | 反操作自身报错时跳过标红，继续撤剩下，最大努力 | ✓ |
| 遇错即停 | 一遇反操作失败即停 | |

**User's choice:** 只比目标对象内容 + 反操作报错继续撤剩下
**Notes:** 取舍核心 = 误跳过 vs 误撤销。选「只比目标对象内容」对齐 SC3「5 改 1、回 4」，规范化比对避免 false-skip。

---

## 刷新/存储兜底范围（用户追加，收窄范围）

| Option | Description | Selected |
|--------|-------------|----------|
| F5 恢复（SC5）移除 | 不做 sessionStorage 同步/mount-check/对话框，diff log 纯内存刷新即丢 | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| 瘦身成薄包装 | storage.ts setItem 加 try/catch + 超配额抛异常，不做 LRU | ✓ |
| 完整保留 SC7 | try/catch + 80% LRU + 95% 抛异常 | |
| 也移除 | SC7 完全不做 | |

**User's choice:** F5 恢复整条移除 + SC7 瘦身成薄包装
**Notes:** 用户在最终确认后追加指令「F5 恢复直接不考虑，移除掉」。连带把 SC7 quota guard 瘦身（diff log 已纯内存、聊天历史本来不进 localStorage，无 LRU 必要）。延续「自用工具砍非必要」气质。

## Claude's Discretion

- OperationLog Map<runId> 重构数据结构 / selectors
- 每宿主稳定目标定位手段（内容指纹 vs 对象 id）
- 汇总卡视觉细节（aster-design-system skill）
- copy step log Markdown 模板 + JSON 切换 UI
- undo all 二次确认对话框文案
- humanLabel/reverse eslint enforce 写法

## Deferred Ideas

- SC5 sessionStorage F5 恢复 → 移除，归 FUT-03 同类
- 全套 write tools + killer scenarios → Phase 6
- builtin-model-dropdown.md → CARRY-02 已在 Phase 4 交付，不折入
- getSelectedSlides 多 slide 反向排序 → 本 phase PPT undo all 实现时验，用自有 log 逆序遍历绕过
