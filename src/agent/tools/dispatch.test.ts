import { describe, it, expect } from 'vitest';
import { dispatchTool, type ToolDef } from './index';
import {
  HostApiError,
  CircuitOpenError,
  KeyInvalidError,
  QuotaExceededError,
  ContextTooLongError,
  NetworkError,
  RateLimitError,
  ContentFilterError,
  ModelNotFoundError,
  StepLimitError,
  UnsupportedOperationError,
} from '../../errors';
import type { DocumentAdapter } from '../../adapters/DocumentAdapter';

const mockAdapter = {
  capabilities: () => ({
    host: 'word' as const,
    supportsSelectionEvents: true,
    supportedInserts: ['text'] as const,
  }),
  getSelection: async () => ({ kind: 'none' as const }),
  onSelectionChanged: () => () => {},
  insert: async () => {},
} as unknown as DocumentAdapter;

function makeCtx() {
  return {
    adapter: mockAdapter,
    runId: 'r1',
    stepIndex: 1,
    signal: new AbortController().signal,
  };
}

describe('dispatchTool — ToolError schema (ERR-01)', () => {
  it('returned error has exactly 4 fields: code/message/recoverable/hint', async () => {
    const tool: ToolDef = {
      name: 'fail_invalid',
      description: '',
      parameters: {},
      humanLabel: () => '',
      async execute() {
        throw new HostApiError('Word append_paragraph 失败');
      },
    };
    const result = await dispatchTool(
      { id: 'c1', name: 'fail_invalid', arguments: {} },
      makeCtx(),
      [tool],
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    const e = result.error!;
    expect(typeof e.code).toBe('string');
    expect(typeof e.message).toBe('string');
    expect(typeof e.recoverable).toBe('boolean');
    expect(typeof e.hint).toBe('string');
    expect(Object.keys(e).sort()).toEqual(['code', 'hint', 'message', 'recoverable']);
  });

  it('code is one of 8 enums', async () => {
    const ALLOWED = [
      'INVALID_ARGS',
      'NOT_FOUND',
      'PERMISSION_DENIED',
      'HOST_API_FAILED',
      'PRIVACY_BLOCKED',
      'CIRCUIT_OPEN',
      'STEP_LIMIT',
      'UNSUPPORTED',
    ] as const;
    const tool: ToolDef = {
      name: 'fail_circuit',
      description: '',
      parameters: {},
      humanLabel: () => '',
      async execute() {
        throw new CircuitOpenError('append_paragraph');
      },
    };
    const result = await dispatchTool(
      { id: 'c1', name: 'fail_circuit', arguments: {} },
      makeCtx(),
      [tool],
    );
    expect(ALLOWED).toContain(result.error!.code as never);
    expect(result.error!.code).toBe('CIRCUIT_OPEN');
  });

  // B6: 覆盖 10 类 AsterError 子类 → ToolError 8 枚举完整 mapping
  it.each([
    ['KeyInvalidError', () => new KeyInvalidError('Key 无效'), 'PERMISSION_DENIED'],
    ['QuotaExceededError', () => new QuotaExceededError('配额'), 'PERMISSION_DENIED'],
    ['ContextTooLongError', () => new ContextTooLongError('过长'), 'INVALID_ARGS'],
    ['NetworkError', () => new NetworkError('网络'), 'HOST_API_FAILED'],
    ['RateLimitError', () => new RateLimitError('限流'), 'HOST_API_FAILED'],
    ['ContentFilterError', () => new ContentFilterError('过滤'), 'INVALID_ARGS'],
    ['ModelNotFoundError', () => new ModelNotFoundError('模型'), 'NOT_FOUND'],
    ['HostApiError', () => new HostApiError('宿主'), 'HOST_API_FAILED'],
    ['CircuitOpenError', () => new CircuitOpenError('t'), 'CIRCUIT_OPEN'],
    ['StepLimitError', () => new StepLimitError(), 'STEP_LIMIT'],
    ['UnsupportedOperationError', () => new UnsupportedOperationError('不支持'), 'UNSUPPORTED'],
  ] as Array<[string, () => Error, string]>)(
    'AsterError 子类 %s 映射到 ToolError code %s（ERR-01 完整 mapping）',
    async (_name, makeErr, expectedCode) => {
      const tool: ToolDef = {
        name: 'm',
        description: '',
        parameters: {},
        humanLabel: () => '',
        async execute() {
          throw makeErr();
        },
      };
      const result = await dispatchTool(
        { id: 'c1', name: 'm', arguments: {} },
        makeCtx(),
        [tool],
      );
      expect(result.ok).toBe(false);
      expect(result.error!.code).toBe(expectedCode);
      // 同时验证四字段完整 + 中文 hint 非空
      expect(typeof result.error!.message).toBe('string');
      expect(typeof result.error!.recoverable).toBe('boolean');
      expect((result.error!.hint ?? '').length).toBeGreaterThan(0);
    },
  );

  it('tool not found → NOT_FOUND', async () => {
    const result = await dispatchTool(
      { id: 'c1', name: 'nonexistent_tool', arguments: {} },
      makeCtx(),
      [],
    );
    expect(result.ok).toBe(false);
    expect(result.error!.code).toBe('NOT_FOUND');
  });
});

describe('dispatchTool — sanitize (ERR-02)', () => {
  it('AsterError 子类：toolResult JSON 不含 stack/path/key（HostApiError 不存 hostError）', async () => {
    const tool: ToolDef = {
      name: 'fail_with_stack',
      description: '',
      parameters: {},
      humanLabel: () => '',
      async execute() {
        // HostApiError 构造器收到 hostError 但不存（Plan 02 改造）
        throw new HostApiError('Word append_paragraph 失败', {
          stack: 'Error\n  at /Users/wb.chen/.../adapter.ts:142',
          message: 'sk-abc123 process.env.FOO=bar /Users/wb.chen/.aster/secret',
        });
      },
    };
    const result = await dispatchTool(
      { id: 'c1', name: 'fail_with_stack', arguments: {} },
      makeCtx(),
      [tool],
    );
    expect(result.ok).toBe(false);
    expect(result.error!.code).toBe('HOST_API_FAILED');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/__dirname/);
    expect(serialized).not.toMatch(/process\.env/);
    expect(serialized).not.toMatch(/sk-/);
    expect(serialized).not.toMatch(/\/Users\//);
  });

  it('陌生异常（非 AsterError） → 兜底 UNSUPPORTED + 占位 hint，且不泄漏 stack/path/key', async () => {
    const tool: ToolDef = {
      name: 'fail_raw',
      description: '',
      parameters: {},
      humanLabel: () => '',
      async execute() {
        const err = new Error(
          '/Users/wb.chen/.../foo.ts:42 Key: sk-abc123 process.env.FOO=bar',
        );
        err.stack = 'Error: ...\n  at /Users/.../...';
        throw err;
      },
    };
    const result = await dispatchTool(
      { id: 'c1', name: 'fail_raw', arguments: {} },
      makeCtx(),
      [tool],
    );
    expect(result.error!.code).toBe('UNSUPPORTED');
    expect(result.error!.message).toBe('宿主操作失败');
    expect(result.error!.hint).toBe('发生错误，请重试');
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/\/Users\//);
    expect(serialized).not.toMatch(/sk-/);
    expect(serialized).not.toMatch(/process\.env/);
  });
});
