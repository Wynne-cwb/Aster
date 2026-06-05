# Phase 26: 配置导入导出（明文 JSON 可移植） - Context

**Gathered:** 2026-06-05
**Status:** Ready for UI-spec → planning
**Requirements:** CFG-01 / CFG-02 / CFG-03（+ NFR-12 全里程碑 bundle 收口在 Phase 29，本阶段仅"不破门"）

> **GSD 命名说明：** 本项目 discuss 产物沿用 `NN-CONTEXT.md`（plan-phase 消费的权威决策文件）+ `NN-DISCUSSION-LOG.md`（审计轨迹），即 team-lead 口中的「DISCUSS.md」。下游 UI-researcher / planner 读本文件。

> 🔴 **PLANNER / UI-RESEARCHER 必读 —— 本阶段是 UI phase。** 真人用户经 team-lead 已就 4 项 UX/产品取向拍板（见 §Human Decisions）。强烈建议下一步先跑 `/gsd-ui-phase` 出 `26-UI-SPEC.md`（加载 `aster-design-system` skill，teal 克制），再 `/gsd-plan-phase`。

---

<domain>
## Phase Boundary

让用户能在 Settings **一键导出全部持久化配置为明文 JSON 文件下载**，并在新机器 / 新浏览器 / 新宿主**上传 JSON 导入**，彻底解决「换电脑 / 换浏览器 / 换宿主重输 API Key 地狱」（partitioned localStorage 是 per-origin，PPT/Word/Excel 可能不同分区，Key 不共享）。安全姿态 = **明文 JSON + 醒目警告**（用户已拍板，便利优先）。

**做什么（需求映射）：**
- **CFG-01** — Settings「导出配置」按钮 → 浏览器下载一个 JSON 文件，含：全部 Provider 配置 + 全部 API key（含内置 deepseek/aihubmix key）+ 默认 Provider + 选区附带开关 + 用户偏好 + 主题强调色 + Pexels key **+ 生图默认模型偏好**（Q4 新增）；**不含聊天历史**。
- **CFG-02** — Settings「导入配置」按钮 → 上传 JSON → 合并策略「保留现有 + 加入新的」；同 id Provider **覆盖前确认**；非法/损坏 JSON 给可操作错误提示。
- **CFG-03** — 导出/导入流程**醒目警告含明文 API key**（「此文件含明文密钥，请妥善保管、用完即删、勿通过不安全渠道传输」），警告**不可忽略**（用户拍板的实现 = **常驻醒目警告文案**，见 D-03）。

**不做（Out of Scope / Deferred / 下游）：**
- **聊天历史导出**（`CHAT_HISTORY_PREFIX`）—— Out of Scope（体积大、隐私、非配置），永不导出。
- **CFG-D1 口令加密导出**（WebCrypto AES-GCM）—— deferred，本里程碑选明文+警告。
- **CFG-D2 字符串复制/粘贴载体**（免文件落盘）—— deferred。
- **CFG-D3 选择性导出**（勾选哪些 Provider / 不含 key 的骨架导出）—— deferred。
- 任何后台/服务器参与 —— 硬约束：Key 仅落用户本地文件，纯浏览器直连，无后台。

</domain>

---

<human_decisions>
## Human Decisions（真人用户经 team-lead 拍板，2026-06-05）

> 这些是**需人类拍板**的 UX / 产品取向，已通过 `AskUserQuestion` 直接问真人并锁定。详见 26-DISCUSSION-LOG.md。

### D-01（入口落点 = 新开独立分区）
Settings 内**新增一个独立「配置备份与迁移」分区**（`aster-settings__section` 范式），放在全局选项区，内含「导出配置」「导入配置」两个按钮 + 常驻安全提示文案。
- **按钮文案建议**：「导出配置」「导入配置」（planner/UI-spec 可微调，但保持 teal 克制 + 中文）。
- **理由**：最聚焦、最贴合现有 section 范式（参考 `SettingsPanel.tsx` 现有 PPT 强调色 / 生图模型 / Pexels key 三个 section 的写法）。
- **否决**：「不开分区、就地加按钮」（不够成体系、不够显眼，不利于"配置搬家"这一独立价值的呈现）。

### D-02（导出字段集 = 锁定清单 + 生图模型偏好；其余两个边界字段不纳入）
导出字段集 = 锁定清单（见 §Researchable Facts 的逐字段映射）**外加 `PREF_IMAGE_GEN_MODEL`（生图默认模型偏好）**。
- **纳入**：生图默认模型偏好（用户偏好性质，迁移后无需重选）。
- **不纳入**：`ONBOARDING_SEEN`（引导已读标记，便利价值小，用户选不带）、`PEXELS_BASE_URL`（Worker 兜底 override，环境相关，迁移可能带错地址，用户选不带）。
- **内置 Provider 行 + 内置 key**：**照常导出**（locked 清单的 `isBuiltIn` 字段已确认内置行在内；内置 deepseek/aihubmix 的 API key 是"搬家"核心价值，必须导出）。

### D-03（CFG-03「不可忽略」实现 = 常驻醒目警告文案，非强阻断）
警告以**常驻醒目警告文案**呈现（teal 克制内的警示色块/图标 + 文案），**不**用「强制勾选复选框」「弹窗阻断」。
- **「不可忽略」的解释（verifier 必读）：** 用户判定 = **永久常驻、始终可见**的警告（区别于一闪而过的 toast），即满足 CFG-03「不可忽略」；**不要求强制勾选/阻断**。这是用户在"便利优先"安全姿态下的明确取舍，verifier 据此判 PASS。
- 警告文案落点：导出/导入分区（D-01）内常驻一行；导入的简单确认（D-04）里**再重申**一次明文风险。
- 文案要点：含明文 API 密钥 / 请妥善保管 / 用完即删 / 勿通过不安全渠道传输。

### D-04（导入流程 = 简单确认 + 完成 toast；同 id 覆盖仍单独确认）
导入流 = **写入前一个简单确认**（含明文警告，**不逐项预览摘要**）→ 写入 → **完成后 toast 摘要**（如「已导入 N 个 Provider / M 个 key / 偏好已恢复」）。
- **同 id Provider 覆盖前确认**（CFG-02 locked）仍**单独保留**：遇到本地已存在的同 id Provider 时弹覆盖确认（逐个或一次性批量，planner 定最简形态）。
- **否决**：「导入前展示完整内容摘要 + 合并/覆盖预览面板」（用户选更轻的流，不要事前逐项预览面板）。
- 合并策略（CFG-02 locked）：**保留现有 + 加入新的**；新 id → 直接加；同 id → 覆盖前确认。

</human_decisions>

---

<researchable_facts>
## Researchable Facts（事实层 —— 不问用户，已 scout 实证，留给 UI-spec / plan / research）

### F-01 导出字段集 → STORAGE_KEYS 逐字段映射（真相源 = `src/lib/storage.ts` L19-57）
**导出（含明文）：**
| 类别（锁定清单 + Q4） | STORAGE_KEYS 常量 | 字面 key | 形态 |
|---|---|---|---|
| Provider 配置（含内置+自定义行） | `PROVIDERS` | `aster:providers` | `ProviderConfig[]`：`{id,name,baseURL,model,isBuiltIn,supportsToolCall?}`（**不含 apiKey**） |
| 全部 API key（**含内置 deepseek/aihubmix key**） | `KEY_PREFIX` + 每个 providerId | `aster:keys:{id}` | string（明文，逐 provider 一条） |
| Pexels key | `PEXELS_API_KEY` | `aster:keys:pexels` | string（明文） |
| 默认 Provider | `DEFAULT_PROVIDER` | `aster:providers:default` | string（provider id） |
| 选区附带开关 | `SELECTION_ATTACH_ENABLED` | `aster:selection:attachEnabled` | boolean |
| 用户偏好（PREF） | `USER_PREFERENCES` | `aster:prefs:user` | string（≤500 字符，已 sanitize） |
| 主题强调色 | `BRAND_ACCENT_COLOR` | `aster:prefs:brand-accent` | hex string |
| 生图默认模型偏好（**Q4 新增**） | `PREF_IMAGE_GEN_MODEL` | `aster:pref:image-gen-model` | string（model id） |

**不导出：**
| 字段 | 常量 | 原因 |
|---|---|---|
| 聊天历史 | `CHAT_HISTORY_PREFIX`（`aster:chat:`，完整 key 由 `getDocKey()` 生成） | Out of Scope（永不导出） |
| 引导已读 | `ONBOARDING_SEEN`（`aster:onboarding:seen`） | Q4 用户选不带 |
| Pexels Worker 兜底 baseURL | `PEXELS_BASE_URL`（`aster:config:pexels-base-url`） | Q4 用户选不带（环境相关，迁移可能带错地址） |
| 旧选区开关（deprecated） | `SELECTION_AUTO_ATTACH`（`aster:selection:autoAttach`） | 已废弃，仅一次性迁移读取用 |

### F-02 ⚠️ 关键事实纠偏：「自动插入开关」无对应持久化 key
锁定清单措辞写「**附件/自动插入**开关」，但 `AUTO_INSERT_MODE` 已于 **Phase 3（Plan 03-05 D-08/D-19 G-05）删除**（`storage.ts` L37-38 注释 + `providers.ts` L78-83 注释明确）——v1 confirm/auto 双模式已砍，agent loop 是唯一主路径。**「开关类」实际只剩 `SELECTION_ATTACH_ENABLED` 一个 key。** Planner / executor **不要去找不存在的"自动插入"key**。

### F-03 API key 的读取需遍历 PROVIDERS（key 与 config 分开存储）
- ProviderConfig **不含 apiKey**（安全约束 T-02-18，`providers.ts` L7/L103-106）；key 单独存 `aster:keys:{id}`。
- 导出 key 需：读 `PROVIDERS` 数组 → 对每个 `provider.id` 调 `storage.get('aster:keys:'+id)` → 收集非空者。内置 id 固定 `deepseek` / `aihubmix`（`providers.ts` L40-56），自定义 id 为 `crypto.randomUUID()`（L129）。
- 参考 `computeConfiguredKeyIds`（`providers.ts` L69-73）的遍历范式。

### F-04 导出机制（plannable，零新依赖）
浏览器纯前端下载：`JSON.stringify` → `new Blob([...], {type:'application/json'})` → `URL.createObjectURL` → 临时 `<a download>` click → `revokeObjectURL`。零新增运行时依赖。
- **文件命名（Claude 自决）**：建议 `aster-config-YYYYMMDD.json`（应用运行时用 `new Date()` 格式化即可；本约束仅 GSD workflow 脚本禁用 Date，应用代码不受限）。planner 可微调（如加时分防同日覆盖）。

### F-05 导入机制（plannable，零新依赖；"复用 v2.2 FILE 上传基建"的正确含义）
- **建议独立轻量读取**：隐藏 `<input type="file" accept="application/json,.json">` + `file.text()` + `JSON.parse`。
- ⚠️ **不要**复用 Phase 17 的聊天附件管线（`useAttachmentStore` / `src/lib/parsers/*` / InputBar 回形针）——那是为「解析文档喂 LLM context」设计的，与 Settings 配置导入无关。ROADMAP/REQUIREMENTS 说的「复用 v2.2 FILE 上传基建」实指**复用浏览器文件读取的既有知识/范式**，而非附件 store 本身。一个独立 file input + `file.text()` 最干净。

### F-06 JSON schema 设计（plannable）
建议带 **version 字段** 防未来不兼容：如 `{ app:'aster', version:1, exportedAt:<iso>, data:{ providers:[...], keys:{id:key}, defaultProvider, selectionAttachEnabled, userPreferences, brandAccent, pexelsKey, imageGenModel } }`（精确结构 planner 定）。导入校验：检查 `app`/`version`/`data` 形态；不符 → 可操作错误。

### F-07 导入写入 → 必须经 store setter 或 hydrate 刷新 reactive 状态（plannable 守门）
直接 `storage.set` 不会刷新 Zustand 响应式 state（`providers` / `configuredKeyIds` / `attachEnabled` / 偏好），UI 不更新。导入写入后应：
- 用 `useProviderStore` 的 `addProvider` / `updateProvider` / `setKey` / `setDefaultLLM` / `setAttachEnabled`（`providers.ts` L99-110）；或写完 raw key 后调 `hydrateFromStorage()`（`providers.ts` L204-250，会重算 `configuredKeyIds` + 合并内置）。
- 偏好走 `usePreferencesStore` setter（`SettingsPanel.tsx` L57-63 范式）；生图模型 / Pexels key 当前是 `storage.set` + 本地 `useState`（`SettingsPanel.tsx` L93-111），导入后需同步刷新这些组件态（planner 定：导入后重读或强制重渲染）。
- ⚠️ **特别注意 `configuredKeyIds`**：决定红条 banner 显隐（`providers.ts` L62-73 / L160-174 WR-01）；导入 key 后必须刷新它，否则配了 key 红条仍在。

### F-08 合并策略细节（CFG-02 locked + plannable nuance）
- 新 id Provider → `addProvider` 加入（注意：导入应保留原 id，不重新生成；`addProvider` 现强制 `crypto.randomUUID()`——planner 需评估是否新增"按指定 id 导入"路径，否则同 id 覆盖判断失效）。
- 同 id Provider（含内置固定 id）→ 覆盖前确认（D-04）。
- **key 覆盖 nuance**：导入某 provider 的 key 会覆盖本地同 id key——建议「覆盖 Provider 行」的确认即涵盖其 key；内置 Provider（deepseek/aihubmix）若本地已有非空 key，导入其 key 也应纳入覆盖确认。planner 定粒度。

### F-09 NFR-12 bundle（事实）
本阶段全为原生 JS（Blob / FileReader / JSON / 既有 store）+ 一个 Settings section，**近零 bundle 增量、无需懒加载**。本阶段成功标准 5 = 不破 ≤82KB gzip 门；**全里程碑收口在 Phase 29**。**动 bundle 前先 `npm run build` 再 `npm run size`**（memory `project_bundle_size_guard`：陈旧 dist 给假绿）。

### F-10 i18n（事实）
新增 Lingui 宏字符串（按钮/警告/确认/toast/错误文案）后**必跑 `npm run extract`**（memory `project_i18n_extract_and_test_noise`，否则 `coverage.test.ts` 红）。

</researchable_facts>

---

<canonical_refs>
## Canonical References（下游 MUST read）

### 需求 + 路线（标准对照）
- `.planning/REQUIREMENTS.md` — **CFG-01/02/03**（L45-51）完整需求文 + 配置段 note（L47 载体/安全姿态）；**Out of Scope**（L96 聊天历史导出 / L95 加口令加密）；**Deferred CFG-D1/D2/D3**（L75-79）。
- `.planning/ROADMAP.md` §Phase 26（L119-130）— Goal + 5 条 Success Criteria（本 CONTEXT 标准对照）+ **UI hint: yes**；§Phase 29 = NFR-12 全里程碑 bundle 收口（本阶段仅"不破门"）。

### 复用目标代码（scout 实证，file:line —— 已核验）
- `src/lib/storage.ts` —— **导出字段集真相源**：`STORAGE_KEYS`（L19-57，全清单 + 每个 key 的语义注释）、`storage.get/set/remove`（L74-112，partition 自动注入 L66-72）。F-01 逐字段映射的依据。
- `src/store/providers.ts` —— Provider store：`BUILT_IN_PROVIDERS`（L40-56，固定 id deepseek/aihubmix）、`computeConfiguredKeyIds`（L69-73，遍历 key 范式）、store setter（`addProvider` L128-135 ⚠️强制 randomUUID / `updateProvider` / `setKey` L160-174 / `setDefaultLLM` / `setAttachEnabled`）、`hydrateFromStorage`（L204-250，导入后刷新 reactive 的最简路径）。F-03/F-07/F-08 依据。
- `src/providers/types.ts` —— `ProviderConfig`（L129-138，导出/导入的 schema 形态）。
- `src/components/Settings/SettingsPanel.tsx` —— **Settings UI 范式（D-01 仿照点）**：`aster-settings__section` 写法（L186-281，PPT 强调色 / 生图模型下拉 / Pexels key 三个 section 都在此）、偏好 store 消费（L57-67）、生图模型 / Pexels key 的「`storage.set` + `useState`」本地态范式（L91-111）、内联两步确认范式（L319-355，可作"简单确认"参考）、`btn btn-ghost` / `btn btn-primary btn-sm` / `aster-settings__hint` 类名。
- `src/store/preferences.ts` —— 偏好 store setter（`SettingsPanel.tsx` L27/L57-63 引用：`rawInput`/`setPrefs`/`brandAccentColor`/`setBrandAccentColor`/`resetBrandAccentColor`/`DEFAULT_BRAND_ACCENT`）。
- `src/providers/registry.ts` —— `IMAGE_GEN_MODELS` / `DEFAULT_IMAGE_GEN_MODEL`（`SettingsPanel.tsx` L34 引用；生图模型偏好合法值来源）。
- `.size-limit.json` + `package.json` `"size"` script —— bundle ≤82KB gzip CI gate（F-09）。

### 设计系统（UI phase 必读）
- **`aster-design-system` skill（构建/改 UI 时自动加载）** —— teal 克制 token、组件类名、反模式。⚠️ **警告色块**在 teal 克制单一品牌色体系下**无现成 warn token**——UI-spec 需明确（建议低饱和警示色 / 边框+图标表达，避免引入第二品牌色破坏克制；见 §Deferred Risks）。
- `.planning/design/aster-redesign/`（设计真相源，README.md 权威 handoff）；像素级真相以 `src/styles.css` 为准。

### 上游决策继承
- `.planning/phases/17-file/17-CONTEXT.md` —— v2.2 FILE 文件上传基建范式（D-11 eager 解析 / D-14 诚实结构化错误 `{code,message,recoverable,hint}` / 浏览器文件读取范式）。⚠️ 见 F-05：本阶段**不复用其附件 store 管线**，仅复用文件读取知识。
- `.planning/phases/18-lib/18-CONTEXT.md` —— BYO key Settings 范式（D-08 独立 Settings 字段 + storage key 约定 + 密码态输入 + 诚实结构化错误）。

### 项目硬约束 / 记忆
- memory `project_no_backend_status` —— 无后台硬约束：Key 不上传 Aster 服务器；本阶段 key 仅落用户本地文件，完全合规。
- memory `project_bundle_size_guard` —— 动 bundle 先 build 再 size；本阶段近零增量。
- memory `project_i18n_extract_and_test_noise` —— 改 UI 动 Lingui 宏必跑 `npm run extract`。
- memory `feedback_recurring_failure_add_gate` —— 同故障模式复发 ≥2 次加结构性守门（导入解析/合并逻辑建议补单测守门）。
- memory `project_aster_privacy_simplified` —— 不做多余授权 UX；本阶段除明文警告外不加授权弹层。

</canonical_refs>

---

<code_context>
## Existing Code Insights

### Reusable Assets（直接复用，不重造）
- **Settings section 范式**（`SettingsPanel.tsx` 全局选项区）：D-01「配置备份与迁移」分区照 PPT 强调色 / 生图模型 / Pexels key 三个现有 section 抄（label + 控件 + `aster-settings__hint` + `btn` 类）。
- **provider/preferences store setter + `hydrateFromStorage`**：导入写入直接走这些，保证 reactive state（含 `configuredKeyIds` 红条）刷新（F-07）。
- **诚实结构化错误体系** `{code,message,recoverable,hint}`（Phase 17/18 D-13/D-14）：导入非法/损坏 JSON 沿用此范式给可操作提示。
- **内联两步确认范式**（`SettingsPanel.tsx` L319-355 清空聊天确认）：D-04「简单确认」可仿此就地确认，无需重型 modal。

### Established Patterns（约束 / 必须遵循）
- **apiKey 与 ProviderConfig 分开存储**（T-02-18）：导出/导入都要分别处理 PROVIDERS 数组与各 `aster:keys:{id}`。
- **storage 经 `storage.get/set/remove` 统一入口**（不裸调 localStorage，`storage.ts` 顶注）：导入写入 raw key 时也走 `storage.set`（partition 自动注入）。
- **导入后刷新 reactive**（F-07）：直接 `storage.set` 不刷新 Zustand state——必须经 setter 或 `hydrateFromStorage()`。
- **bundle 守门先 build 再 size**；**改 UI 动 Lingui 宏必跑 `npm run extract`**。

### Integration Points（净新增连接点）
- **Settings 新分区**（`SettingsPanel.tsx`）：「配置备份与迁移」section + 导出/导入按钮 + 常驻警告文案 + 隐藏 file input。
- **新建导出/导入逻辑模块**（建议 `src/lib/configBackup.ts` 或类似）：`exportConfig(): Blob/下载` + `parseImport(file): ParsedConfig | Error` + `applyImport(parsed, {onConflict})`。组织 planner 定。
- **store 写入**：导入经 provider/preferences store setter + `hydrateFromStorage` + 生图模型/Pexels key 组件态刷新。
- **守门**：导入解析/合并逻辑建议补单测（schema 校验 / 同 id 覆盖 / 损坏 JSON / key 遍历完整性）——memory `feedback_recurring_failure_add_gate`。

</code_context>

---

<specifics>
## Specific Ideas

- **北极星场景：** 用户在公司 PowerPoint 里配好了 deepseek + aihubmix + 自定义 Provider 的 key、调好偏好和主题色 → Settings「导出配置」→ 下载 `aster-config-20260605.json` → 回家在 Edge 的 Word 里 sideload Aster → Settings「导入配置」→ 简单确认（看到明文警告）→ toast「已导入 3 个 Provider / 3 个 key」→ 所有配置还原，**一个 key 都不用重输**。这就是本阶段唯一存在理由。
- **解的正是 partition per-origin 痛点：** PPT/Word/Excel 在 Office for Web 是不同 partition（`storage.ts` L7-9 注释），key 不共享——JSON 文件是跨 origin/跨机/跨浏览器搬家的唯一无后台载体。
- **明文 + 醒目警告是用户的清醒取舍：** 用户在"便利优先"姿态下接受明文 key 落盘风险（口令加密 CFG-D1 deferred）；CFG-03「不可忽略」由常驻警告文案兑现（D-03），不强阻断。

</specifics>

---

<deferred>
## Deferred Ideas / Risks

### 本阶段不做（Deferred，已识别）
- **CFG-D1 口令加密导出**（WebCrypto AES-GCM）—— 明文+警告优先便利，加密留按需。
- **CFG-D2 字符串复制/粘贴载体**（免文件落盘，跨 App 更顺手）—— deferred。
- **CFG-D3 选择性导出**（勾选哪些 Provider / 不含 key 的骨架导出）—— deferred。
- **聊天历史导出** —— Out of Scope，永不做。
- **导入前完整内容摘要 + 合并/覆盖预览面板** —— D-04 用户选更轻的"简单确认+toast"流，否决。

### 风险 / 注意（留给 UI-spec / plan / verify）
- **CFG-03「不可忽略」判定基线（verifier 必读）：** 用户拍板 = **常驻醒目警告文案**（永久可见即"不可忽略"），**非强制勾选/阻断**。verifier 不得据"未强制勾选"判 FAIL；判 PASS 的标准 = 导出/导入分区有常驻、醒目、措辞完整（含明文/妥善保管/用完即删/勿不安全渠道传输）的警告，且导入确认里重申。
- **teal 克制下"警告色块"无现成 token**（设计系统单一品牌色 teal）：UI-spec 需定警告呈现（建议低饱和警示色 / 边框+图标 / 文案加重，**避免引入第二品牌色**破坏克制）。可能需在 `src/styles.css` 新增一个克制的 warn 变量。
- **`addProvider` 强制 `crypto.randomUUID()`**（`providers.ts` L129）：导入需保留原 id 才能做"同 id 覆盖"判断——planner 需评估新增"按指定 id 写入"路径，否则同 id 合并逻辑失效（F-08）。
- **导入后 reactive 刷新**（F-07）：尤其 `configuredKeyIds`（红条 banner）/ 生图模型 & Pexels key 的组件本地态——漏刷会出现"配了 key 红条还在""导入后 UI 不变"的假象。
- **明文 key 落盘**：用户已知并接受（便利优先）；本阶段不加密、不上传，合规无后台硬约束。

### Reviewed Todos (not folded)
- 无 pending todos（STATE.md：`builtin-model-dropdown` 已归档 `todos/completed/`）。

</deferred>

---

<uat_seeds>
## UAT Seeds（真机验收种子，留给后续 UAT / verify）

1. **导出**：Settings → 「配置备份与迁移」分区 → 「导出配置」→ 浏览器下载 `aster-config-*.json`。打开文件确认含：deepseek/aihubmix/自定义 Provider 的**明文 key** + Provider 配置 + 默认 Provider + 选区附带开关 + 用户偏好 + 主题强调色 + Pexels key + **生图默认模型偏好**；确认**不含**聊天历史 / 引导已读 / Pexels Worker baseURL。
2. **常驻警告**：导出/导入分区内警告文案**常驻可见**，措辞含「明文密钥 / 妥善保管 / 用完即删 / 勿通过不安全渠道传输」。
3. **导入还原（北极星）**：在**新浏览器 / 新宿主 / 新机器**（不同 partition）上传该 JSON → 简单确认（含明文警告重申）→ 写入 → toast 摘要 → 确认 Provider / 全部 key / 默认 Provider / 偏好 / 主题色 / Pexels key / 生图偏好**全部还原，无需重输任何 key**；红条 banner 正确消失。
4. **合并 + 同 id 覆盖**：本地已有自定义 Provider，导入含同 id Provider → **覆盖前确认弹出**；确认后保留现有 + 覆盖该项 + 加入新增项。
5. **错误处理**：上传非法 / 损坏 / 非 Aster 的 JSON → **可操作错误提示**（不崩溃、不静默、不假成功）。
6. **bundle 门**：`npm run build && npm run size` → `main-*.js` ≤82KB gzip（先 build 再 size）。
7. **跨宿主 origin 验证**：PPT 导出的配置能在 Word / Excel 成功导入（坐实解 partition per-origin 重输地狱）。

</uat_seeds>

---

*Phase: 26-config-import-export*
*Context gathered: 2026-06-05*
*Human decisions: D-01 独立分区 / D-02 字段集（+生图模型偏好，不带引导已读 & Pexels baseURL）/ D-03 常驻醒目警告（非强阻断）/ D-04 简单确认+toast（同 id 仍单独确认）—— 真人用户经 team-lead 转达拍板；详见 26-DISCUSSION-LOG.md*
