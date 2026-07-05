import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// QUAN TRỌNG: đổi "soquy-app" thành đúng TÊN REPO GitHub của bạn.
// Nếu repo tên là "so-quy" thì sửa thành base: '/so-quy/'
export default defineConfig({
  plugins: [react()],
  base: '/soquy-app/',
})
