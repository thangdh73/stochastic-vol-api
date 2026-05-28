import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiPort = process.env.MMRA_API_PORT ?? process.env.VITE_API_PORT ?? '8002'
const apiTarget = `http://127.0.0.1:${apiPort}`
const devPort = Number(process.env.VITE_DEV_PORT ?? '5174')

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: devPort,
    strictPort: true,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
})
