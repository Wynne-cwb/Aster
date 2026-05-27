/**
 * src/providers/queue.ts — 单飞队列 + visibilitychange abort（PROV-07）
 *
 * singleFlight：同一 providerId 的请求队列化，防止 Provider 过载。
 * 注意：这是「排队」而非「去重」——第二个调用等第一个完成后发新请求。
 * Map 在模块级维护（不在 React 组件里），生命周期正确（PATTERNS.md §queue.ts）。
 *
 * setupVisibilityAbort：由 chatStore（02-05）调用，NOT 由 openai-compat 调用。
 * openai-compat 只负责接受 AbortSignal 并传给 streamSSE。
 */

/** 模块级单飞 Map（providerId → 当前飞行中的 Promise ticket） */
const inFlight = new Map<string, Promise<void>>();

/**
 * singleFlight — 同一 Provider 串行化请求。
 * 等待同 providerId 的上一个请求完成后，才发新请求。
 */
export async function singleFlight<T>(
  providerId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // 等待同 Provider 的上一个请求完成（失败也继续）
  const prev = inFlight.get(providerId);
  if (prev) await prev.catch(() => {});

  let resolve!: () => void;
  const ticket = new Promise<void>((r) => { resolve = r; });
  inFlight.set(providerId, ticket);

  try {
    return await fn();
  } finally {
    resolve();
    // 防泄漏：只在当前 ticket 还是 Map 里那个时才移除
    if (inFlight.get(providerId) === ticket) {
      inFlight.delete(providerId);
    }
  }
}

/**
 * setupVisibilityAbort — Task Pane 隐藏时自动 abort 当前请求。
 *
 * 使用标准 Web visibilitychange 事件（Phase 0 验证可用于 Office for Web）。
 * 返回 cleanup 函数——必须在请求完成后（finally 块）调用，否则泄漏监听器（Pitfall 3）。
 *
 * 调用者：src/store/chat.ts（chatStore.sendMessage），NOT src/providers/openai-compat.ts。
 */
export function setupVisibilityAbort(controller: AbortController): () => void {
  function onHide(): void {
    if (document.visibilityState === 'hidden') {
      controller.abort();
    }
  }
  document.addEventListener('visibilitychange', onHide);
  return () => document.removeEventListener('visibilitychange', onHide);
}
