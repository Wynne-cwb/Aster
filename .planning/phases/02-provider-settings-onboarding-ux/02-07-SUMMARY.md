---
phase: 02-provider-settings-onboarding-ux
plan: "07"
subsystem: settings-onboarding
tags: [settings, onboarding, provider-crud, privacy, ux]
dependency_graph:
  requires:
    - "02-05"  # providerStore (autoAttach, setKey, CRUD)
    - "02-06"  # ErrorBubble (onSettings anchor 深链)
  provides:
    - SettingsPanel  # src/components/Settings/SettingsPanel.tsx
    - ProviderList   # src/components/Settings/ProviderList.tsx
    - ProviderForm   # src/components/Settings/ProviderForm.tsx
    - OnboardingModal # src/components/Onboarding/OnboardingModal.tsx
    - Step1Keys      # src/components/Onboarding/Step1Keys.tsx
    - Step2Guide     # src/components/Onboarding/Step2Guide.tsx
  affects:
    - "02-08"  # App.tsx 接入 SettingsPanel/OnboardingModal
tech_stack:
  added: []
  patterns:
    - CSS translateX 整页滑入覆盖层（aster-settings-overlay）
    - Onboarding 两步 Modal（覆盖整个 Task Pane，inset 0）
    - providerStore 深链 focusAnchor（D-12）
    - aster-toggle 自定义 checkbox CSS 开关
key_files:
  created:
    - src/components/Settings/SettingsPanel.tsx
    - src/components/Settings/ProviderList.tsx
    - src/components/Settings/ProviderForm.tsx
    - src/components/Onboarding/OnboardingModal.tsx
    - src/components/Onboarding/Step1Keys.tsx
    - src/components/Onboarding/Step2Guide.tsx
  modified:
    - src/styles.css  # 新增 Settings + Onboarding CSS 类
decisions:
  - "ProviderForm URL 校验：startsWith('https://') + URL 构造函数双重校验（T-02-26 缓解）"
  - "ProviderList 深链 focusAnchor 由 useEffect 触发，默认 Provider 编辑表单打开后 focus 目标字段（D-12）"
  - "OnboardingModal 跳过同样写 ONBOARDING_SEEN（防止下次启动再弹）"
metrics:
  duration: "~30 min"
  completed_date: "2026-05-28"
  tasks_completed: 2
  tasks_total: 2
  files_created: 6
  files_modified: 1
---

# Phase 02 Plan 07: Settings + Onboarding 组件 Summary

**一句话概括：** 整页右侧滑入 Settings 面板（ProviderPanel > ProviderList > ProviderForm）+ 2 步 Onboarding Modal（Step1 Key 填写 + 常驻隐私告知，Step2 宿主功能卡），全部 Lingui 包裹，providerStore Wave 3 直接消费。

## 构建内容

### Settings 组件结构（三层：Panel > List > Form）

```
SettingsPanel
├── ProviderList (focusAnchor 深链)
│   └── ProviderForm (新增 or 编辑)
│       ├── baseURL (url input, disabled for builtIn, https:// 校验)
│       ├── model (text input)
│       ├── apiKey (password input)
│       └── 隐私告知：「API Key 仅存储在您的浏览器本地，不经过 Aster 服务器」
├── autoAttach toggle (onChange={(e) => setAutoAttach(e.target.checked))
└── 「重看引导」按钮 (onShowOnboarding prop，D-04)
```

CSS 入口：App.tsx 中 `<div className={`aster-settings-overlay${showSettings ? ' is-open' : ''}`}>` 包裹 SettingsPanel，translateX(100%) → translateX(0) 滑入动画。

### autoAttach 开关调用链（D-15）

```
SettingsPanel input[type=checkbox] onChange
  → setAutoAttach(e.target.checked)          ← providerStore Wave 3 action
  → storage.set(SELECTION_AUTO_ATTACH, v)    ← partitioned localStorage
```

SettingsPanel 直接从 `useProviderStore((s) => s.autoAttach)` 读取，无本地 state。

### Onboarding 可跳过逻辑（D-01 路径）

```
OnboardingModal
  ├── handleSkip()
  │   ├── storage.set(ONBOARDING_SEEN, true)  ← 防止下次启动再弹
  │   └── onSkip()  → App.tsx 关闭 Modal
  └── Step1Keys.onSkip → handleSkip()
```

步骤内 「跳过」按钮调用 `onSkip`，不校验 Key 是否为空（D-01：明确允许跳过），Key 未填时 ProviderRegistry.resolve() 在真实发消息时抛 KeyInvalidError → ErrorBubble CTA（T-02-28 缓解）。

### 隐私告知文案（两处常驻，T-02-25）

1. **Step1Keys**（Onboarding 第 1 步，`.aster-privacy-notice` 内联不可折叠）：
   > 你选中的文档内容会发送到所配置的 Provider，不经过 Aster 服务器。
   > API Key 仅存储在您的浏览器本地。

2. **ProviderForm**（Settings 内每次新增/编辑 Provider，`.aster-form-hint` 常驻）：
   > API Key 仅存储在您的浏览器本地，不经过 Aster 服务器

### baseURL 校验逻辑（T-02-26）

ProviderForm `validate()` 中双重校验：
1. `!baseURL.startsWith('https://')` → 错误提示「Base URL 必须以 https:// 开头」
2. `new URL(baseURL)` → 若构造失败抛异常 → 错误提示「Base URL 格式无效」

内置 Provider（isBuiltIn=true）的 baseURL 字段为 `disabled`，跳过此校验（URL 在内部代码固定）。

### Onboarding Step 2 宿主功能卡（D-03）

```typescript
const host = useAdapter().capabilities().host; // 'ppt' | 'excel' | 'word'
switch (host) {
  case 'ppt':   // 大纲扩展 / Slide 配图 / Bullet 压缩
  case 'excel': // 自然语言公式 / 公式解释 / 数据清洗
  case 'word':  // 多风格润色 / TL;DR / 大纲扩写
}
```

`handleComplete()` 调用 `storage.set(STORAGE_KEYS.ONBOARDING_SEEN, true)` 后 `onComplete()`，App.tsx 据此关闭 Modal。

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

没有新增网络端点、auth 路径或文件访问模式：
- T-02-25（隐私告知缺失）：两处常驻 ✓
- T-02-26（恶意 URL）：startsWith https:// + URL 构造函数校验 ✓
- T-02-27（apiKey type=password）：两处 ✓
- T-02-28（Key 未填仍可发消息）：D-01 设计允许，KeyInvalidError 在发消息时触发错误气泡 ✓

## Self-Check: PASSED

| Item | Status |
|------|--------|
| src/components/Settings/SettingsPanel.tsx | FOUND |
| src/components/Settings/ProviderList.tsx | FOUND |
| src/components/Settings/ProviderForm.tsx | FOUND |
| src/components/Onboarding/OnboardingModal.tsx | FOUND |
| src/components/Onboarding/Step1Keys.tsx | FOUND |
| src/components/Onboarding/Step2Guide.tsx | FOUND |
| commit 5ef6d8f (Settings) | FOUND |
| commit 1f8aca2 (Onboarding) | FOUND |
| 165 tests pass | PASS |
