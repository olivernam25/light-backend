import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "/light_web",
  server: {
    port: 3000, // Đổi số này thành cổng bạn muốn
  }
})
