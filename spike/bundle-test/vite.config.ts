import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Phase 0 Spike #9 — bundle-size 基线
// manualChunks 拆分以便 visualizer 能清楚看到各依赖占比
export default defineConfig({
  plugins: [react()],
  build: {
    // 默认 esbuild 压缩，gzipped 估算来自 Vite build output 的 gzip 列
    reportCompressedSize: true,
    rollupOptions: {
      output: {
        manualChunks: {
          fluent: ['@fluentui/react-components'],
          markdown: ['react-markdown', 'remark-gfm'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
