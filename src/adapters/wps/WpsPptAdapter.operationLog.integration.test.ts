/**
 * WpsPptAdapter.operationLog.integration.test.ts — WPS PPT adapter × replay engine 集成守门
 *
 * 用 **真 WpsPptAdapter 实例**（mock window.Application.ActivePresentation 同步 VBA 风格），
 * 跑 replayUndoSingle / replayUndoAll，断言：
 *   1. setShapeText → restore_shape_text(Record) 往返还原（rolled_back）
 *   2. moveShape → restore_shape_geometry(Record) 往返还原（rolled_back）
 *   3. addShape → delete_shape_by_id(Record) 往返删除（rolled_back）
 *   4. insertSlideAfter → delete_slide_by_title(Record) 往返删页（rolled_back）
 *   5. read 数据形状对齐 Office.js（list_slides / list_shapes_on_slide / get_shape）
 *
 * 守门意义（[[adapter-inverse-signature]]）：inverse 必须收 Record 对象，且 reverse.tool 派发命中。
 *
 * ⚠️ 投机性预写：mock 行为是对 WPS 演示 VBA 语义的**推断**，真机以真机为准（[真机待验]）。
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WpsPptAdapter } from './WpsPptAdapter';
import {
  replayUndoSingle,
  replayUndoAll,
  appendOperation,
  __resetOperationLogForTest,
  type OperationLogEntry,
  type DocumentAdapterForReplay,
} from '../../agent/operationLog';

// ---------------------------------------------------------------------------
// mock window.Application.ActivePresentation（同步 VBA 风格演示对象模型）
// ---------------------------------------------------------------------------

interface MockShape {
  Id: number;
  Name: string;
  Type: number;
  Left: number;
  Top: number;
  Width: number;
  Height: number;
  HasTextFrame: number;
  _text: string;
  readonly TextFrame: WpsTextFrame;
  Delete(): void;
}

interface MockSlide extends WpsSlide {
  _shapes: MockShape[];
  Delete(): void;
}

function mockWpsPpt(): { slides: MockSlide[]; idSeq: { n: number } } {
  const idSeq = { n: 0 };
  const slides: MockSlide[] = [];

  const makeShape = (
    owner: MockShape[],
    opts: Partial<MockShape> & { type: number },
  ): MockShape => {
    const s: MockShape = {
      Id: opts.Id ?? ++idSeq.n,
      Name: opts.Name ?? `Shape ${idSeq.n}`,
      Type: opts.type,
      Left: opts.Left ?? 0,
      Top: opts.Top ?? 0,
      Width: opts.Width ?? 100,
      Height: opts.Height ?? 50,
      HasTextFrame: opts.HasTextFrame ?? -1,
      _text: opts._text ?? '',
      get TextFrame(): WpsTextFrame {
        return {
          get HasText() {
            return s._text ? -1 : 0;
          },
          TextRange: {
            get Text() {
              return s._text;
            },
            set Text(v: string) {
              s._text = String(v);
            },
          },
        } as unknown as WpsTextFrame;
      },
      Delete(): void {
        const idx = owner.indexOf(s);
        if (idx >= 0) owner.splice(idx, 1);
      },
    };
    return s;
  };

  const makeShapesFacade = (owner: MockShape[]): WpsShapes =>
    ({
      get Count() {
        return owner.length;
      },
      Item: (i: number) => owner[i - 1] as unknown as WpsShape,
      AddTextbox: (_o: number, left: number, top: number, width: number, height: number) => {
        const sh = makeShape(owner, { type: 17, Left: left, Top: top, Width: width, Height: height });
        owner.push(sh);
        return sh as unknown as WpsShape;
      },
      AddShape: (type: number, left: number, top: number, width: number, height: number) => {
        const sh = makeShape(owner, { type: 1, Left: left, Top: top, Width: width, Height: height });
        // type 入参记到 Name 便于断言（mock 简化，真机 Type 应映射枚举）
        sh.Name = `Auto ${type}`;
        owner.push(sh);
        return sh as unknown as WpsShape;
      },
    }) as unknown as WpsShapes;

  const makeSlide = (shapesInit: MockShape[]): MockSlide => {
    const owner: MockShape[] = [];
    const slide = {
      get SlideIndex() {
        return slides.indexOf(slide as MockSlide) + 1;
      },
      Shapes: makeShapesFacade(owner),
      _shapes: owner,
      Delete(): void {
        const idx = slides.indexOf(slide as MockSlide);
        if (idx >= 0) slides.splice(idx, 1);
      },
    } as unknown as MockSlide;
    // 把初始形状的 owner 指向本页 owner
    for (const init of shapesInit) {
      owner.push(makeShape(owner, { ...init, type: init.Type }));
    }
    return slide;
  };

  const slidesFacade = {
    get Count() {
      return slides.length;
    },
    Item: (i: number) => slides[i - 1] as unknown as WpsSlide,
    Add: (index: number, _layout: number) => {
      const slide = makeSlide([]);
      slides.splice(Math.max(0, index - 1), 0, slide);
      return slide as unknown as WpsSlide;
    },
  } as unknown as WpsSlides;

  (globalThis as { Application?: WpsApplication }).Application = {
    ComponentType: 3,
    ActivePresentation: { Slides: slidesFacade } as unknown as WpsPresentation,
  } as unknown as WpsApplication;

  return { slides, idSeq };
}

/** 便捷：往 mock 加一页带形状。 */
function seedSlide(
  ctx: { slides: MockSlide[]; idSeq: { n: number } },
  shapes: Array<Partial<MockShape> & { Type: number }>,
): void {
  const owner: MockShape[] = [];
  const slide = {
    get SlideIndex() {
      return ctx.slides.indexOf(slide as MockSlide) + 1;
    },
    Shapes: {
      get Count() {
        return owner.length;
      },
      Item: (i: number) => owner[i - 1] as unknown as WpsShape,
      AddTextbox: (_o: number, left: number, top: number, width: number, height: number) => {
        const sh: MockShape = {
          Id: ++ctx.idSeq.n, Name: `Shape ${ctx.idSeq.n}`, Type: 17,
          Left: left, Top: top, Width: width, Height: height, HasTextFrame: -1, _text: '',
          get TextFrame(): WpsTextFrame {
            return { get HasText() { return sh._text ? -1 : 0; }, TextRange: { get Text() { return sh._text; }, set Text(v: string) { sh._text = String(v); } } } as unknown as WpsTextFrame;
          },
          Delete(): void { const i = owner.indexOf(sh); if (i >= 0) owner.splice(i, 1); },
        };
        owner.push(sh);
        return sh as unknown as WpsShape;
      },
      AddShape: (_t: number, left: number, top: number, width: number, height: number) => {
        const sh: MockShape = {
          Id: ++ctx.idSeq.n, Name: `Auto ${ctx.idSeq.n}`, Type: 1,
          Left: left, Top: top, Width: width, Height: height, HasTextFrame: -1, _text: '',
          get TextFrame(): WpsTextFrame {
            return { get HasText() { return sh._text ? -1 : 0; }, TextRange: { get Text() { return sh._text; }, set Text(v: string) { sh._text = String(v); } } } as unknown as WpsTextFrame;
          },
          Delete(): void { const i = owner.indexOf(sh); if (i >= 0) owner.splice(i, 1); },
        };
        owner.push(sh);
        return sh as unknown as WpsShape;
      },
    } as unknown as WpsShapes,
    _shapes: owner,
    Delete(): void { const i = ctx.slides.indexOf(slide as MockSlide); if (i >= 0) ctx.slides.splice(i, 1); },
  } as unknown as MockSlide;
  for (const sp of shapes) {
    const sh: MockShape = {
      Id: sp.Id ?? ++ctx.idSeq.n, Name: sp.Name ?? `Shape ${ctx.idSeq.n}`, Type: sp.Type,
      Left: sp.Left ?? 0, Top: sp.Top ?? 0, Width: sp.Width ?? 100, Height: sp.Height ?? 50,
      HasTextFrame: sp.HasTextFrame ?? -1, _text: sp._text ?? '',
      get TextFrame(): WpsTextFrame {
        return { get HasText() { return sh._text ? -1 : 0; }, TextRange: { get Text() { return sh._text; }, set Text(v: string) { sh._text = String(v); } } } as unknown as WpsTextFrame;
      },
      Delete(): void { const i = owner.indexOf(sh); if (i >= 0) owner.splice(i, 1); },
    };
    owner.push(sh);
  }
  ctx.slides.push(slide);
}

afterEach(() => {
  __resetOperationLogForTest();
  delete (globalThis as { Application?: WpsApplication }).Application;
});

describe('集成：replay engine × 真 WpsPptAdapter（投机预写·真机 pending）', () => {
  it('setShapeText → restore_shape_text(Record) 往返还原 → rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 11, Type: 17, _text: '旧文字' }]);
    const adapter = new WpsPptAdapter();

    const { beforeText } = await adapter.setShapeText(1, '11', '新文字');
    expect(beforeText).toBe('旧文字');
    expect(ctx.slides[0]._shapes[0]._text).toBe('新文字');

    const entry: OperationLogEntry = {
      runId: 'run-ppt',
      stepIndex: 0,
      toolName: 'set_shape_text',
      args: { slide_index: 1, shape_id: '11', text: '新文字' },
      humanLabel: '改文字',
      reverse: { tool: 'restore_shape_text', args: { slide_index: 1, shape_id: '11', before_text: beforeText } },
      postState: { kind: 'ppt_shape', content: { slide_index: 1, shape_id: '11', text: '新文字' } },
      timestamp: 0,
    };

    const detail = await replayUndoSingle(entry, adapter as unknown as DocumentAdapterForReplay);
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides[0]._shapes[0]._text).toBe('旧文字');
  });

  it('moveShape → restore_shape_geometry(Record) 往返还原 → rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 22, Type: 1, Left: 10, Top: 20 }]);
    const adapter = new WpsPptAdapter();

    const { beforeLeft, beforeTop } = await adapter.moveShape(1, '22', 300, 400);
    expect([beforeLeft, beforeTop]).toEqual([10, 20]);
    expect([ctx.slides[0]._shapes[0].Left, ctx.slides[0]._shapes[0].Top]).toEqual([300, 400]);

    const detail = await replayUndoSingle(
      {
        runId: 'run-ppt',
        stepIndex: 0,
        toolName: 'move_shape',
        args: { slide_index: 1, shape_id: '22', left: 300, top: 400 },
        humanLabel: '移动形状',
        reverse: { tool: 'restore_shape_geometry', args: { slide_index: 1, shape_id: '22', left: beforeLeft, top: beforeTop } },
        postState: { kind: 'ppt_shape', content: { slide_index: 1, shape_id: '22', left: 300, top: 400 } },
        timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect([ctx.slides[0]._shapes[0].Left, ctx.slides[0]._shapes[0].Top]).toEqual([10, 20]);
  });

  it('addShape → delete_shape_by_id(Record) 往返删除 → rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, []);
    const adapter = new WpsPptAdapter();

    const { newShapeId } = await adapter.addShape(1, 'TextBox', { left: 1, top: 2, width: 3, height: 4 }, '盒子');
    expect(ctx.slides[0]._shapes.length).toBe(1);

    const detail = await replayUndoSingle(
      {
        runId: 'run-ppt',
        stepIndex: 0,
        toolName: 'add_shape',
        args: { slide_index: 1, shape_type: 'TextBox' },
        humanLabel: '加形状',
        reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: newShapeId } },
        postState: { kind: 'ppt_shape_new', content: { slide_index: 1, shape_id: newShapeId } },
        timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides[0]._shapes.length).toBe(0);
  });

  it('insertSlideAfter → delete_slide_by_title(Record) 往返删页 → rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 1, Type: 17, _text: '第一页' }]);
    const adapter = new WpsPptAdapter();

    const { insertedIndex } = await adapter.insertSlideAfter(-1, '新页标题');
    expect(ctx.slides.length).toBe(2);
    expect(insertedIndex).toBe(2);

    const detail = await replayUndoSingle(
      {
        runId: 'run-ppt',
        stepIndex: 0,
        toolName: 'insert_slide',
        args: { title: '新页标题' },
        humanLabel: '插页',
        reverse: { tool: 'delete_slide_by_title', args: { titleFingerprint: '新页标题' } },
        postState: { kind: 'ppt_slide', content: { index: insertedIndex, title: '新页标题' } },
        timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides.length).toBe(1);
  });

  it('undo-all：改文字 + 移动 + 加形状 → 逆序全部 rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 5, Type: 17, _text: 'T', Left: 0, Top: 0 }]);
    const adapter = new WpsPptAdapter();

    const { beforeText } = await adapter.setShapeText(1, '5', 'T2');
    appendOperation({
      runId: 'r', stepIndex: 0, toolName: 'set_shape_text', args: {}, humanLabel: 'a',
      reverse: { tool: 'restore_shape_text', args: { slide_index: 1, shape_id: '5', before_text: beforeText } },
      postState: { kind: 'ppt_shape', content: {} }, timestamp: 0,
    });
    const { beforeLeft, beforeTop } = await adapter.moveShape(1, '5', 50, 60);
    appendOperation({
      runId: 'r', stepIndex: 1, toolName: 'move_shape', args: {}, humanLabel: 'b',
      reverse: { tool: 'restore_shape_geometry', args: { slide_index: 1, shape_id: '5', left: beforeLeft, top: beforeTop } },
      postState: { kind: 'ppt_shape', content: {} }, timestamp: 1,
    });
    const { newShapeId } = await adapter.addShape(1, 'Rectangle', { left: 1, top: 1, width: 1, height: 1 });
    appendOperation({
      runId: 'r', stepIndex: 2, toolName: 'add_shape', args: {}, humanLabel: 'c',
      reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: newShapeId } },
      postState: { kind: 'ppt_shape_new', content: {} }, timestamp: 2,
    });

    const result = await replayUndoAll('r', adapter as unknown as DocumentAdapterForReplay);
    expect(result.total).toBe(3);
    expect(result.rolledBack).toBe(3);
    const sh = ctx.slides[0]._shapes[0];
    expect(sh._text).toBe('T');
    expect([sh.Left, sh.Top]).toEqual([0, 0]);
    expect(ctx.slides[0]._shapes.length).toBe(1); // 加的矩形已删
  });

  it('read 数据形状对齐 Office.js：list_slides / list_shapes_on_slide / get_shape', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 7, Type: 17, _text: '标题甲', Left: 5, Top: 6, Width: 7, Height: 8 }]);
    const adapter = new WpsPptAdapter();

    const ls = await adapter.read({ kind: 'list_slides' });
    expect(ls).toEqual({ ok: true, data: { count: 1, slides: [{ index: 1, title: '标题甲' }] } });

    const shapes = await adapter.read({ kind: 'list_shapes_on_slide', slideIndex: 1 });
    expect(shapes).toEqual({
      ok: true,
      data: { slideIndex: 1, shapes: [{ id: '7', type: 'TextBox', left: 5, top: 6, width: 7, height: 8 }] },
    });

    const shape = await adapter.read({ kind: 'get_shape', slideIndex: 1, shapeId: '7' });
    expect(shape).toEqual({
      ok: true,
      data: { id: '7', type: 'TextBox', text: '标题甲', left: 5, top: 6, width: 7, height: 8 },
    });

    // 形状不存在 → NOT_FOUND（不抛）
    const missing = await adapter.read({ kind: 'get_shape', slideIndex: 1, shapeId: '999' });
    expect(missing.ok).toBe(false);
  });
});
