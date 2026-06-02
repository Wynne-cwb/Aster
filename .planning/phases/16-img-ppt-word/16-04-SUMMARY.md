---
phase: 16-img-ppt-word
plan: "04"
subsystem: settings-ui
tags: [image-gen-model-picker, IMG-04, D-04, PREF_IMAGE_GEN_MODEL, settings-select, registry-override]

requires:
  - phase: 16-img-ppt-word
    plan: "02"
    provides: insertImage helper + 真机锁定裸 base64（间接依赖：16-04 与生图链路同 wave）
  - phase: 14-mdl-provider
    provides: IMAGE_GEN_MODELS + DEFAULT_IMAGE_GEN_MODEL + ProviderRegistry.resolve('image-gen')（生图 model 清单与默认 doubao）

provides:
  - STORAGE_KEYS.PREF_IMAGE_GEN_MODEL（'aster:pref:image-gen-model'）持久键
  - ProviderRegistry.resolve('image-gen') 读 PREF_IMAGE_GEN_MODEL 覆盖默认 doubao（fallback DEFAULT_IMAGE_GEN_MODEL）
  - SettingsPanel 全局选项区「生图模型」<select>（3 选项，持久跨 session）
  - .aster-settings__select CSS（teal 克制风格，CSS 变量驱动）

affects: [16-05]

tech-stack:
  added: []
  patterns:
    - "Settings 持久默认 model picker：useState lazy init 读 storage.get(PREF_IMAGE_GEN_MODEL) ?? DEFAULT；onChange→storage.set + setState 同步写持久层与 UI 态"
    - "registry image-gen resolve 最小侵入覆盖：只在 image-gen case 加 storage.get(PREF_IMAGE_GEN_MODEL)，缺省回退 DEFAULT_IMAGE_GEN_MODEL.id，不动函数签名/其他 case"
    - "model 优先级三级闭环（16-03 工具层 + 16-04 settings 层）：工具 args.model_id > 用户 Settings 持久（PREF_IMAGE_GEN_MODEL）> registry 默认 doubao"
    - ".aster-settings__select 仿 .aster-settings__pref-input：CSS 变量（--border/--surface/--text/--radius-1/--space-N）+ teal 焦点 ring（--ring-focus + --accent），无硬编码 hex/px（aster-design-system teal 克制）"

key-files:
  created: []
  modified:
    - src/lib/storage.ts
    - src/providers/registry.ts
    - src/providers/registry.test.ts
    - src/components/Settings/SettingsPanel.tsx
    - src/styles.css
    - src/lib/storage.test.ts
    - src/i18n/locales/zh-CN/messages.po

key-decisions:
  - "PREF_IMAGE_GEN_MODEL 字面 key = 'aster:pref:image-gen-model'（与 16-03 工具层读取的字面量一致，闭环对齐：16-03 工具优先读 args.model_id 再读此 storage key，16-04 settings 负责写入此 key）"
  - "registry image-gen case 最小侵入：仅新增 1 行 storage.get(PREF_IMAGE_GEN_MODEL) + 1 行 fallback，model 字段从硬编码 DEFAULT_IMAGE_GEN_MODEL.id 改为 preferredModel ?? DEFAULT；不改 resolve 签名、不影响 chat/short-task/vision/stock-image case"
  - "SettingsPanel model picker 用 useState lazy initializer 一次性读 storage（避免每次渲染读 localStorage），setImageGenModel 同步写 storage.set + setState（持久层与 UI 态双写）"
  - "JSX 放在「自动附带选区内容」section 之后、「自定义偏好」之前——属行为配置类全局选项，与既有 section 并列复用 .aster-settings__section/__label/__hint"
  - ".aster-settings__select 新建（styles.css 原无此类），仿 .aster-settings__pref-input 范式：全 CSS 变量、teal 焦点 ring，符合 aster-design-system 单一 teal 品牌色 + 无渐变/特效"
  - "CSS 变量以线上 src/styles.css 实际为准（--space-N/--radius-1），未采用 PLAN 示例里不存在的 --sp-2/--radius-2（aster-design-system skill：以线上 styles.css 为像素级真相）"

requirements-completed:
  - IMG-04

metrics:
  duration: ~5min
  tasks: 2
  files: 7（0 created / 7 modified；storage+registry+2 test + SettingsPanel + styles + messages.po）
  tests: 828 passed / 0 failed（较 16-03 的 823 +5：registry 新增 4 + storage 新增 1）
  bundle: main 78.12 KB gzip（≤82KB 门内；较 16-03 的 78.03 仅 +0.09KB，新增 1 个 select + 1 段 CSS）
completed: 2026-06-02
---

# Phase 16 Plan 04: Settings 生图 model picker（IMG-04）Summary

**实现 D-04 的 Settings 持久默认 model picker：SettingsPanel 全局选项区新增「生图模型」下拉（3 选项来自 IMAGE_GEN_MODELS，默认 doubao），选择持久到 localStorage `aster:pref:image-gen-model`；ProviderRegistry.resolve('image-gen') 读同一 key 覆盖默认 doubao，缺省回退。打通「用户选 gpt-image-2 → 后续所有生图调用用 gpt-image-2（跨 session）」的闭环。**

## 完成内容

### Task 1：registry image-gen resolve 读 PREF_IMAGE_GEN_MODEL 覆盖默认 doubao（commit 748731f）

- **storage.ts** — `STORAGE_KEYS` 新增 `PREF_IMAGE_GEN_MODEL: 'aster:pref:image-gen-model'`（带注释说明 IMG-04 用途与 fallback 行为）。键数 8 → 9。
- **registry.ts** — `image-gen` case 扩展（最小侵入，仅 model 字段）：在 apiKey 校验后新增 `const preferredModel = storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL)` + `const modelId = preferredModel ?? DEFAULT_IMAGE_GEN_MODEL.id`，返回 config 的 `model` 字段从硬编码 `DEFAULT_IMAGE_GEN_MODEL.id` 改为 `modelId`。不动 resolve 签名、不影响 chat/short-task/vision/stock-image case。
- **registry.test.ts** — 追加 `describe('image-gen resolve — PREF_IMAGE_GEN_MODEL localStorage 覆盖（IMG-04 D-04）')` 4 个用例：① 有 pref（gpt-image-2）→ model=gpt-image-2 且 providerId/apiKey 不受影响；② pref=gemini → model=gemini；③ 无 pref（null）→ 回退 DEFAULT（doubao）；④ 两次 storage.get（apiKey key + pref key）调用守门。mock 的 STORAGE_KEYS 补 PREF_IMAGE_GEN_MODEL 字面量。

### Task 2：SettingsPanel 新增生图 model picker + lingui extract（commit 48f2e77）

- **SettingsPanel.tsx**（3 步改动）：
  - imports：`import { IMAGE_GEN_MODELS, DEFAULT_IMAGE_GEN_MODEL } from '../../providers/registry'` + `import { storage, STORAGE_KEYS } from '../../lib/storage'`（原文件无 storage 导入，新增）。
  - state：`imageGenModel` useState lazy init 读 `storage.get(PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id`；`setImageGenModel(modelId)` 同步 `storage.set` + `setImageGenModelState`。
  - JSX：全局选项区新增 `.aster-settings__section`，含 `<label>` + `.aster-settings__select`（`IMAGE_GEN_MODELS.map` 渲染 3 个 `<option>`，value=imageGenModel，onChange→setImageGenModel）+ `.aster-settings__hint`「默认生图模型。预览卡内可临时切换不保存。」。放在「自动附带选区内容」之后、「自定义偏好」之前。
- **styles.css** — 新增 `.aster-settings__select`（仿 `.aster-settings__pref-input`）+ `:focus`：全 CSS 变量（`--border`/`--surface`/`--text`/`--radius-1`/`--space-2`/`--accent`/`--ring-focus`/`--dur-fast`），teal 焦点 ring，无硬编码 hex/px。
- **storage.test.ts** — 同步键数断言（Rule 1，见 Deviations）：8 → 9，并补「应包含 PREF_IMAGE_GEN_MODEL 键」用例。
- **lingui extract** — `npm run extract` 写入 messages.po 两条新条目「生图模型」「默认生图模型。预览卡内可临时切换不保存。」（zh-CN source-locale，msgid=msgstr 自填，0 missing，133 条）。

## Deviations from Plan

### 自动修复项

**1. [Rule 1 - Bug] storage.test.ts 键数断言 + registry.test.ts 现有 image-gen 用例随改动同步**

- **Found during：** Task 1（registry.test 跑）+ Task 2（全量测试跑）
- **Issue：**
  - `storage.test.ts:217` 硬编码 `Object.keys(STORAGE_KEYS).toHaveLength(8)`，新增第 9 个 key 后失败（got 9）。
  - `registry.test.ts` 现有 `resolve("image-gen")` 用例用 `mockReturnValue('sk-aihubmix-key')`（所有 key 都返回同值），改动后 PREF_IMAGE_GEN_MODEL 也会拿到 `'sk-aihubmix-key'` 导致 model 字段被污染、断言 doubao 失败。
- **Fix：**
  - storage.test.ts：键数断言 8→9 + 新增「应包含 PREF_IMAGE_GEN_MODEL 键」用例（断言字面 `'aster:pref:image-gen-model'`）。
  - registry.test.ts：现有 image-gen 用例改为 `mockImplementation` 按 key 区分（pref key 返回 null、其余返回 key），保持 model=doubao 断言成立；同时 mock 的 STORAGE_KEYS 对象补 `PREF_IMAGE_GEN_MODEL` 字面量（否则 mock 里取到 undefined，storage.get(undefined) 行为不可控）。
- **Why Rule 1（非新决策）：** 这些断言本就是「key 数与定义同步」「image-gen 解析正确性」的守门，PLAN acceptance_criteria 的 `npm test -- --run 退出 0` 隐含要求同步；不改任何运行时逻辑。
- **Files modified：** src/lib/storage.test.ts、src/providers/registry.test.ts
- **Commits：** 748731f（registry.test 部分，Task 1）+ 48f2e77（storage.test 部分，Task 2）

### 实现细节差异（非偏离，记录备查）

- **CSS 变量名以线上 styles.css 为准。** PLAN action 示例的 `.aster-settings__select` 用了 `padding: 4px var(--sp-2)`、`border-radius: var(--radius-2)`、`font-size: 12.5px`，但线上 styles.css 实际变量是 `--space-N` 系列、`--radius-1`，无 `--sp-2`。按 aster-design-system skill「以线上 src/styles.css 为像素级真相」原则，新建样式仿同文件既有 `.aster-settings__pref-input`（`--space-2`/`--radius-1`/`font-size:13px`/`--dur-fast`），与既有 form 元素视觉统一，而非照搬 PLAN 不存在的变量。

- **PLAN Task 1 示例的 vi.spyOn(storageModule, 'storage', 'get') mock 范式未采用。** PLAN 提示「mock 范式须先读 registry.test.ts 现有用法后对齐」。registry.test.ts 实际是文件级 `vi.mock('../lib/storage')` + `vi.mocked(storage.get)`，故新用例统一用 `mockImplementation` 按 key 区分，与现有用例一致，未引入 spyOn getter 范式。

## 验证

- `npx vitest run src/providers/registry.test.ts` → 20/20 passed（含新增 4 个 D-04 用例）。
- `npx vitest run src/lib/storage.test.ts` → 22/22 passed（键数 9 + PREF_IMAGE_GEN_MODEL 用例）。
- `npx vitest run`（全量）→ **828 passed / 0 failed**；较 16-03 的 823 +5（registry 4 + storage 1）。coverage.test.ts（lingui catalog 已提交守门）通过——catalog 已含两条新条目且 git 干净。
- `npm run extract` → zh-CN 133 条，0 missing，「生图模型」「默认生图模型。预览卡内可临时切换不保存。」入 messages.po。
- `npm run build` → tsc 无 TypeScript error（`grep -c "error TS"` = 0），vite build 成功，main chunk 78.12 KB gzip（≤82KB 门内）。

## Acceptance Criteria 核对

| 准则 | 结果 |
|------|------|
| storage.ts 含 PREF_IMAGE_GEN_MODEL（grep ≥1，实 1） | ✅ |
| registry.ts 含 PREF_IMAGE_GEN_MODEL（grep ≥1，实 2） | ✅ |
| storage.ts 含字面 'aster:pref:image-gen-model'（grep ≥1，实 1） | ✅ |
| registry.test.ts 退出 0 | ✅ 20/20 |
| build 无 error TS（grep -c = 0） | ✅ |
| SettingsPanel 含 IMAGE_GEN_MODELS/image-gen-model/生图模型（grep ≥2，实 7） | ✅ |
| styles.css 含 aster-settings__select（grep ≥1，实 2） | ✅ |
| SettingsPanel 含 aster-settings__select（grep ≥1，实 1） | ✅ |
| npm run extract 退出 0 | ✅ |
| npm test --run 退出 0（含 coverage lingui 检查） | ✅ 828/0 |

## must_haves 核对

| truth | 结果 |
|-------|------|
| resolve('image-gen') 支持从 localStorage 读用户选定 model 覆盖默认 doubao | ✅ registry.ts image-gen case 读 PREF_IMAGE_GEN_MODEL |
| SettingsPanel 含生图 model 下拉（select），选项来自 IMAGE_GEN_MODELS，持久 aster:pref:image-gen-model | ✅ |
| 默认展示 doubao-seedream-5.0-lite（isDefault:true） | ✅ DEFAULT_IMAGE_GEN_MODEL.id fallback + lazy init |
| 切换 model 后 resolve('image-gen') 返回新 model ID | ✅ registry.test 用例覆盖（gpt-image-2/gemini） |

## 设计系统对齐（aster-design-system teal 克制）

- 复用既有 `.aster-settings__section` / `.aster-settings__label` / `.aster-settings__hint`，与「自动附带选区」「自定义偏好」section 视觉一致。
- 新 `.aster-settings__select` 全 CSS 变量驱动（无硬编码 hex/px），teal 焦点 ring（`--ring-focus` = `0 0 0 2px var(--bg), 0 0 0 4px var(--accent)`）+ `border-color: var(--accent)`，单一 teal 品牌色，无渐变、无 backdrop-filter。
- 文案走 Lingui `<Trans>` 宏 + `t\`生图模型\`` aria-label，已 extract 入 zh-CN catalog。

## Known Stubs

无。本 plan 全部功能完整接线：SettingsPanel select 真写 storage、registry 真读 storage、3 个 model 选项来自真实 IMAGE_GEN_MODELS 常量。「预览卡内可临时切换不保存」的预览卡临时覆盖能力（args.model_id）由 16-03 工具层已实现、16-05 预览卡 UI 接入。

## Self-Check: PASSED

- FOUND: .planning/phases/16-img-ppt-word/16-04-SUMMARY.md
- FOUND commit 748731f（Task 1）
- FOUND commit 48f2e77（Task 2）
- FOUND: src/lib/storage.ts PREF_IMAGE_GEN_MODEL
- FOUND: src/providers/registry.ts PREF_IMAGE_GEN_MODEL
- FOUND: src/components/Settings/SettingsPanel.tsx aster-settings__select + 生图模型
- FOUND: src/styles.css .aster-settings__select
</content>
</invoke>
