import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const sourceAliases = {
  main: {
    '@main': resolve(projectRoot, 'src/main'),
    '@shared': resolve(projectRoot, 'src/shared')
  },
  preload: {
    '@preload': resolve(projectRoot, 'src/preload'),
    '@shared': resolve(projectRoot, 'src/shared')
  },
  renderer: {
    '@renderer': resolve(projectRoot, 'src/renderer'),
    '@shared': resolve(projectRoot, 'src/shared')
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: sourceAliases.main
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
          chunkFileNames: '[name]-[hash].cjs'
        }
      }
    },
    resolve: {
      alias: sourceAliases.preload
    }
  },
  renderer: {
    root: resolve(projectRoot, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(projectRoot, 'src/renderer/index.html'),
          quickNote: resolve(projectRoot, 'src/renderer/quick-note.html')
        }
      }
    },
    resolve: {
      alias: sourceAliases.renderer
    },
    plugins: [react()]
  }
})
