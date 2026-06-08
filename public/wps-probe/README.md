# Aster WPS 探针

**用途：** Phase 30 WPS 兼容性 go/no-go 验证工具。在 Windows WPS 桌面专业版真机上运行，验证 WPS CEF 环境是否支持 Aster 核心功能（React 19 + SSE 直连 + localStorage 持久 + JSAPI read/write/undo）。

> **这是一次性 throwaway 验证工具，不是 Aster 产品功能。**
> 探针代码独立于 Aster `src/` 主仓，不 import 任何 Aster 模块，不引 office.js CDN。

---

## 文件结构

```
wps-probe/
├── index.html          # Task Pane 入口（探针 UI，含 Key 输入框 + 运行按钮）
├── probe.js            # 所有检查函数 + ribbon 回调 + 报告生成器
├── ribbon.xml          # WPS 功能区定义（onLoad="OnAddinLoad" 入口 + 按钮）
├── jsplugins.xml       # 在线 sideload 配置（指向 GitHub Pages 部署路径）
└── README.md           # 本文件
```

部署：源码位于 Aster 仓库的 `public/wps-probe/`。Vite 构建（`npm run build`）会把 `public/` 原样拷进 `dist/`，GitHub Pages 部署后把探针暴露为 `https://wynne-cwb.github.io/Aster/wps-probe/`。

---

## 安装（Windows WPS 专业版）

### 路径 A：oem.ini 在线模式（推荐）

1. 找到 WPS 安装目录下 `office6\cfgs\oem.ini`（通常在 `C:\Program Files (x86)\WPS Office\<版本号>\office6\cfgs\`）
2. 用**管理员身份**的记事本打开 `oem.ini`
3. 在 `[wps]` 段下添加一行：
   ```
   JSPluginsServer=https://wynne-cwb.github.io/Aster/wps-probe/jsplugins.xml
   ```
4. 保存，**完全退出 WPS**，重启 WPS
5. 打开金山表格（ET）或金山演示（WPP），功能区出现「**Aster 探针**」标签

### 路径 B：联系 Claude 获取方案（备用）

> 若路径 A 因专业版 oem.ini 安全限制无效，使用此路径。

1. 截图路径 A 失败现象（oem.ini 内容 + WPS 版本号 + 功能区截图）
2. 将截图 + 失败描述发给 Claude（在当前对话中）
3. Claude 将据真机现象产出 `publish.html` 或 `wpsjs publish` 安装方案
   > `publish.html` 需要真机调试才能可靠；在路径 A 失败现象明确前提前生成意义不大。

---

## 使用

> ⚠️ **务必用「新建空白文件」跑探针，不要在含重要数据的文档上运行。**
> 探针会临时写 Excel 的 B1 单元格（跑完自动还原原值）、在 PPT 临时插一张幻灯片（跑完自动删除）。虽有还原逻辑，但真机行为未最终验证，**请只在新建的空白表格 / 空白演示上运行，避免任何数据风险。**

1. 点击功能区「Aster 探针」→「打开探针面板」
2. 在 Task Pane 中填写 **DeepSeek API Key（必填）**，可选填 aihubmix/Pexels Key
3. 点击「**▶ 运行所有检查**」，等待约 15-30 秒
4. 检查完成后点「**📋 复制结果报告**」
5. 将报告粘贴回贴给 Claude，驱动 go/no-go 裁定

**建议分别在金山表格和金山演示各跑一次**（两宿主 JSAPI 独立验证）。

---

## 安全说明

- API Key 仅用于探针期间的网络请求 Authorization header，函数执行后即释放
- Key **不写入** localStorage（localStorage 仅存探针哨兵值 `wps-probe-<timestamp>`，与 Key 无关）
- Key **不出现**在生成的结果报告文本中
- 探针直连 DeepSeek/aihubmix/Pexels，无 Aster 自有服务器中转（Core Value：无后台）

---

## 完整真机验证清单

详见 [`.planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md`](../../.planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md)。

---

*Phase 30 — Aster v2.5「登陆 WPS（滩头堡）」*
