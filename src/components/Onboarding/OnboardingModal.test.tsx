/**
 * src/components/Onboarding/OnboardingModal.test.tsx — 单步 Onboarding 测试
 *
 * 验证 Onboarding 单步化（D-18/D-19/D-21）：
 *   - CTA 文案为「开始使用」（非「下一步」）
 *   - Step2Guide 不在 DOM 中（单步流，D-18 删 Step2）
 *   - Step1 完成后 ONBOARDING_SEEN 写入 storage（D-18 存储迁移）
 *
 * Wave 3 实现完成（06-11-PLAN）：describe.skip 已移除，测试直接 GREEN。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import OnboardingModal from './OnboardingModal';

// ---------------------------------------------------------------------------
// Mock 依赖（使用 vi.hoisted 避免提升问题）
// ---------------------------------------------------------------------------

const { mockStorageSet } = vi.hoisted(() => ({
  mockStorageSet: vi.fn(),
}));

// Mock lingui（Trans 直接返回子节点文本，方便 getByText/queryByText 查询）
vi.mock('@lingui/react/macro', () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useLingui: () => ({
    _: (id: string) => id,
    t: (id: string) => id,
  }),
}));

// Mock storage（验证 ONBOARDING_SEEN 写入）
vi.mock('../../lib/storage', () => ({
  storage: {
    get: vi.fn(() => null),
    set: mockStorageSet,
    remove: vi.fn(),
  },
  STORAGE_KEYS: {
    ONBOARDING_SEEN: 'onboarding_seen',
    PROVIDER_CONFIGS: 'provider_configs',
    ACTIVE_PROVIDER: 'active_provider',
    ACTIVE_MODEL: 'active_model',
  },
}));

// Mock providerStore（避免真实 store 依赖）
vi.mock('../../store/providers', () => ({
  useProviderStore: vi.fn((selector: (s: unknown) => unknown) => {
    const state = { setKey: vi.fn() };
    return selector(state);
  }),
}));

// ---------------------------------------------------------------------------
// 单步化测试（D-18/D-19/D-21）
// ---------------------------------------------------------------------------

describe('OnboardingModal — 单步化（D-18/D-19/D-21）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ONB-01: 渲染后 CTA 显示「开始使用」（非「下一步」）', () => {
    const { getByText, queryByText } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    expect(getByText('开始使用')).toBeTruthy();
    expect(queryByText('下一步')).toBeNull(); // 旧文案不在 DOM
  });

  it('ONB-02: Step2Guide 不在 DOM 中（单步流程，D-18 删 Step2）', () => {
    const { queryByText } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    // 检查 Step2Guide 典型文案不存在
    expect(queryByText(/Aster 已为当前宿主准备好以下功能/)).toBeNull();
    expect(queryByText(/在.*中你可以/)).toBeNull();
  });

  it('ONB-03: Step1 完成（点击「开始使用」）后 ONBOARDING_SEEN 写入 storage', () => {
    const onComplete = vi.fn();
    const { getByText } = render(
      <OnboardingModal onComplete={onComplete} onSkip={() => {}} />,
    );
    fireEvent.click(getByText('开始使用'));
    expect(mockStorageSet).toHaveBeenCalledWith('onboarding_seen', true);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 冒烟测试：OnboardingModal 可以正常渲染
// ---------------------------------------------------------------------------

describe('OnboardingModal — 基础渲染冒烟', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('渲染不崩（单步流程）', () => {
    const { container } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    // modal-scrim 骨架存在
    expect(container.querySelector('.modal-scrim')).toBeTruthy();
    expect(container.querySelector('.modal')).toBeTruthy();
  });

  it('CTA 为「开始使用」（单步流程）', () => {
    const { getByText } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    expect(getByText('开始使用')).toBeTruthy();
  });

  it('跳过（handleSkip）后 ONBOARDING_SEEN 写入 storage', () => {
    const onSkip = vi.fn();
    const { getByText } = render(
      <OnboardingModal onComplete={() => {}} onSkip={onSkip} />,
    );
    fireEvent.click(getByText('跳过'));
    expect(mockStorageSet).toHaveBeenCalledWith('onboarding_seen', true);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
