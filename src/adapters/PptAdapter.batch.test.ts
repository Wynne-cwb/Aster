/**
 * src/adapters/PptAdapter.batch.test.ts — UAT-7 结构守门
 *
 * 防 snake/camel 键名回归：工具实际暴露**下划线**键（slide_index/shape_id/text/font），
 * 旧 executeBatch 读驼峰（slideIndex/shapeId/newText）→ undefined → idx=NaN 绕过 slide
 * 校验 → 第 0 op 必挂（"无操作被执行"，UAT-7）。本测试用下划线 + 驼峰双喂，断言：
 *   - 不在 index 0 挂；subOps 数正确；每个 subOp.reverse.args 是带正确键的 Record 对象；
 *   - 驼峰也兼容（双键容错）；
 *   - 未支持工具（add_shape）→ failAtIndex 指向它 + failReason 含工具名。
 *
 * A-06：mock 全部 Office.js（PowerPoint.run = vi.fn），不调真实 API。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { PptAdapter } from './PptAdapter';

type BatchOp = { tool: string; args: Record<string, unknown>; humanLabel?: string };
type BatchResult = {
  subOps: Array<{ reverse: { tool: string; args: Record<string, unknown> }; ok: boolean }>;
  failAtIndex?: number;
  failReason?: string;
};

afterEach(() => {
  delete (global as unknown as Record<string, unknown>).PowerPoint;
  vi.restoreAllMocks();
});

/** 构造一个 id='s1'、TextBox、含 left/top/text/font 的 shape（三种批量工具均可命中）。 */
function makeShape(id: string): Record<string, unknown> {
  const font = {
    load: vi.fn(),
    bold: false, italic: false, underline: false,
    color: '#000000', size: 12, name: 'Arial',
  };
  return {
    id,
    type: 'TextBox',
    left: 10,
    top: 20,
    textFrame: { textRange: { load: vi.fn(), text: '旧文字', font } },
  };
}

/** 单 slide（index 0）+ 给定 shapes 的 PowerPoint mock；executeBatch 的 slides/shapes load 均 no-op。 */
function setBatchMock(shapes: Record<string, unknown>[]): void {
  const slide = { shapes: { load: vi.fn(), items: shapes } };
  (global as unknown as Record<string, unknown>).PowerPoint = {
    run: vi.fn(async (cb: (ctx: unknown) => unknown) =>
      cb({
        presentation: { slides: { load: vi.fn(), items: [slide] } },
        sync: vi.fn().mockResolvedValue(undefined),
      }),
    ),
  };
}

async function run(adapter: PptAdapter, ops: BatchOp[]): Promise<BatchResult> {
  return (adapter as unknown as { executeBatch: (o: BatchOp[]) => Promise<BatchResult> }).executeBatch(ops);
}

describe('PptAdapter.executeBatch — snake_case 键名（工具真实键，UAT-7 守门）', () => {
  it('下划线 batch（move + set_shape_text + set_shape_text_font）不在 index 0 挂，subOps=3，reverse.args 是带正确键的 Record', async () => {
    setBatchMock([makeShape('s1')]);
    const adapter = new PptAdapter();
    const r = await run(adapter, [
      { tool: 'move_shape', args: { slide_index: 1, shape_id: 's1', left: 100, top: 200 } },
      { tool: 'set_shape_text', args: { slide_index: 1, shape_id: 's1', text: '新文字' } },
      { tool: 'set_shape_text_font', args: { slide_index: 1, shape_id: 's1', font: { bold: true, size: 20 } } },
    ]);

    expect(r.failAtIndex).toBeUndefined();
    expect(r.subOps.length).toBe(3);
    expect(r.subOps.every((s) => s.ok)).toBe(true);

    // 每个 reverse.args 必须是 Record 对象（非数组），带正确键（project_adapter_inverse_signature 铁律）
    const [mv, txt, fnt] = r.subOps;
    expect(mv.reverse.tool).toBe('restore_shape_geometry');
    expect(Array.isArray(mv.reverse.args)).toBe(false);
    expect(mv.reverse.args).toMatchObject({ slide_index: 1, shape_id: 's1', left: 10, top: 20 });

    expect(txt.reverse.tool).toBe('restore_shape_text');
    expect(txt.reverse.args).toMatchObject({ slide_index: 1, shape_id: 's1', before_text: '旧文字' });

    expect(fnt.reverse.tool).toBe('restore_shape_font');
    expect(typeof fnt.reverse.args.before_font).toBe('object');
    expect(fnt.reverse.args).toMatchObject({ slide_index: 1, shape_id: 's1' });
    expect((fnt.reverse.args.before_font as Record<string, unknown>).size).toBe(12);
  });

  it('驼峰键也兼容（双键容错）：slideIndex/shapeId/newText 不在 index 0 挂', async () => {
    setBatchMock([makeShape('s1')]);
    const adapter = new PptAdapter();
    const r = await run(adapter, [
      { tool: 'move_shape', args: { slideIndex: 1, shapeId: 's1', left: 50, top: 60 } },
      { tool: 'set_shape_text', args: { slideIndex: 1, shapeId: 's1', newText: 'x' } },
    ]);

    expect(r.failAtIndex).toBeUndefined();
    expect(r.subOps.length).toBe(2);
    expect(r.subOps[0].reverse.args).toMatchObject({ slide_index: 1, shape_id: 's1' });
  });

  it('未支持工具（add_shape）→ failAtIndex 指向它 + failReason 含工具名，前序 op 保留', async () => {
    setBatchMock([makeShape('s1')]);
    const adapter = new PptAdapter();
    const r = await run(adapter, [
      { tool: 'set_shape_text', args: { slide_index: 1, shape_id: 's1', text: 'ok' } },
      { tool: 'add_shape', args: { slide_index: 1, shape_type: 'Rectangle', position: { left: 0, top: 0, width: 10, height: 10 } } },
    ]);

    expect(r.failAtIndex).toBe(1);
    expect(r.failReason).toContain('add_shape');
    expect(r.subOps.length).toBe(1); // 第 0 个成功保留
    expect(r.subOps[0].ok).toBe(true);
  });
});
