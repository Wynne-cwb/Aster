---
title: DeepSeek + AiHubMix 内置 model 下拉（替代手动输入 model 字符串）
captured: 2026-05-28
source: phase-02.1-uat-feedback
priority: high
size: quick-task-or-02.2
resolves_phase: 4
resolves_req: CARRY-02
---

## 触发
UAT-3 测试时，用户原意是改 API Key 为 `sk-invalid` 触发错误分类，结果误改了 model 字段，导致出现误报「网络连接失败」。手动输入 model 字符串 = 高 UX 风险（拼写错 / 改错字段 / model 下线后老 Key 还连不上）。

## 需求
Settings → Provider 编辑表单里，**已知的 Provider（DeepSeek / AiHubMix）model 字段改为下拉**：

### DeepSeek
- `deepseek-v4-flash`（默认）
- `deepseek-v4-pro`

### AiHubMix
- `gpt-image-2` (图像生成)
- `gpt-4o` / `gpt-5` (视觉 + 文本)
- 其它常用？需查 CLAUDE.md / AiHubMix 文档确认

### 自定义 Provider（非 built-in）
- 保留手动输入 model（自由）
- 可加「最近用过的 model」缓存

## 实现要点
- 模型清单 source：复用 `src/providers/pricing.ts` 的 `PROVIDER_PRICING` map keys（已经按 model 维度存了）
- UI：原生 `<select>` 即可（不需要造组件），按当前自写 CSS 设计系统的 token
- isBuiltIn=true 的 Provider → 下拉；isBuiltIn=false → 文本输入框
- model 变化时不应破坏 D-13 cost-badge 路由（pricing 已是 dual-key (providerId, model)，是稳的）

## 关联
- 与 02.1 G-04（cost-badge dual-key 路由）协同：避免用户手输错 model 名导致 ¥ 又显示不出
- 与 02.1 G-07（错误分类）协同：减少 model 名错引发的误报路径
- 建议走 quick task；如范围扩到「Provider 注册表/能力探测」（如 supportsToolCall）的 UI 暴露，则并入 02.2

---

## ✅ 实装确认（v2.4 close 代码对账，2026-06-08）

**状态：DELIVERED & LIVE**（CARRY-02，v2.0 交付，PROJECT.md §Validated 已记）。
- **落点**：`src/components/Settings/ProviderForm.tsx:189-196` —— 内置 Provider（DeepSeek / AiHubMix）的 model 字段渲染为 `<select>` 固定清单（注释明确标 `CARRY-02 / D-07`）；自定义 Provider（`isBuiltIn=false`）走 text input，与需求一致。
- **守门**：`ProviderForm.test.tsx` 显式断言「内置 deepseek → `<select>` 含 deepseek-v4-pro/flash」「内置 aihubmix → `<select>`」「自定义 → text input（无 select）」。
- **与原 capture 的偏差（说明）**：① model 清单 source **不再是** `src/providers/pricing.ts`——该文件已随 v2.0 cost 功能整体移除（memory `project_aster_cost_removed`），内置清单改由 `src/providers/registry.ts` 提供；② 原文「cost-badge dual-key 路由协同」随 cost 功能移除已不适用。功能本体（下拉替代手输 model）按需求交付无缺。
