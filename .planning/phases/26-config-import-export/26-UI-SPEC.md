---
phase: 26
slug: config-import-export
status: draft
shadcn_initialized: false
preset: none
created: 2026-06-05
authored_by: ui-26 (TeamMate, aster-v2.4)
source: hand-authored from aster-design-system skill + 26-CONTEXT.md locked decisions D-01..04
---

# Phase 26 — UI Design Contract（配置导入导出 · 明文 JSON 可移植）

> Phase 26 的视觉与交互契约：在 Settings 内新增「配置备份与迁移」分区，支持**一键导出全部配置为明文 JSON 下载** + **上传 JSON 导入还原**，并以**常驻醒目警告**兑现 CFG-03「不可忽略」的明文风险告知。
> 设计系统 = teal 克制（quiet）。真相源：`src/styles.css` + `aster-design-system` skill。本 SPEC 不重新定义任何已交付的 Settings 范式，仅描述净新增 UI。

---

## 0. 范围与决策锚点

本阶段需求：**CFG-01**（导出）/ **CFG-02**（导入+合并）/ **CFG-03**（明文警告不可忽略）。详见 `26-CONTEXT.md`。

4 项 UX 决策**已由真人用户经 team-lead 锁定（2026-06-05）**，本 SPEC 直接 bake，不再 re-ask：

| ID | 决策 | 本 SPEC 落点 |
|----|------|-------------|
| **D-01** | 入口 = Settings 内**新开独立「配置备份与迁移」分区**（仿 `aster-settings__section`），含「导出配置」「导入配置」两按钮 + 常驻警告 | §2 分区布局 |
| **D-02** | 导出字段集 = 锁定清单 + 生图默认模型偏好（`PREF_IMAGE_GEN_MODEL`）；内置 Provider 行+内置 key 照常导出；**不含**引导已读 / Pexels Worker baseURL / 聊天历史 | §4 导出（字段集事实层在 CONTEXT F-01，本 SPEC 只管呈现） |
| **D-03** | CFG-03「不可忽略」= **常驻醒目警告文案**（非强制勾选、非阻断弹窗）；文案含「明文 API 密钥 / 妥善保管 / 用完即删 / 勿通过不安全渠道传输」 | §3 警告条 + §4/§5 重申 |
| **D-04** | 导入流 = **简单确认对话框（含明文警告）+ 完成后 toast 摘要**，不逐项预览；同 id Provider **覆盖前单独确认**；合并=保留现有+加入新的 | §5 导入交互 |

净新增 UI surface（共 5 项，逐一在 §2–§6 给出契约）：

| # | 新增 UI | 决策源 |
|---|---------|--------|
| 1 | 「配置备份与迁移」Settings 分区（标题/说明/两按钮/常驻警告 + 隐藏 file input） | D-01 |
| 2 | **常驻警告条** `.aster-warn-callout`（复用既有 `--warning` 语义 token，**不引第二品牌色**） | D-03 |
| 3 | 导出交互（生成 JSON → 浏览器下载 → 可选成功 toast） | CFG-01 / F-04 |
| 4 | 导入确认对话框（复用 `.modal-scrim`/`.modal`）+ 同 id 覆盖二次确认 + 完成 toast 摘要 | D-04 / CFG-02 |
| 5 | 导入错误态（损坏/非法 JSON 的诚实结构化错误） | CFG-02 / F-05 |

**不做**（Out of Scope，UI 不出现任何相关元素）：口令加密导出（CFG-D1）、复制/粘贴载体（CFG-D2）、选择性导出勾选面板（CFG-D3）、导入前完整内容预览/合并面板（D-04 否决）、聊天历史导出。

---

## 1. Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none — 自写 CSS 设计系统（`src/styles.css`） |
| Icon library | 内联 SVG，手写 Lucide 风（`src/components/icons.tsx`）— `stroke=currentColor`，strokeWidth 1.5，ISC |
| Font | `--font-body`: Inter + Noto Sans SC + 系统栈；`--font-mono`: JetBrains Mono（文件名/计数/mono 元信息） |

**shadcn gate:** 不适用。项目硬性禁用所有组件库（CLAUDE.md §被否决并永久废弃）。不跑 shadcn init。
**Registry safety:** 不适用。无第三方 registry，无 block 需审。

本阶段**不引入任何新的 scale token**（间距 `--space-1..6` / 字号 `--fs-*` / 圆角 `--radius-*` / 动效 `--dur-*` 全部复用 Phase 04.1 锁定系统）。唯一新增的是**一个组件类** `.aster-warn-callout`，其取值**全部引用既有语义 token**（见 §3）——零新增颜色 hex、零新增间距。

---

## 2. 「配置备份与迁移」分区（D-01）

### 2.1 位置

落在 `SettingsPanel.tsx` 浏览态（`editState.kind === 'browse'`）的 **`.aster-settings__global-options` 容器内**，作为一个新的 `.aster-settings__section`。

**推荐顺序**：放在「自定义偏好」section 之后、「清空聊天记录」section 之前（即"数据/迁移类操作"聚在一起，且排在破坏性的清空操作上方）。planner 可微调相对位置，但**必须在全局选项区内、必须独立成 section**（D-01 硬要求）。编辑态（`editing`/`creating`）下整个全局选项区不渲染——本分区随之不显，无冲突。

### 2.2 结构（DOM 草图）

```
<section class="aster-settings__section">
  <span class="aster-settings__label">配置备份与迁移</span>
  <p class="aster-settings__hint">
    把全部配置（含各 Provider 的 API 密钥、默认 Provider、偏好、主题色、生图模型、图库 Key）
    导出为一个 JSON 文件；换电脑 / 换浏览器 / 换宿主时导入即可还原，无需重输任何密钥。
  </p>

  <!-- 常驻警告条（D-03，§3 规格） -->
  <div class="aster-warn-callout" role="note">
    <span class="aster-warn-callout__icon" aria-hidden="true"><AlertIcon size={16} /></span>
    <p class="aster-warn-callout__text">
      <strong>此文件含明文 API 密钥。</strong>请妥善保管、用完即删、勿通过不安全渠道（邮件 / 聊天群 / 网盘公开链接）传输。
    </p>
  </div>

  <!-- 两按钮行 -->
  <div class="aster-settings__backup-actions">
    <button type="button" class="btn btn-ghost" onClick={handleExport} aria-label="导出配置">
      <DownloadIcon size={16} /> 导出配置
    </button>
    <button type="button" class="btn btn-ghost" onClick={() => fileInputRef.current?.click()} aria-label="导入配置">
      <UploadIcon /> 导入配置
    </button>
  </div>

  <!-- 隐藏 file input（不复用聊天附件管线，F-05） -->
  <input ref={fileInputRef} type="file" accept="application/json,.json" hidden
         onChange={handleFileChosen} aria-hidden="true" tabindex="-1" />
</section>
```

### 2.3 新增 CSS（按钮行）

```css
/* Phase 26 — 配置备份与迁移：两按钮等宽并排 */
.aster-settings__backup-actions {
  display: flex;
  gap: var(--space-2);              /* 8px */
  margin-top: var(--space-2);
}
.aster-settings__backup-actions .btn {
  flex: 1;                          /* 两按钮等宽，居中图标+文字 */
}
```

### 2.4 按钮决策

- 两按钮均用 **`.btn .btn-ghost`**（透明底 + 1px border），等宽并排。理由：与本分区邻居（「重置为默认」「清空聊天记录」「偏好 chips」皆 ghost）保持克制一致；teal 实底 `.btn-primary` 在 Settings 内**保留给"提交/保存"类语义**（如 ProviderForm 保存），不滥用。
- **导出图标** = 新增 `DownloadIcon`（Lucide download：下箭头 + 底托盘线），语义"下载到本地"。**导入图标** = 复用既有 `UploadIcon`（上箭头入托盘），语义"上传文件"。
- **诚实禁用**：本分区两按钮**始终可用**（即使尚未配置任何 key，导出空配置也合法、导入也合法）。不造假禁用态。
- **assumption（planner 可推翻）**：若 planner 认为「导出配置」应更突出，可单独提升为 `.btn-primary`；本 SPEC 默认两者 ghost 以维持 quiet 气质。

---

## 3. 常驻警告条 `.aster-warn-callout`（D-03 + 设计难点解法）★

> **设计难点：** team-lead 指出"teal 克制是单一品牌色、无现成 warn token，需定义低饱和警示表达且严禁引入第二品牌色"。
>
> **解法（关键发现，请 team-lead 注意）：** 设计系统**已经内置** `--warning` / `--warning-soft` 语义 token，**无需新造**——
> - `--warning` light `#b45309`（amber-700）/ dark `#fbbf24`（amber-400）
> - `--warning-soft` light `#fef3c7`（amber-100）/ dark `rgba(251,191,36,0.18)`
> - 这对 token 在 `src/styles.css` 已存在（light 块 L70-71 + dark 块 L1475-1476），并**已被既有 UI 使用**：`.pane-banner`（缺 Key 提示，L797-798）与 `.badge-warning`（L1462-1464）。
>
> **它不是"第二品牌色"**——它和 `--error`（红）/ `--success`（绿）/ `--info`（蓝）属于**同一类语义状态色**，这类状态色在 teal 体系里**本就合法共存**（设计系统的"单一品牌色"约束指的是 **accent/brand 色只能有 teal 一个**，而非禁止 error/success/warning 等状态语义色）。沿用 `--warning` 既**满足"低饱和、克制"**（amber 是低饱和暖色），又**避免 token drift**（不复制出平行的 `--warn-*` 家族违反"复用现有变量"铁律）。

### 3.1 ✅ 推荐方案：复用 `--warning` / `--warning-soft`，只新增一个组件类

**不新增任何颜色变量。** 只新增组件类 `.aster-warn-callout`，全部引用既有 token：

```css
/* Phase 26 — 常驻明文警告条（teal 克制：复用既有 --warning 语义色，零新增 token） */
.aster-warn-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);                                            /* 8px */
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);                          /* 8/12px */
  background: var(--warning-soft);
  border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
  border-left: 3px solid var(--warning);                           /* 左竖条点缀，同 .toast 的 accent 条范式 */
  border-radius: var(--radius-2);                                  /* 8px */
}
.aster-warn-callout__icon {
  display: inline-flex;
  align-items: center;
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 1px;                                                 /* 视觉对齐首行文字 */
}
.aster-warn-callout__text {
  margin: 0;
  font-size: var(--fs-12);                                         /* 12px，比说明 hint(11) 略重，比正文(13) 略收 */
  line-height: 1.5;
  color: var(--text);                                              /* 正文用主文色，保证可读对比 */
}
.aster-warn-callout__text strong {
  font-weight: 600;
  color: var(--warning);                                           /* 风险定性短语用 warning 色加重 */
}
```

**为何不破坏 teal 克制气质：**
- ❌ 无多色渐变（纯色块 + 边框）。❌ 无 `backdrop-filter` / 玻璃拟态（实底 `--warning-soft`）。
- accent（teal）色**完全未被本组件占用**——警示色与品牌色清晰分层，品牌色仍是唯一 teal。
- 低饱和 amber + 1px 薄边框 + 左 3px 竖条点缀，与既有 `.pane-banner` / `.toast` 同一视觉语族（薄边框 + 单色点缀），不喧宾夺主。

### 3.2 light / dark 两套取值（均来自既有 token，逐字确认）

| 角色 | light（`[data-theme="light"]`） | dark（`[data-theme="dark"]`） | 来源 |
|------|-------------------------------|------------------------------|------|
| 底色 `background` | `--warning-soft` = `#fef3c7` | `--warning-soft` = `rgba(251,191,36,0.18)` | styles.css L71 / L1476（既有，零改动） |
| 边框/竖条/图标/加重字 | `--warning` = `#b45309` | `--warning` = `#fbbf24` | styles.css L70 / L1475（既有，零改动） |
| 正文 `--text` | `#131316` | `#f4f4f5` | 既有 |

> 两套主题对比度自检：light `#b45309` 加重字 on `#fef3c7` ≈ 5:1+；dark `#fbbf24` on 暗 amber 18% over `#0e0e10` 对比充足。正文 `--text` on `--warning-soft` 两套均 ≥7:1。✅

### 3.3 ⚠️ 备选方案（仅当 team-lead 坚持要"命名 warn 变量"时）

若硬性要求新增命名变量，**最小代价做法是加语义别名**（指向既有 token，不引入新 hex，避免 drift）：

```css
/* 备选：仅做别名，不引入新颜色值 */
[data-theme="light"], [data-theme="dark"] {
  --warn-bg: var(--warning-soft);
  --warn-border: var(--warning);
  --warn-text: var(--text);
}
```

**本 SPEC 不推荐备选**：`--warning*` 已是事实上的 warn token，再加 `--warn-*` 别名只是同义重复，徒增维护点。**推荐直接用 §3.1。** 这是与 teal 体系一致的合理默认（记为 assumption A-1，见 §10）。

---

## 4. 导出交互（CFG-01）

### 4.1 流程

1. 用户点「导出配置」按钮。
2. 应用收集字段集（CONTEXT F-01 逐字段映射 + D-02：含内置/自定义 Provider 配置、各 `aster:keys:{id}` 明文 key、Pexels key、默认 Provider、选区附带开关、用户偏好、主题强调色、`PREF_IMAGE_GEN_MODEL`；**不含**聊天历史 / 引导已读 / Pexels Worker baseURL）。
3. `JSON.stringify` → `new Blob([...], {type:'application/json'})` → `URL.createObjectURL` → 临时 `<a download>` click → `revokeObjectURL`（F-04，零新依赖）。
4. **文件名建议** `aster-config-YYYYMMDD.json`（如 `aster-config-20260605.json`；应用运行时用 `new Date()` 格式化——GSD 脚本禁 Date 的约束不适用于应用代码）。planner 可加时分（`-HHmm`）防同日覆盖。
5. **可选成功 toast**：导出落盘后 `showToast(t\`配置已导出\`)`（复用既有 `useToastStore`，§6）。属 nice-to-have；不强制。

### 4.2 警告呈现

导出**无需**额外确认弹窗（D-03 不阻断）。明文风险由 §3 的**常驻警告条**承担——它就在两按钮正上方、始终可见，满足 CFG-03「不可忽略」。**无需**在点击导出时再弹一次警告。

### 4.3 UI 状态

- 导出是同步、瞬时操作，**无需 loading 态**。
- 极端情况（Blob/URL API 不可用）→ 走 §5 同款诚实错误（toast 或 inline 错误："导出失败，请重试"，附 hint）。属边界，planner 视实现决定呈现位置。

---

## 5. 导入交互（CFG-02 + D-04）

### 5.1 总流程（happy path）

```
点「导入配置」
  → 触发隐藏 file input（accept=.json）
  → 用户选文件 → file.text() → JSON.parse + schema 校验（F-06）
  ├─ 校验失败 → §5.4 错误态（不进确认对话框）
  └─ 校验通过 → ① 简单确认对话框（含明文警告重申，D-04）
        → 用户点「确认导入」
        ├─ 无同 id 冲突 → 直接写入 → ② 完成 toast 摘要
        └─ 有同 id 冲突 → ②' 覆盖二次确认对话框（批量列出冲突项）
              → 用户选「覆盖全部并导入」/「跳过冲突项」/「取消」
              → 写入（按选择）→ 完成 toast 摘要
```

合并策略（CFG-02 locked）：**保留现有 + 加入新的**。新 id Provider → 直接加入；同 id Provider（含内置固定 id deepseek/aihubmix）→ 覆盖前确认。写入后必须经 store setter / `hydrateFromStorage()` 刷新 reactive（F-07，尤其 `configuredKeyIds` 控红条显隐）——属实现守门，本 SPEC 标注，详见 CONTEXT F-07/F-08。

### 5.2 ① 简单确认对话框（D-04）

**复用既有 `.modal-scrim` + `.modal` 范式**（Onboarding 同款，零新增 modal 基建）。**不逐项预览**（D-04 否决预览面板）。

DOM 草图：
```
<div class="modal-scrim" onClick={onScrimClose}>
  <div class="modal" role="dialog" aria-modal="true"
       aria-labelledby="import-dlg-title" aria-describedby="import-dlg-warn"
       onClick={stopPropagation}>
    <h2 class="modal-title" id="import-dlg-title">导入配置</h2>
    <p class="modal-sub">
      即将从所选文件导入配置，与本地现有配置合并（保留现有 + 加入新的）。
    </p>

    <!-- 明文警告重申（D-03 要求导入确认里再重申一次）— 复用 §3 同款 callout -->
    <div class="aster-warn-callout" role="note" id="import-dlg-warn">
      <span class="aster-warn-callout__icon" aria-hidden="true"><AlertIcon size={16} /></span>
      <p class="aster-warn-callout__text">
        <strong>该文件含明文 API 密钥。</strong>请确认来源可信。导入后请妥善保管或删除原文件。
      </p>
    </div>

    <div class="modal-foot">
      <button class="btn btn-ghost" onClick={onCancel}>取消</button>
      <button class="btn btn-primary" onClick={onConfirm}>确认导入</button>
    </div>
  </div>
</div>
```

- 主操作「确认导入」用 `.btn-primary`（teal，推进性动作）；「取消」用 `.btn-ghost`。
- **可选信息行**（assumption A-2，planner 可选）：在 `.modal-sub` 下加一行极简概览（如「检测到 3 个 Provider、3 个密钥」）。这**不等于**被否决的"逐项预览面板"——仅一行计数，仍属"简单确认"。若 planner 取此选项，对话框结构不变，仅多一个 `<p class="modal-sub">` 计数行。本 SPEC 默认**不加**，保持最简。

### 5.3 ②' 同 id 覆盖二次确认对话框（CFG-02 locked）

仅当检测到本地已存在同 id Provider（或同 id 已有非空 key）时弹出。**推荐批量形态**（最简，避免多 modal 叠弹疲劳）：

```
<div class="modal-scrim">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="conflict-dlg-title">
    <h2 class="modal-title" id="conflict-dlg-title">覆盖已有配置？</h2>
    <p class="modal-sub">
      以下 Provider 在本地已存在，导入会覆盖它们的配置与密钥：
    </p>
    <!-- 仅列冲突项名称（mono provider 名/id），非完整预览 -->
    <ul class="aster-import-conflict-list">
      <li><span class="pname">DeepSeek</span></li>
      <li><span class="pname">我的自定义 Provider</span></li>
    </ul>
    <div class="modal-foot">
      <button class="btn btn-ghost" onClick={onCancelAll}>取消</button>
      <button class="btn btn-ghost" onClick={onSkipConflicts}>跳过冲突项</button>
      <button class="btn btn-primary" onClick={onOverwriteAll}>覆盖并导入</button>
    </div>
  </div>
</div>
```

新增 CSS（冲突列表，复用既有 token）：
```css
/* Phase 26 — 导入覆盖确认：冲突项列表（极简，非预览面板） */
.aster-import-conflict-list {
  margin: 0;
  padding: var(--space-2) 0 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  max-height: 160px;
  overflow-y: auto;
}
.aster-import-conflict-list li {
  font-size: var(--fs-13);
  color: var(--text);
  padding: var(--space-1) var(--space-2);
  background: var(--surface-2);
  border-radius: var(--radius-1);
}
```

- **三按钮语义**：「覆盖并导入」(`.btn-primary`) = 覆盖冲突项 + 加入新项；「跳过冲突项」(`.btn-ghost`) = 仅加入新 id 项、保留本地冲突项不动；「取消」(`.btn-ghost`) = 整次导入放弃。
- **窄面板 350px 注意**：三按钮在 `.modal-foot`（flex-end，gap 8px）下可能偏挤——assumption A-3：若实测过挤，planner 可将「跳过冲突项」降级为对话框内的次级文字链接（`.aster-link-btn`）或采用「覆盖全部 / 取消」两按钮 + 单独的「跳过冲突」复选行。本 SPEC 默认三按钮，planner 真机微调。
- planner 也可选**逐个确认**形态（CONTEXT D-04 允许"逐个或一次性"）；本 SPEC 推荐批量，因 350px 下少打断更佳。

### 5.4 导入错误态（CFG-02：损坏/非法 JSON 可操作提示）★

沿用 **Phase 17/18 诚实结构化错误范式** `{code, message, recoverable, hint}`。**不静默、不假成功、不崩溃。**

呈现位置 = **替换确认对话框 ① 的内容**为错误态（因为校验在打开对话框前已失败，故对话框首屏直接显示错误，而非先显示 confirm 再报错）。**不用 toast 承载错误**——错误需持久可读 + 可操作，2s toast 不胜任。

```
<div class="modal-scrim">
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="import-err-title">
    <h2 class="modal-title" id="import-err-title">无法导入此文件</h2>

    <!-- 错误用既有 --error 语义色（同 warn-callout 结构，换色族） -->
    <div class="aster-error-callout" role="alert">
      <span class="aster-error-callout__icon" aria-hidden="true"><AlertIcon size={16} /></span>
      <div>
        <p class="aster-error-callout__msg">{error.message}</p>
        <p class="aster-error-callout__hint">{error.hint}</p>
      </div>
    </div>

    <div class="modal-foot">
      <button class="btn btn-ghost" onClick={onClose}>关闭</button>
      <button class="btn btn-primary" onClick={() => fileInputRef.current?.click()}>重新选择文件</button>
    </div>
  </div>
</div>
```

错误文案矩阵（中文，可操作，`code` 供日志/守门测试断言）：

| code | 触发 | message | hint |
|------|------|---------|------|
| `INVALID_JSON` | `JSON.parse` 抛错 | 文件不是有效的 JSON，可能已损坏。 | 请确认选择的是 Aster 导出的 `.json` 文件，未被编辑器改动或截断。 |
| `NOT_ASTER_CONFIG` | 缺 `app:'aster'` / `version` / `data` | 这不是 Aster 的配置文件。 | 请选择由 Aster「导出配置」生成的文件（文件名通常以 `aster-config-` 开头）。 |
| `UNSUPPORTED_VERSION` | `version` 高于当前支持 | 此配置由更新版本的 Aster 导出，当前版本无法识别。 | 请升级 Aster 后重试，或使用导出该文件的同版本。 |
| `EMPTY_CONFIG` | 校验通过但 `data` 无任何可导入项 | 文件中没有可导入的配置。 | 该文件可能是空配置；请确认导出时已配置过 Provider 或密钥。 |

错误态 CSS（复用既有 `--error` / `--error-soft`，与 warn-callout 同结构）：
```css
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
```
> `--error` light `#dc2626` / `--error-soft` `#fee2e2`；dark `--error` `#f87171` / `--error-soft` `rgba(248,113,113,0.14)`——均既有（styles.css L62 + dark 块），两主题已覆盖。

### 5.5 ② 完成 toast 摘要（D-04）

写入成功后 `showToast(...)`（复用既有 `useToastStore`，§6）。

- **文案**（简体中文，简洁，因 toast 单行 ellipsis）：`已导入 N 个 Provider · M 个密钥`，偏好/主题色有变更时可加 `，偏好已恢复`。
  - 示例：`已导入 3 个 Provider · 3 个密钥，偏好已恢复`
- **跳过冲突时**可改：`已导入 2 个新 Provider，跳过 1 个冲突项`。
- ⚠️ **toast 单行约束**（既有 `.toast` 为 `white-space: nowrap` + ellipsis，max-width `calc(100% - 32px)`，350px 下约容 ~22–24 个中文字）：摘要务必精简，超长会被截断。**assumption A-4**：若 planner 认为摘要必须多行完整展示，可在写入成功后改用一条 inline 成功提示（如确认对话框关闭后在分区内显示一行 `--success` 文案），而非 toast；本 SPEC 默认 toast + 精简文案（符合 D-04「完成后 toast 摘要」字面）。

---

## 6. 复用资产 / 全局约定（不重造）

| 资产 | 复用点 | 来源 |
|------|--------|------|
| `useToastStore.showToast(msg)` | 导出成功 / 导入完成摘要 | `src/store/toast.ts`（既有，2s 自动消失，role=status aria-live=polite） |
| `<Toast />` | 已挂 App 顶层，z-index 60（在 Settings 10 / modal 50 之上）——导入对话框关闭后 toast 正常浮现 | `src/components/Toast.tsx` |
| `.modal-scrim` / `.modal` / `.modal-title` / `.modal-sub` / `.modal-foot` | 导入确认 / 覆盖确认 / 错误对话框 | `src/styles.css` L1196-1252（Onboarding 同款） |
| `.btn` / `.btn-primary` / `.btn-ghost` | 全部按钮 | 既有 btn 系 L1254+ |
| `.aster-settings__section` / `__label` / `__hint` | 新分区容器/标题/说明 | 既有 Settings 范式 |
| `AlertIcon`（三角感叹号） | warn / error callout 图标 | `icons.tsx` L102 |
| `UploadIcon` | 「导入配置」按钮图标 | `icons.tsx` L32 |
| `--warning` / `--warning-soft` / `--error` / `--error-soft` 语义 token | warn / error callout 配色 | `src/styles.css`（既有，两主题已覆盖） |

**净新增图标（1 个）**：`DownloadIcon`（Lucide download）加入 `icons.tsx`：
```tsx
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
> 与 `InsertIcon`（插入到文档）path 相近但**语义不同**——故新建独立图标，不复用 `InsertIcon`（避免"插入文档"与"下载文件"语义混淆）。

### 动效 / reduced-motion
- 对话框出现复用 `.modal-scrim` 既有过渡；toast 复用 `toast-in`（`--dur-base` 200ms ease-out）。
- 所有过渡落在 **120–320ms**（`--dur-fast/base/slow`）。
- `@media (prefers-reduced-motion: reduce)` 全局已 `transition/animation: none !important`（styles.css L102-104）——本阶段新元素自动降级，无需单独处理。

### 焦点 ring
- 所有按钮、file-input 触发按钮：`:focus-visible` → `box-shadow: var(--ring-focus)`（既有 `.btn` 规则已覆盖）。

---

## 7. 文案契约（Copywriting）

全中文，全部用 Lingui `<Trans>` / `t\`\`` 宏包裹。⚠️ **实现期改 UI 动宏后必跑 `npm run extract`**（否则 `coverage.test.ts` 红 —— memory `project_i18n_extract_and_test_noise`）。

| 元素 | 文案 |
|------|------|
| 分区标题 | 「配置备份与迁移」 |
| 分区说明 hint | 「把全部配置（含各 Provider 的 API 密钥、默认 Provider、偏好、主题色、生图模型、图库 Key）导出为一个 JSON 文件；换电脑 / 换浏览器 / 换宿主时导入即可还原，无需重输任何密钥。」 |
| 常驻警告（分区） | 「**此文件含明文 API 密钥。**请妥善保管、用完即删、勿通过不安全渠道（邮件 / 聊天群 / 网盘公开链接）传输。」 |
| 导出按钮 | 「导出配置」 |
| 导入按钮 | 「导入配置」 |
| 导出成功 toast（可选） | 「配置已导出」 |
| 导入确认标题 | 「导入配置」 |
| 导入确认说明 | 「即将从所选文件导入配置，与本地现有配置合并（保留现有 + 加入新的）。」 |
| 导入确认警告重申 | 「**该文件含明文 API 密钥。**请确认来源可信。导入后请妥善保管或删除原文件。」 |
| 导入确认 CTA | 「取消」/「确认导入」 |
| 覆盖确认标题 | 「覆盖已有配置？」 |
| 覆盖确认说明 | 「以下 Provider 在本地已存在，导入会覆盖它们的配置与密钥：」 |
| 覆盖确认 CTA | 「取消」/「跳过冲突项」/「覆盖并导入」 |
| 完成 toast 摘要 | 「已导入 N 个 Provider · M 个密钥」（+「，偏好已恢复」可选） |
| 错误标题 | 「无法导入此文件」 |
| 错误 message/hint | 见 §5.4 矩阵（4 条）|
| 错误 CTA | 「关闭」/「重新选择文件」 |

**文案反模式（禁止）**：
- ❌「确定」/「提交」/「OK」裸 CTA —— 每个按钮须 动词+名词（「确认导入」「覆盖并导入」「重新选择文件」）。
- ❌ 警告里出现英文 storage key（`aster:keys:*`）—— 用户语言描述（「API 密钥」）。
- ❌ 静默失败 / 假成功 —— 错误必走 §5.4 结构化提示。

---

## 8. 无障碍（A11y）

| 元素 | 要求 |
|------|------|
| 常驻警告条 | `role="note"`（静态常驻信息，**不可**用 `role="alert"`——alert 会在每次渲染抢播报）。图标 `aria-hidden`，文字本身即可读内容。 |
| 导入/覆盖确认对话框 | `role="dialog"` + `aria-modal="true"` + `aria-labelledby`（标题）+ `aria-describedby`（确认对话框指向警告文本 id）。 |
| 焦点管理 | 对话框打开：焦点移入对话框（推荐落在**「取消」**上，安全默认，避免误确认）。`Esc` = 取消/关闭并把焦点**还给触发的「导入配置」按钮**。`Tab`/`Shift+Tab` 在对话框内循环（焦点 trap），不泄漏到背后 Settings。 |
| 错误 callout | `role="alert"`（动态出现，应被屏幕阅读器播报 message+hint）。 |
| 完成 toast | 复用既有 `role="status"` `aria-live="polite"`（不抢焦点）。 |
| 隐藏 file input | `hidden` + `tabindex="-1"` + `aria-hidden="true"`；键盘用户通过可见的「导入配置」按钮（有 `aria-label`）触发 `.click()`，input 本身不在 tab 序列。 |
| 键盘可达 | 全部按钮原生 `<button>`，Tab 可达，Enter/Space 激活；focus ring `var(--ring-focus)` 可见。 |
| 对比度 | warn/error callout 取值见 §3.2 / §5.4，两主题正文 ≥7:1、加重短语 ≥4.5:1。 |

---

## 9. Pre-Population Audit

| Field | Source | Decision |
|-------|--------|----------|
| Design system (none) | CLAUDE.md §被否决并永久废弃 | Locked |
| Spacing scale `--space-1..6` | Phase 04.1 `src/styles.css :root` | Locked UAT-passed |
| Typography `--fs-*` | Phase 04.1 `:root` | Locked UAT-passed |
| Color tokens (light/dark) | Phase 04.1 `[data-theme]` 两块 | Locked UAT-passed |
| **Warn 视觉** | **既有 `--warning`/`--warning-soft`（styles.css L70-71 / L1475-1476）** | **复用（A-1）—— 非新造第二品牌色** |
| Error 视觉 | 既有 `--error`/`--error-soft` + Phase 17/18 结构化错误范式 | Reuse shipped |
| Section 范式 | `aster-design-system` / `SettingsPanel.tsx` | Reuse shipped |
| Modal 范式 | `settings-and-onboarding.md` / styles.css L1196+ | Reuse shipped |
| Toast | `src/store/toast.ts` + `Toast.tsx` | Reuse shipped |
| 按钮/焦点 ring/动效 | 既有 `.btn-*` / `--ring-focus` / `--dur-*` | Reuse shipped |
| DownloadIcon | 新增 1 个内联 SVG（Lucide download 风） | New（§6） |
| 文件下载机制 | `Blob`+`createObjectURL`+`<a download>`（F-04） | 原生，零新依赖 |
| 文件读取机制 | 独立 `<input type=file>`+`file.text()`（F-05，**不复用聊天附件管线**） | 原生，零新依赖 |
| 中文 + Lingui 宏 | CLAUDE.md §Language + memory i18n | Locked |
| 诚实禁用 | CLAUDE.md §UI 设计系统 | Existing convention |

---

## 10. Assumptions / 未决点（留给 planner / team-lead）

| ID | Assumption（本 SPEC 取的合理默认） | 可推翻者 |
|----|-----------------------------------|----------|
| **A-1** | **warn 视觉复用既有 `--warning`/`--warning-soft`**，只新增组件类 `.aster-warn-callout`，**不**新造 `--warn-*` 变量家族（避免 token drift；`--warning` 属合法语义状态色，非第二品牌色）。备选别名方案见 §3.3。 | team-lead（设计难点拍板） |
| **A-2** | 导入确认对话框默认**不加**计数概览行（保持最简）；planner 可选加一行「检测到 N 个 Provider」（仍非预览面板）。 | planner |
| **A-3** | 同 id 覆盖确认用**批量三按钮**（覆盖全部/跳过冲突/取消）；350px 下若过挤，planner 真机改两按钮 + 文字链接。也可改逐个确认（CONTEXT D-04 允许）。 | planner / 真机 UAT |
| **A-4** | 完成摘要用既有 **toast（单行精简文案）**；若需多行完整摘要，planner 可改 inline `--success` 提示行。 | planner |
| **A-5** | 两按钮均 `.btn-ghost`（克制一致）；planner 可将「导出配置」提升 `.btn-primary`。 | planner |
| **A-6** | 文件名 `aster-config-YYYYMMDD.json`；planner 可加 `-HHmm` 防同日覆盖（F-04）。 | planner |

**无阻塞项**（未触发需打断真人用户的硬阻塞）。A-1 是唯一与 team-lead 原指令（"新增 --warn-* 变量"）有出入的点——本 SPEC 给出更优默认（复用既有 token）+ 备选别名方案，请 team-lead 知悉/确认（见 handoff）。

---

## 11. Checker 自检（gsd-ui-checker 6 维度预判）

> 本 SPEC 由 ui-26 手写（gsd-ui-phase 编排的等价产物）；以下为自检，正式 sign-off 可由 gsd-ui-checker 复核。

| 维度 | 预判 | 说明 |
|------|------|------|
| 1 Copywriting | **PASS** | 全中文 Lingui 宏；每个 CTA 动词+名词；错误诚实结构化（message+hint+code）；无裸「确定」。 |
| 2 Visuals | **PASS** | warn/error callout 与既有 `.toast`/`.pane-banner` 同视觉语族；焦点序明确；无渐变、无 backdrop-filter。 |
| 3 Color | **PASS（1 FLAG）** | 单一 teal accent 不变；warn/error 用既有语义状态色。**FLAG（非阻断）**：A-1 复用 `--warning` 而非新造 `--warn-*`——理由见 §3，请 checker 勿据"未新增命名变量"判 FAIL（既有 token 即 warn token）。 |
| 4 Typography | **PASS** | 仅用既有 `--fs-12/13/18`；权重 400/500(btn)/600，无新字号。 |
| 5 Spacing | **PASS** | 仅用 `--space-1..3` + `--radius-1/2`，全 4 倍数，无新 scale。 |
| 6 Registry Safety | **PASS** | 无组件库、无第三方 registry。 |

**潜在 FLAG（非阻断，已在 §10 记录）**：A-1（warn token 复用）、A-4（toast 单行截断）。无 BLOCK。

**CFG-03 verifier 基线对齐**（CONTEXT L213）：常驻（`role="note"` 永久渲染于分区）+ 醒目（`--warning-soft` 块 + 左竖条 + 图标 + 加重定性短语）+ 措辞完整（含"明文 API 密钥 / 妥善保管 / 用完即删 / 勿通过不安全渠道传输"）+ 导入确认里重申 → **应判 PASS**；**不得**因"未强制勾选"判 FAIL（D-03 用户取舍）。

---

*Phase: 26-config-import-export · UI Design Contract*
*Authored: 2026-06-05 by ui-26 · 基于 aster-design-system skill + 26-CONTEXT.md D-01..04*
*下游：gsd-plan-phase 26（消费本 SPEC + CONTEXT F-01..10 事实层）*
