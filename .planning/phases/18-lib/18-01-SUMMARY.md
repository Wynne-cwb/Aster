---
phase: 18-lib
plan: "01"
subsystem: provider-wiring
tags: [pexels, stock-image, byo-key, native-fetch, lib-01]
dependency_graph:
  requires: []
  provides: [pexels-client, stock-image-registry, PEXELS_API_KEY, PEXELS_BASE_URL]
  affects: [src/providers/, src/lib/storage.ts]
tech_stack:
  added: []
  patterns: [native-fetch-no-sdk, bare-key-auth, url-to-base64-filereader, registry-resolve-case]
key_files:
  created:
    - src/providers/pexels-client.ts
    - src/providers/pexels-client.test.ts
  modified:
    - src/lib/storage.ts
    - src/providers/registry.ts
    - src/providers/types.ts
    - src/providers/registry.test.ts
decisions:
  - "fetchPexelsImageToBase64 全新手写（非复用 aihubmix-image.ts）——16-05 CORS 修复已删除该文件内的 fetchUrlToBase64（改 b64_json 直拿），故无可复用函数；按 plan 自写 FileReader 版"
  - "Pexels 鉴权 = Authorization: <裸 key>（无 Bearer 前缀，D-10 头号坑）；区别于 sse.ts/aihubmix 的 Bearer"
  - "baseURL 可配：registry 读 STORAGE_KEYS.PEXELS_BASE_URL override，缺省回退 PEXELS_DEFAULT_BASE_URL（Worker 兜底口，默认纯直连）"
  - "model:'' 占位（Pexels 无 model 概念）——ImageConfig.model 是 string 非可选，空串无下游类型问题；registry.test 已断言"
  - "registry.test 补 '未知 taskKind → ModelNotFoundError' 用例，保留 ModelNotFoundError import（stock-image stub 移除后否则 unused）"
metrics:
  completed: "2026-06-03T01:48:17Z"
  tasks_completed: 4
  files_modified: 6
---

# Phase 18 Plan 01: Pexels 接线基础层 Summary

**一句话：** 新建 Pexels REST client（裸 key 鉴权 + URL→裸 base64）、新增 BYO `PEXELS_API_KEY`/`PEXELS_BASE_URL` 存储约定、填实 registry `stock-image` 路由（缺 key 抛 KeyInvalidError），0 净新增运行时依赖，32 单测全绿。

## Tasks Completed

| Task | Name | Files |
|------|------|-------|
| 1 | storage.ts 新增 PEXELS_API_KEY + PEXELS_BASE_URL | src/lib/storage.ts |
| 2 | 新建 pexels-client.ts（裸 key + URL→base64，0 SDK） | src/providers/pexels-client.ts |
| 3 | registry stock-image case 填实 + types.ts 注释订正 | src/providers/registry.ts, types.ts |
| 4 | 单测：pexels-client.test.ts（新）+ registry.test.ts（stock-image 改写） | *.test.ts |

## 接口最终形态（导出符号）

```typescript
// src/providers/pexels-client.ts
export const PEXELS_DEFAULT_BASE_URL = 'https://api.pexels.com/v1';
export interface PexelsPhoto { id; url; photographer; photographer_url; alt; src:{ original; large2x; large; medium; tiny } }
export interface PexelsSearchOpts { per_page?; page?; locale?; orientation?; signal? }
export async function searchPexels(query, apiKey, baseURL?, opts?): Promise<PexelsPhoto[]>
export async function fetchPexelsImageToBase64(url, signal?): Promise<string>  // 裸 base64
```

## registry baseURL 可配机制

- `stock-image` resolve 读 `storage.get(STORAGE_KEYS.PEXELS_BASE_URL)`，`?? PEXELS_DEFAULT_BASE_URL`。
- override storage key = `'aster:config:pexels-base-url'`（无 UI，仅 CORS 失败后手动/Worker 切换）。
- 返回 `ImageConfig { providerId:'pexels', baseURL, apiKey, model:'' }`。

## 偏差 / 注意

- **`grep Bearer pexels-client.ts` 返回 3（非 0）**：3 处全是**警告性注释**（明确告诉后人"无 Bearer 前缀"），实际鉴权代码用 `Authorization: apiKey`（裸 key）。plan 的 `grep Bearer==0` 是粗检；真实意图（代码无 `Bearer ${key}`）已满足。保留警告注释（精确优先），不删。
- `ImageConfig.model:''` 占位无下游类型问题（model 是 string 非 optional）。

## 自动化 gate（本 plan 范围）

- `npm run build`：✓ 无 TS 错误（main 80.01 KB gzip，+0.2KB vs 基线 79.81——registry 静态 import pexels-client）。
- `npx vitest run src/providers/pexels-client.test.ts src/providers/registry.test.ts`：✓ 32 passed / 0 failed。
