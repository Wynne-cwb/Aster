/**
 * src/agent/tools/write/batch.ts — Phase 11 batch_write ToolDef
 *
 * A-06 严禁：本文件不出现 Excel/Word/PowerPoint 全局命名空间。
 * 所有宿主 API 调用通过 ctx.adapter.executeBatch() 委托给 adapter 层。
 *
 * D-01：单 *.run 闭包 + 单 context.sync() 由 adapter.executeBatch 实现。
 * D-06：ops.length ≤ 20，超限整批拒绝 INVALID_ARGS，开 run 之前校验。
 * D-05：只收当前宿主 write 工具；拒绝嵌套 batch_write；拒绝 read 工具。
 * D-12：结果精简汇总（completed/total/failed 位置），不回显所有写入值。
 */
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';

interface BatchOp {
  tool: string;
  args: Record<string, unknown>;
}

interface BatchWriteArgs {
  ops: BatchOp[];
}

/** adapter.executeBatch 的返回结构（由 ExcelAdapter/WordAdapter/PptAdapter 实现）*/
interface BatchSubOpResult {
  humanLabel: string;
  beforeImage?: unknown;
  reverse: ReverseDescriptor;  // reverse.args 必须是 Record 对象
  postState?: PostStateSnapshot;
  ok: boolean;
}

interface BatchResult {
  subOps: BatchSubOpResult[];
  failAtIndex?: number;
}

/** adapter 扩展接口，用于类型安全调用 executeBatch */
interface BatchCapableAdapter {
  executeBatch: (ops: BatchOp[]) => Promise<BatchResult>;
}

export const batchWrite: ToolDef<BatchWriteArgs> = {
  name: 'batch_write',
  kind: 'write',
  description: '批量执行多个写操作（单次 sync）。ops 数组最多 20 个；第 i 步失败时前 i-1 步保留、后续停止。',
  parameters: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        maxItems: 20,
        items: {
          type: 'object',
          properties: {
            tool: {
              type: 'string',
              description: '写工具名（当前宿主已注册的 write 工具，不含 batch_write 本身）',
            },
            args: {
              type: 'object',
              description: '工具参数（与直接调用该工具时的参数格式相同）',
            },
          },
          required: ['tool', 'args'],
        },
        description: '要批量执行的写操作列表，最多 20 个',
      },
    },
    required: ['ops'],
  },

  humanLabel: ({ ops }) => `批量改动 ${Array.isArray(ops) ? ops.length : 0} 处`,

  async execute({ ops }, ctx): Promise<ToolResult> {
    // D-06：20 op 上限校验（开 run 之前，不消耗任何 Office 资源）
    if (!Array.isArray(ops) || ops.length === 0) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ARGS',
          message: 'ops 必须为非空数组',
          hint: '请提供至少一个写操作',
          recoverable: false,
        },
      };
    }
    if (ops.length > 20) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ARGS',
          message: `单次批量最多 20 个操作，请拆分后重试（当前 ${ops.length} 个）`,
          hint: '将 ops 拆分为多次 batch_write 调用，每次 ≤20 个',
          recoverable: true,
        },
      };
    }

    // D-05：JS 层快速校验——拒绝嵌套 batch_write（防递归/栈溢出，安全门）
    const nestedBatchIdx = ops.findIndex((op) => op.tool === 'batch_write');
    if (nestedBatchIdx !== -1) {
      return {
        ok: false,
        error: {
          code: 'INVALID_ARGS',
          message: `ops[${nestedBatchIdx}] 不允许嵌套调用 batch_write（防递归）`,
          hint: '请直接列出需要执行的写操作，不要在 batch_write 中嵌套 batch_write',
          recoverable: false,
        },
      };
    }

    // 调用 adapter.executeBatch（A-06：此处不出现 Excel/Word/PowerPoint 命名空间）
    const adapter = ctx.adapter as unknown as BatchCapableAdapter;
    if (typeof adapter.executeBatch !== 'function') {
      return {
        ok: false,
        error: {
          code: 'UNSUPPORTED',
          message: '当前宿主不支持 batch_write',
          hint: '请在 Excel/Word/PPT 宿主中使用 batch_write',
          recoverable: false,
        },
      };
    }

    let batchResult: BatchResult;
    try {
      batchResult = await adapter.executeBatch(ops);
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: 'batch_write 执行失败',
          hint: err instanceof Error ? err.message : '宿主操作失败，请重试',
          recoverable: true,
        },
      };
    }

    const completedSubOps = batchResult.subOps.filter((s) => s.ok);
    const { failAtIndex } = batchResult;

    // D-12：精简汇总（不回显所有写入值）
    const labels = completedSubOps.map((s) => s.humanLabel).join('、');
    const dataPayload: Record<string, unknown> = {
      completed: completedSubOps.length,
      total: ops.length,
      labels: completedSubOps.length <= 5
        ? labels
        : `${completedSubOps.map((s) => s.humanLabel).slice(0, 3).join('、')}…`,
    };
    if (failAtIndex !== undefined) {
      dataPayload.failed = {
        index: failAtIndex,
        tool: ops[failAtIndex]?.tool ?? 'unknown',
        reason: '校验失败或范围不存在',
      };
      dataPayload.notExecuted = ops.length - failAtIndex - 1;
    }

    if (completedSubOps.length === 0) {
      return {
        ok: false,
        error: {
          code: 'HOST_API_FAILED',
          message: failAtIndex !== undefined
            ? `第 ${failAtIndex + 1} 个操作失败（${ops[failAtIndex]?.tool}），无操作被执行`
            : 'batch_write 未完成任何操作',
          hint: '请检查 ops 中各工具的参数是否正确',
          recoverable: true,
        },
        data: dataPayload,
      };
    }

    // 组装 batch entry 的 reverse（reverse.args.ops 是 Record 对象数组，非位置参）
    // D-09：每个 ops entry 携带 postState?，使 operationLog.ts case 'batch_reverse'
    // 能在调用 executeBatchReverse 之前做 per-subOp 手改检测（无论优先路径还是降级路径）
    const reverse: ReverseDescriptor = {
      tool: 'batch_reverse',
      args: {
        // project_adapter_inverse_signature 铁律：每个 subOp.reverse.args 必须是 Record 对象
        ops: completedSubOps.map((s) => ({
          tool: s.reverse.tool,
          args: s.reverse.args,    // Record 对象，由 adapter.executeBatch 保证
          postState: s.postState,  // 携带写后 postState，供 case 'batch_reverse' per-subOp 手改检测（D-09）
        })),
      },
    };

    const postState: PostStateSnapshot = {
      kind: 'batch',
      content: {
        subOps: completedSubOps.map((s) => ({
          humanLabel: s.humanLabel,
          postState: s.postState,
          reverse: s.reverse,
        })),
      },
    };

    // ToolResult.subOps 透传给 loop-helpers appendOperation（Wave 1 已扩展字段）
    const subOps = completedSubOps.map((s) => ({
      humanLabel: s.humanLabel,
      postState: s.postState,
      reverse: s.reverse,
    }));

    const partialOk = failAtIndex !== undefined; // 部分完成
    return {
      ok: !partialOk || completedSubOps.length > 0,
      // W1 修复：部分失败时 ok 仍 true（保留 undo + 让 LLM 从失败步继续），但置
      // partialFailure 让 loop-helpers 通知熔断器走 recordFailure（与 ok / undo 解耦）。
      ...(partialOk ? { partialFailure: true } : {}),
      data: dataPayload,
      reverse,
      postState,
      subOps,
    };
  },
};
