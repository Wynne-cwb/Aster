// WORKER/STATIC ASSET RULE (Shared Pattern 2 — do not remove):
// Any worker, WASM, or static asset MUST use:
//   new URL('path/to/asset', import.meta.url).href
// NEVER use ?url imports — they work in dev but break after build (worker not found).
// Reference: spike/pdfjs-vite-test/README.md Pitfall 7
// This applies to pdf.js workers (Phase 3) and any future worker/WASM additions.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import officeAddin from 'vite-plugin-office-addin';
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
    officeAddin(),
    // @lingui/vite-plugin: enables Lingui macro transforms at build time (D-17)
    lingui(),
  ],
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
          fluent: ['@fluentui/react-components'],
          markdown: ['react-markdown', 'remark-gfm'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
