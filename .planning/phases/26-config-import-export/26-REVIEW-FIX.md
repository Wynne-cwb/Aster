---
phase: 26
phase_name: config-import-export
fix_scope: all
findings_in_scope: 10
fixed: 10
skipped: 0
backlog: 0
iteration: 1
status: all_fixed
based_on_review: 26-REVIEW.md
fixed_at: 2026-06-06
validation:
  npm_test: PASS (1100/1100, 0 failed; 尾部 3 个 retry.test.ts unhandled errors = 已知噪音)
  tsc_noEmit: PASS
  eslint: PASS (configBackup.ts / SettingsPanel.tsx / icons.tsx)
  i18n_coverage: PASS
  npm_build: PASS
  bundle_size_gzip: 82.48KB / 100KB 硬门 PASS
  no_backend: PASS (configBackup.ts 无任何网络调用，key 仍只落本地)
hr01_structural_guard_added: true
---

# Phase 26 代码审查修复报告 — 配置导入导出

> 基于 `26-REVIEW.md`（0C / 1H / 3M / 6L）。**全部 10 条 finding 已修复**，每条原子 commit（本地，未 push）。
> HR-01 已补结构性守门测试（凭证覆盖回归防线）。
> 收尾门全绿：`npm test` 1100/1100 · tsc · eslint · i18n coverage · build · size 82.48KB/100KB。

## 逐条处置

| ID | 严重度 | 处置 | Commit | 守门测试 |
|---|---|---|---|---|
| HR-01 | HIGH | ✅ 已修 | `e8b512e` | ✅ 新增（结构性，关键） |
| MR-01 | MEDIUM | ✅ 已修 | `605e15f` | ✅ 新增 2 条 |
| MR-02 | MEDIUM | ✅ 已修 | `27831ee` | ✅ 新增 1 条 |
| MR-03 | MEDIUM | ✅ 已修 | `6cc7092` | ✅ 新增 1 条 |
| LR-01 | LOW | ✅ 已修 | `e5734c6` | — |
| LR-02 | LOW | ✅ 已修 | `9827860` | ✅ 新增 1 条 |
| LR-03 | LOW | ✅ 已修 | `f1de68e` | — |
| LR-04 | LOW | ✅ 已修 | `290d5f6` | — |
| LR-05 | LOW | ✅ 已修 | `41d6446` | i18n coverage 守 |
| LR-06 | LOW | ✅ 已修 | `8ee3828` | — |
| (chore) | — | catalog 行号刷新 | `60d0d56` | i18n coverage 守 |

backlog：**无**（6 个 LOW 全修，均为纯净低风险改动；无项目延后）。

---

## HIGH

### HR-01 「跳过冲突项」仍覆盖被跳 provider 的 API key — ✅ 已修（`e8b512e`）

**修复**：`applyImport` 第 2 步写 key 循环加 `!skipSet.has(id)` 过滤；`keyCount` 同步只计未跳过的 key（skip 路径 toast 密钥数不再偏大）。

**结构性守门（关键，符合「复发故障加 gate」原则）**：
- 强化既有 skip 测试：`expect(mockSetKey).not.toHaveBeenCalledWith('custom-skip', expect.anything())` + 未跳过 id 仍正常写入 + `keyCount === 1`。
- 新增多冲突用例：两个内置 provider 同时被跳，断言两者 key 均不写、仅新 id 写入。
- 这两条断言在旧代码下会 fail（旧逻辑无条件 setKey），即真正的回归防线——现有测试只断言 `hydrateFromStorage` 被调用，测不出此 bug。

---

## MEDIUM

### MR-01 全局偏好无条件覆盖，与「保留现有 + 加入新的」承诺不符 — ✅ 已修（`605e15f`）

**修复（采用 review「更稳」方案，team-lead 拍板）**：`userPreferences` / `brandAccentColor` / `defaultProviderId` 改为「仅在导入值非空时覆盖」；空字符串 / 缺失保持导入方现有值。
- 根因消除：旧逻辑第 5 步用 `!== undefined`，导致导入「偏好为空字符串」的配置会调 `setPrefs('')` 清空现有偏好；现改为非空 string 判断。
- `defaultProviderId` 空值不再覆盖（避免把 default 设成 `''` 破坏选中态）。
- `hasPrefs`（→ `prefsRestored` → toast「偏好已恢复」）同步收紧为非空判断。
- `selectionAttachEnabled`（布尔开关）保持原样：不在 team-lead MR-01 列举范围（仅「默认 Provider/主题色/偏好/生图模型」），布尔无「空值」概念，导出恒含 true/false，沿用 `?? true` 合理。

**守门**：新增 2 条——空值不调用任何 setter（`prefsRestored === false`）；非空才覆盖。

### MR-02 不校验 provider 元素结构 — ✅ 已修（`27831ee`）

**修复**：新增 `isValidProviderConfig` 守门（非空 string id + string name/baseURL/model），`applyImport` 先 `validProviders = config.providers.filter(...)` 再 upsert，垃圾元素（`{}`、`{id:123}`、`{baseURL:null}`、空白 id）不再持久化进 store/storage。`providerCount` 用 validProviders 计数；写 key 循环加 `validProviderIds.has(id)`，连带跳过损坏 provider 的 key，不留孤儿密钥。

**守门**：新增 1 条——5 元素（含 4 损坏）只 upsert 合法 1 个（`setState` 仅 1 次）、只写其 key。

### MR-03 keys 值未校验为字符串 — ✅ 已修（`6cc7092`）

**修复**：写 key 前加 `typeof key === 'string' && key.trim().length > 0`（按 `unknown` 处理不可信来源），杜绝 `Bearer [object Object]` + `computeConfiguredKeyIds` 误判致红条误消。

**守门**：新增 1 条——对象 / 数字 / 纯空白 key 均拒绝，仅合法 string 写入。

> 注：HR-01 + MR-02 + MR-03 三道守门叠加在同一写 key 循环：
> `id !== 'pexels' && typeof key === 'string' && key.trim() && !skipSet.has(id) && validProviderIds.has(id)`。

---

## LOW（6 个全修）

- **LR-01（`e5734c6`）** 导入文件大小上限：读取前加 `MAX_IMPORT_BYTES = 1MB` 守门（配置文件实际仅 KB 级），超限走 `FILE_TOO_LARGE` 错误对话框。
- **LR-02（`9827860`）** version 合法下界：`version >= 1 && Number.isInteger(version)`，拒 0 / 负数 / 1.5；文案泛化为「版本 X 不受支持」。补 0/-1/1.5 三例测试。
- **LR-03（`f1de68e`）** 导出下载防御写法：`<a>` append-to-body + 点击后 `setTimeout` 延迟 `revokeObjectURL` + 移除节点（替代未挂载 DOM + 同步 revoke）。
- **LR-04（`290d5f6`）** 删除 `handleFileChosen` 冗余动态 import，改用文件顶部已静态导入的 `useProviderStore`（同模块实例）。
- **LR-05（`41d6446`）** 4 个错误码 8 条中文文案过 Lingui：`ImportError` 加可选 `values`（携带版本号插值），`SettingsPanel.localizeImportError(code)→t` 映射，lib message/hint 降为兜底。`extract` 入 messages.po（版本号用 `{0}/{1}` 占位）。
- **LR-06（`8ee3828`）** `UploadIcon` 加可选 `size`（默认 24，向后兼容），导入按钮统一传 `size={16}` 与导出图标对齐。

> **chore `60d0d56`**：LR-04/LR-06 改 SettingsPanel.tsx 行号后，既有宏文案的 `#:` 源引用偏移，重跑 `extract` 同步（无 msgid/msgstr 变更），修复 i18n coverage.test。

---

## 安全 / 无后台复核（修复未引入回归）

- `configBackup.ts` grep 无 `fetch` / `XMLHttpRequest` / `sendBeacon`——API key 仍只落用户本地（Blob 下载 + localStorage），绝不离开浏览器。
- MR-02/MR-03 的入参清洗顺带收窄了 IR-02 提到的异常 key 写入面（非 string 值、损坏 provider 的 key 一律不落 storage）。

## 收尾门实测（诚实）

| 检查 | 结果 |
|---|---|
| `npm test`（tsc + vitest） | ✅ **1100/1100 PASS，0 failed**；尾部 3 个 `retry.test.ts` unhandled errors = 已知噪音（memory） |
| `tsc --noEmit` | ✅ EXIT 0 |
| `eslint`（configBackup.ts / SettingsPanel.tsx / icons.tsx） | ✅ EXIT 0 |
| `i18n/coverage.test.ts` | ✅ PASS（含 LR-05 新增 10 条文案 + 行号刷新） |
| `npm run build` | ✅ 成功 |
| `npm run size` | ✅ **82.48 KB gzip / 100 KB 硬门**（+0.31KB，LR-05 文案，余量充裕） |

新增/强化测试统计：configBackup.test.ts 19 → 25（+6：HR-01 ×2 强化/新增、MR-01 ×2、MR-02 ×1、MR-03 ×1、LR-02 ×1）。

## 推荐下一步

→ `gsd-verify-work 26`（或 gsd-verifier）做目标回溯核验后收口。所有改动均本地 commit、**未 push**（按 team-lead 约定，部署时机由你决定）。
