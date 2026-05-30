---
phase: 12
slug: ui-e
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 12-RESEARCH.md §Validation Architecture (verified against codebase).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.x + @testing-library/react 16.x（jsdom） |
| **Config file** | `vitest.config.ts`（environment: 'jsdom', globals: true） |
| **Quick run command** | `vitest run --reporter=dot` |
| **Full suite command** | `npm run test`（= `tsc --noEmit && vitest run`） |
| **Bundle gate** | `npm run build && npm run size`（`.size-limit.json`: initial-js ≤ 82 KB gzip） |
| **Estimated runtime** | ~30–60s（含 tsc） |

---

## Sampling Rate

- **After every task commit:** `vitest run --reporter=dot`（快速全量）
- **After every plan wave:** `npm run test`（typecheck + full vitest）
- **Before `/gsd-verify-work`:** `npm run test && npm run build && npm run size` 全绿
- **Max feedback latency:** ~60s

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File |
|-----|----------|-----------|-------------------|------|
| UI-01 | `javascript:` href 被拦截（返回 ''） | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "javascript"` | ❌ W0 新建 |
| UI-01 | `data:` URI href 被拦截 | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "data:"` | ❌ W0 新建 |
| UI-01 | `https:` href 放行（不误杀） | unit | `vitest run src/utils/safeUrlTransform.test.ts -t "https"` | ❌ W0 新建 |
| UI-01 | img src `javascript:` 被拦截 | component-render | `vitest run src/components/ChatBubble.test.tsx -t "img src"` | ❌ W0 新建 |
| UI-01 | ChatBubble 渲染后 DOM 无危险 href | component-render | `vitest run src/components/ChatBubble.test.tsx` | ❌ W0 新建 |
| UI-02 | 发消息后、首 token 前出现 `.bubble-typing` | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing"` | ❌ 扩展 |
| UI-02 | 首 token 到达后 `.bubble-typing` 消失 | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing disappears"` | ❌ 扩展 |
| UI-02 | run 结束（idle）无残留 `.bubble-typing` | component-render | `vitest run src/components/ChatStream.test.tsx -t "typing idle"` | ❌ 扩展 |
| UI-03 | 多 run 时 DiffLogPanel 紧跟对应 run 末尾 | component-render | `vitest run src/components/ChatStream.test.tsx -t "DiffLog boundary"` | ❌ 扩展 |
| UI-03 | 同 runId 只渲染一张 DiffLogPanel | component-render | `vitest run src/components/ChatStream.test.tsx -t "DiffLog dedup"` | ❌ 扩展 |
| UI-04 | 纯 CSS 改动（视觉回归手动）+ bundle 不增 | manual / build | `npm run build && npm run size` | n/a |
| UI-05 | read 工具卡含 `--read` 修饰类 | component-render | `vitest run src/components/ChatStream.test.tsx -t "read card"` | ❌ 扩展 |
| UI-05 | write 工具卡不含 `--read` 修饰类 | component-render | `vitest run src/components/ChatStream.test.tsx -t "write card"` | ❌ 扩展 |
| UI-05 | loop-helpers push tool 消息时写入 `kind` 字段 | unit | `vitest run src/agent/loop-helpers.test.ts -t "kind"` | ❌ 扩展 |
| UI-06 | `dist/index.html` `#root` 含骨架 HTML + 内联 style | build artifact | `grep 'sk-shimmer' dist/index.html` | n/a |
| UI-06 | 骨架 CSS 含 `prefers-reduced-motion` 分支 | build artifact | `grep 'prefers-reduced-motion' dist/index.html` | n/a |
| UI-06 | build 后 initial JS ≤82KB（不因 E phase 增长） | build-size | `npm run build && npm run size` | ✅ 已有 CI guard |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — 全部 ⬜ pending（未执行）*

---

## 安全测试重点（UI-01，P0）

UI-01 测试 **必须** 覆盖 DOM-level 断言（不能只测函数返回值）——在 jsdom 渲染 `ChatBubble` 后 query DOM：
- `[点我](javascript:alert(1))` → `container.querySelector('a')?.getAttribute('href')` 不含 `javascript:`
- `[链接](https://example.com)` → href 完整保留 `https://example.com`（不误杀）
- `![](javascript:...)` → img src 同类防御
- `ChatBubble.test.tsx` 需 mock `@lingui/react/macro`（参照 `ChatStream.test.tsx` 的 mock 模式）

---

## Wave 0 Requirements

- [ ] `src/utils/safeUrlTransform.ts` — UI-01 实现文件（Wave 0 同步创建，与测试 RED→GREEN）
- [ ] `src/utils/safeUrlTransform.test.ts` — UI-01 纯 unit（4 核心用例：javascript/data/vbscript 拦截 + https 放行）
- [ ] `src/components/ChatBubble.test.tsx` — UI-01 DOM-level 断言（5 用例，新建，mock lingui macro）
- [ ] `src/components/ChatStream.test.tsx` 扩展 — UI-02（typing 出现/消失/idle 无残留）、UI-03（boundary/dedup）、UI-05（read/write card class）
- [ ] `src/agent/loop-helpers.test.ts` 扩展 — UI-05 `kind` 字段写入验证

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 表格边框/列表/代码块视觉整洁 | UI-04 | 纯 CSS 视觉，无 DOM 断言价值 | 三宿主 light/dark 真机 UAT：渲染含表格/列表/代码块的 AI 回复，确认边框可见、克制、无溢出 |
| 思考三点动画观感 + reduced-motion 降级 | UI-02 | 动画观感主观 | 真机看三点跳动是否克制；系统开 reduced-motion 后确认静态 |
| 骨架屏首屏观感（light/dark） | UI-06 | 首屏几百 ms，灰值真机才准 | 三宿主冷启动看骨架屏是否不刺眼、不闪、被 React 平滑覆盖 |
| read 卡降权幅度是否合适 | UI-05 | 降权「程度」主观（待复核 #12-13） | 真机看 read 卡是否够淡但仍可读、write 卡是否够突出 |

---

## Validation Sign-Off

- [x] All tasks have automated verify OR Wave 0 dependencies OR justified manual-only
- [x] Sampling continuity: no 3 consecutive tasks without automated verify（UI-04/06 纯 CSS/build 以 build-size + manual 兜底）
- [x] Wave 0 covers all MISSING references（safeUrlTransform + ChatBubble.test + ChatStream/loop-helpers 扩展）
- [x] No watch-mode flags（全部 `vitest run`，非 watch）
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending（执行时由 Wave 0 落地后转 approved）
