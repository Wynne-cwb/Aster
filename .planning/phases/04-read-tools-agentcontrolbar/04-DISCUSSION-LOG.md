# Phase 4: Read Tools 全套 + AgentControlBar 步骤文案 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 04-read-tools-agentcontrolbar
**Areas discussed:** 读取步骤露出+文案, 5秒卡住入口, Agent gave up 红卡, Model 下拉形态+测试按钮

---

## 读取步骤怎么露出 + 文案

| Option | Description | Selected |
|--------|-------------|----------|
| read 也进聊天折叠卡，默认折成一行 | 复用 Phase 3 role='tool' 折叠卡渲染 + humanLabel 中文人话；透明可回看、不太刷屏 | ✓ |
| read 只在顶部 control bar 显示，不进聊天 | 最不打扰；代价：回看不到 agent 读了啥，trust 透明度下降 | |
| read 过程只在 bar，结束后汇总一张卡 | 折衷；代价：额外汇总卡渲染逻辑，偏离 Phase 3 现有路径 | |

**User's choice:** read 也进聊天折叠卡，默认折成一行
**Notes:** 透明可回看 + 复用现成渲染胜出。control bar 三态差异化文案（读/思考/写，A-12）单独保留。

---

## 5 秒「看起来卡住了」入口

| Option | Description | Selected |
|--------|-------------|----------|
| 「还在跑…」安抚 + 当前在等什么 | 一行轻提示，让用户知道是慢不是死；不加额外按钮 | ✓ |
| 加「看起来卡住了?复制日志」入口 | 复制日志=CARRY-03/Phase 5 才做，提前露会撑着 | |
| 露出「中止」强引导 + 安抚文案 | 高亮现有 abort 按钮 | |

**User's choice:** 「还在跑…」安抚 + 当前在等什么
**Notes:** 最克制方案；abort 一直在顶部 bar 够用，不提前露 copy log（Phase 5）。

---

## 「Agent gave up」红卡 (ERR-04)

| Option | Description | Selected |
|--------|-------------|----------|
| 只说明 + 「重新试试」 | 说明 X 次失败 + 建议 Y + 一个重开一轮的入口；不给撤销（undo all 是 Phase 5） | ✓ |
| 说明 + 重试 + 撤销本次 | 额外给「撤销本次所有操作」，但 undo all 真回放 Phase 5 才上，本 phase 只能出占位 toast | |
| 只说明，不给任何动作 | 最克制；可能让用户「那我现在怎么办」 | |

**User's choice:** 只说明 + 「重新试试」
**Notes:** 不造假功能——undo all 是 Phase 5，本 phase 给撤销按钮只能出占位 toast，与「诚实禁用」偏好冲突。

---

## Model 下拉形态 (CARRY-02)

| Option | Description | Selected |
|--------|-------------|----------|
| 固定清单 select 下拉 | 内置 DeepSeek/AiHubMix 走固定 select；高频切 pro/flash 一点即换 | ✓ |
| 可编辑下拉 combobox | 下拉 + 允许手打不在清单里的；稍复杂 | |
| 从 /models 接口动态拉取 | 最准但多一次网络请求 + 错路处理 + 过滤 | |

**User's choice:** 固定清单 select 下拉（自定义 Provider 保留手动输入已锁）

### Follow-up: AiHubMix 清单怎么办（聚合器 model 太多）

| Option | Description | Selected |
|--------|-------------|----------|
| AiHubMix 给精选短清单 | 与 DeepSeek 一致走固定 select | ✓（带补充） |
| AiHubMix 破例保留手动输入 | DeepSeek 固定、AiHubMix 手输 | |
| 两个都精选固定，留个「其他」选项 | 末尾「其他…」出手输框 | |

**User's choice:** 精选短清单 + 提供具体 model 名单（见 Notes）
**Notes:** 用户补充了 AiHubMix model 名单：生图 = gpt-image-2 / gemini-3.1-flash-image-preview；多模态图片识别 = gpt-5.1 / gemini-3.5-flash。经澄清确认：这些是生图+视觉 model（Phase 6 范围）；Phase 4 agent 下拉用其中会 tool calling 的 gpt-5.1 / gemini-3.5-flash。registry 过时常量（gpt-4o/gpt-image-1）顺手更新，真实消费留 Phase 6。

### Follow-up: 「测试 tool calling」按钮 (A-21) scope

| Option | Description | Selected |
|--------|-------------|----------|
| 留到 Phase 7 | A-21 本就排 Phase 7；本 phase 只做下拉，避免 scope creep | ✓ |
| 本 phase 就加 | form 加测试按钮发简单 tool call 验证；把 Phase 7 活提前 | |

**User's choice:** 留到 Phase 7

### Follow-up: agent 下拉 vs 生图/视觉常量拆分确认

**User's choice:** 可以按这样落
**Notes（重要架构意图）:** 用户明确「主要的 LLM 还是 DeepSeek，只是当用户上传了图片的时候，调用多模态模型获取图片的详细说明，当做上下文重新给到 DeepSeek」。→ DeepSeek 始终 agent 主脑、纯文本驱动；AiHubMix 多模态做「看图说话」辅助。判定为新能力、Phase 4 范围外，记入 CONTEXT Deferred Ideas（Phase 6 / 专门多模态 phase）。

---

## Claude's Discretion

- read tool 接口类型形态（ReadableQuery/ReadableResult）、各宿主 read() 内部实现
- read 折叠卡展开后显示内容、size cap token 估算方式 + 截断提示文案
- circuit breaker sliding window 内部数据结构
- 三态差异化文案 + 5 秒安抚具体措辞
- 「Agent gave up」红卡视觉细节、ProviderForm select 交互细节

## Deferred Ideas

- 图片上传→多模态视觉看图说话→文字喂回 DeepSeek 的视觉预处理架构（Phase 6 / 专门多模态 phase）
- 生图/视觉识别真实调用（Phase 6）
- DiffLogPanel 回放 / undo all / copy step log（Phase 5）
- 「测试 tool calling」按钮 + A-21 model 兼容性矩阵（Phase 7）
- copy-chat-history todo（reviewed, not folded — Phase 5 CARRY-03）
