---
plan_number: "04"
title: "GATING #2 — PPT for Web 写回端到端验证（三场景 + Plan B）"
phase: 0
wave: 2
depends_on: ["01", "02"]
files_modified:
  - spike/ppt-writeback-test.html
  - .planning/spikes/002-ppt-writeback/findings.md
autonomous: false
requirements: []
estimated_duration: "4 hours"
must_haves:
  goal: "确认 PPT for Web insertSlidesFromBase64 + 插图 + 文本替换三场景端到端可行，并验证 Plan B"
  truths:
    - ".planning/spikes/002-ppt-writeback/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "findings.md 包含三个场景（insertSlidesFromBase64 / 插图 / 文本替换）的 Edge + Chrome 各自结论"
    - "findings.md 包含 Plan B setSelectedDataAsync(html) smoke test 结论"
    - "至少一段录屏或截图存在于 .planning/spikes/002-ppt-writeback/ 目录"
    - ".planning/spikes/MANIFEST.md Spike #2 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-04-01
      description: "spike PPT 写回代码混入 DocumentAdapter 抽象层（D-08 违规）"
      mitigation: "所有 PPT API 调用直接在 spike/ppt-writeback-test.html 内写，不创建 adapter 文件；代码在 spike/ 目录，不进 v1 代码树"
    - id: T-00-04-02
      description: "误用 @microsoft/office-js npm 包（已 deprecated）"
      mitigation: "spike HTML 文件只从 CDN 加载 Office.js；package.json 不安装 @microsoft/office-js"
---

<objective>
GATING #2：在 PPT for Web（Edge + Chrome）端到端验证三个 PPT 写回场景，
并 smoke-test Plan B（setSelectedDataAsync html coercion）。

Purpose: PPT for Web 写回 API 在 Office.js 中有已知 gap 和 bug（Pitfall 1）。
若主路径不可用，需要在 Phase 0 确认 Plan B 可作为有效 fallback，
否则 PPT killer 场景在 Phase 4 根本无法实现。

Output:
- `spike/ppt-writeback-test.html`（三场景测试页）
- `.planning/spikes/002-ppt-writeback/findings.md`（更新为 PASS/FAIL）
- 每个场景的录屏或截图（Edge + Chrome）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/research/PITFALLS.md

决策出处：
- ROADMAP.md §Phase 0 Success Criteria #2（PPT Web 写回，三场景 + Plan B）
- CONTEXT.md §D-04（gate-first）§D-05（GATING 止损规则）
- PITFALLS.md Pitfall 1（PPT Web 写回 parity，insertSlidesFromBase64 限制，图片插入非活跃 slide 的 gap）
- PITFALLS.md Pitfall 2（setSelectedDataAsync × PowerPoint.run 混用挂死 #5022）
- PITFALLS.md Pitfall 5（getSelectedSlides 反序 #3618）
- CLAUDE.md — Office.js CDN URL、三宿主 Host 声明

关键技术参考（执行前阅读）：
- `insertSlidesFromBase64` 需要 host pptx 模板的 base64（不是"从文字直接生成 slide 的 API"）
- 插图到非活跃 slide：`PowerPoint.run → slide.shapes.addImage`（preview API）
- 混用 setSelectedDataAsync + PowerPoint.run 会导致后续 context.sync() 挂死（#5022）
- getSelectedSlides() 返回反序（#3618），workaround = sort by slide.index
- Plan B：`setSelectedDataAsync(htmlString, {coercionType: Office.CoercionType.Html})`
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 PPT 写回测试页 spike/ppt-writeback-test.html</name>
  <files>spike/ppt-writeback-test.html</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 1（PPT 写回 gap 详情，具体 API 和 issue 号）
    - .planning/research/PITFALLS.md Pitfall 2（API 混用挂死，防范策略）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（代码丢弃式，不搭 DocumentAdapter）
    - CLAUDE.md §Office.js Integration（CDN URL，shared runtime 说明）
  </read_first>
  <action>
创建 `spike/ppt-writeback-test.html`，包含以下四个测试功能：

**场景一测试：insertSlidesFromBase64**
- 准备一个最小 pptx 模板的 base64 字符串（单空 slide，约 5KB）
- 调用 `PowerPoint.run(async ctx => { await ctx.presentation.insertSlidesFromBase64(base64, { targetSlideId: ..., formatting: 'UseDestinationTheme' }); await ctx.sync(); })`
- 检查错误类型：若抛出 `ItemNotFound` 或 `OperationNotSupported`，记录为不支持

**场景二测试：在选中 slide 插图**
- 使用 `PowerPoint.run` + `presentation.getSelectedSlides()` 获取当前选中 slide
- 排序（workaround for #3618）：按 slide.index 排序后取第一个
- 调用 `slide.shapes.addImage(base64Image)` 插入图片
- 若 `addImage` 不可用（preview API），fallback 到 `setSelectedDataAsync(imageBase64, {coercionType: Office.CoercionType.Image})`

**场景三测试：替换 slide 文字**
- `PowerPoint.run` → 获取 active slide 的 shapes → 找到 title shape → 修改 textFrame.text
- 若失败，尝试 `setSelectedDataAsync(newText, {coercionType: Office.CoercionType.Text})`

**Plan B smoke test：setSelectedDataAsync html coercion**
- 独立按钮，不与上面三场景混用（Pitfall 2 防范）
- `Office.context.document.setSelectedDataAsync('<p><b>Plan B 测试内容</b></p>', {coercionType: Office.CoercionType.Html}, callback)`
- 记录是否成功

**HTML 结构要点**：
- Office.js CDN script tag
- 四个独立测试按钮（场景一/二/三 + Plan B）
- 结果输出区域（显示 API 是否成功/失败及错误信息）
- 顶部警告：禁止在此测试页中混用场景 A（PowerPoint.run）和场景 B（setSelectedDataAsync）在同一次操作中（Pitfall 2）

最小 pptx base64 可以用以下方式生成（executor 在创建文件时注释说明生成方法）：
- 使用已有的最小合法 pptx 文件的 base64（约 30-50KB）
- 或在 Task 2（人工验证）时由用户手动提供真实 pptx 模板

**安全规则**：
- 无 API Key，本测试页不调用 LLM
- 不创建 DocumentAdapter 类（D-08）
- 使用 Office.js CDN，不 npm install @microsoft/office-js
  </action>
  <acceptance_criteria>
    - 文件存在：`ls spike/ppt-writeback-test.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com/lib/1/hosted/office.js' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 含 insertSlidesFromBase64：`grep -c 'insertSlidesFromBase64' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 含 getSelectedSlides：`grep -c 'getSelectedSlides' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 含 slide.index 排序（#3618 workaround）：`grep -c 'slide.index\|\.index' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 含 setSelectedDataAsync Plan B：`grep -c 'setSelectedDataAsync' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 含 Html coercion：`grep -c 'CoercionType.Html\|coercionType.*Html' spike/ppt-writeback-test.html` 返回 ≥ 1
    - 不含 @microsoft/office-js npm import：`grep -c '@microsoft/office-js' spike/ppt-writeback-test.html` 返回 0
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'insertSlidesFromBase64' spike/ppt-writeback-test.html && grep -c 'setSelectedDataAsync' spike/ppt-writeback-test.html</automated>
  </verify>
  <done>spike/ppt-writeback-test.html 创建：三场景 + Plan B 测试函数，独立按钮，无混用风险，Office.js CDN 加载</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2：手动执行三场景 PPT 写回验证并录屏</name>
  <what-built>
    spike/ppt-writeback-test.html 已部署到 GitHub Pages，可在 PPT for Web Task Pane 中访问
  </what-built>
  <how-to-verify>
**准备：**
1. 打开 PPT for Web（Edge），sideload manifest，打开 Task Pane（ppt-writeback-test.html）
2. 准备录屏软件（建议 QuickTime 或 OBS，录制浏览器窗口）

**场景一（insertSlidesFromBase64）：**
3. 点击"场景一：插入新 Slide"按钮
4. 观察：PPT 是否新增一张 slide？新 slide 是否有内容？
5. 录屏（或截图）记录结果
6. 在 Chrome 重复步骤 3-5

**场景二（选中 slide 插图）：**
7. 在 PPT 中选中某张特定 slide（非活跃的）
8. 点击"场景二：在选中 Slide 插图"按钮
9. 观察：图片是否出现在目标 slide？（非活跃 slide 插图是难点）
10. 录屏记录结果
11. Chrome 重复

**场景三（替换 slide 文字）：**
12. 选中有文字的 slide
13. 点击"场景三：替换文字"按钮
14. 截图记录结果

**Plan B smoke test：**
15. 点击"Plan B：setSelectedDataAsync html"按钮
16. 观察当前 slide 是否插入 HTML 内容

**记录结果：**
17. 将截图/录屏保存至 `.planning/spikes/002-ppt-writeback/`
    - 命名建议：`scene1-edge.mp4`、`scene1-chrome.mp4`、`scene2-edge.mp4`、`planb.png` 等
18. 更新 `.planning/spikes/002-ppt-writeback/findings.md` 每个场景的实测结果
19. 将首行从 PENDING 改为 PASS 或 FAIL
20. 更新 `.planning/spikes/MANIFEST.md` Spike #2 条目状态
  </how-to-verify>
  <resume-signal>
验证完成后，根据结果输入：
- 三场景均通过：输入 "PASS"
- 主路径部分失败但 Plan B 可用：输入 "PARTIAL: [失败场景] — Plan B 可用"
- 所有路径均失败：输入 "FAIL: [具体失败原因]"
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| spike/ppt-writeback-test.html → Office.js APIs | 不涉及网络请求，只调用本地 Office.js |
| spike code → v1 codebase | 严格隔离在 spike/ 目录，不进 v1 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-04-01 | Tampering | spike API call scope | mitigate | D-08：不搭 DocumentAdapter；spike 代码丢弃式 |
| T-00-04-02 | Denial of Service | context.sync() hang | mitigate | 四个测试函数独立调用，不在同一 PowerPoint.run 中混用 setSelectedDataAsync（Pitfall 2）|
</threat_model>

<verification>
整体验证（GATING #2 完成后）：
1. `head -1 .planning/spikes/002-ppt-writeback/findings.md` 含 PASS 或 FAIL（非 PENDING）
2. `ls .planning/spikes/002-ppt-writeback/` 含录屏或截图文件
3. `grep -c 'PENDING' .planning/spikes/MANIFEST.md` 比初始少 1（第 2 行已更新）
</verification>

<success_criteria>
- spike/ppt-writeback-test.html 部署到 GitHub Pages 可访问
- findings.md 三场景 + Plan B 均有实测结论
- 首行 PASS 或 FAIL（非 PENDING）
- 至少一段视频或截图证据存在
- MANIFEST.md Spike #2 状态已更新
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-04-SUMMARY.md`，包含：
- GATING #2 最终结论（PASS / PARTIAL / FAIL）
- 三场景各自的 Edge + Chrome 结论
- Plan B 结论
- 如 FAIL：PPT killer 场景降级方案描述
- 证据文件路径列表
</output>
