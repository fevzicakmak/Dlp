import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/Dlp/',
  plugins: [react()],
  server: {
    host: true,
    port: 8889,
  },
});
