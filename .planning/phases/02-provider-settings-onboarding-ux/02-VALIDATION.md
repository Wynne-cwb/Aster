---
phase: 2
slug: provider-settings-onboarding-ux
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-27
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vitest.config.ts`（已存在） |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run`（全部单元测试，< 30s）
- **After every plan wave:** Run `npx vitest run` + 对应 UAT smoke checklist
- **Before `/gsd-verify-work`:** Full suite green + SC1-SC6 手动 UAT 通过
- **Max feedback latency:** 30 seconds

---

## Wave 0 Requirements

以下测试文件在 Wave 1 执行时创建（02-01 / 02-02 的 Wave 0 职责）：

- [ ] `src/lib/sse.test.ts` — 覆盖 PROV-06 / PROV-08（mock fetch + ReadableStream；streamSSE delta/usage/abort；mapHttpError 状态映射）
- [ ] `src/lib/storage.test.ts` — 覆盖 KEY-01（mock Office.context.partitionKey defined/undefined 两种环境下正确前缀）
- [ ] `src/providers/queue.test.ts` — 覆盖 PROV-07 单飞队列（singleFlight 串行化；setupVisibilityAbort cleanup）
- [ ] `src/providers/retry.test.ts` — 覆盖 PROV-09 指数退避（billing 不重试；Retry-After 遵守）
- [ ] `src/providers/registry.test.ts` — 覆盖 PROV-04 路由（已知 taskKind 返回正确 config；未知 taskKind 抛 ModelNotFoundError）
- [ ] `src/providers/pricing.test.ts` — 覆盖 COST-01/02 成本计算（内置 Provider 返回 ¥；自定义 Provider 返回 null）
- [ ] `src/providers/providers.test.ts` — 覆盖 PROV-02/PROV-03（mock fetch 验证 aihubmix-vision image_url block；aihubmix-image input_tokens 解析；openai-compat 经 singleFlight）

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | PROV-01 / PROV-08 | T-02-01 / T-02-05 | AsterError.message 不含 apiKey | unit | `npx vitest run src/errors/` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | PROV-06 / PROV-08 | T-02-06 | streamSSE 正确解析 delta+usage；AbortError 静默 | unit | `npx vitest run src/lib/sse.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | KEY-01 / KEY-05 | T-02-07 | partitionKey 前缀正确；无 pk 时降级 | unit | `npx vitest run src/lib/storage.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 1 | PROV-01 / PROV-04 | — | ProviderRegistry 路由正确；无 fallback | unit | `npx vitest run src/providers/registry.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | COST-01 / COST-02 | — | calcCostCny 内置返回¥；自定义返回 null | unit | `npx vitest run src/providers/pricing.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | PROV-07 | T-02-14 | singleFlight 串行化；cleanup 移除监听器 | unit | `npx vitest run src/providers/queue.test.ts src/providers/retry.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | PROV-02 / PROV-03 | T-02-13 / T-02-15 | image_url block 存在；input_tokens 正确解析；apiKey 不进 body | unit | `npx vitest run src/providers/providers.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | PANE-02 / PROV-07 / KEY-01,05 | T-02-17 / T-02-18 | setupVisibilityAbort 在 store 层；apiKey 不暴露到 props | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-05-02 | 05 | 3 | PANE-04 / D-16 | T-02-19 / T-02-20 | insert text 不再 throw；two-sync 规则 | unit | `npx vitest run src/adapters/` | ✅ existing | ⬜ pending |
| 02-06-01 | 06 | 4 | PANE-02 / COST-02 | T-02-21 | CostBadge 内置显¥；自定义仅 token | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-06-02 | 06 | 4 | PROV-08 / D-10,11,12,13 | T-02-22 | error.message 不展示给用户；CTA 深链正确 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-07-01 | 07 | 5 | PROV-05 / KEY-02,03,04 | T-02-25 / T-02-26 | 隐私告知常驻；baseURL https:// 校验 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-07-02 | 07 | 5 | KEY-03 / D-15 | T-02-25 | Step1Keys 隐私告知 DOM 存在；autoAttach onChange 完整 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-08-01 | 08 | 6 | PANE-01 / D-07,14 | — | InputBar 无 Provider 下拉；发送/停止按钮同位置 | compile | `npx tsc --noEmit` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

以下行为依赖 Office for Web 真实环境，无法纯单元测试（参考 office-addin-browser-uat 项目技能）：

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 流式渲染首 token ≤ 2s | PANE-02 / NFR-03 | 需 Office for Web + 真实 DeepSeek API | DevTools Network Timing：从发送到第一个 SSE delta chunk 的时间 < 2000ms |
| abort 后 token 不再累计 | PROV-07 / D-15 | 需真实 visibilitychange 环境 | 生成中切换 Tab 隐藏 Task Pane，验证成本徽章 token 数冻结（不再增加） |
| PptAdapter insert({type:'text'}) 真实写回 | PANE-04 / D-16 | 需 Office PPT 宿主 | 在 PPT 里点「插入到文档」，验证第一个文本框内容被替换 |
| ExcelAdapter insert({type:'text'}) 真实写回 | PANE-04 / D-16 | 需 Office Excel 宿主 | 选中单元格，点「插入到文档」，验证单元格值被写入 |
| WordAdapter insert({type:'text'}) 真实写回 | PANE-04 / D-16 | 需 Office Word 宿主 | 选中文字，点「插入到文档」，验证选区被替换 |
| Key 跨文档切换不丢（同浏览器） | KEY-05 | 需 Office for Web 真实 partitionKey | 文档 A 填 Key → 打开文档 B → Key 仍在 Settings 中显示 |
| 错误 CTA 深链跳转到设置指定字段 | PROV-08 / D-12 | 需触发 401 真实错误 | 填写错误 Key → 发送消息 → 点「前往设置 →」→ 验证 Settings 打开并 focus 到 Key 输入框 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references（7 个测试文件在 W0 列出）
- [x] No watch-mode flags（所有命令用 `vitest run`，无 `--watch`）
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
