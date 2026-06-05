---
phase: 26
phase_name: config-import-export
review_depth: standard
status: issues_found
files_reviewed: 9
findings:
  critical: 0
  warning: 4   # CRITICAL(0) + HIGH(1) + MEDIUM(3) 映射到 GSD warning 层
  info: 6      # LOW(6)
  total: 10
by_severity:
  CRITICAL: 0
  HIGH: 1
  MEDIUM: 3
  LOW: 6
verified_safe: 5
reviewed_at: 2026-06-05
validation:
  configBackup_tests: 19/19 PASS
  tsc_noEmit: PASS
  i18n_coverage: PASS
  eslint: PASS
---

# Phase 26 代码审查报告 — 配置导入导出

> 深度：standard ｜ 审查范围：Phase 26 commit（`90f9b27^..HEAD`）改动的源文件
> 结论：**无 CRITICAL / 无阻断性问题。安全（无后台 + key 不泄漏）硬约束已兑现。**
> 但有 **1 个 HIGH 正确性 bug**（"跳过冲突项"仍会覆盖被跳过 provider 的 API key）需修复后再 verify。

## 审查范围（9 文件）

核心（深度审查）：
- `src/lib/configBackup.ts`（341 行，11 导出）
- `src/lib/configBackup.test.ts`（19 测试）
- `src/components/Settings/SettingsPanel.tsx`（+284 行，导入导出分区 + 三态对话框 + importNonce）
- `src/components/icons.tsx`（+DownloadIcon）
- `src/styles.css`（+4 组件类，复用 --warning/--error token）
- `src/i18n/locales/zh-CN/messages.{po,ts}`（+21 文案）

依赖路径（交叉核验，未改但影响正确性）：`store/providers.ts`、`store/preferences.ts`、`lib/storage.ts`

配置（trivial，仅瞄一眼）：`.github/workflows/ci.yml`、`.size-limit.json`（bundle 硬门 82→100KB，用户已拍板，非本次审查重点）

## 发现计数

| 严重度 | 数量 |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 3 |
| LOW | 6 |
| 已核验安全/通过（INFO） | 5 |

## 验证执行结果（实跑佐证）

| 检查 | 结果 |
|---|---|
| `vitest run configBackup.test.ts` | ✅ 19/19 PASS |
| `tsc --noEmit` | ✅ EXIT 0 |
| `vitest run i18n/coverage.test.ts` | ✅ PASS（SettingsPanel 21 条宏文案全提取） |
| `eslint`（3 个源文件） | ✅ 干净（PROV-10 等无违规） |

---

## HIGH

### HR-01 「跳过冲突项」仍会覆盖被跳过 provider 的 API key（静默凭证覆盖）

**文件**：`src/lib/configBackup.ts:295-303`（写 key 循环）；触发于 `SettingsPanel.tsx:230-239`（handleSkipConflictsAndImport）

**问题**：
`applyImport` 第 1 步 upsert providers 时正确跳过了 `skipIds` 中的项（保留现有 provider 配置）：

```ts
for (const provider of config.providers) {
  if (!skipSet.has(provider.id)) {     // ✅ skip 校验在这里
    upsertProviderById(provider);
  }
}
```

但**第 2 步写 API key 时完全没有 skipSet 校验**：

```ts
for (const [id, key] of Object.entries(config.keys)) {
  if (id !== 'pexels' && key) {
    store.setKey(id, key);   // ❌ 被跳过的 provider 的 key 照样写入
    keyCount++;
  }
}
```

`setKey` → `storage.set(KEY_PREFIX + id, apiKey)` 无条件覆盖。后果：用户点「跳过冲突项」（意图=保留本地现有），冲突 provider 的**配置被保留，但 API key 被导入文件里的 key 静默替换**。这直接违背 skip 按钮的语义，且属于凭证级数据丢失——用户主动选择"不动我的"，结果密钥被换掉。

**测试盲区**：`configBackup.test.ts:536-574`（skipIds 用例）只断言 `hydrateFromStorage` 被调用，**没有断言被跳过 id 的 `setKey` 未被调用**，所以此 bug 不被现有测试捕获。

**建议**：
1. 第 2 步加 skipSet 过滤：`if (id !== 'pexels' && key && !skipSet.has(id))`。
2. `keyCount` 同步只计未跳过的 key（当前 skip 路径 toast 的密钥数也偏大）。
3. 补一条测试：skip 路径下 `expect(mockSetKey).not.toHaveBeenCalledWith('custom-skip', expect.anything())`，结构性守门（符合 MEMORY「复发故障加 gate」原则）。

---

## MEDIUM

### MR-01 全局偏好在所有导入路径被无条件覆盖，与「保留现有 + 加入新的」承诺不符

**文件**：`src/lib/configBackup.ts:316-331`；对话框文案 `SettingsPanel.tsx:588`

**问题**：
无冲突确认对话框文案承诺「与本地现有配置合并（**保留现有 + 加入新的**）」（非破坏性语义），但 `applyImport` 对全局标量字段**一律无条件覆盖**，无论 confirm 还是 skip 路径：

- `setDefaultLLM(config.defaultProviderId)` — 替换当前默认 Provider
- `setBrandAccentColor(config.brandAccentColor)` — 替换主题强调色
- `setPrefs(config.userPreferences ?? '')` — 替换自定义偏好
- `imageGenModel` / `pexelsKey` — `if (truthy)` 覆盖
- `setAttachEnabled(...)` — 替换选区附带开关

特别地，第 5 步用 `if (config.userPreferences !== undefined)`（而非 truthy 判断），所以导入一个**导出方偏好为空字符串**的配置会调用 `setPrefs('')`，**清空导入方现有的偏好文本**。（对比：`brandAccentColor` 为空时 `normalizeHexColor('')` 返回 null，`setBrandAccentColor` 提前 return，反而安全——两处空值守门不一致。）

后果：用户对导入"合并"的预期是新增 Provider，但默认 Provider / 主题色 / 偏好 / 生图模型会被悄悄替换，"跳过冲突项"也救不回这些全局项。

**建议**（择一，需产品确认语义）：
- 最小：修正 confirm/skip 对话框文案，明确告知"全局偏好（默认 Provider / 主题色 / 偏好 / 生图模型 / 图库 Key）将被导入文件替换"，消除误导。
- 更稳：仅在导入值非空时覆盖，且把空字符串 `userPreferences` 视为"不覆盖"（与 brandAccentColor 行为对齐）。

### MR-02 校验只查 providers 是数组、keys 是对象，不校验 provider 元素结构

**文件**：`src/lib/configBackup.ts:77-87`（validateAsterConfig）→ `257-265`（upsertProviderById）

**问题**：
`validateAsterConfig` 只做顶层结构检查：`Array.isArray(data.providers)` + `keys` 是对象。**不校验数组元素**。以下损坏/恶意文件均能通过校验进入 `applyImport`：

- `providers: [{}]`（缺 id/name/baseURL/model）
- `providers: [{ id: 123 }]`（非字符串 id）
- `providers: [{ id: "x", baseURL: null }]`（baseURL 缺失）

随后 `upsertProviderById` 把垃圾对象 `{...config}` 注入 store 并 `storage.set(PROVIDERS, updated)` **持久化**。后果：provider 列表出现无名/无 baseURL 条目；agent loop 解析 `provider.baseURL` → undefined → fetch 到非法 URL 失败；非字符串 id 让 `detectConflicts` 的 Set 语义错乱。`hydrateFromStorage` 的 WR-02 防污染只强制内置 provider 的 isBuiltIn，**不会清掉结构残缺的自定义 provider**。

**建议**：在 `validateAsterConfig`（或 applyImport upsert 前）逐元素校验 `typeof p.id === 'string' && p.id && typeof p.baseURL === 'string' && typeof p.model === 'string' && typeof p.name === 'string'`，不合格的 provider 跳过（连带其 key）。这是导入"恶意/损坏 JSON"健壮性的主要缺口。

### MR-03 keys 值未校验为字符串

**文件**：`src/lib/configBackup.ts:298-303`

**问题**：
`Object.entries(config.keys)` 的 value 没有类型校验。`if (id !== 'pexels' && key)` 的 truthy 检查对**非字符串**（对象 `{}`、数组、数字）同样为真，于是 `store.setKey(id, key)` 把非字符串写入 storage（`JSON.stringify` 后存）。后果：`getKey` 返回非字符串 → 鉴权头 `Bearer ${key}` 变成 `Bearer [object Object]` 调用失败；且该 provider 被 `computeConfiguredKeyIds` 误判"已配置 key"→ 红条误消，用户以为配好了实际用不了。

**建议**：写 key 前加 `typeof key === 'string' && key.trim()` 守门（与 MR-02 同一道入参清洗）。

---

## LOW

### LR-01 导入无文件大小上限，`file.text()` 读整个文件
**文件**：`SettingsPanel.tsx:192`
`await file.text()` 不限大小；误选超大文件会阻塞/撑爆 task pane（webview 内存有限）。`accept=".json"` 仅是选择器提示，不限制实际大小。建议读取前加 `if (file.size > 1_000_000) { 报错 EMPTY/格式 }` 之类上限（配置文件实际仅 KB 级）。实战风险低（用户选自己的文件），但属健壮性缺口。

### LR-02 version 下界/整数性未校验
**文件**：`src/lib/configBackup.ts:77-87, 203`
仅 `typeof version === 'number'` + 拒 `> ASTER_CONFIG_VERSION`。`version: 0` / 负数 / `1.5` 会被静默当 v1 接受。当前只有 v1，向后兼容尚无实际影响，但建议显式定义合法下界（如 `version >= 1 && Number.isInteger(version)`），为未来版本迁移留干净判据。

### LR-03 exportConfig 同步 revoke + `<a>` 未挂载 DOM
**文件**：`src/lib/configBackup.ts:146-157`
`a.click()` 后**同步** `URL.revokeObjectURL(url)`，且 `<a>` 未 append 到 body。目标浏览器（Edge/Chrome 最新两版）可正常下载，但缺少业界稳妥写法（append-to-body + `setTimeout(revoke)`），在个别 webview/时序下可能取消下载。建议补防御写法。

### LR-04 handleFileChosen 冗余动态 import
**文件**：`SettingsPanel.tsx:198`
`const { useProviderStore: ps } = await import('../../store/providers')` 动态再导入，而文件顶部 `:26` 已静态 import 同一 `useProviderStore`（同模块实例，`.getState()` 拿到的就是最新态）。动态 import 多余且与文件其余写法不一致，是代码味。建议直接用顶部静态导入的 `useProviderStore.getState().providers`。

### LR-05 configBackup.ts 4 个错误码文案未过 Lingui 宏
**文件**：`src/lib/configBackup.ts:182-228`（INVALID_JSON / NOT_ASTER_CONFIG / UNSUPPORTED_VERSION / EMPTY_CONFIG 的 message + hint，共 8 条中文）
这些字符串是 lib 层纯字面量，经对话框 `importDialog.error.message/hint` 直接渲染，**未过 `t`/`<Trans>` 宏**。已实测 `messages.po` 中 0 命中，且 `coverage.test.ts` 因其非宏也检测不到。v1 中文-only 无影响，但 v1.1 英文 i18n 时这 8 条无法提取/翻译。建议 v1.1 前把错误码改为返回 i18n key、在组件侧用宏渲染（或 lib 返回 code、文案由组件映射）。

### LR-06 导出/导入按钮图标尺寸可能不一致
**文件**：`src/components/icons.tsx:32-53` + `SettingsPanel.tsx:440/449`
`DownloadIcon` 硬编 `width={16} height={16}`，而 `UploadIcon` 不接 size 参数、走 `{...base}`（尺寸由 CSS 控制）。并排的等宽备份按钮里，导出图标被强制 16px、导入图标走 CSS 默认值，二者尺寸可能不一致（视觉不齐）。建议让 `UploadIcon` 也接 `size` 并统一传 `size={16}`，或两者都去掉硬编尺寸交给 CSS。

---

## 已核验安全 / 通过项（INFO，非问题）

### IR-01 安全 / 无后台硬约束 — ✅ PASS（最重要维度）
- `buildExportData` 仅从本地 storage + Zustand store 读取；`exportConfig` 用 Blob + `URL.createObjectURL` 触发**浏览器本地下载**，无任何 `fetch`/网络/遥测。
- `parseImportFile` 纯本地 `JSON.parse`；`applyImport` 仅写本地 storage/store。
- **明文 key 仅进用户本地下载文件，绝不离开浏览器到 Aster 服务器**——Core Value 硬约束兑现。
- 无 key 进入 `console`/`error`/日志：`storage.get` 解析失败静默吞错且不打印值（T-02-08）；错误对话框只渲染静态 message/hint，无 key 回显。

### IR-02 原型污染 — ✅ 已核验安全
`JSON.parse` 将 `__proto__`/`constructor` 作为**自有可枚举属性**写入（不触发 [[Prototype]] 链修改），且代码无递归 merge / `Object.assign` 深合并 sink，`Object.entries` + 浅 spread 不污染 `Object.prototype`。最坏情况 `keys:{"__proto__":"x"}` 只会写一条无害 storage 项 `aster:keys:__proto__`。无原型污染攻击面。（虽安全，仍建议 MR-02/MR-03 的入参清洗一并过滤这类异常 key。）

### IR-03 F-08 同 id 保留 — ✅ 核验通过
`upsertProviderById` 用 `useProviderStore.setState` 直接 upsert，`exists ? map(替换) : push`，**保留导入 provider 原 id**，绕开 `addProvider` 的 `crypto.randomUUID()`。同 id 覆盖判断（detectConflicts）因此成立。

### IR-04 F-07 reactive 刷新 — ✅ 核验通过
`applyImport` 末尾统一 `hydrateFromStorage()` 重算 `configuredKeyIds`/providers/default/attachEnabled（红条、列表、默认、开关响应式）；`SettingsPanel` 的 `importNonce` useEffect 重读 storage 刷新本地 state 的生图模型 + Pexels key；偏好/主题色走 `usePreferencesStore` setter 触发响应式。导入后 UI 无需手动刷新。

### IR-05 字段集 D-02 + 4 错误码 — ✅ 核验通过
- 导出字段集含 `PREF_IMAGE_GEN_MODEL`，**不含** `ONBOARDING_SEEN` / `PEXELS_BASE_URL` / 聊天历史（mock 与实现均守此约束）。
- 4 个错误码（INVALID_JSON / NOT_ASTER_CONFIG / UNSUPPORTED_VERSION / EMPTY_CONFIG）均为 Result 形态（不 throw）、结构化 `{code,message,hint}`，容错诚实。

---

## 推荐下一步

存在 1 个 HIGH（HR-01 凭证覆盖）+ 3 个 MEDIUM，建议：

→ **先跑 `/gsd-code-review-fix 26`**（至少修 HR-01；MR-01 文案 / MR-02、MR-03 入参清洗一并处理），HR-01 修复须补结构性测试守门。修复后再 `/gsd-verify-work` / verify 收尾。

LOW 项可在 fix 顺手处理或记入 backlog，不阻断。
