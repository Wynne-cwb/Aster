---
plan_number: "10"
title: "非 GATING #9+#10 — Bundle-size 基线 + 三宿主 Sideload Checklist"
phase: 0
wave: 4
depends_on: ["06"]
files_modified:
  - spike/bundle-test/package.json
  - spike/bundle-test/vite.config.ts
  - spike/bundle-test/index.html
  - spike/bundle-test/src/main.tsx
  - .planning/spikes/009-bundle-size-baseline/findings.md
  - .planning/spikes/010-sideload-checklist/findings.md
autonomous: false
requirements: []
estimated_duration: "4 hours"
must_haves:
  goal: "bundle-size 基线 ≤1MB（gzipped ~300KB）已测量；三宿主 sideload checklist ≥4/6 组合通过"
  truths:
    - ".planning/spikes/009-bundle-size-baseline/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - ".planning/spikes/010-sideload-checklist/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "009 findings.md 包含 index.js 原始大小 + gzip 大小 + 主要体积占比"
    - "010 findings.md 包含 6 个测试组合（三宿主×两浏览器）的结果表格"
    - ".planning/spikes/MANIFEST.md Spike #9 和 #10 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-10-01
      description: "bundle-test 项目意外安装 @microsoft/office-js npm 包（已 deprecated）"
      mitigation: "package.json 中不添加 @microsoft/office-js；只用 @types/office-js（devDependency）；CLAUDE.md 已明确 Office.js 只从 CDN 加载"
    - id: T-00-10-02
      description: "bundle-test 使用 Fluent UI v8 barrel import 导致 bundle 超标"
      mitigation: "只安装 @fluentui/react-components v9（非 v8）；只导入具体组件（Button, Input, Text）而非整个包"
---

<objective>
非 GATING Spike #9 + #10（合并 plan）：

Spike #9：搭建 Vite + React 19 + Fluent UI v9 + Zustand + react-markdown 的最小测试项目，
测量初始 bundle 大小（目标 raw ≤1MB，gzipped ~300KB）。

Spike #10：用真实浏览器在三宿主（PPT/Excel/Word for Web）× 两浏览器（Edge/Chrome）× 全新 profile
sideload spike manifest.xml，记录 checklist 结果。

Purpose: bundle-size 基线确认 Phase 1 的起点可行；sideload checklist 是 Phase 7 REL-05 的初始证据，
也确认 manifest.xml 结构无误（三宿主能正常打开 Task Pane）。

Output:
- `spike/bundle-test/`（最小 Vite 项目，包含 package.json + vite.config.ts + src/main.tsx）
- 两个 findings.md 更新
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/research/PITFALLS.md

决策出处：
- PITFALLS.md Pitfall 6（bundle-size：Fluent v8 barrel import +500KB；@fluentui/react-icons 4MB；OpenAI SDK +250KB）
- PITFALLS.md Pitfall 18（sideload UX：Office for Web 不支持 URL 加载 manifest，必须下载本地文件上传）
- CLAUDE.md §Technology Stack — Vite 7 / React 19 / Fluent UI v9 / Zustand / react-markdown
- CLAUDE.md §Bundle size estimate（~300KB gzipped）

技术要点（Spike #9）：
- 必须用 @fluentui/react-components（v9），不用 v8
- 导入具体组件：`import { Button } from '@fluentui/react-components'`（不用 barrel import）
- Zustand + react-markdown 也需要导入
- 目标：React 19(~45KB gzip) + Fluent v9(~120KB) + Zustand(~1.2KB) + react-markdown(~40KB) + App(~80KB) = ~300KB gzipped
- 使用 `npx vite-bundle-visualizer` 或 `rollup-plugin-visualizer` 生成报告

技术要点（Spike #10）：
- Office for Web sideload 路径：插入 → 获取加载项 → 上传我的加载项 → 浏览选择 manifest.xml
- 三宿主各有独立 Ribbon button（plan 01 manifest.xml 已配置）
- 全新 profile = InPrivate/隐身窗口 or 新建 browser profile
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 bundle-size 基线 Vite 项目（spike #9）</name>
  <files>spike/bundle-test/package.json, spike/bundle-test/vite.config.ts, spike/bundle-test/index.html, spike/bundle-test/src/main.tsx</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 6（bundle-size 问题：Fluent v8 barrel、icons 4MB、OpenAI SDK、parser libs）
    - CLAUDE.md §Technology Stack §Core Framework §UI Components（推荐组件列表和 bundle 估算）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（代码在 spike/ 目录）
  </read_first>
  <action>
创建 `spike/bundle-test/` 目录下的最小 Vite + React 19 项目，用于测量 bundle-size。

**spike/bundle-test/package.json**：
```json
{
  "name": "aster-bundle-test",
  "version": "0.0.1",
  "private": true,
  "description": "Phase 0 bundle-size 基线测试",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "analyze": "vite-bundle-visualizer"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@fluentui/react-components": "^9.73.0",
    "@fluentui/tokens": "^9.0.0",
    "zustand": "^5.0.0",
    "react-markdown": "^9.0.0",
    "remark-gfm": "^4.0.0"
  },
  "devDependencies": {
    "@types/office-js": "latest",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "typescript": "^5.7.0",
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite-bundle-visualizer": "latest"
  }
}
```

注意：
- 不添加 `@microsoft/office-js`（已 deprecated，CDN 加载）
- 不添加 OpenAI SDK / Vercel AI SDK
- 不添加任何 parser 库（mammoth/xlsx/pdfjs — 这些是懒加载的，不进初始 bundle）

**spike/bundle-test/vite.config.ts**：
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // 手动 chunks：避免 Fluent UI 和 react-markdown 被合并
        manualChunks: {
          'fluent': ['@fluentui/react-components'],
          'markdown': ['react-markdown', 'remark-gfm'],
        }
      }
    }
  }
});
```

**spike/bundle-test/index.html**：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aster Bundle Test</title>
  <!-- Office.js 从 CDN 加载，不进 bundle -->
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

**spike/bundle-test/src/main.tsx**：
```tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import {
  FluentProvider,
  webLightTheme,
  Button,
  Input,
  Text,
  Spinner,
} from '@fluentui/react-components';
import { create } from 'zustand';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Zustand store（模拟聊天状态）
interface ChatStore {
  messages: { role: 'user' | 'ai'; content: string }[];
  addMessage: (msg: { role: 'user' | 'ai'; content: string }) => void;
}

const useChatStore = create<ChatStore>(set => ({
  messages: [],
  addMessage: msg => set(state => ({ messages: [...state.messages, msg] })),
}));

// 最小 App 组件（使用 Fluent UI v9 组件）
function App() {
  const { messages, addMessage } = useChatStore();
  const [input, setInput] = React.useState('');

  return (
    <FluentProvider theme={webLightTheme}>
      <div style={{ padding: '16px', maxWidth: '400px' }}>
        <Text size={600} weight="semibold">Aster Bundle Test</Text>
        <div style={{ margin: '12px 0', display: 'flex', gap: '8px' }}>
          <Input
            value={input}
            onChange={(_, d) => setInput(d.value)}
            placeholder="输入测试消息"
            style={{ flex: 1 }}
          />
          <Button
            appearance="primary"
            onClick={() => {
              addMessage({ role: 'user', content: input });
              addMessage({ role: 'ai', content: '**AI 回复**：' + input });
              setInput('');
            }}
          >发送</Button>
        </div>
        <div>
          {messages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <Text weight={msg.role === 'user' ? 'semibold' : 'regular'}>
                {msg.role === 'user' ? '用户' : 'AI'}：
              </Text>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {msg.content}
              </ReactMarkdown>
            </div>
          ))}
        </div>
        <Spinner size="tiny" label="（Spinner 用于 bundle 测试）" />
      </div>
    </FluentProvider>
  );
}

// Office.js 初始化后渲染
Office.onReady(() => {
  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
});
```

**同时在 findings.md 009 中记录运行步骤**：
```markdown
## 测试步骤

```bash
cd spike/bundle-test
npm install
npm run build
# 查看 dist/ 下文件大小
ls -lh dist/assets/
# 生成 bundle 分析报告
npm run analyze
```

预期输出：
- index.html（入口）
- assets/main-[hash].js（主 chunk）
- assets/fluent-[hash].js（Fluent UI chunk）
- assets/markdown-[hash].js（react-markdown chunk）

记录 main chunk 的 raw 大小和 gzip 大小。
```
  </action>
  <acceptance_criteria>
    - package.json 存在：`ls spike/bundle-test/package.json` 返回 0
    - 不含 @microsoft/office-js：`grep -c '@microsoft/office-js' spike/bundle-test/package.json` 返回 0
    - 含 @fluentui/react-components v9（非 v8）：`grep -c '@fluentui/react-components' spike/bundle-test/package.json` 返回 ≥ 1
    - 不含 OpenAI SDK：`grep -c 'openai\|@anthropic-ai\|ai-sdk' spike/bundle-test/package.json` 返回 0
    - vite.config.ts 存在：`ls spike/bundle-test/vite.config.ts` 返回 0
    - main.tsx 使用具体组件 import（非 barrel）：`grep -c 'Button, Input, Text\|from.*@fluentui' spike/bundle-test/src/main.tsx` 返回 ≥ 1
    - main.tsx 含 zustand：`grep -c 'zustand' spike/bundle-test/src/main.tsx` 返回 ≥ 1
    - main.tsx 含 react-markdown：`grep -c 'react-markdown\|ReactMarkdown' spike/bundle-test/src/main.tsx` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>ls spike/bundle-test/package.json && grep -c '@microsoft/office-js' spike/bundle-test/package.json | grep '^0$'</automated>
  </verify>
  <done>spike/bundle-test/ Vite 项目创建：React 19 + Fluent UI v9 + Zustand + react-markdown；无 deprecated 包；manualChunks 配置；findings.md 含测试步骤</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2：手动执行 bundle 构建测量 + sideload checklist</name>
  <what-built>
    - spike/bundle-test/ Vite 项目（需要本地 npm install 运行）
    - spike/manifest.xml（Plan 01 创建，指向 GitHub Pages URL）
  </what-built>
  <how-to-verify>
**Spike #9 — Bundle-size 基线：**
1. 在本地终端：
   ```bash
   cd /Users/wb.chen/Documents/Project/Aster/spike/bundle-test
   npm install
   npm run build
   ls -lh dist/assets/
   # 查看 main chunk 大小（raw 和 gzip 估算）
   # gzip 估算：原始大小 × 0.3 ≈ gzip 大小
   ```
2. 截图 `dist/assets/` 文件列表
3. （可选）`npm run analyze` 生成 bundle visualizer 报告
4. 记录：main chunk 原始大小、gzip 估算
5. 保存截图至 `.planning/spikes/009-bundle-size-baseline/`
6. 更新 009 findings.md 首行为 PASS（≤1MB raw）或 FAIL（>1MB）

**Spike #10 — Sideload Checklist：**
7. 下载 spike/manifest.xml（或从 GitHub 仓库下载）
8. 按以下组合测试（6 个组合，至少完成 4 个）：

| 宿主 | 浏览器 | Profile |
|------|--------|---------|
| PPT for Web | Edge | 全新 InPrivate |
| PPT for Web | Chrome | 全新隐身 |
| Excel for Web | Edge | 全新 InPrivate |
| Excel for Web | Chrome | 全新隐身 |
| Word for Web | Edge | 全新 InPrivate |
| Word for Web | Chrome | 全新隐身 |

每个组合步骤：
a. 打开对应浏览器的 InPrivate/隐身窗口
b. 登录 Microsoft 账号
c. 打开对应宿主（PPT/Excel/Word for Web）
d. 插入 → 获取加载项 → 上传我的加载项 → 选择 manifest.xml
e. 确认 Aster ribbon 按钮出现
f. 点击 Aster 按钮，确认 Task Pane 打开（显示 index.html 内容）
g. 截图

9. 保存至少 2 张截图至 `.planning/spikes/010-sideload-checklist/`
10. 更新 010 findings.md 表格 + 首行（PASS ≥4/6，FAIL <4/6）
11. 更新 MANIFEST.md Spike #9 和 #10 状态
  </how-to-verify>
  <resume-signal>
验证完成后输入：
- "#9 [PASS/FAIL: main chunk raw=XXkB, gzip≈XXkB]; #10 [PASS/FAIL: X/6 组合成功]"
例：#9 PASS: main chunk raw=620kB, gzip≈186kB; #10 PASS: 5/6 成功（Word+Chrome 超时）
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| bundle-test npm install → local machine | 只安装 devDependency，不含敏感信息 |
| manifest sideload → Office for Web | manifest 是公开文件，无 Key 信息 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-10-01 | Tampering | Fluent v8 barrel import | mitigate | package.json 只含 @fluentui/react-components（v9）；main.tsx 具体 import |
| T-00-10-02 | Information Disclosure | sideload manifest | accept | manifest 只含 URL，无 Key；公开仓库可接受 |
| T-00-10-03 | Denial of Service | npm install 供应链 | accept | spike 阶段 npm 依赖来自官方 registry；Phase 1 起 lock file 固定版本 |
</threat_model>

<verification>
整体验证（Spike #9 + #10 完成后）：
1. `head -1 .planning/spikes/009-bundle-size-baseline/findings.md` 含 PASS 或 FAIL
2. `head -1 .planning/spikes/010-sideload-checklist/findings.md` 含 PASS 或 FAIL
3. MANIFEST.md Spike #9 和 #10 状态非 PENDING
</verification>

<success_criteria>
- bundle-test/ Vite 项目存在，可 `npm install && npm run build` 成功
- findings.md 009 含 main chunk 大小实测值
- findings.md 010 含 6 个 sideload 测试组合结果
- 两个 findings.md 首行均为 PASS 或 FAIL
- MANIFEST.md Spike #9 和 #10 状态已更新
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-10-SUMMARY.md`，包含：
- Spike #9：main chunk raw 大小 + gzip 估算；Phase 1 bundle-size CI gate 建议基线值
- Spike #10：sideload 成功率（X/6）；失败的组合及原因；Phase 7 sideload 文档优先级建议
</output>
