/**
 * src/agent/tools/write/batch.test.ts — Phase 11 Wave 0 Nyquist 测试骨架（BATCH-01 RED）
 *
 * 测试 batchWrite.execute 的参数校验逻辑。
 * batchWrite 在 Wave 2 才创建；此处 import 导致 RED（文件不存在时 vitest 报 FAIL，符合预期）。
 * Wave 2 实现 batch.ts 后，这些测试从 RED 变绿。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
// batchWrite 在 Wave 2 才创建；此处 import 导致 RED（文件不存在时 vitest 报 FAIL，符合预期）
import { batchWrite } from './batch';
import { __resetOperationLogForTest } from '../../operationLog';

const mockCtx = {
  adapter: {} as never,
  runId: 'test-run',
  stepIndex: 0,
  signal: new AbortController().signal,
};

afterEach(() => {
  __resetOperationLogForTest();
  vi.restoreAllMocks();
});

describe('batch_write — D-06 上限校验（开 run 之前）', () => {
  it('ops 为空数组 → INVALID_ARGS', async () => {
    const result = await batchWrite.execute({ ops: [] }, mockCtx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
  });

  it('ops.length > 20 → INVALID_ARGS，message 含「单次批量最多 20 个操作」', async () => {
    const ops = Array.from({ length: 21 }, (_, i) => ({
      tool: 'set_range_values',
      args: { address: `A${i + 1}`, values: [[i]] },
    }));
    const result = await batchWrite.execute({ ops }, mockCtx);
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
    expect(result.error?.message).toContain('单次批量最多 20 个操作');
    expect(result.error?.message).toContain('21');
  });
});

describe('batch_write — D-05 op 类型校验', () => {
  it('op.tool === "batch_write"（嵌套）→ INVALID_ARGS', async () => {
    const result = await batchWrite.execute(
      { ops: [{ tool: 'batch_write', args: {} }] },
      mockCtx,
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('INVALID_ARGS');
  });
});

describe('batch_write — W1 部分失败 partialFailure 信号（熔断器解耦）', () => {
  /** 构造带 mock executeBatch 的 ctx */
  function ctxWithBatch(result: unknown) {
    return {
      adapter: {
        executeBatch: vi.fn(async () => result),
      } as never,
      runId: 'test-run',
      stepIndex: 0,
      signal: new AbortController().signal,
    };
  }

  it('部分失败（completedSubOps>0 且 failAtIndex 有值）→ ok 仍 true + partialFailure=true + reverse/subOps 保留（undo 不回归）', async () => {
    const ctx = ctxWithBatch({
      subOps: [
        {
          humanLabel: '写入 A1',
          beforeImage: [[0]],
          reverse: { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [[0]] } },
          postState: { kind: 'excel_range', content: { address: 'Sheet1!A1' } },
          ok: true,
        },
      ],
      failAtIndex: 1, // 第 2 个 op 失败
    });

    const result = await batchWrite.execute(
      {
        ops: [
          { tool: 'set_range_values', args: { address: 'A1', values: [[1]] } },
          { tool: 'set_range_values', args: { address: 'INVALID', values: [[2]] } },
        ],
      },
      ctx,
    );

    // 部分成功：ok 仍 true（让 LLM 从失败步继续、保留 undo），不回退为全失败
    expect(result.ok).toBe(true);
    // W1：partialFailure 信号置位（供 loop-helpers 通知熔断器）
    expect(result.partialFailure).toBe(true);
    // undo 记录不回归：reverse + subOps 仍携带已完成 subOp
    expect(result.reverse).toBeDefined();
    expect(result.subOps).toBeDefined();
    expect(result.subOps?.length).toBe(1);
  });

  it('全部成功（failAtIndex undefined）→ ok true 且 partialFailure 不置位（falsy）', async () => {
    const ctx = ctxWithBatch({
      subOps: [
        {
          humanLabel: '写入 A1',
          reverse: { tool: 'overwrite_range', args: { address: 'Sheet1!A1', values: [[0]] } },
          ok: true,
        },
        {
          humanLabel: '写入 A2',
          reverse: { tool: 'overwrite_range', args: { address: 'Sheet1!A2', values: [[0]] } },
          ok: true,
        },
      ],
      failAtIndex: undefined,
    });

    const result = await batchWrite.execute(
      {
        ops: [
          { tool: 'set_range_values', args: { address: 'A1', values: [[1]] } },
          { tool: 'set_range_values', args: { address: 'A2', values: [[2]] } },
        ],
      },
      ctx,
    );

    expect(result.ok).toBe(true);
    expect(result.partialFailure).toBeFalsy();
  });

  it('全部失败（completedSubOps=0）→ ok false（既有行为不回归）', async () => {
    const ctx = ctxWithBatch({
      subOps: [],
      failAtIndex: 0,
    });

    const result = await batchWrite.execute(
      { ops: [{ tool: 'set_range_values', args: { address: 'INVALID', values: [[1]] } }] },
      ctx,
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('HOST_API_FAILED');
  });
});

describe('batch_write — 属性结构', () => {
  it('batchWrite.kind === "write"', () => {
    expect(batchWrite.kind).toBe('write');
  });

  it('batchWrite.humanLabel 返回「批量改动 N 处」', () => {
    const label = batchWrite.humanLabel({
      ops: [
        { tool: 'set_range_values', args: {} },
        { tool: 'set_range_values', args: {} },
      ],
    });
    expect(label).toContain('批量改动');
    expect(label).toContain('2');
  });
});
