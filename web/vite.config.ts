import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    // Same-origin API in development, so session cookies just work
    proxy: { '/api': { target: process.env.API_PROXY ?? 'http://localhost:8787', changeOrigin: false } },
  },
})
