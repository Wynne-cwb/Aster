/**
 * Aster — Commands Runtime Entry
 *
 * 此文件是 manifest FunctionFile 的 module entry，由 commands.html 引入。
 *
 * Phase 1 决策（D-11）：6 个 ribbon 按钮全部走 ShowTaskpane，
 * 点击直接打开 Task Pane，不走 ExecuteFunction。
 * 因此 Office.actions.associate 预置的 'openTaskpane' handler
 * 在 Phase 1 中不会被任何按钮触发——它是 Phase 4-6 的扩展预留点。
 *
 * Phase 4-6 扩展指南：
 * 1. 将 manifest.xml 中对应按钮的 <Action xsi:type="ShowTaskpane"> 改为
 *    <Action xsi:type="ExecuteFunction"><FunctionName>openTaskpane</FunctionName></Action>
 * 2. 在此文件添加更多 Office.actions.associate('<FunctionName>', handler) 注册
 */

Office.onReady(() => {
  // Phase 4-6 若改用 ExecuteFunction 模式，此处预置的 associate 即可接管按钮点击。
  // Phase 1 走 ShowTaskpane，此 associate 暂未被任何按钮引用，但保留可读的扩展点。
  Office.actions.associate('openTaskpane', (event: Office.AddinCommands.Event) => {
    // Phase 1: ShowTaskpane 已直接处理 Task Pane 开启，此 handler 暂为预留。
    // Phase 4-6: 在此实现具体业务逻辑（如传递上下文参数给 Task Pane）。
    event.completed();
  });
});
