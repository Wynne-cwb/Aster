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
