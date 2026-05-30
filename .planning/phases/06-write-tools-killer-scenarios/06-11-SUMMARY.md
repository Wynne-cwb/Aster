---
phase: "06"
plan: "11"
subsystem: onboarding
tags: [onboarding, single-step, manifest, ribbon, bundle]
dependency_graph:
  requires: [06-01]
  provides: [single-step-onboarding, manifest-1-button]
  affects: [src/components/Onboarding, manifest.xml]
tech_stack:
  added: []
  patterns: [storage-write-migration, prop-rename-onNext-to-onComplete]
key_files:
  created: []
  modified:
    - src/components/Onboarding/OnboardingModal.tsx
    - src/components/Onboarding/Step1Keys.tsx
    - src/components/Onboarding/OnboardingModal.test.tsx
  deleted:
    - src/components/Onboarding/Step2Guide.tsx
decisions:
  - D-18: Onboarding 收成单步，Step1Keys.handleComplete 内写 ONBOARDING_SEEN
  - D-19: Step2Guide 整文件删除，无任何代码引用残留
  - D-21: 单步流程 Step1→主界面跳转路径更简单，原 2 步跳转 bug 随结构消除
  - manifest 三宿主单按钮已由 quick task 260527-q1c 完成，本 plan 确认符合要求
metrics:
  duration: "177s"
  completed_date: "2026-05-30"
  tasks: 2
  files: 4
---

# Phase 06 Plan 11: Onboarding 单步化 + Ribbon 精简验证 Summary

**One-liner:** Onboarding 收成单步（删 Step2Guide，Step1Keys 直接写 ONBOARDING_SEEN，CTA「开始使用」）+ manifest 三宿主各 1 ShowTaskpane 按钮验证通过。

## What Was Built

### Task 1: OnboardingModal 单步化 + Step1Keys CTA 改 + Step2Guide 删除

- **OnboardingModal.tsx**：删除 `step` state（`useState<1 | 2>(1)`）、`goNext()`、`goBack()`、`Step2Guide` import、`brand-step` span（步骤计数）；直接渲染 `<Step1Keys onComplete={onComplete} onSkip={handleSkip} />`
- **Step1Keys.tsx**：
  - prop `onNext` → `onComplete`
  - 新增 `import { storage, STORAGE_KEYS } from '../../lib/storage'`
  - `handleNext` → `handleComplete`；在 `onComplete()` 前加 `storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true)`（从 Step2Guide 迁移）
  - `modal-sub` 文案更新为 D-18 锁定文案：「Aster 是嵌在 Office 里的 AI 代理 —— 填入你自己的 API Key 就能开始。Key 只存在你的浏览器本地。」
  - CTA 从「下一步」改为「开始使用」
- **Step2Guide.tsx**：整文件删除（无代码 import 残留；styles.css 和 messages.po 中只有注释/翻译来源标注，不影响 build）
- **OnboardingModal.test.tsx**：移除 `describe.skip`，激活全部 6 个断言（含 ONB-01 CTA 验证、ONB-02 无 Step2Guide、ONB-03 ONBOARDING_SEEN 写入）；同时更新旧冒烟测试（旧「下一步」断言替换为「开始使用」）

### Task 2: manifest.xml Ribbon 精简验证 + commands.ts 检查

- **manifest.xml**：三宿主（PPT/Excel/Word）各 1 个 `Control xsi:type="Button"` + `Action xsi:type="ShowTaskpane"`，Label resid `Btn.Aster.Open.Label` 对应「打开 Aster」——已由前序 quick task `260527-q1c` 完成，本 plan 确认符合要求，无需修改
- **commands.ts**：无多余 executeFunction 残留；仅保留 `openTaskpane` 扩展预留 handler（ShowTaskpane 模式下不被触发，合理）

## Verification Results

| Check | Result |
|-------|--------|
| `ls src/components/Onboarding/Step2Guide.tsx` | no such file ✓ |
| `grep -r "import.*Step2Guide" src/` | 0 行 ✓ |
| `grep -c 'xsi:type="ShowTaskpane"' manifest.xml` | 3 ✓ |
| `grep "打开 Aster" manifest.xml` | ≥1 ✓ |
| `npm test -- --run OnboardingModal.test.tsx` | 6/6 GREEN ✓ |
| `npm run build` | ✓ 通过（无孤儿 import） |
| `npm run size` | ⚠ 82.71 kB gzip（超标 710 B，见下） |

## Bundle Size

**`npm run size` 结果：82.71 kB gzip（门禁 82 kB，超标 710 B，EXIT 1）**

删除 Step2Guide 约节省 ~69B（从入口 bundle 看 main chunk 265 kB → 同），不足以回到 82 kB 以内。

超标来源：Phase 06 多个 write tool plan（06-02 至 06-09）累积写入 main chunk 的工具代码，非本 plan 引入。

**处置方式**（按 bundle_context 指示）：记录于此，不做计划外大改。后续由 orchestrator 统一评估是否需要专项 bundle 优化 plan。

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 旧冒烟测试「下一步」断言与单步化实现冲突**
- **Found during:** Task 1 测试验证
- **Issue:** `OnboardingModal.test.tsx` Wave 0 冒烟测试里有 `expect(getByText('下一步'))` — 原本预期单步化后此断言会被替换（注释明确写了 "Wave 3 实现后此断言会被 skip 块覆盖替换"），实现后旧断言失败（EXIT 1）
- **Fix:** 同时更新整个测试文件：移除 `describe.skip`，激活 D-18/D-19/D-21 三个断言；冒烟测试里旧「下一步」断言替换为「开始使用」
- **Files modified:** `src/components/Onboarding/OnboardingModal.test.tsx`
- **Commit:** a20456e（含 Task 1 全部文件）

**2. [确认] manifest.xml 无需修改**
- **Found during:** Task 2 检查
- **Issue:** 计划预期可能需要更新 manifest.xml，但前序 quick task `260527-q1c`（2026-05-27）已完成三宿主单按钮精简 + 「打开 Aster」Label，本 plan 确认状态符合 D-17 要求
- **处置:** 无需 commit，Task 2 记为 no-op（manifest + commands.ts 均已达目标状态）

## Known Stubs

None — 本 plan 删除了 Step2Guide 功能卡（非 stub，是设计决策），Step1Keys 表单和 storage 写入完整实现。

## Threat Flags

None — 仅 localStorage boolean flag（ONBOARDING_SEEN）读写，无新网络端点，无新授权路径。

## Self-Check: PASSED

- [x] `src/components/Onboarding/OnboardingModal.tsx` 存在（修改版）
- [x] `src/components/Onboarding/Step1Keys.tsx` 存在（修改版）
- [x] `src/components/Onboarding/Step2Guide.tsx` 不存在（已删除）
- [x] `src/components/Onboarding/OnboardingModal.test.tsx` 存在（修改版）
- [x] Commit `a20456e` 存在（Task 1 + 测试）
- [x] manifest.xml 三宿主各 1 ShowTaskpane 已验证
- [x] 6 个测试 GREEN，build 通过
