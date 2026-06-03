# Phase 18（LIB — Pexels 图库检索）代码审查 REVIEW.md

**审查者**：teammate `code-review-18`（GSD `gsd-code-review` step）
**日期**：2026-06-03
**审查范围**：commit `926403e` / `015c39d` / `64919ab`（`git diff 5b65d38..HEAD`）
**结论**：✅ 无 HIGH、无需修复的正确性类 MEDIUM。实现干净、与 Phase 16 范式一致、四重 gate 全绿。**未做任何代码修改**（无可修项）。1 个 MEDIUM 设计缺口 + 若干 LOW 仅报告，延 Phase 19 真机。

---

## 1. 问题分级清单

### HIGH
（无）

### MEDIUM
| # | 文件 | 问题 | 处置 |
|---|---|---|---|
| M-1 | `src/agent/tools/write/search-stock-image.ts` L129 | **CORS 兜底口只覆盖「检索」，未覆盖「取图」。** `searchPexels` 经 `baseURL`（`PEXELS_BASE_URL` 可 override，切 Worker 生效）；但 `fetchPexelsImageToBase64(photo.src.large)` 直连 `images.pexels.com` CDN，**不经 baseURL override**。若真机上 full-res `fetch()+blob()` 被 CORS 拦，单切 `PEXELS_BASE_URL` 救不了取图（Worker 不会重写图片 URL）。与计划「取图/检索都经统一函数」目标存在分歧。 | **不修**（留 Phase 19）。理由：①代码已显式标注「CORS 风险面二，Phase 19 UAT」；②`images.pexels.com` 作为公开图床 CDN **很可能本就返回 `ACAO:*`**（取图根本不需要 Worker），真假需真机 Office Web iframe 验证；③真正修复需设计决策（Worker 是否代理任意图片 URL，含安全面）+ 真机验证，超出 review-fix step 边界。 |

### LOW（仅报告，主观/可接受）
| # | 位置 | 说明 |
|---|---|---|
| L-1 | `search-stock-image.ts` L124 | 永远取 `photos[0]`（最简策略）。「挑最匹配」靠 alt 相关性的逻辑未实现——但「换一张」= AI 递增 page（D-05），设计如此，可接受。 |
| L-2 | `search-stock-image.ts` L108/131/211/287 | `console.error(..., err)` 打 err 对象到 devtools。已确认 err 恒为固定中文字面量的 `AsterError`（`NetworkError`/`RateLimitError`），**不含 key**；且 search-stock-image 比 `ppt-image.ts` 更保守（hint 用固定字面量，不像 ppt-image L133 透传 `err.message`）。可接受。 |
| L-3 | `search-stock-image.ts` L41 | `PEXELS_LOCALE='zh-CN'` 硬编码——D-04 设计如此（只影响元数据排序，不影响英文关键词召回）。 |

---

## 2. 修了哪些 / 留了哪些

- **修复**：无。代码无需任何改动即满足全部约束。
- **留下**：M-1（CORS 取图缺口）→ Phase 19 真机；L-1/L-2/L-3 主观可接受项。

---

## 3. Pexels 裸 key + apiKey 仅 header 核实 ✅

- **裸 key（无 Bearer）确认**：`pexels-client.ts` 中 3 处 "Bearer" 全在注释（L4、L5 docstring；L54 行尾注释 `// ⚠️ 裸 key，无 Bearer`）。**运行时 header = `{ Authorization: apiKey }`（L54），裸 key 无前缀。** 测试 `pexels-client.test.ts` L47-57 硬断言 `auth === 'test-key'` 且 `not.toMatch(/Bearer/)`。
- **apiKey 仅进 header**：`grep apiKey` 仅命中函数形参（L40）+ Authorization header（L54）。GET 请求无 body。`catch {}` 不绑 err；所有错误用中文字面量（`NetworkError('Pexels 检索网络失败')` 等），不 interpolate status/body/err。**apiKey 不入 body、不入 error.message、不进任何 console**（searchPexels 内无 console 调用；tool 层 console.error 的 err 是无 key 的 AsterError）。T-14-01 ✅

## 4. reverse 路径 + Record 参数核实 ✅

- **走标准 write-tool reverse 路径**：execute 返回 `reverse` descriptor + `postState`（PPT），**绝无手动 `appendOperation`/调 helper**——loop-helpers 据此自动追加（与 `ppt-image.ts` 逐行一致）。
- **PPT**：`reverse = { tool: 'delete_shape_by_id', args: { slide_index, shape_id } }`（**Record 对象、snake_case，非位置参** — memory `adapter_inverse_signature` 铁律）；`postState = { kind: 'ppt_shape_new', content: { slideIndex, shapeId } }`（camelCase）。`operationLog.ts` 确认 `ppt_shape_new`（L43）、`delete_shape_by_id`（L157）case 存在。
- **Word**：`reverse = { tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } }`，无 postState。诚实标注。
- **integration test 两条守门真实有效**（`operationLog.integration.test.ts` L1264-1297，用**真 PptAdapter** 跑 replay）：
  - PPT：`delete_shape_by_id` → **rolled_back** ✅
  - Word：`noop_inverse` → **skipped_error** ✅
  - toolName 字面量 `'search_and_insert_stock_image'`（L1272/1288）满足 D-17 fs 扫描。
- adapter 方法签名匹配：`PptAdapter.addImageShape(slideIndex, base64, position): Promise<{newShapeId}>` ✅；`WordAdapter.insertBodyImage(base64: string)` ✅，工具调用 `insertBodyImage(r.base64)` 位置正确。

## 5. CORS baseURL 可配核实 ✅（检索路径贯通；取图见 M-1）

- `registry.ts` L143-157 `stock-image` case：`baseURL = storage.get(STORAGE_KEYS.PEXELS_BASE_URL) ?? PEXELS_DEFAULT_BASE_URL`。**默认直连 `https://api.pexels.com/v1`**（`pexels-client.ts` L12）。
- `searchPexels(query, apiKey, cfg.baseURL, ...)` 检索经统一函数 + 可配 baseURL，失败只换 `PEXELS_BASE_URL` 即切 Worker，不动工具/UI。✅
- `STORAGE_KEYS.PEXELS_BASE_URL`（storage.ts L53）= `'aster:config:pexels-base-url'`，无 UI、仅 CORS 失败后手动/Worker 切换。
- ⚠️ **取图路径未经 baseURL**（见 M-1）。

## 6. NFR-09 核实 ✅

- **base64 不进 persisted history**：`serializeForStorage`（chat.ts L122-127）白名单只留 `user|assistant` 非 streaming，**tool role 整条丢弃**——结构性守门，即便误把 base64 塞进 `data` 也拦得住。
- **署名卡用 thumbnail 远程 URL**：`StockImageResultCard` 用 `photo.src.tiny`（远程 URL，`<img src>` 不受 CORS 限制），非 base64；外链带 `rel="noopener noreferrer"`（T-18-08 防 tabnabbing）。
- **chat.test.ts 路径 E 守门有效**（L404-438）：断言 tool role 不进 serialize、模拟 base64 + `thumbnail_url` + `inserted` 标记均不出现在序列化结果。✅
- `ChatStream.tsx` L133-143：stockResult 用 `d.thumbnail_url` 远程 URL，与生图 `d.thumbnail` base64 互斥。StockImageResultCard 保持 **lazy**（L51）。

## 7. 修复后四重 gate（基线复跑，无修改）

| Gate | 结果 |
|---|---|
| `npm run build` | ✅ built in 2.92s（先 build 再 size，无陈旧 dist 假绿） |
| `npm run size` | ✅ **80.53 kB gzipped ≤ 82 kB**（余量 1.47 KB，未破门；StockImageResultCard lazy） |
| `npm test` | ✅ **885 passed (72 files)**；尾部 3 个 retry.test 的 unhandled NetworkError = 已知噪音（memory `i18n_extract_and_test_noise`），非真失败 |
| `npx tsc --noEmit` | ✅ exit 0，0 错误（含确认 `insertImage.ts` 删除后无悬空 import） |

> 未动 Lingui 宏（无 UI 文案增删，Settings Pexels 字段在 commit `64919ab` 已 extract），故无需重跑 `npm run extract`。

## 8. 追加 Phase 19 待验真机项

1. **【M-1 关键】图片 full-res CORS**：真机 Office Web iframe 验证 `images.pexels.com` 的 `fetch()+blob()` 是否被 CORS 拦。若拦 → 需扩展 Worker 代理图片 URL（或确认 CDN 返 `ACAO:*` 则无需）。当前 `PEXELS_BASE_URL` override 救不了取图。
2. **检索 API CORS**：真机验证 `api.pexels.com/v1/search` 浏览器直连是否被拦；若拦，验证切 `PEXELS_BASE_URL` 到 Worker 能救（这条 override 路径已贯通，待真机确认有效）。
3. **裸 base64 直插真机**：`fill.setImage(裸 base64)`（PPT）/ `insertInlinePictureFromBase64`（Word）在 Office Web 真机插图成功（对齐 Phase 16 生图直插已验路径）。
4. **dispatchTool 120s 超时**：慢网/大图取图不被默认 15s 误杀（`STOCK_IMAGE_TIMEOUT_MS` 已设 120s，待真机确认）。
5. **BYO key UX**：Settings 密码态单行 `.input` 字段输入/清空/持久（partitioned localStorage）+ 缺 key 时 KeyInvalidError 气泡引导。
6. **「换一张」翻页**：AI 递增 `page` 重调工具的多轮行为。
