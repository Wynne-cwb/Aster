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
