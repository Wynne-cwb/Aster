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

## 实测结果（2026-05-27）

| 宿主 | 浏览器 | 结果 |
|------|--------|------|
| PPT | 浏览器 Office for Web | ✅ sideload 成功，Aster ribbon 出现，"打开 Aster" 开 Task Pane，index 测试中心加载成功 |
| Excel | — | 未测（同一 manifest 已声明 Workbook host，预期可行） |
| Word | — | 未测（同一 manifest 已声明 Document host，预期可行） |
| 第二浏览器 | — | 未测 |

**确认 1/6 组合**（PPT）。完整 6 组合矩阵留待 Phase 7 REL-04 完整验收。

### ★ 本 spike 的核心产出：免费个人账号可 sideload + 3 个 manifest 必修项

**账号：** 免费个人 Microsoft 账号**可以** sideload —— 路径是 **开始 → 加载项 → 更多设置 → 上传我的加载项**（不在"插入"下；不需要 M365 工作账号）。

**manifest 必修项（官方 office-addin-manifest validate 通过 ≠ Office 运行时接受）：**
1. `<Version>` 必须 ≥ 1.0（`0.0.1` 被 validate 直接拒）
2. base 段必须有 `<SupportUrl>` + `<IconUrl>` + `<HighResolutionIconUrl>`（VersionOverrides 内的 icon 不顶用）
3. Supertip 的 `<Description>` 必须引 **LongString**（引 ShortString 时 validate 不报错，但 Office 运行时报 `AddinManifestError: resid ... not found`）

> 关键教训：`office-addin-manifest validate` 通过只是必要条件。#3 是运行时才暴露的——validate 抓不到 ShortString/LongString 类型错配。Phase 1 写正式 manifest 直接套用这 3 条。

## 证据

- [x] PPT sideload 成功截图（ribbon Aster 组 + "Aster Spike 已就绪" 提示）
- [x] 3 个 manifest 修复 commit（git history：fix(00-01) 系列）
- [ ] Excel/Word + 第二浏览器组合：Phase 7 REL-04 补全

## 决策

**结果：** ✅ PARTIAL PASS —— PPT sideload 端到端成功（manifest 修正后）；完整 6 组合矩阵推迟 Phase 7 REL-04

**核心问题已答：** manifest 能 sideload + 开 Task Pane，免费账号可用。3 个 manifest 必修项是 Phase 1 的直接收益。完整 cross-host × cross-browser 矩阵本就是 Phase 7 REL-04 的验收范围。
