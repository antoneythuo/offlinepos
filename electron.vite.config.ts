import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

// Removes crossorigin attributes and CSP meta tag from the built index.html.
// crossorigin breaks file:// loading; CSP 'self' blocks ES modules under file:// in Electron.
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html: string) {
      return html
        .replace(/ crossorigin/g, '')
        .replace(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi, '')
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'dist-electron'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts')
        }
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: resolve(__dirname, 'dist-electron/preload'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'renderer'),
    base: './',
    build: {
      outDir: resolve(__dirname, 'dist-renderer'),
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'renderer/index.html')
        }
      }
    },
    plugins: [react(), removeCrossorigin()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'renderer/src'),
        '@': resolve(__dirname, 'src')
      }
    }
  }
})
