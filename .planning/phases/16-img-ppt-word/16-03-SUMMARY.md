---
phase: 16-img-ppt-word
plan: "03"
subsystem: agent-tools
tags: [generate-ppt-image, generate-word-image, image-gen-tool, IMG-01, IMG-02, IMG-05, D-02, D-08, AbortSignal, per-host-registry]

requires:
  - phase: 16-img-ppt-word
    plan: "02"
    provides: src/lib/insertImage.ts 统一插图 helper（Plan 16-05 预览卡按钮接入）+ PPT/Word adapter 插图方法 + 真机 spike 锁定裸 base64
  - phase: 16-img-ppt-word
    plan: "01"
    provides: ppt-image/word-image 工具存根 + ppt-image.test.ts / word-image.test.ts Wave 0 脚手架（describe.skip）+ tools-host.test.ts IMG-05 守门（it.skip）
  - phase: 14-mdl-provider
    provides: AihubmixImageClient.generate（三路 wire format 解析，返回裸 base64）+ ProviderRegistry.resolve('image-gen')

provides:
  - generate_ppt_image ToolDef（IMG-01，D-02 解耦：execute 只生成预览 base64，不写文档，reverse=undefined）
  - generate_word_image ToolDef（IMG-02，与 ppt 对称）
  - PPT_TOOLS Set 含 generate_ppt_image（casing 归一化覆盖）+ buildToolsForHost per-host 注册（PPT/Word 含，Excel 不含 IMG-05）
  - AihubmixImageClient signal 支持（D-08 真取消：ImageGenOptions.signal 透传到 4 处 fetch）

affects: [16-04, 16-05]

tech-stack:
  added: []
  patterns:
    - "生图工具 D-02 解耦：execute 只调 AihubmixImageClient.generate→返回 {base64,mimeType,prompt,preview_pending:true}，不写文档、reverse=undefined（插入由 Plan 16-05 预览卡按钮触发 insertImage helper 时手动 appendOperation）"
    - "ProviderRegistry.resolve('image-gen', getDefaultLLM)：image-gen case 不使用 getDefaultLLM（直接读 storage aihubmix key），工具层传虚拟抛错函数即可（ToolExecContext 无 getDefaultLLM 字段）"
    - "model 优先级三级：工具 args model_id > 用户 Settings 持久设置（aster:pref:image-gen-model，Plan 16-04 写入）> registry 默认 doubao"
    - "D-08 真取消最小侵入：ImageGenOptions 新增可选 signal，generate→3 私有方法→fetchUrlToBase64 逐层透传 signal 给 fetch，旧调用方 generate(prompt,config) 向后兼容"
    - "T-16-08 防 key 泄漏：KeyInvalidError 路径 error.message 用字面量中文（'aihubmix Key 未配置...'），不 interpolate err.message"
    - "IMG-05 per-host 注册：PPT_TOOLS Set（snake_case casing 归一化用）+ buildToolsForHost ppt/word case 注册、excel case 不注册（Excel 无原生插图 API）"

key-files:
  created: []
  modified:
    - src/providers/aihubmix-image.ts
    - src/agent/tools/write/ppt-image.ts
    - src/agent/tools/write/word-image.ts
    - src/agent/tools/index.ts
    - src/agent/tools/write/ppt-image.test.ts
    - src/agent/tools/write/word-image.test.ts
    - src/agent/tools/tools-host.test.ts
    - src/agent/tools/index.test.ts
    - src/agent/tools/read/tools.test.ts

key-decisions:
  - "ppt-image/word-image execute 从存根（throw not-implemented）填充为真实现：调 AihubmixImageClient.generate(prompt, config, {signal: ctx.signal})，返回 preview_pending:true，reverse=undefined（D-02 解耦）"
  - "ProviderRegistry.resolve('image-gen', ...) 第二参 getDefaultLLM 在 image-gen case 不被调用（直接读 storage），工具层传 `() => { throw }` 虚拟函数——ToolExecContext 接口无 getDefaultLLM 字段，避免改接口扩散"
  - "AihubmixImageClient D-08 取消：ImageGenOptions 新增 signal?: AbortSignal，_options 形参去下划线改 options，三私有方法（doubao/gpt-image-2/gemini）+ fetchUrlToBase64 各透传 signal 给 fetch；向后兼容（signal 可选）"
  - "错误三态：缺 prompt→INVALID_ARGS(recoverable)；KeyInvalidError→PERMISSION_DENIED(不可恢复，T-16-08 字面量 message)；其余（网络/超时/AbortError/未知 model）→HOST_API_FAILED(recoverable)"
  - "IMG-05：generate_ppt_image 入 PPT_TOOLS Set（casing 归一化）+ ppt case；generate_word_image 仅 word case（Word 工具无 casing normalize 需要）；excel case 不动"
  - "工具计数断言随注册同步（Rule 1）：index.test.ts + read/tools.test.ts 中 Word 17→18、PPT 19→20；read/tools.test.ts PPT kind 守门 PPT_WRITE_TOOLS 列表补 generate_ppt_image（否则 filter 误把 write 工具当 read 断言 kind 失败）"

requirements-completed:
  - IMG-01
  - IMG-02
  - IMG-05

metrics:
  duration: ~12min（含 529 过载中断后断点续跑）
  tasks: 2
  files: 9（0 created / 9 modified；2 工具实现 + 1 provider 扩展 + 1 registry + 5 test）
  tests: 823 passed / 0 skipped（尾部 3 retry errors 是已知噪音，非失败；Phase 16 Wave 0 全部 skip 已解除）
  bundle: main 78.03 KB gzip（≤82KB 门内；生图工具进 loop chunk 非 main initial bundle，体积未变）
completed: 2026-06-02
---

# Phase 16 Plan 03: generate_ppt_image / generate_word_image 工具实现 + per-host 注册 Summary

**填充 Phase 16 生图工具真实现（D-02 解耦：execute 只生成预览 base64、不写文档、reverse=undefined）+ B2 D-08 真取消（AihubmixImageClient signal 逐层透传）+ IMG-05 per-host 注册（PPT/Word 含、Excel 不含）；Wave 0 全部 skip 守门解除变绿（823 passed）。**

## 完成内容

### Task 1：aihubmix-image.ts signal 扩展 + ppt-image/word-image 真实现（commit d8c0f0c）

- **`aihubmix-image.ts` D-08 取消能力扩展**（4 处最小侵入）：
  - `ImageGenOptions` 新增 `signal?: AbortSignal`（向后兼容，可选字段）。
  - `generate` 形参 `_options` → `options`，分发时把 `options` 传给三个私有方法。
  - 三个私有生图方法（`_generateDoubao` / `_generateGptImage2` / `_generateGemini`）各加 `options?: ImageGenOptions` 参数，并在 `fetch(url, init)` 加 `signal: options?.signal`。
  - `fetchUrlToBase64`（doubao URL→base64）加 `signal?: AbortSignal` 参数透传给 fetch。
  - 旧调用方 `generate(prompt, config)` 不受影响（signal 可选）。
- **`generate_ppt_image`（IMG-01）从存根填充为真实现**（ppt-image.ts）：
  - execute：缺 prompt → `INVALID_ARGS`；`ProviderRegistry.resolve('image-gen', () => {throw})` 解 aihubmix 配置（image-gen case 不用 getDefaultLLM，传虚拟抛错函数）；model 优先级 args.model_id > storage `aster:pref:image-gen-model` > registry 默认；`new AihubmixImageClient().generate(prompt, config, {signal: ctx.signal})` → 返回 `{base64, mimeType, prompt, preview_pending:true}`，**reverse=undefined**（D-02 解耦）。
  - 错误三态：`KeyInvalidError` → `PERMISSION_DENIED`（不可恢复，字面量 message T-16-08）；其余 → `HOST_API_FAILED`（可恢复）。
- **`generate_word_image`（IMG-02）对称实现**（word-image.ts）：与 ppt 完全对称（同 D-02 解耦、同三态错误、同 model 优先级），description 含「插入当前 Word 文档末尾」。
- **Plan 16-01 测试解 skip**：ppt-image.test.ts（3 用例）+ word-image.test.ts（2 用例）去掉 `describe.skip`，从 skipped → green。

### Task 2：tools/index.ts per-host 注册 + 工具计数断言同步（commit 0f8a159）

- **3 处注册改动**（index.ts）：
  - 顶部 import `generatePptImageTool` / `generateWordImageTool`。
  - `PPT_TOOLS` Set 加 `'generate_ppt_image'`（snake_case，casing 归一化覆盖；`generate_word_image` 不入——Word 工具无 casing normalize 需要）。
  - `buildToolsForHost`：ppt case `pptWriteTools` 加 `generatePptImageTool`、word case `wordWriteTools` 加 `generateWordImageTool`（均在 batchWrite 之前）；**excel case 不改**（IMG-05：Excel 无原生插图 API）。
- **tools-host.test.ts 解 it.skip**：两条 PPT/Word host 含生图工具守门解除 skip，4 用例全通过（含 Excel 不含两生图工具）。
- **工具计数断言同步**（Rule 1，见 Deviations）：index.test.ts + read/tools.test.ts 中 Word 17→18、PPT 19→20；read/tools.test.ts PPT `kind` 守门的 `PPT_WRITE_TOOLS` 列表补 `generate_ppt_image`。

## Deviations from Plan

### 自动修复项

**1. [Rule 1 - Bug] 工具计数 + kind 守门断言随新注册工具同步更新**

- **Found during：** Task 2（注册后跑全量测试）
- **Issue：** Task 2 把 `generate_ppt_image` / `generate_word_image` 注册进 PPT/Word host 后，5 条断言失败：
  - `index.test.ts`：`buildToolsForHost("word")` 期望 17、`buildToolsForHost("ppt")` 期望 19（均少 1）。
  - `read/tools.test.ts`：Word 期望 17、PPT 期望 19（均少 1）；PPT `read tool kind === "read"` 守门用 `filter(!PPT_WRITE_TOOLS.includes(name))` 把 `generate_ppt_image`（write 工具）误当 read 工具，断言 `kind === 'read'` 失败（它是 write）。
- **Fix：** Word 计数 17→18、PPT 计数 19→20（连同注释说明 Phase 16 新增）；`read/tools.test.ts` 的 `PPT_WRITE_TOOLS` 列表补 `'generate_ppt_image'`（让 filter 正确归类）；并在 `index.test.ts` 的 `toContain` 列表补 `generate_word_image` / `generate_ppt_image` 名称断言。
- **Why Rule 1（非新决策）：** 这些计数/kind 断言本就是「注册了新工具就应 +1」的守门，PLAN.md Task 2 acceptance_criteria 的 `npm test -- --run 全量退出 0` 隐含要求同步它们。属计划必然引入的测试断言维护，不改任何运行时逻辑或工具行为。
- **Files modified：** src/agent/tools/index.test.ts, src/agent/tools/read/tools.test.ts
- **Commit：** 0f8a159（与 Task 2 同 commit）

### 实现细节差异（非偏离，记录备查）

- **PLAN action 示例用 `ctx.getDefaultLLM`，实际改传虚拟抛错函数。** PLAN Task 1 的 ppt-image.ts 示例代码写 `ProviderRegistry.resolve('image-gen', ctx.getDefaultLLM)`，但 `ToolExecContext`（index.ts L108-113）接口**没有** `getDefaultLLM` 字段（只有 adapter/runId/stepIndex/signal）。由于 `ProviderRegistry.resolve` 的 `image-gen` case 根本不调用第二参 getDefaultLLM（直接从 storage 读 aihubmix key，registry.ts L125-136），改传 `() => { throw new Error('unused'); }` 虚拟函数即可——避免为不被调用的参数改 ToolExecContext 接口造成扩散。tsc 通过、3+2 工具测试通过、全量绿。

- **PLAN description 草案含「Excel 宿主无原生插图 API，不可在 Excel 中调用此工具」一句，实现时省略。** 因为 IMG-05 已在 buildToolsForHost 层做硬隔离（Excel host 工具表根本不含生图工具，LLM 在 Excel 宿主收不到这两个工具定义），description 里再写「不可在 Excel 调用」反而冗余且对 PPT/Word 用户无意义。description 聚焦「写具体中文 prompt」的有效引导。

## 验证

- `npm test -- --run src/agent/tools/write/ppt-image.test.ts` → 3/3 passed（describe.skip 已去掉）。
- `npm test -- --run src/agent/tools/write/word-image.test.ts` → 2/2 passed（describe.skip 已去掉）。
- `npm test -- --run src/agent/tools/tools-host.test.ts` → 4/4 passed（PPT/Word 含 + Excel 不含两生图工具；it.skip 已去掉）。
- `npm test -- --run`（全量）→ **823 passed / 0 skipped**；Test Files 66 passed；尾部 3 个 retry errors 是已知噪音（project_i18n_extract_and_test_noise），0 真失败。
- `npm run build` → tsc 无 TypeScript error（`grep -c "error TS"` = 0），vite build 成功，main chunk 78.03 KB gzip（≤82KB 门内；生图工具进 loop chunk 非 main initial bundle）。

## Acceptance Criteria 核对

| 准则 | 结果 |
|------|------|
| aihubmix-image.ts ImageGenOptions 含 signal 字段 | ✅ |
| aihubmix-image.ts 三私有方法 + fetchUrlToBase64 各透传 signal（4 处 fetch） | ✅ |
| ppt-image.ts execute 传 ctx.signal | ✅ |
| ppt-image.ts 有 generate_ppt_image + preview_pending | ✅ |
| ppt-image.ts reverse 不设（仅注释提及） | ✅ |
| word-image.ts 有 generate_word_image | ✅ |
| ppt-image.test.ts describe.skip 已去掉 | ✅ |
| index.ts generate_ppt_image 三处（import L16 + PPT_TOOLS L44 + ppt case L292） | ✅ |
| index.ts generate_word_image 两处（import L17 + word case L257） | ✅ |
| index.ts excel case 不含生图工具 | ✅ |
| tools-host.test.ts 退出 0（4 用例，it.skip 已去掉） | ✅ |
| 全量测试退出 0 | ✅ 823 passed |
| build 无 TS error | ✅ |

## 后续 Plan 衔接

- **16-04**：Settings 生图 model picker + `aster:pref:image-gen-model` 持久化写入（本 plan 工具已做读取兜底：storage.get + args.model_id 覆盖）。
- **16-05**：ImagePreviewCard 预览卡——消费本 plan 工具返回的 `data.preview_pending:true` + `data.base64`，确认按钮调 Plan 16-02 已交付的 `insertImage` helper 实际插图（届时 reverse 由 helper 的 appendOperation 设置）。

## Known Stubs

无。两个生图工具 execute 返回的 `base64` 是 AihubmixImageClient 真实生成的图片数据（非占位）。`preview_pending:true` 是 D-02 解耦的有意设计信号（execute 只生成预览、插入由 Plan 16-05 预览卡按钮触发），不是未实现存根——插入路径的 `insertImage` helper 已在 Plan 16-02 交付，预览卡 UI 由 Plan 16-05 接入，属 Wave 划分预期，非本 plan 缺口。

## Self-Check: PASSED

- 修改文件全部存在并含目标内容（aihubmix-image.ts signal、ppt-image.ts / word-image.ts 真实现、index.ts 三/二处注册、4 个 test 文件解 skip + 计数同步）。
- commits 全部存在：d8c0f0c（Task 1）、0f8a159（Task 2）。
