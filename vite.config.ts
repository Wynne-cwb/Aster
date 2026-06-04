// WORKER/STATIC ASSET RULE (Shared Pattern 2 — do not remove):
// Any worker, WASM, or static asset MUST use:
//   new URL('path/to/asset', import.meta.url).href
// NEVER use ?url imports — they work in dev but break after build (worker not found).
// Reference: spike/pdfjs-vite-test/README.md Pitfall 7
// This applies to pdf.js workers (Phase 3) and any future worker/WASM additions.

import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 构建身份戳（诊断用，260604-gld）：注入短 commit hash + ISO 构建时间。
// git 缺失（如无 .git 的 tarball 构建）时退回 'unknown'，绝不让构建失败。
// CI（GitHub Actions Deploy）checkout 后 git 可用，hash 即线上部署版本。
function resolveBuildCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}
const BUILD_COMMIT = resolveBuildCommit();
// new Date() 在 Node 构建期执行，非浏览器运行期——安全。
const BUILD_TIME = new Date().toISOString();
// vite-plugin-office-addin 是 CJS 模块，需用 .default 解包 ESM/CJS 互操作（Rule 3 auto-fix）
import _officeAddin from 'vite-plugin-office-addin';
const officeAddin = (_officeAddin as unknown as { default: typeof _officeAddin }).default ?? _officeAddin;
import { lingui } from '@lingui/vite-plugin';

export default defineConfig({
  plugins: [
    // @vitejs/plugin-react (NOT SWC variant) with babel macros for Lingui macro support.
    // Do NOT switch to @vitejs/plugin-react-swc — it conflicts with babel-macro transforms.
    react({
      babel: {
        plugins: ['macros'],
      },
    }),
    // vite-plugin-office-addin: manages HTTPS dev certs and manifest serving (D-05)
    // Options are optional (devUrl/prodUrl) — pass empty object to satisfy required parameter.
    officeAddin({}),
    // @lingui/vite-plugin: enables Lingui macro transforms at build time (D-17)
    lingui(),
  ],
  // 构建身份戳（诊断用，260604-gld）：编译期把这两个标识符替换为字符串字面量。
  // debugReport.buildEnvSection() 用 typeof 守卫读取，define 未生效时退回 'unknown'。
  define: {
    __BUILD_COMMIT__: JSON.stringify(BUILD_COMMIT),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  // GitHub Pages sub-path hosting: manifest URLs use https://wynne-cwb.github.io/Aster/...
  base: '/Aster/',
  build: {
    // Show gzip-compressed sizes in build output (matches spike baseline ~135KB gzip)
    reportCompressedSize: true,
    rollupOptions: {
      input: {
        // Task Pane entry point
        main: 'index.html',
        // Ribbon function command handler page (created in plan 04)
        commands: 'commands.html',
      },
      output: {
        // Split large dependencies into separate chunks for size-limit visibility
        manualChunks: {
          markdown: ['react-markdown', 'remark-gfm'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
