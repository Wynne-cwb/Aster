---
quick_id: 260601-ki6
phase: quick
plan: 260601-ki6
subsystem: docs
tags: [readme, logo, badge, branding]
key_files:
  created:
    - docs/aster-logo.png
  modified:
    - README.md
decisions:
  - "sideload badge 标签改为英文 'Live-sideload'（避免中文 URL 编码在 shields.io 渲染偶有字体问题）"
metrics:
  duration: ~5min
  tasks_completed: 2
  files_modified: 2
  completed_date: "2026-06-01"
---

# Quick Task 260601-ki6: README Logo & Badge

为 Aster GitHub 仓库首页新增居中视觉块（logo + 品牌 badge），提升开源项目第一印象。

## One-liner

在 README 顶部插入 `<div align="center">` 居中视觉块，包含 440×440 Aster logo、teal 双 badge（`#009887`）及 sideload 可点击链接；同步去除旧头部三行重复内容。

## 实际修改文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `docs/aster-logo.png` | 新建 | 从 `.planning/design/aster-redesign/src/assets/aster-logo.png` 复制，440×440 PNG，90.3 KB |
| `README.md` | 修改 | 顶部新增居中视觉块，删除旧三行重复内容，全部正文保留 |

## 头部视觉块最终结构

```html
<div align="center">
  <img src="docs/aster-logo.png" width="120" alt="Aster logo" />
  <h1>Aster</h1>
  <p>在原生 Office 里的 AI 代理 · 你说一句话，Aster 自主完成多步文档任务</p>
  <p>
    <img src="https://img.shields.io/badge/Office-PowerPoint·Excel·Word-009887?style=flat-square" ... />
    &nbsp;
    <a href="https://wynne-cwb.github.io/Aster/">
      <img src="https://img.shields.io/badge/Live-sideload-009887?style=flat-square" ... />
    </a>
  </p>
  <p><strong>BYO Key · 无后台 · 纯浏览器直连 · 开源</strong></p>
</div>
```

## 去重的三行

1. `# Aster — Office 智能代理`（旧 h1，已由 `<h1>Aster</h1>` 替代）
2. `在原生 Office 里的 AI 代理。你说一句话，...`（旧 tagline 段落）
3. `**BYO Key · 无后台 · 纯浏览器直连 · 开源**`（旧粗体标语行）

## 保留的正文章节（原文不变）

- Aster 怎么工作
- 4 个核心场景（PPT / Excel / Word / Shape 精细化）
- BYO Key / 无后台
- Sideload 安装
- 技术架构
- 产品口径
- 隐私
- 开发

## Commits

| Task | Commit | 描述 |
|------|--------|------|
| Task 1 | `3bd4dc6` | `chore(260601-ki6): add Aster logo asset to docs/` |
| Task 2 | `ef5e593` | `docs(260601-ki6): add centered hero block to README` |

## Deviations from Plan

无。计划按原文执行，唯一微调为 badge 标签已在 PLAN.md 中预先说明（英文 `Live-sideload` 避免中文 URL 编码渲染问题）。

## Self-Check

- [x] `docs/aster-logo.png` 存在（90.3 KB）
- [x] `README.md` 含 `align="center"`
- [x] 两个 `shields.io` badge，颜色均为 `009887`
- [x] sideload badge 链接指向 `https://wynne-cwb.github.io/Aster/`
- [x] 全部 7 个正文章节保留
- [x] 旧 h1 行已删除（无 `# Aster — Office 智能代理` 独立行）
- [x] Commit `3bd4dc6` 存在
- [x] Commit `ef5e593` 存在

## Self-Check: PASSED
