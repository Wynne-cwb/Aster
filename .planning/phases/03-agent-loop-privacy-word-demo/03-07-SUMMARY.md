---
phase: 03-agent-loop-privacy-word-demo
plan: 07
subsystem: agent-ui
tags: [agent, ui, control-bar, pause, abort, soft-landing, glassmorphism]
requires:
  - "src/agent/agentStore.ts (Plan 03)"
  - "src/components/icons.tsx base spread pattern"
  - "src/styles.css 设计 token（--glass-bg / --brand-grad / --text-3 / --sp-* / --r-pill）"
provides:
  - "AgentControlBar 组件（pause + abort + step counter）"
  - "PauseIcon + PlayIcon 内联 SVG"
  - ".aster-agent-bar 视觉 token 块"
  - "App.tsx 顶部常驻 AgentControlBar 挂载点"
affects:
  - "src/App.tsx (插入挂载点)"
  - "src/styles.css (新增样式块)"
  - "src/components/icons.tsx (追加 2 个图标)"
  - "src/i18n/locales/zh-CN/messages.po (新增 4 文案)"
tech-stack:
  added: []
  patterns:
    - "Zustand selector pattern（按字段订阅，避免全 store re-render）"
    - "条件 null return（idle 不渲染）"
    - "三态视觉切换：running / paused / soft-landing → 三套按钮布局"
    - "lingui macro t`...` + getByLabelText 配套测试范式"
key-files:
  created:
    - "src/components/AgentControlBar.tsx"
    - "src/components/AgentControlBar.test.tsx"
  modified:
    - "src/components/icons.tsx"
    - "src/App.tsx"
    - "src/styles.css"
    - "src/i18n/locales/zh-CN/messages.po"
    - "src/i18n/locales/zh-CN/messages.ts"
decisions:
  - "中止按钮复用现有 StopIcon（不引入第三个相似图标 SquareIcon），语义上「中止 agent run」与「停止流」皆为「立即终止当前动作」"
  - "AgentControlBar wrap 一层 .aster-shell__agent-bar div + :empty 折叠，避免 idle 态 wrapper 撑出空白条"
  - "按钮 28×28 比默认 .aster-iconbtn 36×36 小一号，匹配 11px step counter 的紧凑感"
  - "focus-visible accent 用 box-shadow + --brand 实色 ring，不用 background-clip:text（避免按钮变透明色块）"
  - "soft-landing 态隐藏 pause/resume —— 继续/结束的入口在 ChatStream 内特殊消息卡片（Plan 05 落），bar 只保留 step counter + 中止"
metrics:
  duration: "~5min"
  completed: "2026-05-28T17:39Z"
  tests-added: 7
  files-created: 2
  files-modified: 5
  commits: 4
  bundle-impact: "+2.16KB gzipped main.js (75.24 → 77.40)；+0.17KB CSS (4.32 → 4.49)"
---

# Phase 3 Plan 07: AgentControlBar Summary

完整版 AgentControlBar 落地 —— 玻璃拟态胶囊 + step counter `N / 20` + pause/resume + 中止按钮，在 agent run 期间常驻 Task Pane 顶部，idle 时 return null 不占位。视觉走 CLAUDE.md §UI 设计系统：`--glass-bg` 玻璃拟态容器 + `--brand-grad` 仅作 focus accent + 11px tabular-nums 步数小字。

> 注：PLAN.md `<output>` 段指示创建 `03-06-SUMMARY.md`，但 PLAN 文件本身是 `03-07-PLAN.md`（frontmatter `plan: 07`、commits 全用 `(03-07)` scope）。SUMMARY 按 plan 数字 `03-07-SUMMARY.md` 命名以保持配对一致。

## What Shipped

### Task 6.1 — PauseIcon + PlayIcon (commit `83ba5bb`)

新增两个 Lucide 风 SVG 图标到 `src/components/icons.tsx`（L165-181），复用现有 `{...base}` spread 模式：

```tsx
/** 暂停 — 两条粗竖线 */
export function PauseIcon(): ReactElement {
  return (
    <svg {...base}>
      <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 继续（播放）— 实心三角 */
export function PlayIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M7 4 L20 12 L7 20 Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

设计点：
- `fill="currentColor" stroke="none"` 体现「暂停 / 播放」块感（与 StopIcon 同款实心风格，区别于 EyeIcon 等线框风格）
- PlayIcon 三角顶点 `(7,4) (20,12) (7,20)` —— 右指三角宽度填满 22px 内距
- 沿用 24×24 viewBox + `aria-hidden`（由父按钮提供 `aria-label`）

### Task 6.2 — AgentControlBar 完整版 (commit `66310a3` RED + `8d84156` GREEN)

**JSX 结构图（`src/components/AgentControlBar.tsx`，全文 63 行）：**

```
<div className="aster-agent-bar" role="status" aria-live="polite">
  <span className="aster-agent-bar__step" aria-label="当前步骤">
    {currentStep} / 20
  </span>
  {status !== 'soft-landing' && (
    <button className="aster-iconbtn aster-agent-bar__btn"
            onClick={isPaused ? resume : pause}
            aria-label={isPaused ? '继续' : '暂停'}>
      {isPaused ? <PlayIcon /> : <PauseIcon />}
    </button>
  )}
  <button className="aster-iconbtn aster-agent-bar__btn"
          onClick={() => abort('user')}
          aria-label="中止">
    <StopIcon />
  </button>
</div>
```

**Aria-label 列表（i18n 必须）：**

| Element                       | aria-label | Trigger                |
|-------------------------------|------------|------------------------|
| `<span class=__step>`         | `当前步骤` | 仅描述性，无交互       |
| `<button>` running 态         | `暂停`     | → `pause()`            |
| `<button>` paused 态          | `继续`     | → `resume()`           |
| `<button>` 中止（始终显示）   | `中止`     | → `abort('user')`      |

**三态行为表：**

| `agentStatus`    | DOM 渲染                                          |
|------------------|---------------------------------------------------|
| `idle`           | `return null`（DOM 中不存在）                     |
| `running`        | step + Pause（暂停）+ Stop（中止）                |
| `paused`         | step + Play（继续）+ Stop（中止）                 |
| `soft-landing`   | step + Stop（中止）；**无 pause/resume 按钮**     |

`soft-landing` 隐藏 pause/resume 的原因：loop 已停在 step 20 等待用户决策，「继续 20 步」入口在 ChatStream 内特殊消息卡片（Plan 05 落），不是 bar 上的按钮。bar 上保留中止作兜底。

**Zustand selector pattern（避免全 store re-render，PATTERNS L468-477）：**

```tsx
const status = useAgentStore((s) => s.agentStatus);
const currentStep = useAgentStore((s) => s.currentStep);
const pause = useAgentStore((s) => s.pause);
const resume = useAgentStore((s) => s.resume);
const abort = useAgentStore((s) => s.abort);
```

`runningTools` / `currentRunId` / `controller` / `lastAbortReason` 这些字段 AgentControlBar 不订阅 —— 它们变化时 bar 不重 render。

### `src/styles.css` 新增样式块（L1407-1463，57 行）

使用的设计 token（CLAUDE.md §UI 设计系统）：

| 选择器                       | 用到的 token                                         | 视觉效果                              |
|------------------------------|------------------------------------------------------|---------------------------------------|
| `.aster-agent-bar`           | `--glass-bg`, `--glass-border`, `--shadow-card`      | 玻璃拟态半透明 + 边框 + 卡片阴影      |
| `.aster-agent-bar`           | `--r-pill`, `--sp-1`, `--sp-2`, `--sp-3`             | pill 圆角 + 4/8/12 间距节奏           |
| `.aster-agent-bar`           | `backdrop-filter: blur(12px)`                        | 玻璃模糊                              |
| `.aster-agent-bar__step`     | `--text-3`, `tabular-nums`, `11px`                   | 与 CostBadge 同款步数小字             |
| `.aster-agent-bar__btn`      | `28x28` + `--r-sm`                                   | 比默认 `.aster-iconbtn` 36×36 紧凑    |
| `.aster-agent-bar__btn`(svg) | `14x14`                                              | 比默认 18×18 小一号                   |
| `:focus-visible`             | `--brand-grad`, `--brand`                            | 渐变 padding box + 实色 ring（accent）|
| `.aster-shell__agent-bar`    | `--sp-4`, `--sp-2`, `:empty`                         | 包裹层 padding；idle 时折叠           |
| `@media prefers-reduced-motion` | `transition: none`                                | 无障碍降级                            |

**为何按钮 28×28 不沿用默认 36×36：** 默认 .aster-iconbtn 是给 .aster-topbar 设置按钮用的（齿轮放在顶部固定行），那里有大面积 padding。AgentControlBar 是个紧凑胶囊，11px 步数小字 + 36×36 按钮比例失衡，28×28 + 14px 图标更对得上。

**关键决策 — `.aster-shell__agent-bar:empty`：** AgentControlBar idle 时 `return null` 会让父 div 变成空节点；用 `:empty` 选择器在空时去掉 padding-top / padding-x，避免空 wrapper 留 8px 空白条。

### `src/App.tsx` 挂载位置（L19, L90-94）

```tsx
import AgentControlBar from './components/AgentControlBar';   // L19

// L90-94：在 .aster-topbar 与 .aster-chat 之间
{/* 1.5. AgentControlBar — agent run 期间显示 step counter + pause/resume + abort
        （AGENT-02 / AGENT-12 / AGENT-13；idle 时 return null 不占位） */}
<div className="aster-shell__agent-bar">
  <AgentControlBar />
</div>
```

视觉序：未配 Key 提示条 → 顶部行（ContextCard + 设置）→ **AgentControlBar** → 聊天流 → 输入栏 → Settings overlay → Onboarding modal。

### `src/components/AgentControlBar.test.tsx`（96 行，7 it 全绿）

| #  | 用例                                                          | 断言点                                                              |
|----|---------------------------------------------------------------|---------------------------------------------------------------------|
| 1  | agentStatus='idle' → 不渲染                                   | `container.firstChild === null`                                     |
| 2  | running currentStep=3 → 渲染 "3 / 20" + 暂停 + 中止           | textContent 含 `3 / 20`；getByLabelText 拿到「暂停」「中止」        |
| 3  | paused currentStep=5 → 渲染 "5 / 20" + 继续 + 中止            | textContent 含 `5 / 20`；getByLabelText 拿到「继续」                |
| 4  | soft-landing → step + 中止，**无暂停/继续**                   | queryByLabelText('暂停')/'继续' 返回 null                           |
| 5  | 点暂停（running 态）                                          | `useAgentStore.getState().agentStatus === 'paused'`                 |
| 6  | 点继续（paused 态）                                           | `useAgentStore.getState().agentStatus === 'running'`                |
| 7  | 点中止                                                        | `lastAbortReason==='user'` + `agentStatus==='idle'` + `signal.aborted===true` |

**i18n mock 套路（与 PATTERNS 范式对齐）：**

```tsx
vi.mock('@lingui/react/macro', () => ({
  useLingui: () => ({
    t: (s: TemplateStringsArray) => String.raw({ raw: s }),
    i18n: { _: (s: string) => s },
  }),
}));
```

`t\`暂停\`` 在 jsdom 下走 `String.raw({raw:['暂停']})` 返回 `'暂停'` 原文，配 `getByLabelText('暂停')` 直接命中按钮，无需 babel-plugin-macros。

### i18n catalog 同步

新增 4 个文案（lingui extract），均落到 `src/i18n/locales/zh-CN/messages.po`：

| msgid     | hash       | 用法                                  |
|-----------|------------|---------------------------------------|
| 中止      | `Uy/gTk`   | 中止按钮 aria-label / title           |
| 当前步骤  | `wQIhE/`   | step counter aria-label               |
| 暂停      | `ninQY1`   | running 态切换按钮                    |
| 继续      | `8Ta649`   | paused 态切换按钮                     |

`messages.ts`（lingui compile 产物）也一并同步提交，避免下次 build 时出现 dirty diff。

## Deviations from Plan

### 自动调整 / Rule 3 阻塞修复

**1. [Rule 3 - Blocker] 跑 lingui extract 同步 messages.po**
- **Found during：** Task 6.2 跑 npm test 时 `src/i18n/coverage.test.ts` 失败 — 该测试是结构性守门，新引入的 macro 文案必须立刻被 extract 到 messages.po，否则 fail
- **Issue：** AgentControlBar 引入 4 个新 `t\`...\`` 文案（中止/当前步骤/暂停/继续），coverage.test.ts 检测到 working tree 与 HEAD diff 后 throw
- **Fix：** 跑 `npm run extract`，把变更的 messages.po + messages.ts 一并 stage 进 Task 6.2 GREEN commit
- **Files：** `src/i18n/locales/zh-CN/messages.po`, `src/i18n/locales/zh-CN/messages.ts`
- **Commit：** `8d84156` (与 GREEN 一起)

注：这是 plan 中预期的工作流（i18n catalog 与代码同步是常规要求），coverage.test.ts 已经把它升级成了 structural gate（CLAUDE.md MEMORY 提到的「Recurring failure → add gate」实践），不再需要靠纪律。

### 视觉决策（PLAN 留 discretion 的部分）

**2. [视觉细节] 按钮 28×28 而非默认 36×36 + 包裹 div 用 :empty 折叠**
- PLAN 原文说「具体位置由 v1 App.tsx 现有 layout 决定」，留 discretion
- 选择 28×28 是为匹配 11px 步数小字的紧凑感（36×36 会让 bar 显得空旷不平衡）
- `.aster-shell__agent-bar:empty` 是 idle 折叠 wrapper 的关键 —— 避免空 div 留 8px 空白条
- 视觉验证延到 Plan 08 真机 UAT（PLAN verification 段约定）

**3. [图标命名] 中止按钮复用 StopIcon 不新建 SquareIcon**
- PATTERNS L567-569 建议「保持 SquareIcon 单独导出便于将来差异化」
- 当前未差异化（中止 agent / 停止流 都是「立即终止」），重复导出空增维护负担
- 真要差异化时再 split（YAGNI）

### Auth gates / 真正的偏差

无。

## Threat Flags

无新增 trust boundary（plan threat_model 已记录 T-06-01 / T-06-02，都按 mitigate / accept 处理）。

## Files Created / Modified

```
新增：
  src/components/AgentControlBar.tsx        (63 行)
  src/components/AgentControlBar.test.tsx   (96 行)
  .planning/phases/03-agent-loop-privacy-word-demo/03-07-SUMMARY.md

修改：
  src/components/icons.tsx                  (+19 行：PauseIcon + PlayIcon)
  src/App.tsx                               (+7 行：import + wrap div)
  src/styles.css                            (+57 行：.aster-agent-bar* block)
  src/i18n/locales/zh-CN/messages.po        (+15 行：4 新 msgid)
  src/i18n/locales/zh-CN/messages.ts        (compiled，~1 行)
```

## Verification Results

```
npm test:        260/260 passed; 23/23 test files passed
                 (3 baseline unhandled rejections in retry/queue tests — ignored per plan)
npm run build:   ✓ built in 1.16s
npm run size:    77.27 KB / 80 KB budget (96.6%)
                 增量: +2.16 KB main.js gzip (Plan 03 后 75.24 → 77.40)
                       +0.17 KB CSS gzip (4.32 → 4.49)
```

## Success Criteria

- [x] **AGENT-02** 软着陆触发后 AgentControlBar 仍显示 step counter ("20 / 20")：Test 4 覆盖
- [x] **AGENT-13** 单一 abort 入口在 UI 层实现：中止按钮唯一调 `abort('user')`，Test 7 断言 `lastAbortReason === 'user'` + `controller.signal.aborted === true`
- [x] **SC2** 「失控控制可观察」：用户能看到 step counter (`N / 20`) + pause/abort 按钮，状态变化通过 `role="status"` + `aria-live="polite"` 对屏幕阅读器可达

## Plan 08 真机 UAT 视觉验证清单

留给 Plan 08 真机阶段（Office Web sideload）确认的视觉细节：

1. **玻璃拟态质感** — `backdrop-filter: blur(12px)` 在 Edge / Chrome 三宿主 webview 下是否生效（Office iframe 可能受 host CSP 影响）
2. **品牌渐变 accent** — focus-visible 时按钮是否出现紫→靛→蓝渐变环，不染整按钮色块
3. **step counter 字号对比** — 11px 步数小字在 100% 缩放 + 中文字体 (Noto Sans SC) 下是否可读、不模糊
4. **三态切换动画** — running → paused → soft-landing 切换时背景 transition 是否平滑（180ms / cubic-bezier）
5. **idle 折叠效果** — agentStatus 从 running → idle 时，bar 消失，下方 .aster-chat 不上跳，`.aster-shell__agent-bar:empty` 折叠 padding 是否生效
6. **窄面板适配** — Task Pane 350px 最小宽度下，bar 是否仍能完整显示（"20 / 20" + 2 按钮 ≈ 100px，应无溢出）
7. **深色主题** — `data-theme="dark"` 下玻璃拟态 + 渐变是否仍然好看（`--glass-bg: rgba(30,41,59,0.58)` 配色）

## Self-Check: PASSED

文件存在：
- `FOUND: src/components/AgentControlBar.tsx`
- `FOUND: src/components/AgentControlBar.test.tsx`
- `FOUND: .planning/phases/03-agent-loop-privacy-word-demo/03-07-SUMMARY.md`

Commits 存在：
- `FOUND: 83ba5bb` (feat: PauseIcon + PlayIcon)
- `FOUND: 66310a3` (test: RED)
- `FOUND: 8d84156` (feat: GREEN + i18n)

Verify：
- `npm test`: 260/260 passed
- `npm run build`: ok
- `npm run size`: 77.27KB / 80KB budget
