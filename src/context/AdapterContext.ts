/**
 * src/context/AdapterContext.ts — DocumentAdapter React Context（FOUND-03）
 *
 * 将 main.tsx 中由 createAdapter(info.host) 实例化的 adapter
 * 经 React Context 暴露给整个组件树，避免 prop drilling。
 */
import { createContext, useContext } from 'react';
import type { DocumentAdapter } from '../adapters';

/**
 * AdapterContext — 持有当前宿主的 DocumentAdapter 实例。
 * 默认值为 null，main.tsx 的 Provider 注入真实 adapter。
 */
export const AdapterContext = createContext<DocumentAdapter | null>(null);

/**
 * useAdapter — 获取当前宿主的 DocumentAdapter。
 * 必须在 AdapterContext.Provider 内调用，否则抛错。
 *
 * @throws Error 如果在 Provider 外调用
 */
export function useAdapter(): DocumentAdapter {
  const adapter = useContext(AdapterContext);
  if (!adapter) {
    throw new Error('useAdapter 必须在 AdapterContext.Provider 内调用');
  }
  return adapter;
}
