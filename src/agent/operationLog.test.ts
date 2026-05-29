import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  appendOperation,
  getOperationsByRun,
  getWriteOpsByRun,
  replayUndoAll,
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
// Wave 1 目标行为（Phase 5 Plan 02）
// ---------------------------------------------------------------------------

describe('Map<runId> 重构（Wave 1 目标行为）', () => {
  beforeEach(() => {
    __resetOperationLogForTest();
    vi.restoreAllMocks();
  });

  it('appendOperation 按 runId 分组存储（Map<runId>）', () => {
    appendOperation({ runId: 'r1', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '步骤1', reverse: { tool: 'delete_paragraph_by_content', args: { text: 'A' } }, timestamp: Date.now() });
    appendOperation({ runId: 'r1', stepIndex: 2, toolName: 'append_paragraph', args: {}, humanLabel: '步骤2', reverse: { tool: 'delete_paragraph_by_content', args: { text: 'B' } }, timestamp: Date.now() });
    appendOperation({ runId: 'r2', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '步骤1', reverse: { tool: 'delete_paragraph_by_content', args: { text: 'C' } }, timestamp: Date.now() });
    expect(getWriteOpsByRun('r1')).toHaveLength(2);
    expect(getWriteOpsByRun('r2')).toHaveLength(1);
    expect(getOperationsByRun('r1')).toHaveLength(2);
  });

  it('getWriteOpsByRun 只返回 reverse 非空的条目', () => {
    // 无 reverse 的操作（read tool）
    appendOperation({ runId: 'r1', stepIndex: 1, toolName: 'get_document_full_text', args: {}, humanLabel: '读取全文', reverse: undefined as never, timestamp: Date.now() });
    // 有 reverse 的写操作
    appendOperation({ runId: 'r1', stepIndex: 2, toolName: 'append_paragraph', args: {}, humanLabel: '追加段落「x」', reverse: { tool: 'delete_paragraph_by_content', args: { text: 'x' } }, timestamp: Date.now() });
    expect(getWriteOpsByRun('r1')).toHaveLength(1);
    expect(getWriteOpsByRun('r1')[0].toolName).toBe('append_paragraph');
  });

  it('replayUndoAll 逆序遍历（最后写的先撤）', async () => {
    const mockAdapter = {
      deleteParagraphByContent: vi.fn().mockResolvedValue(undefined),
    };
    appendOperation({
      runId: 'r1', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '追加段落「A」',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'A' } },
      postState: { kind: 'word_paragraph', content: 'A' },
      timestamp: Date.now(),
    });
    appendOperation({
      runId: 'r1', stepIndex: 2, toolName: 'append_paragraph', args: {}, humanLabel: '追加段落「B」',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'B' } },
      postState: { kind: 'word_paragraph', content: 'B' },
      timestamp: Date.now(),
    });
    const result = await replayUndoAll('r1', mockAdapter as never);
    expect(result.details[0].stepIndex).toBe(2); // 最后写的先撤
    expect(result.details[1].stepIndex).toBe(1);
    expect(result.rolledBack).toBe(2);
  });

  it('replayUndoAll：手动改不一致 → status=skipped_manual', async () => {
    const mockAdapter = {
      deleteParagraphByContent: vi.fn().mockResolvedValue(undefined),
      readWordParagraph: vi.fn().mockResolvedValue('MODIFIED'),
    };
    appendOperation({
      runId: 'r1', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '追加段落「A」',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'A' } },
      postState: { kind: 'word_paragraph', content: 'A' }, // 快照内容
      timestamp: Date.now(),
    });
    const result = await replayUndoAll('r1', mockAdapter as never);
    expect(result.details[0].status).toBe('skipped_manual');
    expect(result.skippedManualChange).toBe(1);
  });

  it('replayUndoAll：reverse 报错 → status=skipped_error，继续撤剩余（D-11）', async () => {
    const mockAdapter = {
      deleteParagraphByContent: vi.fn()
        .mockRejectedValueOnce(new Error('host api error'))
        .mockResolvedValue(undefined),
    };
    appendOperation({
      runId: 'r1', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '步骤1',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'A' } },
      postState: { kind: 'word_paragraph', content: 'A' },
      timestamp: Date.now(),
    });
    appendOperation({
      runId: 'r1', stepIndex: 2, toolName: 'append_paragraph', args: {}, humanLabel: '步骤2',
      reverse: { tool: 'delete_paragraph_by_content', args: { text: 'B' } },
      postState: { kind: 'word_paragraph', content: 'B' },
      timestamp: Date.now(),
    });
    const result = await replayUndoAll('r1', mockAdapter as never);
    // 逆序：step2先撤（成功），step1后撤（报错）
    const step2detail = result.details.find(d => d.stepIndex === 2)!;
    const step1detail = result.details.find(d => d.stepIndex === 1)!;
    expect(step2detail.status).toBe('rolled_back');
    expect(step1detail.status).toBe('skipped_error');
    expect(result.skippedHostError).toBe(1);
    expect(result.rolledBack).toBe(1);
  });

  it('__resetOperationLogForTest 清除 Map', () => {
    appendOperation({ runId: 'r1', stepIndex: 1, toolName: 'append_paragraph', args: {}, humanLabel: '步骤1', reverse: { tool: 'delete_paragraph_by_content', args: { text: 'A' } }, timestamp: Date.now() });
    __resetOperationLogForTest();
    expect(getWriteOpsByRun('r1')).toHaveLength(0);
    expect(getOperationsByRun('r1')).toHaveLength(0);
  });
});
