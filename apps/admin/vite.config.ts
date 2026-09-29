import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// ADMIN_BASE lets you serve the admin from a sub-folder, e.g. https://example.com/admin/
export default defineConfig({
  base: process.env.ADMIN_BASE ?? '/',
  plugins: [react()],
  // VITE_DEMO=1 builds the self-contained live demo (in-browser sample API).
  define: { __DEMO__: JSON.stringify(process.env.VITE_DEMO === '1') },
  server: {
    port: 5173,
    // In development the API runs on :3000; same-origin /api calls are proxied to it.
    proxy: { '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000' },
  },
})
