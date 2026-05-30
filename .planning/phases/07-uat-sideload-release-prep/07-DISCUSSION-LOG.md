# Phase 7: UAT + Sideload Release Prep - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 7-uat-sideload-release-prep
**Areas discussed:** A. A-21 测试按钮 + 拦截 UX，B. README 重写，C. UAT 执行与证据归档（D. 性能复盘 用默认未深入）

---

## 灰区选择

| Option | Description | Selected |
|--------|-------------|----------|
| A. A-21 测试按钮 + 拦截 UX | 唯一实质新代码 | ✓ |
| B. README 重写范围与定位 | 代理定位 + 事实纠正 | ✓ |
| C. UAT 执行与证据归档 | 分工/证据/PASS/¥ 处理 | ✓ |
| D. 性能复盘测量方法 | P95/首 token/bundle | （用默认，未深入） |

---

## A. A-21 测试按钮 + 拦截 UX

### 测试按钮位置
| Option | Description | Selected |
|--------|-------------|----------|
| Provider 编辑表单内 (ProviderForm) | 选完 model 当场验 | ✓ |
| Provider 列表行上 | 不进编辑态即可重测 | |
| 独立诊断区 | Settings 底部集中 | |

### 不支持时拦截方式
| Option | Description | Selected |
|--------|-------------|----------|
| Pre-flight 明确拦截 | run 前 supportsToolCall===false 直接弹错不发 LLM call | ✓ |
| 只靠现有被动探测 | run 报 4xx 才标记 + CIRCUIT_OPEN | |

### 内置 model 处理
| Option | Description | Selected |
|--------|-------------|----------|
| 内置 hardcode 已支持，只测自定义 | 内置默认 model 跳过，只测用户自加 | ✓ |
| 所有 model 都要点测试才放行 | 不区分内置/自定义 | |

### 测试结果呈现
| Option | Description | Selected |
|--------|-------------|----------|
| Provider 行 badge + inline 状态 | 复用现有 badge 体系 | ✓ |
| Toast 一次性提示 | 不持久化 | |
| ProviderForm 内 inline 文案 | 只在表单显示 | |

**User's choice:** 全部按推荐。
**Notes:** 测试探针复用 openai-compat 发最简 dummy tool call；写回已有 setProviderToolCallSupport。

---

## B. README 重写范围与定位

### 定位主轴
| Option | Description | Selected |
|--------|-------------|----------|
| 全面转「Office 智能代理」 | multi-step agent 主轴 | ✓ |
| 双轨：代理 + 保留提效工具 | 两种形态并述 | |

### 心智锚定
| Option | Description | Selected |
|--------|-------------|----------|
| 含具体例子 + 心智段 | 4 killer scenario + 「怎么工作」 | ✓ |
| 只列能力，不展开例子 | 更短 | |

### 截图/GIF
| Option | Description | Selected |
|--------|-------------|----------|
| 文字为主 + UAT 顺手截关键图 | 删视频承诺，不强求 GIF | ✓ |
| 做完整 GIF 演示 | 额外录制工作量 | |
| 纯文字，图后补 | 先发后补 | |

### 产品口径
| Option | Description | Selected |
|--------|-------------|----------|
| 诚实写「作者自用 + 开源，早期阶段」 | 不过度承诺 | ✓ |
| 写成面向所有中文职场用户 | 可能与现状不一致 | |

**User's choice:** 全部按推荐。
**Notes:** 事实纠正（Fluent→自写CSS、bundle 实测、删隐私政策/REL 幻影需求、保留 N5）作为既定清理项，不占讨论。

---

## C. UAT 执行与证据归档

### 分工
| Option | Description | Selected |
|--------|-------------|----------|
| 我备清单+自跑门禁，你跑真机 | Claude 备清单+跑非真机门禁；用户跑 4 真机 | ✓ |
| 全部手动，不备清单 | 现场凭记忆 | |

### 证据格式 + 浏览器矩阵
| Option | Description | Selected |
|--------|-------------|----------|
| Edge 跑全 4 + Chrome smoke | 推荐项 | |
| 完整矩阵都跑+录屏 | ~8 跑 | |
| 只跑一个浏览器 | — | |
| **（Other）只跑 Chrome** | **Web 不是主战场，Windows 才是** | ✓ |

### Windows 范围（追问澄清）
| Option | Description | Selected |
|--------|-------------|----------|
| Phase 7 仅 Web(Chrome)，Windows 保留 FUT-10 | 不改边界 | ✓ |
| Phase 7 加入 Windows 桌面验证 | 提前 FUT-10，改 ROADMAP/PROJECT | |
| Phase 7 主验 Windows，Web Chrome 降 smoke | 改 ROADMAP/PROJECT | |

### PASS 标准
| Option | Description | Selected |
|--------|-------------|----------|
| 允许修复迭代 | 发现 bug→修→重测 | ✓ |
| 严格一次过 | 不允许中途修 | |

### ¥ 成本字段
| Option | Description | Selected |
|--------|-------------|----------|
| UAT 不记 ¥，改记步数+耗时 | cost 已砍，清 ROADMAP 残留 | ✓ |
| 保留 ¥，手动估算 | 产品已无 cost 显示 | |

**User's choice:** 分工/PASS/¥ 按推荐；浏览器矩阵改为「只跑 Chrome」（Other），追问后确认 Windows 不进 Phase 7（保持 FUT-10）。
**Notes:** D-12 浏览器矩阵与 ROADMAP SC1/SC4 措辞不一致，planner 须以 CONTEXT 为准并提示更新 SC；¥ 残留 + Edge+Chrome 措辞一并清理。

---

## Claude's Discretion

- A-21 测试探针 tool schema / 超时 / 错误文案细节
- README 章节顺序、措辞、示例 prompt 文案
- UAT 清单颗粒度、临时计时日志实现

## Deferred Ideas

- `builtin-model-dropdown.md` todo 已由 Phase 4 CARRY-02 完成 → 建议移 completed/
- Windows Office Desktop sideload 验证 → FUT-10/v1.1（优先级上调，用户真实主战场）
- 完整 GIF 演示 → 往后放
</content>
