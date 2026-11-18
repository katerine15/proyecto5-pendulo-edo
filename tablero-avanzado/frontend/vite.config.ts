import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo, /api se redirige al backend (uvicorn en :8000).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8000' } },
  preview: { port: 4173, proxy: {} }, // la vista previa estática NO usa backend (prueba del modo local)
  build: {
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
          if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) return 'motion'
        },
      },
    },
  },
  test: { environment: 'node' },
})
