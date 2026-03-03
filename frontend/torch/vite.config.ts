import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  server: {
    proxy: {
      '/authenticate': {
        target: 'http://localhost:808',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/api': {
        target: 'http://localhost:808',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/orgs': {
        target: 'http://localhost:808',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
      '/org-invites': {
        target: 'http://localhost:808',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})

export default config
