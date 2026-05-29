---
phase: quick
plan: 260529-vtc
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/debugReport.ts
  - src/lib/debugReport.test.ts
  - src/components/icons.tsx
  - src/components/InputBar.tsx
autonomous: true
requirements: [QUICK-260529-VTC]
must_haves:
  truths:
    - "InputBar 工具行有一个剪贴板图标按钮，始终可见，与齿轮风格一致（tool-btn）"
    - "点击按钮，buildDebugReport() 组装 Markdown 报告并复制到剪贴板，无需额外操作"
    - "报告包含：环境信息、Provider 配置（含选了哪些 Key）、Agent 状态、当前选区元信息 + 正文、完整聊天记录"
    - "API Key 原文绝不出现在报告里（只输出 configuredKeyIds — id 列表）"
    - "复制成功后按钮给 2 秒「已复制」反馈，之后自动恢复"
    - "npm test（tsc + vitest）全通过，含 Key 不泄露守门测试"
  artifacts:
    - path: "src/lib/debugReport.ts"
      provides: "buildDebugReport(): Promise<string> + copyToClipboard(text): Promise<boolean>"
      exports: ["buildDebugReport", "copyToClipboard"]
    - path: "src/lib/debugReport.test.ts"
      provides: "vitest 单元测试，含 Key 不泄露守门断言"
      contains: "API Key 守门"
    - path: "src/components/icons.tsx"
      provides: "ClipboardIcon 内联 SVG"
      contains: "ClipboardIcon"
    - path: "src/components/InputBar.tsx"
      provides: "复制调试信息按钮，tool-btn 风格"
      contains: "buildDebugReport"
  key_links:
    - from: "src/components/InputBar.tsx"
      to: "src/lib/debugReport.ts"
      via: "import { buildDebugReport, copyToClipboard }"
      pattern: "buildDebugReport|copyToClipboard"
    - from: "src/lib/debugReport.ts"
      to: "src/store/providers.ts"
      via: "useProviderStore.getState().configuredKeyIds"
      pattern: "configuredKeyIds"
---

<objective>
「一键复制调试信息」功能：用户在任意状态点击 InputBar 工具行的剪贴板按钮，得到一段结构化 Markdown 报告（包含环境 / Provider 配置 / Agent 状态 / 当前选区 + 正文 / 聊天记录），复制到剪贴板后直接粘给 Claude 即可排查问题。

Purpose: Phase 后续 BUG 排查提速——把散落在多个 Store、Office API 的调试信息聚合成一次复制的结构化文本，取代截图 + 口头描述。

Output: debugReport.ts（纯函数模块）、debugReport.test.ts（守门测试）、icons.tsx 新增 ClipboardIcon、InputBar.tsx 工具行加按钮。
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
</context>

<interfaces>
<!-- 从代码库提取，executor 直接使用，无需重新探索 -->

从 src/adapters/DocumentAdapter.ts：
```typescript
// SelectionContext — discriminated union
type SelectionContext =
  | { kind: 'ppt'; slideIndex: number; slideCount: number }
  | { kind: 'excel'; address: string }
  | { kind: 'word'; charCount: number }
  | { kind: 'none' };
```

从 src/store/chat.ts：
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool' | 'error';
  content: string;
  isStreaming?: boolean;
  ts?: number;
  errorCode?: string;
  retryPrompt?: string;
  toolCalls?: ToolCall[];
  toolCallId?: string;
  toolName?: string;
  toolResult?: ToolResult;   // { ok: boolean, data?, error?: { code, message, hint? } }
  agentRunId?: string;
  agentStep?: number;
}
// 访问：useChatStore.getState().messages
```

从 src/store/providers.ts（根据 codebase_findings）：
```typescript
// 访问：useProviderStore.getState()
// 字段：
//   defaultLLMProviderId: string
//   providers: ProviderConfig[]    // { id, name, baseURL, model, isBuiltIn?, supportsToolCall? }
//   configuredKeyIds: string[]     // 只含 id，不含 Key 值
//   attachEnabled: boolean
// ⚠️ 绝不调 getKey() / 读 aster:keys:* localStorage
```

从 src/agent/agentStore.ts（根据 codebase_findings）：
```typescript
// 访问：useAgentStore.getState()
// 字段：
//   agentStatus: string
//   currentStep: number
//   lastAbortReason: string | null
//   lastCircuitInfo: { toolName: string; code: string; count: number } | null
//   currentPhase: string
```

从 src/store/selection.ts：
```typescript
// 访问：useSelectionStore.getState().initial — SelectionContext（元信息，无文本）
// ⚠️ 不含正文，正文需从 Office API 异步读取（见 Task 1 action）
```

从 src/utils/formatTime.ts：
```typescript
export function formatTime(ts: number): string
// 将 Unix ms 时间戳格式化为 "MM-DD HH:MM"
```

InputBar.tsx 工具行现有结构（src/components/InputBar.tsx 第 96-126 行）：
```tsx
<div className="tools">
  <button type="button" className="tool-btn" aria-label={t`设置`} onClick={() => onGoSettings()}>
    <GearIcon size={15} strokeWidth={1.4} />
  </button>
  <button type="button" className="tool-btn" aria-disabled="true" aria-label={t`文件上传`} ...>
    <PaperclipIcon size={15} />
  </button>
  <span className="tools-spacer" />
  <button type="button" className="send-btn" ...>...</button>
</div>
```

icons.tsx 现有图标范式（Lucide 风，须遵循）：
```tsx
// props: size?: number (default 16), strokeWidth?: number (default 1.5)
// viewBox="0 0 24 24", fill="none", stroke="currentColor"
// 示例结构：
export function GearIcon({ size = 16, strokeWidth = 1.5 }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* path elements */}
    </svg>
  );
}
```
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: 新建 debugReport.ts 纯函数模块 + 守门测试</name>
  <files>src/lib/debugReport.ts, src/lib/debugReport.test.ts</files>
  <behavior>
    - buildDebugReport() 返回含 5 个 Markdown 分节的字符串（见下）
    - 若 Provider 配了 Key（id 在 configuredKeyIds），报告输出 id，绝不输出 Key 原文
    - 选区正文：kind=excel → Excel.run 读 selected range values；kind=word → Word.run 读 selection.text；kind=ppt → 无文本（注明"PPT 宿主，无法读取正文"）；kind=none → "无选区"；Office API 不可用时 try/catch → "无法读取（Office API 不可用）"
    - 空消息列表时报告正常生成，无崩溃
    - copyToClipboard(text) 先 navigator.clipboard.writeText，失败则 fallback textarea + execCommand('copy')，返回 boolean

    守门测试（必须通过）：
    - [KEY GATE] 即使某 provider 的 localStorage 里存了 Key 值 `sk-SECRET-abc123`（mock configuredKeyIds 包含该 provider id），buildDebugReport() 输出字符串里绝不包含 `sk-SECRET-abc123`
    - [SECTIONS] 报告含 5 个 ## 分节标题：## 环境、## Provider 配置、## Agent 状态、## 当前选区、## 聊天记录
    - [EMPTY MESSAGES] messages=[] 时 buildDebugReport() 不抛错，聊天记录节输出「（无消息）」
    - [SELECTION TEXT] kind=word 且 mock Word.run 返回 charCount=5，text="测试文字"，报告含 "测试文字"（正文）
  </behavior>
  <action>
新建 src/lib/debugReport.ts：

```
export async function buildDebugReport(): Promise<string>
export async function copyToClipboard(text: string): Promise<boolean>
```

**buildDebugReport 组装逻辑（分节顺序）：**

报告头：`# Aster Debug Report\n生成时间：${new Date().toISOString()}\n`

**## 环境**
- `Office.context.diagnostics`（try/catch，不可用则 "N/A"）：host / platform / version
- `navigator.userAgent`（截取前 120 字）
- `document.querySelector('#root')?.dataset.theme ?? 'unknown'`
- `typeof Office !== 'undefined'`（是否在 Office 环境里）
- `import.meta.env.BASE_URL`

**## Provider 配置**
从 `useProviderStore.getState()`：
- `defaultLLMProviderId`
- `attachEnabled`
- providers 列表：每个 `{ id, name, baseURL, model, isBuiltIn, supportsToolCall }` 各一行
- `configuredKeyIds`（输出 id 数组）
- ⚠️ **绝不调 getKey()，绝不读 localStorage**

**## Agent 状态**
从 `useAgentStore.getState()`：
- `agentStatus`, `currentStep`, `currentPhase`
- `lastAbortReason`（null → "无"）
- `lastCircuitInfo`（null → "无"；否则 `toolName/code/count`）

**## 当前选区**
从 `useSelectionStore.getState().initial`（元信息）+ Office API 读正文（async）：
- `kind: none` → "无选区"
- `kind: ppt` → slideIndex/slideCount，注明"PPT 宿主暂无正文读取"
- `kind: excel` → address，然后 try `await Excel.run(async ctx => { const r = ctx.workbook.getSelectedRange(); r.load('values,text'); await ctx.sync(); return r.text; })`；成功→输出前 500 字符（防超长）；失败→"无法读取（Office API 不可用）"
- `kind: word` → charCount，然后 try `await Word.run(async ctx => { const sel = ctx.document.getSelection(); sel.load('text'); await ctx.sync(); return sel.text; })`；成功→输出前 500 字符；失败→"无法读取（Office API 不可用）"

**## 聊天记录**
从 `useChatStore.getState().messages`：
- 空→"（无消息）"
- 否则每条消息：`[${formatTime(msg.ts ?? 0)} ${msg.role}] ${msg.content.slice(0, 300)}${msg.content.length > 300 ? '…' : ''}`
  - role=tool 时追加：`toolName=${msg.toolName} ok=${msg.toolResult?.ok}`
  - role=error 时追加：`errorCode=${msg.errorCode}`
  - isStreaming=true 时追加：`[streaming]`

**copyToClipboard 逻辑：**
```
try {
  await navigator.clipboard.writeText(text);
  return true;
} catch {
  // fallback: textarea + execCommand
  const ta = document.createElement('textarea');
  ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta); ta.focus(); ta.select();
  const ok = document.execCommand('copy');
  document.body.removeChild(ta);
  return ok;
}
```

**测试文件 src/lib/debugReport.test.ts：**

用 vitest + vi.mock 方式 mock 各 store：
- mock `../store/providers` → `useProviderStore.getState()` 返回包含一个 provider（configuredKeyIds=['prov-1']），**但 localStorage 里 `aster:keys:prov-1` = `sk-SECRET-abc123`**（用 `localStorage.setItem` 在测试里设置）
- KEY GATE 测试：`expect(report).not.toContain('sk-SECRET-abc123')`
- SECTIONS 测试：['## 环境', '## Provider 配置', '## Agent 状态', '## 当前选区', '## 聊天记录'].forEach(h => expect(report).toContain(h))
- EMPTY MESSAGES 测试：mock messages=[]，`expect(report).toContain('（无消息）')`
- SELECTION TEXT 测试：mock useSelectionStore initial = { kind: 'word', charCount: 5 }；mock global Word.run 返回 text="测试文字"；`expect(report).toContain('测试文字')`
  </action>
  <verify>
    <automated>cd /Users/wb.chen/Documents/Project/Aster && npx tsc --noEmit && npx vitest run src/lib/debugReport.test.ts</automated>
  </verify>
  <done>debugReport.ts 导出 buildDebugReport/copyToClipboard；debugReport.test.ts 4 个断言全通过，含 KEY GATE 守门</done>
</task>

<task type="auto">
  <name>Task 2: icons.tsx 加 ClipboardIcon + InputBar 加复制调试信息按钮</name>
  <files>src/components/icons.tsx, src/components/InputBar.tsx</files>
  <action>
**icons.tsx — 新增 ClipboardIcon（Lucide 风）：**

在 icons.tsx 现有图标末尾追加 `ClipboardIcon`，遵循 Lucide ClipboardCopy 路径：
```tsx
export function ClipboardIcon({ size = 16, strokeWidth = 1.5 }: IconProps): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {/* Lucide clipboard-copy 路径 */}
      <rect x="9" y="2" width="6" height="4" rx="1" ry="1" />
      <path d="M9 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
      <path d="M16 4h2a2 2 0 0 1 2 2v4" />
      <path d="M21 14H11" />
      <path d="m15 10-4 4 4 4" />
    </svg>
  );
}
```

（若 path 视觉有问题，可换 Lucide clipboard 路径：`<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>`）

**InputBar.tsx — 在 gear 按钮后、paperclip 前插入复制调试信息按钮：**

1. 新增 import：
   ```tsx
   import { useState } from 'react';  // 已有，确认
   import { ClipboardIcon } from './icons';
   import { buildDebugReport, copyToClipboard } from '../lib/debugReport';
   ```

2. 在组件内 useState 区加：
   ```tsx
   const [copied, setCopied] = useState(false);
   ```

3. 加 handler：
   ```tsx
   const handleCopyDebug = async (): Promise<void> => {
     const report = await buildDebugReport();
     const ok = await copyToClipboard(report);
     if (ok) {
       setCopied(true);
       setTimeout(() => setCopied(false), 2000);
     }
   };
   ```

4. 在 `.tools` div 里，gear 按钮之后、paperclip 按钮之前插入：
   ```tsx
   <button
     type="button"
     className="tool-btn"
     aria-label={copied ? t`已复制` : t`复制调试信息`}
     title={copied ? t`已复制` : t`复制调试信息`}
     onClick={() => void handleCopyDebug()}
   >
     <ClipboardIcon size={15} strokeWidth={1.4} />
   </button>
   ```

   按钮无 disabled/aria-disabled（始终可用，与齿轮一致，per 锁定决策 1）。
   `copied` 状态只改 aria-label/title，图标不变（简洁，避免复杂状态切换；若要进一步反馈可在 title 里体现"已复制 ✓"）。
  </action>
  <verify>
    <automated>cd /Users/wb.chen/Documents/Project/Aster && npx tsc --noEmit</automated>
  </verify>
  <done>ClipboardIcon 在 icons.tsx 导出；InputBar 工具行 gear 旁有剪贴板按钮，tsc 无报错，npm test 全通过</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    - debugReport.ts：buildDebugReport() 组装 5 节 Markdown + copyToClipboard() 双模式写剪贴板
    - debugReport.test.ts：4 个断言通过，含 KEY GATE 守门
    - icons.tsx：ClipboardIcon 新增
    - InputBar：工具行 gear 旁新增剪贴板按钮，点击 → 复制 → 2 秒「已复制」反馈
    - npm test（tsc + vitest）全通过
  </what-built>
  <how-to-verify>
    1. 在 Office for Web（或本地 dev server `npm start`）打开 Aster Task Pane
    2. 确认 InputBar 工具行：gear 右边有剪贴板图标按钮（细线风格，与 gear 尺寸一致）
    3. 不发任何消息，直接点剪贴板按钮 → 应立即（无卡顿）复制成功，按钮 title 变为「已复制」，2 秒后恢复
    4. 打开文本编辑器粘贴，检查报告结构：
       - 有 `# Aster Debug Report` 标题和 ISO 时间戳
       - 有 `## 环境`、`## Provider 配置`、`## Agent 状态`、`## 当前选区`、`## 聊天记录` 5 节
       - Provider 配置节含 baseURL / model，但无任何 `sk-` 开头的 Key 字符串
       - 聊天记录节显示「（无消息）」（此时未发消息）
    5. 发一条消息，等回复后再点复制，确认聊天记录节有 user / assistant 两条
    6. 选中一段 Excel / Word 内容再点复制，确认「当前选区」节包含正文文字（或 PPT 宿主的说明）
  </how-to-verify>
  <resume-signal>输入 "approved" 或描述问题</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| 边界 | 说明 |
|------|------|
| Store → buildDebugReport | 报告生成函数读 Zustand store；Key 原文永远不进入此边界 |
| buildDebugReport → clipboard | 报告内容写入 OS 剪贴板；再由用户决定粘贴给谁 |
| Office API → debugReport | Excel/Word.run 读取文档选区正文；数据仅进入内存字符串，不发网络 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vtc-01 | Information Disclosure | buildDebugReport → clipboard | mitigate | 绝不调 getKey()，不读 aster:keys:* localStorage；只输出 configuredKeyIds（id 列表）；守门测试钉死（KEY GATE 断言） |
| T-vtc-02 | Information Disclosure | 选区正文 → 报告 | accept | 用户主动点击复制，属于知情操作；正文截断 500 字符防止超长泄露大段机密文档 |
| T-vtc-03 | Information Disclosure | partitionKey | mitigate | 只记录 `typeof Office.context.partitionKey !== 'undefined'`（boolean），不记录 partitionKey 值 |
| T-vtc-04 | Denial of Service | clipboard API 失败 | mitigate | execCommand fallback，失败静默（按钮不给反馈），不崩溃 |
</threat_model>

<verification>
```bash
cd /Users/wb.chen/Documents/Project/Aster
npm test
# 期待：tsc --noEmit 无错 + vitest run 全绿（含 debugReport.test.ts 4 个断言）
```

KEY GATE 守门输出确认：
```
✓ [KEY GATE] buildDebugReport 输出不包含 API Key 原文
✓ [SECTIONS] 报告含 5 个分节标题
✓ [EMPTY MESSAGES] 空消息时不崩溃，输出（无消息）
✓ [SELECTION TEXT] word 选区正文正确包含在报告里
```
</verification>

<success_criteria>
- `npm test` 全通过（tsc 无报错 + vitest 4 个守门断言全绿）
- InputBar 工具行 gear 旁有剪贴板按钮（tool-btn 风格，始终可见）
- 点击按钮 → 剪贴板内容为 5 节 Markdown 报告，2 秒「已复制」反馈
- 报告内绝无 `sk-` 开头或任何 API Key 字符串（结构性守门覆盖）
- 代码改动仅限 4 个文件，无副作用
</success_criteria>

<output>
完成后在 .planning/quick/260529-vtc-debug/ 下创建 260529-vtc-SUMMARY.md
</output>
