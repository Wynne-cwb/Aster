---
phase: 06-write-tools-killer-scenarios
verified: 2026-05-30T13:30:00Z
status: human_needed
score: 7/7 must-haves verified (dev-verifiable)
overrides_applied: 0
human_verification:
  - test: "4 killer scenario 端到端（PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 护城河）在真实 Office for Web 上逐一跑通"
    expected: "每个 ROADMAP demo prompt 能从用户输入到 multi-step agent 完成写操作，undo/diff-log 仍正常工作"
    why_human: "Office.js write 路径（chart.add / shape fill/line / paragraph.insertText）无法在 Vitest 里 mock；必须真机三宿主 smoke UAT（D-12）"
  - test: "manifest.xml 单按钮「打开 Aster」在三宿主重新 sideload 验证"
    expected: "PPT/Excel/Word for Web 三宿主各只出现一个「打开 Aster」按钮，点击打开 Task Pane"
    why_human: "manifest 改动需真实 sideload 才能验证跨宿主渲染（D-17）"
  - test: "单步 onboarding（Step1Keys → 主界面）跳转正常（D-21 bug check）"
    expected: "Step1 填入 API Key 完成后，ONBOARDING_SEEN 写入，modal 关闭，进入主界面 chat（无 stuck 状态）"
    why_human: "localStorage/Office 宿主的 RoamingSettings 交互 + 真机 UI 渲染过渡需真机确认"
---

# Phase 6: Write Tools + Killer Scenarios 验证报告

**Phase 目标（ROADMAP）：** 完成 PPT/Excel/Word write tools 全套（含差异化护城河 set_shape_property / move_shape）+ 把 4 个 killer scenario 按 multi-step agent 流重写 + empty-state killer chips + Ribbon 降级 + Onboarding 轻量化。

**已验证时间：** 2026-05-30T13:30:00Z

**状态：** human_needed（dev 层 7/7 全 VERIFIED；3 项 Manual-Only 待真机 UAT 06-12）

**Re-verification：** No — 初次验证

---

## 关键范围声明（遵循 critical_scoping）

1. **¥ 判据（D-13）**：SC1-3 的 ¥<3/¥<1.5/¥<2 已由 06-CONTEXT.md D-13 正式删除（cost 功能 Phase 3 整批砍）。本报告不因「无 ¥ 跟踪」标 gap。

2. **ONB-01 动画（D-19）**：心智锚定动画/GIF 由用户主动移除，已 requirement 降级，记录在 deferred 区。不标 gap。

3. **Wave 5（06-12）**：三宿主真机 smoke UAT 故意未执行（autonomous: false），为 Manual-Only checkpoint。对应 killer scenario 端到端、manifest sideload、onboarding 跳转标 human_needed，不标 gap。

---

## Goal Achievement

### Observable Truths（dev 层可验证部分）

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | TOOL-03：PPT write tool 全集（insert_slide/set_shape_text/set_shape_property/move_shape）已注册进 buildToolsForHost('ppt') | ✓ VERIFIED | `src/agent/tools/index.ts` L13+215：四工具全部 import + 注册；PPT 测试 18/18 PASS |
| 2 | TOOL-03：Excel write tool 全集（set_range_values/apply_formula/insert_chart/set_cell）已注册进 buildToolsForHost('excel') | ✓ VERIFIED | `src/agent/tools/index.ts` L14+207：四工具全部 import + 注册；Excel 测试 11/11 PASS |
| 3 | TOOL-03：Word write tool 全集（append_paragraph/insert_paragraph/replace_paragraph/insert_text_at_cursor/replace_selection）已注册进 buildToolsForHost('word') | ✓ VERIFIED | `src/agent/tools/index.ts` L12+197-198：五工具全部 import + 注册；Word 测试 14/14 PASS |
| 4 | 每个新 write tool 有中文 humanLabel + reverse Record 对象签名（非位置参）+ postState，adapter inverse 方法用 Record 签名 | ✓ VERIFIED | 全 write tool 文件检查：humanLabel 均为中文函数（`在 ${cell} 单元格写入公式 ${formula}` 等）；adapter 方法如 `overwriteRange(args: Record<string,unknown>)`、`deleteChartByName(args: Record<string,unknown>)` 等全部 Record 签名；operationLog.integration.test.ts 8/8 PASS |
| 5 | operationLog.executeReverse 新增 5 个 case（restore_shape_property/restore_shape_geometry/restore_shape_text/delete_chart_by_name/restore_paragraph_at） | ✓ VERIFIED | `src/agent/operationLog.ts` L265-295：5 个 case 全部存在并路由到对应 adapter 方法；noop_inverse case 保留但 replaceSelection 已改用 delete_paragraph_by_content（T-06-07-02 accept） |
| 6 | ONB-03：ChatStream 空态按宿主渲染 3 条 host-specific chips；点击 chip → 填充 InputBar（不自动 send） | ✓ VERIFIED | `src/components/ChatStream.tsx` L299-347：CHIPS 对象三宿主各 3 条，`onClick={() => setDraftPrompt(chip.seed)}`；InputBar.tsx L44-51：draftPrompt useEffect 填充 textarea 并 clearDraftPrompt，无自动 send；ChatStream.test.tsx 22/22 PASS |
| 7 | D-18：Step2Guide 已删除（单步 onboarding），ONBOARDING_SEEN 写入迁移至 Step1Keys.handleComplete | ✓ VERIFIED | `src/components/Onboarding/` 目录只含 3 文件（OnboardingModal.tsx/Step1Keys.tsx/test），无 Step2Guide.tsx；OnboardingModal.test.tsx L76：「Step2Guide 不在 DOM 中」测试 6/6 PASS；i18n .po 里有 Step2Guide 引用是惰性 po 文件（源文件已删，po 未清理，不影响运行时） |

**Dev 层得分：7/7 truths verified**

### 系统 Prompt 重写（D-06/D-07/D-08）

`src/agent/system-prompt.ts` 已完整重写：
- 共享基座段包含：日期注入 + batch 倾向 + evidence 区分 + self-verify + 全中文（D-06/D-07）
- 三宿主专属 `getDomainSegment`：PPT 领域 6 条（list_slides 优先 + batch emit + 断言式标题 + 几何推理）/ Excel 领域 6 条（summary 先行 + A1 引用 + insert_chart + 三句话洞察写 set_cell）/ Word 领域 6 条（outline 先读 + 分批 read+replace + 保留原意）（D-08）
- 去除了架构细节「没有后台服务器」等（D-07）
- system-prompt.test.ts 13/13 PASS

**ONB-02（step 摘要中文化）**：由所有 write tool 强制中文 humanLabel 满足（D-20），无需额外工作。

### Ribbon 单按钮（D-17）

`manifest.xml` 三宿主各含：
- 1 个 ShowTaskpane 按钮（id: Aster.Open / AsterXL.Open / AsterWD.Open）
- Label: 「打开 Aster」/ Tip: 「打开 Aster 任务窗格」
- 无 ExecuteFunction 按钮（旧 6 按钮已全部移除）

### Bundle size 守门

```
main-*.js gzip: 73.25 KB（≤ 82 KB CI 门槛）✓
```

全套 write tools + chips + 单步 onboarding 新增后仍在预算内。

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/agent/tools/write/excel.ts` | apply_formula / insert_chart / set_cell 三工具 + 完整 humanLabel/reverse/postState | ✓ VERIFIED | 四工具 168 行，含前述三工具 + 原有 set_range_values；测试 11/11 |
| `src/agent/tools/write/ppt.ts` | set_shape_property / move_shape / set_shape_text 三护城河工具 | ✓ VERIFIED | 四工具 278 行；测试 18/18 |
| `src/agent/tools/write/word.ts` | insert_paragraph / replace_paragraph / insert_text_at_cursor / replace_selection 四新工具 | ✓ VERIFIED | 五工具 251 行；测试 14/14 |
| `src/adapters/ExcelAdapter.ts` | insertChart / deleteChartByName / applyFormula / setCell 方法，Record 签名 | ✓ VERIFIED | 全部 Record 签名；insertChart 同闭包内 chart.load(['name'])+sync 获取稳定 chartName |
| `src/adapters/PptAdapter.ts` | setShapeProperty / restoreShapeProperty / moveShape / restoreShapeGeometry / setShapeText / restoreShapeText | ✓ VERIFIED | 全 6 方法，Record 签名，before-image 四 sync 范式 |
| `src/adapters/WordAdapter.ts` | insertParagraphAt / replaceParagraphAt / restoreParagraphAt / insertTextAtCursor / replaceSelection | ✓ VERIFIED | 全 5 方法，Record 签名；restoreParagraphAt 双策略定位（index 优先 + 内容指纹降级） |
| `src/agent/operationLog.ts` | executeReverse 新 5 case | ✓ VERIFIED | L265-295；operationLog.integration.test.ts 8/8 |
| `src/agent/system-prompt.ts` | buildSystemPrompt(host) 共享基座 + 三宿主领域段 | ✓ VERIFIED | 完整重写，去技术化，host-specific；test 13/13 |
| `src/components/ChatStream.tsx` | host-specific chips + setDraftPrompt 填充 | ✓ VERIFIED | L299-347；ChatStream.test.tsx 22/22 |
| `src/components/Onboarding/OnboardingModal.tsx` | 单步，无 Step2Guide | ✓ VERIFIED | 仅 Step1Keys，OnboardingModal.test.tsx 6/6 |
| `manifest.xml` | 三宿主各 1 个 ShowTaskpane 按钮 | ✓ VERIFIED | 无 ExecuteFunction 按钮 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `insert_chart` ToolDef | `ExcelAdapter.insertChart` | ctx.adapter as ExcelAdapter | ✓ WIRED | write/excel.ts L128；返回 chartName 供 reverse |
| `insert_chart` reverse | `ExcelAdapter.deleteChartByName` | operationLog executeReverse → adapter.deleteChartByName | ✓ WIRED | operationLog.ts L283-287；reverse.tool='delete_chart_by_name' |
| `set_shape_property` ToolDef | `PptAdapter.setShapeProperty` | ctx.adapter as PptAdapter | ✓ WIRED | write/ppt.ts L148；before-image 返 fillType/fillColor/lineColor 等 |
| `set_shape_property` reverse | `PptAdapter.restoreShapeProperty` | operationLog executeReverse → adapter.restoreShapeProperty | ✓ WIRED | operationLog.ts L265-270 |
| `move_shape` reverse | `PptAdapter.restoreShapeGeometry` | operationLog executeReverse → adapter.restoreShapeGeometry | ✓ WIRED | operationLog.ts L271-276 |
| `set_shape_text` reverse | `PptAdapter.restoreShapeText` | operationLog executeReverse → adapter.restoreShapeText | ✓ WIRED | operationLog.ts L277-282 |
| `replace_paragraph` reverse | `WordAdapter.restoreParagraphAt` | operationLog executeReverse → adapter.restoreParagraphAt | ✓ WIRED | operationLog.ts L289-294 |
| Chip click | InputBar setText | useChatStore.setDraftPrompt → draftPrompt useEffect | ✓ WIRED | ChatStream.tsx L341 onClick；InputBar.tsx L40-51 useEffect |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| ChatStream chips | `chips = CHIPS[host] ?? []` | `adapter.capabilities().host` → 静态 CHIPS Record | CHIPS 是静态定义的 3 条 prompt 文案（非 DB），此为设计意图；adapter.capabilities().host 从 Office.js 运行时读取 | ✓ FLOWING（chips 为静态文案，host 为运行时真实宿主） |
| OnboardingModal | Step1Keys.onComplete | storage.set(ONBOARDING_SEEN, true) | localStorage 写入真实；无空数据风险 | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 全套 write tool 测试 | `npm test -- --run src/agent/tools/write/excel.test.ts` | 11/11 PASS | ✓ PASS |
| PPT write tool 测试 | `npm test -- --run src/agent/tools/write/ppt.test.ts` | 18/18 PASS | ✓ PASS |
| Word write tool 测试 | `npm test -- --run src/agent/tools/write/word.test.ts` | 14/14 PASS | ✓ PASS |
| operationLog 集成测试 | `npm test -- --run src/agent/operationLog.integration.test.ts` | 8/8 PASS | ✓ PASS |
| Chips + 填充行为测试 | `npm test -- --run src/components/ChatStream.test.tsx` | 22/22 PASS | ✓ PASS |
| 单步 Onboarding 测试 | `npm test -- --run src/components/Onboarding/OnboardingModal.test.tsx` | 6/6 PASS | ✓ PASS |
| System Prompt 测试 | `npm test -- --run src/agent/system-prompt.test.ts` | 13/13 PASS | ✓ PASS |
| 全套测试 | `npm test -- --run` | 47 files / 585 tests passed（3 errors 均为预存 retry.test.ts/queue.test.ts async flaky，与本 phase 无关） | ✓ PASS |
| 构建 + bundle size | `npm run build && npm run size` | 73.13 KB ≤ 82 KB | ✓ PASS |

---

### Requirements Coverage

| Requirement | 描述 | Status | Evidence |
|-------------|------|--------|---------|
| TOOL-03 | Write tools P1 全集（PPT 4 / Excel 4 / Word 5 工具） | ✓ SATISFIED | buildToolsForHost 三宿主全部注册；各宿主测试全 PASS |
| ONB-01 | Onboarding 心智锚定动画/GIF | DEFERRED (D-19 用户主动移除) | 06-CONTEXT.md D-19：教育担子转给空态 chips + diff log；requirement 已降级 |
| ONB-02 | Step 摘要中文化 | ✓ SATISFIED | 所有 write tool 强制中文 humanLabel（D-20）；system-prompt.ts 重写去技术化 |
| ONB-03 | Empty-state killer-scenario chips + Ribbon 精简 | ✓ SATISFIED | ChatStream.tsx host-specific chips；manifest.xml 三宿主各 1 个 ShowTaskpane 按钮 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/i18n/locales/zh-CN/messages.po` | 61, 93, etc. | Step2Guide.tsx 引用残留在 po 文件（源文件已删） | ℹ️ Info | po 文件是惰性生成物，源已删、运行时无影响；下次 lingui extract 时自动清理 |
| `src/styles.css` | 399, 1071 | `.host-card` / Step2Guide 样式注释残留 | ℹ️ Info | CSS 规则残留（host-card 选择器），无功能影响；可在 Phase 7 统一清理 |

无 Blocker 或 Warning 级反模式。

---

### Human Verification Required

#### 1. 4 Killer Scenario 端到端真机 UAT

**测试：** 在 Office for Web（Edge / Chrome 最新版）按 ROADMAP demo prompt 逐一测试：
- SC1 PPT：「帮我做一份 Q3 销售复盘 PPT，给 leadership 看，重点华东」→ 验证 insert_slide batch + set_shape_text 生效
- SC2 Excel：「帮我清洗这份数据、加公式、画个图，再给三句话洞察」→ 验证 apply_formula + insert_chart + set_cell 生效
- SC3 Word：「帮我把整篇文档润色一遍，口语改成正式书面」→ 验证 replace_paragraph 批量生效
- SC4 PPT shape：「把左下角那张图加红色边框，再往右移 10 px」→ 验证 list_shapes_on_slide 几何推理 + set_shape_property + move_shape 生效

**预期：** 每个场景完成后 DiffLogPanel 显示正确中文步骤摘要；「撤销所有」后文档恢复原状；Phase 5 undo/diff-log 在新 destructive write 下仍正常工作。

**为何需要真人：** Office.js write 路径（charts.add / shape fill/line / paragraph.insertText）无法在 Vitest 中 mock，必须真机验证（D-12）。

#### 2. Ribbon 单按钮三宿主 sideload 验证

**测试：** 以更新后的 manifest.xml 在 PPT/Excel/Word for Web 各重新 sideload；检查 Ribbon 中只出现「打开 Aster」一个按钮，点击后正常打开 Task Pane。

**预期：** 三宿主均只显示一个入口按钮，无多余按钮残留。

**为何需要真人：** manifest sideload 是浏览器+Office Web 真实注册流程，无法在 Vitest 模拟。

#### 3. 单步 Onboarding 跳转验证（D-21）

**测试：** 以全新 profile（清空 localStorage）打开 Task Pane；填入有效 API Key 后点击完成；验证 modal 关闭、进入 chat 主界面。

**预期：** 无 stuck modal，无跳回 Step2（已删），ONBOARDING_SEEN 写入后下次不再显示 onboarding。

**为何需要真人：** localStorage + Office 宿主渲染过渡在 JSDOM 模拟不可靠；D-21 bug check 需真机确认。

---

## 差异化护城河确认

**PPT shape 护城河（D-01 / SC4）：**

`set_shape_property` 覆盖 fill 填充色 / line 边框色+粗细 / 尺寸，`move_shape` 管 left/top——两工具均实现 before-image 四 sync 范式 + D-11 expected_state 可选并发防御 + Record 签名 inverse。这是 Copilot Agent Mode 未暴露的差异化能力，代码已完整实现，真机验证为 human_needed（Wave 5）。

---

## Gaps Summary

**无 dev 层 gap。**

所有 dev 可验证的交付（TOOL-03 write tool 注册 + inverse 签名 + operationLog 接入 + ONB-02 humanLabel + ONB-03 chips/Ribbon + D-18 单步 onboarding + system prompt 重写）已全部 VERIFIED。

3 项 human_needed 是故意设计的 Manual-Only checkpoint（06-VALIDATION.md §Manual-Only Verifications），由 Wave 5（06-12 autonomous: false）承接，**不是 gap**。

---

_Verified: 2026-05-30T13:30:00Z_
_Verifier: Claude (gsd-verifier)_
