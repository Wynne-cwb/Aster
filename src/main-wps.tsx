/**
 * src/main-wps.tsx — WPS 加载项 Task Pane 入口（Phase 31，对位 src/main.tsx）
 *
 * 与 main.tsx 的区别（ARCHITECTURE Q3 + Pattern 2）：
 * - 不引 office.js CDN，不调 Office.onReady；改用 window.Application 就绪轮询。
 * - 宿主识别走 Application.ComponentType（1=文字/2=表格/3=演示）→ createWpsAdapter。
 * - 主题无 Office.context.officeTheme → 用 prefers-color-scheme 兜底。
 * - 接缝上方完全复用：hydrateFromStorage / loadPrefs / loadHistory / AdapterContext / App。
 *
 * ⚠️ 投机性预写（STATE.md 2026-06-29 决策）：真机验证 pending。
 *    [真机待验] 标注处需 Windows WPS 真机坐实（Phase 30 go 后）。
 */
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@lingui/react';
import { createWpsAdapter } from './adapters/wps';
import { AdapterContext } from './context/AdapterContext';
import { hydrateFromStorage } from './store/providers';
import { useSelectionStore } from './store/selection';
import type { SelectionContext } from './adapters/DocumentAdapter';
import { i18n } from './i18n';
import App from './App';
import './styles.css';
import { getDocKey } from './lib/docKey';
import { usePreferencesStore } from './store/preferences';
import { useChatStore } from './store/chat';

/**
 * WPS CEF 无 Office.context.officeTheme。
 * [真机待验] CEF 是否暴露 prefers-color-scheme（多数 Chromium 内核支持）；
 * 不可用时降级 light，与 Office 侧 resolveHostTheme 的降级一致。
 */
function resolveWpsTheme(): 'light' | 'dark' {
  try {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch {
    // matchMedia 不可用 → 降级 light
  }
  return 'light';
}

/**
 * 等待 WPS 注入 window.Application（替代 Office.onReady 的就绪信号）。
 * module script 在 DOMContentLoaded 执行，可能早于 WPS 注入全局对象，故轮询。
 * [真机待验] 实际注入时序；多数情况 taskpane webview 加载时 Application 已就绪。
 */
function waitForWpsReady(timeoutMs = 5000, intervalMs = 50): Promise<WpsApplication> {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const tick = (): void => {
      const app = window.Application;
      if (app && typeof app.ComponentType === 'number') {
        resolve(app);
        return;
      }
      if (performance.now() - start >= timeoutMs) {
        reject(new Error('WPS Application 未在 ' + timeoutMs + 'ms 内就绪（非 WPS 环境或注入失败）'));
        return;
      }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

async function bootstrapWps(): Promise<void> {
  const app = await waitForWpsReady();
  const componentType = app.ComponentType;

  // 宿主分流：ComponentType → createWpsAdapter（Phase 31 为 stub）
  const adapter = await createWpsAdapter(componentType);

  // 复用层 hydrate（与 main.tsx 同序）：
  // storage.ts 的 partitionKey===undefined 降级路径在 WPS（typeof Office==='undefined'）开箱命中
  hydrateFromStorage();
  usePreferencesStore.getState().loadPrefs();

  // getDocKey 在 WPS 内访问 Office.* 抛错被 catch → 返回 GLOBAL_CHAT_KEY（全局聊天历史）。
  // [WPS-D1] 后续可改用 window.Application 文档路径构建分文档 docKey。
  const docKey = await getDocKey();
  useChatStore.getState().loadHistory(docKey);

  // 首帧选区初值（Phase 31 stub 返回 {kind:'none'}，不抛错）
  let initialSelection: SelectionContext = { kind: 'none' };
  try {
    initialSelection = await adapter.getSelection();
  } catch {
    // 兜底保持 none
  }
  useSelectionStore.setState({ initial: initialSelection });

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('未找到 #root 容器——请确认 index-wps.html 包含 <div id="root">');
  }
  container.dataset.theme = resolveWpsTheme();

  const root = createRoot(container);
  root.render(
    <I18nProvider i18n={i18n}>
      <AdapterContext.Provider value={adapter}>
        <App />
      </AdapterContext.Provider>
    </I18nProvider>
  );
}

void bootstrapWps();
