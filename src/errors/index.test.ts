/**
 * TDD RED: 类型化错误类层级测试（FOUND-06）
 *
 * 本文件测试目标：
 * 1. AsterError 基类：继承 Error，带 code/category 字段
 * 2. Provider 层 4 个子类：KeyInvalidError/QuotaExceededError/ContextTooLongError/NetworkError
 * 3. Adapter 层 2 个子类：HostApiError/UnsupportedOperationError
 * 4. instanceof 判别链正确
 * 5. code 字符串与 category 值符合规范
 */
import { describe, it, expect } from 'vitest';
import {
  AsterError,
  KeyInvalidError,
  QuotaExceededError,
  ContextTooLongError,
  NetworkError,
  HostApiError,
  UnsupportedOperationError,
  RateLimitError,
  ContentFilterError,
  ModelNotFoundError,
  ImageQuotaError,
  CircuitOpenError,
  StepLimitError,
  isAsterErrorWithMeta,
} from './index';

describe('AsterError base class', () => {
  it('should extend Error', () => {
    const err = new AsterError('test message', 'TEST_CODE', 'provider');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AsterError);
  });

  it('should have code and category readonly fields', () => {
    const err = new AsterError('msg', 'MY_CODE', 'adapter');
    expect(err.code).toBe('MY_CODE');
    expect(err.category).toBe('adapter');
  });

  it('should have message set correctly', () => {
    const err = new AsterError('hello error', 'X', 'provider');
    expect(err.message).toBe('hello error');
  });

  it('should have name set to class name (new.target.name)', () => {
    const err = new AsterError('msg', 'CODE', 'provider');
    expect(err.name).toBe('AsterError');
  });
});

describe('KeyInvalidError (Provider layer)', () => {
  it('should be instanceof AsterError and KeyInvalidError', () => {
    const err = new KeyInvalidError('Key is invalid');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(KeyInvalidError);
  });

  it('should have code KEY_INVALID', () => {
    const err = new KeyInvalidError('msg');
    expect(err.code).toBe('KEY_INVALID');
  });

  it('should have category provider', () => {
    const err = new KeyInvalidError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name KeyInvalidError', () => {
    const err = new KeyInvalidError('msg');
    expect(err.name).toBe('KeyInvalidError');
  });

  it('should NOT contain API Key in message (T-01-04 security)', () => {
    const err = new KeyInvalidError('API Key 无效，请检查设置');
    // 安全测试：message 内容正常，不嵌入 key 原文
    expect(err.message).not.toContain('sk-');
    expect(err.message).not.toContain('Bearer ');
  });
});

describe('QuotaExceededError (Provider layer)', () => {
  it('should be instanceof AsterError and QuotaExceededError', () => {
    const err = new QuotaExceededError('Quota exceeded');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(QuotaExceededError);
  });

  it('should have code QUOTA', () => {
    const err = new QuotaExceededError('msg');
    expect(err.code).toBe('QUOTA');
  });

  it('should have category provider', () => {
    const err = new QuotaExceededError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name QuotaExceededError', () => {
    const err = new QuotaExceededError('msg');
    expect(err.name).toBe('QuotaExceededError');
  });
});

describe('ContextTooLongError (Provider layer)', () => {
  it('should be instanceof AsterError and ContextTooLongError', () => {
    const err = new ContextTooLongError('Context too long');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(ContextTooLongError);
  });

  it('should have code CONTEXT', () => {
    const err = new ContextTooLongError('msg');
    expect(err.code).toBe('CONTEXT');
  });

  it('should have category provider', () => {
    const err = new ContextTooLongError('msg');
    expect(err.category).toBe('provider');
  });
});

describe('NetworkError (Provider layer)', () => {
  it('should be instanceof AsterError and NetworkError', () => {
    const err = new NetworkError('Network failed');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(NetworkError);
  });

  it('should have code NETWORK', () => {
    const err = new NetworkError('msg');
    expect(err.code).toBe('NETWORK');
  });

  it('should have category provider', () => {
    const err = new NetworkError('msg');
    expect(err.category).toBe('provider');
  });
});

describe('HostApiError (Adapter layer)', () => {
  it('should be instanceof AsterError and HostApiError', () => {
    const err = new HostApiError('Office.js API failed');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(HostApiError);
  });

  it('should have code HOST_API', () => {
    const err = new HostApiError('msg');
    expect(err.code).toBe('HOST_API');
  });

  it('should have category adapter', () => {
    const err = new HostApiError('msg');
    expect(err.category).toBe('adapter');
  });

  it('should accept optional hostError arg for v1 backward-compat but NOT store it on instance (ERR-02)', () => {
    // ERR-02: HostApiError 构造器收到 hostError 参数后不存到实例字段
    // 防 stack/path/Key 片段跨 catch 边界传到 LLM
    const originalError = new Error('raw Office error');
    const err = new HostApiError('wrapped', originalError);
    expect((err as unknown as { hostError?: unknown }).hostError).toBeUndefined();
    expect(Object.keys(err)).not.toContain('hostError');
  });

  it('should have name HostApiError', () => {
    const err = new HostApiError('msg');
    expect(err.name).toBe('HostApiError');
  });

  // 260604-gld：debugCause 仅抽取 cause 的 message（供 adapter console.warn 到 DevTools）。
  it('[debugCause 260604-gld] 从 Error cause 抽取 message', () => {
    const err = new HostApiError('wrapped', new Error('真实 Office.js 原因'));
    expect(err.debugCause).toBe('真实 Office.js 原因');
  });

  it('[debugCause 260604-gld] 接受 string cause', () => {
    const err = new HostApiError('wrapped', 'GeneralException');
    expect(err.debugCause).toBe('GeneralException');
  });

  it('[debugCause 260604-gld] 截断到 300 字', () => {
    const longMsg = 'x'.repeat(1000);
    const err = new HostApiError('wrapped', new Error(longMsg));
    expect(err.debugCause?.length).toBe(300);
  });

  it('[debugCause 260604-gld] 非 Error/非 string cause → undefined（不存 stack/path 等）', () => {
    const err = new HostApiError('wrapped', { stack: 'x', message: 'sk-abc /Users/me' });
    expect(err.debugCause).toBeUndefined();
  });

  it('[debugCause 260604-gld] 无 cause → undefined', () => {
    const err = new HostApiError('wrapped');
    expect(err.debugCause).toBeUndefined();
  });
});

describe('UnsupportedOperationError (Adapter layer)', () => {
  it('should be instanceof AsterError and UnsupportedOperationError', () => {
    const err = new UnsupportedOperationError('Operation not supported in Phase 1');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(UnsupportedOperationError);
  });

  it('should have code UNSUPPORTED', () => {
    const err = new UnsupportedOperationError('msg');
    expect(err.code).toBe('UNSUPPORTED');
  });

  it('should have category adapter', () => {
    const err = new UnsupportedOperationError('msg');
    expect(err.category).toBe('adapter');
  });

  it('should have name UnsupportedOperationError', () => {
    const err = new UnsupportedOperationError('msg');
    expect(err.name).toBe('UnsupportedOperationError');
  });
});

describe('instanceof discrimination across all subclasses', () => {
  it('all subclasses should be instanceof AsterError but not each other', () => {
    const errors = [
      new KeyInvalidError('k'),
      new QuotaExceededError('q'),
      new ContextTooLongError('c'),
      new NetworkError('n'),
      new HostApiError('h'),
      new UnsupportedOperationError('u'),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(AsterError);
      expect(err).toBeInstanceOf(Error);
    }

    // They should not be instanceof each other
    expect(new KeyInvalidError('k')).not.toBeInstanceOf(QuotaExceededError);
    expect(new HostApiError('h')).not.toBeInstanceOf(UnsupportedOperationError);
    expect(new NetworkError('n')).not.toBeInstanceOf(HostApiError);
  });
});

// ---------------------------------------------------------------------------
// Phase 2 新增错误类
// ---------------------------------------------------------------------------

describe('RateLimitError (Provider layer — Phase 2)', () => {
  it('should be instanceof AsterError and RateLimitError', () => {
    const err = new RateLimitError('Rate limit exceeded');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RateLimitError);
  });

  it('should have code RATE_LIMIT', () => {
    const err = new RateLimitError('msg');
    expect(err.code).toBe('RATE_LIMIT');
  });

  it('should have category provider', () => {
    const err = new RateLimitError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name RateLimitError', () => {
    const err = new RateLimitError('msg');
    expect(err.name).toBe('RateLimitError');
  });

  it('should store retryAfterSeconds when provided', () => {
    const err = new RateLimitError('msg', 30);
    expect(err.retryAfterSeconds).toBe(30);
  });

  it('should have retryAfterSeconds as undefined when not provided', () => {
    const err = new RateLimitError('msg');
    expect(err.retryAfterSeconds).toBeUndefined();
  });
});

describe('ContentFilterError (Provider layer — Phase 2)', () => {
  it('should be instanceof AsterError and ContentFilterError', () => {
    const err = new ContentFilterError('Content filtered');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ContentFilterError);
  });

  it('should have code FILTER', () => {
    const err = new ContentFilterError('msg');
    expect(err.code).toBe('FILTER');
  });

  it('should have category provider', () => {
    const err = new ContentFilterError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name ContentFilterError', () => {
    const err = new ContentFilterError('msg');
    expect(err.name).toBe('ContentFilterError');
  });
});

describe('ModelNotFoundError (Provider layer — Phase 2)', () => {
  it('should be instanceof AsterError and ModelNotFoundError', () => {
    const err = new ModelNotFoundError('Model not found');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ModelNotFoundError);
  });

  it('should have code MODEL', () => {
    const err = new ModelNotFoundError('msg');
    expect(err.code).toBe('MODEL');
  });

  it('should have category provider', () => {
    const err = new ModelNotFoundError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name ModelNotFoundError', () => {
    const err = new ModelNotFoundError('msg');
    expect(err.name).toBe('ModelNotFoundError');
  });
});

describe('ImageQuotaError (Provider layer — Phase 2)', () => {
  it('should be instanceof AsterError and ImageQuotaError', () => {
    const err = new ImageQuotaError('Image quota exhausted');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ImageQuotaError);
  });

  it('should have code IMAGE_QUOTA', () => {
    const err = new ImageQuotaError('msg');
    expect(err.code).toBe('IMAGE_QUOTA');
  });

  it('should have category provider', () => {
    const err = new ImageQuotaError('msg');
    expect(err.category).toBe('provider');
  });

  it('should have name ImageQuotaError', () => {
    const err = new ImageQuotaError('msg');
    expect(err.name).toBe('ImageQuotaError');
  });
});

// ---------------------------------------------------------------------------
// Phase 3 ERR-01/ERR-02：四字段强制（recoverable + hint）+ 新增 CircuitOpenError / StepLimitError
// + isAsterErrorWithMeta 类型守卫
// ---------------------------------------------------------------------------

describe('AsterError 子类四字段（ERR-01）', () => {
  const subclasses = [
    new KeyInvalidError('Key 无效'),
    new QuotaExceededError('配额'),
    new ContextTooLongError('过长'),
    new NetworkError('网络'),
    new RateLimitError('限流'),
    new ContentFilterError('过滤'),
    new ModelNotFoundError('模型'),
    new HostApiError('宿主'),
    new UnsupportedOperationError('不支持'),
    new ImageQuotaError('图配额'),
    new CircuitOpenError('append_paragraph'),
    new StepLimitError(),
  ];

  it.each(subclasses)(
    '$constructor.name 有 recoverable boolean + hint 中文非空 + code + message',
    (err) => {
      expect(typeof (err as unknown as { recoverable: unknown }).recoverable).toBe('boolean');
      expect(typeof (err as unknown as { hint: unknown }).hint).toBe('string');
      expect((err as unknown as { hint: string }).hint.length).toBeGreaterThan(0);
      expect(typeof err.code).toBe('string');
      expect(typeof err.message).toBe('string');
      expect(err).toBeInstanceOf(AsterError);
    },
  );
});

describe('HostApiError 不存 hostError 字段（ERR-02 防 stack/path 跨边界）', () => {
  it('Object.keys 不含 hostError 即使构造时传了 hostError', () => {
    const fakeHostErr = { stack: '/Users/wb.chen/foo.ts:42 sk-abc123' };
    const err = new HostApiError('Word append_paragraph 失败', fakeHostErr);
    expect(Object.keys(err)).not.toContain('hostError');
    expect((err as unknown as { hostError?: unknown }).hostError).toBeUndefined();
  });
});

describe('CircuitOpenError（新增 — ERR-01）', () => {
  it('message 含 toolName interpolation + hint 字面量 + recoverable=false', () => {
    const err = new CircuitOpenError('append_paragraph');
    expect(err.message).toContain('append_paragraph');
    expect(err.message).toContain('连续失败');
    expect(err.hint).toBe('换个 tool 或换个思路再试');
    expect(err.recoverable).toBe(false);
    expect(err.code).toBe('CIRCUIT_OPEN');
    expect(err.category).toBe('adapter');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(CircuitOpenError);
  });
});

describe('StepLimitError（新增 — ERR-01）', () => {
  it('字面量 message + hint + recoverable=true', () => {
    const err = new StepLimitError();
    expect(err.message).toBe('已达单轮步数上限');
    expect(err.hint).toBe('已达单轮上限，请确认是否继续');
    expect(err.recoverable).toBe(true);
    expect(err.code).toBe('STEP_LIMIT');
    expect(err.category).toBe('adapter');
    expect(err).toBeInstanceOf(AsterError);
    expect(err).toBeInstanceOf(StepLimitError);
  });
});

describe('isAsterErrorWithMeta 类型守卫（ERR-02 sanitize 入口）', () => {
  it('真：AsterError 子类带 recoverable+hint', () => {
    expect(isAsterErrorWithMeta(new KeyInvalidError('x'))).toBe(true);
    expect(isAsterErrorWithMeta(new HostApiError('x'))).toBe(true);
    expect(isAsterErrorWithMeta(new CircuitOpenError('t'))).toBe(true);
    expect(isAsterErrorWithMeta(new StepLimitError())).toBe(true);
    expect(isAsterErrorWithMeta(new ImageQuotaError('x'))).toBe(true);
  });

  it('假：普通 Error / 字符串 / null / undefined / 对象', () => {
    expect(isAsterErrorWithMeta(new Error('plain'))).toBe(false);
    expect(isAsterErrorWithMeta('string')).toBe(false);
    expect(isAsterErrorWithMeta(null)).toBe(false);
    expect(isAsterErrorWithMeta(undefined)).toBe(false);
    expect(isAsterErrorWithMeta({ recoverable: true, hint: 'fake' })).toBe(false);
    expect(isAsterErrorWithMeta(42)).toBe(false);
  });

  it('假：裸 AsterError 基类实例没有 recoverable / hint 字段', () => {
    const bare = new AsterError('bare', 'CODE', 'provider');
    expect(isAsterErrorWithMeta(bare)).toBe(false);
  });
});

describe('现有 8 子类中文 hint 字面量（D-15）', () => {
  it('每类 hint 是预期中文字面量', () => {
    expect(new KeyInvalidError('x').hint).toBe('请前往设置更新 API Key');
    expect(new QuotaExceededError('x').hint).toBe(
      '配额已用完，请检查 Provider 账户余额或换 Provider',
    );
    expect(new ContextTooLongError('x').hint).toBe('请缩短对话或清空历史后重试');
    expect(new NetworkError('x').hint).toBe('网络异常，请检查连接后重试');
    expect(new RateLimitError('x').hint).toBe('请稍后再试（已退避）');
    expect(new ContentFilterError('x').hint).toBe('内容被 Provider 过滤，请改写提示');
    expect(new ModelNotFoundError('x').hint).toBe('请到设置确认模型名称是否正确');
    expect(new HostApiError('x').hint).toBe('宿主操作可瞬时失败，可重试一次');
    expect(new UnsupportedOperationError('x').hint).toBe('该操作在当前宿主不支持');
    expect(new ImageQuotaError('x').hint).toBe('图像配额已用完，请稍后再试或换 Provider');
  });
});

describe('继承链不破坏（ERR-01 兼容性）', () => {
  it('全部子类 instanceof AsterError === true 且 name 反映子类名', () => {
    const cases: Array<{ err: AsterError; name: string }> = [
      { err: new KeyInvalidError('x'), name: 'KeyInvalidError' },
      { err: new CircuitOpenError('t'), name: 'CircuitOpenError' },
      { err: new StepLimitError(), name: 'StepLimitError' },
    ];
    for (const { err, name } of cases) {
      expect(err).toBeInstanceOf(AsterError);
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe(name);
    }
  });
});
