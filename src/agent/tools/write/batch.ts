/**
 * src/agent/tools/write/batch.ts — Phase 11 Wave 0 接口存根（Wave 2 实现前占位）
 *
 * Wave 0 存根：只声明接口和 ToolDef 骨架，execute 始终返回 UNSUPPORTED。
 * Wave 2 将在此文件实现完整的 batch_write 逻辑（D-01 单闭包 + D-06 上限校验 + D-05 op 类型校验）。
 *
 * 为什么需要存根：npm test = tsc --noEmit && vitest run；import 不存在的文件
 * 会导致 tsc 和 vite 崩溃，无法运行测试。存根让 tsc 通过编译、vitest 运行测试（RED），
 * 而不是让构建崩溃（CRASH）。
 *
 * Nyquist Wave 0 规则：存根允许存在，但 execute 不能假装成功（不能绕过 RED）。
 */
import type { ToolDef, ToolResult } from '../index';

interface BatchOp {
  tool: string;
  args: Record<string, unknown>;
}

interface BatchWriteArgs {
  ops: BatchOp[];
}

/**
 * batch_write — Wave 0 存根（尚未实现，Wave 2 完成）
 *
 * 存根 execute 始终返回 UNSUPPORTED，确保 batch.test.ts 中的断言 FAIL（RED）：
 *   - 空 ops → test expects INVALID_ARGS，存根返回 UNSUPPORTED → FAIL
 *   - ops.length > 20 → test expects INVALID_ARGS + message → FAIL
 *   - 嵌套 batch_write → test expects INVALID_ARGS → FAIL
 * humanLabel / kind 测试可能在 GREEN 状态，因为这些属性是正确的。
 */
export const batchWrite: ToolDef<BatchWriteArgs> = {
  name: 'batch_write',
  kind: 'write',
  description: '在单次 Office run 内批量执行多个写操作（上限 20 个）。Wave 0 存根，Wave 2 实现。',
  parameters: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            tool: { type: 'string', description: '要执行的写工具名称' },
            args: { type: 'object', description: '工具参数' },
          },
          required: ['tool', 'args'],
        },
        description: '批量操作列表，上限 20 个',
      },
    },
    required: ['ops'],
  },
  humanLabel: ({ ops }) => `批量改动 ${ops.length} 处`,
  async execute(_args, _ctx): Promise<ToolResult> {
    // Wave 0 存根：返回 UNSUPPORTED，测试预期 INVALID_ARGS → FAIL（RED 预期）
    // Wave 2 实现：D-06 上限校验 + D-05 op 类型校验 + D-01 单闭包 dispatch
    return {
      ok: false,
      error: {
        code: 'UNSUPPORTED',
        message: 'batch_write 尚未实现（Wave 2 完成）',
        recoverable: false,
        hint: 'Wave 0 存根，不可调用',
      },
    };
  },
};
