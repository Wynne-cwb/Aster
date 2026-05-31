/**
 * src/components/Settings/SettingsPanel.test.tsx — 冒烟测试守门（PREF-01 / T-b5o-01 / T-b5o-02）
 *
 * 目的：确保 SettingsPanel 在 browse 态可正常挂载，不触发 React #185 无限重渲染。
 *
 * 关键设计决策：
 *   - usePreferencesStore 不 mock——让真实 zustand store + useSyncExternalStore 跑起来。
 *     修复前（对象 selector）此测试会因无限重渲染超时/抛错，修复后（独立 selector）绿。
 *   - 不用 jest-dom matcher（本项目无 @testing-library/jest-dom）——
 *     改用原生 DOM query + vitest expect(...).toBeTruthy()。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';

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
// Mock storage（preferences store 内部依赖）
// ---------------------------------------------------------------------------
vi.mock('../../lib/storage', () => ({
  storage: { get: vi.fn(() => null), set: vi.fn() },
  STORAGE_KEYS: {
    USER_PREFERENCES: 'aster:prefs',
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
  },
}));

// ---------------------------------------------------------------------------
// Mock docKey（SettingsPanel useEffect 依赖）
// ---------------------------------------------------------------------------
vi.mock('../../lib/docKey', () => ({
  getDocKey: vi.fn(() => Promise.resolve('aster:chat:global')),
}));

// ---------------------------------------------------------------------------
// Mock ProviderList / ProviderForm（避免深渲染）
// ---------------------------------------------------------------------------
vi.mock('./ProviderList', () => ({
  default: () => <div data-testid="provider-list-stub" />,
}));
vi.mock('./ProviderForm', () => ({
  default: () => <div data-testid="provider-form-stub" />,
}));

// ---------------------------------------------------------------------------
// Mock providers store
// ---------------------------------------------------------------------------
vi.mock('../../store/providers', () => ({
  useProviderStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({
      attachEnabled: false,
      setAttachEnabled: vi.fn(),
      providers: [],
      addProvider: vi.fn(() => 'new-id'),
      updateProvider: vi.fn(),
      setKey: vi.fn(),
    })
  ),
}));

// ---------------------------------------------------------------------------
// Mock chat store（clearHistory）
// ---------------------------------------------------------------------------
vi.mock('../../store/chat', () => ({
  useChatStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ clearHistory: vi.fn() })
  ),
}));

// ---------------------------------------------------------------------------
// 注：usePreferencesStore 不 mock — 真实 zustand + useSyncExternalStore
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 测试套件
// ---------------------------------------------------------------------------
describe('SettingsPanel — 冒烟测试', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SP-01：渲染不抛错', () => {
    expect(() => render(<SettingsPanel onClose={vi.fn()} />)).not.toThrow();
  });

  it('SP-02：偏好 textarea 存在', () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    const textarea = container.querySelector('textarea.aster-settings__pref-input');
    expect(textarea).toBeTruthy();
  });

  it('SP-03：三个预设 chips 都渲染', () => {
    const { getByText } = render(<SettingsPanel onClose={vi.fn()} />);
    expect(getByText('正式语气')).toBeTruthy();
    expect(getByText('口语化')).toBeTruthy();
    expect(getByText('金额两位小数')).toBeTruthy();
  });

  it('SP-04：清空聊天记录按钮存在', () => {
    const { getByText } = render(<SettingsPanel onClose={vi.fn()} />);
    expect(getByText('清空聊天记录')).toBeTruthy();
  });
});
