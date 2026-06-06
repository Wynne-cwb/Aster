/**
 * src/components/Settings/SettingsPanel.tsx — 整页滑入设置面板（PROV-05 / D-08 / D-15）
 *
 * Wave 3 teal 重皮（Plan 04.1-05）：
 *   settings-head + back-btn（ChevronLeftIcon）+ head-title
 *   settings-body 内容区
 *   section-label / row-toggle / switch 开关
 *
 * 由 App.tsx 通过 .settings-overlay.is-open 控制 CSS translateX 滑入动画。
 * 本组件只渲染内容，动画容器在 App.tsx。
 *
 * Props:
 *   onClose()               — 关闭/返回回调
 *   initialAnchor?          — 深链字段 ID（D-12）：'key-input' | 'model-input'
 *   onShowOnboarding?()     — 「重看引导」回调（D-04）
 *
 * G-06 / D-26 三分区路由（编辑态独占，浏览态显列表+全局选项）：
 *   editState.kind === 'browse'   → 渲染 ② Provider 列表 + ③ 全局选项
 *   editState.kind === 'editing'  → 仅渲染 ① ProviderForm（独占整个 body）
 *   editState.kind === 'creating' → 仅渲染 ① ProviderForm（新建，独占整个 body）
 *
 * attachEnabled（D-15 / G-08 02.1-08 修订，原 autoAttach）：从 providerStore 直接读取，onChange 调用 setAttachEnabled
 */
import { useState, useRef, useEffect } from 'react';
import { Trans, useLingui } from '@lingui/react/macro';
import { useProviderStore } from '../../store/providers';
import { usePreferencesStore, DEFAULT_BRAND_ACCENT } from '../../store/preferences';
import { useChatStore } from '../../store/chat';
import { getDocKey } from '../../lib/docKey';
import { ChevronLeftIcon, DownloadIcon, UploadIcon, AlertIcon } from '../icons';
import {
  exportConfig,
  parseImportFile,
  detectConflicts,
  applyImport,
  type AsterConfigExport,
} from '../../lib/configBackup';
import { useToastStore } from '../../store/toast';
import ProviderList from './ProviderList';
import ProviderForm, { type ProviderFormData } from './ProviderForm';
import type { ProviderConfig } from '../../providers/types';
import { IMAGE_GEN_MODELS, DEFAULT_IMAGE_GEN_MODEL } from '../../providers/registry';
import { storage, STORAGE_KEYS } from '../../lib/storage';

interface SettingsPanelProps {
  onClose: () => void;
  initialAnchor?: string;
  onShowOnboarding?: () => void;
}

/** D-26 三分区路由状态机 */
type EditState =
  | { kind: 'browse' }
  | { kind: 'editing'; providerId: string }
  | { kind: 'creating' };

/** LR-01：导入文件大小上限（配置文件实际仅 KB 级；防御性，避免误选超大文件撑爆 webview 内存）。*/
const MAX_IMPORT_BYTES = 1_000_000; // 1 MB

export default function SettingsPanel({
  onClose,
  initialAnchor,
  onShowOnboarding,
}: SettingsPanelProps): React.ReactElement {
  const { t } = useLingui();

  // Phase 8 PREF-01：偏好 store
  const rawInput = usePreferencesStore((s) => s.rawInput);
  const setPrefs = usePreferencesStore((s) => s.setPrefs);

  // UAT-5：PPT 一键建页默认强调色（品牌主题色）
  const brandAccentColor = usePreferencesStore((s) => s.brandAccentColor);
  const setBrandAccentColor = usePreferencesStore((s) => s.setBrandAccentColor);
  const resetBrandAccentColor = usePreferencesStore((s) => s.resetBrandAccentColor);
  const isBrandAccentDefault = brandAccentColor.toLowerCase() === DEFAULT_BRAND_ACCENT;

  // Phase 8 HIST-02：清空聊天记录
  const clearHistory = useChatStore((s) => s.clearHistory);

  // docKey 缓存（async 读取，在 useEffect 内初始化）
  const docKeyRef = useRef<string>('aster:chat:global');
  useEffect(() => {
    getDocKey().then((key) => { docKeyRef.current = key; }).catch(() => {});
  }, []);

  // D-15 / G-08：attachEnabled 和 setAttachEnabled 从 providerStore 直接消费（双向绑定：设置项 ↔ SelectionPill 眼睛）
  const attachEnabled = useProviderStore((s) => s.attachEnabled);
  const setAttachEnabled = useProviderStore((s) => s.setAttachEnabled);
  // Phase 3 Plan 03-05：autoInsertMode / setAutoInsertMode 已从 providers 删除（D-19 G-05 砍 v1 confirm/auto）
  const providers = useProviderStore((s) => s.providers);
  const addProvider = useProviderStore((s) => s.addProvider);
  const updateProvider = useProviderStore((s) => s.updateProvider);
  const setKey = useProviderStore((s) => s.setKey);

  // D-26 G-06：编辑/新建状态提升到 SettingsPanel（三分区路由）
  // 深链 initialAnchor 存在时，直接进入编辑态（ProviderList 会在 useEffect 里触发 onEdit）
  const [editState, setEditState] = useState<EditState>({ kind: 'browse' });

  // Phase 8 HIST-02 bg2：内联两步确认状态（防误点清空）
  const [confirming, setConfirming] = useState(false);

  // Phase 16 IMG-04（D-04）：生图默认 model picker。
  // 持久化到 PREF_IMAGE_GEN_MODEL；registry image-gen resolve 读同一 key 覆盖默认 doubao。
  const [imageGenModel, setImageGenModelState] = useState<string>(
    () => storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id,
  );
  const setImageGenModel = (modelId: string): void => {
    storage.set(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL, modelId);
    setImageGenModelState(modelId);
  };

  // Phase 18 LIB-01（D-08）：BYO Pexels API Key（独立字段，非 LLM Provider）。
  // 存 STORAGE_KEYS.PEXELS_API_KEY（partitioned localStorage）；清空走 remove。
  const [pexelsApiKey, setPexelsApiKeyState] = useState<string>(
    () => storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '',
  );
  const setPexelsApiKey = (key: string): void => {
    const trimmed = key.trim();
    if (trimmed) storage.set(STORAGE_KEYS.PEXELS_API_KEY, trimmed);
    else storage.remove(STORAGE_KEYS.PEXELS_API_KEY);
    setPexelsApiKeyState(key);
  };

  // Phase 26：file input ref（F-05，不复用聊天附件管线）
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 26：importNonce — 导入成功后递增，触发 imageGenModel/pexelsKey 本地 state 重读（F-07）
  const [importNonce, setImportNonce] = useState(0);

  // Phase 26：导入对话框状态机（D-04）
  type ImportDialogState =
    | { kind: 'none' }
    | { kind: 'confirm'; parsedConfig: AsterConfigExport }
    | { kind: 'conflict'; parsedConfig: AsterConfigExport; conflictIds: string[] }
    | {
        kind: 'error';
        error: {
          code: string;
          message: string;
          hint: string;
          values?: { version?: number; supported?: number };
        };
      };

  const [importDialog, setImportDialog] = useState<ImportDialogState>({ kind: 'none' });

  // Phase 26：导入成功后 importNonce 递增 → 重读 storage 刷新本地 state（F-07）
  useEffect(() => {
    if (importNonce === 0) return; // 初始挂载不触发（仅响应导入）
    setImageGenModelState(
      storage.get<string>(STORAGE_KEYS.PREF_IMAGE_GEN_MODEL) ?? DEFAULT_IMAGE_GEN_MODEL.id,
    );
    setPexelsApiKeyState(storage.get<string>(STORAGE_KEYS.PEXELS_API_KEY) ?? '');
  }, [importNonce]);

  // 编辑态对应的 Provider 对象
  const editingProvider: ProviderConfig | undefined =
    editState.kind === 'editing'
      ? providers.find((p) => p.id === editState.providerId)
      : undefined;

  function handleSave(data: ProviderFormData): void {
    if (editState.kind === 'editing') {
      updateProvider(editState.providerId, {
        model: data.model,
        // 内置 Provider 不允许改 baseURL/name
        ...(editingProvider && !editingProvider.isBuiltIn && { name: data.name, baseURL: data.baseURL }),
      });
      if (data.apiKey) {
        setKey(editState.providerId, data.apiKey);
      }
    } else if (editState.kind === 'creating') {
      // WR-07 修复：addProvider 返回新建 id，直接用于写 Key，
      // 避免依赖 providers 数组末尾位置（并发场景下可能取到错误 Provider）。
      const newId = addProvider({
        name: data.name,
        baseURL: data.baseURL,
        model: data.model,
        isBuiltIn: false,
      });
      if (data.apiKey) {
        setKey(newId, data.apiKey);
      }
    }
    setEditState({ kind: 'browse' });
  }

  function handleCancel(): void {
    setEditState({ kind: 'browse' });
  }

  // Phase 26：导出配置（CFG-01）
  function handleExport(): void {
    exportConfig();
    useToastStore.getState().showToast(t`配置已导出`);
  }

  // Phase 26：用户选择导入文件（CFG-02）
  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ''; // reset，允许重选同名文件
    // LR-01：读取前先卡文件大小上限（accept=".json" 仅是选择器提示，不限实际大小）
    if (file.size > MAX_IMPORT_BYTES) {
      setImportDialog({ kind: 'error', error: { code: 'FILE_TOO_LARGE', message: '', hint: '' } });
      return;
    }
    const raw = await file.text();
    const result = parseImportFile(raw);
    if (!result.ok) {
      setImportDialog({ kind: 'error', error: result.error });
      return;
    }
    // LR-04：直接用文件顶部静态导入的 useProviderStore（同模块实例，getState() 即最新态），
    // 删除多余的动态 import（与文件其余写法不一致的代码味）。
    const conflicts = detectConflicts(result.config.data, useProviderStore.getState().providers);
    if (conflicts.length > 0) {
      setImportDialog({ kind: 'conflict', parsedConfig: result.config, conflictIds: conflicts });
    } else {
      setImportDialog({ kind: 'confirm', parsedConfig: result.config });
    }
  }

  // Phase 26：确认导入（无冲突路径）
  async function handleConfirmImport(): Promise<void> {
    if (importDialog.kind !== 'confirm') return;
    const res = await applyImport(importDialog.parsedConfig.data, {});
    setImportNonce((n) => n + 1);
    setImportDialog({ kind: 'none' });
    const msg = res.prefsRestored
      ? t`已导入 ${res.providerCount} 个 Provider · ${res.keyCount} 个密钥，偏好已恢复`
      : t`已导入 ${res.providerCount} 个 Provider · ${res.keyCount} 个密钥`;
    useToastStore.getState().showToast(msg);
  }

  // Phase 26：覆盖并导入（有冲突路径，选择全部覆盖）
  async function handleOverwriteAndImport(): Promise<void> {
    if (importDialog.kind !== 'conflict') return;
    const res = await applyImport(importDialog.parsedConfig.data, {});
    setImportNonce((n) => n + 1);
    setImportDialog({ kind: 'none' });
    const msg = t`已导入 ${res.providerCount} 个 Provider · ${res.keyCount} 个密钥`;
    useToastStore.getState().showToast(msg);
  }

  // Phase 26：跳过冲突项（仅导入新 id）
  async function handleSkipConflictsAndImport(): Promise<void> {
    if (importDialog.kind !== 'conflict') return;
    const res = await applyImport(importDialog.parsedConfig.data, {
      skipIds: importDialog.conflictIds,
    });
    setImportNonce((n) => n + 1);
    setImportDialog({ kind: 'none' });
    const msg = t`已导入 ${res.providerCount} 个新 Provider，跳过 ${importDialog.conflictIds.length} 个冲突项`;
    useToastStore.getState().showToast(msg);
  }

  // LR-05：错误码文案在组件侧用 Lingui t 宏渲染（lib 返回 code + 中文兜底，UI 文案统一走 i18n）。
  // lib 层是纯字面量、无法过 Trans/t 宏；按 code 在此映射可被 lingui extract 抽取、v1.1 翻译。
  function localizeImportError(error: {
    code: string;
    message: string;
    hint: string;
    values?: { version?: number; supported?: number };
  }): { message: string; hint: string } {
    switch (error.code) {
      case 'INVALID_JSON':
        return {
          message: t`文件不是有效的 JSON 格式`,
          hint: t`请确认文件未损坏，且是由 Aster「导出配置」生成的 JSON 文件。`,
        };
      case 'NOT_ASTER_CONFIG':
        return {
          message: t`此文件不是 Aster 配置文件`,
          hint: t`请选择由 Aster「导出配置」按钮生成的 JSON 文件（文件名通常为 aster-config-*.json）。`,
        };
      case 'UNSUPPORTED_VERSION':
        return {
          message: t`配置文件版本 ${error.values?.version ?? ''} 不受支持（当前支持的版本为 ${error.values?.supported ?? ''}）`,
          hint: t`请更新 Aster 至最新版本后再导入，或使用当前版本导出的配置文件。`,
        };
      case 'EMPTY_CONFIG':
        return {
          message: t`配置文件中没有可导入的内容`,
          hint: t`此文件不含任何 Provider 或 API Key 配置。请确认导出时已配置好 Provider。`,
        };
      case 'FILE_TOO_LARGE':
        return {
          message: t`文件过大，无法导入`,
          hint: t`配置文件通常只有几 KB，请确认选择的是 Aster 导出的配置文件。`,
        };
      default:
        return { message: error.message, hint: error.hint };
    }
  }

  return (
    <div className="aster-settings">
      {/* 顶部返回行 — 使用 settings-head + back-btn + ChevronLeftIcon */}
      <div className="settings-head">
        <button
          className="back-btn"
          onClick={onClose}
          aria-label={t`返回`}
          title={t`返回`}
        >
          <ChevronLeftIcon size={16} />
        </button>
        <span className="head-title">
          <Trans>设置</Trans>
        </span>
      </div>

      {/* 可滚动内容区 */}
      <div className="aster-settings__body">
        {/*
          D-26 SettingsPanel 分区：① 当前编辑表单 / ② Provider 列表 / ③ 全局选项
          实现策略（G-06 / D-26）：
            - 浏览态 (editState.kind === 'browse')：仅渲染 ②③（Provider 列表 + 全局选项）
            - 编辑态 (editState.kind === 'editing' | 'creating')：仅渲染 ①（ProviderForm 独占整个 body）
          「全局选项绝不能与当前编辑表单混排」（D-26）通过「编辑态独占」实现——
          比 D-26 字面顺序「①②③ 同屏」更强：350px 窄面板里三区同屏太拥挤，独占更符合实际 UX。
        */}
        {editState.kind === 'browse' ? (
          <>
            {/* ② Provider 列表（D-08） */}
            <ProviderList
              focusAnchor={initialAnchor}
              onEdit={(id) => setEditState({ kind: 'editing', providerId: id })}
              onCreate={() => setEditState({ kind: 'creating' })}
            />

            {/* ③ 全局选项分区（D-26 ③） */}
            <div className="aster-settings__global-options">
              {/* 选区自动附带开关（D-15）— switch 新样式 */}
              <div className="aster-settings__section">
                <label className="aster-settings__toggle-row" htmlFor="setting-auto-attach">
                  <span className="aster-settings__label">
                    <Trans>自动附带选区内容</Trans>
                  </span>
                  <label className="switch" aria-label={t`自动附带选区内容`}>
                    <input
                      id="setting-auto-attach"
                      type="checkbox"
                      checked={attachEnabled}
                      onChange={(e) => setAttachEnabled(e.target.checked)}
                    />
                    <span className="thumb" />
                  </label>
                </label>
                <p className="aster-settings__hint">
                  <Trans>发送消息时自动附带您当前选中的文档内容</Trans>
                </p>
              </div>

              {/* Phase 3 Plan 03-05：「AI 自动写文档」开关已删除（D-19 G-05 砍 v1 confirm/auto；agent loop 是唯一主路径） */}

              {/* UAT-5 — PPT 默认强调色 color picker（持久 BRAND_ACCENT_COLOR；apply_slide_layout 读取） */}
              <div className="aster-settings__section">
                <label className="aster-settings__label" htmlFor="setting-brand-accent">
                  <Trans>PPT 默认强调色</Trans>
                </label>
                <div className="aster-settings__color-row">
                  <input
                    id="setting-brand-accent"
                    type="color"
                    className="aster-settings__color-input"
                    value={brandAccentColor}
                    onChange={(e) => setBrandAccentColor(e.target.value)}
                    aria-label={t`PPT 默认强调色`}
                  />
                  <span className="aster-settings__color-hex">{brandAccentColor.toUpperCase()}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={isBrandAccentDefault ? undefined : resetBrandAccentColor}
                    aria-disabled={isBrandAccentDefault}
                    aria-label={t`重置为默认`}
                  >
                    <Trans>重置为默认</Trans>
                  </button>
                </div>
                <p className="aster-settings__hint">
                  <Trans>一键建页（套用版式）默认使用的品牌强调色。仅当你明确要求某颜色时，AI 才会临时覆盖。</Trans>
                </p>
              </div>

              {/* Phase 16 IMG-04（D-04）— 生图默认 model 下拉（持久 PREF_IMAGE_GEN_MODEL） */}
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
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <p className="aster-settings__hint">
                  <Trans>默认生图模型。预览卡内可临时切换不保存。</Trans>
                </p>
              </div>

              {/* Phase 18 LIB-01（D-08）— 图库 / Pexels API Key（独立字段，密码态，BYO） */}
              <div className="aster-settings__section">
                <label className="aster-settings__label" htmlFor="setting-pexels-key">
                  <Trans>图库 / Pexels API Key</Trans>
                </label>
                <input
                  id="setting-pexels-key"
                  type="password"
                  className="input"
                  value={pexelsApiKey}
                  onChange={(e) => setPexelsApiKey(e.target.value)}
                  placeholder={t`粘贴 Pexels API Key`}
                  aria-label={t`Pexels API Key`}
                  autoComplete="off"
                />
                <p className="aster-settings__hint">
                  <Trans>用于从 Pexels 免费图库检索正版图片插入 PPT / Word，在 pexels.com/api 免费申请。</Trans>
                </p>
              </div>

              {/* 05-10 UX-1：原「复制本次操作记录」Settings 入口已移除——
                  主界面 InputBar 复制按钮（debugReport 末尾拼接 buildStepLog）已提供等同能力，去重。 */}

              {/* Phase 8 PREF-01 — 自定义偏好文本框（D-07/D-08/D-10）*/}
              <div className="aster-settings__section">
                <span className="aster-settings__label">
                  <Trans>自定义偏好</Trans>
                </span>
                <textarea
                  className="aster-settings__pref-input"
                  placeholder={t`例如：语气正式、公司简称叫 XX、金额保留两位小数`}
                  maxLength={500}
                  value={rawInput}
                  onChange={(e) => setPrefs(e.target.value)}
                  aria-label={t`自定义偏好`}
                />
                {/* D-10 预设 chips — 点击追加到文本框，降低小白门槛 */}
                <div className="aster-settings__pref-chips">
                  {(['正式语气', '口语化', '金额两位小数'] as const).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPrefs(rawInput ? `${rawInput}，${chip}` : chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <p className="aster-settings__hint">
                  <Trans>偏好内容将在每次对话时自动注入，帮助 AI 更好地理解您的风格</Trans>
                </p>
              </div>

              {/* Phase 26 CFG-01/02/03 — 配置备份与迁移 */}
              <div className="aster-settings__section">
                <span className="aster-settings__label">
                  <Trans>配置备份与迁移</Trans>
                </span>
                <p className="aster-settings__hint">
                  <Trans>
                    把全部配置（含各 Provider 的 API 密钥、默认 Provider、偏好、主题色、生图模型、图库 Key）
                    导出为一个 JSON 文件；换电脑 / 换浏览器 / 换宿主时导入即可还原，无需重输任何密钥。
                  </Trans>
                </p>

                {/* 常驻警告条（D-03，CFG-03）— role=note 永久渲染 */}
                <div className="aster-warn-callout" role="note">
                  <span className="aster-warn-callout__icon" aria-hidden="true">
                    <AlertIcon size={16} />
                  </span>
                  <p className="aster-warn-callout__text">
                    <strong><Trans>此文件含明文 API 密钥。</Trans></strong>
                    <Trans>请妥善保管、用完即删、勿通过不安全渠道（邮件 / 聊天群 / 网盘公开链接）传输。</Trans>
                  </p>
                </div>

                {/* 两按钮等宽并排行 */}
                <div className="aster-settings__backup-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleExport}
                    aria-label={t`导出配置`}
                  >
                    <DownloadIcon size={16} />
                    <Trans>导出配置</Trans>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label={t`导入配置`}
                  >
                    <UploadIcon size={16} />
                    <Trans>导入配置</Trans>
                  </button>
                </div>

                {/* 隐藏 file input（F-05，不复用聊天附件管线） */}
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

              {/* Phase 8 HIST-02 — 清空聊天记录（D-12 只清当前文档）+ 内联两步确认（bg2）*/}
              <div className="aster-settings__section">
                {confirming ? (
                  <div className="hist-confirm-row">
                    <span className="hist-confirm-row__label">
                      <Trans>确认清空？</Trans>
                    </span>
                    <div className="hist-confirm-row__actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirming(false)}
                        aria-label={t`取消`}
                      >
                        <Trans>取消</Trans>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          clearHistory(docKeyRef.current);
                          setConfirming(false);
                        }}
                        aria-label={t`确认`}
                      >
                        <Trans>确认</Trans>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-ghost--muted"
                    onClick={() => setConfirming(true)}
                    aria-label={t`清空聊天记录`}
                  >
                    <Trans>清空聊天记录</Trans>
                  </button>
                )}
                <p className="aster-settings__hint">
                  <Trans>清除当前文档的聊天历史，不影响其他文档</Trans>
                </p>
              </div>

              {/* 重看引导（D-04） */}
              {onShowOnboarding && (
                <div className="aster-settings__section">
                  <button className="aster-link-btn" onClick={onShowOnboarding}>
                    <Trans>重看引导</Trans>
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          /* ① 当前编辑表单（独占整个 body，列表/全局选项不渲染，G-06 / D-25 / D-26） */
          <ProviderForm
            provider={editingProvider}
            initialFocus={initialAnchor}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        )}
      </div>

      {/* Phase 26 — 导入对话框（confirm / conflict / error，D-04） */}
      {importDialog.kind !== 'none' && (
        <div
          className="modal-scrim"
          onClick={() => setImportDialog({ kind: 'none' })}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-dlg-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* === 错误态 === */}
            {importDialog.kind === 'error' && (
              <>
                <h2 className="modal-title" id="import-dlg-title">
                  <Trans>无法导入此文件</Trans>
                </h2>
                <div className="aster-error-callout" role="alert">
                  <span className="aster-error-callout__icon" aria-hidden="true">
                    <AlertIcon size={16} />
                  </span>
                  <div>
                    <p className="aster-error-callout__msg">
                      {localizeImportError(importDialog.error).message}
                    </p>
                    <p className="aster-error-callout__hint">
                      {localizeImportError(importDialog.error).hint}
                    </p>
                  </div>
                </div>
                <div className="modal-foot">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setImportDialog({ kind: 'none' })}
                  >
                    <Trans>关闭</Trans>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setImportDialog({ kind: 'none' });
                      fileInputRef.current?.click();
                    }}
                  >
                    <Trans>重新选择文件</Trans>
                  </button>
                </div>
              </>
            )}

            {/* === 简单确认态（无冲突） === */}
            {importDialog.kind === 'confirm' && (
              <>
                <h2 className="modal-title" id="import-dlg-title">
                  <Trans>导入配置</Trans>
                </h2>
                <p className="modal-sub">
                  <Trans>即将从所选文件导入配置，与本地现有配置合并（保留现有 + 加入新的）。</Trans>
                </p>
                <div className="aster-warn-callout" role="note">
                  <span className="aster-warn-callout__icon" aria-hidden="true">
                    <AlertIcon size={16} />
                  </span>
                  <p className="aster-warn-callout__text">
                    <strong><Trans>该文件含明文 API 密钥。</Trans></strong>
                    <Trans>请确认来源可信。导入后请妥善保管或删除原文件。</Trans>
                  </p>
                </div>
                <div className="modal-foot">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setImportDialog({ kind: 'none' })}
                  >
                    <Trans>取消</Trans>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleConfirmImport()}
                  >
                    <Trans>确认导入</Trans>
                  </button>
                </div>
              </>
            )}

            {/* === 覆盖二次确认态（有冲突，D-04 三按钮） === */}
            {importDialog.kind === 'conflict' && (
              <>
                <h2 className="modal-title" id="import-dlg-title">
                  <Trans>覆盖已有配置？</Trans>
                </h2>
                <p className="modal-sub">
                  <Trans>以下 Provider 在本地已存在，导入会覆盖它们的配置与密钥：</Trans>
                </p>
                <ul className="aster-import-conflict-list">
                  {importDialog.conflictIds.map((id) => {
                    const prov = importDialog.parsedConfig.data.providers.find((p) => p.id === id);
                    return (
                      <li key={id}>{prov ? prov.name : id}</li>
                    );
                  })}
                </ul>
                <div className="modal-foot">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setImportDialog({ kind: 'none' })}
                  >
                    <Trans>取消</Trans>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void handleSkipConflictsAndImport()}
                  >
                    <Trans>跳过冲突项</Trans>
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleOverwriteAndImport()}
                  >
                    <Trans>覆盖并导入</Trans>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
