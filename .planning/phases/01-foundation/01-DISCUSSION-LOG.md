# Phase 1: Foundation 与跨宿主骨架 - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 1-foundation
**Areas discussed:** 脚手架起点, Shell 完整度, Ribbon 占位标签, 上下文卡刷新

---

## 脚手架起点

### Q1: 正式项目脚手架从哪里起?

| Option | Description | Selected |
|--------|-------------|----------|
| 提升 spike/bundle-test | 已验证栈(~135KB gzip)作正式基座,补 vite-plugin-office-addin/manifest/Lingui/Vitest,跳过 Yo Office | ✓ |
| Yo Office 再 eject | 按 FOUND-01 字面跑 generator-office 再 eject 到 Vite | |
| 混合:spike 栈 + Yo manifest | spike 栈为主 + 参考 Yo manifest 结构 | |

**User's choice:** 提升 spike/bundle-test(用户问"你推荐哪个"后采纳推荐)
**Notes:** Yo Office 的依赖栈 + manifest 脚手架两块价值 Phase 0 都已具备;Yo 反而要 eject 回 Vite 并重装已验证的栈,且生成的 manifest 不带 spike 已修的 3 必修项。

### Q2: 正式代码放哪里?spike/ 怎么处理?

| Option | Description | Selected |
|--------|-------------|----------|
| repo 根目录 | package.json + src/ + manifest.xml 在顶层,spike/ 留作历史证据 | ✓ |
| 新建 app/ 子目录 | 正式代码放 app/,与 spike/ 隔离 | |

**User's choice:** repo 根目录
**Notes:** 单人副业、单 Task Pane 入口,monorepo 式 app/ 子目录平白多一层;spike/ 被 Phase 7 REL-05 回归引用,保留。

---

## Shell 完整度

### Q1: Phase 1 的 shell 做多满?

| Option | Description | Selected |
|--------|-------------|----------|
| 全视觉骨架带禁用占位 | 三段布局全画,Provider 下拉+上传图标置灰,AC1 350px 三段观感一步到位 | ✓ |
| 只做有实功能部分 | 仅上下文卡 + 空聊天区,不画 Provider/上传 | |
| 最小骨架 | 仅保证上下文卡可见 + Task Pane 能开 | |

**User's choice:** 全视觉骨架带禁用占位
**Notes:** Phase 2/3 只需填逻辑不动布局。

### Q2: 空聊天区/输入框在 Phase 1 是什么行为?

| Option | Description | Selected |
|--------|-------------|----------|
| 空态提示 + 输入框禁用 | 聊天区空态文案,输入框可见但禁用 | ✓ |
| 可输入但发送报"待 Phase 2" | 输入框可打字,点发送弹提示 | |

**User's choice:** 空态提示 + 输入框禁用
**Notes:** 诚实表达能力边界,避免让人误以为坏了。

---

## Ribbon 占位标签

### Q1: 6 个 ribbon 占位按钮的标签怎么取?

| Option | Description | Selected |
|--------|-------------|----------|
| PRD 候选功能名 | 用杀手场景名占位,每宿主先占 2 个旗舰场景,Phase 4-6 定稿 | ✓ |
| 通用占位名 | Aster 1/2 等中性名 | |
| 统一 "打开 Aster" | 6 个同名都开 Task Pane | |

**User's choice:** PRD 候选功能名
**Notes:** 减少 Phase 4-6 上线时的重命名 + 重注册返工;ribbon 结构一步到位。最终 2-of-3 选型仍属 UX(Q5),Phase 1 占位集非定稿。

### Q2: 占位按钮的图标怎么处理?

| Option | Description | Selected |
|--------|-------------|----------|
| 复用 spike 已有图标 | spike/manifest.xml 的 Aster 图标组,6 个共用,INSTALL-05 已满足 | ✓ |
| 每功能不同图标 | 每个功能配不同图标 | |

**User's choice:** 复用 spike 已有图标
**Notes:** Phase 1 功能未定稿,现在做图标易白做。

---

## 上下文卡刷新

### Q1: 上下文卡怎么感知用户选中变化?

| Option | Description | Selected |
|--------|-------------|----------|
| 实时监听 selection-changed | adapter 订阅宿主选区事件,选中一变即刷新 | ✓ |
| 打开/手动刷新读一次 | Task Pane 打开时读一次 + 手动刷新按钮 | |

**User's choice:** 实时监听 selection-changed
**Notes:** 也是 Phase 2 聊天附带选区上下文所需的能力。

### Q2: selection-changed 订阅怎么在 DocumentAdapter 接口里抽象?

| Option | Description | Selected |
|--------|-------------|----------|
| adapter 暴露 onSelectionChanged(cb) | 接口加 onSelectionChanged(cb): () => void 返回解绑函数,三宿主各自实现,React useEffect 订阅/解绑 | ✓ |
| React 层直接调 Office 事件 API | 不进 adapter,组件里直接 addHandlerAsync | |

**User's choice:** adapter 暴露 onSelectionChanged(cb)
**Notes:** 宿主差异关在 adapter 内,符合 NFR-05。

---

## Claude's Discretion

用户授权按推荐默认处理(未单独拍板):
- bundle-size 守卫工具 = `size-limit` + gzip 阈值守 1MB,跑 GitHub Actions(D-15)
- `getSelection()` 无选中时显示"未选中内容"占位,不抛错(D-16)
- Lingui scaffold + Phase 1 UI 字符串全量 macro 包裹,只 ship zh-CN(D-17)

## Deferred Ideas

- ribbon 每宿主 3 场景最终上哪 2 个 — Phase 4-6 UX 定稿(Q5)
- 每功能独立图标 — Phase 4-6
- 完整 cross-host × cross-browser sideload 矩阵 — Phase 7 REL-04
