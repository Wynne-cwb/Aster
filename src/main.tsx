/**
 * src/main.tsx — Task Pane 入口（FOUND-03 三宿主分流总入口）
 *
 * Office.onReady 读 info.host，实例化对应 adapter，
 * 经 React Context + I18nProvider + FluentProvider 包裹 App 后渲染。
 *
 * 注意：Office.js 通过 index.html 的 CDN script tag 提供，
 * 此文件不 import office.js（INSTALL-04）。
 */
import { createRoot } from 'react-dom/client';
import {
  FluentProvider,
  webLightTheme,
  webDarkTheme,
} from '@fluentui/react-components';
import { I18nProvider } from '@lingui/react';
import { createAdapter } from './adapters';
import { AdapterContext } from './context/AdapterContext';
import { i18n } from './i18n';
import App from './App';

/**
 * 根据 Office 宿主的主题（officeTheme）决定使用 light 还是 dark Fluent 主题。
 * Office.context.officeTheme 在 Office.onReady 回调时可读。
 * 判断依据：bodyBackgroundColor 为深色（RGB 亮度 < 128）则用 dark 主题。
 */
function resolveHostTheme(): typeof webLightTheme {
  try {
    const theme = Office.context.officeTheme;
    // bodyBackgroundColor 格式如 "#1e1e1e" 或 "#ffffff"
    const bg = theme?.bodyBackgroundColor ?? '#ffffff';
    const hex = bg.replace('#', '');
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      // sRGB 亮度公式（感知亮度）
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      return luminance < 128 ? webDarkTheme : webLightTheme;
    }
  } catch {
    // officeTheme 不可用时（非 Office 环境或旧版），降级为 light
  }
  return webLightTheme;
}

// ---- Office.onReady — 三宿主分流总入口（FOUND-03）----
Office.onReady((info) => {
  // host 分流：PowerPoint → PptAdapter / Excel → ExcelAdapter / Word → WordAdapter
  const adapter = createAdapter(info.host);

  // host-aware 主题：读 Office.context.officeTheme 选 light/dark（UI-SPEC 硬规则）
  const hostTheme = resolveHostTheme();

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('未找到 #root 容器——请确认 index.html 包含 <div id="root">');
  }

  const root = createRoot(container);
  root.render(
    <FluentProvider theme={hostTheme}>
      <I18nProvider i18n={i18n}>
        <AdapterContext.Provider value={adapter}>
          <App />
        </AdapterContext.Provider>
      </I18nProvider>
    </FluentProvider>
  );
});
