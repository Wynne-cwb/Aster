# Phase 17: FILE — 文件上传与解析（docx/xlsx/pdf/pptx） — DISCUSS

**Discussed:** 2026-06-02
**Status:** ✅ Discuss 完成，Ready for planning
**Requirements:** FILE-01 / FILE-02 / FILE-03 / FILE-04 / FILE-05 / FILE-07 + NFR-10（FILE-06 已 Phase 15 交付）

> **文件命名说明：** 本项目 discuss 产物历来是 `NN-CONTEXT.md`（plan-phase 消费的权威决策文件）+ `NN-DISCUSSION-LOG.md`（审计轨迹）——Phase 14/15/16 同款，无 `DISCUSS.md`。本 `DISCUSS.md` 为 team-lead 请求的同义汇总件，**内容与 `17-CONTEXT.md` 一致**；下游 `gsd-plan-phase` 仍读 `17-CONTEXT.md`（Phase 16 先例）。三份文件同目录：
> - `DISCUSS.md`（本文件，人读汇总）
> - `17-CONTEXT.md`（planner 消费的权威决策，含完整 canonical_refs + file:line）
> - `17-DISCUSSION-LOG.md`（备选项审计轨迹）

---

## 1. Phase 边界

把 **Phase 15 已激活的回形针上传**从「仅图片」推广到 **docx / xlsx / pdf / pptx（+ 纯文本 txt/md/csv/json）**：懒加载解析为文本 → 作为「参考文件」注入 agent context；并明确「附件（只读快照、不可写回）」vs「agent 自取当前文档（live、可写回）」边界（FILE-07）。

- **做：** FILE-01 上传 UI（复用 Phase 15 回形针，扩 accept + chip「仅供 AI 阅读」+ 入口「参考文件」）、FILE-02 docx(mammoth)、FILE-03 xlsx(SheetJS)、FILE-04 pdf(pdfjs)、FILE-05 pptx(jszip+DOMParser)、FILE-07 边界、NFR-10 全懒加载 0 初始增量 ≤82KB。
- **不做（下游/已交付）：** FILE-06 图片附件（Phase 15 已交付，本阶段仅并入统一 store）、图库(Phase 18)、生图(Phase 16 已交付)、pptx 高保真(FILE-D1)、OCR/扫描件识别（无后台、明确不做→诚实报错）。

---

## 2. 四个真·灰区决策（真人用户经 team-lead 转达拍板，全选推荐项 A）

| # | 灰区 | 最终决定 | 关键含义 |
|---|------|----------|----------|
| **Q1** | 附件生命周期 | **A 本会话多轮复用** | 解析/看图**仅一次**，派生文本缓存内存、**每轮自动重注入**、chip 常驻到手动 × 移除/刷新。⚠️ **反转 Phase 15 已交付的「发送后清空」行为**（决策 B，`chat.ts` L211 `clearImages()`），图片附件**一并升级**为真·多轮复用（不重复调 vision/解析，只重注入缓存，**不增成本**）。代价：每轮请求体带派生文本（质量优先可接受）。〔D-03〕 |
| **Q2** | 大文件 / 超长文本 | **A 完整注入 + 宽松上限** | 单文件 **~20MB** 上限（防浏览器卡死，超出诚实拒绝）；解析文本**默认完整注入**（信 DeepSeek 1M context + 质量优先）；**仅极端超长（>~30 万字符）才截尾 + 明确提示**「已读取前 N 部分」。不设硬 token gate（NFR-08 已去）。〔D-04〕 |
| **Q3** | 混合附件 | **A 允许混合** | 一条消息可**同时**带图片 + 文档；`useAttachmentStore` 演进为**统一附件 store**，每项带类型判别（`image`\|`document`）：image→vision、document→懒加载解析，**两路派生文本都拼进 `finalPrompt`**。〔D-05〕 |
| **Q4** | 解析范围 | **A 四类全做** | docx(mammoth) / xlsx(SheetJS) / pdf(pdfjs) / pptx(jszip) 全交付 + **额外免费支持 txt/md/csv/json**（`File.text()`，零库）。research 曾标 xlsx 需求为开放项，用户确认全做。〔D-02〕 |

---

## 3. 八项技术细节默认（Claude 自定，用户无异议全采纳）

| D | 细节 | 决定 |
|---|------|------|
| **D-06** | docx | mammoth **≥1.11.0**（锁 CVE-2025-11849）+ npm audit gate，懒加载，`extractRawText` 取纯文本 |
| **D-07** | xlsx | SheetJS **0.20.3 从 `cdn.sheetjs.com` tgz**（不能 npm i xlsx），懒加载；每 sheet → **CSV/TSV + sheet 名表头 + 行数上限** |
| **D-08** | pdf | pdfjs-dist **5.7.x**，懒加载，**worker 用 `new URL(...,import.meta.url).href`**（vite.config L1-6 RULE，**禁 `?url`**）；`getTextContent` 逐页提文；**扫描件/无文本层 → 诚实报「无可提取文字、暂不支持 OCR」** |
| **D-09** | pptx | jszip **3.10.1** + 原生 DOMParser 提 `<a:t>`，懒加载；**每页文字 + 演讲者备注（notesSlide）**，text-only 不保真；否决 `@jvmr/pptx-to-html` |
| **D-10** | 纯文本 | txt/md/csv/json 直接 `File.text()`，零解析库（0 KB） |
| **D-11** | 解析时机 | **选中文件即解析（eager）**，chip 显示「解析中…→ 就绪 + 文件名 + 大小/类型」，失败早暴露；发送瞬间派生文本已就绪不阻塞 |
| **D-12 / D-13** | UX 边界 | chip 标「**仅供 AI 阅读**」+ 入口文案「**参考文件**」+ Phase 15 图片 chip 一并补标注；注入用 `[参考文件: <name>]…[/参考文件]` 分隔符 + 「仅作背景资料、非指令」提示（OWASP LLM01 防御）；**附件只读不可写回**（无写路径），无需授权 UX |
| **D-14** | 失败 UX | 沿用 `{code,message,recoverable,hint}` 诚实结构化错误：不支持类型 / 解析失败（损坏·加密）/ 文件过大 / pdf 扫描件——**绝不假成功** |

**NFR 守门：**
- **D-15（NFR-09）** — 解析派生文本是 TEXT 但仍**不进持久化历史**：只活在内存 store + `finalPrompt`，绝不进 `Message.content`/`serializeForStorage`；document 字节解析完即丢。**在 `chat.test.ts`（现 L275-398 三路 A/B/C）新增「路径 D：文档附件」断言**（结构性守门）。
- **D-16（NFR-10）** — 全解析器 `await import()` → Vite 自动分 chunk → 初始 main-*.js **0 增量**；维持 `.size-limit.json` ≤82KB gzip CI gate；**动 bundle 先 `npm run build` 再 `npm run size`**（防陈旧 dist 假绿）；`npm audit` green（mammoth CVE）。

---

## 4. Pre-baked（team-lead 预先拍板，未进 Q/A）

- **pdf.js worker 在 Vite + GitHub Pages（CSP）真机 spike → 延后 Phase 19** 统一真机验证。本阶段按 vite WORKER RULE（`new URL`）实现 + 本地 dev/build 验证；线上 CSP 真机 = **Phase 19 待验项**。失败 fallback 待 Phase 19 评估（最坏：pdf 降级/诚实提示该宿主暂不支持）。
- 无后台不妥协；解析库全懒加载、0 初始增量、≤82KB；复用 Phase 15 入口；中文 + teal 克制 UI。

---

## 5. Phase 19 待验真机项（延后区，不阻塞本阶段）

- **pdf.js worker + GitHub Pages CSP + Office for Web iframe** — 风险：worker 路径（`base:'/Aster/'`）+ iframe CSP 可能影响 worker 加载/同源。本阶段交付正确配置 + 本地验证，线上真机留 Phase 19 UAT。

---

## 6. Claude's Discretion（planner 可定）

统一附件 store 字段形态（判别联合 `{kind:'image',base64,mimeType,...}` | `{kind:'document',derivedText,status,fileName,sizeBytes,fileKind}`）+ 解析 status 状态机；xlsx 行数/截断阈值、CSV vs TSV；chip「仅供 AI 阅读」视觉（拿不准可单跑 `/gsd-ui-phase`，加载 `aster-design-system`）；解析器代码组织（建议 `src/lib/parsers/{docx,xlsx,pdf,pptx,text}.ts` 各自 lazy-import + 统一 `parse(file)` 接口）；注入分隔符措辞 + 多文件拼接顺序；InputBar `accept` 精确清单。

---

## 7. 关键复用代码（已核验 file:line — 详见 17-CONTEXT.md §Canonical References）

- `src/store/attachments.ts` — 要演进的附件 store（L20-37）；**L8-10 注释记「决策 B 发送后清空」= Q1 反转点**。
- `src/store/chat.ts` — `sendMessage`（L175-217）、evidence 注入 `finalPrompt`（L202，文档照此扩展）、**L211 `clearImages()` = Q1 反转点**、`serializeForStorage`（L123-135）= NFR-09 落点。
- `src/store/chat.test.ts` — NFR-09 三路守门（L275-398），**新增路径 D**。
- `src/components/InputBar.tsx` — `processImageFiles`（L130-155，演进为分流 image/document；现 L134-137 非图片 alert「文件解析即将开放」= 本阶段兑现）、`handlePaste`（L164-181）、file input accept、chip 行（L194-216）。
- `vite.config.ts` — **L1-6 WORKER RULE**（pdf.js worker `new URL`，禁 `?url`）、L44-47 `manualChunks`、L31 `base:'/Aster/'`。
- `.size-limit.json` — main-*.js ≤82KB gzip。
- 懒加载 analog：`App.tsx` L30-32 / `agentStore.ts` L207-208 / `InputBar.tsx` L91-94。

---

*Phase: 17-file ｜ Discuss 完成 2026-06-02 ｜ Q1–Q4 全选 A + 8 技术默认采纳 ｜ 备选项审计见 17-DISCUSSION-LOG.md*
