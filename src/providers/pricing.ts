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
// Key = model 名（不是 providerId）
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
 * G-04 修订：双键查表（providerId → 内置 namespace，model → 具体单价）。
 *
 * - providerId === 'deepseek'：按 model 查 PROVIDER_PRICING；model 不在表内 → null。
 * - providerId === 'aihubmix'：Phase 2 暂无 LLM 单价表（aihubmix 主走 vision/image），仍 return null（与 D-14 一致）。
 * - 其余（用户自定义 Provider）：→ null（D-17 维持）。
 *
 * D-13 ①: isBuiltIn 判断下沉至此（providerId === 'deepseek' 才进入价格计算路径）；
 *          自定义 Provider 直接 return null；CostBadge.tsx 不再判 isBuiltIn——
 *          只关心传入的 cnyAmount 是否为 null（null = 不显示 ¥）。
 *
 * **不**用 baseURL 判内置（D-13）；用户改 baseURL 时 providerId 不变，仍能正确计价。
 *
 * 算法：cost_USD = (promptTokens / 1M) * input_price + (completionTokens / 1M) * output_price
 *       cost_CNY = cost_USD * CNY_PER_USD
 *
 * @param usage      token 用量（promptTokens + completionTokens）
 * @param providerId Provider ID（'deepseek' / 'aihubmix' / 自定义 uuid）
 * @param model      模型名称（'deepseek-v4-flash' / 'deepseek-v4-pro' / 用户自定义 model）
 * @returns 成本（CNY），或 null（自定义 Provider / 未知 model 不计价，D-17）
 */
export function calcCostCny(
  usage: { promptTokens: number; completionTokens: number },
  providerId: string,
  model: string,
): number | null {
  // D-13 ①: 内置 isBuiltIn 判断下沉至此（providerId === 'deepseek' 才入价格计算路径，
  //         自定义 Provider 直接 return null）。CostBadge.tsx 不再判 isBuiltIn——本组件
  //         只关心传入的 cnyAmount 是否为 null（null = 不显示 ¥）。
  // 仅 deepseek 内置 namespace 计价（D-14）
  if (providerId !== 'deepseek') return null;

  const pricing = PROVIDER_PRICING[model];
  if (!pricing) return null; // 即便是 'deepseek' providerId，model 未知也不计价（防御）

  const usd =
    (usage.promptTokens / 1_000_000) * pricing.input +
    (usage.completionTokens / 1_000_000) * pricing.output;

  return usd * CNY_PER_USD;
}
