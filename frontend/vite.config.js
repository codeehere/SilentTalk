import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,       // No source maps in production
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons: ['react-icons'],
          socket: ['socket.io-client'],
          nacl: ['tweetnacl', 'tweetnacl-util'],
        }
      }
    }
  },
  server: {
    host: true,             // expose on LAN for dev
    port: 5173,
  }
})
