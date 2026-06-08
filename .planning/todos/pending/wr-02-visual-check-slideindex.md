---
title: WR-02 — visual_check_slide 的 slideIndex 入参声明 required 但实现忽略
captured: 2026-06-08
source: phase-24-review（v2.4 close 时从 STATE Deferred 提升为活跃 todo）
priority: low
size: quick-task
resolves_phase: TBD
resolves_req: WR-02
---

## 触发
v2.3 Phase 24 code review（`.planning/phases/24-a-p2-bundle/24-REVIEW.md` §WR-02）。当前单 layout UAT 无影响（只有一个预览面板时永远截对），但合约误导 + 多面板时会截错。

## 问题（精确落点）
`src/agent/tools/read/visual-check.ts`：
- `slideIndex` 在 schema 里 `required: ['slideIndex']`（line 90），`execute({ slideIndex }, _ctx)` 解构（line 99），**但函数体从不使用**。
- 实现无条件截取 `_previewElementGetter` 注册的 DOM 元素 —— **永远是最后挂载的 `SlidePreviewPanel`**，与 LLM 传入的 slideIndex 无关。
- 若用户聊天里有多个预览面板（多次 `apply_slide_layout`），`visual_check_slide({ slideIndex: 2 })` 会拿到最近挂载面板的截图，可能不是第 2 页 → 误导反馈。LLM 收不到「你传的 slideIndex 被忽略」的任何信号。

## 修复方案（二选一）
- **(a) 删 slideIndex**：从 schema 移除 `slideIndex`，`humanLabel` 改为 `视觉自查当前预览`（诚实表达「只能查当前面板」）—— 推荐，最诚实
- **(b) 保留但澄清**：保留入参，但在 response data 里加 note 说明「实际截取的是当前挂载面板」，不假装能按 index 选

## 顺带（同文件同函数，一起修省一次改动）
- **IN-02（code smell）**：`execute({ slideIndex })` 解构后未用的 dead binding；修 WR-02 时一并消费或换 wildcard
- **风格一致性（轻微）**：`visual_check_slide` 返回未走 `wrapReadResult`（少 result_type 标签 + 50K size-cap），功能无碍但与其它 read tool 不一致 —— 顺手补 `wrapReadResult` 包装

## 关联
- 与 [[wr-03-preview-getter-identity-guard]] 同源（Phase 24 review，同 `visual-check.ts` 文件），可合并一个 quick task 一起修
- 当前不阻塞（单 layout 无影响）；下个 milestone triage 时若动 PPT 视觉自查再纳入
