# Phase 26: 配置导入导出（config-import-export）— Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 6 个新建/改动文件
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/configBackup.ts` | utility/service | file-I/O + CRUD | `src/lib/storage.ts` | role-match |
| `src/lib/configBackup.test.ts` | test | batch | `src/lib/storage.test.ts` + `src/providers/registry.test.ts` | role-match |
| `src/components/Settings/SettingsPanel.tsx` | component | request-response | 同文件现有 section + 内联确认 + modal 消费范式 | exact |
| `src/components/icons.tsx` | utility | transform | 同文件现有 `UploadIcon` / `InsertIcon` | exact |
| `src/styles.css` | config | transform | 同文件现有 `.pane-banner` / `.badge-warning` / `.toast` | exact |
| `src/store/providers.ts`（可能） | store | CRUD | 同文件现有 `addProvider` / `updateProvider` / `setKey` | exact |

---

## Pattern Assignments

---

### `src/lib/configBackup.ts`（utility/service，file-I/O + CRUD）

**Analog:** `src/lib/storage.ts`（同目录纯 TS 模块，统一 export 入口范式）

**Imports pattern**（storage.ts L16-57 精简版，configBackup.ts 仿照）：

```typescript
// configBackup.ts 顶部：从 storage.ts 拿 STORAGE_KEYS + storage；从 providers store 拿 getState/setState；
// 从 preferences store 拿 setter；从 providers/types 拿 ProviderConfig 类型
import { storage, STORAGE_KEYS } from './storage';
import { useProviderStore, hydrateFromStorage } from '../store/providers';
import { usePreferencesStore } from '../store/preferences';
import type { ProviderConfig } from '../providers/types';
```

**Core export 结构**（storage.ts L74 的 `export const storage = { ... }` 范式，但 configBackup 导出独立具名函数）：

```typescript
// storage.ts L74-112：统一 export const storage = { get, set, remove }
// configBackup.ts 改为具名 export，便于单独测试：
export function buildExportData(): AsterConfigExport { ... }
export function parseImportFile(raw: string): { ok: true; config: AsterConfigExport } | { ok: false; error: ImportError } { ... }
export function detectConflicts(imported: AsterConfigData, currentProviders: ProviderConfig[]): string[] { ... }
export async function applyImport(config: AsterConfigData, options: { skipIds?: string[] }): Promise<ImportResult> { ... }
```

**storage.get 遍历 key 范式**（对应 RESEARCH §providers.ts 核验 `computeConfiguredKeyIds` L69-73）：

```typescript
// providers.ts L69-73：遍历 providers，过滤有 key 的 id
function computeConfiguredKeyIds(providers: ProviderConfig[]): string[] {
  return providers
    .filter((p) => !!storage.get<string>(STORAGE_KEYS.KEY_PREFIX + p.id))
    .map((p) => p.id);
}

// configBackup.ts buildExportData 中的 key 遍历（同范式）：
const providers = useProviderStore.getState().providers;
const keys: Record<string, string> = {};
for (const p of providers) {
  const k = storage.get<string>(STORAGE_KEYS.KEY_PREFIX + p.id);
  if (k) keys[p.id] = k;
}
// Pexels key 单独读（存 STORAGE_KEYS.PEXELS_API_KEY = 'aster:keys:pexels'）
const pexelsKey = storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '';
```

**导出下载机制**（F-04，零新依赖，纯原生，planner 直接复制）：

```typescript
// configBackup.ts exportConfig()：
export function exportConfig(): void {
  const data = buildExportData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date();
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `aster-config-${ymd}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
```

**schema 校验 + Result 返回**（storage.ts L79-86 的"失败返回 null 不 throw"范式，configBackup 改 Result<T,E>）：

```typescript
// storage.ts L79-86：get 失败静默返回 null
get<T>(rawKey: string): T | null {
  try {
    const v = localStorage.getItem(prefixedKey(rawKey));
    return v !== null ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}

// configBackup.ts parseImportFile：同 "失败不 throw" 约定，但改为 Result 形态：
export function parseImportFile(raw: string):
  | { ok: true; config: AsterConfigExport }
  | { ok: false; error: { code: ImportErrorCode; message: string; hint: string } }
{
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: { code: 'INVALID_JSON', message: '...', hint: '...' } };
  }
  if (!validateAsterConfig(parsed)) {
    return { ok: false, error: { code: 'NOT_ASTER_CONFIG', message: '...', hint: '...' } };
  }
  return { ok: true, config: parsed as AsterConfigExport };
}
```

**applyImport 写入路径**（导入后必须经 store setter / hydrateFromStorage 刷新 reactive，F-07）：

```typescript
// providers.ts L160-174：setKey 内部同步维护 configuredKeyIds（WR-01）
setKey(providerId, apiKey) {
  storage.set(STORAGE_KEYS.KEY_PREFIX + providerId, apiKey);
  const has = !!apiKey;
  const ids = get().configuredKeyIds;
  const had = ids.includes(providerId);
  if (has !== had) {
    set({ configuredKeyIds: has ? [...ids, providerId] : ids.filter((id) => id !== providerId) });
  }
},

// applyImport 中：逐个调 setKey + hydrateFromStorage 统一刷新
const store = useProviderStore.getState();
for (const [id, key] of Object.entries(config.keys)) {
  if (id !== 'pexels') store.setKey(id, key);
}
// Pexels key 走 storage.set（无 Zustand setter）
if (config.pexelsKey) storage.set(STORAGE_KEYS.PEXELS_API_KEY, config.pexelsKey);
// 偏好走 preferences store setter（含 sanitize）
usePreferencesStore.getState().setPrefs(config.userPreferences ?? '');
usePreferencesStore.getState().setBrandAccentColor(config.brandAccentColor ?? '');
// imageGenModel 走 storage.set（无 Zustand setter，组件态需 importNonce 刷新）
if (config.imageGenModel) storage.set(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL, config.imageGenModel);
// 默认 Provider 和 attachEnabled
store.setDefaultLLM(config.defaultProviderId);
store.setAttachEnabled(config.selectionAttachEnabled);
// 最后统一调 hydrateFromStorage 刷新 providers 列表 + configuredKeyIds（WR-01）
hydrateFromStorage();
```

**upsert provider 绕 addProvider 障碍**（RESEARCH §Key Technical Decisions 方案 A，configBackup.ts 内局部实现）：

```typescript
// providers.ts L128-135：addProvider 强制 crypto.randomUUID()，导入时不可用
addProvider(config) {
  const id = crypto.randomUUID(); // ← 障碍所在：无法保留原 id
  ...
}

// configBackup.ts 方案 A：直接 useProviderStore.setState upsert，绕开 addProvider
function upsertProviderById(config: ProviderConfig): void {
  const store = useProviderStore.getState();
  const exists = store.providers.find((p) => p.id === config.id);
  const updated = exists
    ? store.providers.map((p) => (p.id === config.id ? { ...config } : p))
    : [...store.providers, config];
  useProviderStore.setState({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
  // configuredKeyIds 由后续的 setKey + hydrateFromStorage 统一刷新
}
```

**AsterConfigExport 类型定义**（RESEARCH §3 草案，直接复制）：

```typescript
export const ASTER_CONFIG_VERSION = 1;

export interface AsterConfigExport {
  app: 'aster';
  version: number;
  exportedAt: string;      // ISO 8601
  data: AsterConfigData;
}

export interface AsterConfigData {
  providers: ProviderConfig[];
  keys: Record<string, string>;   // key = provider.id，含 'pexels'
  defaultProviderId: string;
  selectionAttachEnabled: boolean;
  userPreferences: string;
  brandAccentColor: string;
  pexelsKey: string;
  imageGenModel: string;
}

export type ImportErrorCode =
  | 'INVALID_JSON'
  | 'NOT_ASTER_CONFIG'
  | 'UNSUPPORTED_VERSION'
  | 'EMPTY_CONFIG';

export interface ImportResult {
  providerCount: number;
  keyCount: number;
  prefsRestored: boolean;
}
```

---

### `src/lib/configBackup.test.ts`（test，batch）

**Analog 1:** `src/lib/storage.test.ts`（同目录 Vitest 单测，vi.stubGlobal 范式）
**Analog 2:** `src/providers/registry.test.ts` L1-38（vi.mock storage 范式）

**文件顶部 + mock 范式**（registry.test.ts L1-38 精确摘录，configBackup.test.ts 仿照）：

```typescript
// registry.test.ts L1-38：vi.mock + 具名 mock 常量模式
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/storage', () => ({
  storage: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
    ONBOARDING_SEEN: 'aster:onboarding:seen',
    SELECTION_ATTACH_ENABLED: 'aster:selection:attachEnabled',
    SELECTION_AUTO_ATTACH: 'aster:selection:autoAttach',
    DEFAULT_PROVIDER: 'aster:providers:default',
    CHAT_HISTORY_PREFIX: 'aster:chat:',
    USER_PREFERENCES: 'aster:prefs:user',
    BRAND_ACCENT_COLOR: 'aster:prefs:brand-accent',
    PREF_IMAGE_GEN_MODEL: 'aster:pref:image-gen-model',
    PEXELS_API_KEY: 'aster:keys:pexels',
    PEXELS_BASE_URL: 'aster:config:pexels-base-url',
  },
}));

// mock providers store（只读路径用 getState，写路径 setState）
vi.mock('../../store/providers', () => ({
  useProviderStore: {
    getState: vi.fn(),
    setState: vi.fn(),
  },
  hydrateFromStorage: vi.fn(),
}));

import { storage } from './storage';
// 注意：mock 后再 import 实现文件
import { buildExportData, parseImportFile, detectConflicts } from './configBackup';
```

**describe + beforeEach 清除范式**（registry.test.ts L49-53）：

```typescript
describe('buildExportData', () => {
  beforeEach(() => {
    vi.clearAllMocks();   // 每个 test 前清除 mock 调用记录
  });
  ...
});
```

**mock 返回值设置**（registry.test.ts L59）：

```typescript
// registry.test.ts L59：vi.mocked(storage.get).mockReturnValue(...)
vi.mocked(storage.get).mockReturnValue('sk-test-deepseek-key');

// configBackup.test.ts 中多次调用需区分 key → 用 mockImplementation
vi.mocked(storage.get).mockImplementation((key: string) => {
  if (key === 'aster:providers') return mockProviders;
  if (key.startsWith('aster:keys:')) return 'mock-api-key';
  return null;
});
```

**localStorage mock 范式**（storage.test.ts L17-38，applyImport 集成测试用）：

```typescript
// storage.test.ts L17-26：in-memory localStorage mock 工厂函数
function makeLocalStorageMock() {
  const store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { Object.keys(store).forEach((k) => delete store[k]); }),
    get _store() { return store; },
  };
}
```

---

### `src/components/Settings/SettingsPanel.tsx`（component，request-response）

**Analog:** 同文件现有 section、内联确认、modal 消费范式

**导入补充**（SettingsPanel.tsx L24-35 基础上新增）：

```typescript
// 现有（L24-35）：
import { useState, useRef, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
// ... 其余现有 import

// Phase 26 新增（追加到现有 import 块末尾）：
import { DownloadIcon, UploadIcon, AlertIcon } from '../icons';
import { exportConfig, parseImportFile, detectConflicts, applyImport } from '../../lib/configBackup';
import { useToastStore } from '../../store/toast';
```

**importNonce useEffect 刷新范式**（RESEARCH §2 组件态刷新方案，仿照现有 imageGenModel useState L93-99）：

```typescript
// 现有范式（SettingsPanel.tsx L93-99）：
const [imageGenModel, setImageGenModelState] = useState<string>(
  () => storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id,
);

// Phase 26 新增：importNonce + useEffect 刷新组件本地 useState
const [importNonce, setImportNonce] = useState(0);

useEffect(() => {
  // 导入成功后 importNonce 递增，触发重读 storage 刷新本地 state
  setImageGenModelState(storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id);
  setPexelsApiKeyState(storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '');
}, [importNonce]);

// 导入完成后：setImportNonce(n => n + 1);
```

**file input ref 范式**（仿照现有 docKeyRef 的 useRef 用法，SettingsPanel.tsx L70）：

```typescript
// 现有（L70）：
const docKeyRef = useRef<string>('aster:chat:global');

// Phase 26 新增：
const fileInputRef = useRef<HTMLInputElement>(null);
```

**分区 section DOM 范式**（SettingsPanel.tsx L187-206 和 L240-261 抄写模板）：

```typescript
// 现有 section 范式（L240-261，生图模型下拉）：
<div className="aster-settings__section">
  <label className="aster-settings__label" htmlFor="setting-image-gen-model">
    <Trans>生图模型</Trans>
  </label>
  <select
    id="setting-image-gen-model"
    className="aster-settings__select"
    value={imageGenModel}
    onChange={(e) => setImageGenModel(e.target.value)}
    aria-label={t`生图模型`}
  >
    {IMAGE_GEN_MODELS.map((m) => (
      <option key={m.id} value={m.id}>{m.label}</option>
    ))}
  </select>
  <p className="aster-settings__hint">
    <Trans>默认生图模型。预览卡内可临时切换不保存。</Trans>
  </p>
</div>

// Phase 26「配置备份与迁移」section 仿照上述结构，替换内容：
<div className="aster-settings__section">
  <span className="aster-settings__label">
    <Trans>配置备份与迁移</Trans>
  </span>
  <p className="aster-settings__hint">...</p>

  {/* 常驻警告条 */}
  <div className="aster-warn-callout" role="note">
    <span className="aster-warn-callout__icon" aria-hidden="true">
      <AlertIcon size={16} />
    </span>
    <p className="aster-warn-callout__text">
      <strong><Trans>此文件含明文 API 密钥。</Trans></strong>
      <Trans>请妥善保管、用完即删、勿通过不安全渠道（邮件 / 聊天群 / 网盘公开链接）传输。</Trans>
    </p>
  </div>

  {/* 两按钮行 */}
  <div className="aster-settings__backup-actions">
    <button type="button" className="btn btn-ghost" onClick={handleExport}>
      <DownloadIcon size={16} /> <Trans>导出配置</Trans>
    </button>
    <button type="button" className="btn btn-ghost" onClick={() => fileInputRef.current?.click()}>
      <UploadIcon /> <Trans>导入配置</Trans>
    </button>
  </div>

  {/* 隐藏 file input */}
  <input
    ref={fileInputRef}
    type="file"
    accept="application/json,.json"
    hidden
    onChange={handleFileChosen}
    aria-hidden="true"
    tabIndex={-1}
  />
</div>
```

**内联两步确认范式**（SettingsPanel.tsx L318-359，「清空聊天记录」确认）作为简单 confirm 的参考结构：

```typescript
// 现有（L318-359）：
const [confirming, setConfirming] = useState(false);

{confirming ? (
  <div className="hist-confirm-row">
    <span className="hist-confirm-row__label"><Trans>确认清空？</Trans></span>
    <div className="hist-confirm-row__actions">
      <button type="button" className="btn btn-ghost btn-sm"
              onClick={() => setConfirming(false)}>
        <Trans>取消</Trans>
      </button>
      <button type="button" className="btn btn-primary btn-sm"
              onClick={() => { clearHistory(docKeyRef.current); setConfirming(false); }}>
        <Trans>确认</Trans>
      </button>
    </div>
  </div>
) : (
  <button type="button" className="btn btn-ghost btn-ghost--muted"
          onClick={() => setConfirming(true)}>
    <Trans>清空聊天记录</Trans>
  </button>
)}

// Phase 26 导入确认改用 modal 形态（D-04），不用内联两步（原因：含警告重申 + 覆盖确认）
// 但本范式作为「最简 confirm」的备选参考。
```

**modal 消费范式**（需新增导入确认 / 覆盖确认 / 错误 modal，复用 styles.css L1196-1252）：

```typescript
// Phase 26 新增 local state（仿照 confirming 的模式）：
type ImportDialogState =
  | { kind: 'none' }
  | { kind: 'confirm'; parsedConfig: AsterConfigExport }
  | { kind: 'conflict'; parsedConfig: AsterConfigExport; conflictIds: string[] }
  | { kind: 'error'; error: { code: string; message: string; hint: string } };

const [importDialog, setImportDialog] = useState<ImportDialogState>({ kind: 'none' });

// handleFileChosen：
async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = ''; // reset，允许重选同名文件
  const raw = await file.text();
  const result = parseImportFile(raw);
  if (!result.ok) {
    setImportDialog({ kind: 'error', error: result.error });
    return;
  }
  // 检测冲突
  const conflicts = detectConflicts(result.config.data, useProviderStore.getState().providers);
  if (conflicts.length > 0) {
    setImportDialog({ kind: 'conflict', parsedConfig: result.config, conflictIds: conflicts });
  } else {
    setImportDialog({ kind: 'confirm', parsedConfig: result.config });
  }
}
```

**modal 渲染位置**（在 SettingsPanel return JSX 顶层追加，复用 .modal-scrim/.modal/.modal-title/.modal-sub/.modal-foot）：

```tsx
// 仿照 Onboarding modal 的 .modal-scrim 结构（styles.css L1196-1252）：
{importDialog.kind !== 'none' && (
  <div className="modal-scrim" onClick={handleModalClose}>
    <div className="modal" role="dialog" aria-modal="true"
         aria-labelledby="import-dlg-title"
         onClick={(e) => e.stopPropagation()}>
      {/* 内容按 importDialog.kind 分支渲染 */}
    </div>
  </div>
)}
```

**toast 消费范式**（直接参考现有 `useToastStore.getState().showToast(...)` 调用，SettingsPanel 中其他地方已消费）：

```typescript
// Phase 26 导入完成后：
const result = await applyImport(parsedConfig.data, { skipIds });
useToastStore.getState().showToast(
  t`已导入 ${result.providerCount} 个 Provider · ${result.keyCount} 个密钥`
);
setImportNonce(n => n + 1);   // 触发 imageGenModel/pexelsKey 本地 state 刷新
setImportDialog({ kind: 'none' });
```

**分区插入位置**（SettingsPanel.tsx L287-315 是「自定义偏好」section，L317-359 是「清空聊天记录」section；新 section 插在 L315 与 L317 之间）：

在 `{/* Phase 8 HIST-02 — 清空聊天记录 */}` 注释之前、`{/* Phase 8 PREF-01 — 自定义偏好 */}` section 的 `</div>` 闭合标签 L315 之后插入新分区。

---

### `src/components/icons.tsx`（utility，transform）

**Analog:** 同文件 `UploadIcon`（L31-40）和 `InsertIcon`（L70-79）

**UploadIcon 精确摘录**（L31-40）：

```tsx
/** 上传（箭头入托盘） */
export function UploadIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 16V4" />
      <path d="M7 9l5-5 5 5" />
      <path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
```

**InsertIcon 精确摘录**（L70-79）：

```tsx
/** 插入到文档（向下箭头入框，PANE-04） */
export function InsertIcon(): ReactElement {
  return (
    <svg {...base}>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M5 19h14" />
    </svg>
  );
}
```

**新增 DownloadIcon**（UI-SPEC §6 草案，语义"下载到本地文件"，与 InsertIcon 语义不同）：

```tsx
// 插入位置：紧接 UploadIcon 之后（L40 之后），保持上传/下载图标相邻
/** 下载（箭头出托盘，配置导出 Phase 26） */
export function DownloadIcon({ size = 24 }: { size?: number } = {}): ReactElement {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M5 19h14" />
    </svg>
  );
}
```

**注意：**
- `base` 对象（L9-17）含 `strokeWidth: 1.5 / strokeLinecap: 'round' / strokeLinejoin: 'round' / fill: 'none' / aria-hidden: true`，已通过 `{...base}` 继承，不需要手写。
- `DownloadIcon` 需要 `size` prop（UI-SPEC 按钮行用 `size={16}`），因此与 `UploadIcon`（无 prop）不同，需仿照 `SendIcon`（L43-50）的 `{ size = 24 }` props 形态。

---

### `src/styles.css`（config，transform）

**Analog 1:** `.pane-banner`（L792-802，使用 `--warning` 的现有 warn 样式）
**Analog 2:** `.badge-warning` / `.badge-error`（L1461-1469，warning/error token pair 范式）
**Analog 3:** `.toast`（L1671-1710，带左竖条的边框 + 底色范式）
**Analog 4:** `.modal-scrim` / `.modal`（L1196-1252，dialog 基础样式）

**.pane-banner 摘录**（L792-802，是现有 warning 用色的真实例子）：

```css
/* styles.css L792-802 */
.pane-banner {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 14px;
  background: color-mix(in srgb, var(--warning) 6%, transparent);
  color: var(--warning);
  font-size: var(--fs-11);
  font-weight: 500;
  flex-shrink: 0;
}
```

**.badge-warning token pair 摘录**（L1461-1469，warning/error 同形扩展范式）：

```css
/* styles.css L1461-1469 */
.badge-warning {
  background: var(--warning-soft);
  color: var(--warning);
}
.badge-error {
  background: var(--error-soft);
  color: var(--error);
}
```

**.toast 摘录**（L1671-1710，带左竖条点缀 + var(--space-*) + var(--radius-*) 范式）：

```css
/* styles.css L1671-1710 */
.toast {
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);   /* ← 左竖条点缀：warn callout 用 var(--warning) */
  border-radius: var(--radius-3);
  background: var(--surface);
  padding: var(--space-2) var(--space-3);
  gap: var(--space-2);
}
```

**dark 主题 warning token 定义**（L1471-1476，两主题均已覆盖，无需新增）：

```css
/* styles.css L1471-1476 */
[data-theme="dark"] {
  --warning: #fbbf24;
  --warning-soft: rgba(251, 191, 36, 0.18);
}
/* light 主题：styles.css L70-71 */
/* --warning: #b45309; --warning-soft: #fef3c7; */
```

**Phase 26 新增 CSS（4 个组件类，全部引用既有 token）：**

```css
/* Phase 26 — 常驻明文警告条（teal 克制：复用既有 --warning 语义色，零新增 token） */
.aster-warn-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
  border-left: 3px solid var(--warning);
  border-radius: var(--radius-2);
}
.aster-warn-callout__icon {
  display: inline-flex; align-items: center;
  color: var(--warning); flex-shrink: 0; margin-top: 1px;
}
.aster-warn-callout__text {
  margin: 0; font-size: var(--fs-12); line-height: 1.5; color: var(--text);
}
.aster-warn-callout__text strong { font-weight: 600; color: var(--warning); }

/* Phase 26 — 导入错误 callout（复用既有 --error 语义色，零新增 token） */
.aster-error-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--error-soft);
  border: 1px solid color-mix(in srgb, var(--error) 28%, transparent);
  border-left: 3px solid var(--error);
  border-radius: var(--radius-2);
}
.aster-error-callout__icon { display: inline-flex; align-items: center; color: var(--error); flex-shrink: 0; margin-top: 1px; }
.aster-error-callout__msg  { margin: 0; font-size: var(--fs-13); color: var(--text); font-weight: 500; }
.aster-error-callout__hint { margin: var(--space-1) 0 0; font-size: var(--fs-12); color: var(--text-2); line-height: 1.5; }

/* Phase 26 — 配置备份与迁移：两按钮等宽并排 */
.aster-settings__backup-actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}
.aster-settings__backup-actions .btn { flex: 1; }

/* Phase 26 — 导入覆盖确认：冲突项列表 */
.aster-import-conflict-list {
  margin: 0;
  padding: var(--space-2) 0 0;
  list-style: none;
  display: flex; flex-direction: column; gap: var(--space-1);
  max-height: 160px; overflow-y: auto;
}
.aster-import-conflict-list li {
  font-size: var(--fs-13); color: var(--text);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border-radius: var(--radius-1);
}
```

**CSS 插入位置建议**：在 `/* === Onboarding modal */` 块（L1196）之前，或在 `.badge-warning` 块（L1461）之后（同属"语义状态色组件"区域）。`aster-settings__backup-actions` 放在 Settings 样式区附近（`settings-overlay` 或 `aster-settings__` 块内）。

---

### `src/store/providers.ts`（store，CRUD，条件改动）

**Analog:** 同文件 `updateProvider`（L137-141）

> 仅当 planner 选**方案 B**（在 providers.ts 新增 `importProvider` action）时才需改动本文件。方案 A（configBackup.ts 内 `useProviderStore.setState` 直接 upsert）不需改本文件。

**ProviderState interface 扩展位置**（L85-111，在 `setSupportsToolCall` 之后追加）：

```typescript
// providers.ts L85-111：ProviderState interface
// 方案 B 新增（L111 之后）：
/** Phase 26 CFG-02：按指定 id 导入 Provider（保留原 id，绕开 addProvider 的 randomUUID 障碍） */
importProvider(config: ProviderConfig): void;
```

**方案 B 实现**（在 L191 `setSupportsToolCall` 实现之后追加）：

```typescript
// 仿照 updateProvider L137-141 的 map + storage.set 范式：
importProvider(config) {
  const exists = get().providers.find((p) => p.id === config.id);
  const updated = exists
    ? get().providers.map((p) => (p.id === config.id ? { ...config } : p))
    : [...get().providers, config];
  set({ providers: updated });
  storage.set(STORAGE_KEYS.PROVIDERS, updated);
  // configuredKeyIds 不在此处更新，由后续 setKey + hydrateFromStorage 统一刷新
},
```

---

## Shared Patterns

### 1. storage 统一入口（所有读写必须经 storage.ts）

**Source:** `src/lib/storage.ts` L74-112
**Apply to:** `configBackup.ts` 全部 storage 读写

```typescript
// 必须通过 storage.get/set/remove，不裸调 localStorage（storage.ts 顶注约束）：
storage.get<ProviderConfig[]>(STORAGE_KEYS.PROVIDERS)
storage.set(STORAGE_KEYS.PROVIDERS, updated)
storage.get<string>(STORAGE_KEYS.KEY_PREFIX + providerId)
```

### 2. Zustand store 外部消费范式（getState + setState 直取）

**Source:** `src/store/providers.ts` L117 `useProviderStore = create<ProviderState>(...)`
**Apply to:** `configBackup.ts`（applyImport 副作用层）

```typescript
// 在组件外（非 React hook）消费 store：
const store = useProviderStore.getState();    // 读当前 state
store.setKey(id, key);                        // 调用 action
useProviderStore.setState({ providers: updated });   // 直接 patch（方案 A upsert）
```

### 3. 诚实结构化错误体系

**Source:** Phase 17/18 约定（CONTEXT L173），RESEARCH §5.4 错误矩阵
**Apply to:** `configBackup.ts` `parseImportFile` 返回值，`SettingsPanel.tsx` 错误对话框

```typescript
// 错误对象形态（Phase 17/18 D-14 建立）：
{ code: ImportErrorCode; message: string; hint: string; recoverable?: boolean }

// 4 个 code：'INVALID_JSON' | 'NOT_ASTER_CONFIG' | 'UNSUPPORTED_VERSION' | 'EMPTY_CONFIG'
```

### 4. Lingui 宏 + npm run extract 守门

**Source:** memory `project_i18n_extract_and_test_noise`
**Apply to:** `SettingsPanel.tsx` 全部新增文案

```typescript
// 组件内用 <Trans> + t`` 包裹：
import { Trans, useLingui } from '@lingui/react/macro';
const { t } = useLingui();

// 静态字符串：
<Trans>配置备份与迁移</Trans>

// 动态字符串（aria-label / toast）：
t`已导入 ${n} 个 Provider · ${m} 个密钥`

// 改完 UI 必跑：npm run extract
```

### 5. preferences store setter 含内置 sanitize/normalize

**Source:** `src/store/preferences.ts` L116-142
**Apply to:** `configBackup.ts` applyImport 写入 userPreferences / brandAccentColor

```typescript
// setPrefs 内部含 sanitizePrefs（PREF-02）——导入内容经此函数自动 sanitize：
usePreferencesStore.getState().setPrefs(config.userPreferences ?? '');

// setBrandAccentColor 内部含 normalizeHexColor 校验——非法 hex 静默忽略：
usePreferencesStore.getState().setBrandAccentColor(config.brandAccentColor ?? '');
```

### 6. hydrateFromStorage 内置保护

**Source:** `src/store/providers.ts` L218-235
**Apply to:** `configBackup.ts` applyImport 最后一步

```typescript
// hydrateFromStorage L218-224：强制 isBuiltIn=true（防导入文件篡改），
// 同时重算 configuredKeyIds（WR-01 红条消失路径）。
// applyImport 完成所有写入后统一调用：
hydrateFromStorage();
```

---

## 行号漂移核验结论（RESEARCH 已实读确认）

| CONTEXT 引用 | 实际行号 | 漂移 | 结论 |
|---|---|---|---|
| `STORAGE_KEYS` L19 | 实为 L19（`export const STORAGE_KEYS = {`），第一个 key `PROVIDERS` 在 L21 | +2 for first key | 无实质影响，代码逻辑正确 |
| `SettingsPanel.tsx` L91-99 生图模型本地态 | L93-99 | +2 | 无实质影响 |
| `SettingsPanel.tsx` L93-111 Pexels key 本地态 | L103-111 | +10 for start | 无实质影响 |
| `providers.ts` L99-110（setter 声明） | L85-111 interface 体（实现在 L128+） | 行号偏移 | RESEARCH 已说明，不影响逻辑 |
| 内联两步确认 L319-355 | L318-359 | ±1 | 无实质影响 |

---

## No Analog Found

无——本阶段全部 6 个文件均在现有 codebase 中找到高质量 analog。

---

## Metadata

**Analog search scope:** `src/lib/`, `src/store/`, `src/components/Settings/`, `src/components/icons.tsx`, `src/styles.css`
**Files scanned:** 7（storage.ts, providers.ts, preferences.ts, SettingsPanel.tsx, icons.tsx, styles.css, registry.test.ts + storage.test.ts）
**Pattern extraction date:** 2026-06-05
