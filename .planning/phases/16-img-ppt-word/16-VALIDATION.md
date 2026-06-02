---
phase: 16
slug: img-ppt-word
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 16-RESEARCH.md §Validation Architecture. Per-task rows get finalized once PLAN.md task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（已有 `vitest.config.ts`） |
| **Config file** | `vitest.config.ts`（项目根） |
| **Quick run command** | `npm test -- --run src/agent/operationLog.integration.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~全量 unit + integration（research 记 ~773 tests），约数十秒 |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`（本项目无 wave 分支，每 commit 跑全量保证 inverse replay 守门不漏）
- **After every plan wave:** Run `npm test -- --run`（同上，全量）
- **Before `/gsd-verify-work`:** 全量绿 **且** PPT 插图真机 UAT spike PASS
- **Max feedback latency:** < 60s（全量套件运行时间）

---

## Per-Task Verification Map

> Task IDs 待 PLAN.md 生成后回填（`{16-NN-MM}`）。下表先按 IMG-01..05 需求锚定可验证手段，来自 RESEARCH.md §Validation Architecture。

| Req | Behavior | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|------------|-----------------|-----------|-------------------|-------------|--------|
| IMG-01 | PPT 生图工具返回 `preview_pending=true`、不写文档（D-02 解耦） | — | tool 无副作用，base64 只在 ToolResult.data 内存态 | unit | `npm test -- --run src/agent/tools/write/ppt-image.test.ts` | ❌ W0 新建 | ⬜ pending |
| IMG-01 | `insertImage` helper 调 addImageShape + 写后回读 + `appendOperation`（`delete_shape_by_id` reverse，args=Record） | T-16-PPT | 写后回读确认 shape 真插入（防静默 no-op） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "generate_ppt_image"` | ❌ W0 追加 | ⬜ pending |
| IMG-01 | PPT inverse `deleteShapeById` → `rolled_back`（replay） | — | undo 复用既有 GA 路径 | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | ✅ 既有 D-17 用例复用 mock | ⬜ pending |
| IMG-02 | Word `insertBodyImage`（`insertInlinePictureFromBase64`, body 级）+ `noop_inverse` `appendOperation` | — | noop_inverse 诚实标注「不支持自动撤销」 | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "generate_word_image"` | ❌ W0 追加 | ⬜ pending |
| IMG-02 | Word `noop_inverse` → `skipped_error`（replay 诚实标注） | — | — | integration | `npm test -- --run src/agent/operationLog.integration.test.ts -t "noop_inverse"` | ✅ 既有 D-17 L866 用例 | ⬜ pending |
| IMG-03 | 生图 `ToolResult.data.base64` 不被 `serializeForStorage` 持久化（NFR-09 扩展，预览 pending 路径 C） | T-16-B64 | serialize 白名单仅 user/assistant text，tool role 过滤 | unit | `npm test -- --run src/store/chat.test.ts -t "NFR-09"` | ✅ 有路径 A/B；追加路径 C | ⬜ pending |
| IMG-04 | `IMAGE_GEN_MODELS` 含 3 model + 默认 doubao；Settings picker 持久默认 | — | apiKey 仅 header（继承 T-14-01） | unit | `npm test -- --run src/providers/registry.test.ts` | ⚠ 需确认现有 registry 测试覆盖 | ⬜ pending |
| IMG-05 | Excel `buildToolsForHost` 不含 `generate_ppt_image` / `generate_word_image` | — | per-host 注册，Excel 工具表诚实不含 | unit | `npm test -- --run src/agent/tools/tools-host.test.ts` | ❌ W0 新建/追加 | ⬜ pending |
| SPIKE | `addGeometricShape('Rectangle') + fill.setImage(base64)` 真机 Web 成功 + `shape.id` 可回读 + bug #5022 规避 | T-16-PPT | 真机回读验证插入成功 | 真机 UAT（手动） | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

来自 RESEARCH.md §Wave 0 Gaps：

- [ ] `src/agent/tools/write/ppt-image.test.ts` — IMG-01 工具单测（不写文档、返回 `preview_pending`）
- [ ] `src/agent/tools/write/word-image.test.ts` — IMG-02 工具单测
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 `generate_ppt_image` / `generate_word_image` 两条 integration 守门用例（memory: `project_adapter_inverse_signature`，新 inverse 必补）
- [ ] `src/store/chat.test.ts` — 追加 NFR-09 路径 C：image preview pending 路径 base64 不出现
- [ ] Excel host 工具表不含生图工具的断言（IMG-05）— `src/agent/tools/tools-host.test.ts`（新建）或追加到既有工具表测试

*Vitest 框架已存在，无需安装；以上为新增/追加测试文件。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PPT 插图 GA 路线真机可用 + shape.id 回读 + #5022 规避 | IMG-01 / SPIKE | Office for Web 写操作可能静默 no-op（memory `project_ppt_officejs_gotchas`），且 GA 组合未本机实测 | 真机 PPT：「生成一张 X 的图插到这页」→ 预览 → 确认 → 验证 slide 出现图 + 控制台 shape.id 非空 + Undo 可删（参 `office-addin-browser-uat` skill） |
| Word 生图插入 body 级真机可用 | IMG-02 | Office for Web range 级已知 bug #3434，body 级需真机确认 | 真机 Word：生图插入 → 验证 body 出现 inline picture；Undo 诚实标 noop |
| 预览卡交互（确认插入/重新生成/取消）+ loading/取消 | IMG-03 / IMG-04 | 涉及渲染 + AbortController 取消，需真机观感 | 真机：触发生图 → 见生成中态 → 取消（gpt-image-2 high ~90s+ 路径）/ 重新生成换图 / 确认插入 |
| Excel 诚实告知不支持 | IMG-05 | 需真机确认 Excel 宿主 agent 回答措辞 | 真机 Excel：要求生图插入 → agent 诚实回答「Excel 无原生插图 API，不支持插图」 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags（不用 `vitest`/`--watch`，统一 `--run`）
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
