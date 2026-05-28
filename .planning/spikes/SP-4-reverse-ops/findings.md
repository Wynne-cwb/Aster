# Spike SP-4: 三宿主 reverse 操作可达性

**Type:** ③ 用户真机
**Status:** pending（等用户跑）
**Date issued:** 2026-05-29

## 验证目标
- Word：paragraph.delete() 跨 await 可用？
- Excel：选区 before-image (.values) 抓取与覆写
- PPT：slides 读取（SP-5 一起跑插入+删除）

## 探测方法
临时 Task Pane 按钮组件：`.planning/spikes/SP-4-reverse-ops/probe.tsx`
用户操作：sideload Aster → 临时挂载 SP4ReversePanel → PPT/Excel/Word 真机点对应按钮 → console 与组件内 `<pre>` 日志截图发回。

## 结果
（等用户跑后由 Claude 填充）

## 结论
（等结果）

## Fallback (D-25 类型 ③)
- Word delete 不可用 → Phase 5 Word inverse 改 snapshot fallback（Claude 提议，用户确认）
- Excel before-image 抓不到 → 同上
- PPT 读 slides 失败 → 与 SP-5 一起处理
