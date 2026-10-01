import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // En Aspire, el AppHost inyecta PORT para el endpoint HTTP del recurso.
  // Fuera de Aspire se usa el 5173 por defecto.
  server: { port: Number(process.env.PORT) || 5173, host: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
})
