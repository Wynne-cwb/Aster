/**
 * TDD RED: DocumentAdapter 接口与 discriminated unions 测试
 * 这些测试仅做类型层面验证（编译期契约），使用运行时 instanceof/typeof 检查。
 *
 * 本文件测试目标：
 * 1. SelectionContext 含 4 个 kind 变体（ppt/excel/word/none）
 * 2. InsertableContent 含 7 个 type 变体（text/paragraphs/bullets/formula/range-values/slides/image）
 * 3. AdapterCapabilities 结构正确
 * 4. DocumentAdapter 接口方法签名存在（通过 ts 编译验证）
 */
import { describe, it, expect } from 'vitest';
import type {
  SelectionContext,
  InsertableContent,
  AdapterCapabilities,
  DocumentAdapter,
} from './DocumentAdapter';

describe('SelectionContext discriminated union', () => {
  it('should accept kind="ppt" variant with slideIndex and slideCount', () => {
    const ctx: SelectionContext = { kind: 'ppt', slideIndex: 1, slideCount: 5 };
    expect(ctx.kind).toBe('ppt');
  });

  it('should accept kind="excel" variant with address', () => {
    const ctx: SelectionContext = { kind: 'excel', address: 'A1:C10' };
    expect(ctx.kind).toBe('excel');
  });

  it('should accept kind="word" variant with charCount', () => {
    const ctx: SelectionContext = { kind: 'word', charCount: 150 };
    expect(ctx.kind).toBe('word');
  });

  it('should accept kind="none" variant for empty selection (D-16)', () => {
    const ctx: SelectionContext = { kind: 'none' };
    expect(ctx.kind).toBe('none');
  });

  it('should narrow correctly in switch statement', () => {
    const ctx: SelectionContext = { kind: 'ppt', slideIndex: 2, slideCount: 10 };
    switch (ctx.kind) {
      case 'ppt':
        expect(ctx.slideIndex).toBe(2);
        expect(ctx.slideCount).toBe(10);
        break;
      default:
        throw new Error('Should have matched ppt');
    }
  });
});

describe('InsertableContent discriminated union', () => {
  it('should accept type="text" variant', () => {
    const content: InsertableContent = { type: 'text', value: 'hello' };
    expect(content.type).toBe('text');
  });

  it('should accept type="paragraphs" variant', () => {
    const content: InsertableContent = { type: 'paragraphs', values: ['p1', 'p2'] };
    expect(content.type).toBe('paragraphs');
  });

  it('should accept type="bullets" variant', () => {
    const content: InsertableContent = { type: 'bullets', items: ['item1', 'item2'] };
    expect(content.type).toBe('bullets');
  });

  it('should accept type="formula" variant', () => {
    const content: InsertableContent = { type: 'formula', formula: '=SUM(A1:A10)' };
    expect(content.type).toBe('formula');
  });

  it('should accept type="range-values" variant', () => {
    const content: InsertableContent = { type: 'range-values', values: [['a', 1], ['b', 2]] };
    expect(content.type).toBe('range-values');
  });

  it('should accept type="slides" variant with base64', () => {
    const content: InsertableContent = { type: 'slides', base64: 'abc123==' };
    expect(content.type).toBe('slides');
  });

  it('should accept type="image" variant with base64 and optional targetSlideIndex', () => {
    const contentWithIndex: InsertableContent = { type: 'image', base64: 'img123==', targetSlideIndex: 0 };
    const contentWithout: InsertableContent = { type: 'image', base64: 'img456==' };
    expect(contentWithIndex.type).toBe('image');
    expect(contentWithout.type).toBe('image');
  });
});

describe('AdapterCapabilities', () => {
  it('should have supportedInserts and supportsSelectionEvents and host fields', () => {
    const caps: AdapterCapabilities = {
      supportedInserts: ['text', 'bullets'],
      supportsSelectionEvents: true,
      host: 'ppt',
    };
    expect(caps.supportedInserts).toContain('text');
    expect(caps.supportsSelectionEvents).toBe(true);
    expect(caps.host).toBe('ppt');
  });

  it('should accept excel host', () => {
    const caps: AdapterCapabilities = {
      supportedInserts: ['formula', 'range-values'],
      supportsSelectionEvents: true,
      host: 'excel',
    };
    expect(caps.host).toBe('excel');
  });

  it('should accept word host', () => {
    const caps: AdapterCapabilities = {
      supportedInserts: ['text', 'paragraphs'],
      supportsSelectionEvents: true,
      host: 'word',
    };
    expect(caps.host).toBe('word');
  });
});

describe('DocumentAdapter interface (structural check)', () => {
  it('should be implementable as an object satisfying the interface', () => {
    // Structural check: create a minimal stub that satisfies DocumentAdapter
    const stubAdapter: DocumentAdapter = {
      getSelection: () => Promise.resolve({ kind: 'none' }),
      onSelectionChanged: (_cb: () => void) => () => { /* noop unsubscribe */ },
      capabilities: () => ({
        supportedInserts: [],
        supportsSelectionEvents: false,
        host: 'ppt',
      }),
      insert: (_content: InsertableContent) => Promise.resolve(),
    };

    expect(typeof stubAdapter.getSelection).toBe('function');
    expect(typeof stubAdapter.onSelectionChanged).toBe('function');
    expect(typeof stubAdapter.capabilities).toBe('function');
    expect(typeof stubAdapter.insert).toBe('function');
  });

  it('getSelection should return a Promise resolving to SelectionContext', async () => {
    const stubAdapter: DocumentAdapter = {
      getSelection: () => Promise.resolve({ kind: 'none' }),
      onSelectionChanged: (_cb) => () => {},
      capabilities: () => ({ supportedInserts: [], supportsSelectionEvents: false, host: 'word' }),
      insert: (_c) => Promise.resolve(),
    };

    const result = await stubAdapter.getSelection();
    expect(result.kind).toBe('none');
  });

  it('onSelectionChanged should return an unsubscribe function (D-13)', () => {
    const stubAdapter: DocumentAdapter = {
      getSelection: () => Promise.resolve({ kind: 'none' }),
      onSelectionChanged: (_cb) => () => { /* unsubscribe */ },
      capabilities: () => ({ supportedInserts: [], supportsSelectionEvents: false, host: 'excel' }),
      insert: (_c) => Promise.resolve(),
    };

    const unsubscribe = stubAdapter.onSelectionChanged(() => {});
    expect(typeof unsubscribe).toBe('function');
  });
});
