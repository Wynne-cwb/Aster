# Requirements: Aster — Milestone v2.4 扩疆域

**Defined:** 2026-06-05
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 代理能力，能完成绝大部分文档工作；无后台、BYO Key、纯浏览器直连。

**里程碑目标：** 一手扩「能改的范围」（C 工具补全高价值子集），一手探「能跑的平台」（WPS 桌面版 spike-gate 探路），并打通「配置可移植」（导入导出，跨电脑/跨宿主搬家）。

> **REQ-ID 续接历史编号**（WORD/EXCEL/PPT 接 v2.1 的 01~10/08，NFR 接 v2.3 的 11）。WPS / CFG 为本里程碑新类别。

---

## v2.4 Requirements

本里程碑承诺交付的需求。每条映射到 roadmap 一个 phase。

### C · 工具补全 — Word（延续 v2.1 WORD-01~05）

> 全部按既有 write 工具合约：inverse 收 **Record 对象**（非位置参，Phase 5 教训）+ 新 PostStateSnapshot kind + 中文 humanLabel + `operationLog.integration.test` 守门 + 入 `*_TOOLS` Set（casing 归一化）。

- [ ] **WORD-06**: 用户能让 agent 给选中/指定文字加**高亮底色**（`font.highlightColor`），并可撤销
- [ ] **WORD-07**: 用户能让 agent 把段落转成**项目符号 / 编号列表**（`paragraph.startNewList` / `List`），并可撤销
- [ ] **WORD-08**: 用户能让 agent 给指定文字**插入批注**（`Range.insertComment`，WordApi 1.4），并可撤销
- [ ] **WORD-09**: 用户能让 agent 编辑**页眉 / 页脚**文字（`Section.getHeader/getFooter`），并可撤销
- [ ] **WORD-10**: 用户能让 agent **编辑已有表格**单元格内容（`edit_table`：定位行列 + 改文字），并可撤销

### C · 工具补全 — Excel（延续 v2.1 EXCEL-01~10）

- [ ] **EXCEL-11**: 用户能让 agent **合并 / 取消合并单元格**（`Range.merge/unmerge`），并可撤销
- [ ] **EXCEL-12**: 用户能让 agent **删除区域内重复行**（`Range.removeDuplicates`，ExcelApi 1.9），并可撤销
- [ ] **EXCEL-13**: 用户能让 agent **创建数据透视表**（`Worksheet.pivotTables.add`，ExcelApi 1.8），并可撤销。⚠️ **plan-phase 必验 Office for Web 可用性**（API 复杂）；不可用则诚实降级（noop+gate）

### C · 工具补全 — PPT（延续 v2.1 PPT-01~08）

- [ ] **PPT-09**: 用户能让 agent 在幻灯片**插入表格**。⚠️ **plan-phase 必验 PowerPoint JS API 表格支持**（网页版可能不支持原生建表）；不可用则诚实降级 / fallback（如用形状网格模拟或明确拒绝）
- [ ] **PPT-10**: 用户能让 agent 添加**线条 / 箭头连接符**（`ShapeCollection.addLine`，PowerPointApi 1.4），并可撤销。⚠️ plan-phase 验网页版可用性
- [ ] **PPT-11**: 用户能让 agent 给形状设**渐变填充**。⚠️ **plan-phase 必验 ShapeFill 渐变支持**（可能只支持纯色 setSolidColor）；不可用则诚实降级为纯色或拒绝

### D · WPS 兼容 — spike-gate 探路（新类别，本里程碑只出可行性裁定，不承诺全量适配）

> 目标平台 = **WPS Windows 桌面版**（中文职场装机量最大形态）。两层 spike：调研层（Claude 跑）+ 真机验证层（用户在 Windows+WPS 跑）。

- [ ] **WPS-01**: 团队能拿到一份 **WPS 加载项可行性调研报告**（Claude 出）：WPS 是否支持 Office.js manifest、`PowerPoint.run`/`Excel.run`/`Word.run` 兼容程度、sideload 机制、已知限制、社区证据 → 初步 go/no-go 信号 + 真机验证清单
- [ ] **WPS-02**: 团队能拿到 **WPS 真机验证结果 + spike-gate 最终裁定**（用户在 Windows+WPS 实际 sideload Aster manifest）：三宿主 `run()` API 实测跑通/跑挂清单 → go/no-go 裁定；若 go 则附适配工作量估算（适配本身不在本里程碑执行，留单独 milestone 决策）

### 配置 · 导入导出 — 可移植（新类别）

> 解「换电脑 / 换浏览器 / 换宿主重输地狱」（partitioned localStorage 是 per-origin，PowerPoint/Word/Excel 可能不同 origin）。载体 = JSON 文件下载/上传（复用 v2.2 FILE 上传基建）。安全姿态 = **明文 + 醒目警告**（用户拍板）。

- [ ] **CFG-01**: 用户能在 Settings **一键导出全部持久化配置为 JSON 文件下载** —— 含 Provider 配置（baseURL/model/isBuiltIn）+ API keys + 默认 Provider + 附件/自动插入开关 + 用户偏好（PREF）+ 主题强调色 + Pexels key（**不含聊天历史**）
- [ ] **CFG-02**: 用户能在 Settings **上传 JSON 配置文件导入**到新机器/新浏览器/新宿主 —— 合并策略（保留现有 + 加入新的），同 id Provider **覆盖前确认**；非法/损坏 JSON 给可操作错误提示
- [ ] **CFG-03**: 导出/导入流程**醒目警告含明文 API key**（「此文件含明文密钥，请妥善保管、用完即删、勿通过不安全渠道传输」）—— Key 仅落用户自控本地文件，**不上传 Aster 服务器**（不违反无后台 / Key 不离开浏览器硬约束）

### 非功能（延续 v2.3 NFR-11）

- [ ] **NFR-12**: 初始 main bundle **维持 ≤82KB gzip CI gate**（v2.3 收于 81.3KB，**余量仅 ~0.7KB——很紧**）；新工具/配置导入导出/任何重模块必须懒加载；动 bundle 前先 `npm run build` 再 `npm run size`。undo 守门 / P95≤10s / Key 不上传 硬约束延续

---

## Deferred Requirements（已识别，本里程碑不做）

### C 工具补全剩余 ~25（后续里程碑继续 triage）

- Word 其余候选：插图（v2.2 已有 generate_word_image，此处指本地图）、文本框、脚注尾注、目录、分栏、样式集批量等
- Excel 其余候选：数据验证下拉、分类汇总、迷你图、命名区域、保护工作表、超链接、批注等
- PPT 其余候选：SmartArt（平台天花板，见 Out of Scope）、对象层级（置顶/置底）、组合/取消组合、对齐分布、母版编辑等

### 多模态 / 图库增强（v2.2 carry forward）

- **IMG-D1**: 多变体并排生成（4 选 1）
- **IMG-D2**: 图片编辑 / 局部重绘
- **LIB-D1**: Unsplash 备选图库（若 Pexels 中文质量/限额不足再评估）
- **VIS-D1**: DeepSeek-V4 原生多模态验证（扩用户/降本时重评）
- **FILE-D1**: pptx 高保真解析

### 配置导入导出增强

- **CFG-D1**: 口令加密导出（WebCrypto AES-GCM）—— 本里程碑选明文+警告，加密留按需
- **CFG-D2**: 字符串复制/粘贴载体（免文件落盘，跨 App 更顺手）
- **CFG-D3**: 选择性导出（勾选哪些 Provider / 不含 key 的骨架导出）

### WPS 后续（取决于 WPS-02 裁定）

- **WPS-D1**: 若 spike 判 go → WPS 桌面版完整兼容适配（manifest / sideload / API 差异处理）—— 独立 milestone

---

## Out of Scope

明确不做（本里程碑或永久排除）。

| Feature | Reason |
|---------|--------|
| WPS 全量兼容适配 | 本里程碑只做 spike-gate 可行性裁定；适配本身待 WPS-02 裁定后单独 milestone |
| WPS 网页版 / 移动版 | 本里程碑 spike 只验 Windows 桌面版（用户选定）；其它形态待裁定后评估 |
| 配置导出加口令加密 | 用户选明文+警告优先便利；加密留 CFG-D1 按需（无后台下加密=纯客户端 WebCrypto，可行但本轮不做） |
| 聊天历史导出 | 配置导入导出只搬配置，不搬对话数据（体积大、隐私、非配置） |
| PPT SmartArt / 动画 / 转场 / 套主题 / 读背景色 | Office.js 网页版平台天花板（建不了，非 bug） |
| Word 页边距 / 纸张大小 | Office.js 网页版平台天花板 |
| PPT 取选中图片 Preview API | 未 GA（Office for Web）→ 沿用 v2.2 fallback 引导上传 |
| Mac / iOS / Android 宿主 | v1 范围外延续；WPS 也只验 Windows 桌面版 |

---

## Traceability

各需求映射到哪个 phase。roadmap 创建时填充。

| Requirement | Phase | Status |
|-------------|-------|--------|
| WPS-01 | TBD | Pending |
| WPS-02 | TBD | Pending |
| WORD-06 | TBD | Pending |
| WORD-07 | TBD | Pending |
| WORD-08 | TBD | Pending |
| WORD-09 | TBD | Pending |
| WORD-10 | TBD | Pending |
| EXCEL-11 | TBD | Pending |
| EXCEL-12 | TBD | Pending |
| EXCEL-13 | TBD | Pending |
| PPT-09 | TBD | Pending |
| PPT-10 | TBD | Pending |
| PPT-11 | TBD | Pending |
| CFG-01 | TBD | Pending |
| CFG-02 | TBD | Pending |
| CFG-03 | TBD | Pending |
| NFR-12 | TBD | Pending |

**Coverage:**
- v2.4 requirements: 17 total（C 工具 11 + WPS spike 2 + 配置 3 + NFR 1）
- Mapped to phases: 0（roadmap 待创建）
- Unmapped: 17 ⚠️（roadmap 创建后清零）

---
*Requirements defined: 2026-06-05*
*Last updated: 2026-06-05 — Milestone v2.4「扩疆域」initial definition（/gsd-new-milestone）*
