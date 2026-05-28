import { describe, it, expect, beforeEach } from 'vitest';
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
      reverse: { tool: 'delete_last_paragraph', args: {} },
      timestamp: Date.now(),
    });
    appendOperation({
      runId: 'r2',
      stepIndex: 1,
      toolName: 'append_paragraph',
      args: { text: 'hello' },
      humanLabel: '追加段落「hello」',
      reverse: { tool: 'delete_last_paragraph', args: {} },
      timestamp: Date.now(),
    });
    expect(getOperationsByRun('r1')).toHaveLength(1);
    expect(getOperationsByRun('r2')).toHaveLength(1);
    expect(getOperationsByRun('r1')[0].toolName).toBe('append_paragraph');
    expect(getOperationsByRun('nonexistent')).toHaveLength(0);
  });
});
