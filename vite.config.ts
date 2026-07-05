import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Relative base paths work best for chrome-extension:// URLs.
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Build four extension entry points:
    // - popup/options are React UI pages
    // - background/content are extension scripts
    rollupOptions: {
      input: {
        popup: path.resolve(__dirname, 'popup/index.html'),
        options: path.resolve(__dirname, 'options/index.html'),
        background: path.resolve(__dirname, 'src/background/index.ts'),
        content: path.resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        // Predictable names make manifest.json references stable.
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: (assetInfo) => {
          // CSS is shared by popup and options, so give it a generic name.
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? ''
          if (name.endsWith('.css')) {
            return 'assets/styles.css'
          }
          return 'assets/[name].[ext]'
        },
        manualChunks(id) {
          // Keep React in a shared vendor chunk used by popup and options.
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor'
          }
          return undefined
        },
      },
    },
  },
})
