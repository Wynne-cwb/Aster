/**
 * src/agent/operationLog.ts — Phase 3 骨架（D-08）
 *
 * Phase 5 才实现真实 reverse() 回放（DiffLogPanel undo all）；Phase 3 只埋 append
 * 接口 + 类型，让 tools/write/* 的 execute() 返回 reverse descriptor 时有归宿。
 *
 * In-memory only（PITFALLS A-11）— 不写 localStorage / sessionStorage。
 */

export interface ReverseDescriptor {
  /** 反操作的 tool name（如 'delete_last_paragraph'） */
  tool: string;
  /** 反操作的参数 */
  args: Record<string, unknown>;
}

export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  timestamp: number;
}

const operationLog: OperationLogEntry[] = [];

export function appendOperation(entry: OperationLogEntry): void {
  operationLog.push(entry);
}

export function getOperationsByRun(runId: string): OperationLogEntry[] {
  return operationLog.filter((o) => o.runId === runId);
}

/** 仅测试用 — 清空 in-memory log。Phase 5 真实实现时考虑用 Map<runId, entries[]> 替代 */
export function __resetOperationLogForTest(): void {
  operationLog.length = 0;
}
