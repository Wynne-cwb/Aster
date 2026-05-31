/**
 * src/agent/operationLog.ts — Phase 5 Wave 1 重构（Map<runId>）
 *
 * Phase 3 骨架改为 Map<runId, OperationLogEntry[]>，新增：
 *   - PostStateSnapshot 接口（供 replayUndoAll 对比手动改 D-11）
 *   - getWriteOpsByRun()：只返回有 reverse 的条目
 *   - replayUndoAll() + UndoResult：逆序 replay，D-11 continue-on-error
 *   - clearRun()：删除指定 runId 记录（可选工具函数）
 *
 * 三个旧导出名（appendOperation / getOperationsByRun / __resetOperationLogForTest）
 * 签名不变——loop-helpers.ts:18 + 测试文件均依赖这些名称。
 *
 * A-06 严禁：本文件不出现 Word/Excel/PowerPoint 全局命名空间。
 * replay 通过 adapter 参数（DocumentAdapterForReplay 接口）调用 inverse 方法。
 *
 * In-memory only（PITFALLS A-11）— 不写 localStorage / sessionStorage。
 */

// ---------------------------------------------------------------------------
// ReverseDescriptor（与 tools/index.ts 同款，但 operationLog 早于 tools 初始化）
// ---------------------------------------------------------------------------

export interface ReverseDescriptor {
  /** 反操作的 tool name（如 'delete_paragraph_by_content'） */
  tool: string;
  /** 反操作的参数 */
  args: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// PostStateSnapshot — write tool 执行后的文档状态快照
// ---------------------------------------------------------------------------

export interface PostStateSnapshot {
  kind:
    | 'word_paragraph' | 'excel_range' | 'excel_chart' | 'ppt_slide' | 'ppt_shape'
    // Phase 9 Wave 0：5 个新 Word write tool postState kind（计划 04-07 实现）
    | 'word_char_format' | 'word_para_format' | 'word_style' | 'word_snapshot' | 'word_table'
    // Phase 10 Wave 0：15 个新 Excel + PPT write tool postState kind（保守路径，readTargetState 不加新 case）
    | 'excel_range_format' | 'excel_snapshot' | 'excel_worksheet' | 'excel_filter'
    | 'excel_conditional_format' | 'excel_table' | 'excel_freeze' | 'excel_chart_title'
    | 'excel_column_row' | 'ppt_shape_font' | 'ppt_shape_alignment' | 'ppt_shape_rotation'
    | 'ppt_slide_background' | 'ppt_shape_new' | 'ppt_slide_copy'
    // Phase 11 新增：batch 整体快照 kind
    | 'batch';
  content: unknown;
}

// ---------------------------------------------------------------------------
// OperationLogEntry
// ---------------------------------------------------------------------------

export interface OperationLogEntry {
  runId: string;
  stepIndex: number;
  toolName: string;
  args: unknown;
  humanLabel: string;
  reverse: ReverseDescriptor;
  /** Phase 5 TOOL-04：write tool 执行后快照，供 replayUndoAll 对比手动改 */
  postState?: PostStateSnapshot;
  timestamp: number;
  /** Phase 11 新增：batch 条目的子操作列表，供 DiffLogPanel 嵌套渲染 + per-subOp 手改防御 */
  subOps?: Array<{
    humanLabel: string;
    postState?: PostStateSnapshot;
    reverse: ReverseDescriptor;
  }>;
}

// ---------------------------------------------------------------------------
// UndoResult — replayUndoAll 返回结构（三态 D-11）
// ---------------------------------------------------------------------------

export type UndoStepStatus = 'rolled_back' | 'skipped_manual' | 'skipped_error';

export interface UndoStepDetail {
  stepIndex: number;
  humanLabel: string;
  status: UndoStepStatus;
  /** skipped_error 时携带的错误信息（不含 stack，只含 message） */
  errorHint?: string;
}

export interface UndoResult {
  total: number;
  rolledBack: number;
  skippedManualChange: number;
  skippedHostError: number;
  details: UndoStepDetail[];
}

// ---------------------------------------------------------------------------
// DocumentAdapterForReplay — replay engine 所需 adapter 方法的最小接口
// Wave 2-3 各 adapter 实现这些方法；Wave 1 只定义接口形状供类型检查
// A-06: 不引用 Word/Excel/PowerPoint 命名空间
// ---------------------------------------------------------------------------

export interface DocumentAdapterForReplay {
  /** Word inverse：按内容精确删除段落（TOOL-04） */
  deleteParagraphByContent?: (args: Record<string, unknown>) => Promise<void>;
  /** Word read：读取目标段落当前内容（供手动改侦测 D-11） */
  readWordParagraph?: (args: Record<string, unknown>) => Promise<string>;
  /** Excel inverse：覆写指定区域 */
  overwriteRange?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel read：读取指定区域当前值 */
  readExcelRange?: (args: Record<string, unknown>) => Promise<unknown[][]>;
  /** PPT inverse：按 title 删除 slide */
  deleteSlideByTitle?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT read：读取指定 slide 当前 title */
  readPptSlideTitle?: (args: Record<string, unknown>) => Promise<string>;
  /** PPT shape inverse：还原形状属性（fill/line/size）*/
  restoreShapeProperty?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT shape inverse：还原形状位置（left/top）*/
  restoreShapeGeometry?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT shape inverse：还原形状文字（TOOL-03 set_shape_text）*/
  restoreShapeText?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：按名称删除刚插入的 chart */
  deleteChartByName?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：按位置 index 还原替换前的段落文本 */
  restoreParagraphAt?: (args: Record<string, unknown>) => Promise<void>;
  // Phase 9 Wave 0：5 个新 inverse 方法（计划 02 加接口声明，04-07 加 adapter 实现）
  /** Word inverse：还原段落字体格式（set_word_character_format） */
  restoreRangeFont?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：还原段落格式（set_word_paragraph_format） */
  restoreParagraphFormat?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：还原段落样式（apply_paragraph_style） */
  restoreParagraphStyle?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：按段落快照还原（find_and_replace） */
  restoreRangeSnapshot?: (args: Record<string, unknown>) => Promise<void>;
  /** Word inverse：按 marker 删除表格（insert_table） */
  deleteTableByMarker?: (args: Record<string, unknown>) => Promise<void>;
  // ─── Phase 10 Excel inverse 方法 ───
  /** Excel inverse：还原单元格格式（format_excel_range → restore_range_format）*/
  restoreRangeFormat?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：还原列宽/行高（set_column_row_size → restore_column_row_size）*/
  restoreColumnRowSize?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse/snapshot：覆写 range values（sort_range / excel_find_and_replace → restore_range_values_snapshot）*/
  restoreRangeValuesSnapshot?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：还原自动筛选（set_auto_filter → restore_auto_filter）*/
  restoreAutoFilter?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：还原条件格式（add_conditional_format → restore_conditional_format）*/
  restoreConditionalFormat?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：按名删除表格（create_table → delete_table_by_name）*/
  deleteTableByName?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：还原冻结窗格（freeze_panes → restore_freeze_panes）*/
  restoreFreezePanes?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse/snapshot：还原工作表元数据（manage_worksheet → restore_worksheet_snapshot）*/
  restoreWorksheetSnapshot?: (args: Record<string, unknown>) => Promise<void>;
  /** Excel inverse：还原图表标题（set_chart_title → restore_chart_title）*/
  restoreChartTitle?: (args: Record<string, unknown>) => Promise<void>;
  // ─── Phase 10 PPT inverse 方法 ───
  /** PPT inverse：还原形状文字字体（set_shape_text_font → restore_shape_font）*/
  restoreShapeFont?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT inverse：还原文字对齐（set_shape_text_alignment → restore_shape_alignment）*/
  restoreShapeAlignment?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT inverse：按 ID 删除形状（add_shape → delete_shape_by_id）*/
  deleteShapeById?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT inverse：还原形状旋转角度（rotate_shape → restore_shape_rotation）*/
  restoreShapeRotation?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT inverse：还原幻灯片背景色（set_slide_background → restore_slide_background）*/
  restoreSlideBackground?: (args: Record<string, unknown>) => Promise<void>;
  /** PPT inverse：按 index+ID 双定位删除复制的幻灯片（copy_slide → delete_slide_by_index）*/
  deleteSlideByIndex?: (args: Record<string, unknown>) => Promise<void>;
  /** Phase 11：batch_reverse 单闭包逆序撤销（D-08 对称设计）。
   *  只传入 surviving subOps（手改过的已在 case 'batch_reverse' 过滤）*/
  executeBatchReverse?: (ops: Array<{ tool: string; args: Record<string, unknown>; postState?: PostStateSnapshot }>) => Promise<void>;
}

// ---------------------------------------------------------------------------
// In-memory store（Map<runId, entries[]>）
// ---------------------------------------------------------------------------

const operationLogMap = new Map<string, OperationLogEntry[]>();

// ---------------------------------------------------------------------------
// Public API — 三个旧导出名签名不变（向后兼容）
// ---------------------------------------------------------------------------

export function appendOperation(entry: OperationLogEntry): void {
  const list = operationLogMap.get(entry.runId) ?? [];
  list.push(entry);
  operationLogMap.set(entry.runId, list);
}

export function getOperationsByRun(runId: string): OperationLogEntry[] {
  return operationLogMap.get(runId) ?? [];
}

/** 仅测试用 — 清空 in-memory Map */
export function __resetOperationLogForTest(): void {
  operationLogMap.clear();
}

// ---------------------------------------------------------------------------
// New exports — Wave 1
// ---------------------------------------------------------------------------

/** 只返回有 reverse 字段（非 nullish）的条目，供 undo 队列使用 */
export function getWriteOpsByRun(runId: string): OperationLogEntry[] {
  const list = operationLogMap.get(runId) ?? [];
  return list.filter((e) => e.reverse != null);
}

/** 删除指定 runId 的所有记录（可选工具函数，供 session 清理使用） */
export function clearRun(runId: string): void {
  operationLogMap.delete(runId);
}

// ---------------------------------------------------------------------------
// Replay engine helpers（A-06: 不出现 Word/Excel/PowerPoint 命名空间）
// ---------------------------------------------------------------------------

/**
 * 读取目标文档位置的当前状态。
 * 若 adapter 未实现对应 read 方法（Wave 2-3 之前），返回 undefined（视为"一致"，保守通过）。
 */
async function readTargetState(
  postState: PostStateSnapshot | undefined,
  adapter: DocumentAdapterForReplay,
): Promise<unknown> {
  if (!postState) return undefined;
  try {
    switch (postState.kind) {
      case 'word_paragraph':
        // Path B 显式 hardening（Phase 11 CR-01，非 bugfix）：
        //   仅当 content 是 string（单工具 Phase 9 路径，postState.content 即段落原文）才做手改检测。
        //   batch subOp 的 content 是对象（{text}/{index,text}/{index,afterText}/{newText}）→ 显式 return undefined
        //   （安全侧 → 不参与手改比对 → undo 照常逆序回滚）。
        // 为何不是 bugfix：对象 content 当前已落安全侧——readTargetState 传 {} 给 readWordParagraph，
        //   其 normalizeText(undefined) 抛 TypeError → readWordParagraph 包成 HostApiError 再抛 → 本函数外层
        //   try/catch 接住 → 返回 undefined。Word 批量 undo 现在就能正常工作（已用真 WordAdapter 探针实测核实，
        //   CR-01 系假阳性）。此处把该安全侧行为**显式化**，消除「未来给 normalizeText 加 null-guard →
        //   readWordParagraph({}) 返回 '' → 对象 content 被 isTargetStateConsistent 判 '[object Object]' 恒不等
        //   → subOp 被误判手改跳过 → Word 批量 undo 静默全挂」的 latent 脆性。
        //   与 ppt_slide(WR-04)/ppt_shape/excel_chart/batch 的显式安全侧一致。
        if (typeof postState.content === 'string' && adapter.readWordParagraph) {
          return await adapter.readWordParagraph({ text: postState.content });
        }
        return undefined;
      case 'excel_range':
        if (adapter.readExcelRange) {
          const address = typeof postState.content === 'object' && postState.content !== null
            ? (postState.content as Record<string, unknown>).address
            : undefined;
          return await adapter.readExcelRange({ address: address as string });
        }
        return undefined;
      case 'ppt_slide': {
        if (adapter.readPptSlideTitle) {
          // WR-04 修复：ppt.ts 的 postState.content 是对象 { index, title }（非 string），
          //   旧代码 typeof === 'string' 恒 false → title 恒为 ''，D-11 手改侦测永远失效。
          //   正确解包 title（兼容 string 与对象两种形态）。
          const content = postState.content as { title?: string } | string;
          const title = typeof content === 'string' ? content : content?.title ?? '';
          return await adapter.readPptSlideTitle({ title });
        }
        return undefined;
      }
      case 'ppt_shape':
        // 形状属性跨步骤读取需要 slide_index + shape_id，当前无专用 read adapter 方法
        // 保守返回 undefined → isTargetStateConsistent 视为「一致」→ 不跳过 undo（安全侧）
        return undefined;
      case 'excel_chart':
        // chart 状态跨步骤读取同理，保守返回 undefined
        return undefined;
      case 'batch':
        // Phase 11：batch 整体不做全局范围读；per-subOp 手改检测在 executeReverse case 'batch_reverse' 内各自处理
        // 返回 undefined 表示「不参与批级整体一致性检查」
        return undefined;
      default:
        return undefined;
    }
  } catch {
    return undefined;
  }
}

/**
 * 比对当前状态与快照是否一致。
 * 规范化规则（D-09/D-10）：
 *   - word_paragraph: string trim + \r\n → \n
 *   - excel_range: 保守不归一（null/0/"" 各自独立）
 *   - ppt_slide: title trim 比对
 * 若 current === undefined（adapter 未实现 read），视为一致（保守通过）。
 */
function isTargetStateConsistent(
  current: unknown,
  postState: PostStateSnapshot,
): boolean {
  // adapter 未实现 read → 返回 undefined → 视为一致（保守通过）
  if (current === undefined) return true;

  switch (postState.kind) {
    case 'word_paragraph': {
      const normalize = (s: unknown): string =>
        typeof s === 'string' ? s.replace(/\r\n/g, '\n').trimEnd() : String(s ?? '');
      return normalize(current) === normalize(postState.content);
    }
    case 'excel_range': {
      // Excel 范围：保守不归一，直接 JSON 比对
      return JSON.stringify(current) === JSON.stringify(postState.content);
    }
    case 'ppt_slide': {
      const trim = (s: unknown): string =>
        typeof s === 'string' ? s.trim() : String(s ?? '');
      return trim(current) === trim(postState.content);
    }
    case 'ppt_shape':
      return true; // 无跨步骤状态读取，保守通过
    case 'excel_chart':
      return true; // 无跨步骤状态读取，保守通过
    case 'batch':
      // Phase 11：batch 整体一致性：返回 true（保守通过）
      // per-subOp 一致性在 executeReverse case 'batch_reverse' 降级路径内逐个判断
      return true;
    default:
      return true;
  }
}

/**
 * 执行单步 reverse 操作。
 * switch on reverse.tool → 调用对应 adapter 方法（A-06: 不出现 Office 命名空间）。
 */
async function executeReverse(
  reverse: ReverseDescriptor,
  adapter: DocumentAdapterForReplay,
): Promise<void> {
  switch (reverse.tool) {
    case 'delete_paragraph_by_content':
      if (!adapter.deleteParagraphByContent) {
        throw new Error(`adapter 未实现 deleteParagraphByContent（tool=${reverse.tool}）`);
      }
      await adapter.deleteParagraphByContent(reverse.args);
      break;
    case 'overwrite_range':
      if (!adapter.overwriteRange) {
        throw new Error(`adapter 未实现 overwriteRange（tool=${reverse.tool}）`);
      }
      await adapter.overwriteRange(reverse.args);
      break;
    case 'delete_slide_by_title':
      if (!adapter.deleteSlideByTitle) {
        throw new Error(`adapter 未实现 deleteSlideByTitle（tool=${reverse.tool}）`);
      }
      await adapter.deleteSlideByTitle(reverse.args);
      break;
    case 'restore_shape_property':
      if (!adapter.restoreShapeProperty) {
        throw new Error(`adapter 未实现 restoreShapeProperty（tool=${reverse.tool}）`);
      }
      await adapter.restoreShapeProperty(reverse.args);
      break;
    case 'restore_shape_geometry':
      if (!adapter.restoreShapeGeometry) {
        throw new Error(`adapter 未实现 restoreShapeGeometry（tool=${reverse.tool}）`);
      }
      await adapter.restoreShapeGeometry(reverse.args);
      break;
    case 'restore_shape_text':
      if (!adapter.restoreShapeText) {
        throw new Error(`adapter 未实现 restoreShapeText（tool=${reverse.tool}）`);
      }
      await adapter.restoreShapeText(reverse.args);
      break;
    case 'delete_chart_by_name':
      if (!adapter.deleteChartByName) {
        throw new Error(`adapter 未实现 deleteChartByName（tool=${reverse.tool}）`);
      }
      await adapter.deleteChartByName(reverse.args);
      break;
    case 'restore_paragraph_at':
      if (!adapter.restoreParagraphAt) {
        throw new Error(`adapter 未实现 restoreParagraphAt（tool=${reverse.tool}）`);
      }
      await adapter.restoreParagraphAt(reverse.args);
      break;
    // Phase 9 Wave 0：5 个新 case（adapter 方法计划 04-07 实现；Wave 0 会抛"adapter 未实现" → skipped_error，这是预期的 RED 状态）
    case 'restore_range_font':
      if (!adapter.restoreRangeFont) {
        throw new Error(`adapter 未实现 restoreRangeFont（tool=${reverse.tool}）`);
      }
      await adapter.restoreRangeFont(reverse.args);
      break;
    case 'restore_paragraph_format':
      if (!adapter.restoreParagraphFormat) {
        throw new Error(`adapter 未实现 restoreParagraphFormat（tool=${reverse.tool}）`);
      }
      await adapter.restoreParagraphFormat(reverse.args);
      break;
    case 'restore_paragraph_style':
      if (!adapter.restoreParagraphStyle) {
        throw new Error(`adapter 未实现 restoreParagraphStyle（tool=${reverse.tool}）`);
      }
      await adapter.restoreParagraphStyle(reverse.args);
      break;
    case 'restore_range_snapshot':
      if (!adapter.restoreRangeSnapshot) {
        throw new Error(`adapter 未实现 restoreRangeSnapshot（tool=${reverse.tool}）`);
      }
      await adapter.restoreRangeSnapshot(reverse.args);
      break;
    case 'delete_table_by_marker':
      if (!adapter.deleteTableByMarker) {
        throw new Error(`adapter 未实现 deleteTableByMarker（tool=${reverse.tool}）`);
      }
      await adapter.deleteTableByMarker(reverse.args);
      break;
    // Phase 10 Wave 0：15 个新 case（adapter 方法计划 Wave 1-4 实现；Wave 0 会抛"adapter 未实现" → skipped_error，这是预期的 RED 状态）
    case 'restore_range_format':
      if (!adapter.restoreRangeFormat) throw new Error(`adapter 未实现 restoreRangeFormat（tool=${reverse.tool}）`);
      await adapter.restoreRangeFormat(reverse.args);
      break;
    case 'restore_column_row_size':
      if (!adapter.restoreColumnRowSize) throw new Error(`adapter 未实现 restoreColumnRowSize（tool=${reverse.tool}）`);
      await adapter.restoreColumnRowSize(reverse.args);
      break;
    case 'restore_range_values_snapshot':
      if (!adapter.restoreRangeValuesSnapshot) throw new Error(`adapter 未实现 restoreRangeValuesSnapshot（tool=${reverse.tool}）`);
      await adapter.restoreRangeValuesSnapshot(reverse.args);
      break;
    case 'restore_auto_filter':
      if (!adapter.restoreAutoFilter) throw new Error(`adapter 未实现 restoreAutoFilter（tool=${reverse.tool}）`);
      await adapter.restoreAutoFilter(reverse.args);
      break;
    case 'restore_conditional_format':
      if (!adapter.restoreConditionalFormat) throw new Error(`adapter 未实现 restoreConditionalFormat（tool=${reverse.tool}）`);
      await adapter.restoreConditionalFormat(reverse.args);
      break;
    case 'delete_table_by_name':
      if (!adapter.deleteTableByName) throw new Error(`adapter 未实现 deleteTableByName（tool=${reverse.tool}）`);
      await adapter.deleteTableByName(reverse.args);
      break;
    case 'restore_freeze_panes':
      if (!adapter.restoreFreezePanes) throw new Error(`adapter 未实现 restoreFreezePanes（tool=${reverse.tool}）`);
      await adapter.restoreFreezePanes(reverse.args);
      break;
    case 'restore_worksheet_snapshot':
      if (!adapter.restoreWorksheetSnapshot) throw new Error(`adapter 未实现 restoreWorksheetSnapshot（tool=${reverse.tool}）`);
      await adapter.restoreWorksheetSnapshot(reverse.args);
      break;
    case 'restore_chart_title':
      if (!adapter.restoreChartTitle) throw new Error(`adapter 未实现 restoreChartTitle（tool=${reverse.tool}）`);
      await adapter.restoreChartTitle(reverse.args);
      break;
    case 'restore_shape_font':
      if (!adapter.restoreShapeFont) throw new Error(`adapter 未实现 restoreShapeFont（tool=${reverse.tool}）`);
      await adapter.restoreShapeFont(reverse.args);
      break;
    case 'restore_shape_alignment':
      if (!adapter.restoreShapeAlignment) throw new Error(`adapter 未实现 restoreShapeAlignment（tool=${reverse.tool}）`);
      await adapter.restoreShapeAlignment(reverse.args);
      break;
    case 'delete_shape_by_id':
      if (!adapter.deleteShapeById) throw new Error(`adapter 未实现 deleteShapeById（tool=${reverse.tool}）`);
      await adapter.deleteShapeById(reverse.args);
      break;
    case 'restore_shape_rotation':
      if (!adapter.restoreShapeRotation) throw new Error(`adapter 未实现 restoreShapeRotation（tool=${reverse.tool}）`);
      await adapter.restoreShapeRotation(reverse.args);
      break;
    case 'restore_slide_background':
      if (!adapter.restoreSlideBackground) throw new Error(`adapter 未实现 restoreSlideBackground（tool=${reverse.tool}）`);
      await adapter.restoreSlideBackground(reverse.args);
      break;
    case 'delete_slide_by_index':
      if (!adapter.deleteSlideByIndex) throw new Error(`adapter 未实现 deleteSlideByIndex（tool=${reverse.tool}）`);
      await adapter.deleteSlideByIndex(reverse.args);
      break;
    case 'batch_reverse': {
      // Phase 11 D-07/D-08/D-09：batch 整体逆序撤销（per-subOp 手改防御）
      // reverse.args.ops 是 Array<{tool, args, postState?}>（D-09：每个 entry 携带 postState 供手改检测）
      const ops = reverse.args.ops as Array<{ tool: string; args: Record<string, unknown>; postState?: PostStateSnapshot }>;
      const reversedOps = [...ops].reverse(); // 逆序：最后写的先撤（D-07/SC#3）

      // D-09 per-subOp 手改检测（在两条路径前统一运行）
      // 逐个检查每个 subOp 的 postState 是否与当前文档状态一致
      let rolledBack = 0;
      let skippedManual = 0;
      let skippedError = 0;

      const survivingOps: typeof reversedOps = [];

      for (const subOp of reversedOps) {
        if (subOp.postState) {
          try {
            const currentState = await readTargetState(subOp.postState, adapter);
            if (currentState !== undefined && !isTargetStateConsistent(currentState, subOp.postState)) {
              // 手改过：跳过此 subOp（D-09 per-subOp 手改防御）
              skippedManual++;
              continue;
            }
          } catch {
            // 读取状态失败：保守跳过（避免覆盖手动编辑）
            skippedManual++;
            continue;
          }
        }
        survivingOps.push(subOp);
      }

      // 优先路径：executeBatchReverse 单闭包（D-08 对称设计）——只传入 surviving subOps
      if ('executeBatchReverse' in adapter &&
          typeof (adapter as Record<string, unknown>).executeBatchReverse === 'function') {
        try {
          // 单闭包逆序撤销 surviving subOps（手改的已过滤）
          await (adapter as { executeBatchReverse: (ops: typeof survivingOps) => Promise<void> }).executeBatchReverse(survivingOps);
          rolledBack += survivingOps.length;
        } catch {
          skippedError += survivingOps.length;
        }
      } else {
        // 降级路径：逐个 executeReverse surviving subOps（continue-on-error，D-09）
        for (const subOp of survivingOps) {
          try {
            await executeReverse({ tool: subOp.tool, args: subOp.args }, adapter);
            rolledBack++;
          } catch {
            skippedError++;
          }
        }
      }

      // 聚合三态结果附加到 reverse.args 供 SummaryModal 显示
      if (skippedManual > 0 || skippedError > 0) {
        Object.assign(reverse.args, {
          _batchUndoResult: { rolledBack, skippedManual, skippedError },
        });
      }

      break;
    }
    case 'noop_inverse':
      // 已知不可撤销操作（CR-04：replace_selection 用此 case 诚实标注「无法自动撤销」）。
      // throw → replayUndoStep.catch → skipped_error → DiffLog 显示「此步无法自动撤销」
      throw new Error(`noop_inverse: 此操作不支持自动回滚（${String(reverse.args.reason ?? '')}）`);
    default:
      throw new Error(`未知 reverse tool: ${reverse.tool}`);
  }
}

/**
 * 执行单步 undo（private helper）。
 * D-11: try/catch 不 rethrow — 报错标 skipped_error，继续撤剩余。
 */
async function replayUndoStep(
  entry: OperationLogEntry,
  adapter: DocumentAdapterForReplay,
): Promise<UndoStepDetail> {
  try {
    const current = await readTargetState(entry.postState, adapter);
    if (entry.postState !== undefined) {
      const consistent = isTargetStateConsistent(current, entry.postState);
      if (!consistent) {
        return { stepIndex: entry.stepIndex, humanLabel: entry.humanLabel, status: 'skipped_manual' };
      }
    }
    await executeReverse(entry.reverse, adapter);
    return { stepIndex: entry.stepIndex, humanLabel: entry.humanLabel, status: 'rolled_back' };
  } catch (err) {
    const errorHint = err instanceof Error ? err.message : '未知错误';
    return { stepIndex: entry.stepIndex, humanLabel: entry.humanLabel, status: 'skipped_error', errorHint };
  }
}

/**
 * 对单条 OperationLogEntry 执行撤销（任意顺序单步 undo，D-05）。
 * 内部复用 replayUndoStep 逻辑（postState 对比 + executeReverse + 三态）。
 */
export async function replayUndoSingle(
  entry: OperationLogEntry,
  adapter: DocumentAdapterForReplay,
): Promise<UndoStepDetail> {
  return replayUndoStep(entry, adapter);
}

/**
 * 逆序撤销 runId 下所有写操作。
 * D-11: continue-on-error — 单步失败不中断，继续撤剩余。
 *
 * @param runId - 要撤销的 agent run 标识
 * @param adapter - 实现了 DocumentAdapterForReplay 接口的 adapter
 * @returns UndoResult 三态统计
 */
export async function replayUndoAll(
  runId: string,
  adapter: DocumentAdapterForReplay,
): Promise<UndoResult> {
  const writeOps = getWriteOpsByRun(runId);
  const reversed = [...writeOps].reverse(); // 逆序：最后写的先撤

  const details: UndoStepDetail[] = [];
  let rolledBack = 0;
  let skippedManualChange = 0;
  let skippedHostError = 0;

  for (const entry of reversed) {
    const detail = await replayUndoStep(entry, adapter); // D-11: 内部 try/catch，不 rethrow
    details.push(detail);
    if (detail.status === 'rolled_back') rolledBack++;
    else if (detail.status === 'skipped_manual') skippedManualChange++;
    else if (detail.status === 'skipped_error') skippedHostError++;
  }

  return {
    total: writeOps.length,
    rolledBack,
    skippedManualChange,
    skippedHostError,
    details,
  };
}
