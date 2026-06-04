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
import { render, fireEvent } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';
import { storage, STORAGE_KEYS } from '../../lib/storage';

// ---------------------------------------------------------------------------
// 提升 clearHistory spy（vi.hoisted 确保在 vi.mock factory 之前求值）
// ---------------------------------------------------------------------------
const { clearHistory } = vi.hoisted(() => ({ clearHistory: vi.fn() }));

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
  storage: { get: vi.fn(() => null), set: vi.fn(), remove: vi.fn() },
  STORAGE_KEYS: {
    USER_PREFERENCES: 'aster:prefs',
    KEY_PREFIX: 'aster:keys:',
    PROVIDERS: 'aster:providers',
    // Phase 18 LIB-01：Pexels BYO key（独立字段）
    PEXELS_API_KEY: 'aster:keys:pexels',
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
// Mock chat store（clearHistory — 使用提升的 spy 确保稳定引用）
// ---------------------------------------------------------------------------
vi.mock('../../store/chat', () => ({
  useChatStore: vi.fn((selector: (s: unknown) => unknown) =>
    selector({ clearHistory })
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

  it('SP-05（UAT-5）：PPT 默认强调色 color picker 存在且默认 #009887', () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    const input = container.querySelector('#setting-brand-accent') as HTMLInputElement | null;
    expect(input).toBeTruthy();
    expect(input?.getAttribute('type')).toBe('color');
    expect(input?.value).toBe('#009887');
  });
});

// ---------------------------------------------------------------------------
// Phase 18 LIB-01（D-08）：Pexels API Key 字段存储 round-trip
// ---------------------------------------------------------------------------
describe('Phase 18 — Pexels API Key 字段（D-08）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('LIB-01：密码态 Pexels key 输入框存在', () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    const input = container.querySelector('#setting-pexels-key');
    expect(input).toBeTruthy();
    expect(input?.getAttribute('type')).toBe('password');
  });

  it('LIB-01：填值 → storage.set(PEXELS_API_KEY, 值)', () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    const input = container.querySelector('#setting-pexels-key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'pk-abc' } });
    expect(storage.set).toHaveBeenCalledWith(STORAGE_KEYS.PEXELS_API_KEY, 'pk-abc');
  });

  it('LIB-01：清空（空串）→ storage.remove(PEXELS_API_KEY)，不调 set', () => {
    const { container } = render(<SettingsPanel onClose={vi.fn()} />);
    const input = container.querySelector('#setting-pexels-key') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } }); // 仅空白 → trim 为空 → remove
    expect(storage.remove).toHaveBeenCalledWith(STORAGE_KEYS.PEXELS_API_KEY);
  });
});

// ---------------------------------------------------------------------------
// T-bg2：清空聊天记录内联两步确认
// ---------------------------------------------------------------------------
describe('T-bg2 — 清空聊天记录内联两步确认', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('T-bg2-01：点一次触发确认态，clearHistory 未调用', () => {
    const { getByText } = render(<SettingsPanel onClose={vi.fn()} />);
    // 初始态：「清空聊天记录」可见
    const clearBtn = getByText('清空聊天记录');
    fireEvent.click(clearBtn);
    // 确认态：「确认清空？」文字出现
    expect(getByText('确认清空？')).toBeTruthy();
    expect(clearHistory).not.toHaveBeenCalled();
  });

  it('T-bg2-02：确认态点「确认」→ clearHistory 调用 1 次', () => {
    const { getByText } = render(<SettingsPanel onClose={vi.fn()} />);
    fireEvent.click(getByText('清空聊天记录'));
    fireEvent.click(getByText('确认'));
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });

  it('T-bg2-03：确认态点「取消」→ 回初始态，clearHistory 未调用', () => {
    const { getByText, queryByText } = render(<SettingsPanel onClose={vi.fn()} />);
    fireEvent.click(getByText('清空聊天记录'));
    // 确认态存在
    expect(getByText('确认清空？')).toBeTruthy();
    // 点取消
    fireEvent.click(getByText('取消'));
    // 回初始态：「清空聊天记录」重新出现，「确认清空？」消失
    expect(getByText('清空聊天记录')).toBeTruthy();
    expect(queryByText('确认清空？')).toBeNull();
    expect(clearHistory).not.toHaveBeenCalled();
  });
});
