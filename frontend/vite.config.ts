import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.MMRA_API_PORT ?? env.VITE_API_PORT ?? '8002'
  const apiTarget = `http://127.0.0.1:${apiPort}`
  const devPort = Number(env.VITE_DEV_PORT ?? '5174')
  const base = env.VITE_BASE_PATH || '/'

  return {
    base,
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
  }
})
