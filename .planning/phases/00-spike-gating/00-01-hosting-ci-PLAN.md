---
plan_number: "01"
title: "GitHub Pages 托管 + GitHub Actions 自动部署"
phase: 0
wave: 1
depends_on: []
files_modified:
  - .github/workflows/pages.yml
  - spike/README.md
  - spike/index.html
  - spike/manifest.xml
autonomous: true
requirements: []
estimated_duration: "2 hours"
must_haves:
  goal: "生产 https 托管上线，GATING #1 CORS 验证的前置条件满足"
  truths:
    - "GitHub Pages 站点在 https://<username>.github.io/aster（或对应仓库路径）可访问，HTTP 200 响应"
    - ".github/workflows/pages.yml 配置 main push 自动触发 deploy-pages"
    - "spike/manifest.xml 的 SourceLocation DefaultValue 指向上述生产 https URL"
    - "spike/index.html 成功加载 Office.js CDN script，console 无 404/CORS 错误"
    - "spike/README.md 顶部含免责声明：本目录是 Phase 0 验证代码，不是 v1 实现"
threat_model:
  threats:
    - id: T-00-01-01
      description: "spike 代码中硬编码 API Key 进入公开仓库"
      mitigation: "spike/ 所有 HTML 文件只从 UI 输入框读取 Key，禁止 hardcode；spike/.gitignore 排除任何含 Key 的 .env 或 local.* 文件"
    - id: T-00-01-02
      description: "GitHub Actions workflow 权限过宽"
      mitigation: "pages.yml 只授予 pages:write + id-token:write，其余权限不声明（最小权限原则）"
---

<objective>
搭建 GATING #1 CORS 验证的前置基础设施：GitHub Pages 生产托管 + GitHub Actions 自动部署流水线。

Purpose: GATING #1 CORS 验证必须从真实生产 https URL 触发（非 localhost），本 plan 是其硬依赖。同时创建 spike/ 目录与 manifest.xml 骨架，为后续所有 spike 测试提供宿主环境。

Output:
- `.github/workflows/pages.yml`（main push 自动部署到 GitHub Pages）
- `spike/README.md`（免责声明）
- `spike/index.html`（Office.js CDN 加载验证页）
- `spike/manifest.xml`（三宿主 XML manifest 骨架，SourceLocation 指向 Pages URL）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md

决策出处：
- D-01（平台 GitHub Pages）、D-02（URL 形态 仓库 root）、D-03（main push 自动部署）
- D-08（代码丢弃式，spike/ 独立目录）
- D-10（全部 commit 公开）
- PITFALLS.md Pitfall 14（图标 Cache-Control）、Pitfall 15（AppDomains 不 bypass CORS）、Pitfall 17（Manifest Hosts 配置）
- CLAUDE.md — Office.js CDN URL：https://appsforoffice.microsoft.com/lib/1/hosted/office.js
- CLAUDE.md — XML manifest 格式（非统一 JSON manifest）+ 三宿主 Host 声明 + 共享 runtime
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 GitHub Actions Pages 部署 workflow</name>
  <files>.github/workflows/pages.yml</files>
  <read_first>
    - .github/workflows/pages.yml（检查是否已存在，存在则读取再 edit）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-01 D-02 D-03
  </read_first>
  <action>
创建 `.github/workflows/pages.yml`，内容如下（严格按此，不得改变 action 版本或 trigger）：

```yaml
name: Deploy Spike to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: spike

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

注意：
- `path: spike` 表示将 spike/ 目录作为 Pages 根目录发布（D-02 仓库 root 对应 spike/ 目录内容）
- 无 build step：Phase 0 全是静态 HTML，不需要 npm install
- 三个 actions 版本固定（v4/v5/v3/v4），不用 @latest
  </action>
  <acceptance_criteria>
    - 文件存在：`ls .github/workflows/pages.yml` 返回 0
    - 含触发器：`grep -c 'branches: \[main\]' .github/workflows/pages.yml` 返回 ≥ 1
    - 含 deploy-pages@v4：`grep -c 'deploy-pages@v4' .github/workflows/pages.yml` 返回 ≥ 1
    - 含 upload-pages-artifact@v3：`grep -c 'upload-pages-artifact@v3' .github/workflows/pages.yml` 返回 ≥ 1
    - path 指向 spike：`grep -c 'path: spike' .github/workflows/pages.yml` 返回 ≥ 1
    - permissions 含 pages: write：`grep -c 'pages: write' .github/workflows/pages.yml` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'deploy-pages@v4' .github/workflows/pages.yml && grep -c 'path: spike' .github/workflows/pages.yml</automated>
  </verify>
  <done>pages.yml 存在，含正确 trigger + 三个 pages action 引用 + path: spike</done>
</task>

<task type="auto">
  <name>Task 2：创建 spike/ 骨架（README + index.html + manifest.xml）</name>
  <files>spike/README.md, spike/index.html, spike/manifest.xml, spike/.gitignore</files>
  <read_first>
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（丢弃式代码）§D-10（公开 commit）
    - CLAUDE.md §Technology Stack — Office.js CDN URL、XML manifest、shared runtime
    - .planning/research/PITFALLS.md Pitfall 15（AppDomains 不 bypass CORS）、Pitfall 17（manifest Hosts 配置）
  </read_first>
  <action>
创建以下四个文件：

**spike/README.md**（首行必须含免责声明，D-08 要求）：
```markdown
# ⚠ 本目录是 Phase 0 验证代码，不是 v1 实现

所有 spike/ 下的代码在 Phase 0 结束后将被丢弃。Phase 1 从 Yo Office 重新起步，不复用此处任何代码。

## 目的

对 10 项最高风险做实证验证，决定 PRD 与架构是否可进入 Phase 1。

每项验证的证据归档在 `.planning/spikes/00X-{slug}/findings.md`。
```

**spike/index.html**（Office.js CDN 加载验证页）：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aster Spike — Phase 0</title>
  <!-- Office.js 必须从 CDN 加载，npm @microsoft/office-js 已 deprecated -->
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
</head>
<body>
  <h1>Aster Phase 0 Spike</h1>
  <p id="status">正在初始化 Office.js…</p>
  <script>
    Office.onReady(function(info) {
      document.getElementById('status').textContent =
        'Office.js 已就绪。宿主: ' + (info.host || '未知') + ' | 平台: ' + (info.platform || '未知');
    });
  </script>
</body>
</html>
```

**spike/manifest.xml**（三宿主 XML manifest 骨架）：

在创建前，通过 GitHub 仓库 URL 推断 GitHub Pages URL。
URL 规则：`https://<github-username>.github.io/<repo-name>/`

从仓库 remote URL 提取（executor 可运行 `git remote get-url origin` 推断），
将 DefaultValue 设置为推断出的 Pages URL。

manifest.xml 结构（严格按 CLAUDE.md 规格）：
- ProviderName: Aster（Phase 0 spike）
- 三宿主：Workbook / Document / Presentation
- 共享 runtime：`<Runtime resid="Shared.Runtime.Url" lifetime="long"/>`
- AppDomains 列出 `api.deepseek.com` 和 `api.aihubmix.com`（用于 v1.1 Windows Desktop 导航安全，Pitfall 15 说明 Web 版不依赖此 bypass CORS）
- SourceLocation 指向 Pages URL 根（`https://<username>.github.io/<repo>/`）

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<OfficeApp
  xmlns="http://schemas.microsoft.com/office/appforoffice/1.1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bt="http://schemas.microsoft.com/office/officeappbasictypes/1.0"
  xmlns:ov="http://schemas.microsoft.com/office/taskpaneappversionoverrides"
  xsi:type="TaskPaneApp">

  <Id>00000000-0000-0000-0000-000000000001</Id>
  <Version>0.0.1</Version>
  <ProviderName>Aster (Phase 0 Spike)</ProviderName>
  <DefaultLocale>zh-CN</DefaultLocale>
  <DisplayName DefaultValue="Aster Spike"/>
  <Description DefaultValue="Phase 0 风险验证 spike。本 manifest 不是 v1 实现。"/>

  <AppDomains>
    <AppDomain>https://api.deepseek.com</AppDomain>
    <AppDomain>https://api.aihubmix.com</AppDomain>
  </AppDomains>

  <Hosts>
    <Host Name="Presentation"/>
    <Host Name="Workbook"/>
    <Host Name="Document"/>
  </Hosts>

  <DefaultSettings>
    <SourceLocation DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL"/>
  </DefaultSettings>

  <Permissions>ReadWriteDocument</Permissions>

  <VersionOverrides xmlns="http://schemas.microsoft.com/office/taskpaneappversionoverrides" xsi:type="VersionOverridesV1_0">
    <Hosts>

      <!-- PPT -->
      <Host xsi:type="Presentation">
        <Runtimes>
          <Runtime resid="Shared.Runtime.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <FunctionFile resid="Commands.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="CommandsGroup">
                <Label resid="CommandsGroup.Label"/>
                <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                <Control xsi:type="Button" id="PPT.ShowTaskpane">
                  <Label resid="TaskpaneButton.Label"/>
                  <Supertip><Title resid="TaskpaneButton.Label"/><Description resid="TaskpaneButton.Label"/></Supertip>
                  <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ButtonId1</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>

      <!-- Excel -->
      <Host xsi:type="Workbook">
        <Runtimes>
          <Runtime resid="Shared.Runtime.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <FunctionFile resid="Commands.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="CommandsGroupXL">
                <Label resid="CommandsGroup.Label"/>
                <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                <Control xsi:type="Button" id="XL.ShowTaskpane">
                  <Label resid="TaskpaneButton.Label"/>
                  <Supertip><Title resid="TaskpaneButton.Label"/><Description resid="TaskpaneButton.Label"/></Supertip>
                  <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ButtonId2</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>

      <!-- Word -->
      <Host xsi:type="Document">
        <Runtimes>
          <Runtime resid="Shared.Runtime.Url" lifetime="long"/>
        </Runtimes>
        <DesktopFormFactor>
          <GetStarted>
            <Title resid="GetStarted.Title"/>
            <Description resid="GetStarted.Description"/>
            <LearnMoreUrl resid="GetStarted.LearnMoreUrl"/>
          </GetStarted>
          <FunctionFile resid="Commands.Url"/>
          <ExtensionPoint xsi:type="PrimaryCommandSurface">
            <OfficeTab id="TabHome">
              <Group id="CommandsGroupWD">
                <Label resid="CommandsGroup.Label"/>
                <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                <Control xsi:type="Button" id="WD.ShowTaskpane">
                  <Label resid="TaskpaneButton.Label"/>
                  <Supertip><Title resid="TaskpaneButton.Label"/><Description resid="TaskpaneButton.Label"/></Supertip>
                  <Icon><bt:Image size="16" resid="Icon.16x16"/><bt:Image size="32" resid="Icon.32x32"/><bt:Image size="80" resid="Icon.80x80"/></Icon>
                  <Action xsi:type="ShowTaskpane">
                    <TaskpaneId>ButtonId3</TaskpaneId>
                    <SourceLocation resid="Taskpane.Url"/>
                  </Action>
                </Control>
              </Group>
            </OfficeTab>
          </ExtensionPoint>
        </DesktopFormFactor>
      </Host>

    </Hosts>

    <Resources>
      <bt:Images>
        <bt:Image id="Icon.16x16" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/assets/icon-16.png"/>
        <bt:Image id="Icon.32x32" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/assets/icon-32.png"/>
        <bt:Image id="Icon.80x80" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/assets/icon-80.png"/>
      </bt:Images>
      <bt:Urls>
        <bt:Url id="GetStarted.LearnMoreUrl" DefaultValue="https://github.com/REPLACE_USERNAME/aster"/>
        <bt:Url id="Commands.Url" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/commands.html"/>
        <bt:Url id="Taskpane.Url" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/"/>
        <bt:Url id="Shared.Runtime.Url" DefaultValue="REPLACE_WITH_GITHUB_PAGES_URL/"/>
      </bt:Urls>
      <bt:ShortStrings>
        <bt:String id="GetStarted.Title" DefaultValue="Aster Spike 已就绪"/>
        <bt:String id="CommandsGroup.Label" DefaultValue="Aster"/>
        <bt:String id="TaskpaneButton.Label" DefaultValue="打开 Aster"/>
      </bt:ShortStrings>
      <bt:LongStrings>
        <bt:String id="GetStarted.Description" DefaultValue="Aster Phase 0 Spike — 风险验证"/>
      </bt:LongStrings>
    </Resources>
  </VersionOverrides>
</OfficeApp>
```

executor 必须：
1. 运行 `git remote get-url origin` 获取仓库 URL
2. 从 URL 推断 GitHub Pages URL（格式：`https://<username>.github.io/<repo>`）
3. 将 manifest.xml 中所有 `REPLACE_WITH_GITHUB_PAGES_URL` 替换为真实 URL
4. 将 `REPLACE_USERNAME` 替换为真实 GitHub username

**spike/.gitignore**：
```
# 绝不提交含 API Key 的本地文件
.env
.env.*
local.*
*.local
# 视频文件通过 GitHub Release attachments 发布
*.mp4
*.mov
```

还需创建 spike 的占位图标（executor 需在 spike/assets/ 下创建三个占位 PNG 文件，16x16 / 32x32 / 80x80，可以是 1×1 像素的透明 PNG，避免 manifest 图标 404）。占位 PNG base64：
```
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==
```
（1x1 透明 PNG，分别保存为 icon-16.png / icon-32.png / icon-80.png）
  </action>
  <acceptance_criteria>
    - spike/README.md 存在：`ls spike/README.md` 返回 0
    - 免责声明在首行：`head -1 spike/README.md` 含"Phase 0 验证代码"或"不是 v1 实现"
    - spike/index.html 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com/lib/1/hosted/office.js' spike/index.html` 返回 ≥ 1
    - spike/manifest.xml 含三宿主：`grep -c 'xsi:type="Presentation"' spike/manifest.xml` + `grep -c 'xsi:type="Workbook"' spike/manifest.xml` + `grep -c 'xsi:type="Document"' spike/manifest.xml` 三个均返回 ≥ 1
    - manifest.xml 不含 REPLACE 占位符：`grep -c 'REPLACE_WITH_GITHUB_PAGES_URL' spike/manifest.xml` 返回 0
    - manifest.xml 含 https URL：`grep -c 'https://' spike/manifest.xml` 返回 ≥ 3
    - spike/.gitignore 存在：`ls spike/.gitignore` 返回 0
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'appsforoffice.microsoft.com' spike/index.html && grep -c 'REPLACE_WITH_GITHUB_PAGES_URL' spike/manifest.xml | grep '^0$'</automated>
  </verify>
  <done>spike/ 骨架就绪：README 含免责声明、index.html 加载 Office.js CDN、manifest.xml 三宿主指向真实 Pages URL、.gitignore 排除 Key 文件</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| spike code → GitHub public repo | spike 代码全部公开，需确保无 Key 泄露 |
| GitHub Actions → Pages deployment | workflow 权限最小化，仅 pages:write |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-01-01 | Information Disclosure | spike/*.html | mitigate | UI 输入框读取 Key，禁止 hardcode；.gitignore 排除 .env |
| T-00-01-02 | Elevation of Privilege | .github/workflows/pages.yml | mitigate | permissions 仅声明 pages:write + id-token:write，不声明 contents:write |
| T-00-01-03 | Information Disclosure | spike/manifest.xml | accept | manifest 只含 URL，无 Key 信息；公开仓库可接受 |
</threat_model>

<verification>
整体验证（Wave 1 完成后）：
1. 推送 main 分支，检查 GitHub Actions 是否触发：在仓库 Actions 页面确认 "Deploy Spike to GitHub Pages" workflow 执行成功
2. 访问 Pages URL（如 https://wb-chen.github.io/aster/），确认返回 index.html 内容
3. manifest.xml 中 SourceLocation 与实际 Pages URL 一致：`grep 'SourceLocation' spike/manifest.xml` 输出含真实 https URL
</verification>

<success_criteria>
- GitHub Pages 站点 https 可访问，HTTP 200
- pages.yml 在 main push 时自动触发（Actions tab 显示绿色 check）
- spike/index.html 在浏览器中加载 Office.js CDN 无 404
- spike/manifest.xml 无占位字符串，SourceLocation 指向真实 Pages URL
- spike/README.md 首行含免责声明
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-01-SUMMARY.md`，包含：
- GitHub Pages URL（实际 URL）
- Actions workflow 名称
- 首次部署成功时间戳
- manifest.xml SourceLocation 值
</output>
