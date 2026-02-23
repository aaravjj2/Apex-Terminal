import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Backend port — single source of truth for dev/preview proxy
const BACKEND_PORT = process.env.APEX_BACKEND_PORT || '8090'
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
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
