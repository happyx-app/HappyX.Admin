import { defineConfig } from 'vite'

// In development, run the API with ADMIN_KEY_HASH set and let Vite forward /api/admin like nginx
// does in production, adding the admin key:
//   API_URL=http://localhost:8081 ADMIN_API_KEY=<key> npm run dev
export default defineConfig({
  server: {
    port: 8090,
    proxy: {
      '/api/admin': {
        target: process.env.API_URL ?? 'http://localhost:8081',
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: { Authorization: `Bearer ${process.env.ADMIN_API_KEY ?? ''}` },
      },
    },
  },
})
