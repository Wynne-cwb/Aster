# 写回卡 与 工具卡（Writeback & Tool Cards）

**这套设计里最关键、最可复用的组件。** Phase 5（Diff Log + Undo All）直接喂给这里。核心架构原则:**AI 自动写文档，无「接受/拒绝」按钮**——卡片是**事后通知** + 撤销入口。

> 实现：`src/components/ChatStream.tsx`（含 ToolResultCard / MergedToolGroup / soft-landing 子渲染）+ `src/components/ErrorBubble.tsx`。CSS 在 `src/styles.css`「ToolResultCard」「MergedToolGroup」「ErrorBubble」「role='tool' 折叠卡 + soft-landing」段。

## Design Decisions

### 折叠范式（统一）`wb-action-head` + `wb-action-body`
所有「可展开的行」都用这对类：head 是 button（左 chevron 11px，展开时 `rotate(180)`，+ ellipsis 文字），body 是展开内容。这是写回卡、工具卡、多动作合并卡共享的底座。

### 多动作合并卡 `.tool-group`（README §4c 多动作卡）
- **≥2 连续 tool 卡自动合并**成一张卡（阈值 `>=2`，UAT 调定）：head「N 项修改 + 撤销全部」+ list，每行独立 chevron 展开。
- ⚠️ **`flex-shrink: 0` 是硬性必须**：本卡是 `.aster-messages`（flex column + overflow-y:auto）的子项，`overflow:hidden` 会让 `min-height:auto` floor 失效；不锁 shrink 会被 flex **压成一条线**（真机 UAT 实测踩过）。
- 行内 `.wb-action-head` 去圆角（`border-radius: 0`），靠 li 之间 `1px var(--border)` 分隔。
- 错误行：`li.is-error .wb-action-target { color: var(--error); }`。

### 单动作折叠卡 `.aster-tool-card`（命名债，仍在用）
- 常规 tool（append_paragraph 等）：humanLabel header + 展开 JSON。
- 错误态 `--error`：`border-color: var(--text-3)`（克制，不刺眼）。
- source 行 mono 小字 `--text-3`。

### soft-landing 卡 `.aster-tool-card--soft-landing`
max_steps 软着陆（「继续 20 步 / 停下」）：teal 描边卡，单行标题 + 右下两按钮（primary「继续」+ secondary 描边「停下」形成层级）。

### 错误气泡 `.err-bubble`（ERR-04 / 8 类错误）
- 跟 AI 气泡同形（`--bubble-ai-bg` + 左下拉直），但加 **左 3px 红描边** `box-shadow: inset 3px 0 0 var(--error)` 作 accent stripe。
- head 红字 600 + alertTriangle 13px + mono `.code` 代号徽章。错误目录 = `src/errors/`：`KEY_INVALID / QUOTA / RATE_LIMIT / CONTEXT / NETWORK / FILTER / MODEL / IMAGE_QUOTA`。
- body 正文 `--text`，可选 `.cta` 红色下划线链接（如「前往设置」）。

### 撤销态（设计稿规格，Phase 5 落地参考）
单击撤销 → 整卡加 `.is-undone`：胶囊变中性灰、body 删除线、底部加「已撤销，文档已回滚到上一状态」提示、撤销按钮消失。

## CSS Patterns（线上实测）

### 折叠范式（底座）
```css
.wb-action-head {
  display: flex; align-items: center; gap: 6px; width: 100%;
  background: transparent; border: 0; padding: 6px 10px; cursor: pointer;
  border-radius: var(--radius-2); color: var(--text-2); font-size: var(--fs-12); text-align: left;
}
.wb-action-head:hover { background: var(--surface-2); }
.wb-action-head:focus-visible { box-shadow: var(--ring-focus); outline: none; }
.wb-action-head svg { transition: transform var(--dur-fast) var(--ease-out); }
.wb-action-head svg.is-up { transform: rotate(180deg); }
.wb-action-head .wb-action-target { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wb-action-body { padding: 6px 10px 8px; font-size: var(--fs-12); color: var(--text-2); line-height: 1.5; }
```

### 多动作合并卡
```css
.tool-group {
  margin-top: var(--space-2);
  border-radius: var(--radius-3); border: 1px solid var(--border); background: var(--surface);
  overflow: hidden;
  flex-shrink: 0;            /* ← 必须，否则被 flex column 压成一条线（真机 UAT）*/
}
.tool-group__head {
  display: flex; align-items: center; gap: var(--space-2);
  padding: 8px 12px; font-size: var(--fs-12); color: var(--text-2);
  border-bottom: 1px solid var(--border);
}
.tool-group__count { font-weight: 500; color: var(--text-2); }
.tool-group__list { list-style: none; margin: 0; padding: 0; }
.tool-group__list > li { border-bottom: 1px solid var(--border); }
.tool-group__list > li:last-child { border-bottom: 0; }
.tool-group__list .wb-action-head { border-radius: 0; }       /* 行内去圆角 */
.tool-group__list > li.is-error .wb-action-target { color: var(--error); }
```

### 单动作折叠卡 + soft-landing
```css
.aster-tool-card {
  margin-top: var(--space-2); padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-3); border: 1px solid var(--border); background: var(--surface);
  font-size: 12.5px; color: var(--text-2);
  display: flex; flex-direction: column; gap: var(--space-2);
  flex-shrink: 0;
}
.aster-tool-card--error { border-color: var(--text-3); }
.aster-tool-card__source { font-size: 11px; color: var(--text-3); margin-bottom: var(--space-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

.aster-tool-card--soft-landing { border-color: var(--accent); background: var(--surface); }
.aster-tool-card__title { font-size: 13px; font-weight: 500; color: var(--text); line-height: 1.5; }
.aster-tool-card__actions { display: flex; justify-content: flex-end; gap: var(--space-2); }
.aster-btn-primary--sm { padding: 4px var(--space-3); font-size: 12px; }   /* 「继续 20 步」*/
.aster-tool-card__btn-secondary {                                          /* 「停下」描边 */
  display: inline-flex; align-items: center; justify-content: center;
  padding: 4px var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-3);
  background: transparent; color: var(--text-2); font-size: 12px; font-weight: 500;
  font-family: var(--font-body); cursor: pointer;
}
.aster-tool-card__btn-secondary:hover { color: var(--text); border-color: var(--text-2); }
```

### 错误气泡
```css
.err-bubble {
  padding: 9px 12px 9px 14px;
  border-radius: var(--radius-3); border-bottom-left-radius: var(--radius-1);
  background: var(--bubble-ai-bg);
  box-shadow: inset 3px 0 0 var(--error);     /* 左侧红 accent stripe */
  max-width: 88%;
}
.err-bubble .head { display: flex; align-items: center; gap: 6px; color: var(--error);
  font-weight: 600; font-size: var(--fs-12); margin-bottom: 4px; }
.err-bubble .head .code { font-family: var(--font-mono); font-size: var(--fs-11);
  padding: 1px 5px; background: rgba(0,0,0,0.06); border-radius: var(--radius-1); }
.err-bubble .reason { font-size: var(--fs-13); color: var(--text); line-height: 1.5; margin-bottom: 6px; }
.err-bubble .cta { color: var(--error); text-decoration: underline; cursor: pointer;
  font-size: var(--fs-13); display: inline-flex; align-items: center; gap: 4px; }
```

### 撤销态胶囊（设计稿 `aster.css`，Phase 5 落地参考）
```css
/* .wb-status 胶囊：bg color-mix(success 14%), color var(--success), radius 999px, padding 2px 8px, fs-11/600 */
/* .is-undone：胶囊变中性灰 + body 删除线 + 底部 .writeback-undone 提示 */
```
> 撤销态完整视觉规格在 `sources/design-package/README.md` §4c + `aster.css`。当前线上 ChatStream 是「事后通知卡」；Phase 5 的 per-step/undo-all 落地时按设计稿补 `.is-undone` 与撤销胶囊。

## What to Avoid

- ❌ 给写回/工具结果加「接受 / 拒绝」按钮——架构是自动写 + 事后通知 + 撤销，**不是确认流**。
- ❌ 漏 `flex-shrink: 0`——合并卡 / 工具卡会被 flex column 压成一条线（已踩坑）。
- ❌ 错误态卡用刺眼红边——单动作错误卡用 `--text-3` 中性边，红色留给 `.err-bubble` 的 stripe + head。
- ❌ 自造折叠交互——复用 `wb-action-head` / `wb-action-body` 范式。
- ❌ 合并阈值搞错——`>=2` 连续 tool 才合并（UAT 调定）。

## Origin

- 线上：`src/styles.css` 上述各段；`src/components/ChatStream.tsx`（ToolResultCard / MergedToolGroup / soft-landing）/ `ErrorBubble.tsx`；`src/errors/`（8 类错误码）。
- 设计稿：`sources/design-package/README.md` §4c（写回卡单/多动作）+ §4d（ErrorBubble）+ §「Writeback 撤销/展开」。
- UAT 决策：工具卡合并阈值 `>=2` + `flex-shrink:0` 修被压扁（2026-05-29）。
- 消费方：**Phase 5 DiffLogPanel + per-step undo + undo all** 直接复用本范式。
