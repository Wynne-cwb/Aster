# Sideload checklist（Spike #10）— PENDING

> 非 GATING：FAIL 时记录具体阻塞步骤，不止损

## 场景

在三宿主（PPT / Excel / Word for Web）× 两浏览器（Edge / Chrome）× 两个 profile（全新 profile + 现有 profile）
sideload manifest.xml，确认 Task Pane 可正常打开。

## 测试步骤

1. 下载 spike/manifest.xml
2. 打开 PPT for Web（edge 全新 profile）→ 插入 → 获取加载项 → 上传我的加载项 → 选择 manifest.xml
3. 确认 Aster ribbon 按钮出现，点击打开 Task Pane，确认 index.html 加载成功
4. 对 Excel / Word / Chrome / 现有 profile 重复步骤 2-3（6 个组合）
5. 记录每个组合的结果

## 实测结果

| 宿主 | 浏览器 | Profile | 结果 |
|------|--------|---------|------|
| PPT | Edge | 全新 | PENDING |
| PPT | Chrome | 全新 | PENDING |
| Excel | Edge | 全新 | PENDING |
| Excel | Chrome | 全新 | PENDING |
| Word | Edge | 全新 | PENDING |
| Word | Chrome | 全新 | PENDING |

## 证据

- [ ] 6 个组合的截图（至少 PPT + Edge 全新 profile 一张）

> ⚠ 安全提示：截图前确认 Office 帐号显示信息不含敏感邮箱（如必要，mask 邮箱）

## 决策

**结果：** PENDING

**PASS 条件：** ≥ 4/6 组合成功（至少 PPT + Excel + Word × Edge 通过）
**FAIL 时：** 记录具体错误信息，反馈到 Phase 7 sideload 文档优先级
