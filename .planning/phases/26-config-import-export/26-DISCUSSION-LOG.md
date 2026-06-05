# Phase 26: 配置导入导出 - Discussion Log（审计轨迹）

**Session:** 2026-06-05
**Mode:** user-led `gsd-discuss-phase`（TeamMate，团队 `aster-v2.4`）
**Phase:** 26（配置导入导出）of milestone v2.4「扩疆域」
**Requirements:** CFG-01 / CFG-02 / CFG-03

---

## 1. 上下文输入（已读 + scout 实证）

读取：
- `.planning/REQUIREMENTS.md`（CFG-01/02/03 全文 + Out of Scope + Deferred CFG-D1/D2/D3）
- `.planning/ROADMAP.md`（§Phase 26 Goal / 5 Success Criteria / UI hint: yes）
- `.planning/STATE.md`（v2.4 scope + 工程约束 + decisions）
- `.planning/phases/17-file/17-CONTEXT.md`（v2.2 FILE 上传基建范式）
- `.planning/phases/18-lib/18-CONTEXT.md`（BYO key Settings 范式）

scout 实证（file:line）：
- `src/lib/storage.ts` L19-57 —— `STORAGE_KEYS` 全清单（导出字段集事实来源）
- `src/store/providers.ts` L40-250 —— Provider store / key 读写 / `hydrateFromStorage` / `addProvider` randomUUID
- `src/providers/types.ts` L129-138 —— `ProviderConfig` 形态
- `src/components/Settings/SettingsPanel.tsx` L57-281/L319-355 —— Settings section 范式 + 内联确认范式

---

## 2. 灰区二分（人类拍板 vs 可研究事实）

### 判定为「可研究的事实」（不问用户，已记入 26-CONTEXT.md §Researchable Facts）
- **F-01** 导出字段集 → STORAGE_KEYS 逐字段映射（storage.ts 即真相源）。
- **F-02** 关键纠偏：「自动插入开关」key 已于 Phase 3 删除，无对应持久化 key——「开关类」只剩 `SELECTION_ATTACH_ENABLED`。
- **F-03** API key 与 ProviderConfig 分开存储，导出需遍历 PROVIDERS 取各 `aster:keys:{id}`（含内置）。
- **F-04** 导出机制 = Blob + createObjectURL + `<a download>`（零依赖）；文件名 Claude 自决 `aster-config-YYYYMMDD.json`。
- **F-05** 导入机制 = 独立 file input + `file.text()` + JSON.parse；「复用 v2.2 FILE 基建」= 复用文件读取知识，**非**附件 store 管线。
- **F-06** JSON schema（带 version 字段）—— planner 定精确结构。
- **F-07** 导入写入须经 store setter / `hydrateFromStorage` 刷新 reactive（尤其 `configuredKeyIds` 红条）。
- **F-08** 合并策略细节（addProvider 强制 randomUUID 需评估"按指定 id 写入"）。
- **F-09/F-10** bundle 近零增量（先 build 再 size）+ Lingui `npm run extract`。

### 判定为「需人类拍板」（UX / 产品取向，已 AskUserQuestion 问真人）
1. Settings 入口落点与措辞（P26-入口）
2. CFG-03「不可忽略」警告的实现方式（P26-警告）
3. 导入流程透明度——是否事前预览摘要（P26-导入流程）
4. 锁定清单之外的字段是否纳入导出（P26-字段集）

> 文件命名（F-04）、JSON schema（F-06）等虽被 team-lead 列为灰区提示，但均有惯例默认 / 属实现细节，判为 Claude 可自决，未占用提问额度。

---

## 3. AskUserQuestion（一次调用，4 问，真人作答 2026-06-05）

### Q1 — P26-入口：配置导出/导入入口放在 Settings 哪里、怎么呈现？
- 选项 A（推荐）新开独立分区 / B 就地加按钮
- **用户答：A「新开独立分区」** → D-01

### Q2 — P26-警告：CFG-03「不可忽略」怎么实现？
- 选项 A（推荐）对话框+强制勾选 / B 常驻醒目警告文案 / C 常驻文案+一次性确认
- **用户答：B「常驻醒目警告文案」**（非强阻断）→ D-03
- 备注：与推荐 A 不同——用户在"便利优先"姿态下选更轻的常驻警告；CONTEXT 已据此明确 verifier 判定基线（常驻+醒目=不可忽略，不强制勾选）。

### Q3 — P26-导入流程：写入前是否先展示内容摘要 + 合并/覆盖预览？
- 选项 A（推荐）先预览摘要再确认 / B 直接导入+逐项覆盖确认 / C 简单确认+完成 toast
- **用户答：C「简单确认+完成toast」**（不逐项预览摘要；同 id 覆盖仍单独确认）→ D-04
- 备注：与推荐 A 不同——用户选更轻的流，不要事前逐项预览面板。

### Q4 — P26-字段集（多选）：锁定清单之外的字段是否纳入导出？
- 选项：生图默认模型偏好（推荐纳入）/ 引导已读标记 / Pexels Worker 兜底 baseURL
- **用户答：仅「生图默认模型偏好」纳入**；引导已读、Pexels baseURL **不纳入** → D-02

---

## 4. 锁定决策汇总（→ 26-CONTEXT.md §Human Decisions）

| ID | 决策 | 来源 |
|---|---|---|
| D-01 | 入口 = 新开「配置备份与迁移」独立分区（导出/导入两按钮 + 常驻警告） | Q1=A |
| D-02 | 导出字段集 = 锁定清单 + 生图模型偏好；不带引导已读 & Pexels baseURL；内置 Provider 行+内置 key 照常导出 | Q4 |
| D-03 | CFG-03「不可忽略」= 常驻醒目警告文案（非强制勾选/阻断）；导入确认重申 | Q2=B |
| D-04 | 导入流 = 简单确认（含明文警告）+ 完成 toast 摘要；同 id Provider 覆盖前单独确认；合并 = 保留现有+加入新的 | Q3=C |

### 已锁定（team-lead 转达，本次未重复问）
- 安全姿态 = 明文 JSON + 醒目警告（口令加密 CFG-D1 deferred）
- 载体 = JSON 文件下载/上传
- 导出内容含 Provider 配置/keys/默认/附件开关/偏好/主题色/Pexels key；不含聊天历史
- 合并策略 = 保留现有+加入新的，同 id 覆盖前确认；损坏 JSON 给可操作错误
- Key 仅落用户本地文件，不经 Aster 服务器（无后台硬约束）

---

## 5. 产物

- `.planning/phases/26-config-import-export/26-CONTEXT.md`（权威决策 + 可研究事实 + canonical refs + 风险/延后 + UAT 种子）
- `.planning/phases/26-config-import-export/26-DISCUSSION-LOG.md`（本文件）

**未 git commit**（按 TeamMate 边界）。

---

## 6. 推荐下一步

本阶段 **UI hint = yes** 且有真实 UX 落点（独立分区 + 警告呈现 + 导入确认/toast + teal 克制下无现成 warn token）。推荐：
1. `/gsd-ui-phase 26` → 出 `26-UI-SPEC.md`（加载 `aster-design-system` skill；重点定警告色块呈现 + 分区布局 + 按钮/确认/toast 样式）
2. 再 `/gsd-plan-phase 26` → 出 PLAN.md（消费 26-CONTEXT.md + 26-UI-SPEC.md）

---

*Discussion completed: 2026-06-05*
