# Aster — 原生 Office 内的 AI 提效助手

> 草稿状态：本 README 为 Phase 1 初稿。完整 sideload 视频/GIF、隐私政策全文（Privacy doc）将在 Phase 7（REL-01/REL-03）补齐。

**核心价值：** 在原生 Office 内部，让中文职场用户用自带 API Key 享受 AI 提效，无需切网页、无需订阅 Copilot、无需把数据交给中间服务器。

Aster 是一个 Office.js Add-in，运行在 PowerPoint / Excel / Word 三个宿主之上。通过 DeepSeek V4 等大模型，把"一键文档操作 + 多轮聊天"两种 AI 提效形态直接嵌进原生 Office。

---

## 无后台 / BYO Key 说明

Aster 没有任何自有服务器。

- 所有 LLM / 图像调用均从**用户浏览器直连 Provider**（DeepSeek、AiHubMix 等）
- **API Key 永不离开你的浏览器**，不会上传到任何 Aster 自有服务器
- Key 存储在浏览器本地存储（localStorage），不随文档传播，不经过中间人
- 切换浏览器（如 Edge → Chrome）需重新输入 Key——这是无后台架构的必然设计

这是 Aster 的核心架构约束，不可妥协。

---

## sideload 步骤（Office for Web，免费个人 Microsoft 账号即可）

> **前置条件：** Edge 或 Chrome 浏览器（最新两个大版本），登录个人 Microsoft 账号

### 步骤

1. **下载 manifest.xml**
   - 从本仓库根目录下载 [`manifest.xml`](./manifest.xml)

2. **打开 Office for Web**
   - 访问 [office.com](https://www.office.com)，打开 PowerPoint / Excel / Word 任意一个文档

3. **上传加载项**
   - 点击顶部菜单：**开始 → 加载项 → 更多设置**
   - 在弹出窗口选择：**上传我的加载项**
   - 选择下载的 `manifest.xml` 文件，点击上传

4. **打开 Aster**
   - 上传成功后，在 **Home（开始）** 标签页会出现 **Aster** 按钮组
   - 点击 **打开 Aster** 即可打开 Task Pane（侧边栏）

> **注意：** sideload 的加载项在同一个浏览器 profile 下有效。重新打开浏览器或换 profile 后可能需要重新上传。

### 支持的宿主与浏览器

| 宿主 | 支持状态 |
|------|---------|
| PowerPoint for Web | MVP 必须 |
| Excel for Web | MVP 必须 |
| Word for Web | MVP 必须 |

| 浏览器 | 版本要求 |
|--------|---------|
| Microsoft Edge | 最新两个大版本（>= 120） |
| Google Chrome | 最新两个大版本（>= 120） |

> **不在 v1 支持范围：** Mac / iOS / Android 版 Office Desktop。Windows Office Desktop 同 manifest 验证将在 v1.1 进行。

---

## 兼容性说明（NFR-06）

MVP 阶段支持：**Office for Web × Edge / Chrome 最新两个大版本 × PowerPoint / Excel / Word 三宿主**。

完整的跨宿主 × 跨浏览器 sideload 矩阵（6 个组合）验收将在 Phase 7 REL-04 完成。

---

## 技术架构概览

- **构建工具：** Vite 7 + TypeScript 5.7 strict
- **UI：** React 19 + Fluent UI React v9（Office 原生视觉风格）
- **状态：** Zustand（轻量，无 Provider 样板代码）
- **LLM 调用：** 原生 `fetch` + `ReadableStream`，无第三方 SDK，0 KB 运行时开销
- **Office.js：** 通过 CDN 加载（官方推荐，npm 包已废弃）
- **初始 Bundle：** 约 138 KB gzip（1 MB 预算的 14%，由 CI size-limit 守卫）
- **存储：** 浏览器 localStorage（API Key 不随文件传播）

---

## 开发

```bash
# 安装依赖
npm ci

# 启动开发服务器（HTTPS，自动注入 Office.js）
npm run dev

# 构建生产产物
npm run build

# 检查 bundle 大小（超 1 MB 报错）
npm run size

# 运行测试
npm test
```

---

## 发布方式

v1 仅通过 **sideload + 开源仓库 manifest** 分发，不走 Microsoft AppSource。

生产托管：[https://wynne-cwb.github.io/Aster/](https://wynne-cwb.github.io/Aster/)

---

*完整隐私政策、sideload 视频演示、AppSource 发布计划将在 Phase 7（REL-01/REL-03）补全。*
