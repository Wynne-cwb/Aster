---
plan_number: "02"
title: "证据归档目录脚手架 + MANIFEST.md 初始化"
phase: 0
wave: 1
depends_on: []
files_modified:
  - .planning/spikes/MANIFEST.md
  - .planning/spikes/001-cors-verify/findings.md
  - .planning/spikes/002-ppt-writeback/findings.md
  - .planning/spikes/003-storage-scope/findings.md
  - .planning/spikes/004-deepseek-multimodal/findings.md
  - .planning/spikes/005-api-mixing/findings.md
  - .planning/spikes/006-getselectedslides-order/findings.md
  - .planning/spikes/007-pdfjs-production-build/findings.md
  - .planning/spikes/008-pptx-text-extraction/findings.md
  - .planning/spikes/009-bundle-size-baseline/findings.md
  - .planning/spikes/010-sideload-checklist/findings.md
autonomous: true
requirements: []
estimated_duration: "1 hour"
must_haves:
  goal: "10 个 spike 子目录 + findings.md 模板全部就位，后续 spike executor 直接填充，不需要创建目录结构"
  truths:
    - ".planning/spikes/MANIFEST.md 存在，包含 10 行 spike 条目，状态均为 PENDING"
    - "10 个子目录 001-cors-verify ... 010-sideload-checklist 均存在"
    - "每个子目录含 findings.md，模板结构为：# {Spike Name} — PENDING / ## 场景 / ## 测试步骤 / ## 实测结果 / ## 证据 / ## 决策"
    - "MANIFEST.md 表格格式可被 Phase 7 REL-05 regression 对照使用"
threat_model:
  threats:
    - id: T-00-02-01
      description: "findings.md 证据截图中意外包含 API Key 明文"
      mitigation: "findings.md 模板含明确注意事项：截图前 mask API Key；视频录制时不展示 Authorization header"
---

<objective>
创建 Phase 0 证据归档结构：10 个 spike 子目录 + findings.md 模板 + 顶层 MANIFEST.md。

Purpose: 所有后续 spike executor（Wave 2-4）在开始验证前已有写入目标，避免每次验证时重新创建目录。MANIFEST.md 是 Phase 7 REL-05 regression 的直接对照物。

Output:
- `.planning/spikes/MANIFEST.md`（10 行条目表格）
- 10 个子目录，每个含 `findings.md` 模板
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md

决策出处：
- D-09（证据归档位置：`.planning/spikes/00X-{slug}/`，含 findings.md + 顶层 MANIFEST.md）
- D-10（全部 commit 公开）
- ROADMAP.md §Phase 0 Success Criteria 1-5（10 项验收清单）
- ROADMAP.md §Phase 7 REL-05（Phase 0 spike 作为 regression 重跑）
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建顶层 MANIFEST.md</name>
  <files>.planning/spikes/MANIFEST.md</files>
  <read_first>
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-09（归档格式规格）
    - .planning/ROADMAP.md §Phase 0 Success Criteria（10 项验收内容）
    - .planning/ROADMAP.md §Phase 7（REL-05 回归重跑引用此 MANIFEST）
  </read_first>
  <action>
创建 `.planning/spikes/MANIFEST.md`，内容如下。每行条目对应一个 spike，状态初始为 PENDING。
Phase 7 REL-05 回归测试时将直接对照此文件更新状态。

```markdown
# Aster Phase 0 Spike — 证据归档清单

**Phase 0 时间盒：** ≤ 1 周（2026-05-26 开始）
**GATING 规则：** #1/#2/#3 任一 FAIL → 停止，写 GATING-FAILED-{N}.md，不进 Phase 1

此清单由 Phase 7 REL-05 regression 直接使用——所有项在 v1.0 发布前需重跑一次并全部 PASS。

## 状态说明

- `PENDING`：尚未执行
- `PASS`：验证通过，证据完整
- `FAIL`：验证失败，决策备忘已写
- `SKIP`：已有已知 fallback，不止损

---

## Spike 清单

| # | Slug | 简述 | GATING | 状态 | 详情 |
|---|------|------|--------|------|------|
| 1 | 001-cors-verify | 从生产 https Task Pane 直连 DeepSeek + aihubmix，流式 chat + 生成一张图 | ✅ GATING | PENDING | [详情](001-cors-verify/findings.md) |
| 2 | 002-ppt-writeback | PPT for Web insertSlidesFromBase64 + 插图 + 替换文本，Edge + Chrome 视频证据 | ✅ GATING | PENDING | [详情](002-ppt-writeback/findings.md) |
| 3 | 003-storage-scope | 三宿主 partitioned localStorage：文档 A 写 Key，文档 B 同账号同浏览器可读 | ✅ GATING | PENDING | [详情](003-storage-scope/findings.md) |
| 4 | 004-deepseek-multimodal | deepseek-v4-pro 发 image_url content block，判断是否原生多模态 | 非 GATING | PENDING | [详情](004-deepseek-multimodal/findings.md) |
| 5 | 005-api-mixing | setSelectedDataAsync × PowerPoint.run 混用挂死（#5022）验证 + workaround | 非 GATING | PENDING | [详情](005-api-mixing/findings.md) |
| 6 | 006-getselectedslides-order | getSelectedSlides() 反序 bug (#3618) workaround：按 index 排序 | 非 GATING | PENDING | [详情](006-getselectedslides-order/findings.md) |
| 7 | 007-pdfjs-production-build | Vite 生产构建 pdf.js worker 独立文件，加载 5MB PDF，不在 localhost | 非 GATING | PENDING | [详情](007-pdfjs-production-build/findings.md) |
| 8 | 008-pptx-text-extraction | jszip + DOMParser ~80 行从 pptx 提取 &lt;a:t&gt; 文本，3 个真实 pptx 文件 | 非 GATING | PENDING | [详情](008-pptx-text-extraction/findings.md) |
| 9 | 009-bundle-size-baseline | Vite + React 19 + Fluent UI v9 + Zustand + react-markdown 初始 bundle ≤ 1MB | 非 GATING | PENDING | [详情](009-bundle-size-baseline/findings.md) |
| 10 | 010-sideload-checklist | 三宿主 + Edge/Chrome + 全新 profile sideload manifest 走通 | 非 GATING | PENDING | [详情](010-sideload-checklist/findings.md) |

---

## GATING 决策记录

_由 Wave 3 checkpoint（Plan 06）填写_

| GATING | 结果 | 决策文件 |
|--------|------|----------|
| #1 CORS | — | — |
| #2 PPT 写回 | — | — |
| #3 存储 scope | — | — |

**整体 GATING 结论：** PENDING（三项全 PASS 后填写 `PROCEED`；任一 FAIL 填写 `ABORT — 修订 PRD`）

---

_最后更新：Wave 5 收尾后_
```
  </action>
  <acceptance_criteria>
    - 文件存在：`ls .planning/spikes/MANIFEST.md` 返回 0
    - 包含 10 行 spike 条目：`grep -c '| PENDING |' .planning/spikes/MANIFEST.md` 返回 ≥ 10
    - 含 GATING 标记：`grep -c '✅ GATING' .planning/spikes/MANIFEST.md` 返回 3
    - 含三个子目录链接：`grep -c '001-cors-verify/findings.md' .planning/spikes/MANIFEST.md` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'PENDING' .planning/spikes/MANIFEST.md | grep -E '^1[0-9]$|^[1-9]$'</automated>
  </verify>
  <done>MANIFEST.md 存在，10 行条目均含 PENDING 状态，3 行含 GATING 标记</done>
</task>

<task type="auto">
  <name>Task 2：创建 10 个 spike 子目录及 findings.md 模板</name>
  <files>
    .planning/spikes/001-cors-verify/findings.md,
    .planning/spikes/002-ppt-writeback/findings.md,
    .planning/spikes/003-storage-scope/findings.md,
    .planning/spikes/004-deepseek-multimodal/findings.md,
    .planning/spikes/005-api-mixing/findings.md,
    .planning/spikes/006-getselectedslides-order/findings.md,
    .planning/spikes/007-pdfjs-production-build/findings.md,
    .planning/spikes/008-pptx-text-extraction/findings.md,
    .planning/spikes/009-bundle-size-baseline/findings.md,
    .planning/spikes/010-sideload-checklist/findings.md
  </files>
  <read_first>
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-09（findings.md 模板建议：场景/步骤/实测结果/证据链接/pass-fail/备注）
    - .planning/ROADMAP.md §Phase 0 Success Criteria（每项验收的具体内容）
  </read_first>
  <action>
为每个 spike 子目录创建 findings.md，模板结构一致，但 GATING 项（#1-3）加注 GATING 字样。

**findings.md 通用模板格式（每个文件首行必须匹配 `# {Spike Name} — PENDING`）：**

---

为 10 个子目录分别创建 findings.md，内容如下（GATING 项额外加标记）：

**001-cors-verify/findings.md**：
```markdown
# CORS 验证（Spike #1）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-1.md，项目进入 PRD 修订状态

## 场景

从生产 https Task Pane（GitHub Pages URL）直连 `api.deepseek.com` 与 `api.aihubmix.com`。
验证浏览器 fetch 是否获得 `Access-Control-Allow-Origin` 响应头。

## 测试步骤

1. sideload spike manifest 到 PPT for Web
2. 打开 Task Pane（spike/cors-test.html）
3. 输入 DeepSeek API Key（dev/test key，小额度）
4. 触发流式 chat completion 请求，观察 DevTools Network → 响应头
5. 触发 aihubmix 生图请求，观察响应头
6. 录屏 + 截图响应头（注意：截图前确认 Authorization header 不可见）

## 实测结果

<!-- 填写时间：Day 1-2 -->

DeepSeek CORS 状态：
- Access-Control-Allow-Origin: （待填）
- 流式 chat completion 是否成功：（待填）

aihubmix CORS 状态：
- Access-Control-Allow-Origin: （待填）
- 生图请求是否成功：（待填）

## 证据

- [ ] 录屏：`recording.mp4`（>100MB 走 GitHub Release）或 GIF
- [ ] DeepSeek 响应头截图：`deepseek-response-headers.png`
- [ ] aihubmix 响应头截图：`aihubmix-response-headers.png`

> ⚠ 安全提示：截图前确认 Authorization header 不在可见区域，或已 redact

## 决策

**结果：** PENDING

**PASS 条件：** DeepSeek + aihubmix 均返回 `Access-Control-Allow-Origin: *` 或匹配 Pages 源，
流式 chat 跑通，生图请求成功

**FAIL 行动：**（仅在 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-1.md`
- 启动 D-06 CORS fallback：Cloudflare Worker 代理路线
- 项目进入 PRD 修订状态，不进 Phase 1
```

**002-ppt-writeback/findings.md**：
```markdown
# PPT 写回（Spike #2）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-2.md，项目进入 PRD 修订状态

## 场景

在 PPT for Web（Edge + Chrome 各一次）验证三个写回操作：
1. `insertSlidesFromBase64` 插入含文本的新 slide
2. 在选中 slide 上插入图片（`slide.shapes.addImage` 或同等 API）
3. 替换 slide 上的文字内容

## 测试步骤

1. sideload spike manifest 到 PPT for Web
2. 场景一：调用 insertSlidesFromBase64，验证新 slide 出现且含文本
3. 场景二：选中特定 slide，插入图片，验证图片出现在目标 slide
4. 场景三：读取 slide 文字，替换为新文字，验证显示更新
5. 每个场景录屏
6. 同时 smoke-test Plan B：setSelectedDataAsync(html, {coercionType: Html})

## 实测结果

<!-- 填写时间：Day 1-2 -->

**场景一（insertSlidesFromBase64）：**
- Edge：（待填）
- Chrome：（待填）

**场景二（选中 slide 插图）：**
- Edge：（待填）
- Chrome：（待填）

**场景三（替换文本）：**
- Edge：（待填）
- Chrome：（待填）

**Plan B smoke test（setSelectedDataAsync html）：**
- 结果：（待填）

## 证据

- [ ] 场景一录屏（Edge）
- [ ] 场景一录屏（Chrome）
- [ ] 场景二录屏（Edge）
- [ ] 场景二录屏（Chrome）
- [ ] 场景三录屏（Edge 或 Chrome）

## 决策

**结果：** PENDING

**PASS 条件：** 三个场景在 Edge + Chrome 均端到端成功

**PARTIAL PASS 条件（降级）：** 主路径部分不可用时，Plan B setSelectedDataAsync(html) 可作为替代方案——此时 PRD R1 降级路径激活，记录在此

**FAIL 行动：**（仅在所有路径均 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-2.md`
- 评估 PRD PPT killer 场景范围缩减
```

**003-storage-scope/findings.md**：
```markdown
# 存储 scope 验证（Spike #3）— PENDING

> ✅ **GATING**：FAIL 时写 GATING-FAILED-3.md，项目进入 PRD 修订状态

## 场景

在三宿主（PPT / Excel / Word for Web）分别测试 partitioned localStorage 行为：
- 文档 A 写 Key → 打开文档 B（同账号同浏览器）→ Key 仍可读
- 换浏览器（Edge → Chrome）→ Key 丢失（符合预期）
- 清除浏览器数据 → Key 丢失（符合预期）

验证 `Office.context.partitionKey` 的实际值与预期行为一致。

## 测试步骤

1. 在 PPT for Web 文档 A sideload spike manifest
2. 通过 Task Pane 写入 localStorage：`localStorage.setItem('aster-test-key', 'test-value-' + Date.now())`
3. 打开 PPT for Web 文档 B（同账号同浏览器）
4. 验证 localStorage 中 'aster-test-key' 的值
5. 在 Excel for Web 与 Word for Web 重复步骤 1-4
6. 测试跨浏览器：Edge 写入，Chrome 中同账号打开，验证 Key 不存在

## 实测结果

<!-- 填写时间：Day 1-2 -->

**PPT 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填 key 是否可读）
- partitionKey 值：（待填）

**Excel 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填）
- partitionKey 值：（待填）

**Word 宿主：**
- 文档 A → 文档 B 同账号同浏览器：（待填）
- partitionKey 值：（待填）

**跨浏览器测试：**
- Edge 写入 → Chrome 读取：（待填，预期 key 不存在）

## 证据

- [ ] 三宿主测试截图（DevTools Console 显示 localStorage 读取结果）
- [ ] 跨浏览器测试截图

## 决策

**结果：** PENDING

**PASS 条件：** 三宿主均确认文档间共享 localStorage（同 origin、同 browser），跨浏览器则丢失
PRD AC6 描述更新为实测行为

**FAIL 行动：**（仅在 FAIL 时填写）
- 当天写 `.planning/spikes/GATING-FAILED-3.md`
- 评估替代存储方案
```

**004-deepseek-multimodal/findings.md**（非 GATING）：
```markdown
# DeepSeek-V4 多模态验证（Spike #4）— PENDING

> 非 GATING：FAIL 时锁定 aihubmix 为唯一视觉路径，不止损

## 场景

对 `deepseek-v4-pro` 发送含 `image_url` content block 的请求，判断官方 API 是否原生多模态。

## 测试步骤（D-11 三步法）

1. 读 DeepSeek API 文档 + change log（15 分钟）
2. 构造请求：POST https://api.deepseek.com/chat/completions
   - model: deepseek-v4-pro
   - messages: [{role: user, content: [{type: text, text: "描述这张图片"}, {type: image_url, image_url: {url: "data:image/png;base64,..."}}]}]
3. 观察响应：200 + 合理描述 = PASS；4xx = FAIL

## 实测结果

API 文档确认：（待填）
实际请求响应状态：（待填）
响应内容摘要：（待填）

## 证据

- [ ] 请求/响应 JSON 截图（mask Authorization header）
- [ ] API 文档相关截图（若有多模态说明）

## 决策

**结果：** PENDING

**PASS：** PRD Q6/R2 关闭，deepseek-v4-pro 可作为视觉路径之一
**FAIL：** 锁定 aihubmix 为 v1 唯一多模态路径（D-12 推迟默认 routing 决策到 Phase 2）
```

**005-api-mixing/findings.md**（非 GATING）：
```markdown
# Office.js API 混用挂死验证（Spike #5）— PENDING

> 非 GATING：FAIL 时记录 workaround，不止损

## 场景

验证 Office.js bug #5022：setSelectedDataAsync × PowerPoint.run 混用后，
第二次 context.sync() 是否无限挂死。

## 测试步骤

1. 在 PPT Task Pane 执行：PowerPoint.run → setSelectedDataAsync(image/html) → 再次 PowerPoint.run
2. 记录第二次 context.sync() 的响应时间（>5s 则判定为 bug 触发）
3. 测试 workaround：每次 setSelectedDataAsync 之后插入 `await new Promise(r => setTimeout(r, 0))`

## 实测结果

Bug 是否能稳定重现：（待填）
第二次 sync 响应时间：（待填）
Workaround 是否有效：（待填）

## 证据

- [ ] DevTools Performance 截图（显示 sync 阻塞时长）

## 决策

**结果：** PENDING

**记录 workaround**（Phase 4 PPT adapter 设计参考）
```

**006-getselectedslides-order/findings.md**（非 GATING）：
```markdown
# getSelectedSlides 反序 workaround（Spike #6）— PENDING

> 非 GATING：FAIL（bug 仍存在）时确认 sort-by-index workaround，不止损

## 场景

验证 Office.js bug #3618：PPT for Web getSelectedSlides() 是否返回反序结果。
验证 workaround：对结果按 slide.index 排序后是否正确。

## 测试步骤

1. 在 PPT for Web 选中多张 slide（如 slide 3, 5, 7）
2. 调用 getSelectedSlides()，打印返回顺序
3. 对比用户选择顺序与 API 返回顺序
4. 应用 sort-by-index workaround，确认顺序正确

## 实测结果

原始返回顺序：（待填）
预期顺序：（待填）
Bug 是否可复现：（待填）
Workaround 有效：（待填）

## 证据

- [ ] DevTools Console 截图（显示返回顺序对比）

## 决策

**结果：** PENDING
```

**007-pdfjs-production-build/findings.md**（非 GATING）：
```markdown
# pdf.js 生产构建 worker（Spike #7）— PENDING

> 非 GATING：FAIL 时记录替代方案，不止损

## 场景

在 Vite 生产构建模式下（非 dev），pdf.js worker 正确加载并解析 5MB PDF。
在 GitHub Pages（非 localhost）测试。

## 测试步骤

1. 在 spike/ 创建 pdf-test.html，动态 import pdfjs-dist
2. 使用 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` 设置 workerSrc
3. 运行 vite build，检查 worker 文件是否在 dist 中
4. 部署到 GitHub Pages，加载 5MB PDF，提取文本
5. 记录是否出现 "Setting up fake worker" 警告

## 实测结果

生产构建 worker 文件存在：（待填）
Worker 加载成功：（待填）
5MB PDF 解析成功：（待填）
Pitfall 7 的 `?url` 导入问题是否出现：（待填）

## 证据

- [ ] vite build 输出截图（worker 文件名）
- [ ] DevTools Network 截图（worker 加载请求）
- [ ] PDF 解析成功截图（提取文本片段）

## 决策

**结果：** PENDING

**PASS：** Phase 3 使用 `new URL(..., import.meta.url)` 模式（非 `?url` import）
**FAIL 时 workaround：** 记录替代加载方式
```

**008-pptx-text-extraction/findings.md**（非 GATING）：
```markdown
# pptx 文本提取（Spike #8）— PENDING

> 非 GATING：FAIL 时可将 pptx 列入"不支持上传"，不止损

## 场景

用 jszip + DOMParser ~80 行代码从真实 pptx 文件提取 <a:t> 文本节点。
目标：提取全部 slide 的文本内容，无需第三方 pptx 库。

## 测试步骤

1. 在 spike/ 创建 pptx-extract.html
2. 实现 80 行以内的 jszip + DOMParser 提取逻辑
3. 用 3 个真实 pptx 文件测试（简单 / 含表格 / 含图注）
4. 记录提取质量（文本完整性 vs 原始 pptx 内容）

## 实测结果

提取代码行数：（待填，目标 ≤ 80 行）
pptx 文件 1（简单）：（待填）
pptx 文件 2（含表格）：（待填）
pptx 文件 3（含图注）：（待填）

## 证据

- [ ] 提取代码截图或文件
- [ ] 三个 pptx 的提取结果对比截图

## 决策

**结果：** PENDING

**PASS：** Phase 3 使用 jszip + DOMParser 方案，无需第三方 pptx 库
**FAIL：** pptx 上传列入不支持（PRD R3 原始降级路径）
```

**009-bundle-size-baseline/findings.md**（非 GATING）：
```markdown
# Bundle-size 基线（Spike #9）— PENDING

> 非 GATING：FAIL（>1MB）需识别原因，不止损

## 场景

Vite + React 19 + Fluent UI v9 + Zustand + react-markdown + remark-gfm 的初始 bundle 大小。
目标：gzipped ≤ 300KB（硬限 ≤ 1MB raw）。

## 测试步骤

1. 在 spike/ 创建 bundle-test/ 子目录，初始化最小 Vite + React 19 项目
2. 安装 @fluentui/react-components + zustand + react-markdown + remark-gfm
3. 仅引入用到的组件（Button, Input, Drawer — Pitfall 6 barrel import 警告）
4. 运行 vite build --mode production
5. 使用 npx vite-bundle-visualizer 或 rollup-plugin-visualizer 生成报告
6. 记录 index.js 原始大小 + gzip 大小

## 实测结果

index.js 原始大小：（待填）
gzip 大小：（待填）
主要体积占比：（待填，如 Fluent UI XX KB、React XX KB）

## 证据

- [ ] vite build 输出截图
- [ ] bundle visualizer 报告截图

## 决策

**结果：** PENDING

**PASS 条件（gzipped ≤ 300KB）：** Phase 1 bundle-size CI gate 以此为基线
**FAIL（>1MB raw）：** 识别罪魁祸首，在 Phase 1 实施 tree-shaking 修复
```

**010-sideload-checklist/findings.md**（非 GATING）：
```markdown
# Sideload checklist（Spike #10）— PENDING

> 非 GATING：FAIL 时记录具体阻塞步骤，不止损

## 场景

在三宿主（PPT / Excel / Word for Web）× 两浏览器（Edge / Chrome）× 两个 profile（全新 profile + 现有 profile）
sideload manifest.xml，确认 Task Pane 可正常打开。

## 测试步骤

1. 下载 spike/manifest.xml
2. 打开 PPT for Web（edge 全新 profile）→ 插入 → 获取加载项 → 上传我的加载项 → 选择 manifest.xml
3. 确认 Aster ribbon 按钮出现，点击打开 Task Pane，确认 index.html 加载成功
4. 对 Excel / Word / Chrome / 现有 profile 重复步骤 2-3（6 个组合）
5. 记录每个组合的结果

## 实测结果

| 宿主 | 浏览器 | Profile | 结果 |
|------|--------|---------|------|
| PPT | Edge | 全新 | PENDING |
| PPT | Chrome | 全新 | PENDING |
| Excel | Edge | 全新 | PENDING |
| Excel | Chrome | 全新 | PENDING |
| Word | Edge | 全新 | PENDING |
| Word | Chrome | 全新 | PENDING |

## 证据

- [ ] 6 个组合的截图（至少 PPT + Edge 全新 profile 一张）

## 决策

**结果：** PENDING

**PASS 条件：** ≥ 4/6 组合成功（至少 PPT + Excel + Word × Edge 通过）
**FAIL 时：** 记录具体错误信息，反馈到 Phase 7 sideload 文档优先级
```

executor 需要为以上 10 个文件分别创建对应目录并写入内容。
  </action>
  <acceptance_criteria>
    - 10 个子目录均存在：`ls .planning/spikes/ | grep -c '^0'` 返回 ≥ 10
    - 10 个 findings.md 均存在：`find .planning/spikes -name 'findings.md' | wc -l` 返回 ≥ 10
    - 每个 findings.md 首行格式正确：`grep -l 'PENDING' .planning/spikes/*/findings.md | wc -l` 返回 ≥ 10
    - GATING 三项含 GATING 标记：`grep -l 'GATING' .planning/spikes/00[123]-*/findings.md | wc -l` 返回 3
    - 001 子目录存在：`ls .planning/spikes/001-cors-verify/findings.md` 返回 0
    - 010 子目录存在：`ls .planning/spikes/010-sideload-checklist/findings.md` 返回 0
  </acceptance_criteria>
  <verify>
    <automated>find .planning/spikes -name 'findings.md' | wc -l</automated>
  </verify>
  <done>10 个 spike 子目录已创建，每个含填写模板的 findings.md；GATING 三项（001/002/003）含 GATING 标记</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| findings.md → public GitHub repo | 证据文件全部公开，截图需 mask Key |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-02-01 | Information Disclosure | findings.md 截图 | mitigate | 每个 findings.md 模板含"截图前 mask API Key"注意事项 |
| T-00-02-02 | Information Disclosure | MANIFEST.md | accept | MANIFEST 只含状态和链接，无 Key 信息 |
</threat_model>

<verification>
整体验证（Wave 1 完成后）：
1. `find .planning/spikes -name 'findings.md' | wc -l` 返回 10
2. `grep -c '✅ GATING' .planning/spikes/MANIFEST.md` 返回 3
3. `.planning/spikes/001-cors-verify/findings.md` 首行为 `# CORS 验证（Spike #1）— PENDING`
</verification>

<success_criteria>
- .planning/spikes/MANIFEST.md 存在，10 行条目，3 项 GATING 标记
- 10 个 findings.md 存在，模板结构统一，GATING 项有免责说明
- 每个 findings.md 首行匹配 `# {名称} — PENDING`
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-02-SUMMARY.md`，包含：
- 归档目录结构树（`find .planning/spikes -type f`）
- MANIFEST.md 路径
- findings.md 路径列表
</output>
