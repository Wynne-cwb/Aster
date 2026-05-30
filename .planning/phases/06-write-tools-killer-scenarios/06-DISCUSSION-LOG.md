# Phase 6: 多宿主 Write Tools + Killer Scenarios 重写 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 6-write-tools-killer-scenarios
**Areas discussed:** Write tool P1 范围裁剪, 三宿主 System Prompt 重写, Killer scenario 收尾深度, 入口 + Onboarding UX

---

## 区域选择

| Area | Selected |
|------|----------|
| Write tool P1 范围裁剪 | ✓ |
| 三宿主 System Prompt 重写 | ✓ |
| Killer scenario 收尾深度 | ✓ |
| 入口 + Onboarding UX | ✓ |

**User's choice:** 全选（4/4）

---

## Write tool P1 范围裁剪

### 护城河 shape 写工具覆盖范围（SC4）
| Option | Description | Selected |
|--------|-------------|----------|
| 颜色+边框+位置/尺寸全套 | set_shape_property(fill/line色+粗细/尺寸) + move_shape(left/top) | ✓ |
| 只颜色+边框，位置走 move_shape | set_shape_property 只 fill/line | |
| 最小集 set_shape_text+move_shape | 不改颜色/边框 | |

### PPT 图像生成 insert_image_on_slide
| Option | Description | Selected |
|--------|-------------|----------|
| 不进 P1，推 v2.1 | 4 killer 无一依赖；aihubmix model 配置另有问题 | ✓ |
| 进 P1 做 | 需先修 model 配置 + 走 images/generations | |

### Excel 写工具 P1 集合
| Option | Description | Selected |
|--------|-------------|----------|
| 全做 +formula+chart+set_cell | SC2 完整需 insert_chart | ✓ |
| 砍 insert_chart 降级纯文字洞察 | chart inverse 不稳时走此 | |

### Word 写工具 P1 集合
| Option | Description | Selected |
|--------|-------------|----------|
| 全做 4 个 | append✅+insert+replace_paragraph+insert_at_cursor+replace_selection | ✓ |
| 核心 3 个 | append✅+replace_paragraph+replace_selection | |

**Notes:** insert_chart inverse 依赖能稳定拿刚插入 chart 句柄——research 先验 Office.js chart API 可行性，不行则单独降级。

---

## 三宿主 System Prompt 重写

### Prompt 架构
| Option | Description | Selected |
|--------|-------------|----------|
| 共享基座 + 三宿主专属模块 | buildSystemPrompt(host) 拆共享+per-host 领域段 | ✓ |
| 单一通用，只去技术化 | 不拆 host | |

### 领域深度
| Option | Description | Selected |
|--------|-------------|----------|
| 轻量领域指导写进 prompt | 5-10 行/host，Skills 作参考素材，零依赖零 bundle | ✓ |
| 做真正 Skill 系统（markdown 加载） | 新架构，增 bundle，偏新能力 | |
| 先不加领域知识 | 只去技术化+batch | |

### Self-verify + 并发改防御
| Option | Description | Selected |
|--------|-------------|----------|
| 轻：mutated 回显 + LLM 自决复读 | expected_state 只给高风险写可选 | ✓ |
| 严：每个写完自动 re-read 校验 | 每步多一次往返 | |
| 你决定 | | |

**Notes:** 同时落 todos.md「系统 Prompt 太技术 + 三宿主各自设定 + 调研 Skills」；去技术化（移除「没有后台服务器」等）。

---

## Killer scenario 收尾深度

### Phase 6 收尾验证
| Option | Description | Selected |
|--------|-------------|----------|
| 三宿主真机 smoke UAT checkpoint | 同 3/4/5 范式；全矩阵留 Phase 7 | ✓ |
| 仅 dev demo+vitest，真机全推 Phase 7 | destructive 写首次真机遇错晚 | |

### ROADMAP SC1-3 的 ¥ 判据
| Option | Description | Selected |
|--------|-------------|----------|
| 改为步数预算 | | |
| 删除 ¥ 判据，不立量化成本指标 | cost 已砍不可测；max_steps=20 仍防 runaway | ✓ |
| 保留 ¥ 作主观感受 | | |

### 4 个 demo prompt 是否锁死
| Option | Description | Selected |
|--------|-------------|----------|
| 锁为基准，planner 可加变体 | | ✓ |
| 只当参考，UAT 现场出真实 prompt | | |

---

## 入口 + Onboarding UX

### 空态 chips 形态
| Option | Description | Selected |
|--------|-------------|----------|
| 按宿主 3-4 个 chip，点击=填充输入框 | host-specific；填充非直发 | ✓ |
| 4 个固定 killer chips，点击=直发 | 可能错宿主显不相干场景 | |

### Ribbon 降级形态
| Option | Description | Selected |
|--------|-------------|----------|
| Ribbon 只「打开 Task Pane」，seed 交给 chips | 现状即是，0 manifest 风险 | |
| 精简到 1 个「打开 Aster」按钮 | manifest 三宿主瘦身 + 重验 sideload | ✓ |
| 保留按钮各 seed 不同 prompt | 需 ExecuteFunction 跨上下文传参，最复杂 | |

### ONB-01 心智锚定动画实现
| Option | Description | Selected |
|--------|-------------|----------|
| 自写 CSS/SVG 动画 | 零依赖，可随时建 | |
| 录真实运行 GIF 自托管 | 须等场景跑通后录 | |
| 推迟到 v1.1（降级 ONB-01） | | (用户改述：不做动画) |

**User's choice (free text):** 「Onboarding 不做动画」

### Onboarding 跳转 bug 是否折入
**User's choice (free text):** 「Onboarding 只需要指引填写 API KEY，尽量轻量」

### 追问：Onboarding 轻量化程度
| Option | Description | Selected |
|--------|-------------|----------|
| 单步：只留填 API Key（删 Step2 整步） | 用法引导全靠空态 chips | ✓ |
| 保留两步但 Step2 瘦成一句话引导 | | |
| 保留现状 Step2 功能卡，只是不加动画 | | |

**Notes:** ONB-01 动画移除（D-19，requirement 降级记账）；ONB-02 已由 humanLabel 满足；Onboarding 收成单步删 Step2Guide；原 todos.md 跳转 bug 在单步流程里一并验证。

## Claude's Discretion

各 write tool args schema / adapter inverse 方法命名 / before-image load 字段；set_shape_property 多属性粒度；PPT「左下角」靠 LLM 几何推理无新 tool；三宿主领域指导段文案；空态 chips prompt 文案；Onboarding 单步结构收敛；killer scenario plan 切波。

## Deferred Ideas

ONB-01 动画（移除）；¥ 判据（删除）；insert_image_on_slide（v2.1）；reorder/delete_paragraph 多步（v2.1）；shape 旋转/更多属性（v2.1）；可加载 Skill 系统（未来独立 phase）；builtin-model-dropdown（已 Phase 4 交付）；todos.md 其余 UI 项（出范围）。
