// src/agent/tools/visual-check-config.ts
// Phase 24 PVQ-06：自渲染预览视觉自查 — 铺开/降级路径开关
//
// 【默认值 = true（铺开，工具已注册为 advisory/可选）】
// 这是 spike 阶段的初始值，等待 UAT 保真度人眼判定（LOCKED-1）。
//
// UAT 判定后的操作：
//   铺开路径（保真度够用）：保持 true，视觉自查工具 visual_check_slide 可用
//   降级路径（保真度不足）：改为 false，工具不注册，系统回落到 Phase 22 几何自查
//     （check_slide_layout 兜底，仅文字/几何规则自查，无视觉截图）
//
// 降级时还需做：
//   1. REQUIREMENTS.md PVQ-06 更新状态（标注「降级：仅几何自查兜底」）
//   2. 告知用户话术：「视觉自查保真度不足，已回落到几何规则自查（溢出/重叠/越界/对比）」
//
// 可调项（LOCKED-3，UAT 调）：
//   (a) 保真度门槛 = 人眼粗粒度可辨认（无数值 gate）
//   (b) 触发 = on-demand（AI 主动调工具，非每次 apply_slide_layout 后 auto）
//   (c) 渲染 = visible（teal 克制小预览面板）
//   以上三项 UAT 可调，不需要改此文件，通过工具描述/面板 UI 实现

export const PVQ06_VISUAL_CHECK_ENABLED = true;
