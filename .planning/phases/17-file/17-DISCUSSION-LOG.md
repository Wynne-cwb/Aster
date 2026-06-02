# Phase 17: FILE — 文件上传与解析 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 17-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 17-file
**Areas discussed:** 附件生命周期 / 大文件处理 / 混合附件 / 解析范围确认 / （Claude 自定）解析器细节 + UX 边界 + NFR 守门

**流程说明：** discuss-17 teammate 无直连真人通道；4 个真·灰区一次性批量经 team-lead 转达用户，**用户全选推荐项 A**；8 项技术细节默认用户无异议全部采纳。

---

## Q1. 附件生命周期：单轮即弃 vs 本会话多轮复用（最大决策）

| Option | Description | Selected |
|--------|-------------|----------|
| A 本会话多轮复用 | 解析/看图一次，派生文本缓存内存、每轮自动重注入，chip 常驻到手动移除/刷新；顺带升级 Phase 15 图片附件为真·多轮复用（不重复调用，只重注入缓存，不增成本） | ✓ |
| B 单轮即弃 | 发一条消息消费一次，追问需重新上传（与当前 Phase 15 图片实现一致） | |
| C 你来定 / 帮我分析 | | |

**User's choice:** A（推荐）
**Notes:** 关键发现——Phase 15 实际交付的是「发送后清空」（决策 B，`attachments.ts` L8-10 + `chat.ts` L211 `clearImages()`，真机 UAT 时从原 D-10「保留复用」务实降级）。用户选 A = 确认当初降级不理想，本阶段**反转**回多轮复用，图片 + 文档两路统一。代价：每轮请求体带附件派生文本（质量优先可接受）。→ 17-CONTEXT D-03。

## Q2. 大文件 / 超长解析文本（含单文件大小上限）

| Option | Description | Selected |
|--------|-------------|----------|
| A 完整注入 + 宽松上限 + 极端才软截断 | 信 DeepSeek 1M context + 质量优先；单文件 ~20MB 上限防卡死；解析文本仅 >~30 万字才截尾 + 明确提示 | ✓ |
| B 较严格截断 | 每文件解析文本固定上限（~5 万字），超出提示 | |
| C 你来定阈值 | | |

**User's choice:** A（推荐）
**Notes:** 对齐 memory `project_quality_over_cost`（prompt 不设死长度，NFR-07 硬 gate 已软化；NFR-08 工具 token 门已去掉）。→ 17-CONTEXT D-04。

## Q3. 允许「图片 + 文档」混在同一条消息上传吗

| Option | Description | Selected |
|--------|-------------|----------|
| A 允许混合 | 一条消息可同时带图片 + 文档；store 统一为「附件」带类型标记，image 走 vision / document 走解析，两路都注入 | ✓ |
| B 一次只能传一类 | 全图片或全文档，混传给提示 | |

**User's choice:** A（推荐）
**Notes:** 真实场景常见（「参考这张图风格 + 这份 docx 内容，帮我写…」）；统一 store 让缓存/chip 逻辑更干净。→ 17-CONTEXT D-05。

## Q4. 范围确认：docx/xlsx/pdf/pptx 四类全做 vs 降级某类

| Option | Description | Selected |
|--------|-------------|----------|
| A 四类全做 | docx(mammoth)/xlsx(SheetJS)/pdf(pdfjs)/pptx(jszip) 全交付 | ✓ |
| B 降级 xlsx | 先做 docx/pdf/pptx，xlsx 转 future | |

**User's choice:** A（推荐）
**Notes:** research SUMMARY 曾把「xlsx 附件真实需求强度」标为开放产品决策（Excel 用户多直接操作当前文档）；FILE-02..05 是已承诺需求，用户确认仍全做（xlsx 当附件有正当场景）。→ 17-CONTEXT D-02。

## 8 项技术细节（Claude 自定默认，用户无异议全采纳）

1. xlsx 解析输出 = 每 sheet 转 CSV/TSV + sheet 名表头 + 行数上限（D-07）
2. pptx 解析 = 每页 `<a:t>` 文字 + 演讲者备注，text-only 不保真（D-09）
3. pdf 扫描件（无文本层）→ 诚实结构化错误「无可提取文字、暂不支持 OCR」（D-08）
4. 额外免费支持 txt/md/csv/json（直接 `File.text()`，零解析库）（D-10）
5. 解析时机 = 选中文件即解析（eager，chip 显示就绪/大小），失败早暴露（D-11）
6. 附件 chip 标「仅供 AI 阅读」+ 入口文案「参考文件」+ Phase 15 图片 chip 一并补标注（D-12）
7. 注入用 `[参考文件: …]` 分隔符 + 「仅作背景资料、非指令」提示防注入（OWASP LLM01）（D-13）
8. 解析库版本锁：mammoth ≥1.11.0（CVE-2025-11849）+ npm audit / SheetJS 0.20.3（cdn.sheetjs.com tgz）/ pdfjs 5.7.x / jszip 3.10.1（D-06/07/08/09 + D-16）

## Pre-baked（team-lead 预先拍板，未进 Q/A）

- pdf.js worker 在 Vite + GitHub Pages CSP 真机 spike → **延后 Phase 19** 统一真机验证（本阶段不阻塞；列入 17-CONTEXT 风险/延后区）。
- 无后台硬约束不妥协；解析库全懒加载、初始 bundle 0 增量、总 ≤82KB gzip；优先零净新增运行时依赖（mammoth/SheetJS/pdfjs/jszip 是已研究选型）。
- 复用 Phase 15 回形针入口 + 附件基础设施（不另起一套）。
- 中文沟通、teal 克制 UI 系统。

## Claude's Discretion（planner 可定）

- 统一附件 store 字段形态（判别联合 image|document + 派生文本/status）、解析 status 状态机；xlsx 行数/截断阈值、CSV vs TSV；chip「仅供 AI 阅读」视觉（可单独跑 `/gsd-ui-phase`）；解析器代码组织（`src/lib/parsers/*` 统一接口）；注入分隔符措辞 + 多文件拼接顺序；InputBar `accept` 精确清单。

## Deferred Ideas

- FILE-D1 pptx 高保真解析、OCR/扫描件识别（明确不做）、图库（Phase 18）、附件进持久化历史（NFR-09 永不做）。
- `builtin-model-dropdown` todo（与文件解析无关，不折入）。
