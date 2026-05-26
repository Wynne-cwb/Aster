---
plan_number: "07"
title: "非 GATING #4 — DeepSeek-V4 多模态验证（D-11 三步法）"
phase: 0
wave: 4
depends_on: ["06"]
files_modified:
  - spike/multimodal-test.html
  - .planning/spikes/004-deepseek-multimodal/findings.md
autonomous: false
requirements: []
estimated_duration: "2 hours"
must_haves:
  goal: "确认 deepseek-v4-pro 是否支持 image_url content block，PRD Q6/R2 结论明确"
  truths:
    - ".planning/spikes/004-deepseek-multimodal/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "findings.md 包含 DeepSeek API 文档确认记录（D-11 Step 1）"
    - "findings.md 包含实际 API 请求的响应状态和内容摘要（D-11 Step 2）"
    - "findings.md 明确记录 PRD Q6/R2 的结论：支持则关闭；不支持则锁定 aihubmix"
    - ".planning/spikes/MANIFEST.md Spike #4 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-07-01
      description: "测试请求使用生产 Key 造成不必要费用"
      mitigation: "使用 dev/test Key；image_url 使用最小测试图（1x1 base64 PNG）；max_tokens: 50 限制输出长度"
    - id: T-00-07-02
      description: "截图含 API Key"
      mitigation: "截图 DevTools 时只展示 Response Body，不展示 Request Headers；findings.md 注明规程"
---

<objective>
非 GATING Spike #4：对 `deepseek-v4-pro` 实际发送含 `image_url` content block 的请求，
验证 DeepSeek-V4 是否原生支持多模态输入（PRD Q6/R2）。

Purpose: 若 DeepSeek 支持多模态，Phase 2-3 的 ProviderRegistry 可考虑将文本 LLM 与
视觉 LLM 统一到同一 Provider。若不支持，锁定 aihubmix 为 v1 唯一多模态路径（已有 fallback）。
FAIL 不止损——aihubmix 是已知可用的 fallback。

Output:
- `spike/multimodal-test.html`（DeepSeek multimodal test page）
- `.planning/spikes/004-deepseek-multimodal/findings.md`（更新为 PASS/FAIL）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/00-spike-gating/00-CONTEXT.md

决策出处：
- CONTEXT.md §D-11（验证三步法：读文档 15min → 发请求 30min → fail 锁 aihubmix）
- CONTEXT.md §D-12（默认 vision routing 决策推迟到 Phase 2）
- ROADMAP.md §Phase 0 Success Criteria #4（DeepSeek-V4 多模态结论）
- CLAUDE.md §DeepSeek — model IDs: deepseek-v4-pro（多模态验证用 pro，非 flash）
- CLAUDE.md §AiHubMix — fallback: aihubmix vision 模型（如 gpt-4o-via-aihubmix）

安全规则：
- 使用 dev/test Key
- 测试图使用最小 1x1 透明 PNG base64（节省 token）
- max_tokens: 50（最小验证）
- model 用 deepseek-v4-pro（官方多模态候选，非 flash）
</context>

<tasks>

<task type="auto">
  <name>Task 1：D-11 Step 1 — 查阅 DeepSeek 官方文档确认多模态支持状态</name>
  <files>.planning/spikes/004-deepseek-multimodal/findings.md</files>
  <read_first>
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-11 §D-12
    - CLAUDE.md §DeepSeek §LLM/Image Provider Specifics（DeepSeek V4 文档状态分析）
  </read_first>
  <action>
执行 D-11 Step 1（15 分钟）：查阅 DeepSeek 官方 API 文档 + change log。

查询目标：
1. 访问 https://api-docs.deepseek.com/ — 搜索 "vision" / "multimodal" / "image"
2. 访问 https://api-docs.deepseek.com/updates — 查看 V4 更新日志中是否有多模态 API 说明
3. 检查 CLAUDE.md §DeepSeek 中的原始研究笔记（LOW confidence on multimodal 的说明）

将文档调研结论写入 findings.md 的"API 文档确认"章节：
- 官方文档是否明确说明 deepseek-v4-pro 支持 image_url？
- 若支持：记录 endpoint、content 格式
- 若文档未提及（CLAUDE.md 已注明 LOW confidence）：标注"文档未明确，进行 Step 2 实测"

更新 findings.md 的"实测结果"章节为占位待填：
```
## API 文档确认（Step 1）
官方文档多模态说明：{填写调研结论}

## 实测结果（Step 2，待 Task 2 完成后填写）
请求状态：PENDING
```
  </action>
  <acceptance_criteria>
    - findings.md 存在且"API 文档确认"章节已填写：`grep -c 'API 文档确认' .planning/spikes/004-deepseek-multimodal/findings.md` 返回 ≥ 1
    - 不含 PENDING 在文档确认章节（该章节已完成）
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'API 文档确认' .planning/spikes/004-deepseek-multimodal/findings.md</automated>
  </verify>
  <done>findings.md API 文档确认章节已填写（DeepSeek 官方是否明确支持 image_url）</done>
</task>

<task type="auto">
  <name>Task 2：D-11 Step 2 — 创建多模态测试页并填写实测结果</name>
  <files>spike/multimodal-test.html, .planning/spikes/004-deepseek-multimodal/findings.md</files>
  <read_first>
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-11 Step 2（实际发一次请求）§D-12（routing 决策推迟）
    - CLAUDE.md §DeepSeek — endpoint POST /chat/completions，model deepseek-v4-pro，stream: false for this test
  </read_first>
  <action>
创建 `spike/multimodal-test.html`，实现以下功能（D-11 Step 2）：

**测试函数：发送 deepseek-v4-pro multimodal 请求**：
```javascript
async function testDeepSeekMultimodal(apiKey) {
  // 最小 1x1 透明 PNG base64（节省 token）
  const tinyImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const body = {
    model: 'deepseek-v4-pro',  // 必须用 pro，flash 可能不支持多模态
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: '这张图片是什么颜色？简单回答。' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + tinyImageBase64 } }
      ]
    }],
    stream: false,  // 不用流式，便于直接读响应
    max_tokens: 50, // 最小输出省钱
  };

  try {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (response.ok) {
      const content = data.choices?.[0]?.message?.content || '（无内容）';
      document.getElementById('result').textContent =
        '✅ deepseek-v4-pro 多模态 PASS！\n' +
        '响应状态: ' + response.status + '\n' +
        '模型回复: ' + content;
    } else {
      document.getElementById('result').textContent =
        '❌ deepseek-v4-pro 多模态 FAIL\n' +
        '状态: ' + response.status + '\n' +
        '错误: ' + JSON.stringify(data).slice(0, 300);
    }
  } catch (err) {
    document.getElementById('result').textContent = '❌ 请求失败: ' + err.message;
  }
}
```

**HTML 结构**：
- Office.js CDN
- DeepSeek Key 输入框（type=password）
- "测试 deepseek-v4-pro 多模态"按钮
- 结果区域

**测试完成后，更新 `.planning/spikes/004-deepseek-multimodal/findings.md`**：

在执行完上面的测试后（需要 executor 手动执行或通过 CI），
将实测结果填入 findings.md：

```markdown
## 实测结果（Step 2）

发送时间：{日期}
请求：POST https://api.deepseek.com/chat/completions，model: deepseek-v4-pro，content block type: image_url
响应状态：{200 / 4xx}
响应内容摘要：{模型描述或错误信息}

## 决策

**结果：** PASS / FAIL

**PASS：** PRD Q6/R2 关闭。deepseek-v4-pro 原生支持 image_url 输入。
Phase 2 ProviderRegistry 可考虑统一路由（但 D-12：默认 routing 决策推迟到 Phase 2）

**FAIL：** 锁定 aihubmix vision 为 v1 唯一多模态路径（fallback 已知，非 GATING，不止损）
Phase 3 文件上传图片 → aihubmix vision（而非 deepseek-v4-pro）
```

**重要**：executor 需实际运行 spike/multimodal-test.html（需要用户提供 dev Key 或通过 Task Pane 测试）。
若环境不允许 executor 自动运行（如需要真实 API Key），executor 应：
1. 创建好 spike/multimodal-test.html
2. 在 findings.md 中标注"待 executor 手动运行 multimodal-test.html 后填写实测结果"
3. 提供清晰的运行步骤说明

更新 MANIFEST.md Spike #4 状态（至少更新为 IN_PROGRESS，实测后改为 PASS/FAIL）。
  </action>
  <acceptance_criteria>
    - spike/multimodal-test.html 存在：`ls spike/multimodal-test.html` 返回 0
    - 含 deepseek-v4-pro model：`grep -c 'deepseek-v4-pro' spike/multimodal-test.html` 返回 ≥ 1
    - 含 image_url content type：`grep -c 'image_url' spike/multimodal-test.html` 返回 ≥ 1
    - 不含 hardcoded key：`grep -v 'sk-......' spike/multimodal-test.html | grep -c 'sk-' | grep '^0$'`
    - findings.md 不再全部是 PENDING：`grep -c 'API 文档确认\|实测结果' .planning/spikes/004-deepseek-multimodal/findings.md` 返回 ≥ 2
    - MANIFEST.md Spike #4 状态已更新：`grep -c '| 4 |.*PENDING' .planning/spikes/MANIFEST.md` 返回 0
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'deepseek-v4-pro' spike/multimodal-test.html && grep -c 'image_url' spike/multimodal-test.html</automated>
  </verify>
  <done>multimodal-test.html 创建完成；findings.md Step 1 文档调研 + Step 2 实测结果均已填写；PRD Q6/R2 结论明确；MANIFEST.md Spike #4 更新</done>
</task>


<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3：用户实际运行多模态测试并填写 findings.md 结论</name>
  <what-built>
    - spike/multimodal-test.html 已由 Task 2 创建并部署到 GitHub Pages
    - findings.md Step 1 文档调研章节已填写
  </what-built>
  <how-to-verify>
**准备：**
1. 准备 DeepSeek dev/test Key（小额度，非生产 Key）
2. 访问 GitHub Pages 上的 multimodal-test.html（或在 PPT for Web Task Pane 中打开）

**执行测试：**
3. 在 DeepSeek Key 输入框填入 dev Key
4. 点击"测试 deepseek-v4-pro 多模态"按钮
5. 等待响应（约 3-10 秒）

**记录结果（在 findings.md Step 2 章节填写）：**
6. 若响应状态 200 且模型返回描述文字 → 填写 PASS + 响应内容摘要
7. 若响应状态 4xx/5xx 或报错"image_url not supported"类错误 → 填写 FAIL + 具体错误信息
8. 在 findings.md 首行填写最终结论（PASS 或 FAIL）
9. 更新 MANIFEST.md Spike #4 状态
  </how-to-verify>
  <resume-signal>
测试完成后输入：
- "PASS: [模型回复内容摘要]" — deepseek-v4-pro 原生支持多模态
- "FAIL: [错误信息]" — 不支持，锁定 aihubmix 为 v1 唯一多模态路径（D-12）
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| spike HTML → api.deepseek.com | 浏览器直连，需要 GATING #1 CORS 已 PASS |
| dev Key → test request | 最小 token 消耗（max_tokens: 50，1x1 图片） |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-07-01 | Information Disclosure | API Key 输入 | mitigate | type=password 输入框；无 hardcode |
| T-00-07-02 | Information Disclosure | 截图含 Key | mitigate | 只截 Response Body，不截 Request Headers |
| T-00-07-03 | Denial of Service | 过多 token 消耗 | mitigate | max_tokens: 50；1x1 测试图；不循环请求 |
</threat_model>

<verification>
整体验证（Spike #4 完成后）：
1. `head -1 .planning/spikes/004-deepseek-multimodal/findings.md` 含 PASS 或 FAIL
2. `grep -c 'deepseek-v4-pro' spike/multimodal-test.html` 返回 ≥ 1
3. MANIFEST.md Spike #4 状态非 PENDING
</verification>

<success_criteria>
- findings.md 首行为 PASS 或 FAIL（非 PENDING）
- PASS：PRD Q6/R2 在 findings.md 中明确标注为 "关闭"
- FAIL：Phase 3/4 使用 aihubmix vision 的路径已确认（D-12 routing 决策推迟到 Phase 2）
- MANIFEST.md Spike #4 状态已更新
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-07-SUMMARY.md`，包含：
- Spike #4 结论（PASS / FAIL）
- DeepSeek-V4 多模态支持状态
- PRD Q6/R2 关闭情况
- Phase 2-3 视觉路由影响
</output>
