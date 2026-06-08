# Phase 30: WPS-02/03 真机验证探针（硬门）- Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 30-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-08
**Phase:** 30-wps-02-03（WPS-02/03 真机验证探针，硬门 go/no-go）
**Mode:** interactive（user-led，discuss TeamMate 用 AskUserQuestion 直达真人用户）
**Areas discussed:** 探针范围与工作量 / go 门槛与宿主覆盖 / 探针形态与易用性 / 真机 API Key 后勤
**Context changed since Phase 25:** 用户原 `25-D-01`「暂无 Windows 环境，真机延后」已**翻转**——用户现已装 WPS Windows 桌面专业版，真机探针本里程碑即可跑。

---

## 区域选择（present_gray_areas）

用户经 AskUserQuestion（multiSelect）从 4 个候选灰区中选择讨论范围。

| 候选灰区 | 选中 |
|---|---|
| 探针范围与工作量 | ✓ |
| go 门槛 / 宿主覆盖 | ✓ |
| 探针形态 / 易用性 | ✓ |
| API Key 后勤确认 | ✓ |

**用户选择：全选 4 个。**

---

## 探针范围与工作量

| Option | Description | Selected |
|--------|-------------|----------|
| 精简·首宿主聚焦 | 两生死线 → 只跑 Excel+PPT 读/写/撤销 + 仅决定 Excel/PPT 所需的几项增益（copy_slide/AddTable/AddLine/PivotTable）；Word 读写撤销 + 其余增益全延后。最快拿裁定 | ✓ |
| 中间·三宿主基础+关键增益 | 两生死线 → 三宿主都跑基础读/写/撤销 + 只跑决定首宿主的关键增益，跳过 SmartArt/动画等次要增益 | |
| 完整·全 §5 清单 | 段0+1+2+3 全跑，~25 步，含三宿主全部 D-03 增益（含 SmartArt/动画/转场/套主题） | |

**用户选择：精简·首宿主聚焦**
**Notes:** 与单宿主滩头堡策略 + 首宿主候选 go 门槛天然配套。两条 make-or-break 无论哪个范围选项都是硬门、都先跑。延后项非砍——首宿主锁定后按需补探。→ 30-D-01

---

## go 门槛 / 宿主覆盖

| Option | Description | Selected |
|--------|-------------|----------|
| 首宿主候选(Excel+PPT)绿即可推进 | 两生死线绿 + Excel/PPT 至少一个基础读写撤销绿 = go。符合 v2.5 单宿主滩头堡策略，Word 非首选不卡 go | ✓ |
| 三宿主全绿才 go（沿用 25-D-02） | PPT/Excel/Word 三宿主基础读写撤销都绿 + 两生死线绿 = go。Phase 25 最保守阈值 | |
| 最低：任一宿主绿即 go | 两生死线绿 + 任一宿主基础读写撤销绿 = go | |

**用户选择：首宿主候选(Excel+PPT)绿即可推进**
**Notes:** **有意修订 Phase 25 的 `25-D-02`「三宿主全绿才 go」。** 理由：25-D-02 是在「要不要立项三宿主全量移植 WPS-D1」语境下定的高信心阈值；v2.5 已决定先做单宿主滩头堡（Word 明确非首选），go 门槛应与单宿主策略对齐。两条 make-or-break 始终是独立硬门，不可用宿主绿抵消。→ 30-D-02

---

## 探针形态 / 易用性

| Option | Description | Selected |
|--------|-------------|----------|
| 自动按钮 UI | Task Pane 一个「跑检测」按钮，自动执行能自动的项 + 显示通过/失败 + 一键复制结果报告；本质手动项（关WPS重开测持久化、看 DevTools Network 确认无 CSP 拦）配图文步骤。Claude 多花开发力气，用户摩擦最小 | ✓ |
| 纯 console 代码片段清单 | 给可勾选清单 + 每项一段 console 代码，用户在 WPS DevTools 逐段粘贴跑。开发省事，用户手动劳动多 | |

**用户选择：自动按钮 UI**
**Notes:** WPS DevTools 调试体验痛苦（ALT+F12/CEF F12），按钮 UI 省用户真机麻烦。探针 UI 是 throwaway，不强制 teal 设计系统，但「字体/CSS 渲染探测」检查项仍验真 Aster 字体栈 + teal CSS。→ 30-D-03

---

## 真机 API Key 后勤

| Option | Description | Selected |
|--------|-------------|----------|
| DeepSeek key 会备好 | 仅 DeepSeek key，第二条生死线可跑；图片直连暂不验 | |
| DeepSeek + 图片 key 都备 | DeepSeek + aihubmix/Pexels 都备，顺带验清单 1-3 图片直连（b64_json/缩略图） | ✓ |
| 现在没把握能拿到 key | 需先解决 key 后勤，否则 SSE 测试跑不了 | |

**用户选择：DeepSeek + 图片 key 都备**
**Notes:** DeepSeek key = 第二条 make-or-break 硬前提。图片 key 顺带验 WPS CEF 容器 CORS 图片面（复用 v2.2 经验），但图片面定位为**非阻塞 bonus**，不计入 go/no-go 硬门。本探针真机测试是用户在 Windows 上亲自跑，key 由用户在那台机器上提供（非 Claude `.env.local`）。→ 30-D-04

---

## 收尾确认

| Option | Selected |
|--------|----------|
| 可以落盘写 CONTEXT | ✓ |
| 我还想调整几点 | |

**用户选择：可以落盘写 CONTEXT。**

---

## Claude's Discretion

- 探针工程脚手架细节（wpsjs 模板 / ribbon.xml / sideload 路径 / Vite 是否参与 / 目录命名）= 可研究标准流程。
- 探针结果报告精确文本格式。
- 每条 JSAPI 探测确切调用写法 = 可研究事实（见 30-CONTEXT.md researchable_facts）。

## Deferred Ideas

- 🔒 GATED 首宿主 Excel vs PPT 最终锁定 → 待 Phase 30 真机数据 + Phase 32 前 discuss 裁定（探针已纳入 4 项增益探测作判据）。
- 🔒 GATED CEF 版本 / CSP-CORS 策略 / localStorage 持久性 / JSAPI 静默 no-op 与方法签名 → 只能真机解答。
- 延后探测：Word read/write/undo + 其余 D-03 增益（读背景色/取选中图/渐变/SmartArt/PageSetup）。
- 图片直连 = 非阻塞 bonus（跑并记录，不计 go/no-go 硬门）。
- Reviewed-not-folded todos：WR-02 / WR-03（PPT 视觉自查 follow-up，与本 phase 无关，保留 pending）。
- 后续里程碑 WPS-D1（三宿主全量）/ WPS-D2（网页移动版）不碰；no-go 路径干净收口、不静默上后台。
