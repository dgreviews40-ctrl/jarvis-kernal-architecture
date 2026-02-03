import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { bundleAnalyzerPlugin } from './vite-plugins/bundleAnalyzer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isBuild = mode === 'production';
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        isBuild && bundleAnalyzerPlugin({
          outputPath: './dist/bundle-report.json',
          generateReport: true,
        }),
      ].filter(Boolean),
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              // Core vendor chunks
              'vendor-react': ['react', 'react-dom'],
              'vendor-zustand': ['zustand'],
              'vendor-icons': ['lucide-react'],
              // Feature chunks
              'feature-intelligence': [
                './services/intelligence',
                './services/intelligence/conversationalContext',
                './services/intelligence/predictiveModel',
                './services/intelligence/personalityEngine',
                './services/intelligence/knowledgeGraph',
                './services/intelligence/multiTurnReasoning',
                './services/intelligence/naturalResponse',
                './services/intelligence/proactiveIntelligence',
                './services/intelligence/semanticMemory',
              ],
              'feature-vision': [
                './services/vision',
                './services/vision_ha_camera',
              ],
              'feature-voice': [
                './services/voice',
                './services/piperLauncher',
              ],
            }
          }
        },
        chunkSizeWarningLimit: 500
      }
    };
});
