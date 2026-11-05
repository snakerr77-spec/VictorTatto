import path from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

const api = `http://localhost:${process.env.PORT ?? 3011}`

export default defineConfig({
  // GitHub Pages serve o site numa subpasta (/NomeDoRepositorio/): o workflow define VITE_BASE.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5190,
    proxy: { '/api': api, '/uploads': api },
  },
})
