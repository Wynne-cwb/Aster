# Requirements: Aster — v2.5「登陆 WPS（滩头堡）」

**Defined:** 2026-06-08
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 代理能力，能完成绝大部分文档工作；无后台、BYO Key、纯浏览器直连。
**Milestone Goal:** 在 WPS Windows 桌面专业版上真机验证可行性（go/no-go），并在通过的前提下建起第一个端到端跑通的单宿主 WPS 适配滩头堡，为后续三宿主完整移植（WPS-D1）铺路。

> **策略 = 证据优先分阶段。** WPS 真机验证（WPS-02/03）是**硬门**：若 make-or-break 门挂 → 里程碑 **no-go**，停在验证阶段，**不写任何适配代码**。WPS-04 及之后**全部以「验证 = go」为前提**。
> **依据：** `.planning/research/v2.5/SUMMARY.md` + `25-WPS-01-REPORT.md`（§5 真机清单）。

## v1 Requirements

本里程碑要交付的需求。每条映射到 roadmap phase（编号从 30 续接）。

### WPS 真机验证（硬门 — no-go 则里程碑停在此阶段）

- [ ] **WPS-02**: 团队能在 **Windows WPS 桌面专业版真机**坐实「运行时 + 无后台直连」两条 make-or-break 门 —— ① CEF 内核版本（`navigator.userAgent` + 特性探测）支持 `ReadableStream` / React 19（≥Chromium 80）；② 浏览器**直连 DeepSeek SSE**（BYO key）拿到 `text/event-stream`、**不被 WPS 容器 CSP/CORS 拦截**；③ `localStorage` 跨会话持久（关 WPS 重开仍在）。**前两项串行先行，任一挂即判 no-go**（无后台 Core Value 在 WPS 不成立）。
- [ ] **WPS-03**: 团队能拿到**目标宿主 WPS JSAPI 基础 read/write/undo 真机可行性** + **D-03 桌面增益探测**结果，并据此产出 **go/no-go 最终裁定 + 首宿主数据（Excel vs PPT）+ 适配工作量细化**。写操作均含写后回读验证（坐实 WPS JSAPI 是否静默 no-op）；undo 验证确认 `operationLog` 反向引擎为唯一可行路径（WPS 无原生程序化撤销）。

### WPS 加载项外壳与复用层（条件：WPS 验证 = go）

- [ ] **WPS-04**: 用户能在 **WPS 桌面打开 Aster Task Pane** —— `wpsjs` 加载项外壳（`ribbon.xml` 功能区 + `jsplugins.xml`/`oem.ini` sideload + `index-wps.html`（**不引 office.js CDN**）+ Vite 多入口 `main-wps.tsx`），通过 GitHub Pages 在线 sideload 在真机加载成功。
- [ ] **WPS-05**: Aster 在 WPS 内能**正确识别当前宿主** —— `main-wps.tsx` 用 `OnAddinLoad` + `window.Application.ComponentType`（替代 `Office.onReady`/`Office.context.host`）路由到对应 `createWpsAdapter(type)`；接缝上方（agent loop / store / UI）零改动。
- [ ] **WPS-06**: 复用层在 WPS CEF 内**真机无降级跑通** —— React 19 UI + teal 设计系统正常渲染、SSE 直连 Provider 流式输出、API Key 经 `localStorage`（`partitionKey===undefined` 降级分支）跨会话存活、中文字体（Inter/Noto Sans SC/JetBrains Mono）正常加载。

### 单宿主滩头堡 adapter（条件：go；宿主 Excel vs PPT 待 discuss-phase 裁定）

- [ ] **WPS-07**: AI 能在 WPS 选定宿主内**读取文档上下文** —— 选定宿主（Excel 金山表格 / PPT 金山演示，由 WPS-03 真机数据 + discuss-phase 裁定）的 read 操作（取选区 / 读结构 / 读值文本）经 WPS JSAPI（`window.Application.*`，async-IPC）实现并真机跑通。
- [ ] **WPS-08**: AI 能在 WPS 选定宿主内**改文档并一键撤销** —— write 操作 + **完整 inverse（`operationLog` 反向引擎移植）**；inverse 收 Record 对象签名（Phase 5 教训沿用）；每个 write 配 `assertWriteResult()` 写后回读守门（防 WPS 静默 no-op）；WPS 版 `operationLog.integration.test` 守门。

### 端到端与收口（条件：go）

- [ ] **WPS-09**: 用户能在 WPS 真机完成**一个完整 killer scenario** —— 选定宿主一个多步 agent loop 场景端到端跑通（AI 多步改文档 + 失控可暂停 + 一键 undo all 全回滚），真机 UAT PASS。
- [ ] **WPS-10**: WPS 滩头堡**诚实收口可分发** —— 非目标宿主 adapter 方法一律 `throw`（诚实「WPS-D1 预留」，不裸奔）+ WPS 入口 bundle 预算独立核算 + `wpsjs publish`/sideload 安装流程固化（真实 Windows 用户可装）+ 真机 UAT packet。

## v2 Requirements

延后到后续里程碑，已登记但不进本 roadmap。

### WPS 后续

- **WPS-D1**: WPS 三宿主**完整移植**（三个 adapter 全量 ~50+ 方法 + 三宿主对齐 + 全套 D-03 增益）—— 独立里程碑，量级 ≈ 再做一遍 v2.0+v2.1，待 v2.5 滩头堡验证单宿主可行后启动
- **WPS-D2**: WPS 网页版 / 移动版形态评估（本里程碑只验 Windows 桌面版）

### 配置增强（v2.4 carry）

- **CFG-D1**: 口令加密导出（WebCrypto AES-GCM）
- **CFG-D2**: 字符串复制/粘贴载体（免文件落盘）
- **CFG-D3**: 选择性导出（勾选 Provider / 不含 key 骨架）

### C 工具补全剩余 ~25（v2.4 carry）

- Word：文本框 / 脚注尾注 / 目录 / 分栏 / 样式集批量
- Excel：数据验证下拉 / 分类汇总 / 迷你图 / 命名区域 / 保护工作表 / 超链接 / 批注
- PPT：对象层级（置顶/置底）/ 组合取消组合 / 对齐分布 / 母版编辑

### 多模态 / 图库增强（v2.2 carry）

- **IMG-D1** 多变体并排 / **IMG-D2** 局部重绘 / **LIB-D1** Unsplash 备选 / **VIS-D1** DeepSeek 原生多模态 / **FILE-D1** pptx 高保真解析

### v2.3 follow-up

- **WR-02** `visual_check_slide` slideIndex 忽略 / **WR-03** 多预览面板 identity 守卫（quick-task，动 PPT 视觉自查时顺修；`todos/pending/`）

## Out of Scope

明确排除，防 scope creep。

| Feature | Reason |
|---------|--------|
| WPS 三宿主完整移植 | 本里程碑只建**单宿主滩头堡**；三宿主 = 独立 milestone WPS-D1（需先验证单宿主可行） |
| WPS 网页版 / 移动版 | 本里程碑只验 Windows 桌面版（用户装机环境）；其它形态待 WPS-D2 |
| WPS Mac 版 | 用户装机 = Windows 桌面版；WPS Mac 加载项支持未调研，不在本里程碑 |
| Office for Web 功能回归/新增 | 本里程碑聚焦 WPS 登陆；Office.js 主线（C 工具 / 配置增强）暂停，留后续 |
| 静默引入后台代理绕过 WPS CORS | 若 WPS 拦截直连，**不静默上后台**（违反无后台 Core Value）；fallback 需用户拍板（Cloudflare Worker 仅作 fail 时显式决策项，同 v2.2 M-1） |
| PPT SmartArt / 动画 / 转场 / 套主题 | 网页版平台天花板沿用；WPS 桌面或解锁但属 WPS-D1 范围 |
| AppSource / WPS 应用市场上架 | v1 仍仅 sideload + 开源仓库分发 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WPS-02 | Phase 30 | Pending |
| WPS-03 | Phase 30 | Pending |
| WPS-04 | Phase 31 | Pending（条件 go） |
| WPS-05 | Phase 31 | Pending（条件 go） |
| WPS-06 | Phase 31 | Pending（条件 go） |
| WPS-07 | Phase 32 | Pending（条件 go） |
| WPS-08 | Phase 32 | Pending（条件 go） |
| WPS-09 | Phase 33 | Pending（条件 go） |
| WPS-10 | Phase 33 | Pending（条件 go） |

**Coverage:**
- v1 requirements: 9 total（WPS-02..10）
- Mapped to phases: 9
- Unmapped: 0

---
*Requirements defined: 2026-06-08*
*Last updated: 2026-06-08 — Traceability confirmed by roadmapper（v2.5 roadmap created，Phase 30–33，9/9 mapped，0 orphan）*
