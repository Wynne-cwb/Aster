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

export const setRangeValues: ToolDef<SetRangeValuesArgs> = {
  name: 'set_range_values',
  kind: 'write',
  description:
    '向 Excel 指定区域写入二维数值数组。自动抓取写入前快照以支持撤销。address 格式如 "A1:B3"。',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: 'Excel range 地址，如 "A1:B3" 或 "Sheet1!A1:C5"',
      },
      values: {
        type: 'array',
        items: {
          type: 'array',
          items: {},
        },
        description: '要写入的二维数组，行×列须与 address 指定的区域维度一致',
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
    console.assert(reverse !== undefined, 'TOOL-04: write tool must return reverse');
    return { ok: true, data: { address, rowsWritten: values.length }, reverse, postState };
  },
};
