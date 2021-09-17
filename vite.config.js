import { defineConfig } from 'vite'
import vitePluginSsrRscMiddleware from './src/vite-plugins/vite-plugin-ssr-rsc-middleware'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vitePluginSsrRscMiddleware(),
  ],
  esbuild: {
    jsxInject: `import React from 'react'`
  },
  build: {
    minify: false
  }
})