import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5002',
        changeOrigin: true,
      },
      '/mcp': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
    },
    hmr: {
      host: 'localhost',
      protocol: 'ws',
      clientPort: 3004,
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
