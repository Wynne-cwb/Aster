---
plan_number: "03"
title: "GATING #1 — CORS 验证：生产 https Task Pane 直连 DeepSeek + aihubmix"
phase: 0
wave: 2
depends_on: ["01", "02"]
files_modified:
  - spike/cors-test.html
  - .planning/spikes/001-cors-verify/findings.md
autonomous: true
requirements: []
estimated_duration: "3 hours"
must_haves:
  goal: "确认从 GitHub Pages https URL 直连 DeepSeek + aihubmix 的 CORS 可行性"
  truths:
    - ".planning/spikes/001-cors-verify/findings.md 存在且第一行含 PASS 或 FAIL 字样（非 PENDING）"
    - "findings.md 含 DeepSeek Access-Control-Allow-Origin 响应头实测值"
    - "findings.md 含 aihubmix Access-Control-Allow-Origin 响应头实测值"
    - ".planning/spikes/001-cors-verify/ 目录下存在录屏文件（recording.mp4 / recording.gif）或 GitHub Release 视频链接已写入 findings.md"
    - ".planning/spikes/MANIFEST.md 第 1 行 spike 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-03-01
      description: "测试用 API Key 泄露进公开仓库"
      mitigation: "spike/cors-test.html 的 Key 只从 UI <input> 读取，禁止 hardcode；截图前确认 Authorization 不可见"
    - id: T-00-03-02
      description: "截图中意外捕获 API Key 明文"
      mitigation: "DevTools 截图前展开 Response Headers 区域时滚动避开 Authorization 行，或用图片编辑工具 redact"
---

<objective>
GATING #1：在生产 https Task Pane（GitHub Pages URL）从 sideloaded add-in 直连
`api.deepseek.com` 与 `api.aihubmix.com`，验证浏览器 CORS 策略允许请求通过。

Purpose: 这是 Aster 整个"无后台"架构的生死关口。CORS 失败 = 所有 AI 调用无法直连
Provider，Core Value 崩塌。必须在 Day 1-2 确认，任何其他 spike 都在这个前提下才有意义。

Output:
- `spike/cors-test.html`（CORS 验证页：触发 DeepSeek streaming + aihubmix 生图）
- `.planning/spikes/001-cors-verify/findings.md`（更新为 PASS/FAIL + 证据）
- 截图文件：`deepseek-response-headers.png`、`aihubmix-response-headers.png`
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/research/PITFALLS.md

决策出处：
- ROADMAP.md §Phase 0 Success Criteria #1（GATING #1 详细描述）
- CONTEXT.md §D-04（gate-first，Day 1-2 只跑 GATING）
- CONTEXT.md §D-05（GATING 失败止损规则）
- CONTEXT.md §D-06（CORS fail → Cloudflare Worker，不 drop provider）
- PITFALLS.md Pitfall 15（AppDomains 不 bypass CORS，CORS 由 API server 决定）
- CLAUDE.md §DeepSeek — endpoint: POST /chat/completions，model: deepseek-v4-pro，streaming: text/event-stream SSE
- CLAUDE.md §aihubmix — base URL: https://api.aihubmix.com/v1，POST /images/generations

安全要求：
- 使用 dev/test API Key（小额度），绝不用生产 Key
- Key 只在浏览器 UI 输入，不写代码
- 截图前确认 Authorization header 不可见（截图区域滚动避开，或 redact）
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 CORS 测试页 spike/cors-test.html</name>
  <files>spike/cors-test.html</files>
  <read_first>
    - spike/index.html（了解当前骨架结构，executor 已读过，提取 Office.js CDN URL 与 onReady 模式）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（代码在 spike/ 目录，丢弃式）
    - CLAUDE.md §Streaming LLM Calls（DeepSeek SSE 格式）§LLM Provider Specifics（endpoint、model ID）
    - .planning/research/PITFALLS.md Pitfall 15（AppDomains 不 bypass CORS，fetch 受 API server 控制）
  </read_first>
  <action>
创建 `spike/cors-test.html`，实现以下功能：

1. **UI 区域**（无框架，纯 HTML）：
   - DeepSeek API Key 输入框（type=password）
   - aihubmix API Key 输入框（type=password）
   - "测试 DeepSeek CORS（流式）" 按钮
   - "测试 aihubmix CORS（生图）" 按钮
   - 结果输出区域（逐字显示 SSE token）
   - 状态区域（显示请求状态、响应头关键字段）

2. **DeepSeek CORS 测试函数**：
```javascript
async function testDeepSeekCORS(apiKey) {
  const result = document.getElementById('result');
  result.textContent = '正在发送 DeepSeek 请求...\n';

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',  // 用 flash 省钱；功能验证不需要 pro
        messages: [{ role: 'user', content: '回复"CORS验证成功"，不要其他内容' }],
        stream: true,
        max_tokens: 20,
      }),
    });

    // 显示关键响应头（不含 Authorization）
    const acao = response.headers.get('Access-Control-Allow-Origin');
    const acam = response.headers.get('Access-Control-Allow-Methods');
    result.textContent += `DeepSeek 响应状态: ${response.status}\n`;
    result.textContent += `Access-Control-Allow-Origin: ${acao || '(未设置 — CORS 失败)'}\n`;
    result.textContent += `Access-Control-Allow-Methods: ${acam || '(未设置)'}\n\n`;

    if (!response.ok) {
      result.textContent += `错误: HTTP ${response.status}\n`;
      return;
    }

    // 读取 SSE 流
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    result.textContent += 'SSE 流内容：\n';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { result.textContent += '\n[DONE]\n'; break; }
        try {
          const parsed = JSON.parse(data);
          const token = parsed.choices?.[0]?.delta?.content || '';
          if (token) { fullText += token; result.textContent += token; }
        } catch { /* skip malformed lines */ }
      }
    }

    result.textContent += '\n\n✅ DeepSeek CORS 验证成功！完整输出: ' + fullText;

  } catch (err) {
    result.textContent += '\n❌ DeepSeek CORS 失败: ' + err.message + '\n';
    result.textContent += '（如出现 CORS error，需要 D-06 Cloudflare Worker fallback）\n';
  }
}
```

3. **aihubmix CORS 测试函数**（生图请求，非流式）：
```javascript
async function testAihubmixCORS(apiKey) {
  const result = document.getElementById('result');
  result.textContent += '\n正在发送 aihubmix 生图请求...\n';

  try {
    const response = await fetch('https://api.aihubmix.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: 'gpt-image-1',  // Phase 0 先用 gpt-image-1（文档明确支持），gpt-image-2 在 spike 中确认
        prompt: 'A simple blue square, minimalist, for CORS test',
        n: 1,
        size: '256x256',  // 最小尺寸省钱
      }),
    });

    const acao = response.headers.get('Access-Control-Allow-Origin');
    result.textContent += `aihubmix 响应状态: ${response.status}\n`;
    result.textContent += `Access-Control-Allow-Origin: ${acao || '(未设置 — CORS 失败)'}\n`;

    if (!response.ok) {
      const errText = await response.text();
      result.textContent += `错误: HTTP ${response.status} — ${errText.slice(0, 200)}\n`;
      return;
    }

    const data = await response.json();
    result.textContent += `✅ aihubmix CORS 验证成功！图片 URL: ${data.data?.[0]?.url?.slice(0, 80) || '(base64)'}\n`;

  } catch (err) {
    result.textContent += '\n❌ aihubmix CORS 失败: ' + err.message + '\n';
  }
}
```

4. **完整 HTML 结构**（确保 Office.js 加载，测试在 Task Pane 内进行）：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Aster CORS 验证 — Spike #1</title>
  <!-- Office.js 必须从 CDN 加载 -->
  <script src="https://appsforoffice.microsoft.com/lib/1/hosted/office.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; padding: 16px; max-width: 600px; }
    input { width: 100%; padding: 8px; margin: 4px 0 12px; border: 1px solid #ccc; }
    button { padding: 8px 16px; margin: 4px; background: #0078d4; color: white; border: none; cursor: pointer; }
    button:hover { background: #106ebe; }
    #result { margin-top: 16px; padding: 12px; background: #f5f5f5; white-space: pre-wrap; font-family: monospace; font-size: 12px; min-height: 200px; max-height: 400px; overflow-y: auto; }
    .warning { color: #d13438; font-weight: bold; }
  </style>
</head>
<body>
  <h2>Aster CORS 验证 — Spike #1</h2>
  <p class="warning">⚠ 请使用开发/测试 Key（小额度），勿使用生产 Key</p>
  <p class="warning">⚠ 截图前请确认 DevTools 中 Authorization header 不在可视区域</p>

  <label>DeepSeek API Key（dev key）：</label>
  <input type="password" id="deepseek-key" placeholder="sk-..." />

  <label>aihubmix API Key（dev key）：</label>
  <input type="password" id="aihubmix-key" placeholder="..." />

  <br/>
  <button onclick="testDeepSeekCORS(document.getElementById('deepseek-key').value)">
    测试 DeepSeek CORS（流式）
  </button>
  <button onclick="testAihubmixCORS(document.getElementById('aihubmix-key').value)">
    测试 aihubmix CORS（生图）
  </button>
  <button onclick="document.getElementById('result').textContent=''">清空</button>

  <div id="result">结果将显示在此处…</div>

  <script>
    Office.onReady(function(info) {
      document.title = 'Aster CORS 验证 — 宿主: ' + (info.host || '未知');
    });

    // testDeepSeekCORS 与 testAihubmixCORS 函数在此粘贴
    // [函数体与上方代码相同，此处省略重复]
  </script>
</body>
</html>
```

**完整文件**：executor 需将上面所有函数和 HTML 合并成一个完整的 cors-test.html 文件。

安全规则：
- DeepSeek model 使用 `deepseek-v4-flash`（非 pro，省钱）
- max_tokens 限制为 20（最小验证）
- aihubmix size 使用 '256x256'（最小，省钱）
- 代码无任何 hardcoded key
  </action>
  <acceptance_criteria>
    - 文件存在：`ls spike/cors-test.html` 返回 0
    - 不含硬编码 Key 字样：`grep -c 'sk-' spike/cors-test.html` 返回 0
    - 含 DeepSeek endpoint：`grep -c 'api.deepseek.com/chat/completions' spike/cors-test.html` 返回 ≥ 1
    - 含 aihubmix endpoint：`grep -c 'api.aihubmix.com/v1/images' spike/cors-test.html` 返回 ≥ 1
    - 含 deepseek-v4-flash（非 deprecated 别名）：`grep -c 'deepseek-v4-flash' spike/cors-test.html` 返回 ≥ 1
    - 不含 deprecated 模型名：`grep -c 'deepseek-chat\|deepseek-reasoner' spike/cors-test.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com' spike/cors-test.html` 返回 ≥ 1
    - 含 Access-Control-Allow-Origin 显示逻辑：`grep -c 'Access-Control-Allow-Origin' spike/cors-test.html` 返回 ≥ 2
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'api.deepseek.com' spike/cors-test.html && grep -c 'api.aihubmix.com' spike/cors-test.html && grep -v '^//' spike/cors-test.html | grep -c 'sk-' | grep '^0$'</automated>
  </verify>
  <done>spike/cors-test.html 创建完成：含两个 Provider CORS 测试函数、UI 输入框、SSE 流式读取、响应头显示；无 hardcoded key；使用 flash model 省成本</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2：手动执行 CORS 验证并记录结果</name>
  <what-built>
    - spike/cors-test.html 已部署到 GitHub Pages（由 Plan 01 的 CI 自动发布）
    - 测试页可在生产 https URL 访问，已 sideload 到 PPT for Web
  </what-built>
  <how-to-verify>
执行以下步骤（需要开发/测试 API Key）：

**前置：**
1. 确认 GitHub Pages 已部署（访问 https://<username>.github.io/aster/cors-test.html，应显示测试页）
2. 准备 DeepSeek dev/test Key 和 aihubmix dev/test Key（小额度，非生产 Key）
3. 打开 PPT for Web，sideload spike/manifest.xml，通过 Ribbon 打开 Task Pane

**DeepSeek 测试：**
4. 在 Task Pane 中填入 DeepSeek dev Key
5. 点击"测试 DeepSeek CORS（流式）"
6. 打开 DevTools → Network → 找到 chat/completions 请求 → 点击 **Response Headers** 标签（不是 Request Headers，Response Headers 不含 Authorization）
7. **截图前确认当前展示的是 Response Headers 区域（含 Access-Control-Allow-Origin 行），不要展开 Request Headers（Authorization 在 Request Headers 中）**
8. 截图 Response Headers 区域（需含 Access-Control-Allow-Origin 行；若 Authorization 意外出现请用图片编辑工具 redact）
9. 保存截图为 `.planning/spikes/001-cors-verify/deepseek-response-headers.png`

**aihubmix 测试：**
10. 填入 aihubmix dev Key
11. 点击"测试 aihubmix CORS（生图）"
12. 同样切换 DevTools Network → 选 images/generations 请求 → **Response Headers** 标签 → 截图（Response Headers 不含 Authorization，无需 redact）
13. 保存截图为 `.planning/spikes/001-cors-verify/aihubmix-response-headers.png`

**录屏（必须）：**
14. 录制整个验证过程的视频（确保 Key 输入框内容在录屏中不可辨识）
15. 若视频 ≤ 100MB 保存到 `.planning/spikes/001-cors-verify/recording.mp4`（或 .gif / .webm）；>100MB 通过 GitHub Release attachments 发布并在 findings.md 中写入 `release-video: <URL>`

**更新 findings.md：**
16. 将 `.planning/spikes/001-cors-verify/findings.md` 第一行从 PENDING 改为 PASS 或 FAIL
17. 填入 Access-Control-Allow-Origin 的实测值
18. 更新 `.planning/spikes/MANIFEST.md` 第 1 行 spike 条目状态

**录屏验收（必须满足其一）：**
- `ls .planning/spikes/001-cors-verify/recording.{mp4,gif,webm} 2>/dev/null | wc -l` 返回 ≥ 1
- 或 findings.md 含 `release-video:` 字段（视频已上传 GitHub Release）
  </how-to-verify>
  <resume-signal>
验证完成后，根据结果输入：
- 如果两个 Provider 均 CORS 通过：输入 "PASS"
- 如果 DeepSeek 或 aihubmix 任一 CORS 失败：输入 "FAIL: [Provider名] — [具体错误]"

executor 将根据结果更新 findings.md 并通知 Wave 3 checkpoint。
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Task Pane (https://pages URL) → api.deepseek.com | 浏览器直连，受 CORS 策略控制 |
| Task Pane → api.aihubmix.com | 同上 |
| API Key → spike test page | Key 只在 UI 输入框，不离开浏览器 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-03-01 | Information Disclosure | cors-test.html Key input | mitigate | type=password 输入框；无 hardcode；截图规程 |
| T-00-03-02 | Information Disclosure | DevTools 截图 | mitigate | 截图前确认 Authorization header 不可见；findings.md 注明规程 |
| T-00-03-03 | Information Disclosure | 测试 Key 泄露 | mitigate | 使用 dev/test Key（小额度），即使泄露损失可控 |
| T-00-03-04 | Spoofing | aihubmix endpoint | accept | Phase 0 spike 不验证 TLS 证书链以外的身份；prod 时由 HTTPS 保证 |
</threat_model>

<verification>
整体验证（GATING #1 完成后）：
1. `head -1 .planning/spikes/001-cors-verify/findings.md` 含 PASS 或 FAIL（非 PENDING）
2. `ls .planning/spikes/001-cors-verify/` 含截图文件（deepseek-response-headers.png 等）
3. `grep -c 'PENDING' .planning/spikes/MANIFEST.md` 比初始少 1（第 1 行已更新）
</verification>

<success_criteria>
- spike/cors-test.html 部署到 GitHub Pages（https 访问 200）
- findings.md 更新为 PASS 或 FAIL（非 PENDING）
- 截图文件存在于 001-cors-verify/ 子目录
- MANIFEST.md Spike #1 条目状态已更新
- PASS 情形：DeepSeek + aihubmix 均含 Access-Control-Allow-Origin 响应头，流式 chat 跑通，生图成功
- FAIL 情形：GATING-FAILED-1.md 已写，D-06 Cloudflare Worker fallback 路径已记录
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-03-SUMMARY.md`，包含：
- GATING #1 最终结论（PASS / FAIL）
- DeepSeek Access-Control-Allow-Origin 实测值
- aihubmix Access-Control-Allow-Origin 实测值
- 证据文件路径列表
- 如 FAIL：D-06 fallback 路径说明
</output>
