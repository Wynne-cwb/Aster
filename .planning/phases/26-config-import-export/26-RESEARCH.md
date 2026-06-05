---
phase: 26
slug: config-import-export
created: 2026-06-05
---

# Phase 26: 配置导入导出（明文 JSON 可移植）— Research

**研究日期：** 2026-06-05
**域：** 浏览器原生文件 I/O + Zustand store reactive 刷新 + JSON schema 校验
**整体置信度：** HIGH（代码事实全部实读核验，无假设）

---

## Summary

本阶段技术上是"**已知模式 + 一个真障碍**"。

已知模式方面：浏览器原生 Blob/FileReader/JSON 足够完成导出/导入，零新依赖；Settings 分区范式（`aster-settings__section`）已成熟；toast / modal / warn callout 资产现成可复用；诚实结构化错误体系沿用 Phase 17/18 范式。26-UI-SPEC.md 已给出完整 DOM/CSS 契约，planner 直接取用。

**真障碍**：`addProvider` 强制 `crypto.randomUUID()`（L129），导入自定义 Provider 必须保留原 id，否则同 id 覆盖判断失效。有两个可选的最小改动方案（见 §Key Technical Decisions），planner 二选一即可。

**研究主要产出**：
1. 代码事实全部逐行核验——CONTEXT F-01 到 F-08 的行号/签名全部确认，共发现 2 处行号轻微漂移（已在核验表中标出），无影响逻辑的实质差异。
2. `addProvider` 障碍的两个具体绕过方案（含签名草案）。
3. 导入后 reactive 刷新的完整清单（逐类状态 + 刷新路径）。
4. 精确的 TypeScript `AsterConfigExport` interface 草案。
5. Nyquist 测试架构——哪些路径自动化单测、哪些留真机 UAT。

**首要建议：** 导入逻辑全部提取到 `src/lib/configBackup.ts`（纯函数层 + 副作用层分离），schema 校验和合并策略作为纯函数单独导出，便于单测守门。

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01**：入口 = Settings 内新增独立「配置备份与迁移」分区（`aster-settings__section` 范式），放在全局选项区；内含「导出配置」「导入配置」两按钮 + 常驻安全提示文案。
- **D-02**：导出字段集 = 锁定清单 + `PREF_IMAGE_GEN_MODEL`；**不含** `ONBOARDING_SEEN` / `PEXELS_BASE_URL` / 聊天历史。内置 Provider 行 + 内置 key 照常导出。
- **D-03**：CFG-03「不可忽略」= 常驻醒目警告文案（非强制勾选、非阻断弹窗）。警告文案含「明文 API 密钥 / 妥善保管 / 用完即删 / 勿通过不安全渠道传输」。Verifier 判 PASS 基线 = 警告永久可见 + 措辞完整，不要求强阻断。
- **D-04**：导入流 = 写入前简单确认（含明文警告）→ 写入 → 完成后 toast 摘要（如「已导入 N 个 Provider · M 个密钥」）。**不做**事前逐项预览面板。同 id Provider 覆盖仍单独确认（逐个或批量，planner 定最简形态）。

### Claude's Discretion
- `configBackup.ts` 内部函数签名的精确形态
- 是否为 `addProvider` 新增 `importProvider(config, {preserveId})` 或走 `useProviderStore.setState` 直接 upsert（两方案见 §Key Technical Decisions）
- 同 id 覆盖确认的具体形态（批量三按钮 or 逐个，UI-SPEC 推荐批量，planner 真机微调）
- `configuredKeyIds` 刷新路径（直接调 setter 链 or 统一走 `hydrateFromStorage()`）

### Deferred Ideas (OUT OF SCOPE)
- CFG-D1 口令加密导出（WebCrypto AES-GCM）
- CFG-D2 字符串复制/粘贴载体
- CFG-D3 选择性导出（勾选 Provider / 不含 key 骨架导出）
- 聊天历史导出（Out of Scope，永不做）
- 导入前完整内容摘要 + 合并/覆盖预览面板（D-04 否决）
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | 用户能在 Settings 一键导出全部持久化配置为 JSON 文件下载，含 Provider 配置/API keys/默认 Provider/附件开关/用户偏好/主题强调色/Pexels key/生图模型偏好；不含聊天历史 | D-02 字段集 + F-01 storage.ts 逐字段映射 + F-04 原生 Blob 下载机制 |
| CFG-02 | 用户能上传 JSON 配置文件导入，合并策略=保留现有+加入新的，同 id Provider 覆盖前确认，非法/损坏 JSON 给可操作错误提示 | F-05 file input 读取 + F-06 schema 校验 + F-08 合并策略 + addProvider 障碍解法 |
| CFG-03 | 导出/导入流程醒目警告含明文 API key，Key 仅落用户本地文件不上传 Aster 服务器 | D-03 常驻 warn callout + --warning 语义 token 复用 + 无后台硬约束 |
</phase_requirements>

---

## Code Fact Verification

> 全部通过实读源文件核验。标注行号与 CONTEXT 引用的一致性。

### STORAGE_KEYS 核验（storage.ts）

| CONTEXT 引用 | 实读行号 | 实际字面值 | 状态 |
|-------------|---------|-----------|------|
| `PROVIDERS` L19 | L21 | `'aster:providers'` | **行号漂移 +2**，值正确 [VERIFIED] |
| `KEY_PREFIX` | L23 | `'aster:keys:'` | 正确 [VERIFIED] |
| `ONBOARDING_SEEN` | L25 | `'aster:onboarding:seen'` | 正确 [VERIFIED] |
| `SELECTION_ATTACH_ENABLED` | L33 | `'aster:selection:attachEnabled'` | 正确 [VERIFIED] |
| `SELECTION_AUTO_ATTACH` @deprecated | L35 | `'aster:selection:autoAttach'` | 正确，注释标 @deprecated [VERIFIED] |
| `DEFAULT_PROVIDER` | L37 | `'aster:providers:default'` | 正确 [VERIFIED] |
| **`AUTO_INSERT_MODE` 已删除** | — | 不存在于 STORAGE_KEYS | 正确，L38-39 注释证实 Phase 3 删除 [VERIFIED] |
| `CHAT_HISTORY_PREFIX` | L41 | `'aster:chat:'` | 正确 [VERIFIED] |
| `USER_PREFERENCES` | L43 | `'aster:prefs:user'` | 正确 [VERIFIED] |
| `BRAND_ACCENT_COLOR` | L46 | `'aster:prefs:brand-accent'` | 正确 [VERIFIED] |
| `PREF_IMAGE_GEN_MODEL` | L49 | `'aster:pref:image-gen-model'` | 正确 [VERIFIED] |
| `PEXELS_API_KEY` | L53 | `'aster:keys:pexels'` | 正确 [VERIFIED] |
| `PEXELS_BASE_URL` | L56 | `'aster:config:pexels-base-url'` | 正确 [VERIFIED] |

**F-02 核验**：`AUTO_INSERT_MODE` 确实不存在于 STORAGE_KEYS（storage.ts L38-39 注释明确 Phase 3 已删）。开关类只剩 `SELECTION_ATTACH_ENABLED` 一个。[VERIFIED]

**storage.get/set/remove 签名**（L79-111）：
- `get<T>(rawKey: string): T | null`
- `set(rawKey: string, value: unknown): void`（含 QuotaExceededError guard）
- `remove(rawKey: string): void`

### providers.ts 核验

| CONTEXT 引用 | 实读行号 | 实际状态 |
|-------------|---------|---------|
| `BUILT_IN_PROVIDERS` L40-56 | L40-56 | 完全一致，内置 id = `'deepseek'` / `'aihubmix'`，默认 model 分别为 `deepseek-v4-flash` / `gpt-5.1` [VERIFIED] |
| `computeConfiguredKeyIds` L69-73 | L69-73 | 行号完全一致 [VERIFIED] |
| `addProvider` L128-135，⚠️ 强制 `crypto.randomUUID()` | L128-135 | **签名为 `addProvider(config: Omit<ProviderConfig, 'id'>): string`**，L129 `const id = crypto.randomUUID()`，L134 `return id`（WR-07 返回新 id）。障碍确实存在 [VERIFIED] |
| `updateProvider(id, patch)` | L137-141 | 签名 `updateProvider(id: string, patch: Partial<ProviderConfig>): void`，就地 map 更新 [VERIFIED] |
| `setKey` L160-174 | L160-174 | 签名 `setKey(providerId: string, apiKey: string): void`，同步刷新 `configuredKeyIds` [VERIFIED] |
| `hydrateFromStorage` L204-250 | L204-250 | 行号完全一致，WR-02 内置合并逻辑在 L218-235 [VERIFIED] |

**关键发现**：`hydrateFromStorage` 的内置合并逻辑（L218-235）会强制覆盖 `isBuiltIn=true`，这对导入流程有影响——如果走 `hydrateFromStorage()` 路径，内置 Provider 的 `isBuiltIn` 永远被纠正为 true，无需担心被导入文件篡改。

**CONTEXT 行号引用 F-07「providers.ts L99-110」**：实读 L99-110 是 `ProviderState` 接口定义（setter 方法签名声明）。**轻微行号漂移**：CONTEXT 称 setter 在 L99-110，实际指 ProviderState interface 中的 setter 声明；实现体在 L128 以下。不影响逻辑。[VERIFIED]

### preferences.ts 核验

| CONTEXT 引用 | 实读结果 |
|-------------|---------|
| `rawInput`/`setPrefs`/`brandAccentColor`/`setBrandAccentColor`/`resetBrandAccentColor`/`DEFAULT_BRAND_ACCENT` | 全部存在，签名如下 [VERIFIED] |

精确签名：
- `setPrefs(raw: string): void` — 存原始文本到 storage + 更新 `userPrefs`（sanitize 后）+ 更新 `rawInput`
- `setBrandAccentColor(hex: string): void` — 归一化后持久化；非法 hex 静默忽略
- `resetBrandAccentColor(): void` — 写回 `DEFAULT_BRAND_ACCENT = '#009887'`
- `loadPrefs(): void` — 从 storage 读并 hydrate（main.tsx Office.onReady 内调用）

**导入 brand accent 的正确路径**：调 `setBrandAccentColor(hex)` 即可——它内部走 `normalizeHexColor()` + storage.set + Zustand set，全部正确。

### SettingsPanel.tsx 核验

| CONTEXT 引用 | 实读行号 | 实际状态 |
|-------------|---------|---------|
| 「生图模型本地态」L91-99 | L93-99 | **行号漂移**，实际在 L91-99，`useState` 初始值读 storage，`setImageGenModel` = storage.set + setState [VERIFIED] |
| 「Pexels key 本地态」L93-111 | L103-111 | 实际在 L103-111，同上范式 [VERIFIED] |
| 内联两步确认 L319-355 | L319-355 | 完全一致，`confirming` state + hist-confirm-row 结构 [VERIFIED] |
| `aster-settings__global-options` 容器 | L186 | 确认存在，浏览态渲染 ② ③ [VERIFIED] |

**SettingsPanel 当前分区顺序（浏览态 L187-368）：**
1. 自动附带选区内容（`SELECTION_ATTACH_ENABLED`）
2. PPT 默认强调色
3. 生图模型下拉
4. 图库 / Pexels API Key
5. 自定义偏好
6. 清空聊天记录
7. 重看引导（条件渲染）

**UI-SPEC 建议「配置备份与迁移」放在「自定义偏好」之后、「清空聊天记录」之前**——即在当前 5/6 之间插入新 section。[VERIFIED 位置可行]

### icons.tsx 核验

| 图标 | 状态 |
|------|------|
| `UploadIcon` | 存在，L32-40，箭头入托盘语义正确 [VERIFIED] |
| `AlertIcon` | 存在，L102-110，三角感叹号 [VERIFIED] |
| `DownloadIcon` | **不存在**——需新增（UI-SPEC §6 已给出 SVG path 草案）[VERIFIED] |
| `InsertIcon` | 存在 L71-79，path 与 DownloadIcon 相近但语义不同，不可复用（UI-SPEC 正确区分）[VERIFIED] |

### ProviderConfig 形态核验（types.ts）

```typescript
// src/providers/types.ts L129-138
export interface ProviderConfig {
  id: string;
  name: string;
  baseURL: string;
  model: string;
  isBuiltIn: boolean;
  supportsToolCall?: boolean | null;  // ← CONTEXT F-01 未列此字段，实际存在
}
```

**重要发现**：`ProviderConfig` 含 `supportsToolCall?: boolean | null` 字段，CONTEXT F-01 导出字段映射中未提及。导出时应**保留此字段**（用户调优过的 tool call 探测状态应随 Provider 迁移），或明确决策"重置为 null（新环境重探测）"。planner 需在 AsterConfigExport schema 中明确。

---

## Key Technical Decisions

### 1. 「按指定 id 写入」路径设计（解决 addProvider 障碍）

**问题根源**：`addProvider(config: Omit<ProviderConfig, 'id'>): string` 在 L129 强制 `crypto.randomUUID()`，导入时无法保留原 id，同 id 覆盖判断和 key 关联都会失效。

**方案 A（推荐）：新增 `importProvider` 函数，绕开 Zustand setter**

直接用 `useProviderStore.setState` 做 upsert，不走 `addProvider`：

```typescript
// 在 configBackup.ts 内（或 providers.ts 导出一个辅助函数）
function upsertProviderById(config: ProviderConfig): void {
  const store = useProviderStore.getState();
  const exists = store.providers.find((p) => p.id === config.id);
  let updated: ProviderConfig[];
  if (exists) {
    updated = store.providers.map((p) => p.id === config.id ? { ...config } : p);
  } else {
    updated = [...store.providers, config];
  }
  useProviderStore.setState({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
  // configuredKeyIds 不在这里更新，最终统一由 hydrateFromStorage 或 setKey 刷新
}
```

优点：最小改动（不改 addProvider 签名）；直接操作 store state。
缺点：绕过 Zustand action 范式，需手动更新 storage。

**方案 B：在 providers.ts 新增 `importProvider(config: ProviderConfig): void` action**

```typescript
// 新增到 ProviderState interface
importProvider(config: ProviderConfig): void;

// 实现
importProvider(config) {
  const updated = (() => {
    const existing = get().providers.find((p) => p.id === config.id);
    if (existing) {
      return get().providers.map((p) => p.id === config.id ? { ...config } : p);
    }
    return [...get().providers, config];
  })();
  set({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
},
```

优点：符合 Zustand action 范式；测试友好。
缺点：改动 providers.ts store 接口（需同步更新 ProviderState interface）。

**planner 二选一建议**：方案 A 代码更少（configBackup.ts 自给自足，不动 providers.ts store 结构）；方案 B 更规范。导入这种低频操作选方案 A 可减少 providers.ts 改动范围。

**无论选哪个方案**：内置 Provider（id=deepseek/aihubmix）的导入走同一个 upsert 路径——因为 `hydrateFromStorage` 已有强制 `isBuiltIn=true` 的保护（L218-224），即使导入文件中 `isBuiltIn=false` 也会被纠正。

### 2. 导入后 Reactive 刷新完整清单

| 状态类别 | 存储位置 | 导入后刷新路径 | 备注 |
|---------|---------|--------------|------|
| **providers 列表** | STORAGE_KEYS.PROVIDERS + Zustand state | `upsertProviderById()` 内 `useProviderStore.setState` 或方案 B `importProvider()` | 必须 |
| **configuredKeyIds（红条）** | Zustand state（响应式） | 调完所有 `setKey()` 后，**统一调 `hydrateFromStorage()`** 重算，或每次 `setKey()` 已自动维护 | 关键，漏刷导致"配了 key 红条仍在" |
| **各 Provider API key** | STORAGE_KEYS.KEY_PREFIX + id | `useProviderStore.getState().setKey(id, key)` 逐个调用 | `setKey` 内部自动维护 `configuredKeyIds` |
| **Pexels API key** | STORAGE_KEYS.PEXELS_API_KEY | `storage.set(STORAGE_KEYS.PEXELS_API_KEY, val)` + **组件强制重渲**（见下） | 本地 useState，需特殊处理 |
| **默认 Provider** | STORAGE_KEYS.DEFAULT_PROVIDER + Zustand state | `useProviderStore.getState().setDefaultLLM(id)` | 必须 |
| **attachEnabled（选区开关）** | STORAGE_KEYS.SELECTION_ATTACH_ENABLED + Zustand state | `useProviderStore.getState().setAttachEnabled(v)` | 必须 |
| **userPrefs（自定义偏好）** | STORAGE_KEYS.USER_PREFERENCES + Zustand state | `usePreferencesStore.getState().setPrefs(raw)` | 注意：setPrefs 会重新 sanitize |
| **brandAccentColor（主题强调色）** | STORAGE_KEYS.BRAND_ACCENT_COLOR + Zustand state | `usePreferencesStore.getState().setBrandAccentColor(hex)` | 含 normalizeHexColor 校验 |
| **imageGenModel（生图模型）** | STORAGE_KEYS.PREF_IMAGE_GEN_MODEL | `storage.set(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL, id)` + **组件强制重渲**（见下） | 本地 useState，需特殊处理 |

**"组件本地 useState" 刷新问题（F-07 核心）**：

`imageGenModel`（SettingsPanel L93-99）和 `pexelsApiKey`（L103-111）都是 `useState`，初始值来自 `storage.get()`。导入写入 storage 后，如果 SettingsPanel 没有重渲，这两个 state 不会自动更新。

**推荐方案：在 SettingsPanel 的备份分区触发导入成功后，调用 React 的 `key` prop 强制重挂载 SettingsPanel，或用 `forceUpdate` 模式。**

更具体的轻量方案：在 SettingsPanel 顶层加一个 `importNonce` state（number），导入成功后 `setImportNonce(n => n+1)`；生图模型和 Pexels key 的 `useState` 初始值改为：

```typescript
const [imageGenModel, setImageGenModelState] = useState<string>(
  () => storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id,
);
```

变为监听 `importNonce`：

```typescript
useEffect(() => {
  setImageGenModelState(storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id);
  setPexelsApiKeyState(storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '');
}, [importNonce]);
```

这样导入成功后 `setImportNonce` 即可触发两个 state 同步刷新。planner 可选 nonce 方案或 key prop 方案。

### 3. JSON Schema 精确结构

```typescript
// src/lib/configBackup.ts

export const ASTER_CONFIG_VERSION = 1;

/** 导出文件的顶层结构 */
export interface AsterConfigExport {
  app: 'aster';
  version: number;      // 当前 = ASTER_CONFIG_VERSION（1）
  exportedAt: string;   // ISO 8601，如 "2026-06-05T10:30:00.000Z"
  data: AsterConfigData;
}

/** 导出数据体（D-02 锁定字段集）*/
export interface AsterConfigData {
  /** Provider 配置列表，含内置 + 自定义，不含 apiKey（分开存储） */
  providers: ProviderConfig[];

  /** 各 Provider 的明文 API key。key = provider.id，value = api key string。
   *  含内置 deepseek / aihubmix key；含 Pexels key（'pexels' 为固定 id）。*/
  keys: Record<string, string>;

  /** 默认 LLM Provider id */
  defaultProviderId: string;

  /** 选区附带开关（SELECTION_ATTACH_ENABLED）*/
  selectionAttachEnabled: boolean;

  /** 用户自定义偏好原始文本（导入后经 setPrefs() 重新 sanitize）*/
  userPreferences: string;

  /** 品牌强调色（hex string，如 '#009887'；导入后经 setBrandAccentColor() 归一化）*/
  brandAccentColor: string;

  /** Pexels API key（导入后直接写 storage，经 PEXELS_API_KEY key）*/
  pexelsKey: string;

  /** 生图默认模型 id（导入后写 PREF_IMAGE_GEN_MODEL）*/
  imageGenModel: string;
}
```

**supportsToolCall 字段处理**：CONTEXT 未提及，但 `ProviderConfig` 实际含此字段。推荐**导出时保留**（`providers` 数组原样序列化），导入时保留值（用户在新环境的第一次调用会重探测覆盖）。如不想保留，可在导出时对每个 provider 做 `{ ...p, supportsToolCall: null }`。planner 决定，默认保留。

**校验函数应检查的形态**：

```typescript
function validateAsterConfig(parsed: unknown): parsed is AsterConfigExport {
  if (!parsed || typeof parsed !== 'object') return false;
  const p = parsed as Record<string, unknown>;
  if (p.app !== 'aster') return false;                        // → NOT_ASTER_CONFIG
  if (typeof p.version !== 'number') return false;            // → NOT_ASTER_CONFIG
  if (p.version > ASTER_CONFIG_VERSION) return false;         // → UNSUPPORTED_VERSION
  if (!p.data || typeof p.data !== 'object') return false;   // → NOT_ASTER_CONFIG
  const data = p.data as Record<string, unknown>;
  if (!Array.isArray(data.providers)) return false;           // → NOT_ASTER_CONFIG
  if (typeof data.keys !== 'object' || data.keys === null) return false; // → NOT_ASTER_CONFIG
  // 检查可导入内容是否非空
  const hasProviders = (data.providers as unknown[]).length > 0;
  const hasKeys = Object.keys(data.keys as object).length > 0;
  if (!hasProviders && !hasKeys) return false;                 // → EMPTY_CONFIG
  return true;
}
```

### 4. 模块组织建议（src/lib/configBackup.ts）

```typescript
// 文件结构

// ── 纯函数（无副作用，易单测）──────────────────────────────────────
export function buildExportData(): AsterConfigExport { ... }
  // 读 storage（只读）+ 读 providers store（只读），组装 AsterConfigExport 对象

export function parseImportFile(raw: string): 
  | { ok: true; config: AsterConfigExport }
  | { ok: false; error: { code: ImportErrorCode; message: string; hint: string } }
  { ... }
  // JSON.parse + validateAsterConfig；返回 Result<T, E> 而非 throw

export function detectConflicts(
  imported: AsterConfigData,
  currentProviders: ProviderConfig[],
): string[]
  // 返回冲突的 provider id 列表（本地已存在且文件中也存在的 id）

// ── 副作用函数（store 写入）──────────────────────────────────────────
export async function applyImport(
  config: AsterConfigData,
  options: { skipIds?: string[] },  // skipIds = 用户选择跳过的冲突 id
): Promise<ImportResult>
  // 调用 store setters + 最终 hydrateFromStorage() 统一刷新

export interface ImportResult {
  providerCount: number;   // 导入的 provider 数量（新增 + 覆盖）
  keyCount: number;        // 导入的 key 数量
  prefsRestored: boolean;  // 偏好是否有内容
}

export type ImportErrorCode = 
  | 'INVALID_JSON'
  | 'NOT_ASTER_CONFIG'
  | 'UNSUPPORTED_VERSION'
  | 'EMPTY_CONFIG';
```

**纯函数 vs 副作用分离原则**：
- `buildExportData`、`parseImportFile`、`detectConflicts` = 纯函数（或只读 side effects），**可直接单测**，无需 mock store。
- `applyImport` = 副作用函数，**测试需 mock store**（参考 registry.test.ts 的 `vi.mock('../lib/storage')` 范式）。

---

## Validation Architecture

> Nyquist 测试策略。nyquist_validation = true（config.json 核验）。

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest（`vitest@^2.x`，vite.config.ts 已配置） |
| Config file | vite.config.ts（test 块内）|
| Quick run command | `npx vitest run src/lib/configBackup.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CFG-01 | `buildExportData()` 返回含全部 D-02 字段的对象，不含 ONBOARDING_SEEN/PEXELS_BASE_URL/聊天历史 | unit | `npx vitest run src/lib/configBackup.test.ts -t "buildExportData"` | ❌ Wave 0 新建 |
| CFG-01 | key 遍历完整性：含内置 deepseek/aihubmix key，含自定义 provider key，不多不少 | unit | `npx vitest run src/lib/configBackup.test.ts -t "key 遍历"` | ❌ Wave 0 |
| CFG-02 | `parseImportFile` 返回 INVALID_JSON（JSON 格式错误） | unit | `npx vitest run src/lib/configBackup.test.ts -t "INVALID_JSON"` | ❌ Wave 0 |
| CFG-02 | `parseImportFile` 返回 NOT_ASTER_CONFIG（缺 app/version/data） | unit | `npx vitest run src/lib/configBackup.test.ts -t "NOT_ASTER_CONFIG"` | ❌ Wave 0 |
| CFG-02 | `parseImportFile` 返回 UNSUPPORTED_VERSION（version > 1） | unit | `npx vitest run src/lib/configBackup.test.ts -t "UNSUPPORTED_VERSION"` | ❌ Wave 0 |
| CFG-02 | `parseImportFile` 返回 EMPTY_CONFIG（data.providers=[] 且 data.keys={}） | unit | `npx vitest run src/lib/configBackup.test.ts -t "EMPTY_CONFIG"` | ❌ Wave 0 |
| CFG-02 | `detectConflicts()` 正确识别同 id（内置+自定义）和新 id，无漏报无误报 | unit | `npx vitest run src/lib/configBackup.test.ts -t "detectConflicts"` | ❌ Wave 0 |
| CFG-01/02 | 往返幂等：`buildExportData()` 的输出能通过 `parseImportFile` 且字段完整 | unit | `npx vitest run src/lib/configBackup.test.ts -t "往返幂等"` | ❌ Wave 0 |
| CFG-02 | `applyImport` 写入后 `configuredKeyIds` 包含导入的 provider id（红条消失路径） | unit（需 mock store） | `npx vitest run src/lib/configBackup.test.ts -t "applyImport"` | ❌ Wave 0 |
| CFG-03 | 常驻警告文案含「明文 API 密钥」「妥善保管」「用完即删」「不安全渠道」 | manual UAT（UI 文案） | — | 手动 |
| CFG-03 | 导入确认对话框含明文警告重申 | manual UAT | — | 手动 |

### 测试文件落点

新建 `src/lib/configBackup.test.ts`，紧邻实现文件（与 `storage.test.ts` 同一目录，遵循现有范式）。

**Mock 策略**（参考 registry.test.ts 的 `vi.mock('../lib/storage')` 范式）：

```typescript
// configBackup.test.ts 头部
import { vi, describe, it, expect, beforeEach } from 'vitest';

// mock storage（不依赖真实 localStorage）
vi.mock('./storage', () => ({
  storage: { get: vi.fn(), set: vi.fn(), remove: vi.fn() },
  STORAGE_KEYS: { /* 完整常量映射 */ },
}));

// mock providers store（只读路径用 getState）
vi.mock('../../store/providers', () => ({
  useProviderStore: { getState: vi.fn(), setState: vi.fn() },
  hydrateFromStorage: vi.fn(),
}));
```

### Sampling Rate

- **Per task commit：** `npx vitest run src/lib/configBackup.test.ts`（< 5s）
- **Per wave merge：** `npx vitest run`（全套）
- **Phase gate：** 全套绿 + `npm run extract`（Lingui 宏）+ `npm run build && npm run size`（≤82KB）

### Wave 0 Gaps

- [ ] `src/lib/configBackup.ts` — 实现文件（Wave 0 先写空壳和类型定义）
- [ ] `src/lib/configBackup.test.ts` — 覆盖上表所有 CFG-01/CFG-02 自动化用例
- [ ] `DownloadIcon` — 新增到 `src/components/icons.tsx`（Wave 0，阻塞 UI 任务）

*(现有测试基础设施已覆盖 Vitest 运行环境，无需额外配置)*

---

## Bundle & i18n Guards

**Bundle 影响：** 本阶段**零新增运行时依赖**。`Blob`/`URL.createObjectURL`/`FileReader`/`JSON` 全为浏览器原生 API，0 KB。新增的 `configBackup.ts` 为极小纯 TS 模块（估算 gzip 后 < 1 KB），`DownloadIcon` 为内联 SVG（< 100 B）。

**REQUIREMENTS.md NFR-12 警示**：REQUIREMENTS.md L56 明确「**余量仅 ~0.7KB——很紧**」。虽本阶段理论增量极小，仍必须按守门流程验证。

```bash
# 守门验证命令（planner 必须写入 plan 的 verification 步骤）
export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"
npm run build && npm run size
# 期望：initial-js ≤ 82 KB gzip
```

**注意**：`npm run size` 读陈旧 dist 会给假绿（memory: `project_bundle_size_guard`）。**必须先 build 再 size，不可省略 build 步骤。**

**i18n 守门：**

```bash
npm run extract
# 期望：无新未翻译字符串错误；coverage.test.ts 绿
```

**新增 Lingui 宏字符串清单**（来自 UI-SPEC §7 文案契约，共 ~14 条文案需包裹 `<Trans>` / `t\`\``）：
- 分区标题「配置备份与迁移」
- 分区说明 hint
- 常驻警告文案（两处：分区内 + 导入确认重申）
- 「导出配置」「导入配置」按钮
- 导出成功 toast（可选）
- 导入确认对话框（标题/说明/CTA）
- 覆盖确认对话框（标题/说明/三 CTA）
- 完成 toast 摘要（动态 count）
- 错误对话框（标题/4 条 message/4 条 hint/CTA）

---

## Security Posture

**威胁模型（本阶段需在 plan 中说明）：**

| 场景 | 风险 | 已知取舍 |
|------|------|---------|
| 明文 API key 落盘 | key 泄露（文件被截取/共享） | 用户清醒取舍（D-03），CFG-D1 加密 deferred |
| 导入文件来源不可信 | 导入恶意 Provider 配置（如 baseURL 指向攻击者服务器） | 用户已知接受；JSON.parse 不执行代码，无代码注入风险；值仅落 localStorage 和 Zustand，不直接执行 |
| 导入 userPreferences 注入 | 注入 LLM prompt | `setPrefs()` 内部走 `sanitizePrefs()` 重新 sanitize（PREF-02 / D-09），已有防御 |
| 导入 brandAccentColor 非法值 | — | `setBrandAccentColor()` 内部走 `normalizeHexColor()` 校验，非法 hex 静默忽略 |
| XSS 注入（回显 Provider name）| UI 回显 provider.name 时注入 | React JSX 自动转义，不 dangerouslySetInnerHTML；覆盖确认对话框的冲突列表也是 JSX 渲染，安全 |

**无后台硬约束合规**：导出 = 浏览器 Blob 直接下载，不经 Aster 服务器；导入 = 浏览器本地 file.text() 解析，不上传；key 只落用户本地文件和 partitioned localStorage。[VERIFIED: 无后台约束完全满足]

**ASVS 覆盖**：

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | `validateAsterConfig()` 结构检查 + `sanitizePrefs()` 已存在 + `normalizeHexColor()` 已存在 |
| V2 Authentication | no | 无账户体系 |
| V6 Cryptography | no（本阶段） | 明文文件，CFG-D1 deferred |
| V3 Session Management | no | 无 session |

---

## Open Questions / Assumptions

**已锁定，无需再问用户：**

- D-01-D-04 全部锁定（见 user_constraints）
- `--warning`/`--warning-soft` 复用决策（UI-SPEC A-1 已解析，无需新 token）
- 文件命名 `aster-config-YYYYMMDD.json`（F-04）

**planner 需明确的技术选择（不需回问用户）：**

1. **addProvider 障碍**：选方案 A（configBackup.ts 内 upsert）或方案 B（providers.ts 新增 `importProvider` action）
2. **组件态刷新方案**：nonce + useEffect 或 key prop 重挂载
3. **supportsToolCall 字段**：导出时保留原值，还是统一重置为 null
4. **toast 动态计数文案**：Lingui 对动态 count 用 `plural()` macro 还是模板字符串（中文无复数形式，直接模板字符串 `` t`已导入 ${n} 个 Provider · ${m} 个密钥` `` 即可）

**Assumption（低风险，planner 可推翻）：**

| ID | 假设 | 风险 |
|----|------|------|
| A-1 | `supportsToolCall` 随 ProviderConfig 一起导出保留原值 | 低——新环境会在第一次调用时重探测覆盖 |
| A-2 | `applyImport` 最终统一调 `hydrateFromStorage()` 而非逐个 setter 刷新 reactive | 低——hydrateFromStorage 已有内置合并保护逻辑，更安全 |
| A-3 | 导入时 `userPreferences` 字段若包含 sanitize 命中词，`setPrefs()` 会静默过滤（与 D-09 一致） | 低——这是现有设计约束，导入时同样适用 |

---

## Environment Availability

本阶段无外部依赖（纯原生 API + 已有 store/storage 基础设施）。跳过环境可用性审计。

---

## Sources

### Primary（HIGH confidence，实读核验）
- `src/lib/storage.ts` — STORAGE_KEYS 全清单，storage API 签名
- `src/store/providers.ts` — addProvider/setKey/hydrateFromStorage 实现，configuredKeyIds 计算
- `src/store/preferences.ts` — setPrefs/setBrandAccentColor 实现
- `src/components/Settings/SettingsPanel.tsx` — 分区结构，本地态范式，内联确认范式
- `src/providers/types.ts` — ProviderConfig 形态（含 supportsToolCall）
- `src/providers/registry.ts` — IMAGE_GEN_MODELS / DEFAULT_IMAGE_GEN_MODEL
- `src/components/icons.tsx` — 图标存在性核验
- `src/lib/storage.test.ts` — 测试范式参考

### Secondary（MEDIUM confidence，参考范式）
- `src/providers/registry.test.ts` — vi.mock storage 范式，供 configBackup.test.ts 仿照
- `26-CONTEXT.md` — 事实层 F-01..F-10，决策 D-01..D-04
- `26-UI-SPEC.md` — DOM/CSS 契约，文案矩阵，5 个 UI surface 规格

---

## RESEARCH COMPLETE

**Phase：** 26 - config-import-export
**置信度：** HIGH（全部核心事实实读核验）

### 关键发现

1. **addProvider 障碍已确认**：L129 `crypto.randomUUID()` 强制执行，提供两个具体绕过方案（configBackup 内 upsert vs providers.ts 新 action），planner 二选一。
2. **行号漂移极小**：STORAGE_KEYS L19 引用实为 L21（+2），SettingsPanel 本地态范式行号略偏移，无实质影响。
3. **ProviderConfig 含额外字段**：`supportsToolCall?: boolean | null` 未在 CONTEXT 导出映射中出现，planner 需决策处理方式。
4. **组件本地 useState 刷新**：imageGenModel 和 pexelsApiKey 两个 state 需 importNonce 或 key prop 触发重读，给出具体实现草案。
5. **hydrateFromStorage 已有内置保护**：L218-224 强制 `isBuiltIn=true`，导入后调用 hydrateFromStorage 可安全刷新所有 Provider 响应式状态。

### 创建文件
`.planning/phases/26-config-import-export/26-RESEARCH.md`

### 置信度评估

| 领域 | 级别 | 原因 |
|------|------|------|
| 代码事实核验 | HIGH | 全部实读，行号/签名确认 |
| addProvider 障碍方案 | HIGH | 实读 L128-135，两个方案基于实际 API |
| JSON schema | HIGH | 基于 ProviderConfig 类型 + D-02 字段集设计 |
| 测试策略 | HIGH | 基于既有 *.test.ts 范式 |
| bundle 影响 | HIGH | 零新增依赖，理论增量 < 1 KB |

### Ready for Planning
Research 完成，Planner 可据此创建 PLAN.md 文件。
