---
phase: 00-spike-gating
plan: "09"
subsystem: infra
tags: [pdfjs, pptx, jszip, vite, file-parser, spike]

requires:
  - phase: 00-spike-gating
    provides: spike infrastructure (manifest.xml + GitHub Pages 部署) 来自 plan 01-02
provides:
  - spike/pdfjs-test.html（pdf.js CDN 版本基础解析能力测试页）
  - spike/pdfjs-vite-test/README.md（Vite 生产构建 worker 测试步骤文档）
  - spike/pptx-extract.html（jszip + DOMParser pptx 文本提取原型，核心 33 LOC）
  - findings 模板更新：007 + 008 标 IN_PROGRESS，列出 Task 3 人工验证步骤
affects: [phase 3 文件解析层（mammoth/SheetJS/pdfjs/pptx 懒加载实现）]

tech-stack:
  added:
    - pdfjs-dist@4.9.155（CDN，仅 spike）
    - JSZip@3.10.1（CDN，仅 spike）
    - 浏览器原生 DOMParser（pptx XML 解析）
  patterns:
    - "pdf.js worker：禁用 `?url` 导入，强制 `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href` 模式（Pitfall 7）"
    - "pptx 文本提取：jszip + DOMParser ≤80 行原型，绝不引第三方 pptx 库（Pitfall 8 §Prevention）"
    - "spike 阶段第三方依赖一律 CDN；Phase 3 起改 npm 包 + `await import()` 懒加载"

key-files:
  created:
    - spike/pdfjs-test.html
    - spike/pdfjs-vite-test/README.md
    - spike/pptx-extract.html
  modified:
    - .planning/spikes/007-pdfjs-production-build/findings.md
    - .planning/spikes/008-pptx-text-extraction/findings.md
    - .planning/spikes/MANIFEST.md

key-decisions:
  - "pdf.js 拆为两步验证：CDN 版本（spike/ 直接静态页）+ Vite 生产构建（单独最小 Vite 项目，由用户本地跑）。原因：CDN 版本的 worker 是绝对 URL，跟 bundler 完全无关，无法替代 Vite 生产构建 worker 加载 bug（Pitfall 7）的核心验证。"
  - "pptx 提取使用 `querySelectorAll('t')` 而非 `getElementsByTagNameNS` —— DOMParser 跨命名空间宽松匹配带来轻微误匹配风险，但代码更短（33 LOC）。风险由 Task 3 三文件人工对比验证；如出现明显误匹配再改严格命名空间过滤。"
  - "spike 阶段 JSZip / pdfjs 走 CDN（非 npm + 懒加载），符合 plan 决策 D-08「丢弃式 spike」原则。Phase 1 起按 STACK.md 表格 npm 安装 + 懒加载。"

patterns-established:
  - "pdf.js workerSrc 设置模式：`new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href`（适用于 Vite/Webpack5+）"
  - "pptx 文本提取算法：filter `^ppt/slides/slide\\d+\\.xml$` → 按编号排序 → 逐文件 JSZip async('string') → DOMParser → querySelectorAll('t') → 拼接 textContent"
  - "spike findings 状态流：PENDING（计划）→ IN_PROGRESS（代码 + 步骤就绪，待人工实操）→ PASS/FAIL（Task 3 checkpoint 完成）"

requirements-completed: []

duration: ~25min
completed: 2026-05-26
---

# Phase 00 Plan 09: 非 GATING #7 + #8 — pdf.js 生产构建 + pptx jszip 文本提取 Summary

**pdf.js 用 CDN 版本验证基础解析能力（GitHub Pages 静态），生产构建 worker 测试拆到单独 Vite 子项目交用户本地实操；pptx 用 jszip + DOMParser 33 LOC 原型完成（远低于 80 LOC 目标），无任何第三方 pptx 库**

## Performance

- **Duration:** ~25 min（计划估 4h，但 checkpoint 前的编码 + 文档部分仅 25min；Task 3 用户实操不计入）
- **Started:** 2026-05-26T（plan 09 启动时刻）
- **Completed (code portion):** 2026-05-26T（checkpoint 触发，待 Task 3 实操）
- **Tasks:** 2 / 3 完成（Task 3 待人工验证）
- **Files created:** 3（spike/pdfjs-test.html, spike/pdfjs-vite-test/README.md, spike/pptx-extract.html）
- **Files modified:** 3（007 + 008 findings.md, MANIFEST.md）

## Accomplishments

- **Spike #7（pdf.js）拆解策略落地**：识别出 CDN 版本无法替代 Vite 生产构建 worker 测试（worker URL 模型完全不同），创建两个组件：
  - `spike/pdfjs-test.html` 在 GitHub Pages 静态托管下做 PDF 解析 smoke test
  - `spike/pdfjs-vite-test/README.md` 含完整 Vite 项目初始化 + build + preview 步骤 + Pitfall 7 反模式（`?url`）的明确禁令 + 三级 fallback
- **Spike #8（pptx）原型完成**：`spike/pptx-extract.html` 实现 `extractPptxText(file)` 函数，纯代码 33 行（含注释 44 行），远低于 80 LOC 目标。核心算法：JSZip 解 zip → 按编号排序 slide XML → DOMParser 解析 → `querySelectorAll('t')` 抓所有 `<a:t>` → 拼接 textContent
- **findings 模板升级**：007 + 008 从「待填」改为「IN_PROGRESS + 代码已就绪 + Task 3 具体步骤」，MANIFEST.md 同步状态。Task 3 用户实操后只需填实测数据并改首行为 PASS/FAIL

## Task Commits

1. **Task 1: 创建 pdf.js 测试页（CDN + Vite 生产构建说明）** — `49550af` (feat)
2. **Task 2: 创建 pptx 文本提取原型 + 更新 findings** — `73dc41f` (feat)
3. **Task 3: 手动运行两个解析器测试并记录结论** — **CHECKPOINT（待用户实操）**

## Files Created/Modified

- `spike/pdfjs-test.html`（创建）—— CDN 版本 pdf.js@4.9.155 ES module 动态 import，上传 PDF 输出页数 + 前两页文本，含 Office.js CDN 与友好错误提示。**严格不含 `?url` 导入**。
- `spike/pdfjs-vite-test/README.md`（创建）—— Vite vanilla-ts 项目初始化、`new URL(..., import.meta.url)` 正确模式、`npm run build` + `ls dist/assets/ | grep worker` + `npm run preview` 验证步骤、PASS 判据、三级 fallback、CSP 注释、为什么独立于顶层 spike 的说明
- `spike/pptx-extract.html`（创建）—— JSZip + DOMParser 提取 `<a:t>`，stats 区显示 slide/节点/字符/耗时，含 querySelectorAll 命名空间风险注释、DOMParser parsererror 检测、JSZip 未加载时的友好降级
- `.planning/spikes/007-pdfjs-production-build/findings.md`（修改）—— 标 IN_PROGRESS，引用 spike/pdfjs-test.html + spike/pdfjs-vite-test/README.md，列 Task 3 五步实操，PASS / FAIL 判据具体化
- `.planning/spikes/008-pptx-text-extraction/findings.md`（修改）—— 标 IN_PROGRESS，记录 33 LOC 实测行数 + querySelectorAll 命名空间风险（Task 3 验证项），列出三 pptx 测试步骤
- `.planning/spikes/MANIFEST.md`（修改）—— Spike #7 + #8 状态从 PENDING 改为 IN_PROGRESS

## Decisions Made

1. **pdf.js 两步验证而非合并到一个 HTML**
   - 计划原文说「创建组件 A（pdfjs-test.html）+ 组件 B（pdfjs-vite-test/README.md）」，照做
   - 关键认知：CDN 版 worker 是绝对外部 URL，bundler 完全不参与；Pitfall 7 的 bug 只在 Vite 把 worker 当资源 hash 重命名时才触发。所以 CDN 版只能做「基础能力 smoke test」，不能替代生产构建测试

2. **pptx 用 `querySelectorAll('t')` 而非严格命名空间过滤**
   - 计划文档已建议这种写法，并标注「Task 3 人工验证步骤会将提取文本与原始 pptx 大纲对比，记录误匹配/重复情况」
   - 选这种写法的代价是潜在的非 DrawingML `<t>` 元素被混入（极少见）；好处是代码更短（33 LOC vs 估计 38+ LOC 用 NS API）
   - Fallback 已在 008 findings.md 写明：如 Task 3 出现明显误匹配，改用 `doc.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/main', 't')`

3. **JSZip 走 CDN（非 npm + 懒加载）**
   - 符合 plan 决策 D-08「spike 是丢弃式代码」+ D-10「全部 commit 公开」
   - Phase 3 起按 CLAUDE.md §File Parsers 表格走 npm + `await import()` 懒加载

## Deviations from Plan

**None - 代码 + 文档部分按 plan 写得「字面照抄」。**

唯一可能算作微小适配的点：

- pptx-extract.html 在 `extractPptxText` 函数里额外加了 **DOMParser parsererror 检测** 和 **nodeCount 统计**（计划文档示例代码中没有这两项）。
- 归属：**Rule 2 - 自动补关键缺失**。`DOMParser.parseFromString` 出错不抛异常，靠返回的 doc 含 `<parsererror>` 元素判断 —— 计划示例代码缺这一步会让恶意 / 损坏 pptx 静默失败。`nodeCount` 是给 Task 3 判定「querySelectorAll 命名空间误匹配」提供的可量化信号。
- 二者都是「写完一遍就再不会修改」的健壮性补丁，不影响 LOC（仍 33 行纯代码）。
- 未单独 commit，含在 73dc41f 中。

**Total deviations:** 1 处微小补强（Rule 2）
**Impact on plan:** 不影响目标，反而让 Task 3 验证更可量化。

## Issues Encountered

- **rtk + grep 元字符冲突**：验证「`?url` 反模式不存在」时，rtk 默认把 grep 转 ripgrep，`?` 被 PCRE 当成元字符报错。改用 `rtk proxy grep -F -c '?url' <file>` 绕开。最终确认 `pdf.worker.js?url` 和 `?url` 字面匹配均为 0。
- 没有其他遗留问题。

## User Setup Required

无外部服务配置。Task 3 checkpoint 需要用户：
- 部署 spike/ 到 GitHub Pages（前序 plan 已经配好 workflow，commit + push 自动触发）
- 准备 1-5MB PDF + 3 个不同的 .pptx 测试文件
- 本地按 spike/pdfjs-vite-test/README.md 执行 Vite 项目初始化 + build + preview

## Next Phase Readiness

- spike/pdfjs-test.html + spike/pptx-extract.html 上线 GitHub Pages 后即可由用户实操
- spike/pdfjs-vite-test/ 当前只是说明文档；用户实操时会在该目录初始化 Vite 项目（npm 产物可选择是否 commit —— 建议 .gitignore 排除 node_modules/dist）
- Task 3 完成后：007 + 008 findings.md 首行改 PASS/FAIL，MANIFEST.md 状态同步改 PASS/FAIL；非 GATING，不止损
- Phase 1+ 文件解析层（Phase 3 F4）实现时直接参考本 spike 的两个原型：pdf.js 用 `new URL(..., import.meta.url)`、pptx 用 jszip + DOMParser ≤80 行 fast path

## Self-Check: PASSED

文件存在性 + commit 可达性校验（见下文 Self-Check 区）

---

## Self-Check

**Files created:**
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/spike/pdfjs-test.html
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/spike/pdfjs-vite-test/README.md
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/spike/pptx-extract.html

**Files modified:**
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/.planning/spikes/007-pdfjs-production-build/findings.md
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/.planning/spikes/008-pptx-text-extraction/findings.md
- `[FOUND]` /Users/wb.chen/Documents/Project/Aster/.planning/spikes/MANIFEST.md

**Commits in git log:**
- `[FOUND]` 49550af — feat(00-09): pdf.js spike test pages
- `[FOUND]` 73dc41f — feat(00-09): pptx text-extraction prototype + findings updates

**Result:** PASSED

---

*Phase: 00-spike-gating*
*Completed (code portion): 2026-05-26 — Task 3 checkpoint 待用户实操*
