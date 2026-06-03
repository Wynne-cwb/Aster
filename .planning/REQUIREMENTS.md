# Requirements: Aster v2.3「精装与定力」

**Status:** 🟡 Planning（roadmap 未定）
**Defined:** 2026-06-03
**Core Value:** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 代理能力，能完成绝大部分文档工作；无后台、BYO Key、纯浏览器直连。
**Milestone Goal:** 在 v2.2 多模态地基上做两个纵深提质——（A）让 PPT 产出从「文字对但粗糙」升级到「有设计规范、整齐专业、可继续编辑」；（B）让 agent 在长对话里保持清醒：摘要压缩抗幻觉 + system prompt 缓存友好，既保输出质量又顺带省 token。
**Phase numbering:** 从 20 续接（v2.2 止于 Phase 19），不 reset。
**排序约束（用户定）：** B 系列（上下文/抗幻觉）作为**第一个 phase**，A 系列（PPT 视觉质量）在后。

> 来源：todos.md 2026-06-01 两大块讨论结论（「上下文/缓存/抗幻觉优化」+「PPT 视觉质量提升」），两块当时都标注「等 v2.2 跑完再动，避免改同区域代码冲突」。每个新破坏性 write 工具沿用 v2.1/v2.2 合约：先声明 undo 类型 + 配 `operationLog.integration.test` 守门 + 入对应宿主 TOOLS Set（casing 归一化）。

---

## v2.3 Requirements（13 条）

### B · 上下文 / 缓存 / 抗幻觉（CTX）— 第一个 phase

> 机理：DeepSeek/OpenAI-compatible 的 prompt 缓存是「前缀匹配」——从 messages 第一个 token 起连续相同的开头越长，这段越按缓存价计费（Flash 命中价约 50× 便宜、Pro 约 120×）。胜负手 = 「每次请求开头有多长原封不动」。铁律：任何「每次请求都会变」的内容一律放 messages 末尾，绝不放进前缀（system / 靠前历史）。认知修正：100 万 token 窗口是「塞得下」非「塞满还聪明」，控长度既省钱**更保输出质量**。

- [ ] **CTX-01**: 改时钟——`buildSystemPrompt`（`src/agent/system-prompt.ts`）不再向 system message 注入实时时间（`today`/`clock`/`weekday`），改为拼到当前这条 user message 末尾（如「（当前时间：2026-06-03 周三 14:37，用户本地时间）」）；system+tools+历史 这一长段前缀变完全静态，agent 仍拿得到精确时间
- [ ] **CTX-02**: 时钟守门——`system-prompt.test.ts` 加断言：`buildSystemPrompt(host)` 返回值不匹配分钟级时钟（不出现 `/\d{1,2}:\d{2}/` 形态的时:分），防以后有人把实时时钟又加回 system 前缀（对应「复发故障 → 加结构性守门」）
- [ ] **CTX-03**: 长对话摘要压缩（compaction）——按 **token 高/低水位**触发（非按轮数）：历史超高水位才触发、压缩后回落到低水位（高/低拉开差距 = 压一次撑很多轮）；调一次便宜 LLM（同 Provider flash 档）把最老一段压成要点摘要，保留所有**仍然有效**的事实/决定/用户偏好、明确扔掉**已被推翻**的，最近若干轮原文保留不动
- [ ] **CTX-04**: 摘要稳定前缀 + 持久化——摘要作为一条固定消息放在 `[system]` 之后、保留原文历史之前（`[system][摘要][最近原文][当前]`），使 `[system][摘要]` 成为新的稳定缓存前缀（两次压缩之间缓存照常命中，只在压缩那一刻 miss 一次）；摘要与聊天记录一起存 localStorage（沿用 v2.1 HIST 持久化边界）
- [ ] **CTX-05**: 截断策略重审——调整现「20 轮硬砍」(`truncateTo20Turns`, `loop-helpers.ts`) 与 token 水位压缩协同：不用「每轮丢最老一条」的滑动窗口（每轮前缀都变 → 几乎全 miss），改「攒够一大批才砍/压一刀」；既不砸缓存、也不盲目放宽成喂幻觉
- [ ] **CTX-06**: 抗幻觉指引——system prompt 强化「永远信任刚重读的文档现状，不信历史里几十轮前的旧读取记忆」（文档会被用户/agent 改动，旧读数早已过时）；现状 `loop.ts` 已 filter 掉历史里的旧 tool 结果，本条为指引层补强

### A · PPT 视觉质量（PVQ）— B 之后

> 锁定取舍（用户 2026-06-01）：可编辑 > 好看，但好看也很重要。默认全程「可编辑的原生形状」打底；只有原生实在做不出、又确实影响美观的（复杂图表/装饰/配图）才局部用截图/生图插成图片。诚实天花板：选「可编辑优先」= 给「好看」设了上限（Office.js 网页版），目标是「整洁/专业/规范/不溢出不重叠」，惊艳留给局部图片块，别期望像素级。运行时走「盖印章/做工具」（不走纯指引让 LLM 手摆——后者易摆歪 + 一页十几张撤销卡）。

- [ ] **PVQ-01**: 设计系统 token 模块——`src/agent/design/ppt-tokens.ts` 集中存设计 token（字号阶梯：标题/副标/正文；统一页边距；网格：整页/左右两栏两套基础布局；配色板：主色 teal `#009887`/dark `#4FC9B8` + 1-2 中性灰 + 1 强调色，共 3-5 色），由代码注入而非硬写散落在 system prompt（便于统一调 + 避免 prompt 膨胀）。⚠️ token 为建议初值，待真机/UAT 调
- [ ] **PVQ-02**: 几何自查（纯 TS、确定性、零网络零依赖）——拿每个元素的 `{left,top,width,height}`（来自 `list_shapes_on_slide`/adapter），代码确定性算出版面问题并把违规清单作 evidence 喂回 LLM 重排（替换现 system prompt「让 LLM 拿坐标脑补重叠」）。基准 16:9 = 720×405pt。四项（阈值待真机调）：① 溢出（文本预估宽高 > 文本框，预估取保守上界）② 重叠（两元素 bounding box 相交且相交边长 >2pt）③ 越界（元素超画布或到边缘 < 页边距 token）④ 对比不足（文字/背景 WCAG < 4.5:1 正文 / < 3:1 ≥18pt 加粗大字）
- [ ] **PVQ-03**: `apply_slide_layout` 盖印章 write tool——入参 `{layout, 内容字段}`，工具内部按模板坐标一次性建好整页所有原生形状（一个 tool call = 一整页，顺手治「工具卡片太多」痛点）。**reverse 要点**：批量插入 → 逆向 = 批量删该页新建的所有形状，记录全部 `newShapeId`；inverse 方法**必须收 Record 对象、不能用位置参**（Phase 5 Word 位置签名致真机撤销全挂的教训，memory `adapter_inverse_signature`）；新 `PostStateSnapshot` kind + humanLabel + `operationLog.integration.test` 守门；工具入 `PPT_TOOLS` Set（casing 归一化，否则 camel/snake 静默失败）
- [ ] **PVQ-04**: 版式库（开发期 CSS 导坐标）——开发期用 CSS/浏览器把每套版式排好看 → 自动导出元素坐标固化成数据 → 内嵌进 `apply_slide_layout`（开发时享受 CSS 排版力，运行时仍是纯可编辑原生形状）。起步版式 = 封面 / 大数字KPI / 两栏对比 / 时间线 / 图文左右 / 要点列表。⚠️ 导出坐标要校准 Office.js 的 pt/px 换算 + 字体回退 fidelity 偏差
- [ ] **PVQ-05**: PPT 领域段 system prompt 重写——PVQ-01/02/03/04 机制就位后，把「教模型怎么排版（具体字号/坐标/自查清单）」的冗余规则**下沉到机制并从 prompt 移除**（机制已保证，prompt 再写就是冗余）；prompt 最终聚焦「只有模型能判断的」（故事线/选哪个版式/填什么内容/标题怎么写出洞察）+ 硬底线（可编辑优先/收到自查反馈就改/诚实边界）。⚠️ 删的是「冗余规则」不是「精确描述」（边界/禁则/判断标准务必精确无歧义，不怕长）；必须真机验证「模型到底照没照做」，A/B 迭代收敛
- [ ] **PVQ-06**: 自渲染预览 + 多模态自查——用 Aster 已知元素在 task pane 用绝对定位 div 按 16:9（720×405pt 等比缩放）重建 slide 预览 → `html2canvas`（**必须懒加载/动态 import**）截图 → 喂多模态模型（搭 v2.2 vision）查粗粒度问题（溢出/重叠/留白/对比），用同一份「自查 4 项」清单。**含 spike 验保真度**：自渲染预览 ≠ PowerPoint 真实渲染（字体回退/自动换行有偏差），spike 验「替身」够真、模型反馈有用才铺开；不够真则诚实降级（只保留 PVQ-02 几何自查兜底）

### 非功能（NFR — 延续 + 新增）

- [ ] **NFR-11**: 初始 bundle ≤82KB gzip CI gate 维持——`html2canvas`（PVQ-06）+ 任何重模块必须懒加载/动态 import，0 净新增初始 bundle 增量（沿用 v2.2 NFR-10 范式）；动 bundle 前先 `build` 再 `npm run size`（陈旧 dist 给假绿，memory `project_bundle_size_guard`）。延续硬约束：P95≤10s / Key 不上传 / 破坏性 write 工具 undo 守门不裸奔。**项目原则「质量 >> 成本&包体积」仍成立**（bundle gate / P95 / undo 守门仍硬卡）

---

## Future Requirements（已识别、明确拆到后续 milestone）

### C · Office.js 工具补全（广度 triage — 后续 milestone）

> Word ~15 / Excel ~15 / PPT ~6 候选 write tool，需像 v2.1 那样 triage 裁到高频痛点（详见 todos.md ⬜ 未实装块）。代表项：

- **C-WORD**: 删除线/高亮/上下标 · keepWithNext · 命名样式 · 项目符号/编号列表 · edit_table/insert_break/insert_hyperlink · 页眉页脚/批注/修订
- **C-EXCEL**: 边框/垂直对齐+wrapText/合并单元格 · 删重复行/清除/插删行列 · edit_table/数据透视表/数据验证/命名区域 · 标签页颜色 · 图表深化（坐标轴/图例/系列色/改类型）
- **C-PPT**: 文本框/线条箭头/高级填充 · PPT 表格/超链接/从模板插页（insertSlidesFromBase64）

### D · WPS 兼容（新平台押注 — 独立 milestone，需先决策值不值得做）

- **D-WPS**: WPS Office Add-in 适配（早期用户都在 Office for Web，优先级待单独决策）

### 其它已识别增强项（来自 v2.1/v2.2 归档）

- v2.1 B 工具 defer 残项、v2.2 IMG-D1/D2 / FILE-D1 / LIB-D1（Unsplash 备选）/ VIS-D1（DeepSeek 原生多模态降本）—— 见各里程碑归档 / backlog

---

## Out of Scope（v2.3 明确不做）

| Feature | Reason |
|---------|--------|
| C 工具补全 | 广度·同类延续，与 v2.3 纵深提质主题不同，拆后续 milestone |
| D WPS 兼容 | 换平台押注，早期用户都在 Office for Web，性质完全不同，独立决策 |
| PPT 动画/转场/SmartArt/套主题/读背景色 | ❌ Office.js 平台本身无 API（todos.md 已标，建不了） |
| Word 页边距/纸张方向/纸张大小 | ❌ Word JS API 对 pageSetup 支持极弱，基本拿不到 |
| Office.js 导出 slide 真实渲染图自查 | PowerPoint Web 无可靠「单页转 PNG」API，用 PVQ-06 自渲染预览替代 |
| 把「取当前时间」做成 tool | 时间几乎每轮都要用，做成 tool = 多一次网络往返拖慢首 token；放 message 末尾几十 token 即达同效（CTX-01 否决方案） |
| 后台摘要服务 / 向量库 | 违反无后台硬约束；摘要压缩只多一次浏览器直连 LLM 调用，不需后台 |

---

## Traceability

> 由 roadmapper 在 roadmap 创建时填充。每个需求映射到恰好一个 phase。

| Requirement | Phase | Status |
|-------------|-------|--------|
| CTX-01 | TBD | Pending |
| CTX-02 | TBD | Pending |
| CTX-03 | TBD | Pending |
| CTX-04 | TBD | Pending |
| CTX-05 | TBD | Pending |
| CTX-06 | TBD | Pending |
| PVQ-01 | TBD | Pending |
| PVQ-02 | TBD | Pending |
| PVQ-03 | TBD | Pending |
| PVQ-04 | TBD | Pending |
| PVQ-05 | TBD | Pending |
| PVQ-06 | TBD | Pending |
| NFR-11 | TBD | Pending |

**Coverage:**
- v2.3 requirements: 13 total（CTX 6 + PVQ 6 + NFR 1）
- Mapped to phases: 0（待 roadmapper）
- Unmapped: 13 ⚠️（roadmap 落定后归零）

---
*Requirements defined: 2026-06-03（milestone v2.3「精装与定力」start）*
*Last updated: 2026-06-03 — initial definition；B（CTX）排第一个 phase（用户定）；PVQ-06 经讨论由 stretch 提为必做+独立 phase（用户定）*
