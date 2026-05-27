/**
 * src/providers/pricing.ts — 成本徽章计算（COST-01/02 / D-09/D-17）
 *
 * 单价写死，不可由用户覆写（D-09）。
 * 自定义 Provider 返回 null（不显示价格，D-17 / COST-02 修订）。
 * 汇率常数 CNY_PER_USD = 7.25（2026-05 均值，非实时，D-17 discretion）。
 * 徽章显示「约 ¥X.XXXX」，「约」字标注非实时汇率（RESEARCH.md §成本徽章计算）。
 */

// ---------------------------------------------------------------------------
// 内置单价表（USD per 1M tokens）
// 来源：CLAUDE.md §DeepSeek 单价表（已验证）
// ---------------------------------------------------------------------------

const PROVIDER_PRICING: Record<string, { input: number; output: number } | undefined> = {
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 1.74, output: 3.48 },
  // aihubmix 生图按 image token 计费，Phase 2 暂无准确单价（A2 assumption）
  // Phase 4 补充 aihubmix 图像成本计算
};

// ---------------------------------------------------------------------------
// 公共常量
// ---------------------------------------------------------------------------

/** 内置固定汇率（USD → CNY，非实时，2026-05 均值） */
export const CNY_PER_USD = 7.25;

// ---------------------------------------------------------------------------
// calcCostCny
// ---------------------------------------------------------------------------

/**
 * 计算本次请求的人民币成本。
 *
 * 算法：cost_USD = (promptTokens / 1M) * input_price + (completionTokens / 1M) * output_price
 *       cost_CNY = cost_USD * CNY_PER_USD
 *
 * @param usage     token 用量（promptTokens + completionTokens）
 * @param providerId Provider ID（须为内置 deepseek 型号之一）
 * @returns 成本（CNY），或 null（自定义 Provider 不计价，D-17）
 */
export function calcCostCny(
  usage: { promptTokens: number; completionTokens: number },
  providerId: string,
): number | null {
  const pricing = PROVIDER_PRICING[providerId];
  if (!pricing) return null; // 自定义 Provider — 只显 token 数，无价格（D-17）

  const usd =
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output;

  return usd * CNY_PER_USD;
}
