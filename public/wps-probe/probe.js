// ============================================================
// Aster WPS 兼容性探针 — probe.js
// 版本：v1.0 (Phase 30)
// 重要约束（30-D-01 硬约束）：
//   1. 不引入任何 Aster src/ 模块（无 ES module 语句）
//   2. 不使用任何 Office.* 运行时 API（WPS 不初始化 Office 对象；仅对 partitionKey 做存在性探测）
//   3. 不使用 wps.PluginStorage 持久化（关闭加载项即失效，仅作会话内缓存）
//   4. API Key 不写 localStorage，不进结果报告
// ============================================================

'use strict';

let ribbonUI = null;
let lastReport = '';

// --- ribbon 回调（由 ribbon.xml onLoad/onAction/getEnabled 绑定）---
// 注意：这些函数必须在此文件中定义，不能定义在 Task Pane 的 HTML 里
// ribbon.xml 的 onLoad="OnAddinLoad" 绑定的是此文件的上下文

function OnAddinLoad(ribbon) {
  ribbonUI = ribbon;
  // 宿主类型: 1=文字(wps) / 2=表格(et) / 3=演示(wpp)
  // 替代 Aster src/main.tsx 的 Office.context.host 识别链
  var type = Application.ComponentType;
  console.log('[Probe] host type =', type, '(1=文字 2=表格 3=演示)');
}

function OnGetEnabled(control) {
  return true; // 按钮始终可用
}

function ShowTaskPane(control) {
  var tsIdKey = 'aster_probe_ts_id';
  // wps.PluginStorage 仅作会话内缓存（不持久，官方明确关加载项即失效）
  var tsId = wps.PluginStorage.getItem(tsIdKey);
  if (!tsId) {
    var tsp = wps.CreateTaskPane(
      'https://wynne-cwb.github.io/Aster/wps-probe/index.html'
    );
    wps.PluginStorage.setItem(tsIdKey, tsp.ID);
    tsp.Visible = true;
    tsp.Width = 380;
  } else {
    var existing = wps.GetTaskPane(parseInt(tsId, 10));
    if (existing) existing.Visible = !existing.Visible;
  }
}

// --- 检查项 1: CEF Chromium 版本 / React 19 可行性（make-or-break #1）---
async function checkCEFVersion() {
  var ua = navigator.userAgent;
  var m = ua.match(/Chrome\/(\d+)\./);
  var chromiumVersion = m ? parseInt(m[1], 10) : 0;

  var hasReadableStream = typeof ReadableStream !== 'undefined';
  var hasFetch          = typeof fetch !== 'undefined';
  var hasPromise        = typeof Promise !== 'undefined';
  var hasOptionalChain  = (function () { try { return eval('({a:{b:1}})?.a?.b === 1'); } catch (e) { return false; } })();
  var hasNullCoalesce   = (function () { try { return eval('(null ?? 42) === 42'); } catch (e) { return false; } })();
  var hasAbortCtrl      = typeof AbortController !== 'undefined';

  // Chromium ≥ 80 = ES2020 语法支持起点（可选链/空值合并）
  // React 19 官方未公布精确下限；≥80 与项目 roadmap 阈值一致
  var CHROMIUM_MIN = 80;
  var pass = chromiumVersion >= CHROMIUM_MIN && hasReadableStream && hasFetch && hasAbortCtrl;

  return {
    id: 'CEF_VERSION',
    label: 'make-or-break #1：CEF Chromium 版本 / React 19 可行性',
    pass: pass,
    rawValues: {
      userAgent: ua,
      chromiumVersion: chromiumVersion,
      hasReadableStream: hasReadableStream, hasFetch: hasFetch, hasPromise: hasPromise,
      hasOptionalChain: hasOptionalChain, hasNullCoalesce: hasNullCoalesce, hasAbortCtrl: hasAbortCtrl,
      threshold: '≥ Chromium ' + CHROMIUM_MIN,
    },
    message: pass
      ? '✅ Chromium ' + chromiumVersion + ' ≥ ' + CHROMIUM_MIN + '，所有特性可用'
      : '❌ Chromium ' + chromiumVersion + ' 不足（需 ≥ ' + CHROMIUM_MIN + '）或缺少关键特性',
  };
}

// --- 检查项 2: DeepSeek SSE 直连（make-or-break #2，30-D-04 Key 安全）---
// 安全约束：dsKey 仅用于 Authorization header，不写 localStorage，不进报告
async function checkDeepSeekSSE(dsKey) {
  if (!dsKey || !dsKey.trim().startsWith('sk-')) {
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass: false,
      rawValues: { error: 'DeepSeek Key 未填写或格式不对（需以 sk- 开头）' },
      message: '❌ 未填写 DeepSeek Key，无法测试（make-or-break #2 硬前提）',
    };
  }

  var controller = new AbortController();
  var timer = setTimeout(function () { controller.abort(); }, 15000);

  try {
    var resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + dsKey.trim(),
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',  // 最便宜，探针只需首 token
        messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
        max_tokens: 5,
        stream: true,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    var contentType = resp.headers.get('content-type') || '';
    var isSSE = contentType.includes('text/event-stream');

    if (!resp.ok) {
      return {
        id: 'DEEPSEEK_SSE',
        label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
        pass: false,
        rawValues: { httpStatus: resp.status, contentType: contentType },
        message: '❌ HTTP ' + resp.status + '（' + (resp.status === 401 ? 'Key 无效' : '请求错误') + '）',
      };
    }

    // 最小 parseSSE（参照 src/lib/sse.ts 帧分割逻辑，探针内联版）
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var firstTokenSnippet = '';
    var buf = '';

    outer: for (var i = 0; i < 20; i++) {
      var step = await reader.read();
      if (step.done) break;
      buf += decoder.decode(step.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop() || '';
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li];
        if (!line.startsWith('data:')) continue;
        var data = line.slice(5).trim();
        if (data === '[DONE]') break outer;
        if (!data) continue;
        try {
          var chunk = JSON.parse(data);
          var content = chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.content;
          if (content) { firstTokenSnippet = content.slice(0, 20); break outer; }
        } catch (_) { /* 畸形 JSON 忽略 */ }
      }
    }
    reader.cancel();

    var pass = isSSE || firstTokenSnippet.length > 0;
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass: pass,
      rawValues: { contentType: contentType, isSSE: isSSE, firstTokenSnippet: firstTokenSnippet },
      // 安全：不在 rawValues 里记录 Key 原文
      message: pass
        ? '✅ SSE 直连成功，首 token：「' + firstTokenSnippet + '」'
        : '❌ 无法拿到 SSE 响应或首 token（可能被 WPS 容器 CSP/CORS 拦截）',
    };
  } catch (err) {
    clearTimeout(timer);
    var msg = (err && err.name === 'AbortError') ? '超时（15s）' : String(err && err.message ? err.message : err);
    return {
      id: 'DEEPSEEK_SSE',
      label: 'make-or-break #2：DeepSeek SSE 直连（CORS/CSP）',
      pass: false,
      rawValues: { error: msg },
      message: '❌ fetch 抛出错误：' + msg + '（极可能是 CSP/CORS 拦截）',
    };
  }
}

// --- 检查项 3: 图片直连（非阻塞 bonus，30-D-04，不计入 go/no-go）---
// 安全约束：Key 不写 localStorage，不进报告
async function checkImageDirect(aihubmixKey, pexelsKey) {
  var results = [];

  if (aihubmixKey && aihubmixKey.trim()) {
    try {
      var resp = await fetch('https://api.aihubmix.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + aihubmixKey.trim(),
        },
        body: JSON.stringify({
          model: 'gpt-image-1',      // 已知稳定，避免 gpt-image-2 不确定性
          prompt: 'A small red circle',
          n: 1,
          size: '256x256',
          response_format: 'b64_json', // 必须 b64_json！签名 URL 被 CORS 拦（project_browser_image_gen_gotchas）
        }),
      });
      var ok = resp.ok;
      results.push({ provider: 'aihubmix', pass: ok, rawValue: ok ? '(b64 data received)' : 'HTTP ' + resp.status });
    } catch (e) {
      results.push({ provider: 'aihubmix', pass: false, rawValue: String(e && e.message ? e.message : e) });
    }
  } else {
    results.push({ provider: 'aihubmix', pass: null, rawValue: 'Key 未填（跳过）' });
  }

  if (pexelsKey && pexelsKey.trim()) {
    try {
      var presp = await fetch('https://api.pexels.com/v1/search?query=office&per_page=1', {
        headers: { 'Authorization': pexelsKey.trim() },
      });
      results.push({ provider: 'pexels', pass: presp.ok, rawValue: 'HTTP ' + presp.status });
    } catch (e) {
      results.push({ provider: 'pexels', pass: false, rawValue: String(e && e.message ? e.message : e) });
    }
  } else {
    results.push({ provider: 'pexels', pass: null, rawValue: 'Key 未填（跳过）' });
  }

  var anyFail = results.some(function (r) { return r.pass === false; });
  var allSkip = results.every(function (r) { return r.pass === null; });
  return {
    id: 'IMAGE_DIRECT',
    label: '图片直连（aihubmix/Pexels，非阻塞 bonus，不计入 go/no-go）',
    pass: allSkip ? null : !anyFail,
    rawValues: results,
    message: allSkip
      ? '⚠️ 两个 Key 均未填，图片直连测试跳过'
      : anyFail
        ? '❌ 至少一个图片提供商直连失败（记录用，不计入 go/no-go）'
        : '✅ 图片直连成功',
  };
}

// --- 检查项 4: localStorage 当前会话写入（LS_WRITE）---
var LS_SENTINEL_KEY = 'aster:probe:sentinel';
// 探针哨兵值：首次写入时基于 Date.now() 生成，跨会话回读时用于验证是否持久
// 注意：不用此 const 作为回读比对，因为跨会话重载后该值会重新生成
var LS_SENTINEL_VAL = 'wps-probe-' + Date.now();

function checkLocalStorageWrite() {
  try {
    localStorage.setItem(LS_SENTINEL_KEY, LS_SENTINEL_VAL);
    var readback = localStorage.getItem(LS_SENTINEL_KEY);
    var pass = readback === LS_SENTINEL_VAL;
    return {
      id: 'LS_WRITE',
      label: 'localStorage 写入（当前会话）',
      pass: pass,
      rawValues: { written: LS_SENTINEL_VAL, readback: readback },
      message: pass
        ? '✅ localStorage 写入并回读成功（key：' + LS_SENTINEL_KEY + '）'
        : '❌ localStorage 写入失败',
    };
  } catch (e) {
    return {
      id: 'LS_WRITE',
      label: 'localStorage 写入（当前会话）',
      pass: false,
      rawValues: { error: String(e && e.message ? e.message : e) },
      message: '❌ localStorage 写入抛出错误：' + (e && e.message ? e.message : e),
    };
  }
}

// --- 检查项 5: localStorage 跨会话持久（LS_PERSIST，本质手动：需关 WPS 重开）---
// 验证：storage.ts 的 partitionKey===undefined 降级分支在 WPS 是否自动命中（WPS-06 信号）
function checkLocalStorageRead() {
  var readback = localStorage.getItem(LS_SENTINEL_KEY);
  // 跨会话的哨兵值格式：'wps-probe-<timestamp>'
  var hasPrevValue = readback !== null && readback.startsWith('wps-probe-');
  // 验证 Office.context.partitionKey 在 WPS 是否存在（预期为 undefined，storage.ts 降级分支信号）
  var partitionKeyPresent = typeof Office !== 'undefined' && !!(Office && Office.context && Office.context.partitionKey);
  return {
    id: 'LS_PERSIST',
    label: 'localStorage 跨会话持久（关 WPS 重开后回读）',
    pass: hasPrevValue,
    rawValues: {
      readback: readback,
      partitionKeyPresent: partitionKeyPresent,
      note: 'partitionKeyPresent 应为 false（Office 对象在 WPS 不存在 → storage.ts 降级分支自动命中，WPS-06 信号）',
    },
    message: hasPrevValue
      ? '✅ 跨会话持久，读到：' + readback
      : '❌ 未读到上次写入的值（localStorage 在 WPS CEF 可能不持久，或这是首次运行——需关 WPS 重开后再点）',
  };
}

// --- 检查项 6: 字体/teal CSS 渲染（FONT_CSS，WPS-06 信号）---
// 验证 Aster 字体栈（Inter/Noto Sans SC/JetBrains Mono）+ teal CSS 在 WPS CEF 是否正常渲染
async function checkFontCSS() {
  await document.fonts.ready;

  var interLoaded = document.fonts.check('12px Inter');
  var notoLoaded  = document.fonts.check('12px "Noto Sans SC"');
  var monoLoaded  = document.fonts.check('12px "JetBrains Mono"');

  // teal 色验证：#009887 → rgb(0, 152, 135)
  var testEl = document.createElement('div');
  testEl.style.cssText = 'position:absolute; width:1px; height:1px; background:#009887; opacity:0; left:-9999px;';
  document.body.appendChild(testEl);
  var computed = getComputedStyle(testEl).backgroundColor;
  document.body.removeChild(testEl);
  var tealOk = computed.indexOf('0, 152, 135') !== -1 || computed.indexOf('#009887') !== -1;

  var pass = (interLoaded || notoLoaded) && tealOk;
  return {
    id: 'FONT_CSS',
    label: '字体/teal CSS 渲染（WPS-06 复用层信号）',
    pass: pass,
    rawValues: { interLoaded: interLoaded, notoLoaded: notoLoaded, monoLoaded: monoLoaded, tealComputedColor: computed, tealOk: tealOk },
    message: pass
      ? '✅ 字体已加载（Inter:' + interLoaded + ', NotoSC:' + notoLoaded + ', Mono:' + monoLoaded + '），teal CSS 正常'
      : '❌ 字体或 teal CSS 渲染异常（检查 WPS CEF 是否允许加载 Google Fonts）',
  };
}

// --- 检查项 7: Excel（金山表格）JSAPI read/write/undo + D-03 ---
// ⚠️ WPS JSAPI 是逐属性 async-IPC，每个 Application.* 访问都要 await（无批处理 proxy/ctx.sync）
// assertWriteResult 模式：write 后立即回读，防 WPS 静默 no-op（project_ppt_officejs_gotchas + 25-WPS-01-REPORT §7）
async function checkExcelJSAPI() {
  var results = [];
  try {
    var app = window.Application;

    // === READ：取选区地址 ===
    try {
      var sel = await app.ActiveWorkbook.ActiveSheet.Selection;
      var selAddress = await sel.Address;
      results.push({ op: 'read_selection', pass: !!selAddress, value: selAddress || '(no selection)' });
    } catch (e) {
      results.push({ op: 'read_selection', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === READ：读 A1 值 ===
    try {
      var range = await app.ActiveWorkbook.ActiveSheet.Range('A1');
      var a1Val = await range.Value;
      results.push({ op: 'read_A1', pass: true, value: a1Val !== undefined && a1Val !== null ? String(a1Val) : '(empty)' });
    } catch (e) {
      results.push({ op: 'read_A1', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === READ：列工作表 ===
    var sheetNames = [];
    try {
      var sheets = await app.ActiveWorkbook.Sheets;
      var cnt = await sheets.Count;
      for (var i = 1; i <= Math.min(cnt, 5); i++) {
        var sh = await sheets.Item(i);
        var name = await sh.Name;
        sheetNames.push(name);
      }
      results.push({ op: 'list_sheets', pass: sheetNames.length > 0, value: sheetNames.join(', ') });
    } catch (e) {
      results.push({ op: 'list_sheets', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === WRITE：写 B1 + 立即回读（assertWriteResult 模式）===
    var WRITE_VAL = 'AsterProbe_' + Date.now();
    var writePass = false;
    try {
      var b1 = await app.ActiveWorkbook.ActiveSheet.Range('B1');
      b1.Value = WRITE_VAL;
      // 立即回读验证（不假设写入成功，WPS「尽力执行」风格可能静默失败）
      var readbackB1 = await b1.Value;
      writePass = String(readbackB1) === String(WRITE_VAL);
      results.push({
        op: 'write_B1',
        pass: writePass,
        value: 'written=' + WRITE_VAL + ', readback=' + readbackB1,
      });
    } catch (e) {
      results.push({ op: 'write_B1', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === UNDO：快照还原（写 null 清除，operationLog 反向引擎原理）===
    var undoPass = false;
    try {
      var b1u = await app.ActiveWorkbook.ActiveSheet.Range('B1');
      b1u.Value = null;
      var after = await b1u.Value;
      undoPass = (after === null || after === '' || after === undefined);
      results.push({ op: 'undo_B1', pass: undoPass, value: 'after_restore=' + JSON.stringify(after) });
    } catch (e) {
      results.push({ op: 'undo_B1', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === D-03 判据：PivotCaches 对象存在性（不实际创建，防污染用户文档）===
    // 存在性/签名未验证 — 真机最终确认
    var pivotPass = false;
    try {
      var wb = app.ActiveWorkbook;
      var pivotCaches = await wb.PivotCaches;
      pivotPass = pivotCaches != null;
      results.push({
        op: 'D03_PivotTable_exists',
        pass: pivotPass,
        value: 'PivotCaches type=' + typeof pivotCaches + ', hasCreate=' + (typeof (pivotCaches && pivotCaches.Create) === 'function'),
      });
    } catch (e) {
      results.push({ op: 'D03_PivotTable_exists', pass: false, value: 'PivotCaches 不存在或抛错：' + (e && e.message ? e.message : e) });
    }

    var basicOps = ['read_selection', 'write_B1', 'undo_B1'];
    var basicPass = results.filter(function (r) { return basicOps.indexOf(r.op) !== -1; }).every(function (r) { return r.pass; });
    return {
      id: 'EXCEL_JSAPI',
      label: 'Excel（金山表格）JSAPI read/write/undo + D-03 PivotTable',
      pass: basicPass,
      rawValues: results,
      message: basicPass ? '✅ Excel 基础 read/write/undo 全通过' : '❌ Excel JSAPI 有项目失败（见 rawValues 详情）',
    };
  } catch (topErr) {
    return {
      id: 'EXCEL_JSAPI',
      label: 'Excel（金山表格）JSAPI read/write/undo + D-03 PivotTable',
      pass: false,
      rawValues: [{ op: 'init', pass: false, value: String(topErr && topErr.message ? topErr.message : topErr) }],
      message: '❌ Excel JSAPI 初始化失败（可能不在 ET 宿主中，请在金山表格中打开）：' + (topErr && topErr.message ? topErr.message : topErr),
    };
  }
}

// --- 检查项 8: PPT（金山演示）JSAPI read/write/undo + D-03 ---
// PPT JSAPI 入口：window.Application.ActivePresentation（逐属性 await，无批处理 ctx.sync）
// D-03 存在性探测：AddTable/AddLine 不在官方 Shapes 文档——存在性/签名未验证 — 真机最终确认
async function checkPptJSAPI() {
  var results = [];
  try {
    var app = window.Application;
    var pres = app.ActivePresentation;

    // === READ：取幻灯片数 ===
    var slideCount = 0;
    try {
      slideCount = await pres.Slides.Count;
      results.push({ op: 'read_slide_count', pass: slideCount > 0, value: 'Count=' + slideCount });
    } catch (e) {
      results.push({ op: 'read_slide_count', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === READ：读第一张幻灯片第一个形状文本 ===
    try {
      if (slideCount > 0) {
        var slide1 = await pres.Slides.Item(1);
        var shapes1 = await slide1.Shapes;
        var shapeCnt = await shapes1.Count;
        var shapeText = null;
        if (shapeCnt > 0) {
          var shape1 = await shapes1.Item(1);
          var tf1 = await shape1.TextFrame;
          var tr1 = await tf1.TextRange;
          shapeText = await tr1.Text;
        }
        results.push({ op: 'read_shape_text', pass: true, value: String(shapeText !== null ? shapeText : '(no shapes)') });
      }
    } catch (e) {
      results.push({ op: 'read_shape_text', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === WRITE：AddSlide + 写标题 + 立即回读（assertWriteResult）===
    var writePass = false;
    var newSlideId = null;
    try {
      var newIdx = slideCount + 1;
      var newSlide = await pres.Slides.AddSlide(newIdx);
      newSlideId = await newSlide.SlideID; // 用 SlideID 定位更稳（避免 index 竞争）
      var newShapes = await newSlide.Shapes;
      var newCnt = await newShapes.Count;
      if (newCnt > 0) {
        var titleShape = await newShapes.Item(1);
        var tf2 = await titleShape.TextFrame;
        var tr2 = await tf2.TextRange;
        var PROBE_TITLE = 'AsterProbe_title';
        tr2.Text = PROBE_TITLE;
        // 立即回读验证（不假设写入成功）
        var readbackText = await tr2.Text;
        writePass = String(readbackText).indexOf('AsterProbe') !== -1;
        results.push({ op: 'write_slide', pass: writePass, value: 'written=' + PROBE_TITLE + ', readback=' + readbackText });
      } else {
        // 无形状但 slide 建成算 write pass（基础可行）
        writePass = true;
        results.push({ op: 'write_slide', pass: true, value: '新建幻灯片(index=' + newIdx + ')成功（无形状可写）' });
      }
    } catch (e) {
      results.push({ op: 'write_slide', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === UNDO：FindBySlideID2 + Delete（模拟 inverse 操作）===
    var undoPass = false;
    try {
      if (newSlideId !== null) {
        var targetSlide = await pres.Slides.FindBySlideID2(newSlideId);
        await targetSlide.Delete();
        var afterCount = await pres.Slides.Count;
        undoPass = afterCount === slideCount;
        results.push({ op: 'undo_slide', pass: undoPass, value: 'before=' + slideCount + ', after=' + afterCount });
      }
    } catch (e) {
      results.push({ op: 'undo_slide', pass: false, value: String(e && e.message ? e.message : e) });
    }

    // === D-03 判据：copy_slide / AddTable / AddLine 存在性 ===
    // 存在性/签名未验证 — 真机最终确认（文档未列这些方法）
    try {
      if (slideCount > 0) {
        var slideD03 = await pres.Slides.Item(1);
        var shapesD03 = await slideD03.Shapes;

        // 3-1: copy_slide（Slide.Copy 或 Slide.Duplicate）
        // ASSUMED A5：官方 Slides 文档只列 AddSlide/FindBySlideID2，Copy/Duplicate 通过社区推断
        var slideCopyExists = typeof slideD03.Copy === 'function' || typeof slideD03.Duplicate === 'function';
        results.push({ op: '3-1_copy_slide', pass: slideCopyExists,
          value: 'Copy=' + typeof slideD03.Copy + ', Duplicate=' + typeof slideD03.Duplicate });

        // 3-6: Shapes.AddTable（不在官方文档——存在性/签名未验证）
        var addTableExists = typeof shapesD03.AddTable === 'function';
        results.push({ op: '3-6_AddTable', pass: addTableExists,
          value: 'AddTable=' + typeof shapesD03.AddTable });

        // 3-7: Shapes.AddLine / AddConnector（不在官方文档——存在性/签名未验证）
        var addLineExists = typeof shapesD03.AddLine === 'function';
        var addConnExists = typeof shapesD03.AddConnector === 'function';
        results.push({ op: '3-7_AddLine', pass: addLineExists || addConnExists,
          value: 'AddLine=' + typeof shapesD03.AddLine + ', AddConnector=' + typeof shapesD03.AddConnector });
      }
    } catch (e) {
      results.push({ op: 'D03_probe', pass: false, value: String(e && e.message ? e.message : e) });
    }

    var basicOps2 = ['read_slide_count', 'write_slide', 'undo_slide'];
    var basicPass2 = results.filter(function (r) { return basicOps2.indexOf(r.op) !== -1; }).every(function (r) { return r.pass; });
    return {
      id: 'PPT_JSAPI',
      label: 'PPT（金山演示）JSAPI read/write/undo + D-03',
      pass: basicPass2,
      rawValues: results,
      message: basicPass2 ? '✅ PPT 基础 read/write/undo 全通过' : '❌ PPT JSAPI 有项目失败（见 rawValues 详情）',
    };
  } catch (topErr) {
    return {
      id: 'PPT_JSAPI',
      label: 'PPT（金山演示）JSAPI read/write/undo + D-03',
      pass: false,
      rawValues: [{ op: 'init', pass: false, value: String(topErr && topErr.message ? topErr.message : topErr) }],
      message: '❌ PPT JSAPI 初始化失败（可能不在 WPP 宿主中，请在金山演示中打开）：' + (topErr && topErr.message ? topErr.message : topErr),
    };
  }
}

// --- 报告生成器（30-D-03：单段可复制文本，含各项 pass/fail + 关键原始值）---
// 安全：rawValues 不含 API Key 原文（见 checkDeepSeekSSE 中的安全约束注释）
function generateReport(results) {
  var lines = ['=== Aster WPS 探针结果报告 ===', '时间：' + new Date().toISOString(), ''];
  for (var ri = 0; ri < results.length; ri++) {
    var r = results[ri];
    var statusIcon = r.pass === true ? '✅PASS' : r.pass === false ? '❌FAIL' : '⚠️SKIP';
    lines.push('[' + statusIcon + '] ' + r.label);
    if (r.rawValues) {
      try {
        lines.push('  原始值：' + JSON.stringify(r.rawValues, null, 2));
      } catch (_) {
        lines.push('  原始值：(序列化失败)');
      }
    }
    lines.push('');
  }

  // go/no-go 裁定摘要（30-D-02 框架：两生死线绿 AND (Excel绿 OR PPT绿)）
  var mob1 = null, mob2 = null, excelBasic = null, pptBasic = null;
  for (var ri2 = 0; ri2 < results.length; ri2++) {
    if (results[ri2].id === 'CEF_VERSION') mob1 = results[ri2].pass;
    if (results[ri2].id === 'DEEPSEEK_SSE') mob2 = results[ri2].pass;
    if (results[ri2].id === 'EXCEL_JSAPI') excelBasic = results[ri2].pass;
    if (results[ri2].id === 'PPT_JSAPI') pptBasic = results[ri2].pass;
  }
  var jsapiGreen = excelBasic === true || pptBasic === true;
  var goVerdict  = (mob1 === true && mob2 === true && jsapiGreen) ? 'GO ✅' : 'NO-GO ❌';

  lines.push('=== go/no-go 裁定摘要（30-D-02 框架）===');
  lines.push('make-or-break #1 CEF版本：' + (mob1 === true ? 'PASS' : mob1 === false ? 'FAIL' : 'SKIP'));
  lines.push('make-or-break #2 SSE直连：' + (mob2 === true ? 'PASS' : mob2 === false ? 'FAIL' : 'SKIP'));
  lines.push('Excel 基础读写撤销：' + (excelBasic === true ? 'PASS' : 'FAIL/SKIP'));
  lines.push('PPT 基础读写撤销：' + (pptBasic === true ? 'PASS' : 'FAIL/SKIP'));
  lines.push('综合裁定（两生死线绿 AND Excel/PPT 其一绿）：' + goVerdict);
  lines.push('');
  lines.push('=== 首宿主裁定判据（D-03）===');
  // 从 rawValues 里找 D-03 各项
  for (var ri3 = 0; ri3 < results.length; ri3++) {
    var rv = results[ri3].rawValues;
    if (!Array.isArray(rv)) continue;
    for (var vi = 0; vi < rv.length; vi++) {
      var item = rv[vi];
      if ((item.op && item.op.indexOf('D03') !== -1) || (item.op && item.op.indexOf('3-') === 0)) {
        lines.push('  [' + (item.pass ? '✅' : '❌') + '] ' + item.op + ': ' + item.value);
      }
    }
  }

  return lines.join('\n');
}

function copyReport() {
  var reportArea = document.getElementById('report-area');
  if (!reportArea || !lastReport) return;
  navigator.clipboard.writeText(lastReport).then(function () {
    var btn = document.getElementById('copy-btn');
    if (btn) { btn.textContent = '✅ 已复制！'; setTimeout(function () { btn.textContent = '📋 复制结果报告'; }, 2000); }
  }).catch(function () {
    // 降级：选中文本区让用户手动 Ctrl+C
    if (reportArea.select) reportArea.select();
    var btn = document.getElementById('copy-btn');
    if (btn) btn.textContent = '请手动 Ctrl+C 复制';
  });
}

// --- 主检查入口（30-D-03 按钮回调，30-D-02 串行硬门逻辑）---
async function runAllChecks() {
  var btn = document.getElementById('run-btn');
  var statusText = document.getElementById('status-text');
  var resultsDiv = document.getElementById('results');
  var reportArea = document.getElementById('report-area');
  var copyBtn = document.getElementById('copy-btn');

  if (btn) btn.disabled = true;
  if (statusText) statusText.textContent = '检查中...';
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (reportArea) { reportArea.style.display = 'none'; reportArea.textContent = ''; }
  if (copyBtn) copyBtn.style.display = 'none';

  // 读取 Key 值（不存储）
  var dsKey = (document.getElementById('deepseek-key') || {}).value || '';
  var ahKey = (document.getElementById('aihubmix-key') || {}).value || '';
  var pxKey = (document.getElementById('pexels-key') || {}).value || '';

  var allResults = [];

  function renderItem(r) {
    var el = document.createElement('div');
    var cls = r.pass === true ? 'item pass' : r.pass === false ? 'item fail' : 'item skip';
    el.className = cls;
    el.textContent = r.message;
    if (resultsDiv) resultsDiv.appendChild(el);
  }

  // === 串行 make-or-break（30-D-02 两条生死线，任一 FAIL → no-go + 停止后续）===

  if (statusText) statusText.textContent = '检查中：CEF 版本探测...';
  var cefResult = await checkCEFVersion();
  allResults.push(cefResult);
  renderItem(cefResult);

  if (cefResult.pass === false) {
    var noGoEl = document.createElement('div');
    noGoEl.className = 'item fail';
    noGoEl.textContent = '🛑 make-or-break #1 FAIL → NO-GO，后续检查跳过（CEF 版本不足，无法运行 React 19 + SSE）';
    if (resultsDiv) resultsDiv.appendChild(noGoEl);
    // 仍生成报告（即使 no-go，让用户复制回贴以便诊断）
    lastReport = generateReport(allResults);
    if (reportArea) { reportArea.textContent = lastReport; reportArea.style.display = 'block'; }
    if (copyBtn) copyBtn.style.display = 'inline-block';
    if (btn) btn.disabled = false;
    if (statusText) statusText.textContent = '❌ NO-GO（CEF 版本不足）';
    return;
  }

  if (statusText) statusText.textContent = '检查中：DeepSeek SSE 直连...';
  var sseResult = await checkDeepSeekSSE(dsKey);
  allResults.push(sseResult);
  renderItem(sseResult);

  if (sseResult.pass === false) {
    var noGoEl2 = document.createElement('div');
    noGoEl2.className = 'item fail';
    noGoEl2.textContent = '🛑 make-or-break #2 FAIL → NO-GO（无后台 Core Value 在 WPS 失效），后续检查跳过';
    if (resultsDiv) resultsDiv.appendChild(noGoEl2);
    lastReport = generateReport(allResults);
    if (reportArea) { reportArea.textContent = lastReport; reportArea.style.display = 'block'; }
    if (copyBtn) copyBtn.style.display = 'inline-block';
    if (btn) btn.disabled = false;
    if (statusText) statusText.textContent = '❌ NO-GO（SSE 直连被拦）';
    return;
  }

  // === 其余检查（两条生死线均绿后运行）===
  if (statusText) statusText.textContent = '检查中：其余检查项...';

  var lsWriteResult = checkLocalStorageWrite();
  allResults.push(lsWriteResult);
  renderItem(lsWriteResult);

  var lsReadResult = checkLocalStorageRead();
  allResults.push(lsReadResult);
  renderItem(lsReadResult);

  var fontResult = await checkFontCSS();
  allResults.push(fontResult);
  renderItem(fontResult);

  var imgResult = await checkImageDirect(ahKey, pxKey);
  allResults.push(imgResult);
  renderItem(imgResult);

  var excelResult = await checkExcelJSAPI();
  allResults.push(excelResult);
  renderItem(excelResult);

  var pptResult = await checkPptJSAPI();
  allResults.push(pptResult);
  renderItem(pptResult);

  // 生成报告
  lastReport = generateReport(allResults);
  if (reportArea) { reportArea.textContent = lastReport; reportArea.style.display = 'block'; }
  if (copyBtn) copyBtn.style.display = 'inline-block';
  if (btn) btn.disabled = false;

  var excelPass = excelResult && excelResult.pass === true;
  var pptPass   = pptResult && pptResult.pass === true;
  var verdict   = excelPass || pptPass ? '✅ 两生死线绿 + 首宿主候选有绿 → GO' : '❌ 两生死线绿但首宿主候选均未绿 → NO-GO';
  if (statusText) statusText.textContent = verdict;
}
