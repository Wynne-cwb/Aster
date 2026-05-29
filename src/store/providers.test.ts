/**
 * src/store/providers.test.ts — providers store autoInsertMode 全删（Plan 03-05 D-08 / D-19 G-05）
 *
 * 覆盖目标：
 * - useProviderStore 不含 autoInsertMode 字段 / setAutoInsertMode 方法
 * - hydrateFromStorage 不读 AUTO_INSERT_MODE storage key（A6：残留 localStorage 不清理）
 *
 * v1 confirm/auto 双模式砍除 — agent loop 是 Phase 3 唯一主路径（D-01）。
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useProviderStore } from './providers';

describe('useProviderStore — autoInsertMode 全删（D-08 / D-19 G-05）', () => {
  beforeEach(() => {
    // 重置非内置 provider，避免上次 it 残留
    useProviderStore.setState({
      defaultLLMProviderId: 'deepseek',
      attachEnabled: true,
    } as never);
  });

  it('Test 1: state 不含 autoInsertMode 字段', () => {
    const state = useProviderStore.getState();
    expect((state as never as { autoInsertMode?: unknown }).autoInsertMode).toBeUndefined();
  });

  it('Test 2: state 不含 setAutoInsertMode 方法', () => {
    const state = useProviderStore.getState();
    expect((state as never as { setAutoInsertMode?: unknown }).setAutoInsertMode).toBeUndefined();
  });

  it('Test 3: 保留 attachEnabled / setAttachEnabled（D-15 / G-08 未受影响）', () => {
    const state = useProviderStore.getState();
    expect(typeof state.attachEnabled).toBe('boolean');
    expect(typeof state.setAttachEnabled).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// WR-01 守门：配置 Key 必须进入响应式 state（banner 反应性）
// ---------------------------------------------------------------------------
//
// 回归背景：banner 显隐原本读 getKey()（localStorage），setKey 从不 set() →
// 配置 Key 后红条不刷新。修复后 setKey 维护 state.configuredKeyIds，App 的
// hasKey selector 改读它。本组测试锁住「setKey → configuredKeyIds 变化」这条响应链，
// 防止有人把 setKey 退回「只写 storage、不 set()」。

describe('useProviderStore — WR-01 configuredKeyIds 响应式（banner 反应性守门）', () => {
  beforeEach(() => {
    // 清掉测试 key + 重置状态，避免跨 it 残留
    useProviderStore.getState().setKey('deepseek', '');
    useProviderStore.setState({ defaultLLMProviderId: 'deepseek' } as never);
  });

  /** App banner 的等价判据：默认 Provider 是否已配置 Key */
  const hasKeySelector = () => {
    const s = useProviderStore.getState();
    return s.configuredKeyIds.includes(s.defaultLLMProviderId);
  };

  it('setKey 写入非空 Key → configuredKeyIds 含该 id（state 变化，非仅 storage）', () => {
    expect(hasKeySelector()).toBe(false); // 初始无 key
    useProviderStore.getState().setKey('deepseek', 'sk-test-123');
    expect(useProviderStore.getState().configuredKeyIds).toContain('deepseek');
    expect(hasKeySelector()).toBe(true); // banner 该消失
  });

  it('setKey 写入空字符串 → configuredKeyIds 不含该 id（跳过 Onboarding 场景）', () => {
    useProviderStore.getState().setKey('deepseek', 'sk-test-123');
    expect(hasKeySelector()).toBe(true);
    useProviderStore.getState().setKey('deepseek', ''); // 用户清空 / 跳过
    expect(useProviderStore.getState().configuredKeyIds).not.toContain('deepseek');
    expect(hasKeySelector()).toBe(false); // banner 该回来
  });

  it('configuredKeyIds 引用在配置 Key 后真的变化（Zustand 会通知订阅者）', () => {
    const before = useProviderStore.getState().configuredKeyIds;
    useProviderStore.getState().setKey('deepseek', 'sk-x');
    const after = useProviderStore.getState().configuredKeyIds;
    // 新数组引用 —— 证明 set() 被调用，selector/组件会重算（修复前 setKey 不 set，引用不变）
    expect(after).not.toBe(before);
  });
});
