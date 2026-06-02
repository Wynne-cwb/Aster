# Phase 18: LIB — 公开图库检索（Pexels, BYO key） - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

> **GSD 命名说明：** 本项目 discuss 产物沿用 `NN-CONTEXT.md`（plan-phase 消费的权威决策文件）+ `NN-DISCUSSION-LOG.md`（审计轨迹），即 team-lead 口中的「DISCUSS.md」。下游 planner 读本文件。

> 🔴 **PLANNER 必读 — Q1 拍板 = 自动直插（不是网格手动选）。** 真人用户经 team-lead 拍板 **Q1=B「AI 自动检索 + 自动选首张直插」**，与 Phase 16 生图 + memory `project_image_insert_autonomous`（「Phase 18 图库同此」）完全一致；**否决了** ROADMAP §18 success criteria 字面写的「缩略图网格 + 选中插入」**手动选** UX。所以 `search_stock_image` 是 **loop 内 write tool**（照抄 `generate_ppt_image` 范式），**不做**缩略图网格手动选交互。**这条实质改写了几个早期 baked 默认（见 D-01/D-02/D-06 的 reconcile 标注）。**

<domain>
## Phase Boundary

Phase 18 让 agent 能从 **Pexels 公开图库**检索免费正版照片并**插入 PPT / Word**，复用 **Phase 16 已交付的插图基础设施**（adapter 插图方法 + reverse/undo 范式）。用户用**自带（BYO）Pexels API key**，零后台、纯浏览器直连。

**做什么（需求映射）：**
- **LIB-01** — Pexels 检索：Settings 新增 **BYO Pexels API key 独立字段**（不内置，符合 BYO/无后台/开源原则）；native fetch + `Authorization` header + `locale=zh-CN`。
- **LIB-02** — 检索结果 → 插入：**AI 自动选首张** → fetch full-res → 转裸 base64 → **复用 Phase 16 插图路径**（PPT 当前 slide / Word body）。
- **LIB-03** — chat 内显示 Pexels 摄影师署名 + 链接（满足授权；**不在插入图片上叠水印**，保 slide 视觉）。

**不做（下游 / 已交付 / 否决）：**
- **缩略图网格手动选 UX**（ROADMAP §18 字面）—— **Q1=B 否决**，改 AI 自动直插（见 D-01）。
- **Unsplash 等其它图库**（LIB-D1 deferred；仅 Pexels）。
- **Excel 插入图片**（无原生插图 API，诚实提示，同 Phase 16 IMG-05）。
- 生图（Phase 16 已交付）；文件解析（Phase 17）；视觉看图（Phase 15 已交付）。
- **内置共享 Pexels key**（开源仓库硬编码必被爬走滥用/封号，违反 BYO/无后台 —— REQUIREMENTS Out of Scope）。

</domain>

<decisions>
## Implementation Decisions

> Q1–Q3 经 team-lead 转达真人用户拍板（2026-06-02）。**Q1=B（自动直插）与 discuss 推荐相反**，用户选了与 Phase 16 一致的 agentic 路线；Q2=A、Q3=A 同推荐。其余 8 项 baked 默认用户无异议全采纳。详见 18-DISCUSSION-LOG.md。

### 核心流程：检索→插入（Q1=B「AI 自动直插首张」，**反转早期 grid-select 推荐**）
- **D-01（`search_stock_image` = loop 内 write tool，照抄 Phase 16 生图范式）:** AI 把用户自然语言（「找张海边日落的照片插进来」）→ 调 `search_stock_image` 工具 → Pexels 检索 → **AI 自动选首张（可依 query 选最匹配的一张，非机械第 0 个）** → fetch full-res → 转裸 base64 → 插入当前 slide（PPT）/ body（Word） → **返回 `shape_id`（PPT）供 AI 后续用 `move_shape`/`set_shape_property`/`rotate_shape` 自主排版**。
  - **ToolDef 范式 = `generate_ppt_image`/`generate_word_image` 直接照抄**（`src/agent/tools/write/ppt-image.ts` / `word-image.ts`）：snake_case 参数、`kind:'write'`、**`timeoutMs` 覆盖默认 15s**（Pexels 检索 + full-res 图片 fetch 可能慢，沿用 Phase 16 的 `IMAGE_GEN_TIMEOUT_MS=120_000` 思路，planner 按实测定值，至少几十秒）、`humanLabel` 中文、三态结构化错误。
  - **per-host 注册**：PPT host 注册 `search_stock_image`（或 `search_and_insert_stock_image`，命名 planner 定）入 `PPT_TOOLS` Set（casing 归一化守门，Phase 14 D-10）+ ppt case；Word host 注册对应工具；Excel **不注册**（D-11）。
  - ⚠️ **反转点（planner 必读）：** discuss 初稿 baked 默认 #1 写的是「复用 `insertImage` helper（UI 按钮触发、脱离 loop）」——那是为 **Q1=A（已否决）grid-select** 设计的。Q1=B 下**不走** helper 的手动 appendOperation，见 D-02。

- **D-02（undo/operationLog = 标准 write-tool reverse 路径，**不用** `insertImage` helper 的手动 appendOperation）:** 🔴 **planner 必读 reconcile。**
  - **正确路径**：`search_stock_image` 的 `execute` **直接调 adapter 插图方法**（`PptAdapter.addImageShape(slideIndex, base64, position)` / `WordAdapter.insertBodyImage(base64)`）→ **返回 `reverse` descriptor + `postState`** → **loop-helpers 自动 `appendOperation`**（单一 undo 记录）。与 `generate_ppt_image` 完全一致。
    - PPT reverse：`{ tool: 'delete_shape_by_id', args: { slide_index, shape_id } }`（Record 对象，snake_case，非位置参 —— memory `project_adapter_inverse_signature`）；postState `{ kind:'ppt_shape_new', content:{ slideIndex, shapeId } }`（camelCase，与 `operationLog.integration.test` 守门一致）。
    - Word reverse：`{ tool: 'noop_inverse', args: { reason: 'Word 图片插入暂不支持自动撤销' } }`（诚实标注，DiffLog 显示「此操作不支持自动撤销」）。
  - **不要**调用 `src/lib/insertImage.ts` helper：它做**手动 `appendOperation`**（为脱离 loop 的 UI 按钮路径设计），在 loop 工具里用会**重复记录 / stepIndex 冲突**（`ppt-image.ts` L10-13 头注释明确警告这点）。
  - **`src/lib/insertImage.ts` 处置**：该 helper 文件头注释写明「保留是为 Phase 18 Pexels 图库『选中插入』复用（届时由 UI 按钮触发，非 loop 内）……若 Phase 18 决定也走工具路径，可删除本文件」。Q1=B 既走工具路径，该 helper **无调用方**——planner 可**删除 `insertImage.ts`**（连同其测试，若有）或留着不动（它不进 main bundle、无副作用）。建议删除以免误导后人。**真正复用的是 Phase 16 的 adapter 插图方法 + reverse 范式，不是这个 helper 包装。**

- **D-03（插入字节获取 = fetch Pexels full-res URL → 裸 base64）:** Pexels 检索返回的是**远程图片 URL**（`photo.src.original/large2x/large/...`），但 adapter 插图方法（`fill.setImage` / `insertInlinePictureFromBase64`）只吃**裸 base64**（无 `data:` 前缀，Phase 16 16-02 真机实测确认）。
  - 工具内 `fetch(photo.src.<size>)` → `blob` → base64（**复用 Phase 16 的 doubao URL→base64 转换思路**：`src/providers/aihubmix-image.ts` 内 `fetchUrlToBase64`，Phase 16 16-03 已建并透传 `signal`）。planner 决定复用该函数还是在 pexels client 内写等价小函数。
  - **选哪个尺寸**：插 PPT/Word 用 `large` 或 `large2x`（够清晰、不至于过大拖慢 fetch / 撑 P95）；planner 定，避免 `original`（可能数 MB）。
  - **⚠️ 这是 CORS 风险面之二**（`images.pexels.com` CDN）——见 Deferred「Pexels 双重 CORS 面」。

### 搜索关键词语言（Q2=A「AI 转英文搜」）
- **D-04（AI 把用户意图翻成英文关键词检索，UI/locale 仍中文）:** Pexels 是西方图库、内容标签以英文为主，**中文 query 召回少/质量差**（research SUMMARY 已标 Pexels 中文质量为 MEDIUM 风险）。
  - **做法**：AI 在工具 `query` 入参里**自己写好英文检索词**（如用户说「海边日落」→ AI 传 `query:"seaside sunset"`），类比 Phase 16 D-03「agent 智能增强中文 prompt」的质量优先思路（memory `project_quality_over_cost`）。工具描述里**明确指引 AI 传英文 query**。
  - `locale` 参数仍可传 `zh-CN`（影响 Pexels 返回的本地化元数据/排序，不影响英文关键词匹配）；UI 文案全中文。
  - 否决 B（直接中文搜，召回弱）/ C（中英双轨回退，复杂度高、early-user 阶段不必要）。

### 「换一张 / 下一张」（沿用 Phase 16 regenerate 范式）
- **D-05（再试 = AI 取下一检索结果或重新检索再插）:** 用户说「换一张 / 下一张 / 不要这张」→ AI **取同一批检索结果的下一个**（工具可返回候选列表的游标 / 或工具支持 `offset`/`page` 参数让 AI 翻页）**或重新检索**，再走 D-01 插入。与 Phase 16「对话式重新生成」（IMG-04）一致，**不做**网格让用户手动点选。
  - 实现提示（Claude discretion）：工具可在 `data` 里带回「本次检索还有 N 张候选 / 下一页可用」让 AI 知道能继续翻；或每次「换一张」AI 重调工具带递增 `page`。planner 定最简形态。

### 结果展示 + 署名（LIB-03，Q1=B 下的只读形态）
- **D-06（chat 内只读展示，无网格手动选）:** 按自动直插哲学，**不做缩略图网格手动选 UI**。
  - **可选**（Claude discretion）：保留一个**只读结果缩略图卡**（仿 Phase 16 `ImagePreviewCard` 只读化形态——Phase 16 16-05 已把它改成无确认/重生/取消按钮的只读结果卡），展示「这张已插入的图」+ 署名。**不带任何手动选择交互。** 缩略图可直接用 Pexels 远程 URL（`photo.src.medium/tiny`）渲染 `<img src>`（img 显示不受 CORS 限制），**无需 base64**。
- **D-07（署名 = chat 内 text note + 可点链接，不叠水印，LIB-03）:** 每张插入的图在 chat 内配一条只读署名：「照片来自 Pexels · 摄影师 [name]（可点链接 → `photo.photographer_url` / `photo.url`）」。**绝不在插入的图片上叠水印**（保 slide 视觉，LIB-03 + ROADMAP 明确）。多图各自一条署名。
  - Pexels attribution 政策宽松（不强制每图 UTM 署名，区别于 Unsplash）——chat 内显示即满足授权（research SUMMARY L33）。

### BYO Pexels key 存储 + Settings 落点（Q3=A「独立 Settings 字段」）
- **D-08（独立 Settings 字段，不塞进 LLM Provider 列表）:** Settings 全局选项区新增**独立「图库 / Pexels API Key」输入框**，仿现有 image-gen model picker 的 **pref-section 范式**（`src/components/Settings/SettingsPanel.tsx` L192-213 的 `.aster-settings__section` + `.aster-settings__pref-input` / `.aster-settings__select`）。
  - **理由**：Pexels 不是 LLM、没有 model/baseURL 给用户编辑，塞进 `ProviderList`/`ProviderForm`（为 chat LLM 设计、要填 baseURL/model）会很别扭。独立字段最干净、最符合 teal 克制 UI。
  - **存储**：新增 `STORAGE_KEYS.PEXELS_API_KEY`（建议字面 `'aster:keys:pexels'`，沿用 `KEY_PREFIX='aster:keys:'` 约定）→ `storage.set/get`（partitioned localStorage，partition 自动注入，Phase 0 GATING #3 已验）。teal 克制风、密码态输入框（`type="password"` 或可切显隐，planner 定）。
  - i18n：新增 Lingui 宏字符串后**必跑 `npm run extract`**（memory `project_i18n_extract_and_test_noise`，否则 coverage.test 红）。

### registry 路由 + Pexels client（接线）
- **D-09（填实 registry `stock-image` case）:** `src/providers/registry.ts` L142-143 现为 stub（`throw new ModelNotFoundError('stock-image Provider 未配置（v1 不含图库）')`）；TaskKind 已含 `'stock-image'`。
  - 填实：读 `storage.get(STORAGE_KEYS.PEXELS_API_KEY)`，缺失 → `throw new KeyInvalidError('Pexels Key 未配置，请在设置中填写图库 Key')`（沿用现有错误体系，UI 层展示气泡）；返回 config（`{ providerId:'pexels', baseURL, apiKey, ... }`）。
  - **baseURL 设计为可配**：默认 `'https://api.pexels.com/v1'`；**留 Cloudflare Worker 兜底切换口**（如读一个可选 storage override / 常量集中点），让「CORS 失败后平滑切 Worker 代理」**只需改 base URL 不动调用逻辑**（见 Deferred 兜底路线）。默认实现**纯浏览器直连**。
- **D-10（新建 Pexels client + 鉴权 gotcha + 0 净新增依赖）:** 新建 `src/providers/pexels-client.ts`（仿 `aihubmix-image.ts` 结构），native fetch、**0 净新增运行时依赖**（**不装 `pexels` / `unsplash-js` npm 包**，REQUIREMENTS Out of Scope）。
  - 🔴 **鉴权 gotcha**：**Pexels 用 `Authorization: <API_KEY>`（裸 key，不加 `Bearer` 前缀！）**——区别于现有 aihubmix/openai 的 `Authorization: Bearer <key>`（`src/lib/sse.ts` L316-333）。planner 勿照抄 Bearer 范式。
  - apiKey **仅进 header，不进 body / 不进 error.message**（T-14-01 继承；错误用字面量中文，不 interpolate err.message，防 key 泄漏）。
  - 接口建议（Claude discretion）：`search(query, opts): Promise<PexelsPhoto[]>`，含 `per_page`/`page`/`locale`/`signal`；`PexelsPhoto` 取 `{ id, src.{large,medium,tiny,...}, photographer, photographer_url, url, alt }`。

### Excel out-of-scope（同 IMG-05）
- **D-11（Excel 不注册工具 + 诚实提示）:** 图库插入工具**只在 PPT / Word 注册**；Excel 宿主下用户要求插图库图，agent 诚实回答「Excel 无原生插图 API，暂不支持插图」。不假装支持（memory `project_ppt_officejs_gotchas` / Phase 16 D-09）。

### 数量 / 错误 UX
- **D-12（per_page 数量，Claude discretion）:** AI 拿到足够候选以「选首张 + 支持『下一张』循环」即可；**无网格 UI 故不需为展示拉很多张**。建议 `per_page` 10-15（够 AI 翻几张），planner 定。
- **D-13（诚实结构化错误 `{code,message,recoverable,hint}`，沿用 Phase 15 D-13 / Phase 16）:**
  - 未配 key → `PERMISSION_DENIED`「Pexels Key 未配置，请在设置中填写图库 Key」（不可恢复，引导去 Settings）。
  - 速率超限（Pexels 200 req/h，429）→ `HOST_API_FAILED`「Pexels 检索过于频繁，请稍后再试」（可恢复）。
  - 无结果 → 友好提示「没找到匹配的图片，换个描述试试」（可恢复，引导 AI 换 query）。
  - CORS / 网络失败（检索 or full-res fetch）→ `HOST_API_FAILED`「图库检索/取图失败，请重试」（可恢复，hint 携安全错误信息）。
  - 插入失败 → 同 Phase 16「PPT/Word 图片插入失败，请重试」。
  - **绝不假成功**（memory：诚实失败）。

### NFR 守门（NFR-09 延续 + bundle）
- **D-14（NFR-09 延续：插入图字节不进持久化历史）:** 插入用的 full-res base64 **只活在工具 execute 内 + adapter 插图 API 入参**，**绝不**进 `Message.content` / `serializeForStorage`（同 Phase 16 thumbnail 处置）。
  - **缩略图风险更小**：D-06 的只读卡缩略图用 **Pexels 远程 URL**（非 base64），即使进 `ToolResult.data` 也不是大字节；但若 result card 里**任何**字段携 base64，仍走 Phase 16 既有的「`data.thumbnail` 仅 UI 消费、不进 serialize」白名单（`src/store/chat.ts` serialize 白名单）。
  - **守门**：若新增任何携 base64 的 result 路径，**扩展 NFR-09 serialize 守门测试**（`src/store/chat.test.ts`，沿用路径 A/B/C/D 风格加断言）= memory `feedback_recurring_failure_add_gate`。
- **D-15（bundle ≤82KB gzip + teal UI + 中文）:** native fetch 零依赖 → 近零 bundle 增量（新增 pexels client + Settings 字段 + 可选只读卡，几 KB）；维持 `.size-limit.json` `main-*.js` ≤82KB gzip CI gate。**动 bundle 前先 `npm run build` 再 `npm run size`**（memory `project_bundle_size_guard`：size 测陈旧 dist 给假绿）。teal 克制 UI（加载 `aster-design-system` skill），全中文。

### Claude's Discretion（planner 可定）
- 工具命名（`search_stock_image` vs `search_and_insert_stock_image` —— 既然是检索即插，名字宜体现「插入」语义）、`timeoutMs` 具体值（≥几十秒，覆盖检索+full-res fetch）。
- per_page 数量、full-res 取哪个尺寸（建议 `large`/`large2x`，避 `original`）、`fetchUrlToBase64` 复用 vs 新写。
- D-05「换一张」的最简实现（工具返候选游标 vs AI 重调带 `page`）。
- D-06 只读结果卡做不做 / 形态（仿 Phase 16 `ImagePreviewCard` 只读态；署名是独立 text note 还是卡内一行）。
- `insertImage.ts` helper 删除 vs 保留不动（建议删，见 D-02）。
- pexels client 代码组织 + `PexelsPhoto` 类型字段、Settings 输入框显隐切换 / 校验（如「测试 Key」按钮，非必须）。
- registry baseURL 可配的具体机制（常量 + 可选 storage override）。

### Folded Requirements
- 本阶段交付 **LIB-01 / LIB-02 / LIB-03**。无折入其它阶段需求。

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents（planner / executor）MUST read these before planning or implementing.**

### 需求 + 路线（标准对照）
- `.planning/REQUIREMENTS.md` — **LIB-01/02/03**（L47-49）完整需求文；**Out of Scope**（L74-78：内置共享 key 否决 / 图片字节不进 history / Cloudflare Worker 仅 CORS 失败才触发）；**LIB-D1 Unsplash deferred**（L61）。
- `.planning/ROADMAP.md` §Phase 18（L171-181）— Goal / LIB-01..03 / **spike = Pexels CORS 三浏览器（本里程碑最高风险）** / 依赖 Phase 16 insert helper / 3 条 success criteria。
  - ⚠️ ROADMAP success criteria 1「返缩略图网格」**被 Q1=B 否决**（改自动直插）；criteria 2「选中图片插入（复用 insert helper）」→ 改「AI 自动选首张插入（复用 Phase 16 adapter 插图方法 + reverse 范式）」；criteria 3「chat 内署名 + 链接、不叠水印」**不变**。
- `.planning/ROADMAP.md` §Phase 19 — v2.2 UAT，**Pexels CORS 真机验证在此统一做**。

### Pexels 选型真相源
- `.planning/research/SUMMARY.md` — **L33** Pexels（非 Unsplash）理由：200 req/h（Unsplash 仅 50/h demo）、attribution 宽松（Unsplash 强制每图署名+UTM 会破坏 slide 视觉且违约吊 key）、native fetch + `Authorization` header + `locale=zh-CN`；**L36** 明确不加 `pexels`/`unsplash-js` npm 包；**L68/L108-111** 图库 = Pexels 检索 tool + 复用 MM-03 insert helper + CORS spike 最高风险；**L76** 图库/签名 URL CORS 无后台无 proxy 逃生路（失败则 Cloudflare Worker = 设计大变）；**L142/L153** Pexels CORS（Office Web iframe）MEDIUM 信心 + 内置 vs BYO 是开放产品决策（已定 BYO）。
- `.planning/research/STACK.md`（如需更细 Pexels API 字段/限额）。

### 复用目标代码（scout 实证，file:line — 已核验）
- **Phase 16 插图基础设施（主要复用面）：**
  - `src/agent/tools/write/ppt-image.ts`（**整个文件 = `search_stock_image` 的 PPT 范式样板**）：L42-188 `generatePptImageTool`——`timeoutMs` 覆盖（L37 `IMAGE_GEN_TIMEOUT_MS=120_000`）、snake_case 参数 + `required:['prompt']`、读 model 优先级（L82-85）、三态错误（L66-137）、**直接调 `ctx.adapter.addImageShape`（L142-147）→ 返回 `reverse`+`postState`（L162-186）走标准 write-tool 路径**、返回 `data.shape_id`（L177 供 AI 排版）、`data.thumbnail`（L181 NFR-09 仅 UI 消费）。
  - `src/agent/tools/write/word-image.ts` — Word 范式样板（`insertBodyImage` + `noop_inverse`）。
  - `src/adapters/PptAdapter.ts` L1659-1708 — `addImageShape(slideIndex, base64, {left,top,width,height}): Promise<{newShapeId}>`（addGeometricShape + fill.setImage 裸 base64 + 独立 run 回读，bug #5022 已规避）。
  - `src/adapters/WordAdapter.ts` L1785 — `insertBodyImage(base64): Promise<{width,height}>`（body 级 insertInlinePictureFromBase64，规避 range 级 bug #3434）。
  - `src/agent/operationLog.ts` — `appendOperation` / `OperationLogEntry` / inverse replay 调用签名 `adapter[method](reverse.args)`（全 dict）；loop-helpers 据 `execute` 返回的 reverse descriptor 自动 appendOperation。
  - `src/lib/insertImage.ts` —— ⚠️ **为 Q1=A（已否决）UI-select 路径建的手动 appendOperation helper；Q1=B 下不用、建议删（见 D-02）**。
- **生图 provider（URL→base64 + 鉴权对照）：**
  - `src/providers/aihubmix-image.ts` — `fetchUrlToBase64`（doubao 远程 URL → 裸 base64，Phase 16 16-03 建，透传 `signal`）= D-03 复用样板；`AihubmixImageClient.generate(prompt, config, {signal})` 结构 = pexels client 仿照对象。
  - `src/lib/sse.ts` L316-333 — `Authorization: Bearer <key>` + apiKey 从 body 提取仅进 header 范式（**Pexels 要改成裸 key，不加 Bearer —— D-10**）。
- **registry / 存储 / Settings：**
  - `src/providers/registry.ts` L92-150 — `ProviderRegistry.resolve(taskKind, getDefaultLLM)`；**L142-143 `stock-image` stub = D-09 填实点**；L112-140 vision/image-gen case = 「读 storage key、缺失抛 KeyInvalidError、返 config」样板。
  - `src/providers/types.ts` L24 — `TaskKind` 已含 `'stock-image'`；`ImageConfig` 接口。
  - `src/lib/storage.ts` L19-47 `STORAGE_KEYS`（`KEY_PREFIX='aster:keys:'` L23）+ L64-102 `storage.get/set/remove`（partition 自动注入 L56-62）= D-08 新增 `PEXELS_API_KEY` 落点。
  - `src/components/Settings/SettingsPanel.tsx` L86-93（image-gen model state + storage 读写范式）、L192-213（`.aster-settings__section` + `<select>` pref-section 渲染范式）= D-08 仿照点；L219-244（`.aster-settings__pref-input` 文本输入范式）。
- `.size-limit.json` + `package.json` `"size"` script — bundle ≤82KB gzip CI gate（D-15）。
- 懒加载/分 chunk analog（如需）：`vite.config.ts` `manualChunks`。

### 上游决策继承
- `.planning/phases/16-img-ppt-word/16-CONTEXT.md` — Phase 16 插图全套决策（D-06 PPT 居中尺寸默认、insert helper 抽象、reverse 范式、三态错误、loop 内直插反转 D-02 的产品方向）。
- `.planning/phases/14-mdl-aihubmix-provider-model-casing/14-CONTEXT.md` — apiKey 仅进 header（T-14-01）；PPT casing 中央 `normalizeToSnakeCase`（新工具入 `PPT_TOOLS` Set）；错误体系。
- `.planning/phases/15-vis/15-CONTEXT.md` — 三态结构化错误 `{code,message,recoverable,hint}` 范式（D-13）；NFR-09 serialize 守门范式。

### 项目硬约束 / 记忆
- memory `project_image_insert_autonomous` — 生图/插图走 AI loop 内自动直插（无确认卡），返回 shape_id 让 AI 自主排版；**「Phase 18 图库同此」= Q1=B 的依据，本阶段确认无需改 memory**。
- memory `project_no_backend_status` — v1/v2 维持无后台靠 CORS GATING；**fail 上 Cloudflare Worker 轻代理（不上阿里云 VM）**。
- memory `project_adapter_inverse_signature` — inverse/read 方法收 Record 对象（非位置参）；新 inverse 补 `operationLog.integration.test` 守门。
- memory `project_quality_over_cost` — 质量 >> 成本 & 包体积（D-04 英文搜、Pexels 默认更优召回的依据）；但 undo 守门 / bundle gate / P95 仍硬卡。
- memory `project_ppt_officejs_gotchas` — PPT snake_case 参数 + 网页版写操作可能静默 no-op（插图已由 Phase 16 adapter 写后回读兜住）。
- memory `project_bundle_size_guard` — 动 bundle 先 build 再 size；非热路径模块懒加载。
- memory `project_i18n_extract_and_test_noise` — 改 UI 动 Lingui 宏必跑 `npm run extract`。

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets（直接复用，不重造）
- **Phase 16 插图全链路**（最大复用面）：`PptAdapter.addImageShape` / `WordAdapter.insertBodyImage`（吃裸 base64、写后回读、bug 已规避）+ `generate_ppt_image`/`generate_word_image` 的**整套 loop-tool 范式**（timeoutMs / 三态错误 / reverse descriptor + postState → loop-helpers appendOperation / 返回 shape_id 供 AI 排版 / data.thumbnail 不进 serialize）。Phase 18 = **「换数据源 + 加 fetch→base64」**，插入与 undo 几乎零新代码。
- **`fetchUrlToBase64`**（`aihubmix-image.ts`）：doubao 远程 URL→裸 base64 已建，D-03 直接复用（Pexels full-res URL 同理）。
- **registry resolve 范式 + `stock-image` stub**：现成路由架构，D-09 只需填实一个 case。
- **storage + Settings pref-section 范式**：D-08 BYO key 字段照 image-gen picker 抄。
- **三态结构化错误 + 诚实失败体系**（Phase 15 D-13 / Phase 16）：D-13 沿用。

### Established Patterns（约束 / 必须遵循）
- **loop 内 write tool 走标准 reverse 路径**（execute 返 reverse descriptor → loop-helpers appendOperation）；**不混用** `insertImage.ts` 的手动 appendOperation（D-02 reconcile）。
- **adapter inverse 收 Record 对象（非位置参）** + 新 inverse 补 `operationLog.integration.test` 守门（memory `project_adapter_inverse_signature`）。
- **PPT 工具 snake_case + 入 `PPT_TOOLS` Set**（Phase 14 D-10 casing 根治守门）。
- **per-host 工具注册**（Excel 不注册 = D-11）。
- **apiKey 仅进 header、不进 body/error**（T-14-01）；**Pexels 裸 key 不加 Bearer**（D-10 gotcha）。
- **base64 永不进 serialize/message.content**（NFR-09）。
- **0 净新增运行时依赖**（native fetch，不装图库 SDK）。
- **bundle 守门先 build 再 size**；**改 UI 动 Lingui 宏必跑 `npm run extract`**。

### Integration Points（净新增代码连接点）
- **新建 `src/providers/pexels-client.ts`**：native fetch Pexels `/v1/search`（裸 key header）+ `fetchUrlToBase64`。
- **registry `stock-image` case 填实**（registry.ts L142-143）：读 `PEXELS_API_KEY`、缺抛 KeyInvalidError、返 config（baseURL 可配）。
- **新工具 `search_stock_image`（命名 planner 定）**：`src/agent/tools/write/` 下，照 `ppt-image.ts` 范式；注册到 PPT（入 `PPT_TOOLS`）+ Word host（`buildToolsForHost`），Excel 不注册。
- **Settings 字段**（SettingsPanel.tsx）：新增「图库 / Pexels API Key」pref-section + storage 读写。
- **STORAGE_KEYS 新增 `PEXELS_API_KEY`**（storage.ts）。
- **chat 署名展示**（D-07）+ 可选只读结果卡（D-06，复用/仿 Phase 16 ImagePreviewCard 只读态）。
- **守门**：`operationLog.integration.test`（图库插入 reverse，若复用现有 `delete_shape_by_id` reverse 则已覆盖，确认即可）；NFR-09 serialize 守门（若 result 携 base64）。

</code_context>

<specifics>
## Specific Ideas

- **北极星场景：** 「帮我这页 PPT 配一张海边日落的照片」→ AI 翻成 `seaside sunset` 检索 Pexels → 自动选最匹配的一张 → 插入当前 slide 居中 → 返回 shape_id → AI 可继续调位置 → chat 内显示「照片来自 Pexels · 摄影师 XX（链接）」。用户说「换一张」→ AI 取下一张再插。
- **与 Phase 16 生图的关系：** 同一「AI 自动直插」哲学的两个数据源——生图（AihubmixImageClient 出图）vs 图库（Pexels 找现成正版图）。工具范式、插入路径、undo、错误、署名/只读卡几乎同构；Phase 18 主要新增 = Pexels client + fetch→base64 + BYO key 字段 + 署名 note。
- **「自动选首张」可带智能：** AI 看 Pexels 返回的 `alt`/标签可挑「最匹配 query」的一张，不必机械取第 0 个（D-01）。
- **Pexels 选型胜过 Unsplash 的关键：** attribution 宽松（chat 内署名即可，不必每图 UTM）——正因如此「不叠水印 + chat 内署名」才合规（D-07）；Unsplash 强制署名会破坏 slide 视觉且违约（research L33）。

</specifics>

<deferred>
## Deferred Ideas / Risks

### 🔴 Phase 19 待验真机项（本里程碑最高风险，团队已拍板延后，不阻塞本阶段 plan/execute）
- **Pexels 双重 CORS 面在 Office Web iframe 三浏览器（Chrome/Edge）真机验证：**
  1. **API 调用 CORS**：`fetch('https://api.pexels.com/v1/search', {headers:{Authorization}})` 在 Task Pane iframe 内是否被 CORS 拦。
  2. **图片字节 CORS**：选中图 `fetch(photo.src.large)`（`images.pexels.com` CDN）→ blob/base64 是否被 CORS 拦（**这一面比 API 更易出问题**——CDN 可能不带 `Access-Control-Allow-Origin`；注意 `<img src>` 显示**不**受 CORS 限制，但 `fetch→blob→base64` 受限）。
  - **本阶段交付**：按直连实现 + 本地 dev / 单测验证；**线上 CSP/CORS 真机验证 = Phase 19 UAT 项**（与 Phase 17 pdf.js worker 同批真机验）。
  - **失败兜底（已定，fail 后才动）**：上 **Cloudflare Worker 轻代理**（不上阿里云 VM —— memory `project_no_backend_status`）。**设计已为此预留**：D-09 的 baseURL **可配** + D-03 的图片 fetch 经统一函数——失败时**只需把 base URL 指向 Worker（API 代理 + 图片代理）**，不动工具/UI 逻辑即可平滑切换。**v1/v2 默认坚持纯浏览器直连无后台**，Worker 仅是 CORS 实测失败后的逃生方案。
  - 若图片字节 CORS 失败但 API 通：退路之一是缩略图/插入都尽量用 `<img>` + canvas 重绘取 base64（canvas 受 tainted 限制，可能也不行）——最终仍回到 Worker 代理图片。planner 不必在本阶段解决，记录即可。

### 本阶段不做（下游 / future）
- **LIB-D1 Unsplash 备选接入**（若 Pexels 中文质量/限额不足再评估）—— v2.2 仅 Pexels。
- **缩略图网格手动选 UX**（ROADMAP 字面）—— Q1=B 否决，改 AI 自动直插。
- **内置共享 Pexels key** —— 永不做（开源仓库硬编码必被滥用，违 BYO/无后台）。
- **多变体并排选图 / 4 选 1** —— 与 Phase 16 D-05 一致不做（自动直插哲学）。
- **图片字节进持久化历史** —— NFR-09 反向约束，永不做。

### Reviewed Todos (not folded)
- **`builtin-model-dropdown`（high）** — 与图库无关（chat LLM Provider model 下拉），STATE 已记其「陈旧/已由 v2.0 CARRY-02 交付」。**不折入 Phase 18**。

</deferred>

---

*Phase: 18-lib*
*Context gathered: 2026-06-02*
*Decisions: Q1=B（自动直插，与推荐相反——用户选与 Phase 16 一致的 agentic 路线）/ Q2=A（AI 转英文搜）/ Q3=A（独立 Settings 字段）（真人用户经 team-lead 转达拍板）+ 11 项 baked 默认全采纳；详见 18-DISCUSSION-LOG.md*
