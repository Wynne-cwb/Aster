# Phase 16: IMG — 图片生成插入（PPT + Word） - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 16-img-ppt-word
**Areas discussed:** 预览-确认交互形态, 生图 prompt 处理, 重新生成 + model 切换, 插入位置/尺寸 + loading

---

## 区域选择（用户选了全部 4 个灰区）

| Option | Description | Selected |
|--------|-------------|----------|
| 预览-确认交互形态 | 全新范式，影响最大：预览容器 + 按钮 + 插入触发 | ✓ |
| 生图 prompt 处理 | 原话直传 vs agent 增强/翻译（质量决策） | ✓ |
| 重新生成 + model 切换 | 重生语义 + model picker 落点 | ✓ |
| 插入位置/尺寸 + loading | PPT 居中/尺寸 + Word body + 生成中可取消 | ✓ |

---

## 预览-确认交互形态

### Q1 — 生图预览放哪里？
| Option | Description | Selected |
|--------|-------------|----------|
| 聊天气泡内预览卡 | 复用 teal 卡片、贴合对话流、与 DiffLog 一致 | ✓ |
| 居中 Modal 弹窗 | 强制聚焦但打断对话、Task Pane 窄弹窗体验差 | |
| Task Pane 独立预览区 | 固定区但抢占聊天空间、实现重 | |

### Q2 — 生成图后、确认前 agent 怎么办？
| Option | Description | Selected |
|--------|-------------|----------|
| 生图与插入解耦 | 生图工具只产出预览即返回、本轮结束；插入是预览卡按钮触发的独立动作，手动记 operationLog。loop 零改动 | ✓ |
| 暂停 loop 等确认 | 给 loop 加「人类介入暂停」新状态，复杂度高 | |

**Notes:** 解耦方案符合 Phase 15「loop.ts 核心零/极小改动」价值；关键约束 = 插入后手动 appendOperation 保 undo。

---

## 生图 prompt 处理

### Q3 — agent 怎么处理生图 prompt？
| Option | Description | Selected |
|--------|-------------|----------|
| agent 智能增强中文 | 扩写成更具体中文 prompt、保留原意。质量优先 | ✓ |
| 原话直传 | 最可预测但简短描述出图质量差 | |
| 增强并翻译英文 | 中文模型(doubao)中文已够好、翻译可能失真意图 | |

---

## 重新生成 + model 切换

### Q4 — 生图 model 在哪切换？
| Option | Description | Selected |
|--------|-------------|----------|
| Settings + 预览卡都能切 | Settings 设持久默认 + 预览卡内联临时切。最灵活 | ✓ |
| 仅 Settings 全局 | 简单但换 model 要跳设置、重 | |
| 仅预览卡内联 | 不持久、每次默认 doubao | |

### Q5 — 「一键重新生成」语义？
| Option | Description | Selected |
|--------|-------------|----------|
| 同 prompt 重 roll，替换 | 一键再试同 prompt、新图替换旧预览。最低成本符合 IMG-04 | ✓ |
| 可编辑 prompt 再生 | 加 prompt 文本框可改再生。更强但更重（→归 discretion 可选增强） | |
| 多候选并排堆叠 | 占空间 + 多张 base64 内存压力大 | |

---

## 插入位置/尺寸 + loading

### Q6 — PPT 插图位置/尺寸怎么定？（Word 已锁 body 级追加）
| Option | Description | Selected |
|--------|-------------|----------|
| 居中+合理默认尺寸 | 当前 slide 居中、按比例不超 slide，Claude 定，用户事后可拖 | ✓ |
| agent 按语义放置 | 定位 API spike 风险、易错 | |
| 预览卡指定位置/尺寸 | 多控件、Task Pane 窄、过度工程 | |

### Q7 — 生成中 loading 态怎么做？（gpt-image-2 high ~90s+、不可流式）
| Option | Description | Selected |
|--------|-------------|----------|
| 「生成中」态+可取消 | 显示生成中 + AbortController 取消，沿用 AgentControlBar | ✓ |
| 仅 loading 不可取消 | 简单但 90s+ 卡死无解 | |

---

## Claude's Discretion

- 三类结构化错误沿用 Phase 15 D-13 范式（无 key / 生成失败-超时-取消 / 宿主插图失败 fallback）
- insert helper 抽象形态（供 IMG-01/02 + Phase 18 复用）+ 与 operationLog 衔接
- 预览卡组件结构 / 按钮布局 / 生成中骨架选型（遵循 aster-design-system）
- prompt 增强具体措辞 / 注入方式
- 「可编辑 prompt 再生」作可选增强（低成本可加）

## Deferred Ideas

- 可编辑 prompt 再生（本阶段只做同 prompt 重 roll）
- agent 语义放置插图位置（本阶段 PPT 固定居中）
- 多候选并排选图
- chat LLM（DeepSeek）model 下拉（todo 的非生图部分，超范围）
