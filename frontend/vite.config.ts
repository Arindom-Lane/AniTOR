import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward every /api/* call to the NestJS backend during dev, so
    // the React code can just fetch('/api/...') exactly like the old
    // vanilla-JS version did, with zero backend URL hardcoded anywhere.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
