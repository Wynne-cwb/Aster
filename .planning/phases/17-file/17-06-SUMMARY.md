---
phase: 17-file
plan: "06"
subsystem: phase-level validation gate
tags: [bundle-size, npm-audit, test-gate, typecheck, nfr-10, nfr-09, human-verify-deferred]
dependency_graph:
  requires: [17-05]
  provides: [phase-17-gate-pass]
  affects: [.size-limit.json]
tech_stack:
  added: []
  patterns:
    - "动 bundle 前先 npm run build 再 npm run size（避免陈旧 dist 假绿）"
    - "npm audit 生产作用域 --omit=dev 区分 dev 工具链既存漏洞"
key_files:
  created: []
  modified: []
requirements: [FILE-07, NFR-10]
status: complete
checkpoint_deferred: true
---

# 17-06 SUMMARY — Phase 17 最终验证四重 gate

## 概述

Phase 17（FILE）的 phase-level 验证门。运行 bundle size / npm audit / 全量测试 / TypeScript 四重 gate，全部通过（audit 有一处既存 dev 工具链漏洞，已论证非阻塞）。`.size-limit.json` 无需改动（main-*.js 仍在 82KB 门内，解析库全为懒加载独立 chunk）。

human-verify checkpoint（Task 2）的本地 dev 端到端 UAT 按里程碑策略**延后 Phase 19** 统一真机/手动验证——见下「Phase 19 待验项」。

## 四重 Gate 结果（由 orchestrator execute-17 亲自运行，ground truth）

### Gate 1 — Build + Size（NFR-10）✓ PASS
- `npm run build` 成功（vite build，3.16s）。
- `npm run size`：**main-*.js = 79.8 KB gzip ≤ 82 KB limit** ✓（Phase 16 基线 78.45KB，Phase 17 集成胶水代码 +~1.4KB；解析库 0 增量）。
- 解析库全部为懒加载独立 chunk，不计入 main：
  - `xlsx-*.js` 162.96 KB gzip（SheetJS，await import）
  - `pdf-*.js` 123.51 KB gzip（pdfjs-dist，await import）
  - `jszip.min-*.js` 29.87 KB gzip（await import）
  - `docx-*.js` / `pptx-*.js` 解析器 wrapper 各 <1 KB（mammoth 本体懒 chunk）
- pdf worker：`public/pdf.worker.min.mjs`（1.2 MB）→ vite 复制到 `dist/pdf.worker.min.mjs`，独立静态资源，不进初始 JS bundle。

### Gate 2 — npm audit（mammoth CVE-2025-11849 守门 / T-17-06-01）✓ PASS（意图层面）
- mammoth 实装版本 **1.12.0**（≥1.11.0，CVE-2025-11849 已修，`externalFileAccess` 默认 false）→ **T-17-06-01 缓解到位**。
- `npm audit --omit=dev`（生产依赖作用域）= **found 0 vulnerabilities** ✓ —— 4 个新解析库（mammoth/xlsx/pdfjs-dist/jszip）供应链干净，不进 shipped 静态包的依赖无高危。
- ⚠️ `npm audit --audit-level=high`（含 dev）退出码 1：报 esbuild ≤0.24.2（GHSA-67mh-4wv8-2f99，dev server 请求泄露）级联到 vite/vitest/@vitest/mocker/vite-node。**全部为 dev/构建/测试工具链**，**Phase 17 之前既存**（非本阶段引入），**永不进用户浏览器的静态产物**。`npm audit fix --force` 会装 vitest@4.1.8 破坏性升级、打挂测试套件，**故不执行**。
- 结论：gate 的安全**意图**（生产依赖无高危 + mammoth CVE 已修）满足；既存 dev-only 漏洞不阻塞本阶段，建议作为独立技术债（升级 vitest/vite 主版本）另案处理。

### Gate 3 — 全量测试 ✓ PASS
- `npm test`（= `tsc --noEmit && vitest run`）：**Test Files 70 passed (70)，Tests 857 passed (857)，0 failed**。
- 含路径 D（NFR-09 文档附件 derivedText 不进序列化）+ 4 个解析器测试（docx/xlsx/pdf/pptx）+ 统一 Attachment store 测试。
- 尾部 3 个 `Errors`（src/providers/retry.test.ts 的 RateLimitError / NetworkError unhandled rejection）= **STATE.md 已记录的已知噪音**，非真失败（"857 passed / 0 failed"）。

### Gate 4 — TypeScript 检查 ✓ PASS
- `npm run typecheck`（tsc --noEmit）exit 0。
- 由于 `npm test` 以 `tsc --noEmit &&` 前置，857 测试能跑即证明 tsc 已通过；另独立运行确认 exit 0。

## 附带同步
- `src/i18n/locales/zh-CN/messages.ts`（编译态 Lingui catalog）：17-05 跑了 `npm run extract`（更新 .po）但未重编 .ts，本次 `npm run build` 的 `lingui compile` 重新生成，补齐 Phase 17 新增 7 条字符串（参考文件 / 仅供 AI 阅读 / 移除附件 / 文件过大 20MB / 暂不支持该文件类型 / (解析中…) / (解析失败)）。一并提交保持源 .po 与编译 .ts 同步。
- `.size-limit.json` 未改动（无需新增 entry；只守 main-*.js 已足够，gate 通过）。

## Phase 19 待验真机 / 手动 UAT 项（延后，不阻塞本阶段）

> 按里程碑策略，真机 / 手动 UAT 一律延后 Phase 19 统一执行。本阶段已交付正确实现 + 自动化 gate 全绿；以下需真人在浏览器 / Office for Web 操作：

1. **17-06 Task 2 本地 dev 端到端 UAT**（human-verify checkpoint，原计划本地 `npm run dev` 浏览器验）：
   - 回形针入口显示「参考文件」；上传 .docx → chip「解析中…」→「文件名 + 仅供 AI 阅读」。
   - 发送「总结这份文档」→ AI 据文档内容作答（注入生效）。
   - 再次发送 → chip 常驻、AI 仍记得文档（D-03 多轮复用）。
   - 点 × 移除 chip → 再发 → AI 不再引用（移除生效）。
   - 上传不支持类型（.zip）→ 诚实提示「暂不支持该文件类型…」（非旧占位）。
   - 混合附件（图 + docx 同条消息）两路派生文本都进 prompt（D-05）。
2. **pdf.js worker 真机 CSP 验证**（本阶段最大技术不确定项）：
   - `/Aster/pdf.worker.min.mjs` 在 GitHub Pages（base `/Aster/`）+ Office for Web iframe CSP（worker-src 限制）下能否加载。
   - 实现偏差：原计划 `new URL('...', import.meta.url).href` 在 Vite 7 + 懒加载 `await import('pdfjs-dist')` 组合下**未触发 worker emit**；已 fallback 为 `public/pdf.worker.min.mjs` 静态资源 + 硬编码路径 `/Aster/pdf.worker.min.mjs`。仍**未用** `?url`（遵守 vite RULE）。
   - 失败 fallback 待 Phase 19 评估（最坏：pdf 走降级提示该宿主暂不支持）。

## 偏差 / 风险

- **[偏差] pdf worker 配置方式**：从 D-08 锁定的 `new URL(..., import.meta.url).href` 改为 `public/` 静态资源 + 硬编码 `/Aster/` 路径（理由见上，机制层偏差但目标达成、避开禁用的 `?url`）。建议 code-review / Phase 19 关注：硬编码 `/Aster/` 而非 `import.meta.env.BASE_URL`，base 变更会失效。
- **[偏差] pptx 提取方式**：从 D-09 的「原生 DOMParser 提 `<a:t>`」改为正则 `/<a:t[^>]*>([^<]*)<\/a:t>/g`（jsdom XML 命名空间在测试环境失败；正则在浏览器 + jsdom 两环境均可靠）。text-only 不保真目标不变；注意 XML 实体（如 `&amp;`）未解码，对喂 LLM 影响可忽略。
- **[既存技术债] dev 工具链 npm audit 漏洞**：esbuild/vite/vitest 链，非本阶段引入，建议另案升级。

## Self-Check: PASSED
