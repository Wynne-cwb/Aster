/**
 * Aster 类型化错误类层级（FOUND-06）
 *
 * 两层结构：
 * - Provider 层（category='provider'）：LLM/图像 API 调用错误
 * - Adapter 层（category='adapter'）：Office.js 宿主 API 错误
 *
 * 安全约束（T-01-04）：所有子类的 message 字段禁止嵌入 API Key 或凭证原文。
 * code 值与 Phase 2 PROV-08 的 8 类错误 UX 对齐（KEY_INVALID/QUOTA/CONTEXT/NETWORK）。
 *
 * 本文件为纯类层，无外部依赖。Phase 2+ 在实际业务路径中抛出这些错误。
 */

// ---------------------------------------------------------------------------
// 基类
// ---------------------------------------------------------------------------

/**
 * AsterError — 所有 Aster 自定义错误的基类。
 *
 * 注意：子类构造器中使用 `new.target.name` 来保证 `this.name` 为子类名。
 * 需要 tsconfig `useDefineForClassFields: true` 且 target ≥ ES2015。
 */
export class AsterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly category: 'provider' | 'adapter',
  ) {
    super(message);
    // 保证 instanceof 在 TypeScript 编译到 ES5 时也能正常工作
    Object.setPrototypeOf(this, new.target.prototype);
    // 保证子类 name 反映真实类名
    this.name = new.target.name;
  }
}

// ---------------------------------------------------------------------------
// Provider 层错误（category = 'provider'）
// 对应 Phase 2 PROV-08 的 KEY_INVALID/QUOTA/CONTEXT/NETWORK 四类 UX
//
// 安全约束（T-01-04）：实例化时 message 禁止包含 API Key 原文
// ---------------------------------------------------------------------------

/**
 * KeyInvalidError — API Key 无效或格式错误。
 * code: 'KEY_INVALID'
 * Phase 2 UX CTA: "去设置更新 Key"
 */
export class KeyInvalidError extends AsterError {
  constructor(message: string) {
    super(message, 'KEY_INVALID', 'provider');
  }
}

/**
 * QuotaExceededError — 账户配额已用完（HTTP 402 / 余额不足）。
 * code: 'QUOTA'
 * Phase 2 UX CTA: "前往 Provider 充值"
 */
export class QuotaExceededError extends AsterError {
  constructor(message: string) {
    super(message, 'QUOTA', 'provider');
  }
}

/**
 * ContextTooLongError — 输入超出 Provider context window。
 * code: 'CONTEXT'
 * Phase 2 UX CTA: "上传文件过大请裁剪 / 切换更大 context 的模型"
 */
export class ContextTooLongError extends AsterError {
  constructor(message: string) {
    super(message, 'CONTEXT', 'provider');
  }
}

/**
 * NetworkError — 网络连接失败（fetch reject、超时、DNS 失败等）。
 * code: 'NETWORK'
 * Phase 2 UX CTA: "检查网络连接后重试"
 */
export class NetworkError extends AsterError {
  constructor(message: string) {
    super(message, 'NETWORK', 'provider');
  }
}

/**
 * RateLimitError — 请求频率超限（HTTP 429）。
 * code: 'RATE_LIMIT'
 * Phase 2 UX: 自动指数退避，显示「请求过快，正在自动重试…」
 *
 * retryAfterSeconds: 来自 Retry-After 响应头（秒数）；未提供时由 withRetry 自行计算退避。
 * 安全约束（T-01-04）：message 禁止嵌入 API Key 原文。
 */
export class RateLimitError extends AsterError {
  constructor(
    message: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(message, 'RATE_LIMIT', 'provider');
  }
}

/**
 * ContentFilterError — 内容被 Provider 安全策略过滤（400/422 中含 content_policy 关键词）。
 * code: 'FILTER'
 * Phase 2 UX CTA: 「内容被过滤，请修改输入内容」
 * 安全约束（T-01-04）：message 禁止嵌入 API Key 原文。
 */
export class ContentFilterError extends AsterError {
  constructor(message: string) {
    super(message, 'FILTER', 'provider');
  }
}

/**
 * ModelNotFoundError — 模型 ID 不存在（HTTP 404）或 ProviderRegistry 路由失败。
 * code: 'MODEL'
 * Phase 2 UX CTA: 「模型不存在，请在设置中检查模型名称 →」
 * 安全约束（T-01-04）：message 禁止嵌入 API Key 原文。
 */
export class ModelNotFoundError extends AsterError {
  constructor(message: string) {
    super(message, 'MODEL', 'provider');
  }
}

/**
 * ImageQuotaError — aihubmix 图像生成配额用尽（aihubmix 专属错误）。
 * code: 'IMAGE_QUOTA'
 * Phase 2 UX CTA: 「图像生成配额用尽，前往 aihubmix 充值 →」
 * 注意：此错误属于 billing 类，withRetry 不得自动重试（PROV-09）。
 * 安全约束（T-01-04）：message 禁止嵌入 API Key 原文。
 */
export class ImageQuotaError extends AsterError {
  constructor(message: string) {
    super(message, 'IMAGE_QUOTA', 'provider');
  }
}

// ---------------------------------------------------------------------------
// Adapter 层错误（category = 'adapter'）
// ---------------------------------------------------------------------------

/**
 * HostApiError — Office.js 宿主 API 调用失败。
 * code: 'HOST_API'
 *
 * 可选字段 `hostError` 存储原始 Office.js 抛出的错误对象，
 * 便于调试（不对用户暴露）。
 */
export class HostApiError extends AsterError {
  /** 原始 Office.js 错误（调试用，不在 UI 层展示） */
  public readonly hostError?: unknown;

  constructor(message: string, hostError?: unknown) {
    super(message, 'HOST_API', 'adapter');
    this.hostError = hostError;
  }
}

/**
 * UnsupportedOperationError — 当前宿主不支持该操作。
 * code: 'UNSUPPORTED'
 *
 * Phase 1 adapter 桩方法（如 insert()）抛此错误，
 * Phase 2-6 替换为真实实现后此错误不再被抛出。
 */
export class UnsupportedOperationError extends AsterError {
  constructor(message: string) {
    super(message, 'UNSUPPORTED', 'adapter');
  }
}
