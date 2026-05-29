/**
 * src/main.tsx — Task Pane 入口（FOUND-03 三宿主分流总入口）
 *
 * Office.onReady 读 info.host，实例化对应 adapter，
 * 经 React Context + I18nProvider 包裹 App 后渲染。
 *
 * 主题：读 Office.context.officeTheme 判 light/dark，在 #root 上设 data-theme，
 * 由 styles.css 的 CSS 变量驱动（自写视觉层，已弃用 Fluent v9 —— 美观优先，用户 2026-05-27 拍板）。
 *
 * 注意：Office.js 通过 index.html 的 CDN script tag 提供，
 * 此文件不 import office.js（INSTALL-04）。
 */
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { createAdapter } from './adapters';
import { AdapterContext } from './context/AdapterContext';
import { hydrateFromStorage } from './store/providers';
import { useSelectionStore } from './store/selection';
import type { SelectionContext } from './adapters/DocumentAdapter';
import { i18n } from './i18n';
import App from './App';
import './styles.css';

/**
 * 根据 Office 宿主主题判 light/dark。
 * Office.context.officeTheme.bodyBackgroundColor 形如 "#1e1e1e" / "#ffffff"；
 * 感知亮度 < 128 视为深色。不可用时降级 light。
 */
function resolveHostTheme(): 'light' | 'dark' {
  try {
    const bg = Office.context.officeTheme?.bodyBackgroundColor ?? '#ffffff';
    const hex = bg.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance < 128 ? 'dark' : 'light';
    }
  } catch {
    // officeTheme 不可用（非 Office 环境或旧版）→ 降级 light
  }
  return 'light';
}

// ---- Office.onReady — 三宿主分流总入口（FOUND-03）----
Office.onReady(async (info) => {
  // host 分流：PowerPoint → PptAdapter / Excel → ExcelAdapter / Word → WordAdapter
  // createAdapter 现为 async（按宿主 dynamic import，瘦初始 bundle）——已在 async 回调内，await 即可
  const adapter = await createAdapter(info.host);

  // providerStore 水化：从 localStorage 恢复上次配置（KEY-01 / KEY-05）
  // 必须在 root.render 之前调用，确保组件首次渲染即拿到持久化数据
  hydrateFromStorage();

  // CARRY-01 修复路径 A（D-22 / D-23）：root.render 之前主动取一次选区，
  // 作为初值灌进 useSelectionStore.initial；ContextCard / SelectionPill
  // 的 useState 初值改读这个 store，避免「先显示『未选中内容』占位 1-2 帧
  // 再补上真实选区」的首帧闪烁。用户切换选区仍走组件内 onSelectionChanged 订阅。
  let initialSelection: SelectionContext = { kind: 'none' };
  try {
    initialSelection = await adapter.getSelection();
  } catch {
    // 极端情况兜底（adapter 未就绪 / 宿主 API 抛错）：保持 { kind: 'none' }。
    // 组件 onSelectionChanged 订阅仍会在用户后续切换选区时补上正确状态。
  }
  useSelectionStore.setState({ initial: initialSelection });

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('未找到 #root 容器——请确认 index.html 包含 <div id="root">');
  }

  // host-aware 主题：在根节点设 data-theme，CSS 变量据此切换 light/dark
  container.dataset.theme = resolveHostTheme();

  const root = createRoot(container);
  root.render(
    <I18nProvider i18n={i18n}>
      <AdapterContext.Provider value={adapter}>
        <App />
      </AdapterContext.Provider>
    </I18nProvider>
  );
});
