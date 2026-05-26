---
plan_number: "05"
title: "GATING #3 — 存储 scope 验证：三宿主 partitioned localStorage"
phase: 0
wave: 2
depends_on: ["01"]
files_modified:
  - spike/storage-test.html
  - .planning/spikes/003-storage-scope/findings.md
autonomous: false
requirements: []
estimated_duration: "2 hours"
must_haves:
  goal: "确认三宿主 partitioned localStorage 行为：文档间共享、跨浏览器隔离"
  truths:
    - ".planning/spikes/003-storage-scope/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "findings.md 包含三宿主（PPT / Excel / Word）的 localStorage 行为实测结论"
    - "findings.md 记录了 Office.context.partitionKey 的实测值（若 API 存在）"
    - "findings.md 包含跨浏览器隔离（Edge → Chrome）的验证结论"
    - "截图文件存在于 .planning/spikes/003-storage-scope/ 目录"
    - ".planning/spikes/MANIFEST.md Spike #3 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-05-01
      description: "localStorage 存储真实 API Key 进入截图"
      mitigation: "storage-test.html 使用假 test-value 字符串（非真实 Key）做 scope 验证；截图不含真实 Key"
    - id: T-00-05-02
      description: "混淆 Office.context.roamingSettings（Outlook-only）与 localStorage"
      mitigation: "spike 代码明确注释：只测 localStorage；不使用 roamingSettings（Pitfall 4）"
---

<objective>
GATING #3：在三宿主分别验证 partitioned localStorage 行为——文档 A 写入的 Key，
在同账号同浏览器的文档 B 中是否仍可读取；同时验证跨浏览器隔离是否符合预期。

Purpose: PRD 原来假设用 RoamingSettings（Outlook-only API，已确认错误）。
研究已纠正为 partitioned localStorage，但"partitionKey 范围"的实际行为
需要在真实 Office for Web 中实测确认，才能信任 Phase 2 的 Settings Store 设计。

Output:
- `spike/storage-test.html`（跨文档 localStorage 读写测试页）
- `.planning/spikes/003-storage-scope/findings.md`（更新为 PASS/FAIL）
- 截图：DevTools Console 显示 localStorage 读取结果
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
- ROADMAP.md §Phase 0 Success Criteria #3（存储 scope 验证详情）
- CONTEXT.md §D-04（gate-first）§D-05（GATING 止损规则）
- PITFALLS.md Pitfall 4（PRD F5 storage API 错误：roamingSettings 是 Outlook-only，应用 partitioned localStorage）
- RESEARCH SUMMARY §PRD corrections — AC6 重写为"换浏览器或清缓存则丢失"

技术要点：
- 正确 API：`localStorage.setItem / getItem`（Task Pane 运行在开发者域名的 origin 下）
- `Office.context.partitionKey` — 若存在，可用于 namespace key（隔离不同文档）
- localStorage 是 origin-scoped（`https://<username>.github.io/aster`），不是 document-scoped
- 预期行为：同 origin + 同 browser → 跨文档共享；换 browser → 不共享（不同 browser storage 隔离）
- 测试值使用非真实 Key 字符串（如 `test-value-${Date.now()}`）
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建存储 scope 测试页 spike/storage-test.html</name>
  <files>spike/storage-test.html</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 4（partitioned localStorage vs roamingSettings 详细对比）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（丢弃式代码）
    - CLAUDE.md §Storage — 存储 scope 对比表（partitioned localStorage 说明）
  </read_first>
  <action>
创建 `spike/storage-test.html`，包含以下功能：

**页面功能：**

1. **显示当前环境信息**：
```javascript
// 在 Office.onReady 中显示
const partitionKey = Office.context.partitionKey || '(API 不存在)';
document.getElementById('env-info').textContent =
  'partitionKey: ' + partitionKey + ' | 宿主: ' + info.host;
```

2. **写入测试值**（用于跨文档验证）：
```javascript
function writeTestValue() {
  const testKey = 'aster-scope-test';
  const testValue = 'test-value-' + Date.now();
  localStorage.setItem(testKey, testValue);

  // 若有 partitionKey，同时写一个带 namespace 的版本
  const pk = Office.context.partitionKey;
  if (pk) {
    localStorage.setItem(pk + ':' + testKey, testValue);
  }

  document.getElementById('write-result').textContent =
    '已写入: ' + testKey + ' = ' + testValue;
}
```

3. **读取测试值**（在文档 B 中验证文档 A 写入的值）：
```javascript
function readTestValue() {
  const testKey = 'aster-scope-test';
  const value = localStorage.getItem(testKey);
  const pk = Office.context.partitionKey;
  const pkValue = pk ? localStorage.getItem(pk + ':' + testKey) : '(无 partitionKey)';

  document.getElementById('read-result').textContent =
    '读取 ' + testKey + ': ' + (value || '(不存在 — 文档/浏览器隔离)') + '\n' +
    '读取 pk+key: ' + pkValue;
}
```

4. **列出所有 localStorage 条目**（调试用）：
```javascript
function listAllKeys() {
  const items = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    items.push(key + ' = ' + localStorage.getItem(key).slice(0, 50));
  }
  document.getElementById('all-keys').textContent = items.join('\n') || '(localStorage 为空)';
}
```

5. **清除测试数据**：
```javascript
function clearTestData() {
  localStorage.removeItem('aster-scope-test');
  document.getElementById('write-result').textContent = '测试数据已清除';
}
```

**HTML 结构**：
- Office.js CDN script tag
- 宿主/partitionKey 信息显示区
- "写入测试值"按钮（在文档 A 使用）
- "读取测试值"按钮（在文档 B 使用）
- "列出所有 key"按钮（调试）
- "清除测试数据"按钮
- 三个结果显示区

**安全规则**：
- 测试值使用 `test-value-${Date.now()}`（非真实 API Key）
- 明确注释：`// 注意：实际 v1 不使用 roamingSettings（Outlook-only），使用 partitioned localStorage`
- 不存储任何真实 Key
  </action>
  <acceptance_criteria>
    - 文件存在：`ls spike/storage-test.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com/lib/1/hosted/office.js' spike/storage-test.html` 返回 ≥ 1
    - 含 partitionKey API 检测：`grep -c 'partitionKey' spike/storage-test.html` 返回 ≥ 2
    - 含 localStorage.setItem：`grep -c 'localStorage.setItem' spike/storage-test.html` 返回 ≥ 1
    - 含 localStorage.getItem：`grep -c 'localStorage.getItem' spike/storage-test.html` 返回 ≥ 1
    - 不含 roamingSettings：`grep -c 'roamingSettings' spike/storage-test.html` 返回 0
    - 不含真实 Key 字符串（sk-）：`grep -c 'sk-' spike/storage-test.html` 返回 0
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'partitionKey' spike/storage-test.html && grep -c 'roamingSettings' spike/storage-test.html | grep '^0$'</automated>
  </verify>
  <done>spike/storage-test.html 创建：写入/读取/列出 localStorage 测试函数；partitionKey 检测；不使用 roamingSettings；测试值为假字符串</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2：手动执行三宿主存储 scope 验证</name>
  <what-built>
    spike/storage-test.html 已部署到 GitHub Pages（由 Plan 01 CI 自动发布）
  </what-built>
  <how-to-verify>
**PPT 宿主验证（文档间共享）：**
1. 打开 PPT for Web 文档 A（Edge），sideload manifest，Task Pane → storage-test.html
2. 查看并截图"宿主/partitionKey"信息区（记录 partitionKey 值）
3. 点击"写入测试值"，截图写入结果
4. 不关闭浏览器，打开 PPT for Web 文档 B（同账号同 Edge）
5. Task Pane → storage-test.html → 点击"读取测试值"
6. 截图：是否读到文档 A 写入的 value？

**Excel 宿主验证：**
7. 打开 Excel for Web 文档（同账号同 Edge）
8. Task Pane → storage-test.html → 点击"读取测试值"
9. 截图：是否读到 PPT 宿主写入的 value？（同 origin 应共享）

**Word 宿主验证：**
10. 打开 Word for Web 文档，同上步骤

**跨浏览器隔离验证：**
11. 打开 Chrome（同账号），PPT for Web
12. Task Pane → storage-test.html → 点击"读取测试值"
13. 截图：应显示"(不存在)"（Edge 的 localStorage 不共享到 Chrome）

**记录结果：**
14. 截图保存至 `.planning/spikes/003-storage-scope/`
    - 建议：`ppt-docA-write.png`、`ppt-docB-read.png`、`excel-read.png`、`word-read.png`、`chrome-read.png`
15. 更新 `.planning/spikes/003-storage-scope/findings.md` 实测结论
16. 将首行从 PENDING 改为 PASS 或 FAIL
17. 更新 MANIFEST.md Spike #3 状态
18. **重要**：若 partitionKey 实测值与预期不同，在 findings.md 备注（影响 Phase 2 Settings Store 设计）
  </how-to-verify>
  <resume-signal>
验证完成后，根据结果输入：
- 三宿主均确认文档间共享、跨浏览器隔离：输入 "PASS"
- 行为与预期不符（如文档间不共享，或跨浏览器反而共享）：输入 "FAIL: [具体异常行为]"
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Task Pane localStorage → Office for Web 沙箱 | Origin-scoped，Task Pane 宿主 URL 的 localStorage |
| Edge browser storage ↔ Chrome browser storage | 不同浏览器隔离，符合预期 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-05-01 | Information Disclosure | localStorage test value | mitigate | 测试值用假字符串，非真实 API Key；截图规程说明 |
| T-00-05-02 | Tampering | storage-test.html API call | accept | 只调用 localStorage（浏览器内置），无网络请求；风险极低 |
</threat_model>

<verification>
整体验证（GATING #3 完成后）：
1. `head -1 .planning/spikes/003-storage-scope/findings.md` 含 PASS 或 FAIL（非 PENDING）
2. `ls .planning/spikes/003-storage-scope/` 含截图文件
3. `grep -c 'PENDING' .planning/spikes/MANIFEST.md` 比初始少 1（第 3 行已更新）
</verification>

<success_criteria>
- spike/storage-test.html 部署到 GitHub Pages 可访问
- findings.md 包含三宿主 + 跨浏览器实测结论，首行非 PENDING
- 截图证据存在
- MANIFEST.md Spike #3 状态已更新
- PASS 情形：三宿主均文档间共享（同 origin）、跨浏览器隔离；PRD AC6 描述已对齐实测行为
- FAIL 情形：findings.md 记录具体异常，GATING-FAILED-3.md 已写，替代方案评估已启动
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-05-SUMMARY.md`，包含：
- GATING #3 最终结论（PASS / FAIL）
- 三宿主 localStorage scope 行为实测值
- Office.context.partitionKey 实测值（若 API 可用）
- PRD AC6 是否需要更新（"切 MS 账号"行为描述）
- 证据文件路径列表
</output>
