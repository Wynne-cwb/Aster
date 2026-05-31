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
