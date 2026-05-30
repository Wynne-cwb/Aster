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
    // TOOL-04 runtime assert：write tool 必须返回 reverse
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
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
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
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
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
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
    console.assert(reverse !== undefined, 'TOOL-04: reverse required');
    return { ok: true, data: { cell, value }, reverse, postState };
  },
};
