# Phase 7: UAT + Sideload Release Prep - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 把 Phase 3–6 的「demo 级」代理能力第一次走通**完整 release path**：4 个 killer scenario 真机端到端 UAT、README 第一次正式重写（代理定位）、A-21 model 兼容性「测试 tool calling」按钮 + 启动拦截、Office for Web sideload 三宿主全验、开源仓库正式发布。这是用户首次见到 Aster（v1 不发）。

**只做「怎么实现 / 怎么验证」，不新增能力。** 唯一实质新代码 = A-21 测试按钮 + pre-flight 拦截；其余是 UAT 验证 + README 文档 + 发布。

**继承的硬边界（不重复讨论）：**
- 不写 PRIVACY.md（PRIV-05 /gsd-discuss-phase 3 砍掉）；README 保留 N5 一句话告知「选中内容会发往 Provider」
- cost 全砍（Phase 3）——UAT 不测 ¥；`max_steps=20` 是唯一失控防御
- 无 git tag / 无 release notes（Q8）；分发 = sideload + 开源仓库 manifest，不走 AppSource
- 发布授权已给（CLAUDE.md §发布授权）：可直接 commit + `git push origin main` 触发 Pages 部署，事后告知
- 不做：英文 i18n（FUT-09）/ DeepSeek thinking mode 调优（FUT-12）/ per-action consent（永不做）
</domain>

<decisions>
## Implementation Decisions

### A. A-21 model 兼容性「测试 tool calling」按钮 + 拦截 UX（唯一新代码）
- **D-01:** 「测试 tool calling」按钮放在 **Provider 编辑表单内（`ProviderForm.tsx`）**——用户选完 model + 填完 Key 当场验证，语境最贴。
- **D-02:** **Pre-flight 拦截**——启动 agent run 前，若当前 Provider 的 `supportsToolCall === false`，直接弹明确错误「当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1」，**不发起 LLM call**（不等烧几步报 4xx）。这是 roadmap SC3 明确要求的体验。保留现有被动探测（4xx 关键字 → 标 false）+ CIRCUIT_OPEN 红卡作为运行期兜底。
- **D-03:** 内置 model（`deepseek-v4-pro`/`deepseek-v4-flash`/`gpt-5.1`/`gemini-3.5-flash`）**hardcode `supportsToolCall=true`，跳过测试**；只对用户自定义 Provider / 手填 model（如 claude-opus-4.7、Doubao）真机测一遍。
- **D-04:** 测试结果呈现 = **Provider 列表行 badge（✓支持 / ✗不支持 / 未测）+ 点测试时 inline loading→结果状态**，复用现有 badge 体系（`ProviderList.tsx` 已有 badge-accent/success），符合 teal 克制设计。
- **D-05:** 测试探针 = 复用 `openai-compat` 发一个**最简 dummy tool call** 请求，看 `finish_reason`/error 判定是否支持；结果写回 `providerStore.setProviderToolCallSupport`（已存在，`providers.ts:187`）。

### B. README 重写范围与定位
- **D-06:** 定位主轴**全面转「Office 智能代理」**（multi-step agent：自主多步完成文档任务 + 精细化操作 + 可观察/暂停/一键撤回）。拿掉旧「一键文档操作 + 多轮聊天」「AI 提效工具/助手」提法（PROJECT 已 pivot，PRD R1 superseded）。
- **D-07:** **含 4 killer scenario 具体输入示例 + 「Aster 怎么工作」心智锚定段**——Phase 6 SC6 已定调：中文用户对「AI worker」无心智锚定，教育成本=最贵设计预算。README 是首次见面，写「你说一句话，Aster 会这样多步完成并汇报」。
- **D-08:** 截图/GIF = **文字为主 + UAT 顺手截 2-3 张关键图**（agent 跑完汇报 / DiffLogPanel）嵌入；删掉旧 README「sideload 视频/GIF 待补」承诺；不强求完整 GIF。
- **D-09:** 产品口径 = **诚实写「作者自用 + 开源，早期阶段」**——当前面向作者自己 + 亲人，开源透明，早期不做多用户/隐私授权 UX；BYO Key 由用户自负责。避免过度承诺（roadmap SC2「自用工具定位」）。
- **D-10:** 既定事实纠正清理（不占讨论，直接做）：
  - UI 技术栈 Fluent UI React v9 → **自写 CSS 设计系统（teal 克制）**
  - bundle「约 138 KB gzip」→ **当前实测值**（Phase 6 收尾 73.13 KB，重写时以最新 `npm run build` + `npm run size` 为准）
  - 删除「完整隐私政策/Privacy doc 全文」承诺 + 顶部「草稿状态」banner + 底部「将在 Phase 7 补全」footer
  - 删除幻影需求引用 **REL-01 / REL-03 / REL-04 / NFR-06**（这些是 v1 旧编号，v2 REQUIREMENTS.md 不存在）
  - 保留 **N5 一句话隐私告知**（选中内容会发往 Provider）
  - 校准 sideload 步骤措辞（现有步骤基本准确，核对最新 manifest 后微调）

### C. UAT 执行与证据归档
- **D-11:** 分工 = **Claude 备 UAT 执行清单（每 scenario 输入 prompt + 期望步骤 + 验收点）+ 自跑非真机门禁（vitest / build / lint / bundle size）**；**用户跑 4 killer scenario 真机**（真机必须，符合 [[self_run_spikes]] 偏好）。
- **D-12:** 浏览器矩阵**放宽**：Web 端**只跑 Chrome（最新版，去掉 Edge）**——⚠️ 与 ROADMAP SC1/SC4 现写「Edge + Chrome 最新两版」不一致，**planner 须以本决策为准并提示更新 SC 措辞**。理由：Web 不是用户真实主战场，只做跨浏览器 sanity check。
- **D-13:** **Windows 桌面端不进 Phase 7**，保持 FUT-10/v1.1。用户明确表示「Windows 才是真实主战场」——记为背景动机，**上调 FUT-10 在 v1.1 的优先级**（见 Deferred）。
- **D-14:** 证据格式 = **步数 + 端到端耗时 + DiffLogPanel 截图**（每 scenario）；录屏可选不强求。
- **D-15:** PASS 标准 = **允许修复迭代**（同 Phase 3/4/5/6）：发现 bug → 当场修 → 重测，全部记入 UAT 报告；release 前最后一道，必须修干净才算 PASS。
- **D-16:** 成本字段 = **UAT 报告不出现 ¥**（cost 已在 Phase 3 全砍）；改记「步数 + 端到端耗时 + diff log」作验收指标。⚠️ 顺手清掉 ROADMAP 残留 ¥ 提法（Phase 6 SC1「¥ <3」/ SC2「¥ <1.5」/ SC3「¥ <2」+ Phase 7 SC1），**planner 须修正这些文档残留**。

### D. 性能复盘（NFR-03，未深入讨论，用默认）
- **D-17:** P95 单 LLM step ≤ 10s / 首 token ≤ 2s = **真机 UAT 时肉眼观察**，必要时加临时 dev-only `performance.now()` 计时日志（不进生产）；bundle ≤ 1MB 靠**现有 CI size-limit gate**（NFR-05 已 Complete）确认，无需新增。

### Claude's Discretion
- A-21 测试探针的具体 tool schema、超时时长、错误文案细节 → planner/executor 定。
- README 章节顺序、措辞、具体示例 prompt 文案 → 写作时定，遵循 D-06~D-10 框架。
- UAT 清单的具体颗粒度、计时日志实现 → planner 定。

### Folded Todos
（无 todo 折入新 scope。匹配到的 `builtin-model-dropdown.md` 已由 Phase 4 CARRY-02 完成，见 Deferred。）
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 范围 / 需求
- `.planning/ROADMAP.md` §Phase 7 — phase goal + 5 SC（ERR-04 UAT/NFR-01/03/04/05）+ Out of scope；⚠️ SC1/SC4 浏览器矩阵措辞与本 CONTEXT D-12 不一致，以 CONTEXT 为准
- `.planning/PROJECT.md` — 代理愿景定位、Q7-Q12 锁定边界、Constraints（无后台/bundle/性能/Key 安全）、Out of Scope
- `.planning/REQUIREMENTS.md` §Traceability — NFR-01/03/04 Pending（Phase 7）、ERR-04/NFR-05 Complete、NFR-02 基线

### A-21 model 兼容性（代码落点）
- `src/providers/types.ts` §131 — `supportsToolCall?: boolean | null` 字段
- `src/providers/openai-compat.ts` §56/80-83 — 现有被动探测（D-18 G-05：4xx 含 tool/function/not supported → 标 false）+ shouldAttachTools 逻辑
- `src/store/providers.ts` §30 `BUILTIN_MODEL_OPTIONS` / §187 `setProviderToolCallSupport` — 内置 model 清单 + 写回 action
- `src/components/Settings/ProviderForm.tsx` §160-191 — 内置 select / 自定义 text input（测试按钮落点）
- `src/components/Settings/ProviderList.tsx` — badge 体系（测试结果呈现落点）

### README / 发布
- `README.md`（仓库根，113 行）— 待重写的过时初稿
- `manifest.xml`（仓库根）— sideload manifest（Phase 6 已精简 Ribbon）；SourceLocation = GitHub Pages
- `CLAUDE.md` §发布授权 — push + Pages 部署授权边界
- `CLAUDE.md` §UI 设计系统 / `Skill("aster-design-system")` — teal 克制设计（README 技术栈描述 + 任何 UI 改动遵循）

### 性能
- `package.json` scripts `size` + CI size-limit gate（NFR-05 守门）
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`supportsToolCall` 字段 + 被动探测 + `setProviderToolCallSupport`**：A-21 半套地基已在（Phase 4 D-18 G-05）。Phase 7 只需补「主动测试探针」+「pre-flight 拦截」+「badge 呈现」，不从零造。
- **`openai-compat` 客户端**：测试探针直接复用，发一个最简 tool call 即可判定。
- **`ProviderList` badge 体系**（badge-accent/success/默认）：测试结果 ✓/✗/未测 直接套现有 className。
- **`ProviderForm` 内置 select（CARRY-02 已上线）**：测试按钮挂在 model select 旁。
- **CI size-limit gate（NFR-05 Complete）**：bundle ≤1MB 验证不用新写。
- **DiffLogPanel / AgentControlBar / 三宿主 write tools（Phase 5/6）**：UAT 验证的对象，全部就位。

### Established Patterns
- **诚实禁用 / 明确错误文案**：A-21 pre-flight 错误文案遵循现有错误 UX 范式（结构化 `{code, message, hint}`）。
- **teal 克制设计系统**：README 技术栈描述 + 任何 UI（测试按钮/badge）走 `Skill("aster-design-system")`。
- **真机 UAT 迭代式**：Phase 3/4/5/6 均「跑→修→重测」，Phase 7 沿用（D-15）。

### Integration Points
- A-21 pre-flight 拦截挂在 **agent run 启动路径**（`useAgentStore.runAgent` / `src/store/chat.ts` thin-delegate 之前）。
- 测试按钮 → `ProviderForm.tsx`；结果 badge → `ProviderList.tsx`；状态写回 → `providers.ts`。
- README + manifest 推 GitHub Pages（`wynne-cwb.github.io/Aster/`）= 发布动作。
</code_context>

<specifics>
## Specific Ideas

- A-21 pre-flight 错误文案锚点：「当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1」（roadmap SC3 原话，gpt-4o 现已换成 gpt-5.1，见 BUILTIN_MODEL_OPTIONS）。
- README「Aster 怎么工作」心智段要呼应 4 killer scenario：PPT topic→deck / Excel 清洗+图+洞察 / Word 整篇润色 / PPT shape 精细化（左下角图改红边右移 10px = magic moment）。
- 用户真实主战场 = Windows 桌面版 Office（不是 Web）；Web 验证仅 sanity check。
</specifics>

<deferred>
## Deferred Ideas

- **`builtin-model-dropdown.md` todo（pending/）** — 已由 **Phase 4 CARRY-02 完成**（`ProviderForm.tsx` 内置 select 已上线）。建议移到 `.planning/todos/completed/`。其唯一前瞻点（暴露 `supportsToolCall` 探测能力到 UI）已被本期灰区 A（D-01~D-05）覆盖。
- **Windows Office Desktop 同 manifest sideload 验证** — FUT-10/v1.1。用户明确「Windows 才是真实主战场」，**v1.1 优先级因本次讨论上调**；Windows sideload 机制（共享文件夹/注册表）与 Web 不同，届时需额外调研。
- **完整 GIF 演示** — README 暂只放关键截图；GIF 往后放，不进 Phase 7。

### Reviewed Todos (not folded)
- `builtin-model-dropdown.md` — 见上，已完成，不折入新 scope。

</deferred>

---

*Phase: 07-uat-sideload-release-prep*
*Context gathered: 2026-05-30*
</content>
</invoke>
