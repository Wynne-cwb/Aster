# Phase 7 UAT 执行清单

**浏览器：** Chrome（最新版，D-12：只跑 Chrome，不跑 Edge）
**待验代码：** Phase 7 新增 = A-21「测试 tool calling」按钮 + pre-flight 拦截 + README 重写。**⚠️ 这些还没上 GitHub Pages（未 push）——必须 sideload「本地新构建」或「先 push 的 Pages 版」来验，详见下方「部署前置」。**
**Provider：** DeepSeek-V4（推荐 `deepseek-v4-flash` 省 token）或 AiHubMix
**PASS 标准：** 功能正常，记录步数 + 端到端耗时 + DiffLogPanel 截图（D-14）
**修复规则：** 发现 bug → 当场修 → commit → 重测（D-15）；本清单底部记录修复过程

---

## 部署前置（二选一，先定）

- **A. 本地新构建验（不先公开）：** `npm run build && npm run preview`（或 `npm run dev`），用指向 localhost 的 dev manifest sideload。验完 PASS 我再 `git push` 公开发布。
- **B. 先 push 到 Pages 再验（项目既有模式）：** 我先 `git push origin main` → Pages 部署最新版 → 你 sideload 线上 manifest 验。bug 当场修→repush→重测（D-15）。

> 选 B 等于「先发后验」，但本仓库 add-in 早已在 Pages 公开（Phase 6 = e619299），Phase 7 的"首发"主要是 README 定位。两条路都允许迭代修复。

---

## Step 0 — Sideload 三宿主（07-04 / NFR-01 / NFR-04）

1. 打开 office.com（Chrome），Microsoft 账号登录
2. 在 **PowerPoint / Excel / Word** 各：开始 → 加载项 → 上传我的加载项 → 选 manifest.xml
3. 确认每个宿主 Task Pane 正常渲染、Ribbon 出现 Aster 按钮

**验收：**
- [ ] Chrome × PPT：Task Pane 渲染正常
- [ ] Chrome × Excel：Task Pane 渲染正常
- [ ] Chrome × Word：Task Pane 渲染正常
- [ ] （选 B 时）Task Pane 是 Pages 最新版（hard reload 清缓存核对 main-*.js hash 与 git HEAD 对应）

---

## Step A — A-21 测试按钮 smoke（07-02，Phase 7 新功能）

1. 设置 → AI Provider → 新增自定义 Provider（如填 aihubmix 上游 claude-opus-4.7 或 Doubao），填 Key，**保存**
2. 再次进入编辑该 Provider → 出现「测试 tool calling」按钮
3. **⚠️ CR-01 修复后的行为：编辑模式 Key 字段为空时按钮诚实禁用（提示「输入 Key 后可测试」）——需重填 Key 才能点测试**（这是正确行为，防止空 Key 探测把有效 provider 误标不支持）
4. 填 Key 后点测试 → loading → 结果 badge（✓支持 / ✗不支持）
5. 若 model 不支持：启动 agent 时应弹明确错误「当前 Provider/Model 不支持 tool calling，请切到 DeepSeek-V4 或 gpt-5.1」（pre-flight，不发 LLM call）

**验收：**
- [ ] 内置 model（deepseek-v4/gpt-5.1 等）不显示测试按钮（hardcode 支持）
- [ ] 自定义已保存 Provider 显示按钮，未保存/无 Key 时诚实禁用
- [ ] 测试结果写回 badge 三态（未测/✓支持/✗不支持）
- [ ] 不支持的 model 启动 agent 时 pre-flight 明确拦截

---

## SC1: PPT Topic→Deck（PowerPoint）

**准备：** 打开 PowerPoint，新建空白演示文稿（或只有标题页）
**输入 prompt（复制粘贴）：**
> 帮我做一份「Q3 销售复盘」PPT，给 leadership 看，重点华东

**期望行为：**
1. Task Pane 显示 AgentControlBar（暂停 + 中止 + 步骤计数）
2. Aster 依次调用 read tools → insert_slide → set_shape_text，8-15 步完成
3. 每步 AgentControlBar 显示差异化文案（不是统一「思考中...」）
4. 完成后 DiffLogPanel 展示 N 张卡片（中文 humanLabel）
5. 可点某张卡片「撤销该步」或「撤销本次所有操作」

**验收点：**
- [ ] 实际创建 ≥3 张 slides
- [ ] DiffLogPanel 卡片文案中文（非 raw tool name）
- [ ] 步数 ≤20（不超 max_steps）
- [ ] NFR-03：首 token ≤2s，单步 ≤10s

**证据：** 步数 ____ ｜ 端到端耗时 ____ ｜ DiffLogPanel 截图 ____

---

## SC2: Excel Clean+Chart+Insight（Excel）

**准备：** 打开 Excel，粘贴销售数据（若无真实数据用示例）：

| 产品 | 销售额 | 月份 |
|------|--------|------|
| A | 1000 | 1月 |
| B | 2500 | 1月 |
| C | 800 | 1月 |
| A | 900 | 2月 |
| B | 3000 | 2月 |

**输入 prompt：**
> 清洗这份数据，看哪个产品卖得最好，做个图，给我三句话洞察

**期望行为：** get_used_range_summary → set_range_values（可选清洗）→ apply_formula / insert_chart → 三句话总结；DiffLogPanel 有 Excel 卡片

**验收点：**
- [ ] Excel 出现图表 或 formula 结果
- [ ] Task Pane 给出三句话洞察
- [ ] DiffLogPanel 展示操作记录

**证据：** 步数 ____ ｜ 耗时 ____ ｜ 截图 ____

---

## SC3: Word 整篇润色（Word）

**准备：** 打开 Word，粘贴 3-5 段口语化中文（邮件草稿/会议纪要）
**输入 prompt：**
> 整篇润色，把口语化改成正式书面，顺便检查逻辑顺序

**期望行为：** get_document_outline / get_paragraph_count → 分批 read + replace_paragraph；段落变正式书面语

**验收点：**
- [ ] Word 内容实际变化（与原文对比）
- [ ] DiffLogPanel 有 replace_paragraph 卡片
- [ ] 可撤销某步恢复原文

**证据：** 步数 ____ ｜ 耗时 ____ ｜ 截图 ____

---

## SC4: PPT Shape 精细化（PowerPoint）— magic moment

**准备：** PowerPoint 某张 slide 左下角放一张图片
**输入 prompt：**
> 把左下角那张图改成红色边框，然后右移 10 px

**期望行为：** list_slides → get_slide → list_shapes_on_slide → 按 (left, top) 推断「左下角」→ set_shape_property(border red) + move_shape(+10px)

**验收点：**
- [ ] 图片边框变红（或完成对应操作）
- [ ] 图片位置右移（left 坐标变化 ≥5 点）
- [ ] 步数 ≤6（精细操作，不应 runaway）

**证据：** 步数 ____ ｜ 耗时 ____ ｜ 截图 ____

---

## NFR-03 性能观察

| 指标 | 标准 | 实测 | 结论 |
|------|------|------|------|
| 首 token | ≤2s | ____s | PASS/FAIL |
| 单步最慢 | ≤10s | ____s | PASS/FAIL |

## 发现的 Bug 与修复记录

| # | Bug 描述 | 修复 commit | 重测结果 |
|---|---------|------------|---------|
| — | — | — | — |

---

## UAT 结论
- [ ] 4 场景全 PASS → 通知 Claude 执行 07-06（push → Pages 部署 = 公开发布）
- [ ] 有 FAIL → 记录上表，当场修→重测

*备注：本清单由 Claude 在 Phase 7 自动化阶段预备（D-11 分工）；真机执行 = 用户。*
