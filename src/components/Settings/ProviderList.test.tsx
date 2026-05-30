/**
 * src/components/Settings/ProviderList.test.tsx — ProviderList 单测
 *
 * 当前覆盖：
 *   - A-21 supportsToolCall badge 三态（Plan 02 实现后移除 describe.skip）
 *
 * badge className 体系（PATTERNS.md 验证）：
 *   badge               → 中性（灰）
 *   badge badge-success → 绿色
 *   badge badge-accent  → teal 品牌色
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProviderList from './ProviderList';
import { useProviderStore } from '../../store/providers';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro
// ---------------------------------------------------------------------------
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), ''),
  }),
}));

// ---------------------------------------------------------------------------
// Mock storage（避免 localStorage 操作）
// ---------------------------------------------------------------------------
vi.mock('../../lib/storage', () => ({
  storage: {
    get: vi.fn(() => null), // 默认无 key → hasKey=false
    set: vi.fn(),
  },
  STORAGE_KEYS: {
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
  },
}));

// ---------------------------------------------------------------------------
// 辅助渲染
// ---------------------------------------------------------------------------
function renderList() {
  return render(
    <ProviderList
      onEdit={vi.fn()}
      onCreate={vi.fn()}
    />,
  );
}

function setupProvider(supportsToolCall?: boolean | null) {
  useProviderStore.setState({
    providers: [
      {
        id: 'custom-test',
        name: 'Test Provider',
        baseURL: 'https://test.example.com/v1',
        model: 'test-model',
        isBuiltIn: false,
        ...(supportsToolCall !== undefined ? { supportsToolCall } : {}),
      },
    ],
    defaultLLMProviderId: 'custom-test',
  } as never);
}

// ---------------------------------------------------------------------------
// A-21 supportsToolCall badge 三态（Plan 02 实现后移除 skip）
// 渲染时机：仅当 supportsToolCall 已被测试（!== undefined）才显示 badge
// ---------------------------------------------------------------------------
describe.skip('A-21 supportsToolCall badge 三态（Plan 02 实现后移除 skip）', () => {
  it('supportsToolCall=true → 渲染 badge-success「✓ tool call」', () => {
    setupProvider(true);
    renderList();
    // Plan 02 实现后：badge 文字含 '✓ tool call' 且有 badge-success class
    const badge = screen.queryByText(/✓ tool call/);
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain('badge-success');
  });

  it('supportsToolCall=false → 渲染 badge-error / badge-accent「✗ 不支持」', () => {
    setupProvider(false);
    renderList();
    // Plan 02 实现后：badge 文字含 '✗ 不支持' 且有 badge-accent（或 badge-error）class
    const badge = screen.queryByText(/✗ 不支持/);
    expect(badge).not.toBeNull();
  });

  it('supportsToolCall=undefined → 不渲染额外 badge（未探测状态）', () => {
    setupProvider(undefined);
    renderList();
    // Plan 02 实现后：不应出现 ✓/✗ badge
    expect(screen.queryByText(/✓ tool call/)).toBeNull();
    expect(screen.queryByText(/✗ 不支持/)).toBeNull();
  });
});
