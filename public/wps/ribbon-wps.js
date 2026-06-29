// ============================================================
// Aster WPS 外壳 ribbon 控制器 — ribbon-wps.js（Phase 31）
//
// 镜像 public/wps-probe/probe.js 已验证的 ribbon 胶水结构。
//
// 关键约束（与探针同）：
//   1. classic script（非 ES module）——函数声明即全局，WPS 按名绑定 ribbon.xml 回调
//      （main-wps.tsx 是 ES module，其内函数是模块作用域，WPS 找不到，故回调必须在此文件）
//   2. 绝不引 office.js —— WPS 不消费，引入后 OnAddinLoad 永不触发
//   3. wps.PluginStorage 仅作会话内缓存（非持久），只缓存 taskpane ID，绝不存 API Key
//
// ⚠️ 投机性预写（STATE.md 2026-06-29）：真机验证 pending。
// ============================================================
'use strict';

// [真机待验] taskpane URL：GitHub Pages 部署后 index-wps.html 的线上地址。
// Vite base='/Aster/' → 产出 dist/index-wps.html → Pages 上为 /Aster/index-wps.html。
var ASTER_WPS_TASKPANE_URL = 'https://wynne-cwb.github.io/Aster/index-wps.html';
var TASKPANE_ID_KEY = 'aster_wps_ts_id';

// ribbon.xml onLoad="OnAddinLoad" 绑定此函数（WPS 加载项初始化时触发）
function OnAddinLoad(ribbon) {
  // 宿主类型: 1=文字 / 2=表格 / 3=演示（仅记录；真正分流在 main-wps.tsx）
  try {
    var type = Application.ComponentType;
    console.log('[Aster WPS] addin loaded, host ComponentType =', type);
  } catch (e) {
    console.log('[Aster WPS] OnAddinLoad: Application 未就绪', e);
  }
}

// ribbon.xml getEnabled="OnGetEnabled"
function OnGetEnabled(control) {
  return true;
}

// ribbon.xml onAction="ShowTaskPane" —— 打开/切换 Aster 面板
function ShowTaskPane(control) {
  var tsId = wps.PluginStorage.getItem(TASKPANE_ID_KEY);
  if (!tsId) {
    var tsp = wps.CreateTaskPane(ASTER_WPS_TASKPANE_URL);
    wps.PluginStorage.setItem(TASKPANE_ID_KEY, String(tsp.ID));
    tsp.Visible = true;
    tsp.Width = 380; // 与 Office 侧 Task Pane 默认宽度一致
  } else {
    var existing = wps.GetTaskPane(parseInt(tsId, 10));
    if (existing) {
      existing.Visible = !existing.Visible;
    } else {
      // ID 失效（WPS 重启后 PluginStorage 清空理论上已 null，这里兜底重建）
      var rebuilt = wps.CreateTaskPane(ASTER_WPS_TASKPANE_URL);
      wps.PluginStorage.setItem(TASKPANE_ID_KEY, String(rebuilt.ID));
      rebuilt.Visible = true;
      rebuilt.Width = 380;
    }
  }
}
