import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appendOperation,
  getOperationsByRun,
  __resetOperationLogForTest,
} from './operationLog';

describe('operationLog skeleton', () => {
  beforeEach(() => {
    __resetOperationLogForTest();
  });

  it('appendOperation push 到 in-mem log + getOperationsByRun 过滤 runId', () => {
    appendOperation({
      runId: 'r1',
      stepIndex: 1,
      toolName: 'append_paragraph',
      args: { text: 'hi' },
      humanLabel: '追加段落「hi」',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'hi' } },
      timestamp: Date.now(),
    });
    appendOperation({
      runId: 'r2',
      stepIndex: 1,
      toolName: 'append_paragraph',
      args: { text: 'hello' },
      humanLabel: '追加段落「hello」',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'hello' } },
      timestamp: Date.now(),
    });
    expect(getOperationsByRun('r1')).toHaveLength(1);
    expect(getOperationsByRun('r2')).toHaveLength(1);
    expect(getOperationsByRun('r1')[0].toolName).toBe('append_paragraph');
    expect(getOperationsByRun('nonexistent')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Wave 1 目标行为 stubs（Phase 5 Plan 01 Wave 0 test-first）
// Wave 1 实现前：getWriteOpsByRun / replayUndoAll 未导出 → 各 it 用 it.todo 占位，
// 编译通过；Wave 1 完成后改为真实 import 并删除 todo 注释。
// ---------------------------------------------------------------------------

describe('Map<runId> 重构（Wave 1 目标行为）', () => {
  beforeEach(() => {
    __resetOperationLogForTest();
    vi.restoreAllMocks();
  });

  it.todo('appendOperation 按 runId 分组存储（Map<runId>）');
  // Wave 1 实现后展开：
  // appendOperation({ runId:'r1', stepIndex:1, toolName:'append_paragraph', ... });
  // appendOperation({ runId:'r1', stepIndex:2, toolName:'append_paragraph', ... });
  // appendOperation({ runId:'r2', stepIndex:1, toolName:'append_paragraph', ... });
  // const r1 = getWriteOpsByRun('r1');
  // expect(r1).toHaveLength(2);
  // expect(getWriteOpsByRun('r2')).toHaveLength(1);

  it.todo('getWriteOpsByRun 只返回 reverse 非空的条目');
  // 非写操作（reverse 为空）不应出现在 undo 队列
  // appendOperation({ ..., reverse: null, ... });
  // appendOperation({ ..., reverse: { tool:'delete_paragraph_by_content', args:{text:'x'} }, ... });
  // expect(getWriteOpsByRun('r1')).toHaveLength(1);

  it.todo('replayUndoAll 逆序遍历（最后写的先撤）');
  // const mockAdapter = { deleteParagraphByContent: vi.fn().mockResolvedValue(undefined) };
  // appendOperation({ runId:'r1', stepIndex:1, reverse:{tool:'delete_paragraph_by_content', args:{text:'A'}}, ... });
  // appendOperation({ runId:'r1', stepIndex:2, reverse:{tool:'delete_paragraph_by_content', args:{text:'B'}}, ... });
  // const results = await replayUndoAll('r1', mockAdapter);
  // expect(results[0].stepIndex).toBe(2); // 最后写的先撤
  // expect(results[1].stepIndex).toBe(1);

  it.todo('replayUndoAll：手动改不一致 → status=skipped_manual');
  // postState 快照（Wave 1 引入）对比当前文档状态不符时应 skip
  // const results = await replayUndoAll('r1', mockAdapter);
  // expect(results[0].status).toBe('skipped_manual');

  it.todo('replayUndoAll：reverse 报错 → status=skipped_error，继续撤剩余（D-11）');
  // mockAdapter.deleteParagraphByContent.mockRejectedValueOnce(new Error('host api error'));
  // const results = await replayUndoAll('r1', mockAdapter);
  // expect(results[0].status).toBe('skipped_error');
  // expect(results[1].status).toBe('ok'); // 继续撤剩余

  it.todo('__resetOperationLogForTest 清除 Map');
  // appendOperation({ runId:'r1', ... });
  // __resetOperationLogForTest();
  // expect(getWriteOpsByRun('r1')).toHaveLength(0);
});
