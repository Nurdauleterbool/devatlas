
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Prebundle the lazy graph before serving concurrent browser-test pages.
  // Discovering it at runtime can otherwise reload an open form mid-test.
  optimizeDeps: { include: ['@xyflow/react'] },
})
