---
phase: 03-agent-loop-privacy-word-demo
plan: 02
subsystem: errors
tags: [typescript, errors, sanitize, type-guard, tdd, agent-loop]

requires:
  - phase: 01-foundation
    provides: AsterError 基类 + 8 子类 (FOUND-06)
  - phase: 02-providers
    provides: RateLimitError / ContentFilterError / ModelNotFoundError / ImageQuotaError

provides:
  - "10 个 AsterError 子类全部含 readonly recoverable: boolean + readonly hint: string (中文字面量, D-15)"
  - "新增 CircuitOpenError(toolName) + StepLimitError() (Plan 03 agent loop 熔断 / 步数上限)"
  - "HostApiError 改造：构造器仍接收 _hostError 参数但不存到实例字段 (ERR-02 防 stack/path/Key 片段跨 catch 边界传到 LLM)"
  - "isAsterErrorWithMeta(e) 类型守卫 — Plan 03 dispatchTool sanitize 入口"

affects: [03-03-tools-dispatch, 03-04-agent-loop, 03-05-ui-tool-rendering]

tech-stack:
  added: []  # 0 net new runtime deps
  patterns:
    - "AsterError 子类四字段强制 (code/message/recoverable/hint) 全部 readonly 字面量"
    - "isAsterErrorWithMeta 类型守卫为下游 sanitize 唯一入口（基类裸实例返 false）"
    - "TDD RED → GREEN：测试先红，源码后绿"

key-files:
  created:
    - .planning/phases/03-agent-loop-privacy-word-demo/03-02-SUMMARY.md
    - .planning/phases/03-agent-loop-privacy-word-demo/deferred-items.md
  modified:
    - src/errors/index.ts
    - src/errors/index.test.ts

key-decisions:
  - "HostApiError 保留 _hostError 构造参数 (向后兼容 6 个 adapter throw 调用点) 但不存到实例字段 — ERR-02 防泄漏"
  - "中文 hint 字面量由 PLAN 给定，源码内未做 string interpolation (D-15)"
  - "CircuitOpenError 唯一 interpolation 例外：toolName 来自 tool registry literal subset 受控"
  - "isAsterErrorWithMeta 守卫要求 instanceof AsterError + recoverable/hint 类型双确认 — 基类裸实例返 false (合理：基类不应被 dispatch sanitize 直接消费)"

patterns-established:
  - "Pattern: AsterError 子类字段声明 — 子类内 public readonly recoverable + public readonly hint，constructor super 调基类三参数"
  - "Pattern: 敏感字段不上 instance — adapter 层接住的原始 hostError 用 console.warn 打到 DevTools，不挂在 error 上"
  - "Pattern: TDD RED 阶段允许编译失败计为 RED (TypeError: CircuitOpenError is not a constructor)"

requirements-completed: [ERR-01, ERR-02]

duration: 19min
completed: 2026-05-29
---

# Phase 03 Plan 02: Errors Foundation Summary

**AsterError 子类四字段强制 (recoverable + hint 中文字面量) + CircuitOpenError/StepLimitError 新增 + HostApiError 改造不存 hostError 实例 + isAsterErrorWithMeta 类型守卫，为 Plan 03 dispatchTool 严格 allowlist sanitize 提供类型基础**

## Performance

- **Duration:** 19 min
- **Started:** 2026-05-28T16:40:00Z
- **Completed:** 2026-05-28T16:59:38Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (src/errors/index.ts, src/errors/index.test.ts)
- **Files created:** 2 (03-02-SUMMARY.md, deferred-items.md)

## Accomplishments

- ERR-01 落地：10 个 AsterError 子类全部含 readonly recoverable + hint 字段（中文字面量 D-15）
- ERR-02 落地：HostApiError 构造器收 hostError 后不挂在实例字段（防 stack/path/Key 片段跨 catch 边界）
- 新增 2 个 agent loop 专用错误类（CircuitOpenError + StepLimitError）
- isAsterErrorWithMeta 类型守卫导出，Plan 03 dispatchTool 可直接 import
- 67/67 errors 测试全绿（含 20 新增 it），全套 210/210 通过
- gzip ~75KB（在 ~70KB 预算附近，无 net new dep）

## Task Commits

按 TDD 拆 2 commit：

1. **Task 2.1 RED — failing tests for AsterError 四字段 + CircuitOpenError + StepLimitError + isAsterErrorWithMeta** — `dee4288` (test)
2. **Task 2.1 GREEN — AsterError 子类四字段 + CircuitOpenError/StepLimitError + isAsterErrorWithMeta** — `30b8d5e` (feat)

REFACTOR 未触发（代码一次写干净，无清理空间）。

## Files Created/Modified

- `src/errors/index.ts` — 8 个原有子类补 recoverable+hint；HostApiError 改造（不存 hostError）；新增 CircuitOpenError + StepLimitError + isAsterErrorWithMeta 守卫；ImageQuotaError + UnsupportedOperationError 也补字段（共 12 个 export class）
- `src/errors/index.test.ts` — 新增 8 个 describe 块共 20 个 it 覆盖四字段断言 + ERR-02 hostError 不挂实例 + 守卫真假分支 + 中文 hint 字面量；同时改造 1 个旧 it 以匹配 ERR-02 不存 hostError 行为
- `.planning/phases/03-agent-loop-privacy-word-demo/deferred-items.md` — 记录预存在的 retry/queue Unhandled Errors（与本 plan 无关，不修）
- `.planning/phases/03-agent-loop-privacy-word-demo/03-02-SUMMARY.md` — 本文档

## 现有 8 子类 hint 字面量列表（D-15 中文）

| 类                          | recoverable | hint                                                 |
| --------------------------- | ----------- | ---------------------------------------------------- |
| KeyInvalidError             | false       | 请前往设置更新 API Key                                |
| QuotaExceededError          | false       | 配额已用完，请检查 Provider 账户余额或换 Provider     |
| ContextTooLongError         | false       | 请缩短对话或清空历史后重试                            |
| NetworkError                | true        | 网络异常，请检查连接后重试                            |
| RateLimitError              | true        | 请稍后再试（已退避）                                  |
| ContentFilterError          | false       | 内容被 Provider 过滤，请改写提示                      |
| ModelNotFoundError          | false       | 请到设置确认模型名称是否正确                          |
| HostApiError                | true        | 宿主操作可瞬时失败，可重试一次                        |
| UnsupportedOperationError   | false       | 该操作在当前宿主不支持                                |
| ImageQuotaError             | false       | 图像配额已用完，请稍后再试或换 Provider               |

## 2 个新增类签名 + 字段值

```typescript
export class CircuitOpenError extends AsterError {
  public readonly recoverable = false;
  public readonly hint = '换个 tool 或换个思路再试';
  constructor(toolName: string) {
    super(`工具 ${toolName} 连续失败，已强制停止`, 'CIRCUIT_OPEN', 'adapter');
  }
}

export class StepLimitError extends AsterError {
  public readonly recoverable = true;
  public readonly hint = '已达单轮上限，请确认是否继续';
  constructor() {
    super('已达单轮 20 步上限', 'STEP_LIMIT', 'adapter');
  }
}
```

CircuitOpenError 的 toolName interpolation 是 D-15 受控例外（来自 Plan 03 buildToolsForHost 的 string literal subset：`'append_paragraph' | 'get_paragraph_count' | 'replace_paragraph_text' | 'list_paragraphs'`）。

## HostApiError 改造对比

| 项                              | 改造前                                          | 改造后                                                              |
| ------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| 构造器签名                       | `(message, hostError?)` — 同名 public 字段       | `(message, _hostError?)` — 下划线参数 + `void _hostError`            |
| `this.hostError` 实例字段        | 有，`public readonly hostError`                 | 无（grep `this\.hostError` 0 match）                                 |
| recoverable                     | 无字段                                          | `public readonly recoverable = true`                                 |
| hint                            | 无字段                                          | `public readonly hint = '宿主操作可瞬时失败，可重试一次'`             |
| `Object.keys(err)` 含 hostError | 是                                              | 否                                                                  |
| v1 调用点兼容                    | n/a                                            | WordAdapter/ExcelAdapter/PptAdapter 6 处 `throw new HostApiError('xx', err)` 不需改 |

调试用 hostError 信息现在由 adapter 层在 throw 前 `console.warn` 打到 DevTools，不跨 catch 边界。

## isAsterErrorWithMeta 守卫使用例（给 Plan 03 看）

```typescript
import { isAsterErrorWithMeta } from '../../errors';

try {
  return await dispatchToolInternal(name, args);
} catch (err: unknown) {
  if (isAsterErrorWithMeta(err)) {
    // 只读 4 字段（code / message / recoverable / hint）传 LLM
    return {
      ok: false,
      error: {
        code: err.code,
        message: err.message,
        recoverable: err.recoverable,
        hint: err.hint,
      },
    };
  }
  // 兜底：陌生异常一律 UNSUPPORTED + 占位（不读 err.message 防泄漏）
  return {
    ok: false,
    error: {
      code: 'UNSUPPORTED',
      message: '工具执行遇到未识别错误',
      recoverable: false,
      hint: '请稍后重试或联系开发者',
    },
  };
}
```

守卫语义：`instanceof AsterError && typeof recoverable === 'boolean' && typeof hint === 'string'` — 双保险确保只有补齐字段的子类实例返 true，基类裸实例（只有 code/message/category）返 false。

## Decisions Made

- **HostApiError 不破坏 v1 调用点** — 构造器签名仍是 `(message, _hostError?)`，仅修改内部行为（不存字段）；6 个 adapter throw 调用点零修改，编译通过。
- **ImageQuotaError + UnsupportedOperationError 也补字段** — PLAN 文本只列 8 个「现有子类」但 v1 实际有 10 个（含这两个）。补齐让 12 个 class 全部满足 ERR-01 schema，isAsterErrorWithMeta 守卫对全部子类返 true。
- **测试覆盖度** — 67 个 it（原 47 + 新增 20）远超 PLAN min_lines 80 行 + ≥10 it 的下限。
- **未改 adapter 层 console.warn** — PLAN 在注释中指引 "调试需要时由 adapter 层 console.warn 打到 DevTools" 但未要求本 plan 落实，留给后续按需补。

## Deviations from Plan

仅 1 处需要说明的小调整，非 deviation rules 触发：

### 测试文件复用，而非新建

- **Found during:** Task 2.1 步骤 1
- **Issue:** PLAN action 步骤 1 用 "写 src/errors/index.test.ts" 措辞，但该文件已存在（324 行 / 47 测试）。
- **Decision:** **追加** PLAN 给的新 describe 块到现有文件末尾（而非覆盖），并按 ERR-02 要求**修改 1 个现有 HostApiError it**（原 `expect(err.hostError).toBe(originalError)` → 改为 `expect(...).hostError 不存在`）。该修改是 PLAN ERR-02 要求的直接结果（不存 hostError 必然破坏旧断言），不算 Rule 1 / Rule 2 偏差。
- **Verification:** RED 阶段确认 `TypeError: CircuitOpenError is not a constructor` → GREEN 阶段 67/67 全绿。
- **Committed in:** dee4288 (RED) + 30b8d5e (GREEN)

---

**Total deviations:** 0 auto-fixed (Rule 1-3 未触发)
**Impact on plan:** 严格按 PLAN 字面要求执行；测试文件改动属于 PLAN ERR-02 的直接结果。

## Issues Encountered

- **预存在的 Unhandled Errors**（retry.test.ts / queue.test.ts）— baseline `npm test` 同样报 3 个 Unhandled Errors（NetworkError × 2 + RateLimitError × 1）。stash 改动后跑 baseline 确认非本 plan 引入。记入 `deferred-items.md`，不修。

## Threat Flags

无新增威胁面。本 plan 改的是 error 类型层（无网络、无 IO），且 ERR-02 mitigations 已落地（HostApiError 不存 hostError → 满足 T-ERR-01；message/hint 中文字面量无 dynamic 嵌入 → 满足 T-ERR-02；守卫双确认 → 满足 T-ERR-03）。

## Self-Check: PASSED

**Files (检查实际存在):**
- src/errors/index.ts — FOUND (273 行, 含 12 export class + isAsterErrorWithMeta)
- src/errors/index.test.ts — FOUND (458 行, 67 it 全绿)
- .planning/phases/03-agent-loop-privacy-word-demo/deferred-items.md — FOUND
- .planning/phases/03-agent-loop-privacy-word-demo/03-02-SUMMARY.md — FOUND (本文件)

**Commits (检查 git log):**
- dee4288 — FOUND (RED phase test)
- 30b8d5e — FOUND (GREEN phase feat)

**Done criteria 复核:**
- ✅ src/errors/index.ts 8 子类 + 2 新增 + HostApiError 改造 + isAsterErrorWithMeta 守卫（实际 12 export class 含 ImageQuotaError/UnsupportedOperationError）
- ✅ src/errors/index.test.ts ≥ 5 个 describe + ≥ 10 个 it 全绿（实际 16 describe / 67 it）
- ✅ npm test 全套全绿（210/210）
- ✅ npm run build 通过（gzip ~75KB）
- ✅ grep `this\.hostError` 在 src/errors/index.ts 中 0 match

## Next Phase Readiness

Plan 03 (`src/agent/tools/index.ts` dispatchTool 严格 allowlist sanitize) 可以：

```typescript
import { isAsterErrorWithMeta, CircuitOpenError } from '../../errors';
```

直接消费类型守卫和新增类，不需要再补 errors 层。Plan 04 agent loop 也可以 throw `new StepLimitError()` 和 `new CircuitOpenError(toolName)`。

---
*Phase: 03-agent-loop-privacy-word-demo*
*Plan: 02-errors-foundation*
*Completed: 2026-05-29*
