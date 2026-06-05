---
phase: 26
slug: config-import-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `26-RESEARCH.md` §Validation Architecture. 配置导入导出的纯逻辑（schema 校验 / 合并策略 / 字段往返 / key 遍历）全部自动化单测守门；UI 文案类（CFG-03 常驻警告）留真机 UAT。

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest（`vitest@^2.x`，vite.config.ts test 块已配置） |
| **Config file** | vite.config.ts（test 块） |
| **Quick run command** | `npx vitest run src/lib/configBackup.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 秒（单文件）；全套见现有基线 |

> Node 22 路径：执行测试/构建前 `export PATH="$HOME/.nvm/versions/node/v22.22.1/bin:$PATH"`。

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run src/lib/configBackup.test.ts`
- **After every plan wave:** Run `npx vitest run`（全套）
- **Before `/gsd-verify-work`:** 全套必须绿 + `npm run extract`（Lingui 宏）+ `npm run build && npm run size`（≤82KB gzip，必须先 build 再 size）
- **Max feedback latency:** ~5 秒

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 26-W0 | configBackup core | 0 | CFG-01/02 | T-26-01 | 纯函数 + 类型骨架，无副作用泄露 | unit (stub) | `npx vitest run src/lib/configBackup.test.ts` | ❌ W0 | ⬜ pending |
| buildExportData 字段集 | configBackup | 1 | CFG-01 | — | 返回含全部 D-02 字段，不含 ONBOARDING_SEEN/PEXELS_BASE_URL/聊天历史 | unit | `npx vitest run src/lib/configBackup.test.ts -t "buildExportData"` | ❌ W0 | ⬜ pending |
| key 遍历完整性 | configBackup | 1 | CFG-01 | T-26-02 | 含内置 deepseek/aihubmix key + 自定义 provider key，不多不少 | unit | `npx vitest run src/lib/configBackup.test.ts -t "key 遍历"` | ❌ W0 | ⬜ pending |
| parseImportFile INVALID_JSON | configBackup | 1 | CFG-02 | T-26-03 | JSON 格式错误 → `{code:'INVALID_JSON'}`，不崩溃 | unit | `npx vitest run src/lib/configBackup.test.ts -t "INVALID_JSON"` | ❌ W0 | ⬜ pending |
| parseImportFile NOT_ASTER_CONFIG | configBackup | 1 | CFG-02 | T-26-03 | 缺 app/version/data → `{code:'NOT_ASTER_CONFIG'}` | unit | `npx vitest run src/lib/configBackup.test.ts -t "NOT_ASTER_CONFIG"` | ❌ W0 | ⬜ pending |
| parseImportFile UNSUPPORTED_VERSION | configBackup | 1 | CFG-02 | — | version > 1 → `{code:'UNSUPPORTED_VERSION'}` | unit | `npx vitest run src/lib/configBackup.test.ts -t "UNSUPPORTED_VERSION"` | ❌ W0 | ⬜ pending |
| parseImportFile EMPTY_CONFIG | configBackup | 1 | CFG-02 | — | data 无可导入项 → `{code:'EMPTY_CONFIG'}` | unit | `npx vitest run src/lib/configBackup.test.ts -t "EMPTY_CONFIG"` | ❌ W0 | ⬜ pending |
| detectConflicts | configBackup | 1 | CFG-02 | — | 正确识别同 id（内置+自定义）与新 id，无漏报/误报 | unit | `npx vitest run src/lib/configBackup.test.ts -t "detectConflicts"` | ❌ W0 | ⬜ pending |
| 往返幂等 | configBackup | 1 | CFG-01/02 | — | buildExportData 输出可被 parseImportFile 通过且字段完整 | unit | `npx vitest run src/lib/configBackup.test.ts -t "往返幂等"` | ❌ W0 | ⬜ pending |
| applyImport configuredKeyIds | configBackup | 1 | CFG-02 | T-26-04 | 写入后 configuredKeyIds 含导入 provider id（红条消失路径） | unit (mock store) | `npx vitest run src/lib/configBackup.test.ts -t "applyImport"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/configBackup.ts` — 实现文件（Wave 0 先写类型定义 `AsterConfigExport` + `EXPORT_VERSION` 常量 + 函数空壳：`buildExportData` / `parseImportFile` / `detectConflicts` / `applyImport`）
- [ ] `src/lib/configBackup.test.ts` — 覆盖 Per-Task Verification Map 全部 CFG-01/CFG-02 自动化用例（mock `./storage` + `../store/providers`，参考 `registry.test.ts` 的 `vi.mock` 范式）
- [ ] `DownloadIcon` — 新增到 `src/components/icons.tsx`（Wave 0，阻塞 UI 任务）

*现有 Vitest 基础设施已覆盖运行环境，无需额外安装。*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 常驻警告文案含「明文 API 密钥/妥善保管/用完即删/不安全渠道」且永久可见 | CFG-03 | UI 文案 + 视觉常驻，非纯逻辑 | 打开 Settings →「配置备份与迁移」分区 → 确认警告条常驻可见、措辞完整（UAT 种子 #2） |
| 导入确认对话框含明文风险重申 | CFG-03 | UI 交互文案 | 点「导入配置」→ 选合法 JSON → 确认对话框出现明文警告重申（UAT 种子 #3） |
| 北极星跨 partition 还原（PPT 导出 → Word/Excel 导入，无需重输 key） | CFG-01/02 | 需真实多宿主/多 origin 环境 | UAT 种子 #3 + #7（office-addin-browser-uat skill） |
| 浏览器实际下载文件 + 文件名 `aster-config-YYYYMMDD.json` | CFG-01 | 浏览器下载行为 | UAT 种子 #1：点导出 → 确认下载文件名与内容 |
| 同 id 覆盖确认弹窗真机交互 | CFG-02 | UI 交互 | UAT 种子 #4：本地已有同 id → 导入 → 覆盖确认弹出 |
| bundle 门 ≤82KB gzip | NFR-12 | 构建产物度量（先 build 再 size） | `npm run build && npm run size` → main-*.js ≤82KB gzip（UAT 种子 #6） |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references（configBackup.ts + configBackup.test.ts + DownloadIcon）
- [ ] No watch-mode flags（用 `vitest run`，非 `vitest` watch）
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
