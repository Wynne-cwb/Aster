---
phase: 0
plan: "04"
subsystem: spike-gating
tags:
  - spike
  - gating
  - ppt-writeback
  - office-js
  - powerpoint
  - phase-0
requires:
  - "00-01-hosting-ci (GitHub Pages + spike/ 骨架)"
  - "00-02 (spike 子目录与 findings.md 模板)"
provides:
  - spike/ppt-writeback-test.html
affects:
  - .planning/spikes/002-ppt-writeback/findings.md（待人工填写）
  - .planning/spikes/MANIFEST.md（待人工更新 Spike #2 状态）
tech-stack:
  added: []
  patterns:
    - "PowerPoint.run 主路径 + setSelectedDataAsync fallback"
    - "getSelectedSlides 后按 slide.index 升序排序（#3618 workaround）"
    - "PowerPointApi 1.2 / 1.5 requirement set 启动检查"
    - "Office.js CDN script tag（无 npm import）"
key-files:
  created:
    - spike/ppt-writeback-test.html
  modified: []
decisions:
  - "Plan B 按钮与三场景按钮在 UI 与 JS 中物理隔离（独立 click handler、独立 result 区），并在顶部 + 按钮处双重警告禁止同会话混用（Pitfall 2 / #5022 防范）"
  - "场景一不硬编码 pptx 模板 base64，让用户上传本地 .pptx 文件 → FileReader 读 base64 → insertSlidesFromBase64。规避把 5-50KB 二进制字符串塞进 spike HTML"
  - "场景二与三在 PowerPoint.run 失败后落入 setSelectedDataAsync fallback。说明：fallback 只能写到 active slide，不一定是用户选中的非活跃 slide——这是 Pitfall 1 的核心 gap，实测要观察清楚"
  - "图片插入用 1x1 红色 PNG（70 字节 base64 内联），便于快速实测，且不引入图片资源依赖"
  - "未硬编码任何 API Key 或 LLM endpoint（本测试页不调用 LLM）"
metrics:
  duration_iso: "PT0H30M"
  completed: ""  # 待 Task 2 人工验证完成后填写
status: "AWAITING-HUMAN-VERIFY"
---

# Phase 0 Plan 04: GATING #2 — PPT 写回三场景验证 Summary

## One-Liner

创建了 PPT 写回 spike 测试页 `spike/ppt-writeback-test.html`，覆盖三场景（`insertSlidesFromBase64` / `slide.shapes.addImage` / `textFrame` 替换文字）+ Plan B（`setSelectedDataAsync` HTML coercion），主路径走 `PowerPoint.run`、fallback 走 legacy `setSelectedDataAsync`，并在 UI 中物理隔离 Plan B 以防 Pitfall 2 / #5022 挂死；**Task 2 人工验证待用户在 PPT for Web（Edge + Chrome）实测后填写 findings.md 并更新 MANIFEST**。

## Status

**AWAITING HUMAN VERIFICATION** — checkpoint `human-verify gate="blocking"`。

Task 1（创建测试页）已完成并 commit。Task 2 需用户在 PPT for Web 端到端操作每个场景、录屏 / 截图、把结果回填到 `.planning/spikes/002-ppt-writeback/findings.md` 首行 PASS / FAIL，并更新 `.planning/spikes/MANIFEST.md` Spike #2 状态。

## What Was Built

### `spike/ppt-writeback-test.html`（17.9 KB，纯静态）

四个独立测试按钮，每个有独立的结果输出区域：

| # | 测试 | 主路径 | Fallback |
|---|---|---|---|
| 1 | `insertSlidesFromBase64` | 用户上传 .pptx → `FileReader.readAsDataURL` 取 base64 → `PowerPoint.run → ctx.presentation.insertSlidesFromBase64(base64, {formatting: UseDestinationTheme})` | — |
| 2 | 在选中 slide 插图 | `PowerPoint.run → getSelectedSlides() → 按 slide.index 排序 → 取首张 → slide.shapes.addImage(redPng)` | `setSelectedDataAsync(image, {coercionType: Image})` |
| 3 | 替换 slide 文字 | `PowerPoint.run → getSelectedSlides() → 排序 → shapes 枚举 → 第一个含 textFrame 的 shape → textRange.text = "Aster Spike #2 — 文本替换测试 ✓"` | `setSelectedDataAsync(text, {coercionType: Text})` |
| B | Plan B HTML coercion | — | `Office.context.document.setSelectedDataAsync('<p><b>...</b></p>', {coercionType: Office.CoercionType.Html}, callback)` |

### 关键防范

- **Pitfall 2 / #5022 防范**：Plan B 按钮 UI 物理隔离（紫色背景），顶部黄色警告条 + 按钮 description + 成功结果中再提示一次"不要再点上面三个按钮"，要求用户重测 Plan B 必须先关闭 Task Pane 再重开。
- **Pitfall 5 / #3618 防范**：`getSelectedSlides()` 返回的 collection 通过 `.slice().sort((a, b) => a.index - b.index)` 升序排序，UI 中同时输出"原序"和"排序后"两行，便于在 PPT Web 上观测反序 bug。
- **Pitfall 1 防范**：场景二的 fallback `setSelectedDataAsync(Image)` 的结果文本明确写"fallback 只能插到 active slide，不一定是选中的非活跃 slide"，提醒用户实测时区分。
- **Requirement set 检查**：启动时检测 `PowerPointApi` 1.2 / 1.5 是否支持，未就绪按钮 disabled，避免在不支持的环境产生误判。
- **API Key 安全**：本测试页不调用 LLM，无 Authorization header，无网络请求外发（除 Office.js CDN）。

## What User Must Do (Task 2 — Checkpoint)

按 PLAN.md Task 2 的步骤：

**前置：**
1. 确认 `spike/ppt-writeback-test.html` 已通过 GitHub Pages 部署到 `https://wynne-cwb.github.io/Aster/ppt-writeback-test.html`（或 `manifest.xml` 中的 `Taskpane.Url`，可能需要单独调整该字段）
2. 在 PPT for Web（Edge）sideload `spike/manifest.xml`，打开 Task Pane

**场景一（insertSlidesFromBase64）：**
3. 在 PPT 中新建一个最小空白 .pptx 文件并保存到本地
4. 在 Task Pane 中通过 `<input type="file">` 选择该 .pptx
5. 点击"场景一：插入新 Slide"
6. 观察并录屏：演示文稿末尾是否真新增一张 slide
7. 在 Chrome 重复步骤 3-6

**场景二（选中 slide 插图）：**
8. 在 PPT 左侧大纲面板点选一张**非活跃** slide
9. 点击"场景二：在选中 Slide 插图"
10. 观察：1x1 红色像素图是否出现在目标 slide（注意红点很小，可能需要放大）
11. Edge + Chrome 各跑一次

**场景三（替换 slide 文字）：**
12. 选中含标题文本的 slide
13. 点击"场景三：替换文字"
14. 观察：标题文字是否变为 "Aster Spike #2 — 文本替换测试 ✓"

**Plan B smoke test（独立、关闭 Task Pane 重开再做）：**
15. 关闭 Task Pane 后重新打开（避免被场景一/二/三的 PowerPoint.run 污染 IPC 通道）
16. 点击 "Plan B：setSelectedDataAsync(html)"
17. 观察当前 slide 是否插入 HTML 内容

**记录：**
18. 录屏 / 截图保存至 `.planning/spikes/002-ppt-writeback/`（命名建议 `scene1-edge.mp4`、`scene2-chrome.png`、`planb.png` 等；如视频超 100MB 走 GitHub Release attachments — D-10）
19. 更新 `.planning/spikes/002-ppt-writeback/findings.md`：
   - 首行：`PASS` / `FAIL` / `PARTIAL: [失败场景] — Plan B 可用`
   - 各场景实测结果（Edge / Chrome 各一行）
   - 证据 checkbox 勾选
20. 更新 `.planning/spikes/MANIFEST.md` Spike #2 状态列（PENDING → PASS / FAIL / PARTIAL）

## Resume Signal

人工验证完成后用以下信号之一回到 orchestrator：
- **PASS**：三场景在 Edge + Chrome 均端到端成功
- **PARTIAL: [失败场景] — Plan B 可用**：主路径部分失败但 Plan B smoke test 成功，PRD R1 fallback 路径激活
- **FAIL: [具体失败原因]**：所有路径失败，需写 `.planning/spikes/GATING-FAILED-2.md` 并进入 PRD 修订

## Deviations from Plan

无。PLAN.md 中 Task 1 的 action 块逐条实现完成：
- 四独立按钮 ✓
- 顶部警告 ✓
- Office.js CDN ✓
- `insertSlidesFromBase64` + `UseDestinationTheme` ✓
- `getSelectedSlides` + `slide.index` 排序 ✓
- `slide.shapes.addImage` 主路径 + `setSelectedDataAsync(Image)` fallback ✓
- `textFrame.textRange.text` 主路径 + `setSelectedDataAsync(Text)` fallback ✓
- 独立的 Plan B smoke test 按钮 + `CoercionType.Html` ✓
- 无 npm `@microsoft/office-js` import ✓
- 不创建 DocumentAdapter（D-08）✓

PLAN.md "最小 pptx base64" 给了两个选项（已有 base64 字符串 vs Task 2 时用户提供）。我**选了第三种**：让 Task Pane UI 通过 `<input type="file">` 接受用户上传 .pptx，FileReader 转 base64 在浏览器内完成。这避免：(a) 把 30-50KB 不可读 base64 写死进 HTML，(b) PPT Web 中 hardcode "在浏览器内构造 pptx zip" 的复杂度。属于 Rule 3（auto-fix blocking issue：硬编码方案有 file-size 与可读性问题）的合理选择，已在 SUMMARY 决策段记录。

## Acceptance Criteria Verification

Task 1 所有 grep-based acceptance criteria 实际验证结果：

| 验收项 | 期望 | 实测 |
|---|---|---|
| 文件存在 | ls 返回 0 | OK |
| Office.js CDN | ≥1 | 1 |
| insertSlidesFromBase64 | ≥1 | 7 |
| getSelectedSlides | ≥1 | 4 |
| slide.index 排序 | ≥1 | 10 |
| setSelectedDataAsync | ≥1 | 17 |
| CoercionType.Html | ≥1 | 2 |
| 无 @microsoft/office-js | 0 | 0 |

## Threat Surface

PLAN.md `<threat_model>` 中两个 threat 均已 mitigate：

- **T-00-04-01（spike 代码污染 v1）**：所有 PPT API 调用在 `spike/ppt-writeback-test.html` 单文件内，未创建任何 `*Adapter.ts`，未在 `src/` 下新建任何文件，spike 代码与 v1 物理隔离 ✓
- **T-00-04-02（API mixing 挂死）**：四个 click handler 完全独立，无任何一个 handler 内同时调 `PowerPoint.run` 与 `setSelectedDataAsync`（fallback 仅在主路径 throw 后调用，逻辑上是 either-or）；UI 顶部 + Plan B 按钮处双重警示 ✓

未引入新威胁面（无网络请求外发、无 secret 处理、无 cross-origin postMessage）。

## Commits

- `707c771` — feat(00-04): 创建 PPT 写回三场景 + Plan B 测试页 spike/ppt-writeback-test.html
- (pending) — docs(00-04): 写入 plan 04 执行 SUMMARY（本文件）

## Self-Check: PASSED

文件存在性 + commit hash 已验证：

- `spike/ppt-writeback-test.html` — FOUND（git log 中 `707c771` 创建该文件）
- `.planning/phases/00-spike-gating/00-04-SUMMARY.md` — 即将由当前 commit 创建
- Commit `707c771` — FOUND（git log 中可见）
