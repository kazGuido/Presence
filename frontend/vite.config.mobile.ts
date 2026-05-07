import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

/** Capacitor bundle: outputs to `frontend/dist` (see capacitor.config.ts webDir). Docker build uses vite.config.ts → backend static. */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/uploads': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
