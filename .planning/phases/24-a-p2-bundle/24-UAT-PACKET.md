# Phase 24 UAT Packet — 保真度 Spike-Gate + 铺开路径验证

**Status:** 待 UAT（v2.3 末统一 UAT 包）
**Spike-gate verdict 方式:** 人眼判定（LOCKED-1，不可自动化）

---

## 1. 准备工作

- sideload 最新版 Aster（https://wynne-cwb.github.io/Aster/manifest.xml）
- 准备一个有若干文本的 Office for Web PPT 演示文稿
- 在 Settings 配置好 AiHubMix API Key（vision 自查需要）

---

## 2. 自动化 Gate（先跑，全绿才进人眼 UAT）

```bash
# 全套测试回归（Node 22 环境）
export PATH="~/.nvm/versions/node/v22.22.1/bin:$PATH"
npx tsc --noEmit && npx vitest run
# 预期：998 passed，0 failed（3 个 NetworkError 是已知 retry.test.ts 噪音，非失败）

# bundle gate（先 build 再 size，陈旧 dist 给假绿）
npm run build && npm run size
# 预期：dist/assets/main-*.js ≤ 82KB gzip（当前 80.86KB）

# undo 守门
npx vitest run operationLog.integration
# 预期：全绿（39 passed）
```

---

## 3. Spike-Gate：保真度对比图采集步骤

**目标：** 判定自渲染预览与 PowerPoint 真机截图的版面粗粒度对应程度，给出「铺开 or 降级」结论。

**Spike-gate 是人眼判定（LOCKED-1）。** 不写数值断言；不做自动化比对。四项评估结论由人工填写。

### 步骤 A：触发 apply_slide_layout 使预览面板出现

1. 在 Aster chat 输入：「帮我生成一页 KPI 展示幻灯片，主题：2026 年 Q1 营收」
2. 等 AI 调用 `apply_slide_layout`，观察 Task Pane 出现「幻灯片预览」面板
3. 确认面板渲染了幻灯片形状（标题、数字框、说明文字等）
4. 记录 apply_slide_layout 使用的版式名（cover/kpi/two_column/timeline/image_text/bullet_list 之一）

### 步骤 B：采集自渲染预览截图（Aster 生成）— 附图 1

方法一（推荐）：使用 `visual_check_slide` 工具触发截图

- 在 chat 输入：「请对刚刚生成的幻灯片做视觉自查」
- AI 会调用 `visual_check_slide`，工具内部 html2canvas 截图 → 喂 vision 模型
- 自查结果（文字 evidence）出现在 chat 中
- **同时用浏览器截图工具截取 Task Pane 中的「幻灯片预览」面板（这是附图 1）**

方法二（备选）：直接截取预览面板

- 在 apply_slide_layout 完成后，Task Pane 出现「幻灯片预览」面板时截图
- 用浏览器截图工具（Snipping Tool / macOS Cmd+Shift+4）截取面板区域（附图 1）

### 步骤 C：采集 PowerPoint 真机截图 — 附图 2

1. 在 Office for Web PPT 中，切换到 apply_slide_layout 刚建好的幻灯片（最新一张）
2. 用浏览器截图工具（Snipping Tool / macOS Cmd+Shift+4）**截取整张幻灯片内容**（附图 2）
3. 注意：字体渲染会有差异（浏览器用 Inter/Noto，PPT 用等线/Calibri），这是已知偏差

### 步骤 D：两图并排人眼对比

将附图 1（自渲染预览）和附图 2（PowerPoint 真机截图）并排，按四项评估：

| 评估项 | 判断问题 | 结论（填写） |
|--------|---------|------------|
| 溢出 | 自渲染判断文字溢出的位置，与 PPT 真机是否粗粒度一致？ | |
| 重叠 | 自渲染判断形状压叠的部位，与 PPT 真机是否粗粒度一致？ | |
| 留白 | 自渲染的空白分布，与 PPT 真机是否粗粒度一致？ | |
| 对比 | 自渲染的文字可读性判断，与 PPT 真机是否粗粒度一致？ | |

**判定标准（LOCKED-3a）：**
- 铺开：四项中多数粗粒度可辨认一致（字体差异导致的微小换行偏差不计入）
- 降级：偏差过大（如字体回退导致换行完全不同，溢出/留白判断完全相反）

**Spike-Gate 结论（请填写）：**
```
[ ] 铺开（保真度够用）→ 保持 PVQ06_VISUAL_CHECK_ENABLED = true，无需操作
[ ] 降级（保真度不足）→ 改 PVQ06_VISUAL_CHECK_ENABLED = false；更新 REQUIREMENTS.md PVQ-06 状态；
    告知用户：「视觉自查保真度不足，已回落到几何规则自查（溢出/重叠/越界/对比）」
```

---

## 4. 铺开路径端到端 UAT

（仅当 Spike-Gate 结论 = 铺开时验证）

| 场景 | 步骤 | 预期结果 |
|------|------|---------|
| visual_check_slide 正常调用 | 在 chat 触发「视觉自查」 | AI 收到视觉 evidence 文字，无 CSP 拦截，vision API 返回四项分析 |
| evidence 拼入下一轮 | AI 收到 evidence 后调 apply_slide_layout 修正 | AI 能根据视觉反馈修改 layout（能看出 AI 引用了 evidence） |
| html2canvas 不进初始 bundle | build + size | main-*.js ≤ 82KB gzip |
| previewEl 不存在时 advisory | 不打开预览面板直接调工具 | 返回「预览面板未打开，视觉自查跳过」advisory，不崩溃 |
| SlidePreviewPanel 独立 lazy chunk | build 输出 | dist/assets/SlidePreviewPanel-*.js 存在，main 不含 ppt-layouts 代码 |

---

## 5. 降级路径核实

（若 Spike-Gate 结论 = 降级，执行以下操作）

1. 将 `src/agent/tools/visual-check-config.ts` 中 `PVQ06_VISUAL_CHECK_ENABLED` 改为 `false`
2. 更新 `.planning/REQUIREMENTS.md` PVQ-06 状态：「降级：仅 Phase 22 几何自查（check_slide_layout）兜底」
3. 在聊天中告知用户：「视觉自查保真度不足（字体偏差导致 html2canvas 截图与 PowerPoint 版面差异过大），已回落到几何规则自查。几何自查（溢出/重叠/越界/对比度 WCAG）仍正常工作。」
4. 验证降级后 `visual_check_slide` 工具不出现在 AI 可用工具列表中
5. 验证 `check_slide_layout` 仍正常工作（几何自查兜底）

**降级方式（flag flip）：**
```typescript
// src/agent/tools/visual-check-config.ts
export const PVQ06_VISUAL_CHECK_ENABLED = false; // 改此行
// 效果：registerVisualCheckTool() 不调用 → visual_check_slide 从工具列表中消失
```

---

## 6. 3 个可调项最终值记录

（UAT 观察后填写，以下为当前默认值；每项旁边标注是否留开关待 UAT 后调）

| 可调项 | 当前默认 | 开关位置 | UAT 建议调整 |
|--------|---------|---------|------------|
| 保真度门槛 | 人眼粗粒度可辨认（无数值 gate） | 本 packet §3 步骤 D 四项评估 | （填写） |
| 触发方式 | on-demand（AI 主动调工具，不自动截图） | 无额外开关；AI 自主决定是否调 visual_check_slide | （填写） |
| 渲染模式 | visible（面板可见，默认渲染） | layoutArgs 不为 null 时 Suspense 自动 mount；如需 offscreen 隐藏，从 Suspense 移除即可 | （填写） |

---

## 7. 通用 UAT checklist（全 v2.3 phase 通用）

参见 v2.3 统一 UAT 包（本 packet 仅覆盖 Phase 24 专项）。

三宿主真机 UAT（Phase 24 只在 PPT 宿主验证，Excel/Word 无 apply_slide_layout 工具）：
- [x] Office for Web PPT（Chrome 最新版）— 本 phase 主要验证平台
- [ ] Office for Web PPT（Edge 最新版）— 可选，视时间
