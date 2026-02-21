import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * OPTIMIZED Vite Config for FAST Development Startup
 */
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        open: false,
        hmr: {
          overlay: false,
        },
        watch: {
          ignored: ['**/node_modules/**', '**/.git/**'],
        },
        proxy: {
          // Proxy ComfyUI requests to avoid CORS issues
          '/comfyui': {
            target: 'http://127.0.0.1:8188',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/comfyui/, ''),
          },
        },
      },
      plugins: [
        react(),
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY),
        'process.env.VITE_OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        sourcemap: false,
      },
      // PRE-BUNDLE key dependencies for faster startup
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-dom/client',
          'lucide-react',
          'zustand',
          'zustand/middleware',
        ],
        force: false,
      },
      logLevel: 'warn',
      clearScreen: false,
    };
});
