---
plan_number: "08"
title: "非 GATING #5+#6 — Office.js API 混用挂死 + getSelectedSlides 反序 workaround"
phase: 0
wave: 4
depends_on: ["06"]
files_modified:
  - spike/api-bugs-test.html
  - .planning/spikes/005-api-mixing/findings.md
  - .planning/spikes/006-getselectedslides-order/findings.md
autonomous: false
requirements: []
estimated_duration: "3 hours"
must_haves:
  goal: "两个 Office.js 已知 bug 的 workaround 均已验证，Phase 4 PPT adapter 设计有据可依"
  truths:
    - ".planning/spikes/005-api-mixing/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - ".planning/spikes/006-getselectedslides-order/findings.md 第一行含 PASS 或 FAIL（非 PENDING）"
    - "005 findings.md 包含 API 混用挂死能否复现、workaround 是否有效的实测结论"
    - "006 findings.md 包含 getSelectedSlides 返回顺序 vs 预期顺序的对比，sort-by-index workaround 结论"
    - ".planning/spikes/MANIFEST.md Spike #5 和 #6 条目状态已更新（非 PENDING）"
threat_model:
  threats:
    - id: T-00-08-01
      description: "spike 测试代码搭建 DocumentAdapter 抽象（D-08 违规）"
      mitigation: "api-bugs-test.html 直接调用 Office.js API，不创建 adapter 文件；代码只在 spike/ 目录"
---

<objective>
非 GATING Spike #5 + #6（合并 plan）：验证两个已知 Office.js bug 的 workaround。

Spike #5（bug #5022）：`setSelectedDataAsync` × `PowerPoint.run` 混用后，第二次 context.sync() 挂死——
验证是否可稳定重现，找到可靠 workaround（Pitfall 2 建议：pick one API surface per adapter）。

Spike #6（bug #3618）：`getSelectedSlides()` 在 PPT for Web 返回反序——
验证 sort-by-index workaround 是否有效（Phase 4 "选中 slide 配图"场景的关键依赖）。

Purpose: 两个 bug 都直接影响 Phase 4 PPT adapter 设计。Phase 0 确认 workaround，
Phase 4 可直接采用经过验证的安全模式，不在 Phase 4 重新踩坑。

Output:
- `spike/api-bugs-test.html`（两个 bug 测试函数合一页）
- `005-api-mixing/findings.md`、`006-getselectedslides-order/findings.md`（更新）
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/00-spike-gating/00-CONTEXT.md
@.planning/research/PITFALLS.md

决策出处：
- PITFALLS.md Pitfall 2（#5022 挂死：两个 API 混用，pipe-ordering race condition）
- PITFALLS.md Pitfall 5（#3618 反序：sort by slide.index workaround）
- CONTEXT.md §D-08（代码丢弃式，不搭 DocumentAdapter）
- ROADMAP.md §Phase 0 Success Criteria #5（API mixing 测试）

技术要点（Pitfall 2）：
- bug 触发序列：PowerPoint.run(...context.sync()) → setSelectedDataAsync → PowerPoint.run(...context.sync())
- 第二次 context.sync() 可能永远不 resolve
- 建议 workaround：在 setSelectedDataAsync 后插入 `await new Promise(r => setTimeout(r, 0))`
- 更可靠 workaround：单 adapter 只用一种 API surface（PowerPoint.run 或 setSelectedDataAsync，不混）

技术要点（Pitfall 5）：
- bug：getSelectedSlides() 在 PPT for Web 返回反序
- workaround：对结果 load("index")，sync，再按 slide.index 数字排序
- getActiveSlideOrNullObject() 是获取单张当前活跃 slide 的替代方式（不受此 bug 影响）
</context>

<tasks>

<task type="auto">
  <name>Task 1：创建 Office.js API bugs 测试页</name>
  <files>spike/api-bugs-test.html</files>
  <read_first>
    - .planning/research/PITFALLS.md Pitfall 2（完整的 #5022 描述和 workaround 建议）
    - .planning/research/PITFALLS.md Pitfall 5（完整的 #3618 描述和 workaround）
    - .planning/phases/00-spike-gating/00-CONTEXT.md §D-08（不搭 DocumentAdapter 抽象层）
  </read_first>
  <action>
创建 `spike/api-bugs-test.html`，包含两组测试函数：

**Bug #5022 测试（三个函数）：**

```javascript
// 测试 A：重现 bug（PowerPoint.run → setSelectedDataAsync → PowerPoint.run）
async function reproduceMixingBug() {
  const log = document.getElementById('bug5022-result');
  log.textContent = '开始 Bug #5022 重现测试...\n';

  try {
    // Step 1: PowerPoint.run
    await PowerPoint.run(async ctx => {
      ctx.presentation.load('title');
      await ctx.sync();
      log.textContent += 'Step 1 PowerPoint.run sync: ✅ 成功\n';
    });

    // Step 2: setSelectedDataAsync（混入 legacy API）
    await new Promise((resolve, reject) => {
      Office.context.document.setSelectedDataAsync(
        '<p>混用测试</p>',
        { coercionType: Office.CoercionType.Html },
        result => {
          if (result.status === Office.AsyncResultStatus.Succeeded) {
            log.textContent += 'Step 2 setSelectedDataAsync: ✅ 成功\n';
            resolve();
          } else {
            reject(new Error(result.error.message));
          }
        }
      );
    });

    // Step 3: 再次 PowerPoint.run（Bug 触发点）
    const timeoutMs = 5000;
    const syncResult = await Promise.race([
      PowerPoint.run(async ctx => {
        ctx.presentation.load('title');
        await ctx.sync();
        return 'sync completed';
      }),
      new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs))
    ]);

    if (syncResult === 'timeout') {
      log.textContent += `Step 3 PowerPoint.run context.sync: ❌ 超时 ${timeoutMs}ms（Bug #5022 已触发）\n`;
    } else {
      log.textContent += 'Step 3 PowerPoint.run context.sync: ✅ 成功（Bug 未触发，或已修复）\n';
    }

  } catch (err) {
    log.textContent += '错误: ' + err.message + '\n';
  }
}

// 测试 B：workaround（setSelectedDataAsync 后加 setTimeout 微任务间隔）
async function testMicrotaskWorkaround() {
  const log = document.getElementById('bug5022-result');
  log.textContent = '开始 Workaround 测试（microtask 间隔）...\n';

  try {
    await PowerPoint.run(async ctx => {
      ctx.presentation.load('title');
      await ctx.sync();
      log.textContent += 'Step 1: ✅\n';
    });

    await new Promise((resolve, reject) => {
      Office.context.document.setSelectedDataAsync(
        '<p>Workaround 测试</p>',
        { coercionType: Office.CoercionType.Html },
        result => result.status === Office.AsyncResultStatus.Succeeded ? resolve() : reject(new Error(result.error.message))
      );
    });

    // Workaround：drain microtask queue
    await new Promise(r => setTimeout(r, 0));
    log.textContent += 'Step 2 (workaround setTimeout): ✅\n';

    const timeoutMs = 5000;
    const syncResult = await Promise.race([
      PowerPoint.run(async ctx => {
        ctx.presentation.load('title');
        await ctx.sync();
        return 'sync completed';
      }),
      new Promise(resolve => setTimeout(() => resolve('timeout'), timeoutMs))
    ]);

    log.textContent += 'Step 3 sync: ' + (syncResult === 'timeout' ? `❌ 超时（Workaround 无效）` : '✅ 成功（Workaround 有效）') + '\n';
  } catch (err) {
    log.textContent += '错误: ' + err.message + '\n';
  }
}
```

**Bug #3618 测试（getSelectedSlides 顺序验证）：**

```javascript
// 在 PPT 中选中多张 slide 后调用此函数
async function testSelectedSlidesOrder() {
  const log = document.getElementById('bug3618-result');
  log.textContent = '测试 getSelectedSlides() 返回顺序...\n请先在 PPT 中选中多张 slide（如 3, 5, 7）\n';

  try {
    await PowerPoint.run(async ctx => {
      const selectedSlides = ctx.presentation.getSelectedSlides();
      selectedSlides.load('items/id,items/index');
      await ctx.sync();

      const items = selectedSlides.items;
      log.textContent += '原始返回顺序（API 返回）：\n';
      items.forEach((slide, i) => {
        log.textContent += `  [${i}] id: ${slide.id}, index: ${slide.index}\n`;
      });

      // Workaround：按 index 排序
      const sorted = [...items].sort((a, b) => a.index - b.index);
      log.textContent += '\n排序后（按 index 升序）：\n';
      sorted.forEach((slide, i) => {
        log.textContent += `  [${i}] id: ${slide.id}, index: ${slide.index}\n`;
      });

      // 比较
      const isOriginalSorted = items.every((s, i) => i === 0 || items[i-1].index < s.index);
      log.textContent += '\n原始顺序是否正确（升序）: ' + (isOriginalSorted ? '✅ 是（Bug 未触发或已修复）' : '❌ 否（Bug #3618 已触发，需要 sort workaround）') + '\n';
    });

    // 额外验证：getActiveSlideOrNullObject（不受 #3618 影响）
    await PowerPoint.run(async ctx => {
      const activeSlide = ctx.presentation.getActiveSlideOrNullObject();
      activeSlide.load('id,index');
      await ctx.sync();
      if (!activeSlide.isNullObject) {
        log.textContent += '\ngetActiveSlideOrNullObject(): id=' + activeSlide.id + ', index=' + activeSlide.index + '（不受 #3618 影响，可作为单 slide 获取方式）\n';
      }
    });

  } catch (err) {
    log.textContent += '错误: ' + err.message + '\n';
    if (err.message.includes('getSelectedSlides')) {
      log.textContent += '注意: getSelectedSlides() 需要 PowerPointApi 1.5+\n';
    }
  }
}
```

**HTML 结构**：
- Office.js CDN
- Bug #5022 区域：两个按钮（重现 Bug / 测试 Workaround）+ 结果区
- Bug #3618 区域：一个按钮（需先选中多 slide）+ 结果区
- 顶部警告：Bug #5022 测试可能导致 PPT Task Pane 部分功能临时挂死，建议测试后刷新

**安全规则**：
- 无 API Key
- 不创建 DocumentAdapter
  </action>
  <acceptance_criteria>
    - 文件存在：`ls spike/api-bugs-test.html` 返回 0
    - 含 bug #5022 测试逻辑：`grep -c 'setSelectedDataAsync\|reproduceMixing\|Workaround' spike/api-bugs-test.html` 返回 ≥ 2
    - 含 bug #3618 测试逻辑：`grep -c 'getSelectedSlides\|slide.index\|sort' spike/api-bugs-test.html` 返回 ≥ 3
    - 含 Promise.race + timeout（防止 sync 永远挂死）：`grep -c 'Promise.race\|timeout' spike/api-bugs-test.html` 返回 ≥ 1
    - 不含 DocumentAdapter：`grep -c 'DocumentAdapter\|class.*Adapter' spike/api-bugs-test.html` 返回 0
    - 含 Office.js CDN：`grep -c 'appsforoffice.microsoft.com' spike/api-bugs-test.html` 返回 ≥ 1
  </acceptance_criteria>
  <verify>
    <automated>grep -c 'getSelectedSlides' spike/api-bugs-test.html && grep -c 'Promise.race' spike/api-bugs-test.html</automated>
  </verify>
  <done>spike/api-bugs-test.html 创建：Bug #5022 重现 + workaround 测试（含 Promise.race 超时保护）+ Bug #3618 getSelectedSlides 顺序验证 + sort-by-index workaround</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2：手动执行两个 Bug 验证并记录结论</name>
  <what-built>
    spike/api-bugs-test.html 已部署到 GitHub Pages，可在 PPT for Web Task Pane 中访问
  </what-built>
  <how-to-verify>
**Bug #5022 验证：**
1. 打开 PPT for Web，sideload manifest，Task Pane → api-bugs-test.html
2. 点击"重现 Bug"按钮，等待 5 秒超时或完成
3. 记录 Step 3 是否超时（Bug 触发）
4. 若 Bug 触发：点击"测试 Workaround"按钮，验证 setTimeout 是否解决问题
5. 截图记录结果（DevTools → Console 或页面输出区域）
6. 保存截图至 `.planning/spikes/005-api-mixing/`

**Bug #3618 验证：**
7. 在 PPT 中选中多张非连续 slide（如 slide 1, 3, 5）
8. 点击"测试 getSelectedSlides 顺序"按钮
9. 观察原始返回顺序 vs 预期顺序
10. 若顺序错误，验证 sort-by-index 后顺序是否正确
11. 截图保存至 `.planning/spikes/006-getselectedslides-order/`

**更新 findings.md：**
12. 更新 `005-api-mixing/findings.md` 首行为 PASS 或 FAIL，填入实测结果
13. 更新 `006-getselectedslides-order/findings.md` 首行为 PASS 或 FAIL
14. 更新 MANIFEST.md Spike #5 和 #6 状态
  </how-to-verify>
  <resume-signal>
验证完成后输入：
- "DONE: #5022 [Bug触发/未触发], workaround [有效/无效]; #3618 [反序/正序], sort workaround [有效/无效]"
例：DONE: #5022 Bug触发, workaround 有效; #3618 反序, sort workaround 有效
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| spike HTML → Office.js PPT APIs | 只调用本地 Office.js，无网络请求 |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-00-08-01 | Denial of Service | context.sync() hang | mitigate | 使用 Promise.race + 5s timeout 防止永久挂死；测试后建议刷新 Task Pane |
| T-00-08-02 | Tampering | spike 代码进 v1 | mitigate | D-08：spike/ 目录，丢弃式；不创建 adapter 文件 |
</threat_model>

<verification>
整体验证（Spike #5 + #6 完成后）：
1. `head -1 .planning/spikes/005-api-mixing/findings.md` 含 PASS 或 FAIL
2. `head -1 .planning/spikes/006-getselectedslides-order/findings.md` 含 PASS 或 FAIL
3. MANIFEST.md Spike #5 和 #6 状态非 PENDING
</verification>

<success_criteria>
- findings.md 005 和 006 首行均为 PASS 或 FAIL
- Bug #5022 workaround 结论已记录（Phase 4 PPT adapter 设计依据）
- Bug #3618 sort-by-index workaround 结论已记录
- MANIFEST.md Spike #5 和 #6 状态已更新
</success_criteria>

<output>
完成后创建 `.planning/phases/00-spike-gating/00-08-SUMMARY.md`，包含：
- Bug #5022 结论：是否可复现 + workaround 有效性
- Bug #3618 结论：返回顺序是否有问题 + sort workaround 是否有效
- Phase 4 PPT adapter 设计建议（基于两个 bug 的实测结果）
</output>
