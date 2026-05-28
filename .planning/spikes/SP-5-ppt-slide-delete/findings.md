# Spike SP-5: PPT slide.delete() Web 端可达性 + getSelectedSlides 反向排序

**Type:** ③ 用户真机
**Status:** pending（等用户跑）
**Date issued:** 2026-05-29

## 验证目标
1. Office for Web PPT 端 `slide.delete()` 是否真删（部分 Web API 有 silently 失败已知问题）
2. `getSelectedSlides()` 返回顺序是否与 Ribbon 顺序一致（PITFALLS 有反向排序传闻）

## 探测方法
临时 Task Pane 按钮组件：`.planning/spikes/SP-5-ppt-slide-delete/probe.tsx`
用户操作：sideload Aster → 临时挂载 SP5SlideDeleteProbe → PPT 真机：
  1) 打开包含 ≥2 张 slide 的 pptx
  2) 点 "Read initial slide count" 记录基线
  3) 点 "Delete last slide" → 比对 console / `<pre>` 与 PPT 文档实际 slide 数
  4) 多选 2-3 张 slide → 点 "Check selected slides order" → 比对 id 列表顺序

## 结果
（等用户跑后由 Claude 填充）

## 结论
（等结果）

## Fallback (D-25 类型 ③)
- slide.delete() 不可用 / silently 失败 → Phase 5 PPT inverse 改用 snapshot fallback（如复制原 slide 到末尾再删除新插入的），或直接 demo 时回避 PPT delete tool
- getSelectedSlides 反向 → Phase 5 PPT adapter 加 `slides.reverse()` 修正
- 两者都失败 → Phase 8 PPT demo 降级为 Word-only demo（不影响 v2 主体）
