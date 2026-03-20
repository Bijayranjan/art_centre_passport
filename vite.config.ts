
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // This ensures process.env.API_KEY works in the browser on Vercel
  define: {
    'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || ''),
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
  }
});
