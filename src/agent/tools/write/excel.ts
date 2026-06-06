/**
 * src/agent/tools/write/excel.ts — Excel 宿主 write tools（Phase 5 Plan 07 / TOOL-03 / AGENT-08）
 *
 * Phase 5 PoC：set_range_values（向指定区域写入二维数值数组）。
 * Phase 6 升级为更多写入类型（formula、chart 等）。
 *
 * 边界约束（A-06 / D-15）：
 *   - execute 输入纯数据，不接触 Office.js proxy 对象
 *   - adapter.setRangeValues 内部 Excel.run 闭包负责所有 proxy 生命周期
 *   - reverse descriptor 仅字面量，由 OperationLog 真实回放消费
 *
 * D-05/D-06 reverse 精确定位（before-image 策略）：
 *   - setRangeValues 返回 { beforeImage: { address, values } }
 *   - reverse.args 直接使用 beforeImage.address（Excel server 端规范化地址）
 *   - 不依赖写入时传入的 address（server 端可能规范化为含 sheet 名前缀）
 *
 * TOOL-04 postState：
 *   - { kind: 'excel_range', content: { address, values } }（写入后状态，非 before-image）
 *   - 供 replayUndoAll 对比手动改（D-11 防御）
 */
import type { ToolDef, ToolResult } from '../index';
import type { ReverseDescriptor, PostStateSnapshot } from '../../operationLog';
import type { ExcelAdapter } from '../../../adapters/ExcelAdapter';

interface SetRangeValuesArgs {
  address: string;
  values: unknown[][];
}

interface ApplyFormulaArgs {
  cell: string;
  formula: string;
}

interface InsertChartArgs {
  data_range: string;
  chart_type?: string;
}

interface SetCellArgs {
  cell: string;
  value: string | number;
}

export const setRangeValues: ToolDef<SetRangeValuesArgs> = {
  name: 'set_range_values',
  kind: 'write',
  description: '向 Excel 指定区域写入二维数组。自动抓取写前快照支持撤销。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: 'Range 地址，如 "A1:B3"' },
      values: {
        type: 'array',
        items: { type: 'array', items: {} },
        description: '二维数组，维度须与 address 匹配',
      },
    },
    required: ['address', 'values'],
  },
  humanLabel: ({ address }) => `写入单元格区域 ${address}`,
  async execute({ address, values }, ctx): Promise<ToolResult> {
    // A-06：通过 ctx.adapter 调用，不直接引用 Excel 命名空间
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).setRangeValues(address, values);
    // D-05 / TOOL-04：reverse 使用 before-image 精确定位（含 server 端规范化地址）
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values },
    };
    // TOOL-04 postState 快照：记录写入后状态（供 replayUndoAll 对比手动改 D-11）
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { address, values },
    };
    return { ok: true, data: { address, rowsWritten: values.length }, reverse, postState };
  },
};

export const applyFormula: ToolDef<ApplyFormulaArgs> = {
  name: 'apply_formula',
  kind: 'write',
  description: '在 Excel 指定单元格写入公式。cell 为单元格地址（如 "B2"），formula 为公式字符串（如 "=SUM(A2:A10)"）。',
  parameters: {
    type: 'object',
    properties: {
      cell: { type: 'string', description: '单元格地址，如 "B2"' },
      formula: { type: 'string', description: '公式字符串，如 "=SUM(A2:A10)"' },
    },
    required: ['cell', 'formula'],
  },
  humanLabel: ({ cell, formula }) => `在 ${cell} 单元格写入公式 ${formula}`,
  async execute({ cell, formula }, ctx): Promise<ToolResult> {
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).applyFormula(cell, formula);
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { cell, formula },
    };
    return { ok: true, data: { cell, formula }, reverse, postState };
  },
};

export const insertChart: ToolDef<InsertChartArgs> = {
  name: 'insert_chart',
  kind: 'write',
  description: '在当前工作表插入图表。data_range 为数据范围地址（如 "A1:B10"），chart_type 为图表类型（ColumnClustered / Bar / Line / Pie）。',
  parameters: {
    type: 'object',
    properties: {
      data_range: { type: 'string', description: '图表数据 range 地址，如 "A1:B10"' },
      chart_type: {
        type: 'string',
        description: '图表类型：ColumnClustered（默认）/ Bar / Line / Pie',
        enum: ['ColumnClustered', 'Bar', 'Line', 'Pie'],
      },
    },
    required: ['data_range'],
  },
  humanLabel: ({ data_range, chart_type }) =>
    `在当前工作表插入${chart_type === 'Bar' ? '条形图' : chart_type === 'Line' ? '折线图' : chart_type === 'Pie' ? '饼图' : '柱状图'}（数据 ${data_range}）`,
  async execute({ data_range, chart_type }, ctx): Promise<ToolResult> {
    const { chartName } = await (ctx.adapter as ExcelAdapter).insertChart(
      data_range,
      chart_type ?? 'ColumnClustered',
    );
    const reverse: ReverseDescriptor = {
      tool: 'delete_chart_by_name',
      args: { chartName },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_chart',
      content: { chartName, dataRange: data_range, chartType: chart_type },
    };
    return { ok: true, data: { chartName }, reverse, postState };
  },
};

export const setCell: ToolDef<SetCellArgs> = {
  name: 'set_cell',
  kind: 'write',
  description: '在 Excel 指定单元格写入值。cell 为单元格地址，value 为写入的值（字符串或数字）。',
  parameters: {
    type: 'object',
    properties: {
      cell: { type: 'string', description: '单元格地址，如 "A1"' },
      value: { type: ['string', 'number'], description: '要写入的值' },
    },
    required: ['cell', 'value'],
  },
  humanLabel: ({ cell, value }) => `将单元格 ${cell} 设为 ${String(value).slice(0, 20)}`,
  async execute({ cell, value }, ctx): Promise<ToolResult> {
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).setCell(cell, value);
    const reverse: ReverseDescriptor = {
      tool: 'overwrite_range',
      args: { address: beforeImage.address, values: beforeImage.values },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_range',
      content: { cell, value },
    };
    return { ok: true, data: { cell, value }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 1a：6 个 Excel ToolDef（EXCEL-01/02/04/06/07/08）
// ---------------------------------------------------------------------------

/** EXCEL-01 format_excel_range */
export const formatExcelRangeTool: ToolDef = {
  name: 'format_excel_range',
  kind: 'write',
  description: '设置单元格格式：数字格式/字体/填充色/对齐方式',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '单元格区域如 A1:D10' },
      numberFormat: { type: 'string', description: '数字格式字符串，如 #,##0.00' },
      fill: {
        type: 'object',
        properties: { color: { type: 'string', description: '填充色 hex，如 #FFFF00' } },
      },
      font: {
        type: 'object',
        properties: {
          bold: { type: 'boolean' },
          color: { type: 'string' },
          size: { type: 'number' },
          name: { type: 'string' },
        },
      },
      alignment: {
        type: 'string',
        enum: ['Left', 'Center', 'Right', 'General'],
        description: '水平对齐方式',
      },
    },
    required: ['address'],
  },
  humanLabel: (args: unknown) => {
    const { address, numberFormat } = args as { address: string; numberFormat?: string };
    return `设置 ${address} 格式${numberFormat ? `（数字格式 ${numberFormat}）` : ''}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, numberFormat, fill, font, alignment } = args as Record<string, unknown>;
    const { beforeImage } = await (ctx.adapter as ExcelAdapter).formatExcelRange(
      address as string,
      {
        numberFormat: numberFormat as string | undefined,
        fill: fill as { color?: string } | undefined,
        font: font as Record<string, unknown> | undefined,
        alignment: alignment as string | undefined,
      },
    );
    const reverse: ReverseDescriptor = { tool: 'restore_range_format', args: { ...beforeImage } };
    const postState: PostStateSnapshot = {
      kind: 'excel_range_format',
      content: { address: address as string },
    };
    return { ok: true, data: { address }, reverse, postState };
  },
};

/** EXCEL-02 set_column_row_size */
export const setColumnRowSizeTool: ToolDef = {
  name: 'set_column_row_size',
  kind: 'write',
  description: '设置列宽或行高，支持指定像素或 autoFit 自动适配',
  parameters: {
    type: 'object',
    properties: {
      target: { type: 'string', enum: ['column', 'row'], description: '操作对象：column 或 row' },
      indices: {
        type: 'array',
        items: { type: 'number' },
        description: '0-based 列/行索引数组，如 [0] = 第 1 列',
      },
      size: {
        description: '目标尺寸（点数）或 "autoFit" 自动适配',
      },
    },
    required: ['target', 'indices', 'size'],
  },
  humanLabel: (args: unknown) => {
    const { target, indices, size } = args as { target: string; indices: number[]; size: unknown };
    return `设置${target === 'column' ? '列' : '行'} ${(indices ?? []).join(',')} ${size === 'autoFit' ? '自动适配' : `宽/高 ${String(size)}`}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { target, indices, size } = args as {
      target: 'column' | 'row';
      indices: number[];
      size: number | 'autoFit';
    };
    const { beforeSizes } = await (ctx.adapter as ExcelAdapter).setColumnRowSize(
      target, indices, size,
    );
    const reverse: ReverseDescriptor = {
      tool: 'restore_column_row_size',
      args: { target, beforeSizes },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_column_row',
      content: { target, indices },
    };
    return { ok: true, data: { target, indices, size }, reverse, postState };
  },
};

/** EXCEL-04 set_auto_filter */
export const setAutoFilterTool: ToolDef = {
  name: 'set_auto_filter',
  kind: 'write',
  description: '为指定区域应用或清除自动筛选框。undo 后仅恢复筛选框，不恢复筛选条件。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '筛选范围，如 A1:E1' },
      enabled: { type: 'boolean', description: 'true = 应用筛选；false = 清除筛选' },
    },
    required: ['address', 'enabled'],
  },
  humanLabel: (args: unknown) => {
    const { address, enabled } = args as { address: string; enabled: boolean };
    return `${enabled ? '启用' : '清除'} ${address} 自动筛选`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, enabled } = args as { address: string; enabled: boolean };
    const { hadFilter, address: filterAddress } = await (ctx.adapter as ExcelAdapter).setAutoFilter(
      address, enabled,
    );
    const reverse: ReverseDescriptor = {
      tool: 'restore_auto_filter',
      args: { hadFilter, address: filterAddress },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_filter',
      content: { address },
    };
    return { ok: true, data: { address, enabled }, reverse, postState };
  },
};

/** EXCEL-06 add_conditional_format */
export const addConditionalFormatTool: ToolDef = {
  name: 'add_conditional_format',
  kind: 'write',
  description: '添加条件格式（高亮/色阶/数据条）。MVP 仅支持 cellValue/colorScale/dataBar。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '目标区域，如 B2:B20' },
      rule: {
        type: 'object',
        description: '条件格式规则，含 type(cellValue/colorScale/dataBar), operator?, value?, format?',
        properties: {
          type: { type: 'string', enum: ['cellValue', 'colorScale', 'dataBar'] },
          operator: { type: 'string', description: '如 greaterThan / lessThan / between' },
          value: { description: '比较值' },
          format: {
            type: 'object',
            properties: {
              fillColor: { type: 'string' },
              fontColor: { type: 'string' },
            },
          },
        },
        required: ['type'],
      },
    },
    required: ['address', 'rule'],
  },
  humanLabel: (args: unknown) => {
    const { address, rule } = args as { address: string; rule: Record<string, unknown> };
    return `对 ${address} 添加条件格式（${String(rule?.type ?? '')}）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, rule } = args as { address: string; rule: Record<string, unknown> };
    const { beforeFormats } = await (ctx.adapter as ExcelAdapter).addConditionalFormat(
      address, rule,
    );
    const reverse: ReverseDescriptor = {
      tool: 'restore_conditional_format',
      args: { address, beforeFormats },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_conditional_format',
      content: { address },
    };
    return { ok: true, data: { address }, reverse, postState };
  },
};

/** EXCEL-07 create_table */
export const createTableTool: ToolDef = {
  name: 'create_table',
  kind: 'write',
  description: '将指定区域转换为 Excel 表格，支持自定义表格名',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '表格区域，如 A1:D5' },
      hasHeaders: { type: 'boolean', description: '首行是否为表头（默认 false）' },
      tableName: { type: 'string', description: '期望的表格名（可选，Excel 可能加序号）' },
    },
    required: ['address'],
  },
  humanLabel: (args: unknown) => {
    const { address, tableName } = args as { address: string; tableName?: string };
    return `将 ${address} 建为表格${tableName ? `「${tableName}」` : ''}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, hasHeaders, tableName } = args as {
      address: string;
      hasHeaders?: boolean;
      tableName?: string;
    };
    const { resolvedName } = await (ctx.adapter as ExcelAdapter).createTable(
      address, hasHeaders ?? false, tableName,
    );
    // T-10-07：用 server 端 load 后的 resolvedName，不用用户传入的 tableName
    const reverse: ReverseDescriptor = {
      tool: 'delete_table_by_name',
      args: { tableName: resolvedName },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_table',
      content: { tableName: resolvedName },
    };
    return { ok: true, data: { tableName: resolvedName }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 10 Wave 2：4 个 Excel ToolDef（EXCEL-03/05/09/10）
// ---------------------------------------------------------------------------

/** EXCEL-03 sort_range（快照式 undo — 排序前快照 range 值，sort.apply 后可还原） */
export const sortRangeTool: ToolDef = {
  name: 'sort_range',
  kind: 'write',
  description:
    '对指定 range 按给定列排序（升序/降序）。' +
    '注意：此操作会清空 Excel 自带撤销历史（API 限制）；超过 10,000 单元格时将无法自动撤销。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '排序范围，如 A1:E500' },
      sortFields: {
        type: 'array',
        description: '排序字段数组，key 为相对左侧的列偏移（0-based），ascending=true 升序',
        items: {
          type: 'object',
          properties: {
            key: { type: 'number', description: '列偏移（0-based）' },
            ascending: { type: 'boolean', description: 'true=升序，false=降序' },
          },
          required: ['key', 'ascending'],
        },
      },
    },
    required: ['address', 'sortFields'],
  },
  humanLabel: (args: unknown) => {
    const { address, sortFields } = args as { address: string; sortFields: Array<{ key: number; ascending: boolean }> };
    const dir = (sortFields?.[0]?.ascending ?? true) ? '升序' : '降序';
    return `对 ${address} 按第 ${(sortFields?.[0]?.key ?? 0) + 1} 列${dir}排序`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, sortFields } = args as {
      address: string;
      sortFields: Array<{ key: number; ascending: boolean }>;
    };
    const { snapshot, snapshotAddress, tooLarge } = await (ctx.adapter as ExcelAdapter).sortRange(
      address,
      sortFields,
    );
    const reverse: ReverseDescriptor = tooLarge
      ? {
          tool: 'noop_inverse',
          args: { reason: `区域过大（超过 10,000 单元格），无法自动撤销排序` },
        }
      : {
          tool: 'restore_range_values_snapshot',
          args: { address: snapshotAddress, snapshot },
        };
    const postState: PostStateSnapshot = {
      kind: 'excel_snapshot',
      content: { address, tooLarge },
    };
    return { ok: true, data: { address, tooLarge }, reverse, postState };
  },
};

/** EXCEL-05 excel_find_and_replace（快照式 undo — D-20 独立守门，共享 restore_range_values_snapshot） */
export const excelFindAndReplaceTool: ToolDef = {
  name: 'excel_find_and_replace',
  kind: 'write',
  description:
    '在 Excel 工作表（或指定范围）执行查找替换。超过 10,000 单元格时将无法自动撤销。',
  parameters: {
    type: 'object',
    properties: {
      searchText: { type: 'string', description: '要查找的文字' },
      replaceText: { type: 'string', description: '替换后的文字' },
      address: { type: 'string', description: '可选，限定替换范围，如 A1:Z100；缺省 = 整张表' },
      matchCase: { type: 'boolean', description: '区分大小写（默认 false）' },
      matchWholeWord: { type: 'boolean', description: '全字匹配（默认 false）' },
    },
    required: ['searchText', 'replaceText'],
  },
  humanLabel: (args: unknown) => {
    const { searchText, replaceText } = args as { searchText: string; replaceText: string };
    return `全文替换「${searchText}」→「${replaceText}」`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { searchText, replaceText, address, matchCase, matchWholeWord } = args as {
      searchText: string;
      replaceText: string;
      address?: string;
      matchCase?: boolean;
      matchWholeWord?: boolean;
    };
    const { snapshot, snapshotAddress, tooLarge, count } = await (ctx.adapter as ExcelAdapter).excelFindAndReplace(
      searchText,
      replaceText,
      address,
      matchCase,
      matchWholeWord,
    );
    const reverse: ReverseDescriptor = tooLarge
      ? {
          tool: 'noop_inverse',
          args: { reason: `区域过大（超过 10,000 单元格），无法自动撤销查找替换` },
        }
      : {
          tool: 'restore_range_values_snapshot',
          args: { address: snapshotAddress, snapshot },
        };
    const postState: PostStateSnapshot = {
      kind: 'excel_snapshot',
      content: { address: snapshotAddress, tooLarge },
    };
    return { ok: true, data: { count, tooLarge }, reverse, postState };
  },
};

/** EXCEL-09 manage_worksheet（add/rename 元数据快照 — D-03 enum 硬限） */
export const manageWorksheetTool: ToolDef = {
  name: 'manage_worksheet',
  kind: 'write',
  description:
    '新增或重命名工作表。仅支持 add/rename；delete 为不可逆操作，不在本工具范围。',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['add', 'rename'],
        description: '操作类型：add = 新增工作表；rename = 重命名工作表',
      },
      sheetName: {
        type: 'string',
        description: 'add 时为期望的工作表名；rename 时为当前（旧）工作表名',
      },
      newName: {
        type: 'string',
        description: 'rename 时为新名称（add 时忽略）',
      },
    },
    required: ['operation', 'sheetName'],
  },
  humanLabel: (args: unknown) => {
    const { operation, sheetName, newName } = args as {
      operation: string;
      sheetName: string;
      newName?: string;
    };
    if (operation === 'add') return `新增工作表「${sheetName}」`;
    if (operation === 'rename') return `将工作表「${sheetName}」重命名为「${newName ?? ''}」`;
    return `操作工作表（${operation}）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { operation, sheetName, newName } = args as {
      operation: 'add' | 'rename';
      sheetName: string;
      newName?: string;
    };
    // D-03 运行时双重守门
    if (operation !== 'add' && operation !== 'rename') {
      return {
        ok: false,
        error: {
          code: 'INVALID_ARGS',
          message: `manage_worksheet 仅支持 add/rename，不支持 ${String(operation)}`,
          hint: '请将 operation 改为 "add" 或 "rename"',
          recoverable: true,
        },
      };
    }
    const snapshot = await (ctx.adapter as ExcelAdapter).manageWorksheet(
      operation,
      sheetName,
      newName,
    );
    const reverse: ReverseDescriptor = {
      tool: 'restore_worksheet_snapshot',
      args: { ...snapshot },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_worksheet',
      content: { operation, sheetName },
    };
    return { ok: true, data: snapshot, reverse, postState };
  },
};

/** EXCEL-10 set_chart_title（简单逆向 — 三 sync 读 before-image） */
export const setChartTitleTool: ToolDef = {
  name: 'set_chart_title',
  kind: 'write',
  description: '修改工作表中指定图表的标题文字。',
  parameters: {
    type: 'object',
    properties: {
      chartName: { type: 'string', description: '图表名称（Excel 分配的稳定句柄）' },
      title: { type: 'string', description: '新标题文字' },
    },
    required: ['chartName', 'title'],
  },
  humanLabel: (args: unknown) => {
    const { chartName, title } = args as { chartName: string; title: string };
    return `将图表「${chartName}」标题改为「${title}」`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { chartName, title } = args as { chartName: string; title: string };
    const { beforeTitle } = await (ctx.adapter as ExcelAdapter).setChartTitle(chartName, title);
    const reverse: ReverseDescriptor = {
      tool: 'restore_chart_title',
      args: { chartName, beforeTitle },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_chart_title',
      content: { chartName, title },
    };
    return { ok: true, data: { chartName, title }, reverse, postState };
  },
};

/** EXCEL-08 freeze_panes */
export const freezePanesTool: ToolDef = {
  name: 'freeze_panes',
  kind: 'write',
  description: '冻结首行/首列/指定窗格，freezeRows=0 且 freezeColumns=0 时解冻',
  parameters: {
    type: 'object',
    properties: {
      freezeRows: { type: 'number', description: '要冻结的行数，0 = 不冻结行' },
      freezeColumns: { type: 'number', description: '要冻结的列数，0 = 不冻结列' },
    },
    required: ['freezeRows', 'freezeColumns'],
  },
  humanLabel: (args: unknown) => {
    const { freezeRows, freezeColumns } = args as { freezeRows: number; freezeColumns: number };
    if (freezeRows > 0 && freezeColumns > 0) return `冻结前 ${freezeRows} 行 ${freezeColumns} 列`;
    if (freezeRows > 0) return `冻结前 ${freezeRows} 行`;
    if (freezeColumns > 0) return `冻结前 ${freezeColumns} 列`;
    return '解除冻结';
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { freezeRows, freezeColumns } = args as { freezeRows: number; freezeColumns: number };
    const { frozenRows, frozenColumns } = await (ctx.adapter as ExcelAdapter).freezePanes(
      freezeRows, freezeColumns,
    );
    const reverse: ReverseDescriptor = {
      tool: 'restore_freeze_panes',
      args: { frozenRows, frozenColumns },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_freeze',
      content: { frozenRows: freezeRows, frozenColumns: freezeColumns },
    };
    return { ok: true, data: { freezeRows, freezeColumns }, reverse, postState };
  },
};

// ---------------------------------------------------------------------------
// Phase 28 Wave 2：EXCEL-11 merge_cells + EXCEL-12 remove_duplicates
// ---------------------------------------------------------------------------

/** EXCEL-11 merge_cells（快照式 undo — merge 路径先快照值，unmerge 路径仍快照） */
export const mergeCellsTool: ToolDef = {
  name: 'merge_cells',
  kind: 'write',
  description:
    '合并或取消合并指定单元格区域。merge 操作会丢弃非左上角单元格的值（仅保留左上角值），撤销时会完整还原。' +
    '注意：已合并区域无法排序，排序前请先取消合并。超过 10,000 单元格时将无法自动撤销。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '目标区域，如 A1:C1 或 Sheet1!A1:C1' },
      operation: {
        type: 'string',
        enum: ['merge', 'unmerge'],
        description: 'merge=合并为一格，unmerge=取消合并',
      },
      across: {
        type: 'boolean',
        description: '仅对 merge 有效：true=逐行横向合并（每行各自合并），false/缺省=整块合并为单一单元格',
      },
    },
    required: ['address', 'operation'],
  },
  humanLabel: (args: unknown) => {
    const { address, operation } = args as { address: string; operation: string };
    return operation === 'merge' ? `合并单元格 ${address}` : `取消合并 ${address}`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, operation, across } = args as {
      address: string;
      operation: 'merge' | 'unmerge';
      across?: boolean;
    };
    const { snapshot, snapshotAddress, tooLarge } = await (ctx.adapter as ExcelAdapter).mergeCells(
      address,
      operation,
      across,
    );
    const reverse: ReverseDescriptor = tooLarge
      ? { tool: 'noop_inverse', args: { reason: `区域过大（超过 10,000 单元格），无法自动撤销` } }
      : {
          tool: 'restore_merge_state',
          args: { address: snapshotAddress, operation, across: across ?? false, snapshot: snapshot ?? undefined },
        };
    const postState: PostStateSnapshot = {
      kind: 'excel_merge',
      content: { address, operation, tooLarge },
    };
    return { ok: true, data: { address, operation }, reverse, postState };
  },
};

/** EXCEL-12 remove_duplicates（快照式 undo — 复用 restore_range_values_snapshot） */
export const removeDuplicatesTool: ToolDef = {
  name: 'remove_duplicates',
  kind: 'write',
  description:
    '删除指定区域内的重复行（保留第一次出现的行，删除后续重复）。撤销时会完整还原所有原始行（含重复行）。' +
    '超过 10,000 单元格时仍会执行删重，但无法自动撤销。需要 ExcelApi 1.9（Office for Web 支持）。',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string', description: '目标区域，如 A1:D100' },
      columns: {
        type: 'array',
        items: { type: 'number' },
        description: '判重列索引（0-based），默认全列。如 [0,1] 表示仅按第 1、2 列判重',
      },
      includes_header: {
        type: 'boolean',
        description: '区域第一行是否为标题（不参与删重），默认 true',
      },
    },
    required: ['address'],
  },
  humanLabel: (args: unknown) => {
    const { address } = args as { address: string };
    return `删除 ${address} 内的重复行`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { address, columns, includes_header } = args as {
      address: string;
      columns?: number[];
      includes_header?: boolean;
    };
    const { snapshot, snapshotAddress, tooLarge, removed, uniqueRemaining } =
      await (ctx.adapter as ExcelAdapter).removeDuplicatesRange(address, columns, includes_header);
    const reverse: ReverseDescriptor = tooLarge
      ? { tool: 'noop_inverse', args: { reason: `区域过大（超过 10,000 单元格），无法自动撤销` } }
      : { tool: 'restore_range_values_snapshot', args: { address: snapshotAddress, snapshot } };
    const postState: PostStateSnapshot = {
      kind: 'excel_snapshot',
      content: { address, tooLarge },
    };
    return {
      ok: true,
      data: { address, removed, uniqueRemaining, message: `已删除 ${removed} 行重复，剩余 ${uniqueRemaining} 行唯一行` },
      reverse,
      postState,
    };
  },
};

/** EXCEL-13 create_pivot_table（ExcelApi 1.8，Office for Web 支持；不可用时诚实 noop+gate） */
export const createPivotTableTool: ToolDef = {
  name: 'create_pivot_table',
  kind: 'write',
  description:
    '在指定位置创建数据透视表，支持配置行/列/值字段。撤销时删除整张透视表。' +
    'row_fields/data_fields/column_fields 中的字段名必须与源数据列头完全匹配（区分大小写）。' +
    '仅支持标准数据区域，不支持 OLAP/Power Pivot 数据源。需要 ExcelApi 1.8（Office for Web 支持）。' +
    '如当前环境不支持，工具会明确告知并跳过，不会中断后续步骤。',
  parameters: {
    type: 'object',
    properties: {
      source_range: {
        type: 'string',
        description: '数据源区域，如 A1:D50（含列头）',
      },
      destination: {
        type: 'string',
        description: '透视表左上角放置位置，如 F1',
      },
      name: {
        type: 'string',
        description: '透视表名称（可选，默认「Aster透视表」；Excel 可能自动加数字后缀防重名）',
      },
      row_fields: {
        type: 'array',
        items: { type: 'string' },
        description: '行字段列名数组，如 ["地区", "部门"]（必须与列头完全匹配，区分大小写）',
      },
      data_fields: {
        type: 'array',
        items: { type: 'string' },
        description: '值字段列名数组，如 ["销售额"]（求和聚合）',
      },
      column_fields: {
        type: 'array',
        items: { type: 'string' },
        description: '列字段列名数组，如 ["季度"]',
      },
    },
    required: ['source_range', 'destination'],
  },
  humanLabel: (args: unknown) => {
    const { source_range, name } = args as { source_range: string; name?: string };
    return `创建数据透视表${name ? `「${name}」` : ''}（源：${source_range}）`;
  },
  async execute(args, ctx): Promise<ToolResult> {
    const { source_range, destination, name, row_fields, data_fields, column_fields } = args as {
      source_range: string;
      destination: string;
      name?: string;
      row_fields?: string[];
      data_fields?: string[];
      column_fields?: string[];
    };
    let pivotTableName: string;
    try {
      const result = await (ctx.adapter as ExcelAdapter).createPivotTable({
        sourceRange: source_range,
        destination,
        name,
        rowFields: row_fields,
        dataFields: data_fields,
        columnFields: column_fields,
      });
      pivotTableName = result.pivotTableName;
    } catch (err) {
      // API 不可用（isSetSupported false）或运行时抛错 → 诚实降级（不中断 agent）。
      // MR-01：失败路径不返回 reverse/postState（与 remove_duplicates / manage_worksheet 的 ok:false 约定一致）。
      //   loop-helpers.appendOperation 门控是 `if (result.reverse && def)`（不判 result.ok）——
      //   失败若仍带 reverse 会在 DiffLog 留「无法自动撤销」的幻影条目，但实际什么都没建成（HR-02 已保证文档无残留）。
      //   去掉 reverse 后，失败的 pivot 不进 operationLog（干净）。
      // LR-04：原失败 postState 写 content:{tooLarge:true}（语义错配，API 不可用 ≠ 区域过大）一并移除。
      const message = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        data: { error: message },
      };
    }
    const reverse: ReverseDescriptor = {
      tool: 'delete_pivot_table_by_name',
      args: { pivotTableName },
    };
    const postState: PostStateSnapshot = {
      kind: 'excel_pivot',
      content: { pivotTableName },
    };
    return { ok: true, data: { pivotTableName }, reverse, postState };
  },
};
