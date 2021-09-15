import { defineConfig } from 'vite'
import vitePluginSsrRscMiddleware from './src/vite-plugins/vite-plugin-ssr-rsc-middleware'
import vitePliginRSCShim from './src/vite-plugins/vite-plugin-rsc-shim'
import reactRefresh from '@vitejs/plugin-react-refresh'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vitePluginSsrRscMiddleware(),
    vitePliginRSCShim()
  ],
  esbuild: {
    jsxInject: `import React from 'react'`
  },
  build: {
    minify: false
  }
})