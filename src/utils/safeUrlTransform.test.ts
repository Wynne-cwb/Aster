import { describe, it, expect } from 'vitest';
import { safeUrlTransform } from './safeUrlTransform';

describe('safeUrlTransform — XSS URL 防御（UI-01，D-03）', () => {
  it('UI-01-A: javascript: 协议 → 返回空串（拦截）', () => {
    expect(safeUrlTransform('javascript:alert(1)')).toBe('');
  });
  it('UI-01-B: data: URI → 返回空串（拦截）', () => {
    expect(safeUrlTransform('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('');
  });
  it('UI-01-C: vbscript: → 返回空串（拦截）', () => {
    expect(safeUrlTransform('vbscript:msgbox(1)')).toBe('');
  });
  it('UI-01-D: https: → 原样返回（放行）', () => {
    expect(safeUrlTransform('https://example.com')).toBe('https://example.com');
  });
  it('UI-01-E: 相对路径和锚点 → 原样返回（放行）', () => {
    expect(safeUrlTransform('#section')).toBe('#section');
    expect(safeUrlTransform('/path/to/page')).toBe('/path/to/page');
    expect(safeUrlTransform('./relative')).toBe('./relative');
  });
  it('UI-01-F: mailto: → 原样返回（放行）', () => {
    expect(safeUrlTransform('mailto:user@example.com')).toBe('mailto:user@example.com');
  });
  it('UI-01-G: 协议相对 URL → 原样返回（放行）', () => {
    expect(safeUrlTransform('//cdn.example.com/file.js')).toBe('//cdn.example.com/file.js');
  });
  it('UI-01-H: 空串 → 空串（放行）', () => {
    expect(safeUrlTransform('')).toBe('');
  });
});
