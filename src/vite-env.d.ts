/// <reference types="vite/client" />

// 构建身份戳全局常量（诊断用，260604-gld）。
// 由 vite.config.ts 的 `define` 在编译期替换为字符串字面量；
// define 未生效的上下文（极少数）下读取走 debugReport 的 typeof 守卫退回 'unknown'。
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TIME__: string;
