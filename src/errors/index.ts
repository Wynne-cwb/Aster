/**
 * Aster 类型化错误类层级（FOUND-06 + Phase 3 ERR-01 / ERR-02）
 *
 * 两层结构：
 * - Provider 层（category='provider'）：LLM/图像 API 调用错误
 * - Adapter 层（category='adapter'）：Office.js 宿主 API 错误
 *
 * 安全约束（T-01-04 + ERR-02）：
 * - 所有子类的 message 字段禁止嵌入 API Key 或凭证原文
 * - message / hint 必须是构造时中文字面量，不允许 string interpolation 嵌入 dynamic
 *   内容（stack / path / err.message）。CircuitOpenError 的 toolName 是受控 literal
 *   subset（tool registry 返的 'append_paragraph' / 'get_paragraph_count' 等）唯一例外。
 * - HostApiError 构造器收到 hostError 参数后**不存进实例字段**，防 stack/path 跨 catch
 *   边界传到 LLM；调试用 console.warn 由 adapter 层直接打到 DevTools。
 *
 * code 值与 Phase 2 PROV-08 + Phase 3 Plan 03 ToolError 枚举对齐。
 *
 * 本文件为纯类层，无外部依赖。
 */

// ---------------------------------------------------------------------------
// 基类
// ---------------------------------------------------------------------------

/**
 * AsterError — 所有 Aster 自定义错误的基类。
 *
 * 注意：子类构造器中使用 `new.target.name` 来保证 `this.name` 为子类名。
 * 需要 tsconfig `useDefineForClassFields: true` 且 target ≥ ES2015。
 *
 * ERR-01 四字段强制（基类只保 code / message / category；子类必须再补 recoverable + hint）：
 * - `code: string` — 稳定枚举值（KEY_INVALID / HOST_API / CIRCUIT_OPEN 等）
 * - `message: string` — 中文字面量人类可读描述
 * - `recoverable: boolean` — 此错误是否可立即重试（Plan 03 dispatch decide 用）
 * - `hint: string` — 中文字面量 UX 提示（"请前往设置更新 API Key" 等）
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
  public readonly recoverable = false;
  public readonly hint = '请前往设置更新 API Key';
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
  public readonly recoverable = false;
  public readonly hint = '配额已用完，请检查 Provider 账户余额或换 Provider';
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
  public readonly recoverable = false;
  public readonly hint = '请缩短对话或清空历史后重试';
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
  public readonly recoverable = true;
  public readonly hint = '网络异常，请检查连接后重试';
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
  public readonly recoverable = true;
  public readonly hint = '请稍后再试（已退避）';
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
  public readonly recoverable = false;
  public readonly hint = '内容被 Provider 过滤，请改写提示';
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
  public readonly recoverable = false;
  public readonly hint = '请到设置确认模型名称是否正确';
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
  public readonly recoverable = false;
  public readonly hint = '图像配额已用完，请稍后再试或换 Provider';
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
 * ⚠ ERR-02 关键改造：构造器仍接收 `_hostError` 参数（保持 v1 调用点
 * `throw new HostApiError('xx', err)` 向后兼容），但**不**把 hostError 存到实例字段。
 * 原因：hostError 可能包含 Office.js 内部 stack / 绝对路径 / Key 片段，若挂在 error 实例
 * 字段上，会跨 catch 边界被 Plan 03 dispatchTool 的 sanitize 路径间接序列化到 LLM。
 *
 * 调试需要时由 adapter 层在 throw 前 `console.warn('host err', err)` 打到 DevTools，
 * 不挂在 AsterError 实例上。
 */
export class HostApiError extends AsterError {
  public readonly recoverable = true;
  public readonly hint = '宿主操作可瞬时失败，可重试一次';

  constructor(message: string, _hostError?: unknown) {
    super(message, 'HOST_API', 'adapter');
    // ⚠ 关键：不把 _hostError 存到实例字段上（防 stack/path 跨 catch 边界传到 LLM）。
    // 调试需要时由 adapter 层 console.warn 直接打到 DevTools。
    void _hostError;
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
  public readonly recoverable = false;
  public readonly hint = '该操作在当前宿主不支持';
  constructor(message: string) {
    super(message, 'UNSUPPORTED', 'adapter');
  }
}

/**
 * CircuitOpenError — Plan 03 agent loop 同 tool 连续失败 N 次后强制熔断。
 * code: 'CIRCUIT_OPEN'
 *
 * 注意：toolName 来自 tool registry 受控 string literal subset（'append_paragraph' /
 * 'get_paragraph_count' / 'replace_paragraph_text' / 'list_paragraphs'），允许
 * interpolation 进 message。其它 dynamic 内容（stack / path / err.message）均禁止。
 *
 * recoverable = false：熔断后该 tool 不可在同一轮再被 LLM 调用；hint 提示换思路。
 */
export class CircuitOpenError extends AsterError {
  public readonly recoverable = false;
  public readonly hint = '换个 tool 或换个思路再试';
  constructor(toolName: string) {
    super(`工具 ${toolName} 连续失败，已强制停止`, 'CIRCUIT_OPEN', 'adapter');
  }
}

/**
 * StepLimitError — Plan 03 agent loop 单轮 step 数到上限（默认 20）。
 * code: 'STEP_LIMIT'
 *
 * message / hint 全为字面量。recoverable = true：用户可点「继续」开新一轮 loop。
 */
export class StepLimitError extends AsterError {
  public readonly recoverable = true;
  public readonly hint = '已达单轮上限，请确认是否继续';
  constructor() {
    super('已达单轮 20 步上限', 'STEP_LIMIT', 'adapter');
  }
}

// ---------------------------------------------------------------------------
// 类型守卫
// ---------------------------------------------------------------------------

/**
 * 类型守卫：判断 unknown 是否 AsterError 子类且带 recoverable + hint 元数据。
 *
 * Plan 03 dispatchTool 的 sanitize 路径用这个守卫决定是否走「只取四字段」路径
 * （code / message / recoverable / hint），其余路径走兜底 UNSUPPORTED + 占位 hint。
 *
 * 注意：基类 AsterError 实例本身不带 recoverable / hint，所以本守卫返 false；
 * 只有 10 个子类（KeyInvalidError / QuotaExceededError / ContextTooLongError /
 * NetworkError / RateLimitError / ContentFilterError / ModelNotFoundError /
 * HostApiError / UnsupportedOperationError / ImageQuotaError / CircuitOpenError /
 * StepLimitError）实例返 true。
 */
export function isAsterErrorWithMeta(e: unknown): e is AsterError & {
  recoverable: boolean;
  hint: string;
} {
  return (
    e instanceof AsterError &&
    typeof (e as { recoverable?: unknown }).recoverable === 'boolean' &&
    typeof (e as { hint?: unknown }).hint === 'string'
  );
}
