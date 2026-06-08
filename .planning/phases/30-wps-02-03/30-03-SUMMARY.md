---
phase: 30-wps-02-03
plan: "03"
subsystem: wps-probe
tags: [wps, checklist, readme, docs, go-no-go]
provides: [wps-probe-user-docs]
affects: [public/wps-probe, .planning/phases/30-wps-02-03]
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md
    - public/wps-probe/README.md
  modified: []
key-decisions:
  - "真机清单含 go/no-go 框架（两生死线绿 AND (Excel OR PPT)）+ 两宿主分别运行（D-03 数据）+ localStorage 手动项 + DevTools 辅助 + 回贴步骤"
requirements-completed: [WPS-02, WPS-03]
duration: "—"
completed: 2026-06-08
---

# Phase 30 Plan 03: 真机验证清单 + 探针 README Summary

两份面向用户的文档已生成：真机验证清单（用户照单在 Windows WPS 跑）+ 探针 README（GitHub 浏览仓库时的安装/使用说明）。

## 创建文件
- `.planning/phases/30-wps-02-03/30-REAL-MACHINE-CHECKLIST.md` — 第 0-6 步全覆盖 + go/no-go 框架 + D-03 首宿主判据 + FAQ + 部署说明。
- `public/wps-probe/README.md` — throwaway 性质声明 + 文件结构 + 两条 sideload 路径 + 使用步骤 + 安全说明 + 清单链接。

## 清单覆盖的检查项（对齐 30-VALIDATION.md Per-Task Map）
| 步骤 | 内容 |
|------|------|
| 第 0 步 | 前置 Key（DeepSeek 必填 / aihubmix·Pexels 选填）+ 确认专业版 |
| 第 1 步 | sideload 路径 A（oem.ini `JSPluginsServer`）/ 路径 B（联系 Claude，无 publish.html URL） |
| 第 2 步 | 打开面板 + 填 Key |
| 第 3 步 | 运行所有检查（8 项表格：CEF / SSE / LS写 / LS持久 / 字体CSS / 图片 / Excel / PPT） |
| 第 3.5 步 | 金山表格（ET）+ 金山演示（WPP）各运行一次（首宿主 D-03 数据） |
| 第 4 步 | localStorage 跨会话持久（完全关闭 WPS → 重开 → 再点）本质手动项 |
| 第 5 步 | DevTools 辅助（F12 Task Pane / ALT+F12 ribbon）补充证据 |
| 第 6 步 | 复制结果报告 → 粘贴回贴给 Claude |
| 裁定框架 | 两生死线绿 AND (Excel 基础读写撤销绿 OR PPT 基础读写撤销绿) + D-03 首宿主判据 |

## Verify 结果（real grep）
- CHECKLIST: `两生死线绿 AND (Excel`=1 ✅ / `JSPluginsServer`=1 ✅ / `完全关闭 WPS`=2 ✅ / `复制结果报告`=6 ✅ / DeepSeek必填=2 ✅ / `F12`=4 ✅ / ET运行一次=2 ✅ / WPP运行一次=2 ✅ / 回贴给 Claude=1 ✅
- README: `JSPluginsServer`=1 ✅ / `throwaway`=1 ✅ / `复制结果报告`=1 ✅ / `Claude`=4 ✅ / Key 安全说明=2 ✅

## Deviations from Plan
- **[Rule 1 - 自洽 grep 修正] 清单显式补一行精确措辞 `综合裁定 = 两生死线绿 AND (Excel 基础读写撤销绿 OR PPT 基础读写撤销绿)`。** 原因：计划正文 go/no-go 节用结构化代码块表述，未含验收要求的逐字串 `两生死线绿 AND (Excel`。补一行加粗摘要使 `grep=1`，与 success_criteria 措辞一致。
- **[Rule 1 - 部署落点] README 落 `public/wps-probe/README.md`** + 补「部署说明」节（源码 = public/wps-probe/，机制 = Vite public→dist→Pages）。README 内链 `../../.planning/...` 在此落点解析正确（指向仓库根 .planning/）。

**Total deviations:** 2 auto-fixed。**Impact:** 仅补充精确措辞与部署落点说明，内容与意图完全一致。

## Next
Phase 30 三个 plan 全部 execute 完成。探针就绪并已坐实部署可达；**真机 go/no-go 运行待用户在 Windows WPS 上执行**（不在本步骤）。
