# Aster Phase 0 Spike — 证据归档清单

**Phase 0 时间盒：** ≤ 1 周（2026-05-26 开始）
**GATING 规则：** #1/#2/#3 任一 FAIL → 停止，写 GATING-FAILED-{N}.md，不进 Phase 1

此清单由 Phase 7 REL-05 regression 直接使用——所有项在 v1.0 发布前需重跑一次并全部 PASS。

## 状态说明

- `PENDING`：尚未执行
- `IN_PROGRESS`：测试代码已就绪，等待 GitHub Pages 部署或用户手动跑实测
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
| 4 | 004-deepseek-multimodal | deepseek-v4-pro 发 image_url content block，判断是否原生多模态 | 非 GATING | IN_PROGRESS | [详情](004-deepseek-multimodal/findings.md) |
| 5 | 005-api-mixing | setSelectedDataAsync × PowerPoint.run 混用挂死（#5022）验证 + workaround | 非 GATING | PENDING | [详情](005-api-mixing/findings.md) |
| 6 | 006-getselectedslides-order | getSelectedSlides() 反序 bug (#3618) workaround：按 index 排序 | 非 GATING | PENDING | [详情](006-getselectedslides-order/findings.md) |
| 7 | 007-pdfjs-production-build | Vite 生产构建 pdf.js worker 独立文件，加载 5MB PDF，不在 localhost | 非 GATING | IN_PROGRESS | [详情](007-pdfjs-production-build/findings.md) |
| 8 | 008-pptx-text-extraction | jszip + DOMParser ~80 行从 pptx 提取 &lt;a:t&gt; 文本，3 个真实 pptx 文件 | 非 GATING | IN_PROGRESS | [详情](008-pptx-text-extraction/findings.md) |
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
