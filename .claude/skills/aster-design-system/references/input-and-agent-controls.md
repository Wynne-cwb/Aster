# 输入栏 与 代理控制（Input & Agent Controls）

底部 InputBar（选区胶囊 + textarea + 工具行 + 发送/停止）与 in-flight 的 AgentControlBar（quiet pill：step / phase / pause / abort）。

> 实现：`src/components/InputBar.tsx` · `src/components/SelectionPill.tsx` · `src/components/AgentControlBar.tsx`。CSS 在 `src/styles.css`「SelectionPill (selpill)」「InputBar (inputbar-wrap)」「AgentControlBar」「btn-icon」段。

## Design Decisions

### InputBar（自上而下三段）
1. **选区胶囊行 `.selpill-row`**（可选）：teal soft 底胶囊「[doc icon] {host 选区描述} [eye/eyeOff]」——eye 切「选中内容自动附带」开关。**ContextRow 已整条移除**（设计稿 §4 决策）：原来顶部那条「PPT·第 3 张 + 齿轮」没了，设置入口下沉到工具行左下角。
2. **`<textarea.chat-input>`**：auto-grow，min 40px → max 140px，placeholder「输入消息…」/ streaming 时「AI 正在回答…」且 disabled。Enter 发送、Shift+Enter 换行。
3. **工具行 `.tools`**：左齿轮（进设置）+ 左附件（`aria-disabled` ghost，title「文件上传即将开放」——诚实禁用）+ `.tools-spacer` 撑开 + 右发送按钮。

### 发送按钮三态 `.send-btn`（28×28）
- 默认：teal 实底 + `--accent-on` 图标。
- streaming：`[data-streaming]` → 变 `--text` 实底（停止键 ▢）。
- disabled（text 空）：透明底 + `--text-disabled` 图标 + not-allowed。
- ⚠️ disabled 条件 = `isAgentBusy || !text.trim()`（D-04，以约束为准，别照搬有误的 plan 示例）。

### 聚焦态
`.inputbar:focus-within` → border 变 `--border-strong` + `box-shadow: 0 0 0 3px var(--accent-soft)`（teal soft 光晕，不是 ring-focus 双环——输入框用更柔的 3px soft）。

### AgentControlBar（in-flight 控制条，D-04）
- **quiet pill**：`--surface-2` 底 + 1px border + 全圆角，**无 backdrop-filter**（这是设计包没覆盖、Phase 4.5 按 teal 语言新补的 in-flight 面，硬规则 = 0 玻璃拟态）。
- 内容：`.agent-step`（mono `N/20` step 计数）+ `.agent-phase`（当前阶段文案，ellipsis）/ 或 `.agent-stall`（卡住提示）+ 右侧 `.btn-icon`（pause / abort）。
- 浮在 chat 与 input 之间，`margin: 6px 12px 0`。

### btn-icon（通用图标按钮）
AgentControlBar / Settings / 等共用的 28×28 透明图标按钮：hover `--surface-2`，focus `ring-focus`。

## CSS Patterns（线上实测）

### 选区胶囊
```css
.selpill {
  display: inline-flex; align-items: center; gap: 4px;
  background: var(--accent-soft); color: var(--accent);
  border-radius: var(--radius-full); padding: 3px 5px 3px 9px;
  max-width: 100%; overflow: hidden;
}
.selpill.is-disabled { opacity: 0.5; }
.selpill .label { color: var(--accent); font-weight: 500; font-size: var(--fs-11);
  white-space: nowrap; text-overflow: ellipsis; overflow: hidden; flex: 1; }
.selpill .pill-btn { width: 28px; height: 18px; display: inline-flex; align-items: center;
  justify-content: center; background: transparent; border: 0; border-radius: var(--radius-full);
  color: var(--accent); opacity: 0.7; cursor: pointer; flex-shrink: 0; }
.selpill .pill-btn[data-off] { opacity: 0.4; }
.selpill .pill-btn:hover { opacity: 1; }
```

### InputBar 容器 + 输入框 + 工具行
```css
.inputbar-wrap { padding: 8px 12px 12px; background: var(--bg-pane);
  border-top: 1px solid var(--border); flex-shrink: 0; }
.inputbar { background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-3); display: flex; flex-direction: column; }
.inputbar:focus-within { border-color: var(--border-strong); box-shadow: 0 0 0 3px var(--accent-soft); }
.inputbar .selpill-row { padding: 7px 8px 0 10px; }
.inputbar .chat-input {
  border: 0; outline: none; background: transparent; width: 100%; resize: none;
  font-family: var(--font-body); font-size: var(--fs-14); color: var(--text);
  padding: 8px 12px 6px; min-height: 40px; max-height: 140px; line-height: 1.5;
}
.inputbar .chat-input::placeholder { color: var(--text-3); }
.inputbar .tools { display: flex; align-items: center; padding: 4px 6px 6px; gap: 2px; }
.inputbar .tools-spacer { flex: 1; }
.inputbar .tool-btn { width: 28px; height: 28px; display: inline-flex; align-items: center;
  justify-content: center; background: transparent; border: 0; border-radius: var(--radius-2);
  color: var(--text-2); cursor: pointer; }
.inputbar .tool-btn:hover { background: var(--surface-2); color: var(--text); }
.inputbar .tool-btn:focus-visible { box-shadow: var(--ring-focus); }
```

### 发送按钮三态
```css
.inputbar .send-btn {
  width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent); color: var(--accent-on);
  border: 0; border-radius: var(--radius-2); cursor: pointer; flex-shrink: 0;
}
.inputbar .send-btn:hover { background: var(--accent-hover); }
.inputbar .send-btn:disabled { background: transparent; color: var(--text-disabled); cursor: not-allowed; }
.inputbar .send-btn[data-streaming] { background: var(--text); color: var(--bg); }   /* ▢ 停止键 */
.inputbar .send-btn:focus-visible { box-shadow: var(--ring-focus); }
```

### AgentControlBar（quiet pill）+ btn-icon
```css
.agent-bar {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 8px 5px 12px;
  background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--radius-full);
  margin: 6px 12px 0; flex-shrink: 0;
  /* 无 backdrop-filter — D-04, AGENT-01 */
}
.agent-step  { font-family: var(--font-mono); font-size: var(--fs-11); color: var(--text-3); margin-right: 2px; }
.agent-phase { font-size: var(--fs-11); color: var(--text-3); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.agent-stall { font-size: var(--fs-11); color: var(--text-3); flex: 1; }

.btn-icon { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center;
  background: transparent; border: 0; border-radius: var(--radius-2); color: var(--text-2); cursor: pointer; flex-shrink: 0; }
.btn-icon:hover { background: var(--surface-2); color: var(--text); }
.btn-icon:focus-visible { outline: none; box-shadow: var(--ring-focus); }
```

## HTML Structure
```
.inputbar-wrap
  └ .inputbar
     ├ .selpill-row > .selpill          (可选；pillVisible 时)
     ├ textarea.chat-input
     └ .tools
        ├ .tool-btn (齿轮→设置)
        ├ .tool-btn (附件, aria-disabled)
        ├ .tools-spacer
        └ .send-btn ([data-streaming] / :disabled 三态)

.agent-bar  (in-flight 时浮在 chat↔input 之间)
  ├ .agent-step (N/20)
  ├ .agent-phase | .agent-stall
  └ .btn-icon (pause) + .btn-icon (abort)
```

## What to Avoid

- ❌ 给 AgentControlBar 加 backdrop-filter / 玻璃拟态——硬规则 0，用 `--surface-2` 实底 pill。
- ❌ 把设置入口放回顶部 ContextRow——已移除，入口在工具行齿轮。
- ❌ 附件按钮造假「已支持」——`aria-disabled` + title「即将开放」（诚实禁用）。
- ❌ 输入框聚焦用 ring-focus 双环——这里特意用更柔的 `0 0 0 3px var(--accent-soft)`。
- ❌ 发送按钮 disabled 条件写错——`isAgentBusy || !text.trim()`。

## Origin

- 线上：`src/styles.css` 上述各段；`src/components/InputBar.tsx` / `SelectionPill.tsx` / `AgentControlBar.tsx` / `formatSelection.ts`。
- 设计稿：`sources/design-package/README.md` §4e（InputBar）+ §4（ContextRow 移除决策）。
- AgentControlBar 为设计包空白、Phase 4.5 按 teal 语言新补（README INDEX §「设计包对代理运行时 UX 是空白的」）。
