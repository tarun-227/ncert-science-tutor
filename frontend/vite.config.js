import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api':     'http://localhost:8000',
      '/figures': 'http://localhost:8000',
    }
  }
})
