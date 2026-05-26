# Phase 0: Spike & 风险验证 (GATING) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves alternatives considered.

**Date:** 2026-05-26
**Phase:** 00-spike-gating
**Areas discussed:** 生产托管选型, Spike 顺序 + CORS fallback, Spike 代码与证据归档, DeepSeek-V4 多模态验证深度

---

## 生产托管选型

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Pages | 免费、与仓库同源、零额外账号、贴合开源副业；CSP 走 meta tag，不支持自定义 _headers | ✓ |
| Vercel | 免费 hobby tier；vercel.json 灵活控制 CSP / Cache-Control；引入 Vercel 账号依赖 | |
| Cloudflare Pages | _headers 最灵活；全球 CDN 包括中国；引入 CF 账号；若 CORS fail 升级 Worker 同生态 | |
| 先用 Pages，保留迁移选项 | 默认 GitHub Pages 跑完 Phase 0-6，必要时迁；manifest URL 调整成本 | |

**User's choice:** GitHub Pages（推荐）
**Notes:** INSTALL-05 图标 Cache-Control 限制是已知 tradeoff，Phase 1 若有体感问题再评估迁

---

| Option | Description | Selected |
|--------|-------------|----------|
| 仓库 root | wb-chen.github.io/aster（或对应 GitHub username）；零 DNS 配置 | ✓ |
| custom domain | aster.xxx.com 形式；专业感更强；额外 30 分钟 DNS 配置 | |
| 仓库 root 先上 | v1.0 发布前再评估 custom domain | |

**User's choice:** 仓库 root
**Notes:** 副业项目无需 custom domain；manifest SourceLocation 用 wb-chen.github.io/aster 路径

---

| Option | Description | Selected |
|--------|-------------|----------|
| main push 即部署 | GitHub Actions workflow；spike 反复 push 验证高频 | ✓ |
| spike 分支 + 手动 publish | 防止中间状态误发；多一层手工 | |
| 仅 release 触发 | spike 阶段需多次 push 验证，不适配 | |

**User's choice:** main push 即部署
**Notes:** 自动化是 Phase 0 反复验证的必要条件

---

## Spike 顺序 + CORS fallback

| Option | Description | Selected |
|--------|-------------|----------|
| 严格 gate-first | Day 1-2 只跑 GATING #1+#2+#3，全 pass 后才动其余 7 项；fail-fast 优势明显 | ✓ |
| 并行跑完 | Day 1 同时启动 10 项；时间利用最高；GATING fail 时已浪费 30-50% 工作量 | |
| Wave-based 3 波 | GATING 串 + PPT 依赖项一波 + 独立项一波；折衷 | |

**User's choice:** 严格 gate-first
**Notes:** Phase 0 时间盒 ≤ 1 周，fail-fast 优先于吞吐

---

| Option | Description | Selected |
|--------|-------------|----------|
| 立即止损 + 会诊重估 | GATING fail 当天停后续 spike，写 1-2 页决策备忘进 PRD 修订；遵从 ROADMAP 原意 | ✓ |
| 收集证据后止损 | fail 后额外 0.5-1 天跑 fallback POC 再决定；信息更多但时间盒被啃 | |
| 按 gate 类型区分 | #1 立即停；#2 跑 Plan B 后决定；#3 现场调查后决定；需动脑判断 | |

**User's choice:** 立即止损 + 会诊重估
**Notes:** 简单规则 + 一致执行优先于"按情况判断"

---

| Option | Description | Selected |
|--------|-------------|----------|
| A → B → C 排序 | 先 drop provider 不动架构；不行再 CF Worker；都不行再停项目 | |
| 只走 A，不接受代理 | drop provider；两家都不通直接停项目 | |
| A → C（跳过 B） | drop 可接受；上代理则直接停项目 | |
| Cloudflare Worker（直接走 B） | CORS fail 直接上 Worker 代理；不缩水 v1 功能；接受小幅妥协架构 | ✓ |

**User's choice:** Cloudflare Worker 直接走 B 路径
**Notes:** 用户原话"不通的话，那么我们就真的开一个轻量级服务器"；优先保 v1 功能范围，接受 Core Value 第一句的小调整作为代价

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare Worker | Serverless 边缘函数；免费 100k 请求/天；不需 ICP 备案；零运维；30 行代码 | ✓ |
| 阿里云轻量应用服务器 | VM 形态；¥99-300/年；需 ICP 备案 2-3 周；持续运维；偏重 | |
| Vercel Edge | 与 CF Worker 同类 | |
| Phase 0 跑完再决定 | 不预锁，等结果再选 | |

**User's choice:** Cloudflare Worker
**Notes:** Worker 是"代码"不是"服务器"，与"无后台"妥协最小；阿里云 VM 的备案 + 运维成本与个人副业定位脱节

---

## Spike 代码与证据归档

| Option | Description | Selected |
|--------|-------------|----------|
| 丢弃式 | spike/ 顶层目录独立；与 Phase 1 完全隔离；Phase 1 从 Yo Office 重新起步 | ✓ |
| Promote 为 Phase 1 起点 | spike 代码演变为脚手架；省 1-2 天但 spike 品质要求骤升 | |
| 分类：hello-world 丢弃，可复用 helper 保留 | 混合品质；维护成本高 | |

**User's choice:** 丢弃式
**Notes:** spike 是"能不能跑"，不是"怎么用"；不允许 hack 污染正式代码

---

| Option | Description | Selected |
|--------|-------------|----------|
| .planning/spikes/00X-{slug}/ + MANIFEST.md 索引 | 一项一子目录；顶层 MANIFEST 列状态 + 链接；Phase 7 REL-05 regression 友好 | ✓ |
| spike/ 根目录扁放 | 文件多了不易理解 | |
| .planning/phases/00-spike-gating/evidence/ | 阶段目录下；路径不直观 | |

**User's choice:** .planning/spikes/00X-{slug}/ + MANIFEST.md
**Notes:** REL-05 regression 重跑时此 MANIFEST 是起点

---

| Option | Description | Selected |
|--------|-------------|----------|
| 全部 commit 进开源仓库 | 代码 + 证据 + MANIFEST 推 GitHub；视频超 100MB 用 release attachments | ✓ |
| 代码 commit，视频走 release attachments | 仓库不肿；动作多 | |
| .planning/spikes/ gitignore，证据留本地 | 仓库最干净；future-self 换机器丢失 | |

**User's choice:** 全部 commit 进开源仓库
**Notes:** 透明化 = 开源用户能看到决策依据；REL-05 起点是公开可访问

---

## DeepSeek-V4 多模态验证深度

| Option | Description | Selected |
|--------|-------------|----------|
| 只验证可用性 | 发一次 image_url 请求；200 = pass / 错误 = fail；30 分钟 | |
| 可用性 + 质量对比 | 同图在 DeepSeek vs aihubmix 比质量/价格/响应时间；半天 | |
| 只查官方文档不发请求 | 15 分钟；可能得到"官方没讲清"的中间态 | |
| 先读文档 → 实测 → 不行 fallback（用户 freeform） | 三步法：15 分钟文档 → 30 分钟实测 → 不行锁 aihubmix | ✓ |

**User's choice:** 先读文档 → 实测可用性 → 不行 fallback
**Notes:** Default routing 切换决策推到 Phase 2 ProviderRegistry

---

## Claude's Discretion

- spike 子目录的具体编号 / slug 规范
- GitHub Actions workflow 内容
- 各 spike 项的具体测试脚本写法
- findings.md / MANIFEST.md 模板设计

## Deferred Ideas（不在 Phase 0 处理）

- INSTALL-05 图标 Cache-Control 限制（Phase 1）
- CORS fallback 触发后的 Onboarding / PROJECT.md 调整（仅 GATING #1 fail 时）
- Default vision routing 决策（Phase 2）
- Q1 Unsplash vs Pexels 选型（Phase 4）
- Q4 量化指标 / Q5 Ribbon 终选（Phase 7 / Phase 1）

## 中途插话：用户提议加 Node.js 后台

讨论 CORS fallback 时用户问"项目改成 Node.js 服务 + plugin 形式，部署阿里云"。

**Claude 的回应：**摆出代价（PROJECT.md Core Value 第一句作废、阿里云备案 + 运维 + 月供、信任定位降级、开源定位变弱、CORS 实际 fail 概率 < 20%），建议先 spike 半天验证再决定。

**用户决定：** 接受 Plan A（维持无后台 PRD，先验证）；如 CORS 真 fail 则走 Cloudflare Worker（serverless，不是阿里云 VM）。

---
