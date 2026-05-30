/**
 * src/components/Onboarding/OnboardingModal.test.tsx — Phase 6 Wave 0 测试桩
 *
 * 验证 Onboarding 单步化（D-18/D-19）：
 *   - CTA 文案为「开始使用」（非「下一步」）
 *   - Step2Guide 不在 DOM 中（单步流，D-18 删 Step2）
 *   - Step1 完成后 ONBOARDING_SEEN 写入 storage（D-18 存储迁移）
 *
 * Wave 0 说明：
 *   - 当前 OnboardingModal 为 2 步流程，CTA 是「下一步」
 *   - Wave 3（06-09-PLAN）实现单步化后取消 describe.skip，转 RED→GREEN
 *
 * Analog 来源：
 *   - src/agent/system-prompt.test.ts（简单 describe/it/expect 结构）
 *   - src/components/Onboarding/OnboardingModal.tsx（当前 2 步流程实现）
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
// Phase 6 Wave 0 测试桩（Wave 3 解锁）
//
// 当前 OnboardingModal 是 2 步流程，这些测试预期 Wave 3 单步化后的形态：
//   - CTA「开始使用」（当前是「下一步」）
//   - 无 Step2Guide
// Wave 3 实现后取消 describe.skip，转 RED→GREEN
// ---------------------------------------------------------------------------

describe.skip('OnboardingModal — 单步化（Wave 3 解锁，D-18/D-19）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ONB-01: 渲染后 CTA 显示「开始使用」（非「下一步」）', () => {
    // Wave 3 单步化后：Step1Keys 的 CTA 改为「开始使用」
    // const { getByText, queryByText } = render(
    //   <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    // );
    // expect(getByText('开始使用')).toBeTruthy();
    // expect(queryByText('下一步')).toBeNull(); // 旧文案不在 DOM
    expect(true).toBe(true); // 占位：Wave 3 解锁后替换
  });

  it('ONB-02: Step2Guide 不在 DOM 中（单步流程，D-18 删 Step2）', () => {
    // Wave 3 单步化后：整个 Step2Guide 被删除，modal 直接渲染 Step1Keys
    // const { queryByText } = render(
    //   <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    // );
    // 检查 Step2Guide 典型文案不存在（下面文案来自 Step2Guide.tsx 正文）
    // expect(queryByText(/Aster 在你的 Office 里/)).toBeNull();
    expect(true).toBe(true); // 占位：Wave 3 解锁后替换
  });

  it('ONB-03: Step1 完成（点击「开始使用」）后 ONBOARDING_SEEN 写入 storage', () => {
    // Wave 3 单步化后：Step1Keys.handleComplete() 内写 storage
    // const onComplete = vi.fn();
    // const { getByText } = render(
    //   <OnboardingModal onComplete={onComplete} onSkip={() => {}} />,
    // );
    // fireEvent.click(getByText('开始使用'));
    // expect(mockStorageSet).toHaveBeenCalledWith('onboarding_seen', true);
    // expect(onComplete).toHaveBeenCalledTimes(1);
    expect(true).toBe(true); // 占位：Wave 3 解锁后替换
  });
});

// ---------------------------------------------------------------------------
// 当前（Wave 0）冒烟测试：OnboardingModal 可以正常渲染（非 skip）
// 验证组件不崩，确保 import 链路完整
// ---------------------------------------------------------------------------

describe('OnboardingModal — 基础渲染冒烟（Wave 0）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('渲染不崩（当前 2 步流程）', () => {
    // 当前 OnboardingModal 2 步流程，渲染后含「下一步」CTA（Step1Keys）
    const { container } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    // modal-scrim 骨架存在
    expect(container.querySelector('.modal-scrim')).toBeTruthy();
    expect(container.querySelector('.modal')).toBeTruthy();
  });

  it('当前 CTA 为「下一步」（Wave 3 实现后此断言会被 skip 块覆盖替换为「开始使用」）', () => {
    const { getByText } = render(
      <OnboardingModal onComplete={() => {}} onSkip={() => {}} />,
    );
    // 当前 Step1Keys onNext 触发 goNext（进入 Step2）
    expect(getByText('下一步')).toBeTruthy();
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
