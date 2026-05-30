/**
 * src/lib/docKey.test.ts — Phase 8 HIST-04 docKey 单测
 * 核心：只取 URL pathname 末段 80 字符，跳过 query/hash 中的 session token
 */
import { describe, it, expect } from 'vitest';

// Wave 0 动态 require 兜底范式：docKey 模块在 Plan 04 实现前不存在
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let GLOBAL_CHAT_KEY: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let hashUrl: ((url: string) => string) | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let getDocKey: (() => Promise<string>) | undefined;

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require('./docKey');
  GLOBAL_CHAT_KEY = mod.GLOBAL_CHAT_KEY;
  hashUrl = mod.hashUrl;
  getDocKey = mod.getDocKey;
} catch {
  // Plan 04 实现前：模块不存在，各变量保持 undefined
}

describe('docKey — HIST-04 分文档存储 key 构建', () => {
  it('GLOBAL_CHAT_KEY 常量为 aster:chat:global', () => {
    if (!GLOBAL_CHAT_KEY) return; // RED: Plan 04 实现前占位
    expect(GLOBAL_CHAT_KEY).toBe('aster:chat:global');
  });

  it('GLOBAL_CHAT_KEY 以 aster:chat: 开头', () => {
    if (!GLOBAL_CHAT_KEY) return; // RED: Plan 04 实现前占位
    expect(GLOBAL_CHAT_KEY).toMatch(/^aster:chat:/);
  });
});

// ---------------------------------------------------------------------------
// hashUrl 行为验证（Wave 0 RED 阶段：hashUrl 不存在；Plan 04 实现并导出后 GREEN）
// ---------------------------------------------------------------------------
describe('hashUrl — query string session token 不进 key', () => {
  it('SharePoint URL 含 query token 时，生成的 key 不含 token', () => {
    if (!hashUrl) return; // RED: Plan 04 实现前占位
    const key = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=SECRET_TOKEN&odelay=123');
    expect(key).not.toContain('SECRET_TOKEN');
    expect(key).not.toContain('cid=');
    expect(key).toMatch(/^aster:chat:/);
  });

  it('相同文件名不同 query string 生成相同 key（稳定性）', () => {
    if (!hashUrl) return; // RED: Plan 04 实现前占位
    const key1 = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=TOKEN1');
    const key2 = hashUrl('https://tenant.sharepoint.com/sites/team/file.pptx?cid=TOKEN2');
    expect(key1).toBe(key2);
  });

  it('getDocKey 函数可调用（非 Office 环境 catch → GLOBAL_CHAT_KEY）', async () => {
    if (!getDocKey) return; // RED: Plan 04 实现前占位
    const key = await getDocKey();
    expect(key).toMatch(/^aster:chat:/);
  });
});
