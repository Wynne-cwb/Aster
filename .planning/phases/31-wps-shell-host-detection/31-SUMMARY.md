# Phase 31 SUMMARY — wpsjs 外壳 + 宿主识别 + 复用层接线

**状态：code-drafted · 真机验证 pending**（NOT Complete — 见下「为何不可标 Complete」）
**日期：** 2026-06-29（投机性预写，Phase 30 真机门未过，STATE.md 2026-06-29 决策）

## 交付（代码草稿）

| 文件 | 作用 |
|------|------|
| `src/adapters/wps/types/wps-jsapi.d.ts` | WPS JSAPI 最小全局类型（Application.ComponentType / wps.CreateTaskPane / PluginStorage） |
| `src/adapters/wps/WpsAdapterStub.ts` | 三宿主共享 stub 基类：getSelection 返空态、read/insert throw |
| `src/adapters/wps/WpsPptAdapter.ts` / `WpsExcelAdapter.ts` / `WpsWordAdapter.ts` | 三宿主 stub（继承基类） |
| `src/adapters/wps/index.ts` | `createWpsAdapter(componentType)` 工厂 + 懒加载（对位 Office.js createAdapter） |
| `src/main-wps.tsx` | WPS 入口：waitForWpsReady 轮询 → ComponentType → createWpsAdapter → hydrate（复用 main.tsx 流程）→ render |
| `public/wps/index.html` | ribbon 背景上下文页（仅加载 classic ribbon-wps.js，不挂 React → 杜绝双挂载） |
| `public/wps/ribbon-wps.js` | classic ribbon 控制器：OnAddinLoad/ShowTaskPane/OnGetEnabled + wps.CreateTaskPane |
| `public/wps/ribbon.xml` | Aster Tab（「打开 Aster」按钮） |
| `public/wps/jsplugins.xml` | 三宿主注册（wps/et/wpp，url→/Aster/wps/） |
| `index-wps.html` | React Task Pane 入口（root，Vite 第三 input，无 office.js CDN） |
| `vite.config.ts` | 加入 `wps: 'index-wps.html'` 第三 input |

## 代码侧验证（全过）

- `tsc --noEmit`：0 报错
- `vite build`：成功。WPS 入口独立 chunk `dist/assets/wps-*.js`（gzip ~1.17KB）；三 stub adapter 各自懒加载
- `dist/index-wps.html`：引用 wps chunk，**0 处 office.js 泄漏**（grep 验证）
- `dist/wps/`：index.html / ribbon.xml / jsplugins.xml / ribbon-wps.js 四资产随 build 复制就位
- `size-limit`：主入口仍 <100KB gate（WPS 代码未漏进 Office 主入口）
- `vitest`：1137 passed / 0 failed（尾部 3 retry errors = 已知噪音）→ 证明接缝上方零改动

## 为何不可标 Complete

Roadmap Phase 31 的 5 条成功标准全是「用户在 **Windows WPS 真机** 坐实……」（sideload 打开 Task Pane / ComponentType 路由 / SSE 直连 CEF / localStorage 跨会话 / 字体渲染）。
**没有真机，这 5 条无一能勾。** 本 phase 只完成「代码侧可达部分」，真机门（Phase 30 go）仍是前提。

## 关键决策

1. **ribbon 背景页 / taskpane 物理分离**（改进探针的单页结构）：`public/wps/index.html`（ribbon 上下文，classic JS）vs `index-wps.html`（React taskpane）→ 彻底消除 React 双挂载隐患。
2. **ribbon 回调放 classic script**（非 ES module）：module 内函数是模块作用域，WPS 按名找不到 → 必须 window 全局 classic 函数。
3. **storage / getDocKey 零改动复用**：WPS 内 `typeof Office==='undefined'` → storage partitionKey 降级路径 + getDocKey 的 try/catch 降级 GLOBAL_CHAT_KEY 均开箱命中。

## `[真机待验]` 清单（代码内已标注，真机逐一坐实）

- `window.Application` 注入时序（waitForWpsReady 轮询是否够）
- CEF 是否暴露 prefers-color-scheme（主题）
- taskpane URL / jsplugins url 在 Pages 部署后的实际可达性 + WPS sideload 加载行为
- SSE 直连不被 CEF CSP 拦（= Phase 30 make-or-break #2，最高危）

## 下一步

Phase 32：选定滩头堡宿主（PPT vs Excel，开工前给用户推荐拍板）→ 实现核心 read/write/inverse + operationLog 移植。
