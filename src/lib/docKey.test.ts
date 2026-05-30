/**
 * src/lib/docKey.test.ts — Phase 8 HIST-04 docKey 单测
 * 核心：只取 URL pathname 末段 80 字符，跳过 query/hash 中的 session token
 */
import { describe, it, expect } from 'vitest';
import { GLOBAL_CHAT_KEY, hashUrl, getDocKey } from './docKey';

describe('docKey — HIST-04 分文档存储 key 构建', () => {
  it('GLOBAL_CHAT_KEY 常量为 aster:chat:global', () => {
    expect(GLOBAL_CHAT_KEY).toBe('aster:chat:global');
  });

  it('GLOBAL_CHAT_KEY 以 aster:chat: 开头', () => {
    expect(GLOBAL_CHAT_KEY).toMatch(/^aster:chat:/);
  });
});

describe('hashUrl — query string session token 不进 key', () => {
  it('SharePoint URL 含 query token 时，生成的 key 不含 token', () => {
    const key = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=SECRET_TOKEN&odelay=123');
    expect(key).not.toContain('SECRET_TOKEN');
    expect(key).not.toContain('cid=');
    expect(key).toMatch(/^aster:chat:/);
  });

  it('相同文件名不同 query string 生成相同 key（稳定性）', () => {
    const key1 = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=TOKEN1');
    const key2 = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=TOKEN2');
    expect(key1).toBe(key2);
  });

  it('不同文件名生成不同 key', () => {
    const key1 = hashUrl('https://tenant.sharepoint.com/sites/team/fileA.pptx');
    const key2 = hashUrl('https://tenant.sharepoint.com/sites/team/fileB.pptx');
    expect(key1).not.toBe(key2);
  });

  it('生成的 key 不含原始 URL 中的路径字符串（btoa 变体已编码）', () => {
    const url = 'https://tenant.sharepoint.com/sites/team/重要文件.pptx';
    const key = hashUrl(url);
    expect(key).not.toContain('重要文件');
    expect(key).toMatch(/^aster:chat:/);
  });

  it('空字符串 fallback 到 GLOBAL_CHAT_KEY 或合法 key', () => {
    const key = hashUrl('');
    expect(key).toMatch(/^aster:chat:/);
  });
});

describe('getDocKey — Office 环境外 fallback', () => {
  it('getDocKey 函数可调用（非 Office 环境 catch → GLOBAL_CHAT_KEY）', async () => {
    // 非 Office 环境（vitest）：Office 未定义，catch → GLOBAL_CHAT_KEY
    const key = await getDocKey();
    expect(key).toMatch(/^aster:chat:/);
  });
});
