---
phase: 30
slug: wps-02-03
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-08
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
>
> ⚠️ **本 phase 性质特殊：** 交付物 = ① 一个 **throwaway `wpsjs` 探针加载项**（Mac 侧开发，不进 Aster 主仓 `src/`、不进主 bundle）+ ② 一份**用户照单跑的真机验证清单**。探针**没有传统自动化测试套件**——它本身就是验证仪器。真正的「验证」= 用户在 Windows WPS 桌面专业版真机上运行探针、复制结果报告回贴 → Claude 据此产出 go/no-go 裁定。因此本 VALIDATION 的核心是 **Mac 侧可在交付前自检的项**（构建产物存在性 / 探针脚本语法 / GitHub Pages 部署可达）+ **真机本质手动验证项**（探针执行结果）。详见 30-RESEARCH.md §Validation Architecture。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | none — 探针是 throwaway 工具，不引入 Vitest/Jest（30-RESEARCH §Validation Architecture「Wave 0 Gaps」明确：无 Wave 0 测试框架） |
| **Config file** | none |
| **Quick run command** | `node --check wps-probe/probe.js`（探针脚本语法自检，Mac 侧可跑）+ `npx -y wpsjs build`（产物构建，Mac 可跑，真机加载仅 Windows） |
| **Full suite command** | n/a — 完整「测试」= 用户真机执行探针并复制结果报告（intrinsically manual） |
| **Estimated runtime** | 语法/构建自检 ~10s；真机执行 ~10–20min（含关 WPS 重开的手动项） |

---

## Sampling Rate

- **After every task commit:** Mac 侧静态自检 —— `node --check` 探针脚本无语法错误 + 关键检查项函数（`checkCEFVersion` / `checkDeepSeekSSE` / 各 JSAPI 探测）存在（grep 可验）。
- **After probe build:** `wpsjs build` 产物（`wps-addon-build/` 或等价目录）生成无报错；`jsplugins.xml` URL 指向正确的 GitHub Pages 路径。
- **Before phase gate（go/no-go 裁定）:** 探针已 push + GitHub Pages 部署完成（线上可达，`curl -sI` 返回 200）；真机验证清单文档完整可勾选。
- **Phase gate（intrinsically manual）:** 用户在 Windows WPS 真机跑完探针 + 复制结果报告回贴。
- **Max feedback latency:** Mac 侧静态自检 < 15s；真机闭环由用户节奏决定。

---

## Per-Task Verification Map

> 探针检查项的 pass/fail 判定矩阵（来源：30-RESEARCH.md §Validation Architecture）。计入 go/no-go 的项已标注。Task ID 由 planner 在 PLAN 中分配后回填本表（planner 须保证下表每个「计入 go/no-go」检查项对应到至少一个 plan task）。

| 检查ID | 行为 | 验证方式 | 自动化？ | 最小可观测信号 | 计入 go/no-go |
|--------|------|---------|---------|-------------|--------------|
| CEF_VERSION | Chromium 版本≥80 且特性可用 | `navigator.userAgent` 解析 + `ReadableStream`/`fetch`/ES2020 特性探测 | 自动 | `chromiumVersion` 数字 + `hasReadableStream` bool | ✅ make-or-break #1（独立硬门） |
| DEEPSEEK_SSE | DeepSeek SSE 直连不被 CSP/CORS 拦 | fetch POST `stream:true` + 读 `text/event-stream` + 拿首 token | 自动 | `firstTokenSnippet` 非空 / `isSSE:true` | ✅ make-or-break #2（独立硬门） |
| LS_WRITE | localStorage 当前会话写入可用 | setItem + getItem 回读 | 自动 | `readback === written` | 辅助（WPS-06 信号） |
| LS_PERSIST | localStorage 跨会话持久 | 关 WPS 重开后再点按钮回读 | **本质手动** | `readback !== null` | ✅ 计入（WPS-02 第③项） |
| FONT_CSS | Aster 字体栈 + teal CSS 在 CEF 正常 | `document.fonts.check()` + 计算颜色 | 自动 | 字体加载 bool + teal 颜色 bool | 辅助（WPS-06 信号） |
| IMAGE_DIRECT | aihubmix(b64_json)/Pexels 图片直连 | fetch + 检查响应 ok | 自动 | HTTP 状态码 | ❌ 非阻塞 bonus（30-D-04） |
| EXCEL_JSAPI | Excel read/write/undo 可行（写后回读） | JSAPI 链式调用 + 写后立即回读对比 | 自动 | write/readback 对比 bool | ✅ JSAPI 覆盖门槛（Excel 或 PPT 其一即可） |
| PPT_JSAPI | PPT read/write/undo 可行（写后回读） | JSAPI 链式调用 + slide count 前后对比 | 自动 | slide count 前后对比 bool | ✅ JSAPI 覆盖门槛（Excel 或 PPT 其一即可） |
| D03_PPT_COPYSLIDE | `Slide.Copy`/`Duplicate` 存在 | `typeof === 'function'` | 自动（存在性） | bool | 首宿主裁定判据（不计 go/no-go） |
| D03_PPT_ADDTABLE | `Shapes.AddTable` 存在 | `typeof === 'function'` | 自动（存在性） | bool | 首宿主裁定判据 |
| D03_PPT_ADDLINE | `Shapes.AddLine`/`AddConnector` 存在 | `typeof === 'function'` | 自动（存在性） | bool | 首宿主裁定判据 |
| D03_EXCEL_PIVOT | `PivotCaches` 对象存在 / `PivotTable.Add` 签名 | `await wb.PivotCaches != null` | 自动（存在性） | bool | 首宿主裁定判据 |

*Status 由执行/真机回填: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**串行硬门顺序（30-D-02）：** `CEF_VERSION` FAIL → 输出「no-go，后续跳过」；`DEEPSEEK_SSE` FAIL → 输出「no-go，后续跳过」；两门均绿后其余检查方有意义。两门为**独立硬门**，不可被宿主绿抵消。

---

## Wave 0 Requirements

*无 Wave 0 测试基建。* 探针是 throwaway 工具，验证机制 = 真机执行结果报告本身（30-RESEARCH §Validation Architecture「Wave 0 Gaps」）。不引入 Vitest/Jest，不写单测。

Mac 侧可在交付前做的最低自检（非测试框架，是产物/语法门）：
- [ ] `node --check wps-probe/probe.js` 退出 0（探针脚本无语法错误）
- [ ] `wpsjs build` 产物生成（Mac 可构建；真机加载仅 Windows）
- [ ] `jsplugins.xml` 的 `url` 指向正确 GitHub Pages 探针路径
- [ ] 探针已 push + Pages 部署完成（线上可达，真机 sideload 拿到的是部署版）

---

## Manual-Only Verifications

> 真机步骤只能用户在 Windows WPS 桌面专业版上跑（Claude 在 Mac 无法代跑 —— 同 Office for Web 真机 UAT 分工）。以下为本质手动项；其余「自动」检查项虽由按钮自动执行，但**触发与观察仍发生在用户真机上**。

| 行为 | 检查ID / 需求 | 为何手动 | 验证步骤（清单须含图文） |
|------|----------|---------|----------------------|
| 整个探针套件执行 | 全部检查项 / WPS-02·03 | 真机环境只在用户 Windows WPS 上；Claude 无 Windows + WPS 专业版 | 用户开跑前填 DeepSeek key（必填）+ aihubmix/Pexels key（选填）→ 点功能区「运行所有检查」→ 复制结果报告回贴 |
| localStorage 跨会话持久 | LS_PERSIST / WPS-02 第③项 | 「关 WPS 重开」是用户物理操作，按钮无法自触发 | ①首次跑写入 → ②**完全退出 WPS**（任务栏退出，非最小化）→ ③重开 WPS 打开任意文件 → ④再点「运行所有检查」→ ⑤看 `LS_PERSIST` 是否 PASS |
| DeepSeek SSE 未被 CSP/CORS 拦（DevTools 补充证据） | DEEPSEEK_SSE / WPS-02 第②项 | 按钮已能自动判定；DevTools Network 面板是补充诊断证据 | ①点 Task Pane 获焦 → ②按 **F12**（主入口/ribbon 用 ALT+F12）→ ③Network 面板 → ④点「运行所有检查」→ ⑤找 `api.deepseek.com`：✅ 见 `text/event-stream`+200 / ❌ 见 `blocked by CORS policy` 或 `Refused to connect` |

---

## Validation Sign-Off

- [x] 每个「计入 go/no-go」检查项在 Per-Task Map 中有验证方式与最小可观测信号
- [x] 串行硬门顺序明确（CEF → SSE → 其余），两门为独立硬门
- [x] 本质手动项（LS_PERSIST、DevTools 辅助）有图文步骤，未强塞进按钮
- [x] Wave 0：throwaway 探针无测试框架，Mac 侧静态/产物自检替代
- [x] 无 watch-mode flags
- [x] `nyquist_compliant: true`（go/no-go 判据均有可观测信号；真机执行为合法的 manual-only 验证）

**Approval:** approved 2026-06-08
