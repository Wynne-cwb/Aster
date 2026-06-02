/**
 * src/agent/tools/read/vision.test.ts — getShapeImage ToolDef 单测（Task 1 TDD）
 *
 * 验证（5 个 behavior 用例）：
 *   1. name === 'get_shape_image'，kind === 'read'
 *   2. execute() 调 ctx.adapter.read({ kind: 'get_shape_image', focus })
 *   3. execute() 返回 wrapReadResult(r, { result_type: 'document_content', source: 'selection.image' })
 *   4. focus 为 undefined 时 humanLabel 返回 '正在看这张图…'
 *   5. focus 为 '图表数值' 时 humanLabel 返回 '正在看这张图（图表数值）…'
 */
import { describe, it, expect, vi } from 'vitest';
import { getShapeImage } from './vision';

describe('getShapeImage ToolDef', () => {
  it('name=get_shape_image, kind=read', () => {
    expect(getShapeImage.name).toBe('get_shape_image');
    expect(getShapeImage.kind).toBe('read');
  });

  it('execute 调 adapter.read({ kind: "get_shape_image", focus })', async () => {
    const read = vi.fn().mockResolvedValue({ ok: true, data: { vision_result: 'x' } });
    await getShapeImage.execute({ focus: '图表数值' }, { adapter: { read } } as never);
    expect(read).toHaveBeenCalledWith({ kind: 'get_shape_image', focus: '图表数值' });
  });

  it('execute 返回 wrapReadResult 包装（result_type=document_content，source=selection.image）', async () => {
    const read = vi.fn().mockResolvedValue({ ok: true, data: { vision_result: '图片描述内容' } });
    const result = await getShapeImage.execute({ focus: '标题' }, { adapter: { read } } as never);
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.result_type).toBe('document_content');
    expect(data.source).toBe('selection.image');
  });

  it('humanLabel 无 focus → 正在看这张图…', () => {
    expect(getShapeImage.humanLabel({})).toBe('正在看这张图…');
  });

  it('humanLabel 有 focus → 正在看这张图（图表数值）…', () => {
    expect(getShapeImage.humanLabel({ focus: '图表数值' })).toBe('正在看这张图（图表数值）…');
  });
});
