/**
 * src/providers/pricing.test.ts — calcCostCny 定价计算测试（COST-01/02）
 *
 * 测试覆盖：
 * - deepseek-v4-flash 成本计算（含精度验证 ≈ 3.045）
 * - deepseek-v4-pro 成本计算（返回 number > 0）
 * - 自定义 Provider 返回 null
 * - 零 token 返回 0
 * - CNY_PER_USD 常量值验证
 * - G-04 双键查表：(providerId, model) 路由（含 TDD RED → GREEN 用例）
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
  // G-04 修订：调用方式改为 (usage, 'deepseek', modelName) 双键路由
  // -------------------------------------------------------------------------

  it('1M prompt + 1M completion tokens on deepseek-v4-flash ≈ 3.045 CNY', () => {
    const result = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek',
      'deepseek-v4-flash',
    );
    // (0.14 + 0.28) * 7.25 = 0.42 * 7.25 = 3.045
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(3.045, 3);
  });

  it('promptTokens=1M, completionTokens=0, deepseek-v4-flash ≈ 0.14 * 7.25', () => {
    const result = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 0 },
      'deepseek',
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
      'deepseek',
      'deepseek-v4-pro',
    );
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(0);
  });

  it('1M prompt + 1M completion on deepseek-v4-pro 成本远高于 flash', () => {
    const flash = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek',
      'deepseek-v4-flash',
    )!;
    const pro = calcCostCny(
      { promptTokens: 1_000_000, completionTokens: 1_000_000 },
      'deepseek',
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
      'some-model',
    );
    expect(result).toBeNull();
  });

  it('空字符串 providerId 返回 null', () => {
    const result = calcCostCny({ promptTokens: 100, completionTokens: 50 }, '', 'some-model');
    expect(result).toBeNull();
  });

  // -------------------------------------------------------------------------
  // 零 token
  // -------------------------------------------------------------------------

  it('0 token on deepseek-v4-flash 返回 0', () => {
    const result = calcCostCny(
      { promptTokens: 0, completionTokens: 0 },
      'deepseek',
      'deepseek-v4-flash',
    );
    expect(result).toBe(0);
  });

  it('0 token on deepseek-v4-pro 返回 0', () => {
    const result = calcCostCny(
      { promptTokens: 0, completionTokens: 0 },
      'deepseek',
      'deepseek-v4-pro',
    );
    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// G-04: calcCostCny — providerId + model 双键查表
// ---------------------------------------------------------------------------
// 覆盖三段排查（D-13 ①②③）：
// ① isBuiltIn 判断下沉至 calcCostCny（providerId 为单一真相来源）
// ② chatStore 收 usage 后传 config.model（不只传 providerId）
// ③ 不用 baseURL 判内置（用 providerId === 'deepseek'）
// Task 2 GREEN 阶段：所有用例均通过（签名已扩展为三参数，RED 标注已移除）。
// ---------------------------------------------------------------------------

describe('calcCostCny — providerId + model 双键查表（G-04）', () => {
  // Test A: deepseek + v4-flash → 非 0 数字
  // (1000/1e6)*0.14 + (1000/1e6)*0.28 = 0.00042 USD * 7.25 = 0.003045 CNY
  it('Test A: deepseek + deepseek-v4-flash → 约 ¥0.003045', () => {
    const usage = { promptTokens: 1000, completionTokens: 1000 };
    const cost = calcCostCny(usage, 'deepseek', 'deepseek-v4-flash');
    expect(cost).toBeCloseTo(0.003045, 5);
  });

  // Test B: deepseek + v4-pro → 非 0，且显著大于 flash
  // (1000/1e6)*1.74 + (1000/1e6)*3.48 = 0.00522 USD * 7.25 = 0.037845 CNY
  it('Test B: deepseek + deepseek-v4-pro → 约 ¥0.037845（显著大于 flash）', () => {
    const usage = { promptTokens: 1000, completionTokens: 1000 };
    const cost = calcCostCny(usage, 'deepseek', 'deepseek-v4-pro');
    expect(cost).toBeCloseTo(0.037845, 5);
  });

  // Test C: deepseek + 未知 model → null（model 不在内置表）
  it('Test C: deepseek + unknown-model → null', () => {
    const usage = { promptTokens: 1000, completionTokens: 1000 };
    const cost = calcCostCny(usage, 'deepseek', 'unknown-model');
    expect(cost).toBeNull();
  });

  // Test D: 自定义 providerId → null（D-17 维持）
  it('Test D: 自定义 providerId + 任意 model → null', () => {
    const usage = { promptTokens: 1000, completionTokens: 1000 };
    const cost = calcCostCny(usage, 'custom-aabb', 'gpt-4');
    expect(cost).toBeNull();
  });

  // Test E: 防回归 — 0 token 返回 0（不是 null）
  it('Test E: deepseek + v4-flash + 0 token → 0（防回归）', () => {
    const usage = { promptTokens: 0, completionTokens: 0 };
    const cost = calcCostCny(usage, 'deepseek', 'deepseek-v4-flash');
    expect(cost).toBe(0);
  });
});
