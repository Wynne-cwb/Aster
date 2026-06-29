# Aster WPS 版（滩头堡）— 安装与真机验证指引

> ⚠️ **当前状态：投机性代码草稿，真机验证 pending**（v2.5 Phase 30 真机门未过，STATE.md 2026-06-29 决策）。
> Phase 31-33 代码已写完并通过代码侧验证（tsc / build / 1143 tests），但 **WPS 真机一次都没跑过**。
> 本目录是让你在 Windows WPS 真机上一次性验证全部的安装包 + 测试脚本。

## 这装的是什么

- **Aster WPS 版 = 单宿主滩头堡**：**只有金山表格（Excel/ET）** 实现了 AI 读写 + 撤销。
- 金山文字（Word）/ 金山演示（PPT）：**故意不暴露任何工具**（诚实收口）——打开会显示"WPS-D1 预留"，不裸奔假装能用。
- 完整三宿主移植 = 后续独立里程碑 WPS-D1。

## 安装（两条路，二选一）

### 路径 A：oem.ini + jsplugins.xml（WPS 专业版）

1. 找到 WPS 安装目录的 `oem.ini`（通常 `C:\Users\<你>\AppData\Roaming\kingsoft\office6\` 或安装根目录）。
2. 加两行（与 publish 模式互斥，路径 A 用此组合）：
   ```ini
   JsApiPlugin=true
   JSPluginsServer=https://wynne-cwb.github.io/Aster/wps/jsplugins.xml
   ```
3. 完全退出并重启 WPS，打开金山表格 → 功能区出现「Aster」标签 →「打开 Aster」。

### 路径 B：publish.html 一键装（WPS 个人版 12.1.0.16910+，oem.ini 受限时用）

1. 浏览器打开 `https://wynne-cwb.github.io/Aster/wps/publish.html`。
2. 点加载项行的「安装」（首次弹"允许浏览器打开 WPS"→ 允许；按钮变「卸载」即成功）。
3. **publish 模式要求 `oem.ini` 里 `JsApiPlugin=false`**（与路径 A 互斥，二者只能启一个）。
4. 完全退出并重启 WPS，打开金山表格 → 「Aster」标签。

## 真机验证脚本（go/no-go 的关键证据，请按序跑并回贴结果）

> 这同时验证 Phase 30 的两条 make-or-break（CEF/React19、SSE 直连）——它们藏在「面板能打开 + AI 能回话」里。

1. **面板加载（Phase 31 SC-1/5）**：点「打开 Aster」→ 面板是否打开？teal 配色 + 中文字体是否正常（不乱码/不降级）？
2. **SSE 直连（Phase 30 #2 / Phase 31 SC-3，最高危）**：在设置里填 DeepSeek Key → 随便问一句 → **AI 是否流式吐字**？若转圈后报网络/CORS 错 → **no-go**（WPS 容器拦直连，整个无后台方案在 WPS 失效）。
3. **Key 持久（Phase 31 SC-4）**：完全退出 WPS 再开 → Key 是否还在（不用重填）？
4. **读（Phase 32 SC-1）**：表里随便填几行数据 → 让 AI「读一下当前选中区域 / 列出工作表」→ 返回值是否和表里一致？
5. **写 + 回读（Phase 32 SC-2）**：让 AI「在 A1 写入 123」→ 单元格是否真变（不静默无反应）？
6. **撤销（Phase 32 SC-3/4）**：让 AI 多步改几个格 → 点「全部撤销」→ 是否逐条逆序还原回原值？
7. **诚实收口（Phase 33）**：在金山演示（PPT）里打开 Aster → 是否显示无可用工具/「WPS-D1 预留」而非崩溃或假装能用？

把每步的 ✅/❌ + 截图回贴，我据此出 go/no-go 裁定 + 修真机暴露的 bug。

## 诚实边界（务必知情）

- **代码全是盲写**：WPS JSAPI 的 `Range.Value2`（单格标量/多格2D）、`Address`（`$A$1` 绝对格式）、错误语义都是据官方文档**推断**，没有真机校正过。第 4-6 步很可能暴露 VBA 细节不符 → 那正是要修的。
- **第 2 步是生死线**：SSE 直连一挂，后面 4-7 步都没意义，里程碑 no-go。请优先确认第 2 步。
- 安装文件本身（jsplugins.xml / publish.html / ribbon）线上可达性已验；**点「安装」后真机是否生效只有你的 Windows WPS 能证。**
