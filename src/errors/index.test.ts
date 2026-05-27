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
