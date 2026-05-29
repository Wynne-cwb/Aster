// eslint 冒烟 fixture：本文件故意违反 TOOL-07，由 ns-violation 冒烟脚本单独 lint 验证应报 error
// 切勿在生产代码中模仿此写法（Office namespace 只能在 src/adapters/*Adapter.ts 内使用 — A-06/TOOL-07）

// TOOL-07 违例：直接在 agent 目录引用 PowerPoint namespace
export async function bad() {
  return await PowerPoint.run(async () => {});
}
