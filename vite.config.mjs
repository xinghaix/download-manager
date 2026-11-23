import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: './',
  publicDir: 'public',
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        offscreen: resolve(import.meta.dirname, 'offscreen.html'),
        background: resolve(import.meta.dirname, 'src/background.js')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js'
          }
          if (chunkInfo.name === 'offscreen') {
            return 'offscreen.js'
          }
          return 'js/[name].[hash].js'
        },
        chunkFileNames: 'js/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] || assetInfo.name || ''
          if (name.endsWith('.css')) {
            return 'css/[name].[hash][extname]'
          }
          return 'assets/[name].[hash][extname]'
        }
      }
    }
  }
})
