---
phase: 18
slug: lib
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 18-RESEARCH.md §Validation Architecture（L571-625）. Task IDs 对齐 18-01/02/03-PLAN.md。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（已有 `vitest.config.ts`） |
| **Config file** | `vitest.config.ts`（项目根） |
| **Quick run command** | `npm test -- --run src/agent/operationLog.integration.test.ts` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~全量 unit + integration（Phase 17 后 857+ tests），约数十秒 |

---

## Sampling Rate

- **After every task commit:** `npm test -- --run`（本项目无 wave 分支，每 commit 跑全量保证 inverse replay / NFR-09 守门不漏）
- **After every plan wave:** `npm test -- --run`（全量）
- **Before `/gsd-verify-work`:** 全量绿 **且** `npm run build && npm run size`（main-*.js ≤82KB gzip）**且** `npm run extract`（messages.po 同步）
- **Max feedback latency:** < 60s（全量套件运行时间）
- **Phase 19 UAT（真机，非本阶段）:** Pexels 双重 CORS（api.pexels.com 检索 + images.pexels.com CDN fetch→base64）在 Office for Web Edge/Chrome 实测——本里程碑最高风险项。

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|------|--------|
| 18-01-01 | 01 | 1 | LIB-01 | — | STORAGE_KEYS 新增 PEXELS_API_KEY/BASE_URL | unit | `grep PEXELS_API_KEY src/lib/storage.ts` | storage.ts | ⬜ |
| 18-01-02 | 01 | 1 | LIB-01 | T-18-01 | searchPexels 裸 key（无 Bearer）+ 429→RateLimitError + URL→裸 base64；apiKey 不进 error | unit | `npm test -- --run src/providers/pexels-client.test.ts` | pexels-client.test.ts ❌W0 | ⬜ |
| 18-01-03 | 01 | 1 | LIB-01 | T-18-02 | registry stock-image：缺 key→KeyInvalidError；有 key→config；baseURL 可配 | unit | `npm test -- --run src/providers/registry.test.ts` | registry.test.ts ✅追加 | ⬜ |
| 18-01-04 | 01 | 1 | LIB-01 | T-18-01/02/04 | 鉴权无 Bearer + 有/无 key 分支 + base64 裸格式断言 | unit | `npm test -- --run src/providers/pexels-client.test.ts src/providers/registry.test.ts` | 同上 | ⬜ |
| 18-02-01 | 02 | 2 | LIB-02/03 | T-18-02/05/06 | 工具 execute：reverse(delete_shape_by_id Record)+postState(ppt_shape_new camelCase)；data 含署名、无 base64；timeoutMs=120s | unit | `npm test -- --run src/agent/tools/write/search-stock-image.test.ts` | search-stock-image.test.ts ❌W0 | ⬜ |
| 18-02-02 | 02 | 2 | LIB-02 | — | PPT_TOOLS 入集 + ppt/word 注册（casing 归一化守门） | unit | `npm test -- --run src/agent/tools/index.test.ts src/agent/tools/dispatch.test.ts` | index.ts | ⬜ |
| 18-02-03 | 02 | 2 | LIB-02 | — | Excel 不含、PPT/Word 含 search_and_insert_stock_image（D-11 per-host） | unit | `npm test -- --run src/agent/tools/tools-host.test.ts` | tools-host.test.ts ✅追加 | ⬜ |
| 18-02-04 | 02 | 2 | LIB-02 | T-18-05 | inverse replay：PPT→delete_shape_by_id→rolled_back；Word→noop_inverse→skipped_error（adapter_inverse_signature 铁律） | integration | `npm test -- --run src/agent/operationLog.integration.test.ts` | operationLog.integration.test.ts ✅追加 | ⬜ |
| 18-02-05 | 02 | 2 | LIB-02/03 | T-18-02 | 工具层无 base64 + chat.ts serialize 路径 D（tool role 整条丢弃，NFR-09 双层守门） | unit | `npm test -- --run src/agent/tools/write/search-stock-image.test.ts src/store/chat.test.ts` | search-stock-image.test.ts ❌W0 + chat.test.ts ✅追加 | ⬜ |
| 18-02-06 | 02 | 2 | — | — | insertImage.ts 删除（执行前 git grep 零调用方复核）+ 4 处注释清理；无回归 | build | `git grep -c "insertImage" -- 'src/**'`（=0）+ `npm test -- --run` | insertImage.ts(del) | ⬜ |
| 18-03-01 | 03 | 2 | LIB-01 | T-18-07 | Settings Pexels key pref-section：password 框 + storage 存/清 round-trip（partitioned localStorage） | unit | `npm test -- --run src/components/Settings/SettingsPanel.test.tsx` | SettingsPanel.test.tsx ✅追加 | ⬜ |
| 18-03-02 | 03 | 2 | LIB-03 | T-18-08 | StockImageResultCard：远程 URL 缩略图 + Pexels/摄影师可点链接（rel=noopener）+ 不叠水印 | build | `grep -c 'rel="noopener' src/components/StockImageResultCard.tsx`（≥2） | StockImageResultCard.tsx | ⬜ |
| 18-03-03 | 03 | 2 | LIB-03 | T-18-02 | ChatStream 据 thumbnail_url+photographer 识别图库结果 lazy 渲染署名卡（与生图卡互斥） | unit | `npm test -- --run src/components/ChatStream.test.tsx` | ChatStream.tsx | ⬜ |
| 18-03-04 | 03 | 2 | LIB-01/03 | — | npm run extract 同步 messages.po + Settings 存储 round-trip + bundle ≤82KB | gate | `npm run extract; npm test -- --run src/components/Settings/SettingsPanel.test.tsx; npm run build && npm run size` | messages.po / SettingsPanel.test.tsx | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/providers/pexels-client.test.ts` — 新建：auth 无 Bearer、query 构建、429→RateLimitError、URL→裸 base64
- [ ] `src/agent/tools/write/search-stock-image.test.ts` — 新建：无 key→PERMISSION_DENIED、reverse Record snake_case、postState 形状、data 无 base64、Word noop_inverse
- [ ] `src/agent/operationLog.integration.test.ts` — 追加 Phase 18 describe（PPT rolled_back / Word skipped_error；toolName 字面量）
- [ ] `src/providers/registry.test.ts` — 追加 stock-image 有/无 key 分支（KeyInvalidError 替换原 ModelNotFoundError stub 断言）+ baseURL override
- [ ] `src/agent/tools/tools-host.test.ts` — 追加 Excel 不含 / PPT/Word 含 search_and_insert_stock_image
- [ ] `src/store/chat.test.ts` — 追加 NFR-09 路径 D（图库 tool role 序列化丢弃 + 无 base64）
- [ ] `src/components/Settings/SettingsPanel.test.tsx` — 追加 Pexels key 存储 round-trip

*Vitest 框架已存在，无需安装。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pexels API 调用 CORS（api.pexels.com 在 Office Web iframe） | LIB-01 | 需真机 Office for Web Task Pane iframe 环境（CSP/CORS 比普通页严格） | Phase 19 UAT：sideload Aster → 填真实 Pexels key → chat「找张海边日落的图插进来」→ 看检索是否被 CORS 拦 |
| 图片字节 CORS（images.pexels.com CDN fetch→blob→base64） | LIB-02 | `<img src>` 显示不受 CORS 限，但 fetch→blob 受限；CDN 是否带 ACAO 未实测（比 API 面更易失败） | Phase 19 UAT：上一步若检索通，看 full-res fetch→插入是否成功；失败兜底 = Cloudflare Worker（baseURL 可配，已预留） |
| 插图视觉 + 署名展示 | LIB-02/03 | 真机看 slide/文档实际插入 + chat 内署名链接可点、图上无水印 | Phase 19 UAT：插入后确认 slide 出现图、chat 显示「照片来自 Pexels · 摄影师 X」可点、图片本身无水印 |

> **本阶段交付** = 按直连实现 + 本地 dev / 单测验证全绿；**线上真机 CORS 验证统一在 Phase 19 UAT**（与 Phase 17 pdf.js worker 同批）。CORS 失败兜底（Cloudflare Worker）已在设计层预留（D-09 baseURL 可配），不在本阶段实现。
