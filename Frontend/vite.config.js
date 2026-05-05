import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: {
    exclude: ['olamaps-web-sdk'],
  },
  server:{
    host:"0.0.0.0",
    fs:{
      strict:false,
    },
  },
  plugins: [react()],
})
