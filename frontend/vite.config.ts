import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import path from 'path'

// Backend port — single source of truth for dev/preview proxy
// Backend runs on :8000, frontend dev server on :5100
const BACKEND_PORT = process.env.APEX_BACKEND_PORT || '8000'
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

// Phase A — Build-time fingerprints
let GIT_SHA = 'unknown'
try {
  GIT_SHA = execSync('git rev-parse --short=12 HEAD').toString().trim()
} catch { /* not a git repo */ }
const BUILD_TIME = new Date().toISOString()

// https://vite.dev/config/
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
  server: {
    port: 5100,
    host: '0.0.0.0',
    strictPort: true,
    proxy: {
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
