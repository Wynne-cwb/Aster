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

/** mock 单元格（表格用）：持有自己的 Shape→TextFrame。 */
interface MockColor { RGB: number }

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
  // 字体/段落/对齐/旋转/填充/线条 backing 字段（Phase 34 新增 — 模型 VBA OM）
  _bold: number;
  _italic: number;
  _underline: number;
  _size: number;
  _fontName: string;
  _fontColor: number;       // BGR long
  _align: number;           // PpParagraphAlignment 1/2/3/4
  _vAnchor: number;         // MsoVerticalAnchor
  _rotation: number;
  _fillVisible: number;     // msoTrue -1 / msoFalse 0
  _fillColor: number;       // BGR long
  _lineVisible: number;
  _lineWeight: number;
  _lineColor: number;       // BGR long
  _lineDash: number;
  _table?: { rows: number; cols: number; cells: string[][] };
  readonly TextFrame: WpsTextFrame;
  readonly Fill: WpsFillFormat;
  readonly Line: WpsLineFormat;
  readonly Table?: WpsTable;
  Rotation: number;
  Delete(): void;
}

interface MockSlide extends WpsSlide {
  _shapes: MockShape[];
  _bg: { visible: number; color: number };
  Delete(): void;
}

/** 通用 mock 形状工厂（mockWpsPpt 与 seedSlide 共用）。 */
function makeMockShape(
  owner: MockShape[],
  idSeq: { n: number },
  opts: Partial<MockShape> & { Type: number },
): MockShape {
  const s = {
    Id: opts.Id ?? ++idSeq.n,
    Name: opts.Name ?? `Shape ${idSeq.n}`,
    Type: opts.Type,
    Left: opts.Left ?? 0,
    Top: opts.Top ?? 0,
    Width: opts.Width ?? 100,
    Height: opts.Height ?? 50,
    HasTextFrame: opts.HasTextFrame ?? -1,
    _text: opts._text ?? '',
    _bold: opts._bold ?? 0,
    _italic: opts._italic ?? 0,
    _underline: opts._underline ?? 0,
    _size: opts._size ?? 18,
    _fontName: opts._fontName ?? 'Calibri',
    _fontColor: opts._fontColor ?? 0, // BGR 0 = black
    _align: opts._align ?? 1,
    _vAnchor: opts._vAnchor ?? 1,
    _rotation: opts._rotation ?? 0,
    _fillVisible: opts._fillVisible ?? -1,
    _fillColor: opts._fillColor ?? 0xffffff, // BGR white
    _lineVisible: opts._lineVisible ?? -1,
    _lineWeight: opts._lineWeight ?? 1,
    _lineColor: opts._lineColor ?? 0,
    _lineDash: opts._lineDash ?? 1,
    _table: opts._table,
    get Rotation() { return s._rotation; },
    set Rotation(v: number) { s._rotation = v; },
    get TextFrame(): WpsTextFrame {
      return {
        get HasText() { return s._text ? -1 : 0; },
        get VerticalAnchor() { return s._vAnchor; },
        set VerticalAnchor(v: number) { s._vAnchor = v; },
        TextRange: {
          get Text() { return s._text; },
          set Text(v: string) { s._text = String(v); },
          Font: {
            get Bold() { return s._bold; }, set Bold(v: number) { s._bold = v; },
            get Italic() { return s._italic; }, set Italic(v: number) { s._italic = v; },
            get Underline() { return s._underline; }, set Underline(v: number) { s._underline = v; },
            get Size() { return s._size; }, set Size(v: number) { s._size = v; },
            get Name() { return s._fontName; }, set Name(v: string) { s._fontName = v; },
            Color: { get RGB() { return s._fontColor; }, set RGB(v: number) { s._fontColor = v; } } as MockColor,
          },
          ParagraphFormat: {
            get Alignment() { return s._align; }, set Alignment(v: number) { s._align = v; },
          },
        },
      } as unknown as WpsTextFrame;
    },
    get Fill(): WpsFillFormat {
      return {
        get Type() { return s._fillVisible === 0 ? 0 : 1; },
        get Visible() { return s._fillVisible; }, set Visible(v: number) { s._fillVisible = v; },
        ForeColor: { get RGB() { return s._fillColor; }, set RGB(v: number) { s._fillColor = v; } } as MockColor,
        Solid() { s._fillVisible = -1; },
      } as unknown as WpsFillFormat;
    },
    get Line(): WpsLineFormat {
      return {
        get Visible() { return s._lineVisible; }, set Visible(v: number) { s._lineVisible = v; },
        get Weight() { return s._lineWeight; }, set Weight(v: number) { s._lineWeight = v; },
        get DashStyle() { return s._lineDash; }, set DashStyle(v: number) { s._lineDash = v; },
        ForeColor: { get RGB() { return s._lineColor; }, set RGB(v: number) { s._lineColor = v; } } as MockColor,
      } as unknown as WpsLineFormat;
    },
    get Table(): WpsTable | undefined {
      if (!s._table) return undefined;
      const tbl = s._table;
      return {
        Cell(row: number, col: number): WpsTableCell {
          const cellShape = {
            TextFrame: {
              TextRange: {
                get Text() { return tbl.cells[row - 1]?.[col - 1] ?? ''; },
                set Text(v: string) {
                  if (!tbl.cells[row - 1]) tbl.cells[row - 1] = [];
                  tbl.cells[row - 1][col - 1] = String(v);
                },
              },
            },
          };
          return { Shape: cellShape as unknown as WpsShape } as WpsTableCell;
        },
      } as unknown as WpsTable;
    },
    Delete(): void {
      const idx = owner.indexOf(s as unknown as MockShape);
      if (idx >= 0) owner.splice(idx, 1);
    },
  } as unknown as MockShape;
  return s;
}

/** 通用 mock Shapes facade。 */
function makeShapesFacade(owner: MockShape[], idSeq: { n: number }): WpsShapes {
  return {
    get Count() { return owner.length; },
    Item: (i: number) => owner[i - 1] as unknown as WpsShape,
    AddTextbox: (_o: number, left: number, top: number, width: number, height: number) => {
      const sh = makeMockShape(owner, idSeq, { Type: 17, Left: left, Top: top, Width: width, Height: height });
      owner.push(sh);
      return sh as unknown as WpsShape;
    },
    AddShape: (type: number, left: number, top: number, width: number, height: number) => {
      const sh = makeMockShape(owner, idSeq, { Type: 1, Left: left, Top: top, Width: width, Height: height });
      sh.Name = `Auto ${type}`;
      owner.push(sh);
      return sh as unknown as WpsShape;
    },
    AddTable: (numRows: number, numCols: number, left: number, top: number, width: number, height: number) => {
      const sh = makeMockShape(owner, idSeq, { Type: 19, Left: left, Top: top, Width: width, Height: height });
      sh._table = { rows: numRows, cols: numCols, cells: [] };
      owner.push(sh);
      return sh as unknown as WpsShape;
    },
    AddLine: (bx: number, by: number, ex: number, ey: number) => {
      const sh = makeMockShape(owner, idSeq, {
        Type: 9, Left: Math.min(bx, ex), Top: Math.min(by, ey),
        Width: Math.abs(ex - bx), Height: Math.abs(ey - by),
      });
      sh.Name = 'Line';
      owner.push(sh);
      return sh as unknown as WpsShape;
    },
    AddConnector: (type: number, bx: number, by: number, ex: number, ey: number) => {
      const sh = makeMockShape(owner, idSeq, {
        Type: 9, Left: Math.min(bx, ex), Top: Math.min(by, ey),
        Width: Math.abs(ex - bx), Height: Math.abs(ey - by),
      });
      sh.Name = `Connector ${type}`;
      owner.push(sh);
      return sh as unknown as WpsShape;
    },
  } as unknown as WpsShapes;
}

/** 通用 mock Slide 工厂（含 Background + Duplicate）。 */
function makeMockSlide(slides: MockSlide[], idSeq: { n: number }): MockSlide {
  const owner: MockShape[] = [];
  const slide = {
    get SlideIndex() { return slides.indexOf(slide as MockSlide) + 1; },
    Shapes: makeShapesFacade(owner, idSeq),
    _shapes: owner,
    _bg: { visible: 0, color: 0xffffff },
    get Background(): WpsSlideBackground {
      return {
        Fill: {
          get Type() { return slide._bg.visible === 0 ? 0 : 1; },
          get Visible() { return slide._bg.visible; }, set Visible(v: number) { slide._bg.visible = v; },
          ForeColor: { get RGB() { return slide._bg.color; }, set RGB(v: number) { slide._bg.color = v; } } as MockColor,
          Solid() { slide._bg.visible = -1; },
        } as unknown as WpsFillFormat,
      } as unknown as WpsSlideBackground;
    },
    Duplicate(): WpsSlideRange {
      const copy = makeMockSlide(slides, idSeq);
      // 复制源页形状（浅拷文字/类型/几何，足够 undo round-trip 断言）
      for (const sh of owner) {
        copy._shapes.push(makeMockShape(copy._shapes, idSeq, {
          Type: sh.Type, _text: sh._text, Left: sh.Left, Top: sh.Top, Width: sh.Width, Height: sh.Height,
        }));
      }
      const myPos = slides.indexOf(slide as MockSlide);
      slides.splice(myPos + 1, 0, copy);
      return { Count: 1, Item: (_i: number) => copy as unknown as WpsSlide } as unknown as WpsSlideRange;
    },
    Delete(): void {
      const idx = slides.indexOf(slide as MockSlide);
      if (idx >= 0) slides.splice(idx, 1);
    },
  } as unknown as MockSlide;
  return slide;
}

function mockWpsPpt(): { slides: MockSlide[]; idSeq: { n: number } } {
  const idSeq = { n: 0 };
  const slides: MockSlide[] = [];

  const slidesFacade = {
    get Count() { return slides.length; },
    Item: (i: number) => slides[i - 1] as unknown as WpsSlide,
    Add: (index: number, _layout: number) => {
      const slide = makeMockSlide(slides, idSeq);
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

/** 便捷：往 mock 加一页带形状（共用 makeMockSlide / makeMockShape）。 */
function seedSlide(
  ctx: { slides: MockSlide[]; idSeq: { n: number } },
  shapes: Array<Partial<MockShape> & { Type: number }>,
): void {
  const slide = makeMockSlide(ctx.slides, ctx.idSeq);
  for (const sp of shapes) {
    slide._shapes.push(makeMockShape(slide._shapes, ctx.idSeq, sp));
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

  // -------------------------------------------------------------------------
  // Phase 34 新增方法的往返 undo 测试
  // -------------------------------------------------------------------------

  it('setShapeProperty → restore_shape_property(Record) 往返还原（fill/line/几何 + BGR）', async () => {
    const ctx = mockWpsPpt();
    // 起始：白填充(BGR 0xffffff)、黑边可见、120×60
    seedSlide(ctx, [{ Id: 30, Type: 1, Width: 120, Height: 60, _fillColor: 0xffffff, _lineVisible: -1, _lineColor: 0, _lineWeight: 1 }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    const { beforeImage } = await adapter.setShapeProperty(1, '30', { fillColor: '#FF0000', lineColor: '#00FF00', lineWeight: 3, width: 200, height: 100 });
    // before-image 颜色经 BGR→hex（白=#FFFFFF）
    expect(beforeImage.fillColor).toBe('#FFFFFF');
    expect(beforeImage.width).toBe(120);
    // 写入生效：#FF0000 → BGR = 0x0000FF = 255
    expect(sh._fillColor).toBe(0x0000ff);
    expect(sh._fillColor).toBe(255);
    expect(sh._lineColor).toBe(0x00ff00); // #00FF00 → BGR 0x00FF00 = 65280
    expect(sh.Width).toBe(200);

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'set_shape_property', args: { slide_index: 1, shape_id: '30' }, humanLabel: '改属性',
        reverse: {
          tool: 'restore_shape_property',
          args: {
            slide_index: 1, shape_id: '30',
            fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor,
            line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight,
            line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height,
          },
        },
        postState: { kind: 'ppt_shape', content: { slide_index: 1, shape_id: '30' } }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(sh._fillColor).toBe(0xffffff); // 还原白
    expect(sh.Width).toBe(120);
    expect(sh.Height).toBe(60);
  });

  it('setShapeTextFont → restore_shape_font(Record) 往返还原（bold/size/color BGR）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 31, Type: 17, _text: 'hi', _bold: 0, _size: 18, _fontColor: 0 }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    const { beforeFont } = await adapter.setShapeTextFont(1, '31', { bold: true, size: 40, color: '#112233' });
    expect(beforeFont.bold).toBe(false);
    expect(beforeFont.size).toBe(18);
    expect(beforeFont.color).toBe('#000000');
    expect(sh._bold).toBe(-1); // msoTrue
    expect(sh._size).toBe(40);
    // #112233 → BGR = 0x332211
    expect(sh._fontColor).toBe(0x332211);

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'set_shape_text_font', args: {}, humanLabel: '改字体',
        reverse: { tool: 'restore_shape_font', args: { slide_index: 1, shape_id: '31', before_font: beforeFont } },
        postState: { kind: 'ppt_shape_font', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(sh._bold).toBe(0);
    expect(sh._size).toBe(18);
    expect(sh._fontColor).toBe(0);
  });

  it('setShapeTextAlignment → restore_shape_alignment(Record) 往返还原（enum 名↔int）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 32, Type: 17, _text: 'x', _align: 1 /* Left */ }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    const { beforeAlignment, effective } = await adapter.setShapeTextAlignment(1, '32', 'Center');
    expect(effective).toBe(true);
    expect(beforeAlignment).toBe('Left');
    expect(sh._align).toBe(2); // Center

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'set_shape_text_alignment', args: {}, humanLabel: '改对齐',
        reverse: { tool: 'restore_shape_alignment', args: { slide_index: 1, shape_id: '32', before_alignment: beforeAlignment } },
        postState: { kind: 'ppt_shape_alignment', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(sh._align).toBe(1); // 还原 Left
  });

  it('rotateShape → restore_shape_rotation(Record) 往返还原（含写后回读 effective）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 33, Type: 1, _rotation: 0 }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    const { beforeRotation, effective } = await adapter.rotateShape(1, '33', 90);
    expect(effective).toBe(true);
    expect(beforeRotation).toBe(0);
    expect(sh.Rotation).toBe(90);

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'rotate_shape', args: {}, humanLabel: '旋转',
        reverse: { tool: 'restore_shape_rotation', args: { slide_index: 1, shape_id: '33', before_rotation: beforeRotation } },
        postState: { kind: 'ppt_shape_rotation', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(sh.Rotation).toBe(0);
  });

  it('setSlideBackground → restore_slide_background(Record) 往返还原（纯色 BGR）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 34, Type: 17, _text: 'pg' }]);
    const adapter = new WpsPptAdapter();
    const slide = ctx.slides[0];

    const { beforeColor, effective } = await adapter.setSlideBackground(1, '#0000FF');
    expect(effective).toBe(true);
    expect(beforeColor).toBe(null); // 原背景非纯色（visible=0）
    // #0000FF → BGR 0xFF0000
    expect(slide._bg.color).toBe(0xff0000);
    expect(slide._bg.visible).toBe(-1);

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'set_slide_background', args: {}, humanLabel: '改背景',
        reverse: { tool: 'restore_slide_background', args: { slide_index: 1, before_color: beforeColor } },
        postState: { kind: 'ppt_slide_background', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    // before_color=null → WPS best-effort 不强行改（页背景保持，状态可接受）→ 仍 rolled_back（inverse 不抛）
    expect(detail.status).toBe('rolled_back');
  });

  it('copySlide → delete_slide_by_index(Record) 往返删除（Duplicate）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 40, Type: 17, _text: '源页' }]);
    const adapter = new WpsPptAdapter();
    expect(ctx.slides.length).toBe(1);

    const { capturedId, capturedIndex } = await adapter.copySlide(1);
    expect(ctx.slides.length).toBe(2);
    expect(capturedIndex).toBe(1); // 0-based 新页在第 2 张

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'copy_slide', args: {}, humanLabel: '复制页',
        reverse: { tool: 'delete_slide_by_index', args: { capturedIndex, capturedId } },
        postState: { kind: 'ppt_slide_copy', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides.length).toBe(1); // 副本已删
  });

  it('applySlideLayout → delete_slide_by_index(Record) 往返删整页（建页+批量形状）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 50, Type: 17, _text: '已有页' }]);
    const adapter = new WpsPptAdapter();

    const { capturedIndex, capturedId, slideIndex, newShapeIds } = await adapter.applySlideLayout([
      { shapeType: 'TextBox', rect: { left: 40, top: 30, width: 600, height: 60 }, text: '标题', font: { size: 32, bold: true, color: '#222222' }, align: 'Center' },
      { shapeType: 'Rectangle', rect: { left: 40, top: 120, width: 200, height: 100 }, fillColor: '#009887', text: '42', vAlign: 'Middle' },
    ]);
    expect(ctx.slides.length).toBe(2);
    expect(slideIndex).toBe(2);
    expect(newShapeIds.length).toBe(2);
    const newSlide = ctx.slides[1];
    expect(newSlide._shapes.length).toBe(2);
    // 几何填充 #009887 → BGR 0x879800
    expect(newSlide._shapes[1]._fillColor).toBe(0x879800);
    // TextBox 标题居中（align Center → 2）
    expect(newSlide._shapes[0]._align).toBe(2);

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'apply_slide_layout', args: {}, humanLabel: '建整页',
        reverse: { tool: 'delete_slide_by_index', args: { capturedIndex, capturedId } },
        postState: { kind: 'ppt_layout', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides.length).toBe(1); // 整页已删
  });

  it('insertTable → delete_shape_by_id(Record) 往返删除（AddTable + 填值）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, []);
    const adapter = new WpsPptAdapter();

    const { newShapeId, effective } = await adapter.insertTable(1, 2, 2, [['a', 'b'], ['c', 'd']]);
    expect(effective).toBe(true);
    expect(ctx.slides[0]._shapes.length).toBe(1);
    const tableShape = ctx.slides[0]._shapes[0];
    expect(tableShape._table?.cells[0][0]).toBe('a');
    expect(tableShape._table?.cells[1][1]).toBe('d');

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'insert_ppt_table', args: {}, humanLabel: '插表',
        reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: newShapeId } },
        postState: { kind: 'ppt_table', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides[0]._shapes.length).toBe(0);
  });

  it('addLine → delete_shape_by_id(Record) 往返删除（AddLine + dash/color）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, []);
    const adapter = new WpsPptAdapter();

    const { newShapeId, effective } = await adapter.addLine(
      1, 'Straight', { left: 10, top: 10 }, { left: 100, top: 50 },
      { color: '#FF0000', weight: 2, dashStyle: 'Dash' },
    );
    expect(effective).toBe(true);
    expect(ctx.slides[0]._shapes.length).toBe(1);
    const line = ctx.slides[0]._shapes[0];
    expect(line._lineColor).toBe(0x0000ff); // #FF0000 → BGR
    expect(line._lineWeight).toBe(2);
    expect(line._lineDash).toBe(3); // Dash

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'add_line', args: {}, humanLabel: '加线',
        reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: newShapeId } },
        postState: { kind: 'ppt_line', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(ctx.slides[0]._shapes.length).toBe(0);
  });

  it('manageSlides(delete) → noop_inverse（不可自动撤销，正向删页生效）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 60, Type: 17, _text: 'A' }]);
    seedSlide(ctx, [{ Id: 61, Type: 17, _text: 'B' }]);
    const adapter = new WpsPptAdapter();

    const r = await adapter.manageSlides('delete', 2);
    expect(r).toEqual({});
    expect(ctx.slides.length).toBe(1);

    // noop_inverse → skipped_error（不可自动撤销，诚实）
    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'manage_slides', args: {}, humanLabel: '删页',
        reverse: { tool: 'noop_inverse', args: { reason: '幻灯片内容无法序列化' } },
        postState: { kind: 'ppt_slide', content: { slide_index: 2, title: '' } }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('skipped_error');
  });

  it('setShapeGradient 路径：setShapeProperty(fillColor) → restore_shape_property 往返（降级纯色）', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 70, Type: 1, _fillColor: 0xffffff, Width: 100, Height: 50 }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    // 工具层 setShapeGradient 取首色后调 setShapeProperty(fillColor)（无新 adapter 方法）
    const { beforeImage } = await adapter.setShapeProperty(1, '70', { fillColor: '#009887' });
    expect(sh._fillColor).toBe(0x879800); // BGR

    const detail = await replayUndoSingle(
      {
        runId: 'r', stepIndex: 0, toolName: 'set_shape_gradient', args: {}, humanLabel: '渐变降级',
        reverse: {
          tool: 'restore_shape_property',
          args: {
            slide_index: 1, shape_id: '70',
            fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor,
            line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight,
            line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height,
          },
        },
        postState: { kind: 'ppt_shape_gradient', content: {} }, timestamp: 0,
      },
      adapter as unknown as DocumentAdapterForReplay,
    );
    expect(detail.status).toBe('rolled_back');
    expect(sh._fillColor).toBe(0xffffff); // 还原白
  });

  it('undo-all：属性 + 字体 + 旋转 + 加线 → 逆序全部 rolled_back', async () => {
    const ctx = mockWpsPpt();
    seedSlide(ctx, [{ Id: 80, Type: 1, _fillColor: 0xffffff, _size: 18, _rotation: 0, Width: 100, Height: 50 }]);
    const adapter = new WpsPptAdapter();
    const sh = ctx.slides[0]._shapes[0];

    const { beforeImage } = await adapter.setShapeProperty(1, '80', { fillColor: '#FF0000' });
    appendOperation({
      runId: 'rr', stepIndex: 0, toolName: 'set_shape_property', args: {}, humanLabel: 'a',
      reverse: { tool: 'restore_shape_property', args: { slide_index: 1, shape_id: '80', fill_type: beforeImage.fillType, fill_color: beforeImage.fillColor, line_color: beforeImage.lineColor, line_weight: beforeImage.lineWeight, line_visible: beforeImage.lineVisible, width: beforeImage.width, height: beforeImage.height } },
      postState: { kind: 'ppt_shape', content: {} }, timestamp: 0,
    });
    const { beforeFont } = await adapter.setShapeTextFont(1, '80', { size: 50 });
    appendOperation({
      runId: 'rr', stepIndex: 1, toolName: 'set_shape_text_font', args: {}, humanLabel: 'b',
      reverse: { tool: 'restore_shape_font', args: { slide_index: 1, shape_id: '80', before_font: beforeFont } },
      postState: { kind: 'ppt_shape_font', content: {} }, timestamp: 1,
    });
    const { beforeRotation } = await adapter.rotateShape(1, '80', 45);
    appendOperation({
      runId: 'rr', stepIndex: 2, toolName: 'rotate_shape', args: {}, humanLabel: 'c',
      reverse: { tool: 'restore_shape_rotation', args: { slide_index: 1, shape_id: '80', before_rotation: beforeRotation } },
      postState: { kind: 'ppt_shape_rotation', content: {} }, timestamp: 2,
    });
    const { newShapeId } = await adapter.addLine(1, 'Straight', { left: 0, top: 0 }, { left: 10, top: 10 });
    appendOperation({
      runId: 'rr', stepIndex: 3, toolName: 'add_line', args: {}, humanLabel: 'd',
      reverse: { tool: 'delete_shape_by_id', args: { slide_index: 1, shape_id: newShapeId } },
      postState: { kind: 'ppt_line', content: {} }, timestamp: 3,
    });

    const result = await replayUndoAll('rr', adapter as unknown as DocumentAdapterForReplay);
    expect(result.total).toBe(4);
    expect(result.rolledBack).toBe(4);
    expect(sh._fillColor).toBe(0xffffff);
    expect(sh._size).toBe(18);
    expect(sh.Rotation).toBe(0);
    expect(ctx.slides[0]._shapes.length).toBe(1); // 加的线已删
  });

  it('get_shape_image → 诚实降级 UNSUPPORTED（不抛、引导回形针）', async () => {
    mockWpsPpt();
    const adapter = new WpsPptAdapter();
    const r = await adapter.read({ kind: 'get_shape_image', focus: '描述这张图' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error.code).toBe('UNSUPPORTED');
  });
});
