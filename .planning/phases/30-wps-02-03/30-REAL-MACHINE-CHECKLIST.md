# Phase 30 真机验证清单

**版本：** v1.0（2026-06-08）
**用途：** 用户在 Windows WPS 桌面专业版真机上照单执行，完成后复制结果报告给 Claude 驱动 go/no-go 裁定。
**分工：** Claude 在 Mac 已准备好探针代码并部署到 GitHub Pages；用户在 Windows WPS 真机上执行。

> 🔴 **两条 make-or-break 生死线（始终串行，任一挂 → 整体 NO-GO）：**
> 1. CEF Chromium 版本 ≥ 80 + React 19 特性可用
> 2. DeepSeek SSE 直连不被 WPS 容器 CSP/CORS 拦截
>
> **两条生死线是独立硬门，不可用宿主通过来抵消。**

> 📍 **探针部署 URL（已坐实可达，见文末「部署说明」）：** `https://wynne-cwb.github.io/Aster/wps-probe/`

---

## 第 0 步：前置准备

> 开跑前必须完成，否则第二条生死线无法测试。

- [ ] **准备 DeepSeek API Key（必填）：** 登录 [platform.deepseek.com](https://platform.deepseek.com)，复制 `sk-` 开头的 API Key 备用。
  > ⚠️ 无 DeepSeek Key = make-or-break #2 无法测试 = 无法得出 go/no-go 裁定
- [ ] **准备 aihubmix API Key（选填）：** 登录 [aihubmix.com](https://aihubmix.com)，复制 API Key 备用。（图片直连验证用，非阻塞 bonus）
- [ ] **准备 Pexels API Key（选填）：** 登录 [pexels.com/api](https://www.pexels.com/api)，复制 API Key 备用。（图片直连验证用，非阻塞 bonus）
- [ ] 确认当前 Windows 机器上已安装 WPS Office **专业版**（非个人版）。

---

## 第 1 步：安装探针加载项（sideload）

> 探针部署在 `https://wynne-cwb.github.io/Aster/wps-probe/`。
> 安装有两条路径：**路径 A（推荐）** 和 **路径 B（备用）**，先尝试路径 A。

### 路径 A：oem.ini 在线模式（推荐）

- [ ] 找到 WPS 安装目录（通常在 `C:\Program Files (x86)\WPS Office\<版本号>\office6\cfgs\`），打开 `oem.ini` 文件（用记事本以**管理员身份**运行）。
  > 提示：若找不到 oem.ini，可右键 WPS 快捷方式 → 属性 → 打开文件位置 → 向上找 `office6\cfgs`
- [ ] 在 `oem.ini` 的 `[wps]` 段（若无此段则新建）下添加一行：
  ```
  JSPluginsServer=https://wynne-cwb.github.io/Aster/wps-probe/jsplugins.xml
  ```
- [ ] 保存 oem.ini，**完全关闭 WPS**（任务栏右键退出，不只是关窗口）。
- [ ] 重新打开 WPS，打开任意**表格（ET）**或**演示（WPP）**文件。
  > 探针加载 et + wpp 两宿主（金山文字不探）
- [ ] 确认功能区出现「**Aster 探针**」标签页。

> ⚠️ **若路径 A 无效（专业版 oem.ini 安全限制）：**
> - 现象：功能区没有「Aster 探针」标签
> - 解决：切换路径 B（见下）

### 路径 B：Path A 失败时联系 Claude（备用）

> Path A（jsplugins.xml/oem.ini）可能在专业版上失败——失败表现尚不明确，需真机现象驱动。

- [ ] 若路径 A 无效（功能区无「Aster 探针」标签），**不要尝试访问未知 URL**。
- [ ] **截图路径 A 的失败现象**（oem.ini 文件内容、WPS 版本号、功能区截图）。
- [ ] 将截图 + 失败描述**发给 Claude**，Claude 将据真机现象产出 `wps-probe/publish.html` 或 `wpsjs publish` 安装方案。
  > ℹ️ `publish.html` 本身需要真机调试才能可靠，在路径 A 失败现象明确前提前生成意义不大。

> ⚠️ 若路径 A 失败且不确定原因，先把 WPS 版本号截图发给 Claude，协助诊断后再继续。

---

## 第 2 步：打开探针面板 + 填入 Key

- [ ] 在功能区点击「**Aster 探针**」标签 → 点击「**打开探针面板**」大按钮，Task Pane（侧边任务栏）打开。
- [ ] 在探针 Task Pane 的「**DeepSeek API Key（必填）**」输入框中，填入前面准备好的 DeepSeek Key（`sk-` 开头）。
- [ ] （可选）在「**aihubmix Key（选填）**」输入框中填入 aihubmix Key。
- [ ] （可选）在「**Pexels Key（选填）**」输入框中填入 Pexels Key。

---

## 第 3 步：运行所有检查（按钮自动执行）

- [ ] 点击探针面板中的「**▶ 运行所有检查**」按钮。
- [ ] 等待所有检查项自动运行完成（约 15-30 秒，含 DeepSeek SSE 网络请求）。
- [ ] 观察每个检查项的 pass（绿色）/ fail（红色）/ skip（灰色）状态。

**探针自动执行的检查项清单：**

| # | 检查项 | 说明 | 计入 go/no-go |
|---|--------|------|--------------|
| 1 | make-or-break #1：CEF Chromium 版本 | 解析 navigator.userAgent + 特性探测 | ✅ 生死线 #1 |
| 2 | make-or-break #2：DeepSeek SSE 直连 | fetch POST api.deepseek.com，读首 token | ✅ 生死线 #2 |
| 3 | localStorage 当前会话写入 | setItem + 回读验证 | 辅助 |
| 4 | localStorage 跨会话持久（⚠️ 需手动步骤，见第 4 步） | 关 WPS 重开后回读 | ✅ WPS-02 第③项 |
| 5 | 字体/teal CSS 渲染 | Inter/Noto Sans SC/JetBrains Mono 加载 + #009887 色 | 辅助（WPS-06 信号） |
| 6 | 图片直连（非阻塞 bonus） | aihubmix b64_json + Pexels 检索 | ❌ 不计入 go/no-go |
| 7 | Excel JSAPI read/write/undo | 读选区/A1值/工作表，写 B1+回读，undo，PivotCaches 存在性 | ✅ JSAPI 覆盖门槛 |
| 8 | PPT JSAPI read/write/undo | 读幻灯片数/形状文本，AddSlide+回读，undo，D-03 三项存在性 | ✅ JSAPI 覆盖门槛 |

> 🔴 **注意：** 若 make-or-break #1 失败，探针会显示「NO-GO，后续检查跳过」并停止运行。若 #1 通过但 #2 失败，同样停止。**两条生死线串行，任一失败即整体 NO-GO。**

---

## 第 3.5 步：在两个宿主分别运行（首宿主 D-03 裁定必需）

> go/no-go 只需 Excel 或 PPT 其一绿，但 D-03 首宿主（Excel vs PPT）裁定需要**两宿主的数据**。

- [ ] **在金山表格（ET）文件中运行一次「运行所有检查」**：
  1. 打开或新建一个金山表格（`.et` 或 `.xlsx`）文件
  2. 点击功能区「Aster 探针」→「打开探针面板」→ 填入 DeepSeek Key
  3. 点击「▶ 运行所有检查」，等待完成
  4. 点击「📋 复制结果报告」，**将报告文本暂存到记事本**
- [ ] **在金山演示（WPP）文件中运行一次「运行所有检查」**：
  1. 打开或新建一个金山演示（`.ppt` 或 `.pptx`）文件
  2. 点击功能区「Aster 探针」→「打开探针面板」→ 重新填入 DeepSeek Key
  3. 点击「▶ 运行所有检查」，等待完成
  4. 点击「📋 复制结果报告」，**将报告文本暂存到记事本**

> ℹ️ 两次报告都需要回贴给 Claude（见第 6 步）。go/no-go 只需其一绿，但**首宿主 Excel-vs-PPT 裁定需要两宿主的 D-03 数据**，缺一则裁定依据不完整。

---

## 第 4 步：localStorage 跨会话持久性验证（本质手动项）

> 这是唯一无法用按钮自动完成的验证：「关 WPS 重开」是用户物理操作，按钮无法触发。

- [ ] 第 3 步的「运行所有检查」完成后，检查项 #3（localStorage 当前会话写入）应显示 ✅ PASS。
  > 若 #3 FAIL，说明 localStorage 在 WPS CEF 中**无法写入**，直接记录 FAIL 并告知 Claude（go/no-go 受影响）。
- [ ] **完全关闭 WPS**：右键任务栏 WPS 图标 → 退出，或任务管理器确认 WPS 进程已结束（不只是关窗口）。
- [ ] 重新打开 WPS，打开任意**表格（ET）**或**演示（WPP）**文件。
- [ ] 点击功能区「Aster 探针」→「打开探针面板」→ 再次点击「**▶ 运行所有检查**」。
  > ℹ️ Key 需要重新填写（Key 不存储在 localStorage，每次都需重填）
- [ ] 观察检查项 #4（localStorage 跨会话持久）：
  - ✅ **PASS**：显示「跨会话持久，读到：wps-probe-XXXXXXXXXX」→ localStorage 持久性已坐实
  - ❌ **FAIL**：显示「未读到上次写入的值」→ 记录 FAIL（WPS-06 存储方案需调整）

---

## 第 5 步：DevTools 辅助验证（补充证据，可选）

> 探针「▶ 运行所有检查」按钮已能自动判定 SSE 是否被 CORS/CSP 拦截（检查项 #2）。
> DevTools Network 面板是**补充诊断证据**——若检查项 #2 PASS 可跳过此步；若 FAIL，此步有助于确认原因。

**打开 Task Pane 的 DevTools：**
- [ ] 点击探针 Task Pane 内部（使其获得鼠标焦点）。
- [ ] 按 **F12** 打开 Task Pane 的 DevTools。
  > ⚠️ ALT+F12 打开的是加载项主入口（ribbon 运行环境）的 DevTools，不是 Task Pane 的。
  > 若 F12 无效（部分 2025 版本 12.1.0.21541 有此问题），尝试在 oem.ini 的 `[support]` 段加 `JsApiShowWebDebugger=true`，重启 WPS。

- [ ] 切到 **Network** 面板。
- [ ] 点击「▶ 运行所有检查」按钮，观察 Network 面板中 `api.deepseek.com` 的请求：
  - ✅ **PASS**：看到 `text/event-stream` 响应类型，HTTP 200
  - ❌ **FAIL（CORS 拦截）**：看到 `blocked by CORS policy` 错误
  - ❌ **FAIL（CSP 拦截）**：Console 面板看到 `Refused to connect to 'https://api.deepseek.com'`

---

## 第 6 步：复制结果报告

- [ ] 所有检查完成后，探针面板底部出现「📋 复制结果报告」按钮。
- [ ] 点击「**📋 复制结果报告**」，确认按钮变为「✅ 已复制！」。
- [ ] 将剪贴板内容**粘贴回贴给 Claude**（在当前对话中直接粘贴）。
  > Claude 收到报告后将据此产出：go/no-go 最终裁定 + 首宿主数据（Excel vs PPT）+ Phase 31-33 适配工作量细化

---

## go/no-go 裁定框架（30-D-02）

收到结果报告后，Claude 将按以下框架裁定：

**综合裁定 = 两生死线绿 AND (Excel 基础读写撤销绿 OR PPT 基础读写撤销绿)。**

```
裁定条件（全部满足 = GO）：

  [必须] make-or-break #1 CEF_VERSION = PASS
    AND
  [必须] make-or-break #2 DEEPSEEK_SSE = PASS
    AND
  [任一] EXCEL_JSAPI = PASS（Excel 基础 read/write/undo 全通过）
       OR PPT_JSAPI = PASS（PPT 基础 read/write/undo 全通过）

以上任一条件不满足 = NO-GO
  → 里程碑干净收口在 Phase 30，不写任何适配代码
  → Phases 31-33 全部取消

注：两条 make-or-break 生死线始终是独立硬门，不可被 JSAPI 宿主通过来抵消。
    IMAGE_DIRECT 不计入 go/no-go（非阻塞 bonus，30-D-04）。
```

### 首宿主裁定判据（D-03，仅 go 时适用）

报告中 D-03 四项用于裁定 Excel vs PPT 谁做首宿主：

| D-03 项 | 判据用途 |
|---------|---------|
| PPT copy_slide（3-1）PASS | PPT 倾向加分 |
| PPT AddTable（3-6）PASS | PPT 倾向加分 |
| PPT AddLine（3-7）PASS | PPT 倾向加分 |
| Excel PivotTable（3-5）PASS | Excel 倾向加分 |

**裁定原则：** 若 PPT 三项 D-03 中 ≥2 项 PASS → 倾向 PPT；否则倾向 Excel（JSAPI 15 核心操作全有文档化路径，风险最低）。最终首宿主由 Phase 32 开工前的 discuss-phase 裁定锁定。

---

## 常见问题 FAQ

**Q: 功能区没有出现「Aster 探针」标签怎么办？**
A: ① 确认 oem.ini 修改正确（路径 A），重启 WPS；② 若专业版 oem.ini 受限，截图失败现象发给 Claude，Claude 将产出路径 B 安装方案（见第 1 步路径 B）；③ 确认 WPS 版本 ≥ 11.8.2（社区最低版本参考）。

**Q: 点「运行所有检查」后立即显示 make-or-break #1 FAIL？**
A: 说明 WPS 内嵌 Chromium 版本过旧（< 80）。把报告复制给 Claude，crv（chromiumVersion）值即为实际版本号。

**Q: DeepSeek SSE 检查 FAIL，但 Key 确实正确？**
A: 极可能是 WPS 容器 CSP/CORS 拦截了直连请求。打开 DevTools（F12）看 Network 面板，找 `api.deepseek.com` 请求的错误信息，截图 + 报告一起发给 Claude。这是「里程碑 no-go」的核心判据。

**Q: Excel 和 PPT 检查均在当前宿主跑？**
A: 不是——探针设计为在任意宿主打开均可运行，但 JSAPI 检查会自动跳到「当前打开的宿主」。若在金山表格开启，`checkExcelJSAPI()` 能正常执行；`checkPptJSAPI()` 会因 `ActivePresentation` 不存在而失败（FAIL 预期）。建议各在自己的宿主分别运行一次：① 在金山表格（ET）打开探针跑一次 → ② 在金山演示（WPP）打开探针再跑一次。

**Q: 我没有 aihubmix/Pexels Key，图片直连那项会影响 go/no-go 吗？**
A: 不影响。图片直连（IMAGE_DIRECT）是非阻塞 bonus（30-D-04），不计入 go/no-go 裁定。跳过或 FAIL 均不阻断。

---

## 部署说明（给 Claude/维护者，非用户操作步骤）

探针静态文件源码位于 Aster 仓库的 **`public/wps-probe/`** 目录（不是仓库根的 `wps-probe/`）。

**原因：** Aster 的 GitHub Pages 部署（`.github/workflows/pages.yml`）只上传 Vite 构建产物 `dist/`。Vite 会把 `public/` 目录下的内容原样拷贝到 `dist/` 根。因此 `public/wps-probe/*` → 构建后落在 `dist/wps-probe/*` → 部署后由 Pages 暴露为：

```
https://wynne-cwb.github.io/Aster/wps-probe/            (index.html)
https://wynne-cwb.github.io/Aster/wps-probe/jsplugins.xml
https://wynne-cwb.github.io/Aster/wps-probe/probe.js
https://wynne-cwb.github.io/Aster/wps-probe/ribbon.xml
```

此机制零修改 CI、零修改 vite.config、不进 Aster 主 JS bundle（静态资源不计入 size-limit）。已用 `npm run build` 本地构建坐实 `dist/wps-probe/` 内五个文件均生成。

---

*清单版本：Phase 30 v1.0 — 2026-06-08*
*依据：30-CONTEXT.md 决策 30-D-01..04 / 30-RESEARCH.md 事实 #1-12 / 30-VALIDATION.md §Validation Architecture*
