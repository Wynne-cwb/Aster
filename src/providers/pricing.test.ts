/**
 * src/providers/pricing.test.ts — calcCostCny 定价计算测试（COST-01/02）
 *
 * 测试覆盖：
 * - deepseek-v4-flash 成本计算（含精度验证 ≈ 3.045）
 * - deepseek-v4-pro 成本计算（返回 number > 0）
 * - 自定义 Provider 返回 null
 * - 零 token 返回 0
 * - CNY_PER_USD 常量值验证
 */

import { describe, it, expect } from 'vitest';
import { calcCostCny, CNY_PER_USD } from './pricing';

describe('CNY_PER_USD 常量', () => {
  it('CNY_PER_USD 等于 7.25（D-17 固定汇率）', () => {
    expect(CNY_PER_USD).toBe(7.25);
  });
});

describe('calcCostCny', () => {
  // -------------------------------------------------------------------------
  // deepseek-v4-flash 精度验证
  // -------------------------------------------------------------------------

  it('1M prompt + 1M completion tokens on deepseek-v4-flash ≈ 3.045 CNY', () => {
    const result = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek-v4-flash',
    );
    // (0.14 + 0.28) * 7.25 = 0.42 * 7.25 = 3.045
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(3.045, 3);
  });

  it('promptTokens=1M, completionTokens=0, deepseek-v4-flash ≈ 0.14 * 7.25', () => {
    const result = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 0 },
      'deepseek-v4-flash',
    );
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(0.14 * 7.25, 4);
  });

  // -------------------------------------------------------------------------
  // deepseek-v4-pro 基本验证
  // -------------------------------------------------------------------------

  it('小量 token 在 deepseek-v4-pro 返回 number > 0', () => {
    const result = calcCostCny(
      { promptTokens: 100, completionTokens: 50 },
      'deepseek-v4-pro',
    );
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('1M prompt + 1M completion on deepseek-v4-pro 成本远高于 flash', () => {
    const flash = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek-v4-flash',
    )!;
    const pro = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek-v4-pro',
    )!;
    expect(pro).toBeGreaterThan(flash);
  });

  // -------------------------------------------------------------------------
  // 自定义 Provider → null
  // -------------------------------------------------------------------------

  it('自定义 Provider ID 返回 null', () => {
    const result = calcCostCny(
      { promptTokens: 100, completionTokens: 50 },
      'my-custom-provider',
    );
    expect(result).toBeNull();
  });

  it('空字符串 providerId 返回 null', () => {
    const result = calcCostCny({ promptTokens: 100, completionTokens: 50 }, '');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 零 token
  // -------------------------------------------------------------------------

  it('0 token on deepseek-v4-flash 返回 0', () => {
    const result = calcCostCny(
      { promptTokens: 0, completionTokens: 0 },
      'deepseek-v4-flash',
    );
    expect(result).toBe(0);
  });

  it('0 token on deepseek-v4-pro 返回 0', () => {
    const result = calcCostCny(
      { promptTokens: 0, completionTokens: 0 },
      'deepseek-v4-pro',
    );
    expect(result).toBe(0);
  });
});
