# 设置 与 引导（Settings & Onboarding）

设置滑出层（Provider 列表 / 编辑表单 / 全局开关）+ Onboarding modal（2 步：配 Key → 三宿主能力卡）。

> 实现：`src/components/Settings/`（SettingsPanel / ProviderList / ProviderForm 等）+ `src/components/Onboarding/`。CSS 在 `src/styles.css`「Settings 面板内部」「Provider 表单」「Settings 重皮」「Onboarding modal」「基础 btn 系」「input 通用」「host-card」段。

## Design Decisions

### 设置滑出层 `.settings-overlay`
- 绝对覆盖 pane，`translateX(100%)` → `.is-open` 时 `translateX(0)` 左滑入（`--dur-base` 缓动）。
- `.settings-head`：返回箭头（`.back-btn`）+ 标题，底部 1px border。

### Provider 列表
- `.provider-list`：surface 卡片容器，行间用 `.provider-row` 的 `1px var(--border)` 分隔（最后一行去边）。
- `.provider-row`：左 `.pinfo`（name + badge + `.pmodel` mono 模型 ID，多槽用 `·` 分隔）/ 右 `.pactions`（编辑 pencil + **「更多」仅非内置才显示**）。
- **徽章**：`.badge-accent`（teal soft，「默认」**仅内置 `builtIn` 有**）/ `.badge-success`（绿，「已配 Key」）/ `.badge`（中性灰，「未配 Key」）。

### Provider 编辑表单（三层 sticky footer，G-06 / D-25）
- flex column 占满 body 高度：`__header`（不滚）/ `__body`（flex:1 可滚）/ `__footer`（sticky 贴底）——字段再长，「保存/取消」始终在视口底部。
- ⚠️ footer 两按钮 gap = `--space-4`(16px)（**UAT 修**：原 8px 真机反馈两按钮贴太近）。
- **内置 Provider**：`.builtin-note` 胶囊提示「名称与 Base URL 不可改」；name + baseUrl input `disabled`（`--surface-2` 底 + not-allowed），model 槽仍可改可存。
- **model 下拉** `.select-wrap`：`appearance:none` 去原生箭头，右侧 abs `.select-caret` 装 chevronDown 14px。DeepSeek 单槽（`deepseek-v4-pro/flash`）/ AIHubMix 双槽（图片识别 + 图片生成）。
- **API Key** input password + 右侧 eye 切换。

### 全局选项分区
- `.row-toggle`「选中内容自动附带」+ `.switch`（teal when on）。
- 「重看引导」链接（refresh + chevron）回 onboarding。
- 编辑态下全局选项容器**不渲染**（ProviderForm 独占，避免 350px 窄面板三区拥挤——D-26/G-06 实现偏离设计稿字面同屏，更符合 UX）。

### Onboarding modal（2 步）
- `.modal-scrim`：全屏 dark scrim（`color-mix(text 35%)`）居中 `.modal`（max 320px、`--radius-4` 圆角、`--shadow-pop`）。
- `.modal-brand`（logo + Aster + mono step「01/02」）+ `.modal-title`(18/600) + `.modal-sub`(13/text-2) + `.modal-body` + `.modal-foot`(右对齐 ghost+primary)。
- Step 1：DeepSeek Key（必填）+ AIHubMix Key（选填）。**无「默认 Provider」radio**（已移除，硬编码 `deepseek`）。**无隐私步**（PRIV 全砍）。
- Step 2：三张 `.host-card`（PPT/Excel/Word），36×36 图标 + 标题 + 3 条要点。

### ConfigBanner `.pane-banner`
API Key 未配时单行薄 warning banner（`color-mix(warning 6%)` 底 + warning 字 + alertCircle + inline「前往设置 →」）。

### 按钮体系（全局共用）
`.btn` + `.btn-primary`（teal 实底）/ `.btn-ghost`（透明 + border）/ `.btn-sm`。focus 用 `ring-focus`。

## CSS Patterns（线上实测，节选）

### 滑出层 + header
```css
.settings-overlay { position: absolute; inset: 0; background: var(--bg);
  transform: translateX(100%); transition: transform var(--dur-base) var(--ease-out);
  z-index: 10; display: flex; flex-direction: column; }
.settings-overlay.is-open { transform: translateX(0); }
.settings-head { display: flex; align-items: center; gap: 8px; padding: 12px 14px;
  border-bottom: 1px solid var(--border); flex-shrink: 0; }
```

### Provider 行 + 徽章
```css
.provider-list { display: flex; flex-direction: column; border: 1px solid var(--border);
  border-radius: var(--radius-3); background: var(--surface); overflow: hidden; }
.provider-row { display: flex; align-items: center; padding: 10px 14px; gap: 8px;
  border-bottom: 1px solid var(--border); }
.provider-row:last-child { border-bottom: 0; }
.pinfo { flex: 1; min-width: 0; }
.pname { font-size: var(--fs-13); font-weight: 500; color: var(--text); }
.pmodel { font-family: var(--font-mono); font-size: var(--fs-11); color: var(--text-3); }

.badge { display: inline-flex; align-items: center; padding: 1px 6px; border-radius: var(--radius-full);
  font-size: var(--fs-11); font-weight: 500; background: var(--surface-2); color: var(--text-3); }
.badge-accent  { background: var(--accent-soft); color: var(--accent); }      /* 「默认」仅内置 */
.badge-success { background: var(--success-soft); color: var(--success); }    /* 「已配 Key」*/
```

### 表单三层 sticky footer
```css
.aster-provider-form { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.aster-provider-form__header { flex-shrink: 0; padding: var(--space-4) var(--space-4) var(--space-2); }
.aster-provider-form__body { flex: 1; min-height: 0; overflow-y: auto; padding: 0 var(--space-4) var(--space-4); }
.aster-provider-form__footer {
  flex-shrink: 0; position: sticky; bottom: 0;
  display: flex; justify-content: flex-end; gap: var(--space-4);   /* 16px，UAT 修 */
  padding: var(--space-3) var(--space-4); background: var(--bg);
  border-top: 1px solid var(--border); box-shadow: 0 -4px 12px rgba(0,0,0,0.04); z-index: 1;
}
```

### model 下拉 + 内置提示 + switch
```css
.select-wrap { position: relative; }
.select-wrap .input.select { appearance: none; padding-right: 28px; cursor: pointer; }
.select-caret { position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
  pointer-events: none; color: var(--text-3); display: flex; align-items: center; }
.builtin-note { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px;
  background: var(--surface-2); border-radius: var(--radius-full); font-size: var(--fs-11); color: var(--text-3); }

.switch { position: relative; width: 34px; height: 20px; flex-shrink: 0; cursor: pointer; }
.switch input { opacity: 0; width: 0; height: 0; position: absolute; }
.switch .thumb { position: absolute; inset: 0; background: var(--surface-3); border-radius: var(--radius-full);
  transition: background var(--dur-fast) var(--ease-out); }
.switch .thumb::after { content: ''; position: absolute; width: 14px; height: 14px; background: #fff;
  border-radius: 50%; top: 3px; left: 3px; transition: transform var(--dur-fast) var(--ease-out); }
.switch input:checked + .thumb { background: var(--accent); }
.switch input:checked + .thumb::after { transform: translateX(14px); }
```

### Onboarding modal + 按钮 + input + host-card
```css
.modal-scrim { position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--text) 35%, transparent); z-index: 50; padding: 16px; }
.modal { background: var(--surface); border-radius: var(--radius-4); box-shadow: var(--shadow-pop);
  width: 100%; max-width: 320px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 4px; border: 0;
  border-radius: var(--radius-2); font-family: var(--font-body); font-size: var(--fs-13);
  font-weight: 500; cursor: pointer; padding: 6px 14px; transition: background var(--dur-fast) var(--ease-out); }
.btn-primary { background: var(--accent); color: var(--accent-on); }
.btn-primary:hover { background: var(--accent-hover); }
.btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--surface-2); }
.btn-sm { padding: 5px 12px; font-size: var(--fs-12); }
.btn:focus-visible { outline: none; box-shadow: var(--ring-focus); }

.input { width: 100%; padding: 8px 10px; background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-2); font-family: var(--font-body); font-size: var(--fs-13);
  color: var(--text); outline: none; box-sizing: border-box; }
.input:focus { border-color: var(--border-strong); box-shadow: 0 0 0 3px var(--accent-soft); }
.input--error { border-color: var(--error); }
.input--error:focus { box-shadow: 0 0 0 3px var(--error-soft); }

.host-card { display: flex; gap: 12px; padding: 14px; background: var(--surface-2); border-radius: var(--radius-3); }
.host-icon { width: 36px; height: 36px; display: flex; align-items: flex-start; justify-content: center;
  color: var(--accent); flex-shrink: 0; }
```

## What to Avoid

- ❌ Onboarding 加「默认 Provider」radio 或「隐私授权」步——都已移除（硬编码 deepseek；PRIV 全砍）。
- ❌ 编辑态把全局选项与表单同屏铺——窄面板独占更好（D-26 实现偏离设计稿字面，是对的）。
- ❌ 表单 footer 两按钮 gap 用 8px——UAT 已改 16px。
- ❌ 内置 Provider 放开 name/baseUrl——必须 disabled（model 槽可改）。
- ❌ model 下拉留原生箭头——`appearance:none` + `.select-caret` 自绘。
- ❌ host-card 用微软官方 logo 进生产（版权）——线上用 Lucide host-icon；官方 SVG 仅原型用。

## Origin

- 线上：`src/styles.css` 上述各段；`src/components/Settings/` + `Onboarding/`。
- 设计稿：`sources/design-package/README.md` §1-2（Onboarding）+ §5-6（Settings Browse/Edit）+ §4a（ConfigBanner）+ §State Management（Provider migration 逻辑）。
- UAT/实现决策：footer gap 16px；编辑态独占；齿轮先进浏览页（修 event-as-anchor bug）。
