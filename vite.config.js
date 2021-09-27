import { defineConfig } from 'vite'
import vitePluginSsrRscMiddleware from './src/vite-plugins/vite-plugin-ssr-rsc-middleware'
import Inspect from 'vite-plugin-inspect'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    Inspect(),
    vitePluginSsrRscMiddleware(),
  ],
  esbuild: {
    jsxInject: `import React from 'react'`
  },
  build: {
    minify: false
  }
})