/**
 * src/components/Settings/ProviderForm.test.tsx — CARRY-02 model select 分支 + A-21 test button
 *
 * 断言：
 *   - 内置 deepseek → model 字段是 <select>，选项含 deepseek-v4-pro / deepseek-v4-flash
 *   - 内置 aihubmix → <select>，选项含 gpt-5.1 / gemini-3.5-flash
 *   - 自定义 Provider（isBuiltIn=false）→ model 字段是 text input（无 select）
 *   - A-21：内置 Provider 无测试按钮；已保存自定义 Provider 有按钮；未保存诚实禁用
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProviderForm from './ProviderForm';
import type { ProviderConfig } from '../../providers/types';

// ---------------------------------------------------------------------------
// Mock @lingui/react/macro
// ---------------------------------------------------------------------------
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((acc, s, i) => acc + s + (values[i] ?? ''), ''),
    i18n: { _: (id: string) => id },
  }),
}));

// ---------------------------------------------------------------------------
// 测试 fixtures
// ---------------------------------------------------------------------------
const deepseekProvider: ProviderConfig = {
  id: 'deepseek',
  name: 'DeepSeek',
  baseURL: 'https://api.deepseek.com',
  model: 'deepseek-v4-flash',
  isBuiltIn: true,
};

const aihubmixProvider: ProviderConfig = {
  id: 'aihubmix',
  name: 'AiHubMix',
  baseURL: 'https://api.aihubmix.com/v1',
  model: 'gpt-5.1',
  isBuiltIn: true,
};

const customProvider: ProviderConfig = {
  id: 'custom-abc',
  name: 'My Custom LLM',
  baseURL: 'https://custom.example.com/v1',
  model: 'custom-model-1',
  isBuiltIn: false,
};

// ---------------------------------------------------------------------------
// 辅助渲染
// ---------------------------------------------------------------------------
function renderForm(provider?: ProviderConfig) {
  return render(
    <ProviderForm
      provider={provider}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
}

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------
describe('CARRY-02: ProviderForm model 字段 isBuiltIn 分支', () => {
  it('内置 DeepSeek → model 字段是 <select>', () => {
    renderForm(deepseekProvider);
    // 应有 select 而非 text input
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
  });

  it('内置 DeepSeek → select 含 deepseek-v4-pro 选项', () => {
    renderForm(deepseekProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('deepseek-v4-pro');
  });

  it('内置 DeepSeek → select 含 deepseek-v4-flash 选项', () => {
    renderForm(deepseekProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('deepseek-v4-flash');
  });

  it('内置 DeepSeek → select 恰好 2 个选项', () => {
    renderForm(deepseekProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
  });

  it('内置 AiHubMix → model 字段是 <select>', () => {
    renderForm(aihubmixProvider);
    const select = screen.getByRole('combobox');
    expect(select).toBeDefined();
  });

  it('内置 AiHubMix → select 含 gpt-5.1 选项', () => {
    renderForm(aihubmixProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('gpt-5.1');
  });

  it('内置 AiHubMix → select 含 gemini-3.5-flash 选项', () => {
    renderForm(aihubmixProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain('gemini-3.5-flash');
  });

  it('内置 AiHubMix → select 恰好 2 个选项', () => {
    renderForm(aihubmixProvider);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options.length).toBe(2);
  });

  it('自定义 Provider → model 字段是 text input（无 select）', () => {
    renderForm(customProvider);
    // 不应有 combobox
    expect(screen.queryByRole('combobox')).toBeNull();
    // 应有 model text input（以 placeholder 识别）
    const modelInput = screen.getByPlaceholderText('deepseek-v4-flash');
    expect(modelInput).toBeDefined();
    expect((modelInput as HTMLInputElement).type).toBe('text');
  });

  it('新建表单（无 provider）→ model 字段是 text input', () => {
    renderForm(undefined);
    expect(screen.queryByRole('combobox')).toBeNull();
    const modelInput = screen.getByPlaceholderText('deepseek-v4-flash');
    expect(modelInput).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// A-21 测试 tool calling 按钮（Plan 02 实现）
// 按钮仅对非内置、已保存的 Provider 渲染（isBuiltIn=false）。
// 内置 Provider（deepseek / aihubmix）硬编码 supportsToolCall=true，不需要探针。
// ---------------------------------------------------------------------------

// Mock probeToolCallSupport 避免真实网络请求
vi.mock('../../providers/probeToolCall', () => ({
  probeToolCallSupport: vi.fn().mockResolvedValue(null),
}));

// Mock useProviderStore（仅 getState().setSupportsToolCall 路径）
vi.mock('../../store/providers', async () => {
  const actual = await vi.importActual<typeof import('../../store/providers')>('../../store/providers');
  return {
    ...actual,
    useProviderStore: Object.assign(
      actual.useProviderStore,
      {
        getState: () => ({
          ...actual.useProviderStore.getState(),
          setSupportsToolCall: vi.fn(),
        }),
      },
    ),
  };
});

describe('A-21 测试 tool calling 按钮', () => {
  it('内置 Provider isBuiltIn=true 时不渲染「测试 tool calling」按钮', () => {
    renderForm(deepseekProvider);
    expect(screen.queryByRole('button', { name: /测试 tool calling/i })).toBeNull();
  });

  it('自定义且已保存 Provider（isBuiltIn=false + provider.id 存在）时渲染「测试 tool calling」按钮', () => {
    renderForm(customProvider);
    const testBtn = screen.queryByRole('button', { name: /测试 tool calling/i });
    expect(testBtn).not.toBeNull();
  });

  it('新建未保存 Provider（无 provider.id）时「测试 tool calling」按钮诚实禁用（aria-disabled）', () => {
    // 无 provider prop → 新建模式，无 id
    renderForm(undefined);
    // 未保存状态下按钮应渲染但带 aria-disabled="true"
    const testBtn = screen.queryByRole('button', { name: /测试 tool calling/i });
    expect(testBtn).not.toBeNull();
    expect(testBtn?.getAttribute('aria-disabled')).toBe('true');
  });
});
