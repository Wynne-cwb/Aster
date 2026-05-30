---
phase: 8
slug: foundation-a-f
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npm test -- --run <file>` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run <affected file>`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green + `npm run build` + bundle size check (`npm run size`, initial main-*.js ≤82 KB gzip)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

> Filled by planner from RESEARCH.md `## Validation Architecture`. Each verifiable dimension below maps to ≥1 automated test.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | PROMPT-01 | — | system prompt 含三宿主断言式标题/≤5点/verify-after-create 指导 | unit | `npm test -- --run system-prompt` | ❌ W0 | ⬜ pending |
| TBD | — | — | PREF-01/02 | T-08-injection | 偏好注入 + 命中注入词静默过滤不注入 | unit | `npm test -- --run system-prompt` | ❌ W0 | ⬜ pending |
| TBD | — | — | HIST-01..04 | — | 持久化往返 + 清空无残留 + 20 轮截断 | unit | `npm test -- --run docKey loop-helpers chat` | ❌ W0 | ⬜ pending |
| TBD | — | — | NFR-08 | — | 合约表 undo 类型声明齐全 + 工具清单一致 | unit | `npm test -- --run contract` | ❌ W0 | ⬜ pending |
| TBD | — | — | NFR-07 | — | system prompt 长度软提醒（不卡构建） | unit | `npm test -- --run system-prompt` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/docKey.test.ts` — docKey 拼接 + raw URL 防泄露 + 回退全局 key (HIST-01)
- [ ] `src/store/preferences.test.ts` — 偏好 store 读写 + 上限校验 (PREF-01/02)
- [ ] `src/agent/contract.test.ts` — 能力合约表 undo 类型声明齐全 + 工具清单一致 (NFR-08, D-16/D-17)
- [ ] 改造 `src/agent/system-prompt.test.ts` — `<3000` 硬断言 → 软断言 + injection 防御测试 + 新 domain 关键词断言 (PROMPT-01, PREF-02, NFR-07)
- [ ] 改造/新增 `src/agent/loop-helpers.test.ts` — 20 轮截断 helper (HIST-04)
- [ ] 每个新写工具（若本阶段引入 inverse）配 `operationLog.integration.test.ts` 守门 (D-17)

*框架已存在（vitest），无需安装。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 刷新 Office for Web 后聊天记录仍可见 | HIST-01 | 需真实 Office for Web 宿主环境 | 真机：发几轮对话 → 刷新页面 → 历史仍在；点「清空聊天记录」→ 窗口清空 + DevTools localStorage 无残留 |
| Spike S6：`Office.context.document.url` 在 Web 三宿主稳定/不含 session token | HIST-01 (D-11) | 需真实宿主，url 形态因宿主/SharePoint 而异 | 真机：三宿主各打印 document.url，确认 pathname 稳定、btoa 变体可用；不稳则回退全局单 key |

*其余 phase 行为均有自动化验证。*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
