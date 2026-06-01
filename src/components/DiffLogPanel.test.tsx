/**
 * src/components/DiffLogPanel.test.tsx — Phase 11 Wave 0 Nyquist 测试骨架（BATCH-02 RED）
 *
 * 测试 DiffLogPanel 渲染 batch entry 的 batch 卡 humanLabel 和 subOps 列表。
 * Wave 3 实现 DiffLogPanel batch 渲染分支后，这些测试从 RED 变绿。
 *
 * 当前 DiffLogPanel 不渲染 subOps（Wave 3 待实现），故：
 *   - 「批量改动 3 处」卡头断言 RED（条目的 humanLabel 不被渲染）
 *   - subOps humanLabel 断言 RED（subOps 列表未实现）
 *   - per-subOp 撤销按钮不超 1 个的断言可能 GREEN（当前 DiffLogPanel 只有 1 个整批撤销按钮）
 *
 * OperationLogEntry.subOps 字段在 Wave 1 类型扩展后可用；
 * Wave 0 用 as unknown as OperationLogEntry 绕过 tsc 类型检查。
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdapterContext } from '../context/AdapterContext';
import DiffLogPanel from './DiffLogPanel';
import type { OperationLogEntry } from '../agent/operationLog';
import type { DocumentAdapter } from '../adapters/DocumentAdapter';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro（Trans 直接返回子节点）
// ---------------------------------------------------------------------------

vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({ _: (id: string) => id }),
}));

// ---------------------------------------------------------------------------
// Mock operationLog（getWriteOpsByRun + replayUndoAll + replayUndoSingle）
// ---------------------------------------------------------------------------

vi.mock('../agent/operationLog', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../agent/operationLog')>();
  return {
    ...actual,
    getWriteOpsByRun: vi.fn().mockReturnValue([]),
    replayUndoAll: vi.fn().mockResolvedValue({
      total: 0,
      rolledBack: 0,
      skippedManualChange: 0,
      skippedHostError: 0,
      details: [],
    }),
    replayUndoSingle: vi.fn().mockResolvedValue({
      total: 1,
      rolledBack: 1,
      skippedManualChange: 0,
      skippedHostError: 0,
      details: [],
    }),
  };
});

// ---------------------------------------------------------------------------
// Mock adapter — DocumentAdapter 最小实现
// ---------------------------------------------------------------------------

const mockAdapter: DocumentAdapter = {
  capabilities: () => ({
    host: 'excel' as const,
    supportedInserts: [],
    supportsSelectionEvents: false,
  }),
  getSelection: vi.fn(),
  onSelectionChanged: vi.fn(() => () => {}),
  insert: vi.fn(),
  read: vi.fn(),
};

// ---------------------------------------------------------------------------
// 辅助：构造 batch OperationLogEntry（含 subOps — Wave 1 后类型扩展）
// ---------------------------------------------------------------------------

/** 构造 batch 条目（subOps 字段为 Wave 1 类型扩展，Wave 0 用 as unknown as 绕过）*/
function makeBatchEntry(): OperationLogEntry {
  return {
    runId: 'run-1',
    stepIndex: 0,
    toolName: 'batch_write',
    args: {},
    humanLabel: '批量改动 3 处',
    reverse: {
      tool: 'batch_reverse',
      args: { ops: [] },
    },
    timestamp: Date.now(),
    // subOps 字段在 Wave 1 类型扩展后可用；Wave 0 用 as unknown as 绕过 tsc
    ...({
      subOps: [
        { humanLabel: '写入 A1', reverse: { tool: 'overwrite_range', args: { address: 'A1', values: [[1]] } } },
        { humanLabel: '设置格式 B2', reverse: { tool: 'overwrite_range', args: { address: 'B2', values: [[2]] } } },
        { humanLabel: '写入 C3', reverse: { tool: 'overwrite_range', args: { address: 'C3', values: [[3]] } } },
      ],
    } as unknown as Partial<OperationLogEntry>),
  };
}

/** 构造普通（非 batch）条目——无 subOps */
function makeNonBatchEntry(): OperationLogEntry {
  return {
    runId: 'run-1',
    stepIndex: 0,
    toolName: 'overwrite_range',
    args: {},
    humanLabel: '写入 D4',
    reverse: {
      tool: 'overwrite_range',
      args: { address: 'D4', values: [[0]] },
    },
    timestamp: Date.now(),
  };
}

/** 渲染 DiffLogPanel，并向 mock getWriteOpsByRun 注入条目 */
async function renderWithEntries(entries: OperationLogEntry[]): Promise<void> {
  const { getWriteOpsByRun } = await import('../agent/operationLog');
  (getWriteOpsByRun as ReturnType<typeof vi.fn>).mockReturnValue(entries);

  render(
    <AdapterContext.Provider value={mockAdapter}>
      <DiffLogPanel runId="run-1" />
    </AdapterContext.Provider>
  );
}

/** 渲染 DiffLogPanel（单个 batch 条目） */
async function renderWithBatchEntry(): Promise<void> {
  await renderWithEntries([makeBatchEntry()]);
}

/** 找到 batch 明细折叠 toggle（含「N 项明细」可点提示） */
function getBatchToggle(): HTMLElement {
  return screen.getByRole('button', { name: /项明细/ });
}

describe('DiffLogPanel — batch 卡渲染（BATCH-02 D-10）', () => {
  it('batch entry humanLabel「批量改动 3 处」显示在卡头', async () => {
    await renderWithBatchEntry();
    expect(screen.queryByText('批量改动 3 处')).toBeTruthy();
  });

  it('batch 子操作明细默认折叠——不显示 subOps，但显示「N 项明细」可点提示', async () => {
    await renderWithBatchEntry();

    // ① 默认折叠：subOps humanLabel 不在 DOM
    expect(screen.queryByText('写入 A1')).toBeNull();
    expect(screen.queryByText('设置格式 B2')).toBeNull();
    expect(screen.queryByText('写入 C3')).toBeNull();

    // 折叠态提供明细数量提示（可点 toggle），且 aria-expanded=false
    const toggle = getBatchToggle();
    expect(toggle).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
  });

  it('点击「N 项明细」toggle 后展开，显示 3 个 subOp humanLabel', async () => {
    await renderWithBatchEntry();

    // 展开前不可见
    expect(screen.queryByText('写入 A1')).toBeNull();

    // ② 点击 toggle → 展开
    const toggle = getBatchToggle();
    fireEvent.click(toggle);

    expect(screen.queryByText('写入 A1')).toBeTruthy();
    expect(screen.queryByText('设置格式 B2')).toBeTruthy();
    expect(screen.queryByText('写入 C3')).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    // 再次点击 → 收起
    fireEvent.click(toggle);
    expect(screen.queryByText('写入 A1')).toBeNull();
  });

  it('batch 卡没有 per-subOp 独立撤销按钮（D-10 锁定：batch = 原子 undo 单元）', async () => {
    await renderWithBatchEntry();
    // 展开明细后再断言（确保即便明细可见也无 per-subOp 撤销按钮）
    fireEvent.click(getBatchToggle());

    // subOps 列表里不应有 3 个独立「撤销该步」按钮（只有 1 个整批撤销按钮）
    const undoButtons = screen.queryAllByText('撤销该步');
    expect(undoButtons.length).toBeLessThanOrEqual(1);
  });

  it('③ 非 batch 条目无折叠 toggle，且「撤销该步」行为不回归', async () => {
    await renderWithEntries([makeNonBatchEntry()]);

    // 非 batch 条目的 humanLabel 正常显示
    expect(screen.queryByText('写入 D4')).toBeTruthy();
    // 不出现 batch 明细折叠 toggle
    expect(screen.queryByRole('button', { name: /项明细/ })).toBeNull();
    // 「撤销该步」按钮照常存在（行为不回归）
    expect(screen.queryByText('撤销该步')).toBeTruthy();
  });
});
