---
phase: 7
slug: uat-sideload-release-prep
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 07-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.x |
| **Config file** | `vite.config.ts` (vitest 默认配置，无独立 vitest.config.ts) |
| **Quick run command** | `npm run test:unit` |
| **Full suite command** | `npm test` (含 `tsc --noEmit && vitest run`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test:unit`
- **After every plan wave:** Run `npm test` (tsc + vitest run)
- **Before `/gsd-verify-work`:** Full suite must be green AND `npm run build && npm run size` passes (≤82KB)
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| probeToolCall 实现 | 0/1 | A-21 | 探针只发最简 dummy tool call，不泄露 Key 到日志 | unit | `npm run test:unit -- src/providers/probeToolCall.test.ts` | ❌ W0 | ⬜ pending |
| pre-flight 拦截 | 1 | A-21 | `supportsToolCall===false` 时拒绝 runAgent，不发起 LLM call | unit | `npm run test:unit -- src/agent/agentStore.test.ts` | ✅ (补 case) | ⬜ pending |
| 内置 model 跳过测试 | 1 | A-21 | isBuiltIn model 不显示/不触发 probe | unit | `npm run test:unit -- src/components/Settings/ProviderForm.test.tsx` | ✅ (补 case) | ⬜ pending |
| badge 第三态呈现 | 1 | A-21 | 测试结果 ✓/✗/未测 复用 badge 体系 | unit | `npm run test:unit -- src/components/Settings/ProviderList.test.tsx` | ✅ (补 case) | ⬜ pending |
| bundle gate | 任意 | NFR-05 | initial JS ≤82KB gzip | bundle | `npm run build && npm run size` | ✅ `.size-limit.json` | ⬜ pending |
| Key 不上传 | 任意 | NFR-04 | 无 Aster 自有服务器 URL | grep/架构审查 | `grep -rn "aster.*server\|aster.*api" src/ --include="*.ts"` | ✅ (期望 0 命中) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/providers/probeToolCall.ts` — A-21 probe 函数实现（新文件）
- [ ] `src/providers/probeToolCall.test.ts` — probe 函数单测（mock openai-compat；验证 true/false/null 三态）
- [ ] `src/agent/agentStore.test.ts` 补充 case — `supportsToolCall===false` 时 runAgent 推 error message 并 return（不发 LLM call）
- [ ] `src/components/Settings/ProviderForm.test.tsx` 补充 case — 测试按钮仅对非内置 Provider 显示
- [ ] `src/components/Settings/ProviderList.test.tsx` 补充 case — badge 第三态（未测/支持/不支持）渲染

*Existing Vitest infrastructure covers the framework; above are the new test stubs this phase requires.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 4 killer scenario 端到端 | ERR-04 (UAT) | 需真机三宿主 + LLM 实时跑 | 用户在 Chrome × PPT/Excel/Word 各跑 PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化；记录步数 + 端到端耗时 + DiffLogPanel 截图 |
| Agent 放弃红卡 UX | ERR-04 | 需触发真实失败路径 | UAT 期间观察 CIRCUIT_OPEN / max_steps 到顶时红卡文案 |
| P95 ≤10s / 首 token ≤2s | NFR-03 | 真机性能肉眼 | UAT 时观察，必要时加 dev-only `performance.now()` 计时日志（不进生产）|
| 三宿主只用共同 API 子集 | NFR-01 | 需真机三宿主验证无 host-only API 报错 | Chrome × 三宿主 sideload 后跑 read/write tool，确认无 "API not supported" |
| Sideload manifest 三宿主 | NFR-04/发布 | 需真机上传 manifest + Pages 部署 | GitHub Pages 部署后，Chrome × PPT/Excel/Word 各 sideload manifest.xml，确认 Task Pane 渲染的是 Pages 最新版（清缓存核对） |
| README 事实校准 | (D-10) | 人工核对措辞/数值 | 核对 bundle 实测值、技术栈（自写CSS）、删除幻影 REL 引用、保留 N5 |
| 自定义 Provider CORS | (sideload 风险) | Office for Web CORS 行为 ASSUMED | UAT 时若用自定义第三方 Provider，确认 AppDomains 外的 CORS 行为 |

---

## Validation Sign-Off

- [ ] All A-21 code tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive code tasks without automated verify
- [ ] Wave 0 covers all MISSING references (probeToolCall.ts + tests)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
