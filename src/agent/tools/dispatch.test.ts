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

describe('dispatchTool — PPT casing 归一化（D-12）', () => {
  // 每行格式：[工具名, camelCase 入参, 期望 snake_case args]
  it.each([
    [
      'set_shape_text_font',
      { slideIndex: 2, shapeId: 's1', font: { size: 14 } },
      { slide_index: 2, shape_id: 's1', font: { size: 14 } },
    ],
    [
      'set_shape_text_alignment',
      { slideIndex: 1, shapeId: 's2', alignment: 'Left' },
      { slide_index: 1, shape_id: 's2', alignment: 'Left' },
    ],
    [
      'delete_shape',
      { slideIndex: 3, shapeId: 's3' },
      { slide_index: 3, shape_id: 's3' },
    ],
    [
      'rotate_shape',
      { slideIndex: 1, shapeId: 's1', rotation: 45 },
      { slide_index: 1, shape_id: 's1', rotation: 45 },
    ],
    [
      'manage_slides',
      { operation: 'delete', slideIndex: 2 },
      { operation: 'delete', slide_index: 2 },
    ],
    [
      'set_slide_background',
      { slideIndex: 1, color: '#FF0000' },
      { slide_index: 1, color: '#FF0000' },
    ],
    [
      'copy_slide',
      { sourceIndex: 1, targetIndex: 3 },
      { source_index: 1, target_index: 3 },
    ],
    [
      'add_shape',
      { slideIndex: 1, shapeType: 'Rectangle', position: { left: 0, top: 0, width: 100, height: 100 } },
      { slide_index: 1, shape_type: 'Rectangle', position: { left: 0, top: 0, width: 100, height: 100 } },
    ],
  ] as Array<[string, Record<string, unknown>, Record<string, unknown>]>)(
    '%s：camelCase 与 snake_case 入参都命中正确 args',
    async (toolName, camelArgs, expectedSnakeArgs) => {
      let capturedArgs: unknown;
      const mockTool: ToolDef = {
        name: toolName,
        description: '',
        parameters: {},
        humanLabel: () => '',
        kind: 'write',
        async execute(args) {
          capturedArgs = args;
          return { ok: true as const };
        },
      };

      // camelCase 入参 → normalize → execute 收到 snake_case
      await dispatchTool({ id: 'c1', name: toolName, arguments: camelArgs }, makeCtx(), [mockTool]);
      expect(capturedArgs).toMatchObject(expectedSnakeArgs);

      // snake_case 入参 → normalize 幂等 → execute 仍收到 snake_case
      await dispatchTool({ id: 'c2', name: toolName, arguments: expectedSnakeArgs }, makeCtx(), [mockTool]);
      expect(capturedArgs).toMatchObject(expectedSnakeArgs);
    },
  );

  it('Word 工具不受 PPT normalize 影响——camelCase 保持原样（D-13）', async () => {
    let capturedArgs: unknown;
    const wordTool: ToolDef = {
      name: 'append_paragraph',
      description: '',
      parameters: {},
      humanLabel: () => '',
      kind: 'write',
      async execute(args) {
        capturedArgs = args;
        return { ok: true as const };
      },
    };
    const wordArgs = { afterParagraphIndex: 2, text: 'hello' };
    await dispatchTool(
      { id: 'c1', name: 'append_paragraph', arguments: wordArgs },
      makeCtx(),
      [wordTool],
    );
    // camelCase 保持原样（Word 工具不在 PPT_TOOLS set 里）
    expect(capturedArgs).toMatchObject(wordArgs);
  });

  it('position 嵌套 object 的 key 不被 normalize 改动（A2 风险缓解）', async () => {
    let capturedArgs: unknown;
    const pptTool: ToolDef = {
      name: 'add_shape',
      description: '',
      parameters: {},
      humanLabel: () => '',
      kind: 'write',
      async execute(args) {
        capturedArgs = args;
        return { ok: true as const };
      },
    };
    // position 嵌套 object 的 key（left/top/width/height）是小写，normalize 后不变
    const args = { slideIndex: 1, shapeType: 'Rectangle', position: { left: 10, top: 20, width: 50, height: 30 } };
    await dispatchTool({ id: 'c1', name: 'add_shape', arguments: args }, makeCtx(), [pptTool]);
    expect((capturedArgs as Record<string, unknown>).position).toEqual({ left: 10, top: 20, width: 50, height: 30 });
  });
});
