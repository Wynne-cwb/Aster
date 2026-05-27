# Phase 2: Provider 抽象 + Settings + Onboarding + 错误 UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 2-provider-settings-onboarding-ux
**Areas discussed:** Onboarding 体验, Settings 形态 + Provider 落点, 错误 UX 呈现, 聊天交互 + 成本徽章

---

## Onboarding 体验

| Question | Option | Selected |
|----------|--------|----------|
| 跳过策略 | 可跳过，顶部持续提示 | ✓ |
| 跳过策略 | 强制填完才能进 | |
| 默认 Provider | DeepSeek 预选 | ✓ |
| 默认 Provider | 不预选，手动选 | |
| 功能卡范围 | 只显当前宿主一张 | ✓ |
| 功能卡范围 | 三宿主卡都展示 | |
| 重开引导 | 设置里放「重看引导」入口 | ✓ |
| 重开引导 | 只首启一次，不可重开 | |

**User's choice:** 全部选推荐项。
**Notes:** 隐私告知（KEY-03）落点由 Claude 按合理默认锁定为「第1步填 Key 区域旁内联常驻」，未单独成题。

---

## Settings 形态 + Provider 落点

| Question | Option | Selected |
|----------|--------|----------|
| 设置形态 | 整页滑入覆盖 | ✓ |
| 设置形态 | 居中弹层 modal | |
| 设置形态 | 顶部可展开面板 | |
| Provider 落点（冲突） | 设置里管理，输入栏不放 | ✓ |
| Provider 落点（冲突） | 输入栏底部加回下拉 | |
| 自定义字段 | 名称+baseURL+Key+model+单价 | |
| 自定义字段 | 只要 baseURL+Key+model | ✓ |
| 自定义字段 | 加 model 下拉拉取 | |
| 内置单价 | 内置为默认，可覆写 | |
| 内置单价 | 内置写死，不可改 | ✓ |
| COST-02 覆盖确认 | 是，自定义只显 token | ✓ |
| COST-02 覆盖确认 | 不，给自定义加回选填单价 | |

**User's choice:** 整页滑入 / Provider 归设置 / 自定义三字段 / 内置写死 / 确认覆盖 COST-02。
**Notes:** Provider 落点与 COST-02 两处冲突在用户被明确告知后拍板修订。PANE-01 的「Provider 切换下拉」被去掉。

---

## 错误 UX 呈现

| Question | Option | Selected |
|----------|--------|----------|
| 错误位置 | 失败气泡内联 | ✓ |
| 错误位置 | 顶部 banner | |
| 错误位置 | toast 瞬现 | |
| 失败留存 | 留住，带重试按钮 | ✓ |
| 失败留存 | 不留，错误另外提示 | |
| CTA 跳转 | 深链到设置对应项 | ✓ |
| CTA 跳转 | 只打开设置首页 | |
| 文案粒度 | 每类一句中文 + 一个 CTA | ✓ |
| 文案粒度 | 加折叠的技术详情 | |

**User's choice:** 全部选推荐项。
**Notes:** 贴 PRD F7；不做折叠技术详情层。

---

## 聊天交互 + 成本徽章

| Question | Option | Selected |
|----------|--------|----------|
| 停止键 | 发送键原地变停止 | ✓ |
| 停止键 | 独立停止按钮 | |
| 选区附带 | 自动附带，可一键去掉 | ✓（带补充） |
| 选区附带 | 默认不带，手动勾选 | |
| 插入按钮 | 三宿主纯文本插入跑通 | ✓ |
| 插入按钮 | 只接线，实现留 Phase 4-6 | |
| 成本徽章 | ¥ 人民币，内置汇率换算 | ✓ |
| 成本徽章 | 显原币种（USD） | |
| 成本徽章 | ¥ + 拆 prompt/completion | |

**User's choice:** 发送键原地变停止 / 自动附带（补充：胶囊要简洁，提供关闭开关）/ 三宿主纯文本插入跑通 / ¥ 内置汇率。
**Notes:** 用户对自动附带补充——「胶囊应该简洁一点，不然有点打扰，提供简洁胶囊且用户可关闭附带功能」。

## Claude's Discretion

- 内置 USD→CNY 固定汇率具体数值、徽章是否标「约」。
- ProviderRegistry 路由表结构、单飞队列、指数退避参数。
- SSE 解析器 src/lib/sse.ts 具体实现。

## Deferred Ideas

- Onboarding 内联 Key 校验（ONB-01，v1.1）。
- 聊天历史 IndexedDB 持久化（PERS-01，v1.1）。
- 结构化/样式保留写回（Phase 4-6）。
- 实时汇率 API（违反无后台，永不引入）。
