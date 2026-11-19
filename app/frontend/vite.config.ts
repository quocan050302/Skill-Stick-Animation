import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiPort = process.env.VITE_API_PORT || '8787';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: Number(process.env.VITE_PORT || 5173),
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: false,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    sourcemap: false,
  },
});
