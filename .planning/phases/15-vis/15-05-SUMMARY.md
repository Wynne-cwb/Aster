---
phase: 15-vis
plan: "05"
subsystem: uat, spike, ux
tags: [uat, spike, vision, file-06, nfr-09, office-for-web, deploy]

requires:
  - phase: 15-vis
    plan: "04"
    provides: NFR-09 serialize-test 守门 + bundle gate 验证（自动化部分全绿）

provides:
  - 三宿主取图 spike 真机结果（PPT fallback / Excel·Word 可用）
  - 粘贴 spike 真机结果（Ctrl+V 触发 paste 事件 ✅）
  - 端到端 UAT 验证（上传/粘贴/多轮/三类错误 UX 全 PASS）
  - 3 处真机 UAT 衍生优化（loop 上限 / 发送清图 / 看图反馈）

affects:
  - Phase 15 收尾：核心交付（看图能力）真机验证 PASS，可标记完成
  - Phase 17（FILE 文件解析）：复用的回形针上传 + 附件基础设施真机已验稳固

tech-stack:
  added: []
  patterns:
    - "取图三宿主分层降级：Excel/Word 直接取图，PPT Preview API 不可用 → HOST_API_FAILED 结构化 fallback 引导上传"
    - "含图发送即时反馈：先 push user message 再跑 vision，visionPreparing 标志驱动「看图中…」typing 气泡"

key-files:
  created:
    - .planning/phases/15-vis/15-05-SUMMARY.md
  modified:
    - src/adapters/PptAdapter.ts        # SPIKE 注释追加真机实测结论
    - src/agent/agentStore.ts           # MAX_STEPS 20→100 + visionPreparing 标志
    - src/store/chat.ts                 # 发送即时反馈 + 发送后清图 + visionPreparing 包裹
    - src/store/attachments.ts          # 清除时机文档反转（D-10）
    - src/components/ChatStream.tsx      # 「看图中…」指示气泡
    - src/components/AgentControlBar.test.tsx
    - src/store/chat.test.ts
    - src/errors/index.ts
    - src/i18n/locales/zh-CN/messages.po

key-decisions:
  - "PPT 取选中图属预期内已知宿主限制（Preview API 未在 Web GA）——fallback 引导上传真机验证通过，记为 PASS 而非 gap"
  - "决策 B（反转 D-10）：附件图发送后自动清空（发完即清），仍 memory-only；多轮追问同图需重新上传"
  - "MAX_STEPS 20→100：20 对多步任务太易误触发软着陆；熔断器仍是真卡死防御"

metrics:
  duration: "UAT 跨多轮"
  completed: "2026-06-02"
  tasks: 3
  files_modified: 9
---

# Phase 15-05 — 真机 spike 验证 + 端到端 UAT

## Task 1：构建并部署到 GitHub Pages ✅

- `npm run build` 成功，`npm run size` 77.84 KB gzip（≤82KB CI gate）
- push origin main → Pages CI 部署成功
- 线上：https://wynne-cwb.github.io/Aster/

## Task 2：真机 spike + UAT（Office for Web / Edge）

### 取图 Spike 结果

| Spike | 结果 | 说明 |
|-------|------|------|
| **S1 PPT** `getImageAsBase64` | ❌ 取图不可用 → ✅ fallback 验证通过 | agent 正确识别 shape type=Image，返回引导文案让用户点回形针上传。**预期内已知宿主限制**（Preview API 未在 Web GA），非缺陷 |
| **S2 Excel** `getActiveChartOrNullObject + getImage` | ✅ 可用 | 单击激活图表后取图成功，据图作答 |
| **S3 Word** `InlinePicture.getBase64ImageSrc` | ✅ 可用 | 选中内嵌图取图成功，据图作答 |
| **S4 Ctrl+V 粘贴** | ✅ 触发 paste 事件 | iframe 内同步 clipboardData.items 路径有效，缩略图 chip 正常出现 |

### 端到端 UAT 结果

| UAT | 结果 | 备注 |
|-----|------|------|
| 上传图（回形针）→ 据图作答 | ✅ PASS | **核心成功路径** |
| 粘贴图 → 据图作答 | ✅ PASS | |
| 多轮复用 | ✅ PASS | （注：决策 B 后改为每轮需重新上传，见下） |
| 没配 aihubmix key 错误提示 | ✅ PASS | |
| 选区不是图错误提示 | ✅ PASS | |
| 非图片文件诚实提示「文件解析即将开放」 | ✅ PASS | |

## Task 3：记录 spike + UAT 衍生优化

真机 UAT 中发现并修复 3 处交互/配置问题（均已 commit + 部署）：

1. **MAX_STEPS 20 → 100**（`65890b1`）：20 步对多步 agent 任务太易触发软着陆。单一真相 = `agentStore.MAX_STEPS`，UI/错误文案不再写死数字。熔断器（同名 NOT_FOUND ≥3）仍是真卡死防御。
2. **附件图发送后自动清空**（`f2dbc89`，反转 D-10）：原「发送后保留供多轮复用」反直觉、且留图易在下条无关提问被误重发。改为 sendMessage 发送后 `clearImages()`，仍 memory-only（NFR-09 不变），只是清得更早。
3. **含图发送即时反馈 + 看图中指示**（`4e87960`）：原 sendMessage 先 `await analyzeImages`（vision 几秒）才 push 用户气泡 → 点发送后聊天区死寂。改为先 push 用户气泡再跑 vision，新增 `visionPreparing` 标志驱动「看图中…」typing 气泡。

## ROADMAP Success Criteria 对照

| SC | 内容 | 结果 |
|----|------|------|
| SC-1 | 选中图 + 提问 → agent 取图据图作答 | ✅ Excel/Word 直接可用；PPT 优雅降级到上传（已知宿主限制） |
| SC-2 | 上传/粘贴 → 据图作答 + 多轮 | ✅ PASS（多轮经决策 B 调整为每轮重传） |
| SC-3 | 三类失败结构化错误 UX | ✅ PASS（没 key / 选区非图 / 非图片文件 三类全验） |
| SC-4 | base64 不进 history | ✅ NFR-09 serialize-test 守门 PASS |

## Phase 15 整体：✅ PASS

核心「视觉看图」能力（上传/粘贴/选中图取图）真机端到端验证通过。唯一已知限制：PPT 选中图直接取图在 Office for Web 不可用（Preview API 未 GA），由 fallback 引导上传完整兜底——属预期内、非缺陷。三类错误 UX 全绿，NFR-09 守门到位。

## Self-Check: PASSED
