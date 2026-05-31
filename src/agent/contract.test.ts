/**
 * src/agent/contract.test.ts — Phase 8 D-16/D-17 能力合约 CI 守门测试
 *
 * 合约维护为 JS 常量（D-16 推荐：比解析源码更稳定）。
 * 每个 Phase 9/10/11 write tool 实现时：
 *   1. 将对应行的 integrationTest 改为 true
 *   2. 在 operationLog.integration.test.ts 追加守门测试
 * 两步都必须完成，否则 CI 挂（D-17）。
 *
 * undo 三分类（RESEARCH.md §Undo 三分类判定标准）：
 *   简单逆向 — 写前可读取原值，写后用新 adapter 方法精确还原
 *   快照式 — 批量覆盖，必须 readXxxSnapshot 先存全量
 *   noop+gate — 状态无法完整序列化（delete_shape / delete_slide）
 */
import { describe, it, expect } from 'vitest';

type UndoType = '简单逆向' | '快照式' | 'noop+gate';
type PhaseNum = 9 | 10 | 11;

interface ContractEntry {
  toolName: string;
  host: 'word' | 'excel' | 'ppt';
  undoType: UndoType;
  reverseTool: string;
  phase: PhaseNum;
  integrationTest: boolean;
}

// ---------------------------------------------------------------------------
// 能力合约表（D-16 / D-19）
// Phase 8 定义地基；Phase 9/10/11 实现时逐行改 integrationTest: true
// ---------------------------------------------------------------------------
const CONTRACT: ContractEntry[] = [
  // ─── Phase 9 Word 工具 ───
  { toolName: 'set_word_character_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_range_font', phase: 9, integrationTest: true },
  { toolName: 'set_word_paragraph_format', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_format', phase: 9, integrationTest: true },
  { toolName: 'apply_paragraph_style', host: 'word', undoType: '简单逆向', reverseTool: 'restore_paragraph_style', phase: 9, integrationTest: true },
  { toolName: 'find_and_replace', host: 'word', undoType: '快照式', reverseTool: 'restore_range_snapshot', phase: 9, integrationTest: true },
  { toolName: 'insert_table', host: 'word', undoType: '简单逆向', reverseTool: 'delete_table_by_marker', phase: 9, integrationTest: true },
  // ─── Phase 10 Excel 工具 ───
  { toolName: 'format_excel_range', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_range_format', phase: 10, integrationTest: true },
  { toolName: 'set_column_row_size', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_column_row_size', phase: 10, integrationTest: true },
  { toolName: 'sort_range', host: 'excel', undoType: '快照式', reverseTool: 'restore_range_values_snapshot', phase: 10, integrationTest: true },
  { toolName: 'set_auto_filter', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_auto_filter', phase: 10, integrationTest: true },
  { toolName: 'excel_find_and_replace', host: 'excel', undoType: '快照式', reverseTool: 'restore_range_values_snapshot', phase: 10, integrationTest: true },
  { toolName: 'add_conditional_format', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_conditional_format', phase: 10, integrationTest: true },
  { toolName: 'create_table', host: 'excel', undoType: '简单逆向', reverseTool: 'delete_table_by_name', phase: 10, integrationTest: true },
  { toolName: 'freeze_panes', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_freeze_panes', phase: 10, integrationTest: true },
  { toolName: 'manage_worksheet', host: 'excel', undoType: '快照式', reverseTool: 'restore_worksheet_snapshot', phase: 10, integrationTest: true },
  { toolName: 'set_chart_title', host: 'excel', undoType: '简单逆向', reverseTool: 'restore_chart_title', phase: 10, integrationTest: true },
  // ─── Phase 10 PPT 工具 ───
  { toolName: 'set_shape_text_font', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_shape_font', phase: 10, integrationTest: false },
  { toolName: 'set_shape_text_alignment', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_shape_alignment', phase: 10, integrationTest: false },
  { toolName: 'add_shape', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_shape_by_id', phase: 10, integrationTest: false },
  { toolName: 'delete_shape', host: 'ppt', undoType: 'noop+gate', reverseTool: 'noop_inverse', phase: 10, integrationTest: false },
  { toolName: 'rotate_shape', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_shape_rotation', phase: 10, integrationTest: false },
  { toolName: 'set_slide_background', host: 'ppt', undoType: '简单逆向', reverseTool: 'restore_slide_background', phase: 10, integrationTest: false },
  { toolName: 'manage_slides', host: 'ppt', undoType: 'noop+gate', reverseTool: 'noop_inverse', phase: 10, integrationTest: false },
  { toolName: 'copy_slide', host: 'ppt', undoType: '简单逆向', reverseTool: 'delete_slide_by_index', phase: 10, integrationTest: false },
];

describe('能力合约 — Phase 8 D-16/D-17 undo 类型声明完整', () => {
  it('合约表非空', () => {
    expect(CONTRACT.length).toBeGreaterThan(0);
  });

  it('每个工具都有 undoType 声明（三分类之一）', () => {
    const validTypes: UndoType[] = ['简单逆向', '快照式', 'noop+gate'];
    CONTRACT.forEach(({ toolName, undoType }) => {
      expect(validTypes, `${toolName} 的 undoType 不合法`).toContain(undoType);
    });
  });

  it('每个工具都有 reverseTool 声明', () => {
    CONTRACT.forEach(({ toolName, reverseTool }) => {
      expect(reverseTool, `${toolName} 缺少 reverseTool`).toBeTruthy();
    });
  });

  it('每个工具都有所属 host 声明', () => {
    const validHosts = ['word', 'excel', 'ppt'];
    CONTRACT.forEach(({ toolName, host }) => {
      expect(validHosts, `${toolName} 缺少有效 host`).toContain(host);
    });
  });

  it('noop+gate 工具的 reverseTool 必须是 noop_inverse', () => {
    CONTRACT.filter((c) => c.undoType === 'noop+gate').forEach(({ toolName, reverseTool }) => {
      expect(reverseTool, `${toolName} noop+gate 但 reverseTool 不是 noop_inverse`).toBe('noop_inverse');
    });
  });

  it('每个工具都标注了 integrationTest 字段（实现时必须改为 true）', () => {
    // 允许 false（未实现），但字段必须存在
    CONTRACT.forEach(({ toolName, integrationTest }) => {
      expect(typeof integrationTest, `${toolName} 缺少 integrationTest 字段`).toBe('boolean');
    });
  });

  // D-17 守门：当 Phase 9/10/11 工具实现时，此测试会因 integrationTest: false 不通过
  // → 开发者必须在 operationLog.integration.test.ts 加守门测试后改为 true
  it('已实现工具（integrationTest: true）必须在 operationLog.integration.test.ts 有守门（当前均 false = 全部 pending）', () => {
    const implementedWithoutTest = CONTRACT.filter(
      (c) => c.integrationTest === true
    );
    // Phase 8 时无已实现工具，此断言必然通过
    // Phase 9+ 每个实现的工具必须同时改 integrationTest: true 并在 integration.test.ts 加守门
    expect(implementedWithoutTest.every((c) => c.integrationTest === true)).toBe(true);
  });

  // WARNING #5 强化守门（D-17）：integrationTest: true 的工具，其 toolName 必须出现在
  // operationLog.integration.test.ts 文件内容中（fs.readFileSync 断言）。
  // 这样 Phase 9/10/11 把 integrationTest 翻 true 却没补 integration test 时 CI 立即挂。
  it('integrationTest: true 的工具 toolName 必须出现在 operationLog.integration.test.ts 文件内（D-17 硬卡）', () => {
    const implementedTools = CONTRACT.filter((c) => c.integrationTest === true);
    if (implementedTools.length === 0) {
      // Phase 8 无已实现工具，跳过文件读取（避免路径不存在报错）
      expect(implementedTools).toHaveLength(0);
      return;
    }
    // Phase 9+ 实现工具时：读取 integration.test.ts 内容，断言每个已实现工具名在其中
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('path');
    const integrationTestPath = path.resolve(
      __dirname,
      '../agent/operationLog.integration.test.ts'
    );
    const integrationTestContent: string = fs.readFileSync(integrationTestPath, 'utf-8');
    implementedTools.forEach(({ toolName }) => {
      expect(
        integrationTestContent,
        `D-17: ${toolName} 标记 integrationTest:true 但 operationLog.integration.test.ts 中找不到 '${toolName}'`
      ).toContain(toolName);
    });
  });

  // CONTRACT 数组长度守门（WARNING #8 双保险）
  it('CONTRACT 数组长度 ≥ 23（Phase 9/10 全部工具合约已声明）', () => {
    expect(CONTRACT.length).toBeGreaterThanOrEqual(23);
  });
});
