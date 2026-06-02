---
phase: 17
slug: file
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 17-RESEARCH.md §Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（jsdom 环境） |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npm test -- --run src/store/chat.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~30 秒（约 830 tests） |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`（全套 < 30s）
- **After every plan wave:** Run `npm test -- --run && npm run typecheck`
- **Before `/gsd-verify-work` (phase gate):** `npm test -- --run && npm run typecheck && npm run build && npm run size`（bundle gate 强制在 phase gate；动 bundle 前必先 build 再 size，否则陈旧 dist 给假绿）
- **Max feedback latency:** ~30 秒

---

## Per-Task Verification Map

| Req ID | Behavior | Wave | Test Type | Automated Command | File Exists | Status |
|--------|----------|------|-----------|-------------------|-------------|--------|
| FILE-01 | chip「仅供 AI 阅读」文案渲染 + 入口「参考文件」文案 | 3 | unit (smoke) | `npm test -- --run src/components/InputBar.test.tsx` | ❌ W0/W3 新建 | ⬜ pending |
| FILE-02 | docx → 文本正确（含中文）；mammoth extractRawText 调用形态 | 2 | unit | `npm test -- --run src/lib/parsers/docx.test.ts` | ❌ W0/W2 新建 | ⬜ pending |
| FILE-03 | xlsx → CSV 正确（多 sheet + 中文 + 行数截断） | 2 | unit | `npm test -- --run src/lib/parsers/xlsx.test.ts` | ❌ W0/W2 新建 | ⬜ pending |
| FILE-04 | pdf → 文本正确；扫描件报 PDF_NO_TEXT_LAYER | 2 | unit | `npm test -- --run src/lib/parsers/pdf.test.ts` | ❌ W0/W2 新建（worker mock） | ⬜ pending |
| FILE-05 | pptx → 文本正确（slide 数字排序 + 演讲者备注） | 2 | unit | `npm test -- --run src/lib/parsers/pptx.test.ts` | ❌ W0/W2 新建 | ⬜ pending |
| FILE-07 | chip 显示「仅供 AI 阅读」；附件无 write 路径（只读注入边界） | 3 | unit (smoke) | 含于 `src/components/InputBar.test.tsx` | ❌ W0/W3 | ⬜ pending |
| NFR-09 (路径 D) | 文档附件 derivedText 不出现在 serializeForStorage 结果 | 3 | unit | `npm test -- --run src/store/chat.test.ts` | ✅ 扩展现有（新增 describe 块） | ⬜ pending |
| NFR-10 | 初始 main-*.js ≤82KB gzip + 解析库懒加载分 chunk | 4 | build gate | `npm run build && npm run size` | ✅（.size-limit.json 已有） | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

测试 stub 在 Wave 0 创建（红），随后各 wave 实现转绿：

- [ ] `src/lib/parsers/docx.test.ts` — FILE-02（mock mammoth，验证 extractRawText 调用形态 + 超长软截断）
- [ ] `src/lib/parsers/xlsx.test.ts` — FILE-03（mock xlsx，验证多 sheet CSV + 行数截断）
- [ ] `src/lib/parsers/pdf.test.ts` — FILE-04（mock pdfjs-dist，验证 getTextContent 聚合 + 扫描件报错路径；worker 必须 mock，jsdom 无原生 Worker）
- [ ] `src/lib/parsers/pptx.test.ts` — FILE-05（mock jszip，验证 slide 数字排序 + `<a:t>` 提取 + 演讲者备注）
- [ ] `src/components/InputBar.test.tsx` 测试块 — FILE-01/FILE-07 chip 标注 + 入口文案
- [ ] `src/store/chat.test.ts` 新增「路径 D」describe 块 — NFR-09（文档附件 derivedText 不进序列化）

**Wave 0 核心挑战:** pdfjs-dist worker 在 Vitest/jsdom 需 mock（浏览器 Worker API jsdom 不支持）。`pdf.test.ts` 用 `vi.mock('pdfjs-dist', ...)` 桩 `GlobalWorkerOptions` + `getDocument().promise → getPage → getTextContent`（见 RESEARCH.md L730-745 范式）。

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| pdf.js worker 在 Vite + GitHub Pages（`base:'/Aster/'`）+ Office for Web iframe CSP 真机加载 | FILE-04 / NFR-10 | 线上 CSP + 子路径行为仅部署后暴露；本地 dev/build 无法复现宿主 iframe CSP | **延后 Phase 19 UAT**：sideload 后上传含文本层 pdf，确认 worker 正确加载、文本提取成功（失败则触发 fallback 评估）|
| 真实多格式文件端到端（上传 → chip 就绪 → 多轮复用 → agent 据内容作答） | FILE-01..05 | 需真实 Office 宿主 + 真实文件 | **Phase 19 UAT**：每类型一份真实文件验证解析质量 + 多轮重注入 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags（全部 `--run`）
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
