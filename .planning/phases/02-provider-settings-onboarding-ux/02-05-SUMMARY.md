---
phase: "02-provider-settings-onboarding-ux"
plan: "05"
subsystem: "store/adapters"
tags: ["zustand", "chat", "providers", "office-js", "insert", "streaming"]
dependency_graph:
  requires: ["02-02", "02-03", "02-04"]
  provides: ["src/store/chat.ts", "src/store/providers.ts", "adapter insert()"]
  affects: ["src/main.tsx", "02-06", "02-07", "02-08"]
tech_stack:
  added: ["zustand store layer (chat + providers)"]
  patterns:
    - "Zustand create() with get/set for streaming state management"
    - "AbortController + setupVisibilityAbort for visibility-driven cancellation"
    - "hydrateFromStorage() called in Office.onReady before root.render"
    - "PowerPoint.run → textRange.text (not textFrame.text directly)"
    - "Excel two-sync rule: load → sync1 → write → sync2"
key_files:
  created:
    - "src/store/chat.ts"
    - "src/store/providers.ts"
  modified:
    - "src/adapters/PptAdapter.ts"
    - "src/adapters/ExcelAdapter.ts"
    - "src/adapters/WordAdapter.ts"
    - "src/adapters/adapters.test.ts"
    - "src/main.tsx"
decisions:
  - "PowerPoint TextFrame 通过 .textRange.text 赋值（无直接 .text 属性），已修正 PLAN.md 伪代码"
  - "hydrateFromStorage() 在 main.tsx Office.onReady 内、root.render 前调用，确保首次渲染拿到持久化配置"
  - "clearHistory() 在 abort 后重置 isStreaming，防止 UI 卡在 loading 状态"
metrics:
  duration: "5 minutes"
  completed: "2026-05-27"
  tasks: 2
  files_changed: 7
---

# Phase 02 Plan 05: Zustand Stores + Adapter Insert Write-back Summary

**一句话总结：** Zustand chatStore（流式 SSE + AbortController + retry）与 providerStore（storage 持久化 + autoAttach D-15）实现完毕；三宿主 adapter insert({type:'text'}) 桩替换为真实 Office.js 写回（D-16），TypeScript 全通过，测试从 162 增至 165 全绿。

## 产出

### chatStore（src/store/chat.ts）

状态字段：
- `messages: Message[]` — 聊天消息列表（不持久化，Task Pane 关闭即清空 PANE-03）
- `isStreaming: boolean` — 是否正在流式生成
- `abortController: AbortController | null` — 当前请求的 abort 控制器

Actions：
- `sendMessage(prompt, selectionCtx?)` — 构建消息历史 → ProviderRegistry.resolve → OpenAICompatibleLLM.streamChat → 逐字 delta 追加；usage event 计算 costCny（calcCostCny）；AbortError 静默保留已生成内容
- `stopStreaming()` — 调用 abortController.abort()
- `retryMessage(messageId)` — 移除失败气泡，用 retryPrompt 重发（D-11）
- `clearHistory()` — 清空 messages，abort 进行中的请求

Selector hooks（性能优化）：
- `useMessages()` — 仅订阅 messages 数组变化
- `useIsStreaming()` — 仅订阅 isStreaming 布尔值变化

### providerStore（src/store/providers.ts）

内置 Provider（isBuiltIn=true，不可删除）：
- `deepseek`：baseURL=https://api.deepseek.com，model=deepseek-v4-flash
- `aihubmix`：baseURL=https://api.aihubmix.com/v1，model=gpt-image-1

状态字段：
- `providers: ProviderConfig[]` — 含内置 + 用户自定义 Provider
- `defaultLLMProviderId: string` — 默认 LLM Provider，初始值 'deepseek'
- `autoAttach: boolean` — 选区自动附带开关（D-15），初始值从 SELECTION_AUTO_ATTACH storage 读取 ?? true

持久化操作（所有写操作同步 storage）：
- `addProvider` / `updateProvider` / `removeProvider` → 写 STORAGE_KEYS.PROVIDERS
- `setDefaultLLM` → 写 STORAGE_KEYS.DEFAULT_PROVIDER
- `setKey(providerId, key)` → 写 STORAGE_KEYS.KEY_PREFIX + providerId（apiKey 单独存储）
- `getKey(providerId)` → 从 storage 读（供 ProviderRegistry 调用，不暴露给 UI props）
- `setAutoAttach(v)` → 写 STORAGE_KEYS.SELECTION_AUTO_ATTACH（D-15）

### hydrateFromStorage() 在 main.tsx 的调用位置

```typescript
// src/main.tsx — Office.onReady 回调内，root.render 之前
Office.onReady((info) => {
  const adapter = createAdapter(info.host);
  hydrateFromStorage();  // ← 此处：读取 localStorage 恢复 Provider 配置
  // ...
  root.render(...);
});
```

### 三宿主 adapter insert() 实现

| 宿主 | 关键 Office.js API | 特殊约束 |
|------|-------------------|---------|
| PPT | `PowerPoint.run → slide.shapes → textRange.text = value` | 写 textRange.text（非 textFrame.text，类型无此属性） |
| Excel | `Excel.run → workbook.getSelectedRange() → range.load → sync1 → range.values = [[value]] → sync2` | 严格 two-sync（NFR-02 / Pitfall 5） |
| Word | `Word.run → document.getSelection() → sel.insertText(value, InsertLocation.replace) → sync` | replace 模式（替换选区或光标处插入） |

非 text 类型仍抛 `UnsupportedOperationError`（Phase 4/5/6 实现）。

## 测试更新内容

**从 `rejects.toMatchObject({ code: 'UNSUPPORTED' })` 改为 `resolves.toBeUndefined()`（3 个测试）：**
- PptAdapter.insert({type:"text"}) — 改为使用 PowerPoint mock（textRange.text）
- ExcelAdapter.insert({type:"text"}) — 改为使用 Excel mock（range.values two-sync）
- WordAdapter.insert({type:"text"}) — 改为使用 Word mock（insertText replace）

**新增非 text 类型仍 throw 测试（3 个）：**
- PptAdapter.insert({type:"slides"}) → throws UNSUPPORTED
- ExcelAdapter.insert({type:"formula"}) → throws UNSUPPORTED
- WordAdapter.insert({type:"paragraphs"}) → throws UNSUPPORTED

**总测试数：162 → 165（+3）全绿**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed PowerPoint TextFrame.text → textFrame.textRange.text**
- **Found during:** Task 2 TypeScript 编译
- **Issue:** PLAN.md 伪代码写 `shapes.items[0].textFrame.text = content.value`，但 `@types/office-js` 中 `PowerPoint.TextFrame` 无直接 `.text` 属性；正确路径是 `.textRange.text`（PowerPointApi 1.4）
- **Fix:** 改为 `shapes.items[0].textFrame.textRange.text = content.value`；同步更新测试 mock 加入 `textRange` 层
- **Files modified:** `src/adapters/PptAdapter.ts`, `src/adapters/adapters.test.ts`
- **Commit:** b1f310e

## Self-Check: PASSED

- [x] `src/store/chat.ts` 已创建
- [x] `src/store/providers.ts` 已创建
- [x] `src/adapters/PptAdapter.ts` insert() 已更新
- [x] `src/adapters/ExcelAdapter.ts` insert() 已更新
- [x] `src/adapters/WordAdapter.ts` insert() 已更新
- [x] `src/main.tsx` hydrateFromStorage() 已加入
- [x] Task 1 commit: 69c3b32
- [x] Task 2 commit: b1f310e
- [x] `npx vitest run` → 165 pass, 0 fail
- [x] `npx tsc --noEmit` → TypeScript compilation completed (0 errors)
