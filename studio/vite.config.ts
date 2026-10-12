import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@active-template': path.resolve(__dirname, '../templates/motion-starter/src'),
    },
    dedupe: ['react', 'react-dom', 'remotion', '@remotion/player'],
  },
  optimizeDeps: {
    include: [
      '@remotion/google-fonts',
      '@remotion/google-fonts/Cairo',
      '@remotion/google-fonts/Cinzel',
      '@remotion/google-fonts/Montserrat',
      '@remotion/google-fonts/Tajawal',
      '@remotion/google-fonts/Almarai',
      '@remotion/google-fonts/Alexandria',
      '@remotion/google-fonts/Amiri',
      '@remotion/google-fonts/Caveat',
      '@remotion/google-fonts/Inter',
      '@remotion/google-fonts/Roboto',
      '@remotion/google-fonts/Poppins',
      '@remotion/google-fonts/Outfit',
      '@remotion/google-fonts/Rubik',
      '@remotion/google-fonts/PlayfairDisplay',
      'remotion',
      '@remotion/player',
    ],
    holdUntilCrawlEnd: true,
  },
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/auth': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/images': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
      '/videos': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
