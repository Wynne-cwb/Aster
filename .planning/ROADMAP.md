# Roadmap: Aster

**Created:** 2026-05-26
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。

来源：`PROJECT.md` + `REQUIREMENTS.md`（78 个 v1 需求）+ `research/SUMMARY.md` + `prds/2026-05-26-aster-office-addin/PRD.md`。

## Overview

Aster 的交付路径分 8 个阶段。Phase 0 是 ≤ 1 周硬时间盒的风险消减 spike——其前 3 项验收（CORS / PPT 写回 / 存储 scope）是 **GATING**，任意一项失败必须停下来修订 PRD。Phase 1 在 PRD 原范围之上扩大，必须把 `DocumentAdapter` 接口 + 三宿主骨架 + 类型化错误 + bundle-size CI 守卫 + i18n 脚手架 + Vitest 测试框架 + 生产托管 + 6 个 ribbon 占位一次到位，否则 Phase 2-6 没有可用底座。Phase 2 把 Provider 抽象、Onboarding、Settings、错误 UX、token 成本徽章和 SSE 流式打通——所有 AI 调用都从此处取齐。Phase 3 引入懒加载解析器与多模态文件路由。Phase 4（PPT）是参考实现，承担最大的宿主 API 风险；Phase 5（Excel）与 Phase 6（Word）建立在 Phase 4 验证过的模式之上，可并行执行。Phase 7 是收尾与 v1.0 发布——AC1-AC8 验收矩阵 + Phase 0 的 10 项 spike 作为回归重跑一次 + sideload 文档 + GitHub Release。

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Sequential dependency: Phase 0 → 1 → 2 → 3 → 4 → (5 ∥ 6) → 7。Phase 5 与 Phase 6 都仅依赖 Phase 4，可并行推进。

- [x] **Phase 0: Spike & 风险验证 (GATING)** - 1 周时间盒，10 项实证验收；前 3 项失败 = 停下来修订 PRD ✅ 2026-05-27 PROCEED
- [ ] **Phase 1: Foundation 与跨宿主骨架** - 脚手架 + manifest + Task Pane shell + DocumentAdapter 接口 + 三宿主 adapter 骨架 + 错误类层级 + bundle-size CI 守卫 + i18n + Vitest + 生产托管
- [ ] **Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX** - 一处通用的 OpenAI-compatible LLM 客户端 + aihubmix 视觉/生图 + partitioned localStorage Key 管理 + 首启 Onboarding + 8 类错误 UX + SSE 流式 + token 成本徽章
- [ ] **Phase 3: 文件上传 + 懒加载解析 + 多模态路由** - txt/md/csv/json 直读 + docx/xlsx/pdf/pptx/图片懒加载解析器 + MIME 校验 + 长内容截断提示 + 图片走视觉 Provider
- [ ] **Phase 4: PPT 杀手场景 (参考实现)** - 主题→大纲 + 选中 slide 配图 + bullet 压缩 + 2 个 ribbon 按钮；建立宿主 adapter 的参考模式供 Phase 5/6 复刻
- [ ] **Phase 5: Excel 杀手场景** - 自然语言→公式 + 公式解释/调修 + 数据清洗拆列 + 2 个 ribbon 按钮；严格遵循 two-sync / 批量写入 / untrack / batch 50 行规则
- [ ] **Phase 6: Word 杀手场景** - 多风格润色（含 grammar/spell）+ TL;DR + 大纲→长文 + 2 个 ribbon 按钮；样式保留写回
- [ ] **Phase 7: Polish + v1.0 发布** - sideload README + 录屏 + Privacy doc + AC1-AC8 验收矩阵 + Phase 0 spike 回归 + v1.0 git tag + GitHub Release

## Phase Details

### Phase 0: Spike & 风险验证 (GATING)
**Goal**: 在 ≤ 1 周时间盒内对 10 项最高风险做实证验证，决定 PRD 与架构是否可以推进到 Phase 1。前 3 项（CORS / PPT 写回 / 存储 scope）是 GATING——任意一项 fail 必须停下来修订 PRD，不进 Phase 1。
**Depends on**: Nothing (first phase)
**Requirements**: (无 v1 需求直接交付——本阶段产出的是验收报告与决策；REL-05 在 Phase 7 把本阶段 10 项作为回归重跑)
**Success Criteria** (what must be TRUE):
  1. **GATING #1 CORS 已确认**：在生产 https Task Pane（非 localhost）从 sideloaded add-in 直连 `api.deepseek.com` 与 `api.aihubmix.com`——成功流式跑通一次 chat completion 并生成一张图片；屏幕录像与响应头证据归档
  2. **GATING #2 PPT Web 写回端到端可行**：在 PPT for Web（Edge + Chrome）实证 `insertSlidesFromBase64` 插入带文本的新 slide、在选中 slide 上插入图片、替换 slide 文本——每个场景一段视频证据；如失败，PRD R1 降级方案 `setSelectedDataAsync(html, {coercionType: Html})` 已验证可作为 Plan B
  3. **GATING #3 存储 scope 已验证**：在三宿主分别测试 partitioned localStorage（`Office.context.partitionKey`）——文档 A 写 Key，打开文档 B、同账号同浏览器，Key 仍可读；切浏览器/清缓存则丢失；PRD F5/AC6 描述已对齐
  4. **DeepSeek-V4 多模态结论**：对 `deepseek-v4-pro` 实际发一次带 `image_url` content block 的请求——若支持则 PRD Q6/R2 关闭；若不支持则锁定 aihubmix 视觉作为唯一多模态路径（fallback 已知，非 GATING）
  5. **其余 7 项实证完成**：API 混用挂死测试（#5022）、`getSelectedSlides()` 反序 workaround（#3618）、pdf.js 生产构建 worker、pptx jszip+DOMParser 80 行提文本、bundle-size 基线、manifest 在三宿主+Edge/Chrome+全新 profile sideload checklist——均有可复现脚本或视频
**Plans**: 11 plans
Plans:
- [x] 00-01-PLAN.md — GitHub Pages 托管 + GitHub Actions 自动部署
- [x] 00-02-PLAN.md — 证据归档目录脚手架 + MANIFEST.md 初始化
- [x] 00-03-PLAN.md — GATING #1 CORS 验证：生产 https Task Pane 直连 DeepSeek + aihubmix
- [x] 00-04-PLAN.md — GATING #2 PPT for Web 写回端到端验证（三场景 + Plan B）
- [x] 00-05-PLAN.md — GATING #3 存储 scope 验证：三宿主 partitioned localStorage
- [x] 00-06-PLAN.md — Wave 3 GATING 检查点：审阅三项结论，决定 proceed/abort
- [x] 00-07-PLAN.md — 非 GATING #4 DeepSeek-V4 多模态验证（D-11 三步法）
- [x] 00-08-PLAN.md — 非 GATING #5+#6 Office.js API 混用挂死 + getSelectedSlides 反序
- [x] 00-09-PLAN.md — 非 GATING #7+#8 pdf.js 生产构建 worker + pptx jszip 文本提取
- [x] 00-10-PLAN.md — 非 GATING #9+#10 Bundle-size 基线 + 三宿主 Sideload Checklist
- [x] 00-11-PLAN.md — Wave 5 收尾：MANIFEST.md 终稿 + REL-05 regression 起点固化

### Phase 1: Foundation 与跨宿主骨架
**Goal**: 一次性把项目骨架与跨宿主底座搭满——脚手架 + manifest + Task Pane shell + 三宿主 adapter 骨架（带工作的 `getSelection()`）+ 类型化错误 + bundle-size CI 守卫 + i18n + Vitest + 生产托管。本阶段必须可被 Phase 2-6 直接消费。
**Depends on**: Phase 0
**Requirements**: INSTALL-01, INSTALL-02, INSTALL-03, INSTALL-04, INSTALL-05, INSTALL-06, FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, PANE-01, NFR-01, NFR-04, NFR-05, NFR-06
**Success Criteria** (what must be TRUE):
  1. 用户在 Edge / Chrome 最新两版 sideload manifest 后，PPT for Web / Excel for Web / Word for Web 三宿主均能打开 Aster Task Pane、看到 350px 宿主感知的聊天布局（顶部上下文卡 + 中部聊天 + 底部输入），且 console 无 error（AC1）
  2. 每个宿主 ribbon 上看到 2 个 Aster 按钮（共 6 个占位），点击后 Task Pane 自动打开（暂不执行业务逻辑——业务功能由 Phase 4-6 上线）
  3. 在三个宿主里都能从 Task Pane 顶部上下文卡看到当前选中内容的描述（PPT：第 N 张 slide；Excel：选中区域地址；Word：选中文本字数）——证明 DocumentAdapter `getSelection()` 在三宿主真实可用
  4. **bundle-size CI 守卫在执行（不是只配了）**：CI 中初始 JS bundle >1MB 会让构建失败；当前基线低于 1MB，命中即可看到 PR 标红
  5. 项目从 GitHub Pages / Vercel 等生产托管发布，HTTPS + CSP + 图标 `Cache-Control: public, max-age=3600` 全部就位；README 已包含 sideload 步骤草稿
**Plans**: 6 plans
Plans:
- [ ] 01-01-PLAN.md — 脚手架基座：提升 spike 依赖栈 + Vite 接线 + Lingui scaffold
- [ ] 01-02-PLAN.md — 契约层：DocumentAdapter 接口 + discriminated unions + 错误类层级
- [ ] 01-03-PLAN.md — 三宿主 adapter 骨架（真实 getSelection）+ 工厂 + Vitest smoke test
- [ ] 01-04-PLAN.md — manifest 6 ribbon 按钮 + commands 入口（ShowTaskpane）
- [ ] 01-05-PLAN.md — Task Pane shell：host 分流 + 350px 三段布局 + 实时上下文卡
- [ ] 01-06-PLAN.md — bundle-size CI 守卫 + GitHub Pages 部署 dist/ + README sideload 草稿
**UI hint**: yes

### Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX
**Goal**: 一次性把所有"AI 调用进出口"建好——OpenAI-compatible LLM 客户端（DeepSeek + 用户自定义共用一份实现）+ aihubmix 视觉与生图 + ProviderRegistry 路由 + partitioned localStorage Key 管理 + 首启 Onboarding + 8 类错误 UX + SSE 流式 + token 成本徽章。Phase 3-6 的所有 AI 操作都走这里。
**Depends on**: Phase 1
**Requirements**: PROV-01, PROV-02, PROV-03, PROV-04, PROV-05, PROV-06, PROV-07, PROV-08, PROV-09, PROV-10, KEY-01, KEY-02, KEY-03, KEY-04, KEY-05, COST-01, COST-02, PANE-02, PANE-03, PANE-04, NFR-02, NFR-03
**Success Criteria** (what must be TRUE):
  1. 用户首次启动 Aster 时进入 2 步 Onboarding——第 1 步选默认 Provider 并填入 DeepSeek Key（必填）+ aihubmix Key（选填），同时看到"选中内容会发往 Provider"的隐私告知；第 2 步看到每宿主一张功能卡（PRD N5）
  2. 用户在 Task Pane 中发起一次对话，AI 输出**流式逐字渲染**且首 token ≤ 2s（DeepSeek 网络正常时）——满足 PRD F6/AC8；用户可在响应过程中点击"停止"按钮取消，且 Task Pane 隐藏时自动 abort，不再继续累计 token 费用
  3. AI 气泡下方显示"本次：N token · ¥X"成本徽章；DeepSeek 与 aihubmix 内置默认单价，自定义 Provider 可在 Settings 录入单价
  4. 用户在 Settings 中可新增 / 编辑 / 删除自定义 OpenAI-compatible Provider 与对应 Key；切换文档、切换 MS 账号（同浏览器），Key 不丢失；换浏览器或清缓存则需重填（与 KEY-05 一致）
  5. 8 类错误（KEY_INVALID / QUOTA / RATE_LIMIT / CONTEXT / NETWORK / FILTER / MODEL / IMAGE_QUOTA）发生时，UI 给出明确的中文 CTA——例如 401 显示"DeepSeek Key 无效，前往设置 →"而非"网络错误"（PRD AC4 / F7）；429 自动指数退避并尊重 `Retry-After`
  6. 用户点击 AI 输出下方的"插入到文档"按钮后，文本通过对应宿主 Adapter 正确写回（PANE-04 与 Phase 1 adapter 骨架打通——具体宿主场景在 Phase 4-6 上线）；聊天历史保留在内存，关闭 Task Pane 即清空
**Plans**: TBD
**UI hint**: yes

### Phase 3: 文件上传 + 懒加载解析 + 多模态路由
**Goal**: 用户可在 Task Pane 上传 txt/md/csv/json/docx/xlsx/pptx/pdf/图片九类文件并作为聊天上下文使用；解析库全部按需懒加载，不进入初始 bundle；图片走视觉 Provider 路径。
**Depends on**: Phase 2
**Requirements**: FILE-01, FILE-02, FILE-03, FILE-04, FILE-05, FILE-06, FILE-07, FILE-08, FILE-09
**Success Criteria** (what must be TRUE):
  1. 用户上传 docx / xlsx / pdf / pptx / 一张图片各一份，AI 都能基于其内容回答问题（图片走多模态，其余抽文本）（AC3）
  2. 上传不同类型文件时 DevTools Network 面板可见相应解析器 chunk（`parser-docx`, `parser-xlsx`, `parser-pdf`, `parser-pptx`）按需下载——初始 bundle 不包含；NFR-01 ≤1MB 维持不破线
  3. 上传 HEIC / BMP 图片时自动转 JPEG；>2MB 图片自动 resize 到 ≤1920px 再发送；伪造扩展名的 pptx 通过 ZIP 签名校验被拒绝（FILE-07/08）
  4. 上传超长 PDF（解析后超过 Provider context window）时，UI 给出"截断 / 切片 / 升级 Provider"三选一提示，而非默默截断或报错（FILE-09 / PRD R6）
  5. 在三宿主从 dev 模式与生产构建模式分别测试 pdf.js worker——均能正确加载并解析 5MB PDF（PRD Pitfalls #7 闭环）
**Plans**: TBD
**UI hint**: yes

### Phase 4: PPT 杀手场景 (参考实现)
**Goal**: 在 PPT for Web 跑通三个杀手场景与两个 ribbon 按钮——本阶段是**全部宿主 adapter 的参考实现**，Phase 5/6 复刻其架构与错误处理模式。最大 API 风险集中在此处一次性吸收。
**Depends on**: Phase 3
**Requirements**: PPT-01, PPT-02, PPT-03, PPT-04, PPT-05, PPT-06, PPT-07
**Success Criteria** (what must be TRUE):
  1. 用户点击 PPT ribbon 的"主题→大纲"按钮，输入主题文字，几秒内当前 PPT 中插入 N 张含标题 + 要点的新 slide（PPT-01 / PPT-04）
  2. 用户选中一张 slide，点击 ribbon 的"选中 slide 配图"按钮，Aster 给出生图（aihubmix `gpt-image-2`）+ 图库（Unsplash 或 Pexels，Phase 0 决出）两个候选；用户点击其一后图片插入到正确的目标 slide（PPT-02 / PPT-05 反序 workaround 已生效）
  3. 用户在 Task Pane 选中 slide 上的大段文字，输入指令"压缩为 bullet"，AI 输出 bullet 后点击"插入到文档"，原文字被替换为要点（PPT-03）
  4. 在同一 Task Pane 会话中连续触发多次 ribbon 操作——`PowerPoint.run` 不与 `setSelectedDataAsync` 混用，`context.sync()` 从未挂死超过 5 秒（绕过 #5022）
  5. 若 Phase 0 spike 判定 `insertSlidesFromBase64` 不可用，PPT-01 降级走 `setSelectedDataAsync(html, {coercionType: Html})` 在当前 slide 写入——但用户体感仍是"一键生成大纲"（降级方案已固化为代码路径）
**Plans**: TBD
**UI hint**: yes

### Phase 5: Excel 杀手场景
**Goal**: 在 Excel for Web 跑通三个杀手场景与两个 ribbon 按钮，复刻 Phase 4 已验证的 adapter 模式；严格遵循 Excel.run 性能纪律——two-sync 规则、`range.values = 2DArray`、`untrack()`、`suspendApiCalculationUntilNextSync`、数据清洗每 50 行一次 LLM 调用。
**Depends on**: Phase 4 (复刻参考实现；与 Phase 6 并行)
**Requirements**: XLS-01, XLS-02, XLS-03, XLS-04, XLS-05, XLS-06, XLS-07, XLS-08
**Success Criteria** (what must be TRUE):
  1. 用户点击 Excel ribbon 的"自然语言→公式"按钮，输入"算每个门店近 30 天均值"，得到含相对/绝对引用的 AVERAGEIFS 公式并可粘贴到当前单元格（XLS-01）
  2. 用户选中一个 `#REF!` 报错的公式，点击 ribbon 的"公式解释/调修"按钮，Aster 解释错在哪并给出修复建议；用户点"插入到文档"后正确公式写入选中单元格（XLS-02）
  3. 用户选中"地址"列，在 Task Pane 输入"拆分为省/市/区"，Aster 先在 Task Pane 中预览清洗结果（前若干行），用户确认后批量写回到原区域右侧——50 行一批分多次 LLM 调用，5000 行不会撞 DeepSeek 429（XLS-03 / XLS-08）
  4. 在 5000 行数据清洗场景下，Adapter 每次操作 ≤2 次 `context.sync()`、批量写入用 `range.values = 2DArray`、>100 proxy 时调用 `untrack()`、大写入前调用 `suspendApiCalculationUntilNextSync()`——单次操作端到端 P95 ≤ 10s（NFR-02）
**Plans**: TBD
**UI hint**: yes

### Phase 6: Word 杀手场景
**Goal**: 在 Word for Web 跑通三个杀手场景与两个 ribbon 按钮，包括 Word grammar/spell 检查（gap #1）作为"多风格润色"下拉的一个选项；样式保留写回——替换前捕获 `styleBuiltIn` + `font.*`，写入后重新应用。
**Depends on**: Phase 4 (复刻参考实现；与 Phase 5 并行)
**Requirements**: DOC-01, DOC-02, DOC-03, DOC-04
**Success Criteria** (what must be TRUE):
  1. 用户选中一段文字，点击 Word ribbon 的"多风格润色"按钮，从下拉里选择"严谨 / 口语化 / 简洁 / 抒情 / 检查语法拼写"五种之一——AI 输出后点击"插入到文档"替换选中文本（DOC-01）
  2. 用户选中长文，点击 ribbon 的"TL;DR"按钮，几秒内 Task Pane 中得到一段总结 + 5 条关键要点；用户可选择追加到光标处（DOC-02）
  3. 用户在 Task Pane 给标题 + 5 条要点，AI 流式生成多段落报告草稿；点击"插入到文档"在光标处一次性写入完整段落（DOC-03）
  4. 替换选中文本时，原文的 `Heading 1` / `Bold` / 字体大小等基本样式被保留——而不是默默被 `insertText("Replace")` 重置为默认样式（DOC-04 / PRD Pitfalls #13）
**Plans**: TBD
**UI hint**: yes

### Phase 7: Polish + v1.0 发布
**Goal**: 把所有面向用户的发布物 ship 齐——sideload 文档与录屏、Privacy doc、AC1-AC8 完整验收矩阵在 Edge + Chrome + fresh profile + 三宿主全部通过、Phase 0 spike 10 项实证作为 regression 重跑一次、v1.0 git tag + GitHub Release。
**Depends on**: Phase 5, Phase 6
**Requirements**: REL-01, REL-02, REL-03, REL-04, REL-05, REL-06, REL-07
**Success Criteria** (what must be TRUE):
  1. README 包含 30 秒 sideload 视频 + 动画 GIF + 完整指南；非技术用户照着走能在 5 分钟内完成 sideload 与首启 Onboarding（REL-01）
  2. v1.0 manifest 发布在 GitHub Release 页面（用户需下载本地 sideload——Office Web 不支持 load-from-URL）；Privacy doc 列明"哪些数据发往 Provider，哪些不会"（REL-02 / REL-03）
  3. PRD AC1-AC8 验收矩阵在 Edge + Chrome 最新两版 × 全新 profile × PPT/Excel/Word for Web 三宿主上全部通过——结果有表格记录（REL-04）
  4. Phase 0 的 10 项 spike 验收清单作为 regression 全部重跑一次并通过（REL-05）——证明上线版本未在任何已知风险点回退
  5. v1.0 git tag 已打、GitHub Release notes 已发布、当时的 GitHub stars / forks / open issues 已记录为基线供后续追踪（REL-06 / REL-07；遥测 SDK 不引入——成功指标只看 GitHub 信号）
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 0 → 1 → 2 → 3 → 4 → 5 ∥ 6 → 7（Phase 5 与 Phase 6 都仅依赖 Phase 4，可并行；Phase 7 依赖 5 与 6 全部完成）

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Spike & 风险验证 (GATING) | 11/11 | ✅ Complete (PROCEED) | 2026-05-27 |
| 1. Foundation 与跨宿主骨架 | 0/6 | Not started | - |
| 2. Provider 抽象 + Settings + Onboarding + 错误 UX | 0/TBD | Not started | - |
| 3. 文件上传 + 懒加载解析 + 多模态路由 | 0/TBD | Not started | - |
| 4. PPT 杀手场景 (参考实现) | 0/TBD | Not started | - |
| 5. Excel 杀手场景 | 0/TBD | Not started | - |
| 6. Word 杀手场景 | 0/TBD | Not started | - |
| 7. Polish + v1.0 发布 | 0/TBD | Not started | - |
