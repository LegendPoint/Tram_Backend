import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    define: {
      'process.env': {}
    },
    server: {
      port: 5173,
      host: true
    },
    build: {
      rollupOptions: {
        input: {
          main: './index.html'
        }
      }
    },
    template: {
      transformIndexHtml: (html) => {
        return html.replace(
          /%VITE_GOOGLE_MAPS_API_KEY%/g,
          env.VITE_GOOGLE_MAPS_API_KEY
        )
      }
    }
  }
}) 