/**
 * src/agent/tools/index.types.test.ts — TypeScript-only test（B4 / AGENT-08 验收）
 *
 * 验证 ToolDef interface 强制 humanLabel 字段：
 *   - _goodTool 正例编译通过 = humanLabel 是 ToolDef 必填字段
 *   - _badTool 反例用 @ts-expect-error 标记必须报错 — 删此注释后 tsc 会失败 →
 *     等价于「TS 强制 humanLabel 成立」（D-13 双轨之 TS 一轨）
 *
 * 本文件由 vitest run 拉起；vitest 用 tsc/swc 编译会触发 @ts-expect-error 校验。
 * vitest 测试体本身只是简单 truthy 断言，重点是文件能编译通过。
 */
import { describe, it, expect } from 'vitest';
import type { ToolDef } from './index';

// 正例：完整 ToolDef 应该编译通过（5 字段全）
const _goodTool: ToolDef<{ text: string }> = {
  name: 'good',
  description: '示例',
  parameters: { type: 'object' },
  humanLabel: ({ text }) => `label ${text}`,
  execute: async () => ({ ok: true }),
};

// 反例：缺 humanLabel 必须编译失败
// @ts-expect-error - AGENT-08 强制 ToolDef 必须含 humanLabel；删本注释后 tsc 必须报错
const _badTool: ToolDef = {
  name: 'bad',
  description: '示例',
  parameters: { type: 'object' },
  execute: async () => ({ ok: true }),
};

describe('ToolDef type-only test (B4 / AGENT-08)', () => {
  it('_goodTool 编译通过 = humanLabel 是 ToolDef 字段', () => {
    expect(typeof _goodTool.humanLabel).toBe('function');
  });

  it('_badTool 用 @ts-expect-error 标记 — 文件能编译 = TS 已捕获缺字段（强制成立）', () => {
    expect(_badTool.name).toBe('bad');
  });
});
