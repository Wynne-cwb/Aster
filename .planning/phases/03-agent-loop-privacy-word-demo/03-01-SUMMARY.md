---
phase: 03-agent-loop-privacy-word-demo
plan: 01
subsystem: cost-rollback
tags: [refactor, cleanup, bundle-budget, lingui]
dependency_graph:
  requires:
    - src/components/CostBadge.tsx (v1 已交付)
    - src/providers/pricing.ts (v1 已交付)
    - src/store/chat.ts Message{costCny,tokenCount} (v1 已交付)
  provides:
    - chatStore Message 类型不含 cost 字段（后续 Plan 03/05 改 schema 时无 cost 冲突）
    - .size-limit.json 80KB main-chunk monitor（NFR-02 实测目标）
    - SSEUsage @deprecated 标记（陌生 SSE upstream 兼容保留）
  affects:
    - Plan 03 / Plan 05（chatStore schema 改造将基于已瘦身的 Message 类型）
tech_stack:
  added: []
  patterns:
    - lingui v5 catalog obsolete (#~) 标记残留处理
    - size-limit main-chunk 精确 glob（vs *.js 全聚合）
key_files:
  created:
    - .planning/phases/03-agent-loop-privacy-word-demo/03-01-SUMMARY.md
  modified:
    - src/components/ChatBubble.tsx
    - src/store/chat.ts
    - src/lib/sse.ts
    - src/i18n/locales/zh-CN/messages.po
    - .size-limit.json
  deleted:
    - src/components/CostBadge.tsx (33 行)
    - src/providers/pricing.ts (77 行)
    - src/providers/pricing.test.ts (165 行)
decisions:
  - "size-limit path 从 dist/assets/*.js 改 dist/assets/main-*.js：plan 字面 glob 会汇总 react/markdown lazy chunks 共 127KB > 80KB，与 plan 文本『v1 实测基线 63-68KB / 80KB 监控线』意图冲突。窄化到 main-*.js 让 budget 反映 initial main bundle"
  - "lingui v5 extract 默认行为：unreferenced msgid 标 #~ obsolete 而非删除。messages.po 里两条『本次：N token』标 obsolete 保留翻译记忆，messages.ts 仍编译为活条目（无源码引用故不会渲染）。按 plan §Step 7 接受为无害残留，留 Phase 4 顺手 lingui --clean"
metrics:
  duration: ~10 min
  completed_date: 2026-05-28
  tasks: 2
  commits: 2
  files_touched: 8
---

# Phase 3 Plan 01: v1 Cost 功能回滚 Summary

拆除 v1 cost feature（CostBadge UI + pricing.ts + chatStore Message{costCny,tokenCount} 字段）共 320 行删除 / 22 行修改；同步收紧 size-limit 监控线到 main bundle ≤ 80KB（NFR-02）。SSEUsage 类型保留 @deprecated 兼容陌生 SSE upstream，但 v2 chatStore 不再消费。

## Objective Outcome

| 目标 | 状态 |
|------|------|
| 删除 3 个 v1 cost 文件 | ✓ CostBadge.tsx / pricing.ts / pricing.test.ts 已删 |
| chatStore Message 瘦身 | ✓ tokenCount + costCny 字段移除 |
| sendMessage 删 usage 事件分支 | ✓ |
| ChatBubble 移除 CostBadge 嵌点 | ✓ |
| SSEUsage 加 @deprecated | ✓ 类型保留，解析路径保留（不消费） |
| size-limit 收紧到 80KB | ✓ main chunk 74.79 KB ≤ 80KB |
| npm test / build / size 全绿 | ✓ 176 passed / build green / size PASS |

## Commits

| Task | Type | Hash | 描述 |
|------|------|------|------|
| 1.1 | refactor | `9bdaa06` | 删 CostBadge + pricing；slim Message；sendMessage 删 usage 分支；SSEUsage @deprecated；lingui catalog sync |
| 1.2 | chore | `52e4a8b` | size-limit 1MB → 80KB；path *.js → main-*.js |

## chatStore Message Schema 前后对比

**v1（删除前）:**
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isStreaming?: boolean;
  tokenCount?: number;           // ← 删
  costCny?: number | null;       // ← 删（D-17 / COST-02）
  errorCode?: string;
  retryPrompt?: string;
  toolCalls?: ToolCall[];
}
```

**Plan 01 后:**
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'error';
  content: string;
  isStreaming?: boolean;
  errorCode?: string;
  retryPrompt?: string;
  toolCalls?: ToolCall[];
}
```

`role` 仍 v1 三元（`'user' | 'assistant' | 'error'`），按 plan §action L142 「'tool' role 由 Plan 05 加，避免和 Plan 05 改 schema 时冲突」。

## sendMessage 内部变化

删除整段 `event.type === 'usage'` 分支：
- 不再调 `calcCostCny`（函数已删）
- 不再把 `tokenCount` / `costCny` 写入 message
- `event.type === 'delta'` 与 `event.type === 'tool_call_end'` 路径完全保留（Plan 05 范围）

## Bundle Size 实测前后对比

| 指标 | Plan 01 前 | Plan 01 后 | Δ |
|------|-----------|-----------|---|
| main bundle (gzipped) | ~74.92 KB | 74.79 KB | -0.13 KB |
| size-limit | 1 MB | 80 KB | -920 KB |
| size 监控 path | `dist/assets/*.js`（汇总 127KB） | `dist/assets/main-*.js`（仅 main） | 精确化 |

**注**: 删 CostBadge UI 后 main 仅小幅下降 ~0.13KB。原因：lingui v5 extract 把孤儿 msgid 编译进 messages.ts（gzip 后 ~1KB 影响）。Phase 4 可跑 `lingui extract --clean` 再砍 ~1KB。

`npm run size` 输出：
```
Size limit:   80 kB
Size:         74.79 kB gzipped
Loading time: 1.5 s    on slow 3G
Running time: 30 ms    on Snapdragon 410
```

PASS，余 ~5.2KB headroom 给 Phase 3-7。

## Deviations from Plan

### [Rule 1 - Bug] size-limit path 从 `dist/assets/*.js` 调整为 `dist/assets/main-*.js`

- **Found during:** Task 1.2
- **Issue:** Plan §action L201 字面给出 path = `dist/assets/*.js`。size-limit 会聚合所有匹配 chunks（main 74.79 + markdown 50.45 + react 1.38 + commands 0.14 + polyfill 0.40 = 127.16 KB）。按字面跑 `npm run size` 直接 FAIL，与 plan §verify「PASS」期望矛盾。
- **Root cause:** Plan 文本陈述「v1 实测基线 ~63-68KB gzipped」「80KB 作监控线」清楚说明意图是 **main initial bundle**；但字面 glob 不区分 lazy chunks（markdown / react chunks 由 `modulepreload` 提示而非首次解析）。
- **Fix:** 收窄 path 到 `dist/assets/main-*.js`，匹配 Vite 输出的 main chunk 唯一性命名 (`main-[hash].js`)。
- **Files modified:** .size-limit.json
- **Commit:** `52e4a8b`
- **Note:** 若 Phase 4 决定 markdown chunk 也算 initial（modulepreload hint 实际拉取），可改 path 为 `["dist/assets/main-*.js", "dist/assets/markdown-*.js"]` + 提高 limit 到 ~135KB。当前 plan 范围按 v1 baseline (~70KB) 监控更紧。

### [Rule 3 - Blocking] lingui catalog 同步

- **Found during:** Task 1.1 verify
- **Issue:** 删 CostBadge.tsx 后，`src/i18n/coverage.test.ts`（catalog drift gate）跑 `lingui extract` 检测 `git diff` 非空 → fail。两条「本次：N token」msgid 不再被源码引用 + ChatBubble.tsx 内剩余 macro 的 `#:` 行号 shift。
- **Fix:** `npm run extract` 同步 messages.po（lingui v5 默认把孤儿 msgid 标 `#~` obsolete，保留翻译记忆但不算 active）；行号 shift 自动落到 po。messages.po diff 与 Task 1.1 一起 commit。
- **Files modified:** src/i18n/locales/zh-CN/messages.po（净 +16 行 / -17 行，全是行号 shift + 2 条 obsolete 标记转换）
- **Commit:** `9bdaa06`

## Auth Gates

无认证相关。

## Known Stubs

无新增 stub（本 plan 是删除/瘦身操作，无新 UI 数据源接入）。

## Out-of-Scope 顺手项

按 plan §action 严格遵守 scope，未触动：
- `src/store/providers.ts` autoInsertMode 字段（Plan 05 删）
- `src/providers/openai-compat.ts` INSERT_TO_DOCUMENT_TOOL hardcode（Plan 04 删）
- ChatBubble 内 ToolCallPreviewCard / AutoInsertEffect / FallbackInsertMenu（Plan 05 范围）
- chatStore acceptToolCall / rejectToolCall / stopStreaming（Plan 05 删）

## 已知遗留（acknowledged，留给后续 plan）

1. **messages.ts 仍含两条 obsolete msgid（`7l0l44`，`gd2cUq`）**: lingui v5 compile 把 obsolete `#~` 仍编译进 ts 产物。不影响运行（无源码引用故不被渲染）；gzip 后约 1KB 残留。Phase 4 可加 `lingui extract --clean` 标记一并清；或在 lingui.config.ts 显式开 `--clean` flag。
2. **messages.po `#: src/components/CostBadge.tsx:30` 路径引用已死**: 由于 CostBadge.tsx 已删，这两条 obsolete entry 的 `#:` 注释指向不存在的源文件。lingui 不会回头清，需 `--clean`。

## Threat Flags

无新增 threat surface（本 plan 是删除/瘦身，威胁面收敛而非扩张）。

T-03-01（SSEUsage info disclosure）按 plan threat_model accept：usage 字段不再被消费但解析路径保留，没有用户数据落地。✓

T-03-02（bundle size tampering）已通过 Task 1.2 size-limit gate mitigate：80KB 阻断 + main-*.js 精确化。✓

## Self-Check: PASSED

- [x] 删除文件确认：CostBadge.tsx / pricing.ts / pricing.test.ts 均 not-found ✓
- [x] 修改文件存在：ChatBubble.tsx / chat.ts / sse.ts / .size-limit.json 全在 ✓
- [x] Commit hashes 可查：`9bdaa06`, `52e4a8b` ✓
- [x] grep cost 符号 0 命中 src/ 业务代码（残留全在 messages.po obsolete + messages.ts compile 产物）✓
- [x] npm test = 176 passed（基线 190 - 14 cost test = 176）✓
- [x] npm run build green ✓
- [x] npm run size = 74.79 KB ≤ 80 KB PASS ✓

---

*Plan 01 完成 — 2026-05-28*
*Next: Plan 02 (按 Phase 03 dependency_graph 选择)*
