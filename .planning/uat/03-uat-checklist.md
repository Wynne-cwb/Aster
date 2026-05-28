# Phase 3 真机 UAT Checklist

**Date issued:** 2026-05-29
**Tester:** 用户（项目作者）
**Env:** Office for Web（Edge + Chrome 最新两版）× PPT / Excel / Word 三宿主真机
**Build:** Plan 01-09 自动化部分全 commit 在 main，部署生效后 sideload 拿到 v2.0 Phase 3 完整版

> 真机 UAT 是 Phase 3 → 4 gate（D-06）。本 checklist 不阻断本 plan 的自动化 commit（Plan 09 已落 system-prompt demo + 单测 + checklist 文档本体）；真机 UAT 由用户单独跑、跑完后归档到本文件 + SP-4/SP-5 findings。
>
> 任何项 FAIL 都需 fallback 决策（D-25）或返工对应 plan。

---

## SC1 — Word demo prompt 跑通（AGENT-01 / AGENT-08）

**ROADMAP 固定 prompt：「写 3 段关于跨境电商物流的内容」**

### 步骤

1. Word for Web 打开任意文档（建议空白文档便于观察）。
2. Sideload Aster manifest（GitHub Pages URL：`https://wynne-cwb.github.io/Aster/manifest.xml`）。
3. Aster Task Pane 打开 → 配好 DeepSeek（或 aihubmix）Key（v1 已能配；若未配先走 v1 Onboarding 流）。
4. 选择 `deepseek-v4-flash`（或 `deepseek-v4-pro`）作默认 model。
5. 在输入框输入 **「写 3 段关于跨境电商物流的内容」**，发送。

### Pass 标准（满足任一即 PASS）

- [ ] LLM 在一次 turn 内 emit 多个 `append_paragraph` tool_call（A1 / SP-1 验证路径），Word 文档真多了 ≥ 1 段
- [ ] LLM 拆成多个 turn，每个 turn 一次 `append_paragraph`，最终 Word 文档多了 ≥ 1 段
- [ ] Task Pane chat 里每个 step 都有一条 role='tool' 折叠卡片，header 显示「在文档末尾追加段落「...」」

### Fail 标志（任一即 FAIL，需 fallback）

- [ ] LLM 完全没调 `append_paragraph`（只返纯文本）→ system prompt 引导不够 / aihubmix 不透传 tool_calls / Provider 不支持
- [ ] LLM 调了但 Word 文档没变 → WordAdapter.appendParagraph 路径问题 / Word.run 闭包失败
- [ ] Aster Task Pane 显示「Provider 不支持 tool calling」错误 → Plan 04 setSupportsToolCall 探测路径回归

### Fallback 决策

- LLM 没调 tool → 调强 system prompt（追加示例 + few-shot）；Plan 09 system-prompt.ts 再 refine 一次
- Word.run 失败 → 看 console 错误，按 PITFALLS A-06 / HostApiError 路径排查
- Provider 不支持 → 切到 DeepSeek 重测（aihubmix 上游兼容性留到 Phase 7 矩阵）

### 结果

- 跑日：（用户填）
- Provider / Model：（用户填）
- 实际步数：（用户填）
- 文档真改的段数：（用户填）
- 结论：（用户填 PASS / FAIL+fallback）

---

## SC2 — 失控控制可观察（AGENT-02 / AGENT-13）

**测试 SC1 跑的同时观察 AgentControlBar：**

### 1. agent run 期间 Task Pane 顶部出现 AgentControlBar

- [ ] 显示「N / 20」step counter（玻璃拟态 + 11px 小字 + tabular-nums）
- [ ] 显示 Pause 按钮（两条竖线 SVG）
- [ ] 显示 中止 按钮（StopIcon — 方框 SVG）
- [ ] 容器视觉走玻璃拟态 + 渐变 accent hover（不是灰底白字企业 UI）

### 2. 点 Pause（在 step 2 或 3 之前）

- [ ] 按钮变成 Play 三角 SVG
- [ ] AgentControlBar step counter 停在当前数字
- [ ] in-flight tool（如果有）继续跑完，Word 文档不被打断
- [ ] LLM 下一步 stream 不发起

### 3. 点 Resume

- [ ] 按钮变回 Pause 两竖线
- [ ] agent loop 继续，step counter 增长

### 4. 点 中止（如能触发 max_steps，可造一个无限 prompt 测试软着陆；否则直接验中止路径）

- [ ] AgentControlBar 立即消失（agentStatus → idle）
- [ ] in-flight LLM 请求被 abort（DevTools Network 看到 cancelled）
- [ ] Send 按钮恢复 enabled

### 5. max_steps 软着陆（可选）—— 构造 prompt 让 LLM 反复调 tool 直到 20 步

- [ ] 第 20 步后 AgentControlBar 显示「20 / 20」+ 只剩中止按钮
- [ ] ChatStream 出现软着陆卡片「Aster 觉得这事还没干完，要继续吗？」+ 两按钮
- [ ] 点「继续 20 步」→ step counter reset 为 0，agent 继续
- [ ] 点「停下」→ AgentControlBar 消失

### 结果

- 跑日：（用户填）
- 结论：（用户填 PASS / FAIL+fallback）

---

## CARRY-01 — 三宿主首次取选区（Plan 08 修复）

**先关掉 Task Pane 再跑（重要 — 测的是 Office.onReady 时序）。**

### PPT

1. Sideload Aster 到 PPT for Web，关闭 Task Pane。
2. **选中第 3 张 slide（在 slide panel 里 click 第 3 张）**。
3. 打开 Aster Task Pane。
4. **观察：** SelectionPill / ContextCard 立即显示「第 3 张 slide」— **无空帧、无「未选中内容」占位先出现再补**。
   - [ ] PASS（立即显示）
   - [ ] FAIL（仍然先空再补）→ Plan 08 路径 A 修复未生效，需排查 main.tsx setState({ initial }) 路径

### Excel

1. 同上，但选中范围（如 A1:C10）。
2. **观察：** 立即显示「选中区域 A1:C10」。
   - [ ] PASS / FAIL

### Word

1. 同上，但选中一段文本（150 字左右）。
2. **观察：** 立即显示「选中 150 字」。
   - [ ] PASS / FAIL

### 结果

- 跑日：（用户填）
- 三宿主结论：PPT / Excel / Word（用户填）

---

## SP-4 — 三宿主 reverse 操作可达性（用户真机）

### 步骤

1. 临时挂载 `.planning/spikes/SP-4-reverse-ops/probe.tsx` 的 SP4ReversePanel 到 `src/App.tsx`：
   - 顶部加 `import SP4ReversePanel from '../.planning/spikes/SP-4-reverse-ops/probe';`
   - 在 JSX 内插入 `<SP4ReversePanel />`
   - 本地 `npm run build && git commit + push origin main` 触发 Pages 部署
   - 或本地 `npm run dev` sideload 跑
2. **Word**：点「Probe Word delete last paragraph」按钮 → 复制 `<pre>` 日志 + 截 DevTools console。
3. **Excel**：先在某 sheet 选一段 range（A1:B5），点「Probe Excel selected before-image」→ 复制日志。
4. **PPT**：点「Probe PPT slides read」→ 复制日志。
5. 把三份日志贴回，Claude 归档 `.planning/spikes/SP-4-reverse-ops/findings.md` status=PASS/FAIL + fallback 决策（D-25 类型 ③）。
6. **跑完恢复 App.tsx**（删 SP4ReversePanel import + JSX，再本地 build），不带 spike 组件进 v2 main bundle。

### 结果

- Word delete: PASS / FAIL（用户填）
- Excel before-image: PASS / FAIL（用户填）
- PPT slides read: PASS / FAIL（用户填）

---

## SP-5 — PPT slide.delete + Web 反向排序（用户真机）

### 步骤

类似 SP-4，临时挂载 `.planning/spikes/SP-5-ppt-slide-delete/probe.tsx` 的 SP5SlideDeleteProbe 到 PPT 真机 sideload 的 Aster，跑三个按钮：

1. 读初始 slide 数量
2. 删除最后一张 slide（先手动插入一张占位 slide 再测）
3. 多选 slide 后看排序

跑完恢复 App.tsx；Claude 归档 findings.md。

### 结果

- slide.delete: PASS / FAIL（用户填）
- getSelectedSlides 排序: 正向 / 反向（用户填）

---

## GitHub Pages 部署验证

- [ ] Plan 01-09 自动化 commit 已 push 到 main（commit hash 列表，用户填）
- [ ] GitHub Pages 部署完成（1-2 分钟，看 Actions tab）
- [ ] 真机 sideload manifest URL（`https://wynne-cwb.github.io/Aster/manifest.xml`）拿到的是 Phase 3 完整版

---

## NFR-02 — Bundle 实测

- [x] `npm run build && npm run size` 通过（76.26KB gzipped ≤ 80KB 预算）— **Plan 09 已自动验过**

---

## 收尾

- [ ] 全部 SC + CARRY-01 + SP-4 + SP-5 项 PASS
- [ ] FAIL 项已落 fallback（fallback 实施 / 该 plan 返工）
- [ ] 本 checklist commit + push（不含真实测试结果中的敏感数据，如 Key）
- [ ] Phase 3 ready for `/gsd-verify-work`
