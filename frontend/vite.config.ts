import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'

// Backend port — single source of truth for dev/preview proxy
const BACKEND_PORT = process.env.APEX_BACKEND_PORT || '8000'
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

// Phase A — Build-time fingerprints
let GIT_SHA = 'unknown'
try {
  GIT_SHA = execSync('git rev-parse --short=12 HEAD').toString().trim()
} catch { /* not a git repo */ }
const BUILD_TIME = new Date().toISOString()

export default defineConfig({
  base: '/',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  plugins: [react()],
  define: {
    '__GIT_SHA__': JSON.stringify(GIT_SHA),
    '__BUILD_TIME__': JSON.stringify(BUILD_TIME),
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Charting — only lightweight-charts (the active chart library)
          'vendor-charts-lw': ['lightweight-charts'],
          // State management
          'vendor-zustand': ['zustand'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge'],
        },
        // Hash filenames for long-term caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'zustand',
      'lightweight-charts',
    ],
  },
  server: {
    port: 5100,
    host: '0.0.0.0',
    strictPort: true,
    hmr: {
      overlay: true,
    },
    proxy: {
      // ── Specific rewrites MUST come before the generic /api catch-all ──
      // Frontend pages call /api/autopilot/... but backend serves /api/v1/autopilot/...
      '/api/autopilot': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/autopilot/, '/api/v1/autopilot'),
      },
      // Frontend calls /api/market-quote/quote or /api/market-quote → /api/v1/market/quote
      '/api/market-quote': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => {
          if (path.startsWith('/api/market-quote/quote')) return path.replace('/api/market-quote/quote', '/api/v1/market/quote');
          return path.replace('/api/market-quote', '/api/v1/market/quote');
        },
      },
      // Generic catch-all
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: {
    port: 5100,
    strictPort: true,
    proxy: {
      '/api/autopilot': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/autopilot/, '/api/v1/autopilot'),
      },
      '/api/market-quote': {
        target: BACKEND_URL,
        changeOrigin: true,
        rewrite: (path) => {
          if (path.startsWith('/api/market-quote/quote')) return path.replace('/api/market-quote/quote', '/api/v1/market/quote');
          return path.replace('/api/market-quote', '/api/v1/market/quote');
        },
      },
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      '/ws': {
        target: BACKEND_URL,
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
