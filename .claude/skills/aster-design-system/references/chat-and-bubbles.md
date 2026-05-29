# 聊天与气泡（Chat Surface）

聊天主面板的输出层：消息气泡（user / ai / error）、markdown-lite 渲染、时间戳、空状态、滚动容器与粘底行为。

> 实现：`src/components/ChatBubble.tsx` · `src/components/ChatStream.tsx` · `src/components/ErrorBubble.tsx`（ErrorBubble 详见 [writeback-and-tool-cards.md](writeback-and-tool-cards.md)？不——错误气泡视觉在此，错误目录见 errors）。CSS 在 `src/styles.css` 的「ChatBubble」「ChatStream empty state」段。

## Design Decisions

- **三种气泡形态**：用户（teal 实底、右对齐）/ AI（冷灰底、左对齐）/ 错误（AI 形状 + 左 3px 红描边）。指向感靠**单角拉直**（用户气泡右下角、AI/错误气泡左下角从 `--radius-3` 拉到 `--radius-1`）。
- **用户气泡用 `--accent` 实底**（不是渐变），加 `inset 0 1px 0 rgba(#fff 18%)` 顶部内高光提精致感。文字用 `--accent-on`。
- **AI 气泡用 `--bubble-ai-bg`**（冷灰 `#EEEEF0` / dark `#1F1F23`），刻意与纯白 chat 底分层，加极细 `1px rgba(0,0,0,0.04)` 描边。
- **时间戳常驻**（不再 hover 触发，UAT 决策）：mono 11px、`--text-3`、opacity 0.7、`MM-DD HH:MM`。`pushMessage` 默认带 `ts`。
- **空状态垂直居中**（不 top-skew）：脉冲 logo（4s）+ 标题 + 副文 + 3 个 ghost suggestion 按钮。
- **markdown-lite**：气泡内支持 inline code / `<pre>` / `<ul><ol>`，窄面板用 `white-space: pre-wrap` 让代码换行而非横向滚动（350px 硬约束）。
- **滚动粘底**：距底 < 阈值时新消息自动滚到底；用户主动上滚后停止粘。新消息 smooth、流式 delta auto（跟随 token 不抖）。
- **流式光标** `.caret`：2px 竖条 blink 1s。
- **空 turn 不渲染气泡**（UAT 修复）：tool-call-only 的 AI turn（无文本）不渲染 ChatBubble，避免空气泡。

## CSS Patterns（线上实测）

### 气泡
```css
.msg { display: flex; flex-direction: column; flex-shrink: 0; } /* flex-shrink:0 必须：由 .aster-messages 滚动，气泡不被压缩 */
.msg-user { align-items: flex-end; }
.msg-ai   { align-items: flex-start; }

.bubble {
  padding: 9px 13px;
  border-radius: var(--radius-3);
  max-width: 88%;
  word-break: break-word;
  font-size: var(--fs-14);
  line-height: 1.55;
}
.bubble-user {
  background: var(--accent);
  color: var(--accent-on);
  border-bottom-right-radius: var(--radius-1);          /* 右下拉直 → 指向感 */
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 18%, transparent);
}
.bubble-ai {
  background: var(--bubble-ai-bg);
  color: var(--text);
  border-bottom-left-radius: var(--radius-1);           /* 左下拉直 */
  border: 1px solid rgba(0, 0, 0, 0.04);
}
```

### markdown-lite（AI 气泡内）
```css
.bubble-ai p { margin: 0 0 8px; }
.bubble-ai p:last-child { margin-bottom: 0; }
.bubble-ai pre {
  white-space: pre-wrap; max-width: 100%; overflow-x: auto;   /* 窄面板换行优先 */
  font-size: var(--fs-12); background: var(--surface-2);
  border-radius: var(--radius-2); padding: 8px 10px; margin: 6px 0;
}
.bubble-ai code {
  font-family: var(--font-mono); font-size: var(--fs-12);
  background: var(--surface-2); border-radius: var(--radius-1); padding: 1px 4px;
}
.bubble-ai ul, .bubble-ai ol { padding-left: 20px; margin: 4px 0; }
```

### 时间戳 + 流式光标
```css
.msg-time {
  font-family: var(--font-mono); font-size: var(--fs-11);
  color: var(--text-3); margin-top: 3px; opacity: 0.7;
  /* 注意 white-space: nowrap 防止换两行 */
}
.caret {
  display: inline-block; width: 2px; height: 14px; background: var(--text-2);
  margin-left: 2px; vertical-align: middle; animation: blink 1s step-start infinite;
}
@keyframes blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
```

### 滚动容器 + 消息列表
```css
.chat-scroll { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-height: 0; }
.aster-messages {
  flex: 1; min-width: 0;                /* min-width:0 兜底：防 flex 子项撑破窄面板 */
  display: flex; flex-direction: column;
  padding: var(--space-3) var(--space-4);
  overflow-y: auto; overflow-wrap: anywhere;
  gap: var(--space-4);                  /* 气泡间距 16px（UAT 定）*/
}
```

### 空状态
```css
.empty {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;     /* 垂直居中，不 top-skew */
  padding: 24px 24px 32px; gap: 14px; text-align: center;
}
.empty-mark { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
  animation: aster-pulse 4s ease-in-out infinite; }
@keyframes aster-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
.empty h3 { font-size: var(--fs-16); font-weight: 600; color: var(--text); margin: 0; }
.empty p  { font-size: var(--fs-13); color: var(--text-2); line-height: 1.6; margin: 0; max-width: 240px; }
```

## HTML Structure（参考 README §4b / 实现）

```
.msg.msg-user
  └ .bubble.bubble-user            ← 文本
  └ .msg-time                      ← MM-DD HH:MM
.msg.msg-ai
  └ .bubble.bubble-ai              ← markdown-lite，流式时尾随 .caret
  └ .msg-time
```
空状态：`.empty > .empty-mark(logo) + h3 + p + .suggestions(3× ghost btn)`。每个 suggestion = 左 icon(14, stroke1.5) + label(13, 左对齐) + 尾 arrowRight(13, `--text-3`, hover 右移 2px)。

## What to Avoid

- ❌ 给用户气泡用渐变背景——是 `--accent` 实底 + 顶部内高光。
- ❌ 时间戳做成 hover 才显示——UAT 已改常驻；忘了 `white-space: nowrap` 会换两行。
- ❌ 代码块用横向滚动作为主策略——350px 窄面板优先 `pre-wrap` 换行。
- ❌ 渲染空气泡——tool-call-only turn（无文本）不要出 ChatBubble。
- ❌ 漏 `flex-shrink: 0` / `min-width: 0`——会被 flex column 压扁或撑破窄面板。

## Origin

- 线上：`src/styles.css`「ChatBubble」「ChatStream empty state」段；`src/components/ChatBubble.tsx` / `ChatStream.tsx`。
- 设计稿：`sources/design-package/README.md` §3（Empty State）+ §4b（MessageBubble）+ §「聊天流核心行为」。
- UAT 决策：时间戳常驻 + 气泡间距 16px + 空 turn 不渲染（2026-05-29）。
