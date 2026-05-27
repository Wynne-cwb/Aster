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

  it('should accept optional hostError cause', () => {
    const originalError = new Error('raw Office error');
    const err = new HostApiError('wrapped', originalError);
    expect(err.hostError).toBe(originalError);
  });

  it('should have name HostApiError', () => {
    const err = new HostApiError('msg');
    expect(err.name).toBe('HostApiError');
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
