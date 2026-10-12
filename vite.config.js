import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    watch: {
      // Detecta alterações mesmo quando o sistema não emite eventos de arquivos.
      usePolling: true,
      interval: 300,
      ignored: ['**/Supermemoria/**'],
    },
  },
});
